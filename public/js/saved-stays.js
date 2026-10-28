(() => {
  'use strict';
  const KEY = 'wanderlust.savedStays.v1';
  const LIMIT = 100;
  const idPattern = /^[a-f\d]{24}$/i;
  const savedPage = document.querySelector('[data-saved-page]');
  const status = document.querySelector('[data-save-status]');
  let requestVersion = 0;

  function announce(message) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
  }
  function readSaved() {
    try {
      const raw = localStorage.getItem(KEY);
      let values;
      try { values = raw ? JSON.parse(raw) : []; } catch { values = []; }
      return Array.isArray(values)
        ? [...new Set(values.filter(id => typeof id === 'string' && idPattern.test(id)).map(id => id.toLowerCase()))].slice(0, LIMIT) : [];
    } catch { return null; }
  }
  function writeSaved(ids) {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); return true; }
    catch { announce('Saving is unavailable in this browser. Your saved stays were not changed.'); return false; }
  }
  function syncButtons() {
    const ids = readSaved();
    document.querySelectorAll('[data-save-listing]').forEach(button => {
      button.hidden = ids === null;
      const saved = ids?.includes(button.dataset.saveListing.toLowerCase()) || false;
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${button.dataset.listingTitle} on this device`);
    });
    document.querySelectorAll('[data-saved-count]').forEach(count => {
      count.textContent = String(ids?.length || 0);
      count.hidden = !ids?.length;
    });
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({class:'wl-icon',width:'24',height:'24',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key, value);
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', name === 'heart' ? 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z' : name === 'star' ? 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z' : 'M4 12h16m-6-6 6 6-6 6');
    svg.append(path);
    return svg;
  }
  function safePhoto(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '/images/photo-unavailable.svg'; }
    catch { return '/images/photo-unavailable.svg'; }
  }
  function savedCard(listing) {
    const title = typeof listing.title === 'string' ? listing.title : 'Stay';
    const card = element('article', 'wl-stay-card'); card.dataset.listingId = listing.id;
    const link = element('a', 'wl-card'); link.href = '/listings/' + listing.id; link.setAttribute('aria-label', title);
    const imageWrap = element('div', 'wl-card-img-wrapper');
    const image = document.createElement('img'); image.className = 'wl-card-img'; image.alt = title; image.loading = 'lazy'; image.width = 640; image.height = 480;
    image.addEventListener('error', () => { image.src = '/images/photo-unavailable.svg'; image.alt = 'Photo unavailable for this property'; }, {once:true});
    image.src = safePhoto(listing.imageUrl);
    const arrow = element('span', 'wl-card-arrow'); arrow.append(icon('arrow')); imageWrap.append(image, arrow);
    const body = element('div', 'wl-card-body'); body.append(element('p', 'wl-card-location', [listing.location, listing.country].filter(Boolean).join(' · ')), element('h3', 'wl-card-title', title));
    const rating = element('span', 'wl-rating-summary');
    if (typeof listing.averageRating === 'number') {
      const text = element('span', '', `${listing.averageRating.toFixed(1)} · ${listing.reviewCount} ${listing.reviewCount === 1 ? 'review' : 'reviews'}`);
      text.setAttribute('role', 'img');
      text.setAttribute('aria-label', `${listing.averageRating.toFixed(1)} out of 5 from ${listing.ratingCount} rated reviews; ${listing.reviewCount} reviews total`);
      rating.append(icon('star'), text);
    } else rating.textContent = listing.reviewCount ? `${listing.reviewCount} reviews · Not yet rated` : 'No reviews yet';
    const price = element('div', 'wl-card-price'); price.append(element('strong', '', typeof listing.price === 'number' ? '₹' + listing.price.toLocaleString('en-IN') : '₹—'), element('span', '', ' / night'));
    body.append(rating, price); link.append(imageWrap, body);
    const save = element('button', 'wl-save-button'); save.type = 'button'; save.dataset.saveListing = listing.id; save.dataset.listingTitle = title; save.append(icon('heart'));
    card.append(link, save); return card;
  }
  async function loadSaved(focusAfter = false) {
    if (!savedPage) return;
    const version = ++requestVersion;
    const ids = readSaved();
    const grid = savedPage.querySelector('[data-saved-grid]');
    const empty = savedPage.querySelector('[data-saved-empty]');
    const message = savedPage.querySelector('[data-saved-message]');
    const count = savedPage.querySelector('[data-saved-results]');
    const retry = savedPage.querySelector('[data-saved-retry]');
    retry.hidden = true; empty.hidden = true;
    if (ids === null) {
      message.textContent = 'This browser is blocking saved stays. Enable site storage to use this feature.';
      grid.replaceChildren(); grid.setAttribute('aria-busy', 'false'); return;
    }
    if (!ids.length) {
      grid.replaceChildren(); grid.setAttribute('aria-busy', 'false'); count.textContent = '0 saved stays'; empty.hidden = false; message.textContent = '';
      if (focusAfter) { empty.querySelector('a').focus(); }
      return;
    }
    message.textContent = 'Loading your saved stays…'; grid.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/listings/saved/data?' + new URLSearchParams({ids:ids.join(',')}), {headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Could not load saved stays.');
      const payload = await response.json();
      if (!Array.isArray(payload.listings) || !Array.isArray(payload.missingIds) || payload.listings.some(item => !ids.includes(item.id)) || payload.missingIds.some(id => !ids.includes(id))) throw new Error('Invalid saved stays response.');
      if (version !== requestVersion) return;
      const currentIds = readSaved();
      if (currentIds === null) throw new Error('Storage is unavailable.');
      const missing = new Set(payload.missingIds);
      if (missing.size) writeSaved(currentIds.filter(id => !missing.has(id)));
      const listings = payload.listings.filter(item => currentIds.includes(item.id));
      grid.replaceChildren(...listings.map(savedCard));
      empty.hidden = listings.length > 0;
      count.textContent = `${listings.length} saved ${listings.length === 1 ? 'stay' : 'stays'}`;
      message.textContent = missing.size ? `${missing.size} saved ${missing.size === 1 ? 'stay is' : 'stays are'} no longer available and won't appear here.` : 'Saved on this device only. Your collection does not sync between browsers.';
      syncButtons();
      if (focusAfter) (grid.querySelector('[data-save-listing]') || empty.querySelector('a')).focus();
    } catch {
      if (version !== requestVersion) return;
      message.textContent = 'We couldn’t load your saved stays. Your collection has been kept. Check your connection and try again.';
      retry.hidden = false;
    } finally { if (version === requestVersion) grid.setAttribute('aria-busy', 'false'); }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-save-listing]');
    if (!button) return;
    const ids = readSaved(); const id = button.dataset.saveListing.toLowerCase();
    if (ids === null || !idPattern.test(id)) { announce('Saving is unavailable in this browser.'); return; }
    const saved = ids.includes(id);
    if (!saved && ids.length >= LIMIT) { announce('You can save up to 100 stays on this device. Unsave one before adding another.'); return; }
    if (!writeSaved(saved ? ids.filter(value => value !== id) : [id, ...ids])) return;
    syncButtons(); announce(saved ? 'Stay removed from this device’s collection.' : 'Stay saved on this device. View your collection using Saved in the navigation.');
    loadSaved(Boolean(savedPage));
  });
  document.querySelector('[data-saved-retry]')?.addEventListener('click', () => loadSaved());
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { syncButtons(); loadSaved(); } });
  window.addEventListener('pageshow', () => { syncButtons(); loadSaved(); });
  syncButtons();
})();
