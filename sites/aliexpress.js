// AliExpress. Les pages sont dynamiques : on lit le DOM affiché et on clique sur « Voir plus » si besoin.
(() => {
  const X = window.__csvx;
  const ID = /\b\d{12,}\b/;

  function itemId(href) { return ((href || '').match(/\/item\/(\d+)/) || [])[1] || ''; }

  function parseOrders() {
    const rows = [];
    for (const card of X.qa(document, ['.order-item', '[class*="order-item--"]', '[data-pl="order_item"]'])) {
      const info = X.qa(card, ['.order-item-header-right-info > div', '.order-item-header-right-info']).map(X.txt);
      const headerTxt = X.txt(X.q(card, ['.order-item-header', '[class*="order-item-header"]']));
      const dateLine = info.find((t) => /\d{4}/.test(t) && !ID.test(t.replace(/\s/g, ''))) || '';
      const orderId = ((info.join(' ') || headerTxt).match(ID) || [''])[0];
      const detail = X.q(card, ['a[href*="order_detail"]', 'a[href*="orderId="]']);
      const totalTxt = X.txt(X.q(card, ['.order-item-content-opt-price-total', '[class*="price-total"]']));
      const base = {
        'N° commande': orderId,
        'Date': dateLine.replace(/^[^:：]*[:：]\s*/, ''),
        'Date (ISO)': X.isoDate(dateLine),
        'Statut': X.txt(X.q(card, ['.order-item-header-status-text', '[class*="status-text"]'])),
        'Boutique': X.txt(X.q(card, ['.order-item-store-name', '[class*="store-name"]'])),
        'Total': X.num(totalTxt),
        'Devise': X.currency(totalTxt)
      };
      const bodies = X.qa(card, ['.order-item-content-body', '[class*="content-body"]']);
      if (!bodies.length) { rows.push(base); continue; }
      for (const b of bodies) {
        const nameEl = X.q(b, ['.order-item-content-info-name', '[class*="info-name"]']);
        const link = X.q(b, ['a[href*="/item/"]']) || (nameEl && nameEl.closest('a'));
        const numTxt = X.txt(X.q(b, ['.order-item-content-info-number', '[class*="info-number"]']));
        const qty = (numTxt.match(/[x×]\s*(\d+)/i) || [])[1] || '1';
        const priceTxt = numTxt.replace(/[x×]\s*\d+\s*$/i, '');
        const href = link ? X.abs(link.getAttribute('href')) : '';
        rows.push({
          ...base,
          'Article': X.txt(nameEl),
          'Variante': X.txt(X.q(b, ['.order-item-content-info-sku', '[class*="info-sku"]'])),
          'Quantité': parseInt(qty, 10),
          'Prix article': X.num(priceTxt),
          'ID produit': itemId(href),
          'Lien article': href.split('?')[0],
          'Lien commande': detail ? X.abs(detail.getAttribute('href')) : ''
        });
      }
    }
    return rows;
  }

  const MORE = /voir plus|afficher plus|charger plus|plus de commandes|view more|load more|show more|more orders|mehr anzeigen|ver más|mostra altro/i;
  const count = () => document.querySelectorAll('.order-item').length;
  const lastOrder = () => [...document.querySelectorAll('.order-item')].pop();

  // Trouve le moyen d'afficher la suite : bouton « Voir plus », pagination, ou défilement.
  function findMore() {
    const last = lastOrder();
    const cands = [...document.querySelectorAll('button, [role="button"], a, span, div')]
      .filter((el) => el.offsetParent !== null && !el.disabled && X.txt(el).length < 40 && MORE.test(X.txt(el)))
      .filter((el) => !last || (last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    if (cands.length) return { type: 'more', el: cands.sort((a, b) => a.contains(b) ? 1 : -1)[0] };
    const next = X.q(document, ['.comet-pagination-next:not(.comet-pagination-disabled) button', '.comet-pagination-next:not(.comet-pagination-disabled)', '.next-next:not([disabled])', 'button[aria-label*="next" i]:not([disabled])']);
    if (next) return { type: 'page', el: next };
    return { type: 'scroll' };
  }

  async function waitChange(sig, ms = 8000) {
    for (let t = 0; t < ms; t += 300) {
      await X.sleep(300);
      if (signature() !== sig) { await X.sleep(400); return true; }
    }
    return false;
  }
  const signature = () => count() + '|' + X.txt(lastOrder()).slice(0, 80);

  async function orders(opts) {
    const all = new Map();
    const collect = () => { for (const r of parseOrders()) all.set(r['N° commande'] + '|' + r['Article'] + '|' + r['Variante'], r); };
    collect();
    let pages = 1;
    if (opts.mode !== 'visible') {
      for (let i = 0; i < 500; i++) {
        if (X.olderThanFrom([...all.values()], opts)) break;
        const how = findMore();
        const sig = signature();
        if (how.type === 'scroll') {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          how.el.scrollIntoView({ block: 'center' });
          how.el.click();
        }
        if (!(await waitChange(sig, how.type === 'scroll' ? 3000 : 8000))) break;
        collect();
        pages++;
      }
    }
    const rows = [...all.values()];
    if (!rows.length) throw new Error('Aucune commande trouvée. Ouvrez « Mes commandes » sur AliExpress, connecté.');
    return { rows, pages };
  }

  function cart() {
    const rows = [];
    let items = X.qa(document, ['.cart-product', '[class*="cart-product--"]', '[class*="cartProduct"]']);
    // Repli : tout bloc contenant un lien produit dans la zone panier
    if (!items.length) {
      items = [...new Set([...document.querySelectorAll('a[href*="/item/"]')]
        .map((a) => a.closest('[class*="product"], li, [class*="item"]')).filter(Boolean))];
    }
    const seen = new Set();
    for (const it of items) {
      const link = X.q(it, ['a[href*="/item/"]']);
      const href = link ? X.abs(link.getAttribute('href')) : '';
      const title = X.txt(X.q(it, ['.cart-product-name-title', '[class*="name-title"]', '[class*="product-name"]', '[class*="title"]'])) || X.txt(link);
      const key = href + '|' + X.txt(X.q(it, ['[class*="sku"]']));
      if (!title || seen.has(key)) continue;
      seen.add(key);
      const priceTxt = X.txt(X.q(it, ['.cart-product-price', '[class*="product-price"]', '[class*="price"]']));
      const qtyEl = X.q(it, ['input.comet-input-number-input', '[class*="input-number"] input', 'input[type="text"]', 'input[type="number"]']);
      const qty = parseInt((qtyEl && qtyEl.value) || '1', 10) || 1;
      const unit = X.num(priceTxt.split(/\s{2,}/)[0]);
      const store = it.closest('[class*="cart-store"], [class*="store-"]');
      const cb = X.q(it, ['.comet-checkbox', 'input[type="checkbox"]']);
      rows.push({
        'Article': title,
        'Variante': X.txt(X.q(it, ['.cart-product-sku', '[class*="sku"]'])),
        'Quantité': qty,
        'Prix unitaire': unit,
        'Sous-total': unit !== '' ? Math.round(unit * qty * 100) / 100 : '',
        'Devise': X.currency(priceTxt),
        'Boutique': store ? X.txt(X.q(store, ['[class*="store-name"]', '[class*="store-title"]'])) : '',
        'Sélectionné': cb ? ((cb.checked || /checked/.test(cb.className)) ? 'oui' : 'non') : '',
        'ID produit': itemId(href),
        'Lien': href.split('?')[0]
      });
    }
    if (!rows.length) throw new Error('Panier vide ou page panier non reconnue.');
    return rows;
  }

  X.sites.aliexpress = { orders, cart };
})();
