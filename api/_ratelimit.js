// ⚡ DDoS 防护 — 全API速率限制器
// 基于 IP 的令牌桶算法（内存，每个 Vercel 实例独立）

const WINDOW_MS = 60_000;  // 1分钟窗口
const MAX_REQUESTS = 30;   // 每分钟最多30次（宽松）
const MAX_AUTH = 5;        // 认证接口每分钟最多5次（严格）

// 注意：serverless 函数可能被多个实例并发执行，
// 这个内存计数器在每个实例独立，不是精确的全局限制，
// 但能大幅降低 DDoS 的杀伤力。
const counters = new Map();

// 定期清理旧条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of counters) {
    if (now - entry.reset > WINDOW_MS * 2) counters.delete(key);
  }
}, 30_000);

/**
 * 检查速率限制
 * @param {string} ip - 客户端 IP
 * @param {number} maxReqs - 最大请求数（默认30）
 * @returns {{ allowed: boolean, retryAfter: number }}
 */
function checkRateLimit(ip, maxReqs = MAX_REQUESTS) {
  const now = Date.now();
  const key = ip;
  let entry = counters.get(key);

  if (!entry || now - entry.reset > WINDOW_MS) {
    entry = { count: 1, reset: now };
    counters.set(key, entry);
    return { allowed: true, remaining: maxReqs - 1, reset: now + WINDOW_MS };
  }

  entry.count++;
  if (entry.count > maxReqs) {
    const retryAfter = Math.ceil((entry.reset + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0, reset: entry.reset + WINDOW_MS };
  }

  return { allowed: true, remaining: maxReqs - entry.count, reset: entry.reset + WINDOW_MS };
}

/**
 * 中间件：为 API handler 添加速率限制
 * @param {function} handler - 原 API handler
 * @param {number} maxReqs - 最大请求数
 */
export function withRateLimit(handler, maxReqs) {
  return async function rateLimitedHandler(req, res) {
    // 获取客户端 IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    const result = checkRateLimit(ip, maxReqs);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.reset);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: '请求过于频繁，请 ' + result.retryAfter + ' 秒后再试',
        retryAfter: result.retryAfter
      });
    }

    return handler(req, res);
  };
}

export { checkRateLimit };
