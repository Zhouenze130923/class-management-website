import { withRateLimit } from './_ratelimit.js';

// AI Browser Search API
// Supports Google, Bing, Baidu, DuckDuckGo
async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query.q;
  const count = parseInt(req.query.count) || 8;
  const engine = req.query.engine || 'duckduckgo';

  if (!q) return res.status(400).json({ error: 'Missing query' });

  try {
    const results = await searchWeb(q, count, engine);
    return res.status(200).json({ results, query: q, engine, count: results.length });
  } catch (err) {
    // Fallback to DuckDuckGo
    try {
      const results = await searchDuckDuckGo(q, count);
      return res.status(200).json({ results, query: q, engine: 'duckduckgo(fallback)', count: results.length });
    } catch (e2) {
      return res.status(200).json({ results: [], error: err.message, query: q });
    }
  }
}

async function searchWeb(q, count, engine) {
  switch (engine) {
    case 'google': return await searchGoogle(q, count);
    case 'bing': return await searchBing(q, count);
    case 'baidu': return await searchBaidu(q, count);
    default: return await searchDuckDuckGo(q, count);
  }
}

async function searchDuckDuckGo(q, count) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const html = await fetchHTML(url);
  const results = [];
  const regex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && results.length < count) {
    results.push({
      title: strip(match[2]),
      url: match[1],
      description: strip(match[3])
    });
  }
  return results;
}

async function searchGoogle(q, count) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=${count}`;
  const html = await fetchHTML(url);
  const results = [];
  // Google result extraction
  const regex = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<a[^>]*href="\/url\?q=([^"&]+)[^"]*"[\s\S]*?<div[^>]*style="-webkit-line-clamp[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && results.length < count) {
    results.push({
      title: strip(match[1]),
      url: decodeURIComponent(match[2]),
      description: strip(match[3])
    });
  }
  return results;
}

async function searchBing(q, count) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=${count}`;
  const html = await fetchHTML(url);
  const results = [];
  const regex = /<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && results.length < count) {
    results.push({
      title: strip(match[2]),
      url: match[1],
      description: strip(match[3])
    });
  }
  return results;
}

async function searchBaidu(q, count) {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(q)}&rn=${count}`;
  const html = await fetchHTML(url);
  const results = [];
  const regex = /<h3[^>]*class="t"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="content-right_[^"]*">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
  let matchAlt;
  while ((matchAlt = regex.exec(html)) !== null && results.length < count) {
    results.push({
      title: strip(matchAlt[2]),
      url: matchAlt[1],
      description: strip(matchAlt[3] || '')
    });
  }
  // 备用解析
  if (results.length === 0) {
    const regex2 = /<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    while ((matchAlt = regex2.exec(html)) !== null && results.length < count) {
      results.push({
        title: strip(matchAlt[2]),
        url: matchAlt[1],
        description: strip(matchAlt[3] || '')
      });
    }
  }
  return results;
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  });
  return await response.text();
}

function strip(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300);
}

export default withRateLimit(handler, 20);
