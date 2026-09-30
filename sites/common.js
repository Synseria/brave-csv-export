// Outils partagés, injectés dans la page avant le script du site.
(() => {
  const X = (window.__csvx = window.__csvx || { sites: {} });

  X.txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  X.q = (root, sels) => {
    for (const s of [].concat(sels)) { const el = root.querySelector(s); if (el) return el; }
    return null;
  };
  X.qa = (root, sels) => {
    for (const s of [].concat(sels)) { const els = root.querySelectorAll(s); if (els.length) return [...els]; }
    return [];
  };
  X.abs = (href) => { try { return href ? new URL(href, location.href).href : ''; } catch { return href || ''; } };

  // "1 234,56 €" / "$1,234.56" / "US $12.30" -> 1234.56
  X.num = (s) => {
    if (!s) return '';
    let t = String(s).replace(/[^\d.,-]/g, '');
    if (!t) return '';
    const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
    if (lc > ld) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
    const n = parseFloat(t);
    return isNaN(n) ? '' : n;
  };
  X.currency = (s) => {
    const m = String(s || '').match(/€|EUR|US ?\$|\$|£|GBP|USD|CHF|¥|zł|kr/);
    return m ? m[0].replace('US $', 'USD').replace('US$', 'USD') : '';
  };

  // Dates multilingues -> "AAAA-MM-JJ" (ou '' si illisible)
  const MONTHS = [
    ['janv', 'jan', 'ene', 'gen', 'sty'], ['févr', 'fevr', 'feb', 'fév', 'fev', 'febr', 'lut'], ['mars', 'mar', 'mär', 'marz', 'mrz', 'maart'],
    ['avr', 'apr', 'abr'], ['mai', 'may', 'mag', 'mei', 'maj'], ['juin', 'jun', 'giu', 'cze'],
    ['juil', 'jul', 'lug', 'lip'], ['août', 'aout', 'aug', 'ago', 'sie'], ['sept', 'sep', 'set', 'wrz'],
    ['oct', 'okt', 'ott', 'paź'], ['nov', 'lis'], ['déc', 'dec', 'dez', 'dic', 'gru']
  ];
  const monthOf = (w) => {
    w = w.toLowerCase().replace(/\.$/, '');
    for (let i = 0; i < 12; i++) if (MONTHS[i].some((m) => w.startsWith(m))) return i + 1;
    return 0;
  };
  const iso = (y, m, d) => (y > 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31)
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
  X.isoDate = (s) => {
    s = String(s || '');
    let m;
    if ((m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
    if ((m = s.match(/(\d{1,2})[.\s]+([A-Za-zÀ-ÿ]{3,}\.?)[\s,]+(\d{4})/)) && monthOf(m[2])) return iso(+m[3], monthOf(m[2]), +m[1]);
    if ((m = s.match(/([A-Za-zÀ-ÿ]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && monthOf(m[1])) return iso(+m[3], monthOf(m[1]), +m[2]);
    if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return iso(+m[3], +m[2], +m[1]);
    return '';
  };
  // Filtre de dates : opts.from / opts.to au format AAAA-MM-JJ (vides = pas de borne)
  X.inRange = (d, opts) => !d || ((!opts.from || d >= opts.from) && (!opts.to || d <= opts.to));
  X.olderThanFrom = (rows, opts) => !!opts.from && rows.some((r) => r['Date (ISO)'] && r['Date (ISO)'] < opts.from);

  X.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  X.fetchDoc = async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' sur ' + url);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  };

  X.snapshot = () => '<!doctype html>' + document.documentElement.outerHTML;

  X.run = async (siteId, kind, opts) => {
    try {
      const site = X.sites[siteId];
      if (!site || !site[kind]) return { error: 'Export non disponible pour ce site.' };
      opts = opts || {};
      const out = await site[kind](opts);
      const res = Array.isArray(out) ? { rows: out, pages: 1 } : out;
      if (kind === 'orders' && (opts.from || opts.to)) {
        res.rows = res.rows.filter((r) => X.inRange(r['Date (ISO)'], opts));
        if (!res.rows.length) return { error: 'Aucune commande dans cette période.' };
      }
      return res;
    } catch (e) {
      return { error: e.message || String(e) };
    }
  };
})();
