// AI Browser Remote Control API
// Stores pending commands and results for AI-to-browser communication
// Uses module-level Map (Vercel keeps instances warm, works for single-user)

import { withRateLimit } from './_ratelimit.js';

const cmdStore = new Map();
const resultStore = new Map();

function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    // AI sends command: { type, data }
    const { type, data, id } = req.body || {};
    if (!type) return res.status(400).json({ error: 'Missing type' });
    const commandId = id || Date.now().toString(36);
    cmdStore.set(commandId, { type, data, id: commandId, ts: Date.now() });
    // Clean old commands
    if (cmdStore.size > 50) {
      const keys = [...cmdStore.keys()].slice(0, cmdStore.size - 50);
      keys.forEach(k => cmdStore.delete(k));
    }
    return res.json({ ok: true, id: commandId });
  }

  if (req.method === 'GET') {
    const action = req.query.action;

    if (action === 'poll') {
      // Browser polls for next pending command
      const entries = [...cmdStore.entries()];
      if (entries.length === 0) return res.json({ empty: true });
      // Return oldest command
      const [id, cmd] = entries[0];
      cmdStore.delete(id);
      return res.json({ command: cmd, pending: cmdStore.size });
    }

    if (action === 'result') {
      // Browser reports result back to AI
      const commandId = req.query.id;
      const status = req.query.status || 'done';
      const message = req.query.message || '';
      if (commandId) {
        resultStore.set(commandId, { status, message, ts: Date.now() });
        if (resultStore.size > 100) {
          const keys = [...resultStore.keys()].slice(0, resultStore.size - 100);
          keys.forEach(k => resultStore.delete(k));
        }
      }
      return res.json({ ok: true });
    }

    if (action === 'results') {
      // AI fetches results
      const results = [...resultStore.entries()]
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 20);
      return res.json({ results });
    }

    if (action === 'check') {
      // Check if a command completed
      const commandId = req.query.id;
      if (commandId && resultStore.has(commandId)) {
        const r = resultStore.get(commandId);
        resultStore.delete(commandId);
        return res.json({ done: true, ...r });
      }
      return res.json({ done: false });
    }

    return res.json({ ok: true, commands: cmdStore.size, results: resultStore.size });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withRateLimit(handler, 15);
