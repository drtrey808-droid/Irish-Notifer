const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const PORT = process.env.PORT || 3000;

const GITHUB_TOKEN = "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";
const GIST_ID      = "67030845f08f06570d417fab7bdf18bd";

const WEBHOOKS = {
    MID:   "https://discord.com/api/webhooks/1487734007402598542/rTWbPP-Axz8aCajw8s7zIHXkt9b_4V9uu5_0HkpsojUZsiMyllbGp8vxHisf4FarW-CH",
    HIGH:  "https://discord.com/api/webhooks/1487734095805943920/HGFjfAKKB708m5xQ0OfvT6Id8wD4F6-wgRc_dqki9Tl76vlGZ4rTjgw97CFAtMRmVfdc",
    ULTRA: "https://discord.com/api/webhooks/1487734138902413372/KZdwjEElM4NqHtHwnfLN8oGEvIgsLMNzTOt1gsmsV8zZ1VRZ8dKyNT2pj8OL1ng44mnw",
};

// In-memory ping store
let latestPing = null;
const pingHistory = [];

// ESP users store
const espUsers = {};
const ESP_EXPIRY = 60000;

// ── PING endpoint (bots post here) ──────────────────────────
app.post('/api/ping', async (req, res) => {
    try {
        const ping = req.body;
        if (!ping || !ping.job_id) return res.status(400).json({ error: 'Missing job_id' });

        latestPing = { ...ping, received_at: Date.now() };
        pingHistory.unshift(latestPing);
        if (pingHistory.length > 50) pingHistory.pop();

        // Push to Gist so hopper can use it
        await pushToGist(ping);

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET latest ping (AJ polls here) ─────────────────────────
app.get('/api/ping', (req, res) => {
    if (!latestPing) return res.json({ ping: null });
    res.json({ ping: latestPing });
});

// ── GET ping history ─────────────────────────────────────────
app.get('/api/pings', (req, res) => {
    res.json({ pings: pingHistory });
});

// ── ESP register/fetch ───────────────────────────────────────
app.post('/api/esp/register', (req, res) => {
    const { username, job_id } = req.body;
    if (!username || !job_id) return res.status(400).json({ error: 'Missing fields' });
    espUsers[username] = { job_id, ts: Date.now() };
    res.json({ ok: true });
});

app.get('/api/esp/users', (req, res) => {
    const { job_id } = req.query;
    if (!job_id) return res.status(400).json({ error: 'Missing job_id' });
    const now = Date.now();
    const users = Object.entries(espUsers)
        .filter(([_, v]) => v.job_id === job_id && now - v.ts < ESP_EXPIRY)
        .map(([username]) => username);
    res.json({ users });
});

// ── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'Irish Notifier backend online' }));

// ── Push to Gist ─────────────────────────────────────────────
async function pushToGist(ping) {
    try {
        const content = JSON.stringify({
            servers: [{
                job_id:   ping.job_id,
                place_id: ping.place_id,
                name:     ping.name,
                money:    ping.money,
                players:  ping.players || '?',
                ts:       Date.now(),
            }],
            ts:    Date.now(),
            count: 1,
        });
        await axios.patch(
            `https://api.github.com/gists/${GIST_ID}`,
            { files: { 'servers.json': { content } } },
            { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );
    } catch (e) {
        console.error('Gist push failed:', e.message);
    }
}

app.listen(PORT, () => console.log(`Irish Notifier backend running on port ${PORT}`));
