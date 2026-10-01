// Amazon (amazon.fr, .com, .de, ...). Un site = un objet { orders(opts), cart(opts) } qui renvoie des lignes.
(() => {
  const X = window.__csvx;
  const ORDER_ID = /\b(\d{3}-\d{7}-\d{7}|D\d{2}-\d{7}-\d{7})\b/;
  const L_DATE = /command[ée]e?|order placed|bestellung|pedido realizado|ordine effettuato|besteld|zamówienie/i;
  const L_TOTAL = /total|summe|importe|totale|totaal|suma/i;
  const L_SHIP = /livraison|livr[ée]|ship to|envoyer|lieferung|enviar|spedi|bezorg|dostawa/i;

  function headerFields(card) {
    const f = {};
    const cols = X.qa(card, ['.order-header__header-list-item', '.order-header .a-column', '.order-info .a-column']);
    for (const c of cols) {
      const label = X.txt(X.q(c, ['.a-text-caps', '.label', '.a-color-secondary']));
      const value = X.txt(X.q(c, ['.a-size-base:not(.a-text-caps)', '.value', '.a-color-secondary.a-size-base'])) ||
        X.txt(c).replace(label, '').trim();
      if (!label) continue;
      if (L_DATE.test(label) && !f.date) f.date = value;
      else if (L_TOTAL.test(label) && !f.total) f.total = value;
      else if (L_SHIP.test(label) && !f.ship) f.ship = value.split(/\s{2,}|\n/)[0];
    }
    return f;
  }

  const ORDER_ID_G = new RegExp(ORDER_ID.source, 'g');
  const idsIn = (el) => {
    const hrefs = [...el.querySelectorAll('a[href*="rderID="], a[href*="rderId="]')].map((a) => a.getAttribute('href')).join(' ');
    return new Set(((el.textContent || '') + ' ' + hrefs).match(ORDER_ID_G) || []);
  };

  // Repli générique (résultats de recherche, nouvelles mises en page) :
  // on part de chaque n° de commande et on remonte tant que le bloc ne contient qu'une seule commande.
  function genericCards(doc) {
    const cards = new Set();
    const seeds = [...doc.querySelectorAll('a[href*="rderID="], a[href*="rderId="], a[href*="order-details"], bdi, span, div')]
      .filter((el) => el.children.length === 0 || el.tagName === 'A')
      .filter((el) => ORDER_ID.test((el.textContent || '') + ' ' + (el.getAttribute('href') || '')));
    for (const seed of seeds) {
      let c = seed;
      while (c.parentElement && c.parentElement !== doc.body && idsIn(c.parentElement).size <= 1) c = c.parentElement;
      cards.add(c);
    }
    // garde les blocs les plus externes
    return [...cards].filter((c) => ![...cards].some((o) => o !== c && o.contains(c)));
  }

  function parseOrders(doc) {
    const rows = [];
    let cards = X.qa(doc, ['.order-card', '.js-order-card', '#ordersContainer > .order', '.your-orders-content-container .order']);
    if (!cards.length) cards = genericCards(doc);
    for (const card of cards) {
      const h = headerFields(card);
      const idEl = X.q(card, ['.yohtmlc-order-id span[dir="ltr"]', '.yohtmlc-order-id .value', '[class*="order-id"] bdi']);
      const orderId = (X.txt(idEl).match(ORDER_ID) || [...idsIn(card)] || [''])[0] || '';
      if (!orderId) continue;
      const detail = X.q(card, ['a[href*="order-details"]', 'a[href*="orderID="]', 'a[href*="orderId="]']);
      const status = X.txt(X.q(card, ['.delivery-box__primary-text', '.yohtmlc-shipment-status-primaryText', '.shipment .a-text-bold', '.js-shipment-info-container .a-color-base']));
      const dateTxt = h.date || X.txt(card);
      if (!h.total) {
        const m = X.txt(card).match(/(?:total|summe|totale)\s*:?\s*([^\s].{0,15}?\d[\d\s.,]*\s*(?:€|EUR)?)/i);
        if (m) h.total = m[1];
      }
      const base = {
        'N° commande': orderId,
        'Date': h.date || '',
        'Date (ISO)': X.isoDate(dateTxt),
        'Total': X.num(h.total),
        'Devise': X.currency(h.total),
        'Statut': status,
        'Livré à': h.ship || ''
      };

      // Articles : un produit par ligne
      let links = X.qa(card, ['.yohtmlc-product-title a', 'a.yohtmlc-product-title', '.yohtmlc-product-title']);
      if (!links.length) {
        links = X.qa(card, ['.yohtmlc-item a.a-link-normal', 'a[href*="/dp/"]', 'a[href*="/gp/product/"]'])
          .filter((a) => X.txt(a).length > 3);
      }
      const seen = new Set();
      const items = [];
      for (const el of links) {
        const title = X.txt(el);
        const a = el.closest('a') || el.querySelector('a') || el;
        const href = X.abs(a.getAttribute && a.getAttribute('href'));
        if (!title || seen.has(title)) continue;
        seen.add(title);
        const box = el.closest('.a-fixed-left-grid, .yohtmlc-item, .item-box, .a-row') || card;
        const asin = (href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/) || [])[1] || '';
        const qty = X.txt(X.q(box, ['.product-image__qty', '.item-view-qty', '.od-item-view-qty'])) || '1';
        const price = X.txt(X.q(box, ['.yohtmlc-item .a-color-price', '.a-color-price']));
        items.push({ title, href, asin, qty, price });
      }

      const orderLink = X.abs(detail && detail.getAttribute('href'));
      if (!items.length) rows.push({ ...base, 'Article': '', 'ASIN': '', 'Quantité': '', 'Prix article': '', 'Lien article': '', 'Lien commande': orderLink });
      for (const it of items) {
        rows.push({
          ...base,
          'Article': it.title,
          'ASIN': it.asin,
          'Quantité': X.num(it.qty) || 1,
          'Prix article': X.num(it.price),
          'Lien article': it.href,
          'Lien commande': orderLink
        });
      }
    }
    return rows;
  }

  function nextUrl(doc) {
    const a = X.q(doc, ['.a-pagination .a-last:not(.a-disabled) a', 'ul.a-pagination li.a-last a']);
    return a ? X.abs(a.getAttribute('href')) : '';
  }

  // Suit les pages « Suivant » à partir de startUrl (ou de la page actuelle), en s'arrêtant à la date de début.
  async function crawl(startUrl, opts, visited) {
    let rows = [], pages = 0;
    let doc = startUrl ? null : document;
    let url = startUrl || location.href;
    while (url && !visited.has(url) && pages < 200) {
      visited.add(url);
      if (!doc) { await X.sleep(500); doc = await X.fetchDoc(url); }
      const more = parseOrders(doc);
      pages++;
      if (!more.length) break;
      rows = rows.concat(more);
      if (X.olderThanFrom(more, opts)) break;
      url = nextUrl(doc);
      doc = null;
    }
    return { rows, pages };
  }

  const isSearch = () => /search/i.test(location.pathname) || /[?&]search=/.test(location.search);

  async function orders(opts) {
    let rows = [], pages = 0;
    if (opts.mode === 'visible') {
      rows = parseOrders(document);
      pages = 1;
    } else if (isSearch()) {
      ({ rows, pages } = await crawl('', opts, new Set()));
    } else {
      // Historique complet : une passe par année, de la plus récente à la plus ancienne.
      const visited = new Set();
      const yTo = opts.to ? +opts.to.slice(0, 4) : new Date().getFullYear();
      const yFrom = opts.from ? +opts.from.slice(0, 4) : 1995;
      let emptyYears = 0;
      for (let y = yTo; y >= yFrom; y--) {
        const url = `${location.origin}/your-orders/orders?timeFilter=year-${y}&orderFilter=year-${y}`;
        const r = await crawl(url, opts, visited);
        pages += r.pages;
        rows = rows.concat(r.rows);
        // sans date de début, on s'arrête après 3 années vides consécutives
        emptyYears = r.rows.length ? 0 : emptyYears + 1;
        if (!opts.from && emptyYears >= 3 && rows.length) break;
        if (!opts.from && emptyYears >= 6) break;
      }
    }
    const seen = new Set();
    rows = rows.filter((r) => { const k = r['N° commande'] + '|' + r['Article']; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!rows.length) throw new Error('Aucune commande trouvée. Êtes-vous bien sur « Vos commandes » et connecté ?');
    return { rows, pages };
  }

  function cart() {
    const rows = [];
    const sections = [
      ['Panier', ['#sc-active-cart', 'div[data-name="Active Items"]', '#activeCartViewForm']],
      ['Enregistré pour plus tard', ['#sc-saved-cart', 'div[data-name="Saved Items"]']]
    ];
    const seen = new Set();
    for (const [label, sels] of sections) {
      const root = X.q(document, sels);
      if (!root) continue;
      for (const it of root.querySelectorAll('.sc-list-item[data-asin], div[data-asin][data-itemid]')) {
        const key = (it.dataset.itemid || '') + it.dataset.asin;
        if (!it.dataset.asin || seen.has(key)) continue;
        seen.add(key);
        const titleEl = X.q(it, ['.sc-product-title .a-truncate-full', '.sc-product-title', '.a-truncate-full', 'a.sc-product-link']);
        const link = X.q(it, ['a.sc-product-link', 'a[href*="/dp/"]', 'a[href*="/gp/product/"]']);
        const priceTxt = X.txt(X.q(it, ['.sc-product-price', '.sc-price', '.a-price .a-offscreen']));
        const qtySel = X.q(it, ['select[name="quantity"]', 'input[name="quantityBox"]', '[data-a-selector="value"]', '.sc-quantity-textfield']);
        const unit = it.dataset.price ? parseFloat(it.dataset.price) : X.num(priceTxt);
        const qty = parseInt(it.dataset.quantity || (qtySel && (qtySel.value || X.txt(qtySel))) || '1', 10) || 1;
        rows.push({
          'Section': label,
          'Article': X.txt(titleEl),
          'ASIN': it.dataset.asin,
          'Quantité': qty,
          'Prix unitaire': unit,
          'Sous-total': unit !== '' ? Math.round(unit * qty * 100) / 100 : '',
          'Devise': X.currency(priceTxt),
          'Disponibilité': X.txt(X.q(it, ['.sc-product-availability', '.sc-availability'])),
          'Vendeur': X.txt(X.q(it, ['.sc-seller', '.sc-product-seller'])).replace(/^(vendu par|sold by)\s*:?\s*/i, ''),
          'Lien': link ? X.abs(link.getAttribute('href')).split('?')[0].split('/ref=')[0] : ''
        });
      }
    }
    if (!rows.length) throw new Error('Panier vide ou page panier non reconnue.');
    return rows;
  }

  X.sites.amazon = { orders, cart };
})();
