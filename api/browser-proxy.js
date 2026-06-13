// AI Browser Proxy - Parse, Extract, Summarize, Form Fill
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url || req.body?.url;
  const action = req.query.action || req.body?.action || 'parse';
  if (!url) return res.status(400).json({ error: 'Missing url' });
  const vu = validateUrl(decodeURIComponent(url));
  if (!vu) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const html = await fetchPage(vu);
    if (action === 'extract') return res.json(extractContent(html, vu));
    if (action === 'summarize') return res.json(summarizeContent(html, vu));
    if (action === 'fillform') return res.json(extractForms(html, vu));
    return res.json(parseElements(html, vu));
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

function validateUrl(u){
  if (!u || typeof u !== 'string') return null;
  if (!u.match(/^https?:\/\//i)) u = 'https://' + u;
  try { return new URL(u).href; } catch(e) { return null; }
}

async function fetchPage(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    return await r.text();
  } finally { clearTimeout(t); }
}

function strip(h){ return h ? h.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim() : ''; }
function esc(s){ return (s||'').replace(/"/g,'\\"').replace(/'/g,"\\'"); }

function resolveUrl(base, href) {
  if (!href) return null;
  if (href.match(/^https?:\/\//i)) return href;
  try { const b = new URL(base); return new URL(href, b.origin + b.pathname.replace(/\/[^/]*$/,'/')).href; } catch(e) { return null; }
}

function parseElements(html, url) {
  const elements = [];
  let id = 0;

  const linkRe = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null && id < 60) {
    const text = strip(m[2]).trim();
    if (text && m[1] && !m[1].startsWith('#') && !m[1].startsWith('javascript:')) {
      const ah = resolveUrl(url, m[1]);
      if (ah) elements.push({ id:'el_'+(id++), type:'link', text:text.substring(0,80), href:ah });
    }
  }
  const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  while ((m = btnRe.exec(html)) !== null && id < 80) {
    const text = strip(m[1]).trim();
    if (text) elements.push({ id:'el_'+(id++), type:'button', text:text.substring(0,60) });
  }
  const inpRe = /<input[^>]*>/gi;
  while ((m = inpRe.exec(html)) !== null && id < 100) {
    const t = (m[0].match(/type=["']([^"']*)/) || [, 'text'])[1];
    const n = (m[0].match(/name=["']([^"']*)/) || [, ''])[1];
    if (t !== 'hidden' && n) elements.push({ id:'el_'+(id++), type:'input', inputType:t, name:n, placeholder:(m[0].match(/placeholder=["']([^"']*)/)||[, ''])[1] });
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const bodyText = extractReadableText(html).substring(0, 3000);
  return { title: title ? strip(title[1]).trim() : 'Unknown', url, elements, totalElements: id, text: bodyText };
}

function extractContent(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = extractReadableText(html);
  return { title: title ? strip(title[1]).trim() : 'Unknown', url, text: text.substring(0, 10000), length: text.length };
}

function summarizeContent(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = title ? strip(title[1]).trim() : 'Unknown';
  const fullText = extractReadableText(html);
  if (fullText.length < 50) return { title: t, url, summary: '内容过短，无法总结', sentences: [], keywords: [], length: fullText.length };

  // Sentence splitting
  const sentences = fullText.split(/[。！？\n]+/).filter(s => s.trim().length > 10).map(s => s.trim());
  if (sentences.length < 3) return { title: t, url, summary: fullText.substring(0, 500), sentences, keywords: [], length: fullText.length };

  // Keyword extraction (Chinese-aware word frequency)
  const words = fullText.match(/[\u4e00-\u9fff]{2,6}/g) || [];
  const freq = {};
  const stopWords = new Set('的是在了有和不也就都而及与或一个没有我们你们他们这个那个这些那些什么怎么如何可以因为所以但是虽然如果虽然然后而且或者不过只是还是已经将会能够应该需要可能非常比较更加'.split(''));
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const keywords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, 12).map(e => e[0]);

  // Score sentences by keyword frequency
  const scored = sentences.map((s, i) => {
    let score = 0;
    // Position boost: first 20% get bonus
    if (i < sentences.length * 0.2) score += 2;
    // Keyword density
    keywords.forEach(kw => { if (s.includes(kw)) score += 0.5; });
    // Length: prefer medium-length sentences
    if (s.length > 20 && s.length < 150) score += 1;
    // Title words bonus
    t.split('').forEach(c => { if (s.includes(c) && c.length === 1 && c.match(/[\u4e00-\u9fff]/)) score += 0.3; });
    return { sentence: s, score, idx: i };
  });

  const topSentences = scored.sort((a,b) => b.score - a.score).slice(0, 8).sort((a,b) => a.idx - b.idx);
  const summary = topSentences.map(s => s.sentence + '。').join('');

  return {
    title: t,
    url,
    summary: summary.substring(0, 2000),
    sentences: topSentences.map(s => s.sentence),
    keywords: keywords.slice(0, 10),
    length: fullText.length,
    sentenceCount: sentences.length
  };
}

function extractForms(html, url) {
  const forms = [];
  const formRe = /<form[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = formRe.exec(html)) !== null) {
    const action = resolveUrl(url, m[1]) || url;
    const formHtml = m[2];
    const fields = [];
    // inputs
    const inpRe = /<input[^>]*>/gi;
    let im;
    while ((im = inpRe.exec(formHtml)) !== null) {
      const type = (im[0].match(/type=["']([^"']*)/) || [, 'text'])[1];
      const name = (im[0].match(/name=["']([^"']*)/) || [, ''])[1];
      const placeholder = (im[0].match(/placeholder=["']([^"']*)/) || [, ''])[1];
      const value = (im[0].match(/value=["']([^"']*)/) || [, ''])[1];
      if (name) fields.push({ name, type: type === 'hidden' ? 'hidden' : type, placeholder: placeholder || '', value: value || '' });
    }
    // textareas
    const taRe = /<textarea[^>]*name=["']([^"']*)"[^>]*>([\s\S]*?)<\/textarea>/gi;
    while ((im = taRe.exec(formHtml)) !== null) {
      fields.push({ name: im[1], type: 'textarea', placeholder: '', value: strip(im[2]) });
    }
    // selects
    const selRe = /<select[^>]*name=["']([^"']*)"[^>]*>([\s\S]*?)<\/select>/gi;
    while ((im = selRe.exec(formHtml)) !== null) {
      const opts = [];
      const optRe = /<option[^>]*value=["']([^"']*)"[^>]*>([\s\S]*?)<\/option>/gi;
      let om; while ((om = optRe.exec(im[2])) !== null) opts.push({ value: om[1], text: strip(om[2]) });
      fields.push({ name: im[1], type: 'select', placeholder: '', value: '', options: opts });
    }
    forms.push({ action, fields, fieldCount: fields.length });
  }
  // Also find standalone inputs (not in form)
  const allInputs = [];
  const standaloneRe = /<input[^>]*name=["']([^"']*)"[^>]*/gi;
  let sm;
  while ((sm = standaloneRe.exec(html)) !== null) {
    const name = sm[1];
    const full = sm[0];
    // Check if already in a form
    const inForm = forms.some(f => f.fields.some(fd => fd.name === name));
    if (!inForm) {
      const type = (full.match(/type=["']([^"']*)/) || [, 'text'])[1];
      const placeholder = (full.match(/placeholder=["']([^"']*)/) || [, ''])[1];
      allInputs.push({ name, type, placeholder: placeholder || '', value: '' });
    }
  }
  if (allInputs.length) forms.push({ action: url, fields: allInputs, fieldCount: allInputs.length, standalone: true });

  return { url, forms: forms.length ? forms : [], totalFields: forms.reduce((a,f)=>a+f.fields.length, 0) };
}

function extractReadableText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const body = text.match(/<body[^>]*>([\s]*?)<\/body>/i);
  if (body) text = body[1];
  text = text.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  // Remove very short lines (likely noise)
  text = text.split('\n').filter(l => l.trim().length > 3).join('\n');
  return text;
}
