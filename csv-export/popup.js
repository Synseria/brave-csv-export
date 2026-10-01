// Pour ajouter un site : créer sites/<id>.js (voir sites/amazon.js) et l'ajouter ici.
const SITES = [
  {
    id: 'amazon', name: 'Amazon',
    match: /(^|\.)amazon\.(fr|com|de|es|it|co\.uk|ca|com\.be|nl|se|pl|com\.mx|co\.jp|in|com\.au)$/,
    ordersPath: '/your-orders/orders', cartPath: '/gp/cart/view.html'
  },
  {
    id: 'aliexpress', name: 'AliExpress',
    match: /(^|\.)aliexpress\.(com|us|ru)$/,
    ordersUrl: 'https://www.aliexpress.com/p/order/index.html',
    cartUrl: 'https://www.aliexpress.com/p/shoppingcart/index.html'
  }
];

const $ = (id) => document.getElementById(id);
let tab, site;

function setStatus(msg, err = false) {
  $('status').textContent = msg;
  $('status').className = 'status' + (err ? ' err' : '');
}

function toCsv(rows, sep) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /["\n\r]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(sep), ...rows.map((r) => cols.map((c) => esc(r[c])).join(sep))].join('\r\n');
}

async function download(csv, name) {
  // BOM UTF-8 pour qu'Excel affiche correctement les accents
  const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  await chrome.downloads.download({ url, filename: name, saveAs: false });
}

async function run(kind) {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const opts = mode === 'visible' ? { mode } : { mode, from: $('from').value, to: $('to').value };
  if (opts.from && opts.to && opts.from > opts.to) return setStatus('La date « Du » est après la date « Au ».', true);
  chrome.storage.local.set({ mode, from: $('from').value, to: $('to').value, sep: $('sep').value });
  setStatus(kind === 'orders' ? (mode === 'visible' ? 'Lecture de la page…' : 'Lecture de l’historique… (gardez cette fenêtre ouverte)') : 'Lecture du panier…');
  $('btn-orders').disabled = $('btn-cart').disabled = true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['sites/common.js', `sites/${site.id}.js`]
    });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (siteId, kind, opts) => window.__csvx.run(siteId, kind, opts),
      args: [site.id, kind, opts]
    });
    if (!result || result.error) throw new Error(result ? result.error : 'Aucun résultat');
    if (!result.rows.length) throw new Error('Aucune donnée trouvée sur cette page.');
    const date = new Date().toISOString().slice(0, 10);
    const label = kind === 'orders' ? 'commandes' : 'panier';
    await download(toCsv(result.rows, $('sep').value), `${site.id}-${label}-${date}.csv`);
    setStatus(`✓ ${result.rows.length} ligne(s) exportée(s)` + (result.pages > 1 ? ` sur ${result.pages} pages` : ''));
  } catch (e) {
    setStatus(e.message || String(e), true);
  } finally {
    refreshButtons();
  }
}

function refreshButtons() {
  let url;
  try { url = new URL(tab.url); } catch { url = new URL('about:blank'); }
  const onOrders = site && window.__isOrdersPage(url);
  const onCart = site && window.__isCartPage(url);
  $('btn-orders').disabled = !site;
  $('btn-cart').disabled = !site;
  $('btn-orders').textContent = onOrders || !site ? 'Exporter les commandes' : 'Ouvrir mes commandes';
  $('btn-cart').textContent = onCart || !site ? 'Exporter le panier' : 'Ouvrir le panier';
}

function target(kind, url) {
  const path = kind === 'orders' ? site.ordersPath : site.cartPath;
  return path ? url.origin + path : (kind === 'orders' ? site.ordersUrl : site.cartUrl);
}

window.__isOrdersPage = (url) =>
  /order-history|your-orders|\/p\/order\/|orderList|order_list/i.test(url.pathname + url.search);
window.__isCartPage = (url) => /\/cart|shoppingcart/i.test(url.pathname);

async function onClick(kind) {
  const url = new URL(tab.url);
  const here = kind === 'orders' ? window.__isOrdersPage(url) : window.__isCartPage(url);
  if (here) return run(kind);
  await chrome.tabs.update(tab.id, { url: target(kind, url) });
  window.close();
}

(async () => {
  const saved = await chrome.storage.local.get(['mode', 'from', 'to', 'sep']);
  if (saved.mode) document.querySelector(`input[name="mode"][value="${saved.mode}"]`).checked = true;
  if (saved.from) $('from').value = saved.from;
  if (saved.to) $('to').value = saved.to;
  if (saved.sep) $('sep').value = saved.sep;

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { host = new URL(tab.url).hostname; } catch {}
  site = SITES.find((s) => s.match.test(host));
  $('site').textContent = site ? site.name : 'site non pris en charge';
  if (!site) $('hint').textContent = 'Ouvrez Amazon ou AliExpress puis relancez l’extension.';
  else $('hint').textContent = 'Sur Amazon, une recherche dans vos commandes est exportée telle quelle (toutes ses pages).';
  refreshButtons();
  $('btn-orders').onclick = () => onClick('orders');
  $('btn-cart').onclick = () => onClick('cart');
  $('diag').onclick = async (e) => {
    e.preventDefault();
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: () => '<!doctype html>' + document.documentElement.outerHTML
      });
      const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(result);
      await chrome.downloads.download({ url, filename: `diagnostic-${site ? site.id : 'page'}.html`, saveAs: true });
      setStatus('Page enregistrée : envoyez ce fichier pour que j’ajuste l’extension.');
    } catch (err) { setStatus(err.message, true); }
  };
})();
