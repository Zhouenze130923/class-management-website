let kvPromise = null;

function getRedis() {
  if (!kvPromise) {
    kvPromise = (async () => {
      try {
        const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) return null;
        const { Redis } = await import('@upstash/redis');
        return new Redis({ url, token });
      } catch (e) {
        console.error('Redis init error:', e.message);
        return null;
      }
    })();
  }
  return kvPromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kv = await getRedis();

  // 无数据库时降级
  if (!kv) {
    if (req.method === 'GET') return res.json({ empty: true });
    if (req.method === 'POST') return res.json({ ok: true });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      const room = req.query.room;
      if (!room) return res.status(400).json({ error: 'Missing room' });
      const data = await kv.get('call_' + room);
      if (data) {
        if (Date.now() - data._ts > 10 * 60 * 1000) {
          await kv.del('call_' + room);
          return res.json({ empty: true });
        }
        return res.json(data);
      }
      return res.json({ empty: true });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const room = body._room;
      if (!room) return res.status(400).json({ error: 'Missing room' });
      if (body._clear) {
        await kv.del('call_' + room);
        return res.json({ ok: true });
      }
      body._ts = Date.now();
      await kv.set('call_' + room, body);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'KV error' });
  }
}
