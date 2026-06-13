// /api/auth.js — 教师账号注册/登录
// ===== 修复：CORS 头必须在 Redis 检查之前设置 =====
let kv = null;
async function getKV() {
  if (kv) return kv;
  try {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const { Redis } = await import('@upstash/redis');
    kv = new Redis({ url, token });
    return kv;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  // ⚠️ 必须先设置 CORS 头，再检查 Redis —— 否则浏览器会因无 CORS 头而拦截 500 响应
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const redis = await getKV();
  if (!redis) return res.status(500).json({ error: '数据库未连接，请检查环境变量 KV_REST_API_URL / KV_REST_API_TOKEN' });

  try {
    const { action, phone, password, teacherName, teacherType, className } = req.body;
    if (!phone || phone.length < 2) return res.status(400).json({ error: '用户名无效' });
    if (!password || password.length < 4) return res.status(400).json({ error: '密码至少4位' });

    const userKey = 'user:' + phone;

    if (action === 'register') {
      const exists = await redis.get(userKey);
      if (exists) return res.status(400).json({ error: '该用户名已注册' });

      const teacherCode = 'TCH' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const userData = {
        phone,
        password,
        teacherCode,
        teacherName: teacherName || '教师',
        teacherType: teacherType || '班主任',
        classes: className ? [{ id: Date.now() + 'a', name: className }] : [],
        createdAt: Date.now()
      };

      await redis.set(userKey, userData);
      await redis.set('code:' + teacherCode, userKey);

      return res.status(201).json({
        ok: true,
        teacherCode,
        data: { teacherName: userData.teacherName, teacherType: userData.teacherType, classes: userData.classes }
      });
    }

    if (action === 'login') {
      const userData = await redis.get(userKey);
      if (!userData) return res.status(404).json({ error: '账号不存在' });
      if (userData.password !== password) return res.status(403).json({ error: '密码错误' });

      return res.json({
        ok: true,
        teacherCode: userData.teacherCode,
        data: {
          teacherName: userData.teacherName,
          teacherType: userData.teacherType,
          classes: userData.classes || []
        }
      });
    }

    if (action === 'lookup') {
      // 通过teacherCode查找教师（先用索引键加速，再 fallback 扫描）
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: '缺少教师码' });
      let found = null;
      // 优先用索引
      const indexedKey = await redis.get('code:' + code);
      if (indexedKey) {
        found = await redis.get(indexedKey);
      }
      if (!found) {
        // fallback: 扫描所有 user:* 键
        try {
          const keys = await redis.keys('user:' + '*');
          for (const key of keys) {
            const data = await redis.get(key);
            if (data && data.teacherCode === code) {
              found = data;
              break;
            }
          }
        } catch(e) { /* scan 可能不支持 */ }
      }
      if (!found) return res.status(404).json({ error: '未找到该教师' });
      return res.json({
        ok: true,
        teacherCode: found.teacherCode,
        data: {
          teacherName: found.teacherName,
          teacherType: found.teacherType,
          classes: found.classes || []
        }
      });
    }

    return res.status(400).json({ error: '未知操作' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
