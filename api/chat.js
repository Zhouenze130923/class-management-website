// Console Chat API - Simple message exchange
// User sends messages via POST, AI responds via POST, Console polls via GET

import { withRateLimit } from './_ratelimit.js';

const msgStore = [];

function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { text, role, replyTo } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const msg = {
      id: 'msg_' + Date.now().toString(36),
      role: role === 'ai' ? 'ai' : 'user',
      text: text.substring(0, 2000),
      ts: Date.now(),
      replyTo: replyTo || null
    };

    msgStore.push(msg);
    if (msgStore.length > 200) msgStore.splice(0, msgStore.length - 200);

    return res.json({ ok: true, id: msg.id });
  }

  if (req.method === 'GET') {
    const since = parseInt(req.query.since) || 0;
    const role = req.query.role || null;

    let msgs = msgStore;
    if (since > 0) msgs = msgs.filter(m => m.ts > since);
    if (role === 'user') msgs = msgs.filter(m => m.role === 'user');
    if (role === 'ai') msgs = msgs.filter(m => m.role === 'ai');

    return res.json({ messages: msgs.slice(-30), total: msgStore.length, serverTime: Date.now() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withRateLimit(handler, 60);
