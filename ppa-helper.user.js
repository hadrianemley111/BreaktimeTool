// ==UserScript==
// @name         BreaktimeTool PPA Auto Name Fixed
// @author       hademley
// @namespace    hadrianemley111-breaktime
// @version      1.1
// @description  Pull AA name from PPA before BreaktimeTool submits badge
// @match        https://hadrianemley111.github.io/BreaktimeTool/*
// @connect      fclm-portal.amazon.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  const WAREHOUSE_ID = 'KCVG';
  const cache = new Map();

  function isBadge(value) {
    return /^\d{4,12}$/.test(String(value || '').trim());
  }

  function getBadgeInput() {
    return [...document.querySelectorAll('input')]
      .find(i =>
        /badge/i.test(i.placeholder || '') ||
        /badge/i.test(i.name || '') ||
        /badge/i.test(i.id || '') ||
        isBadge(i.value)
      );
  }

  function getNameInput() {
    return [...document.querySelectorAll('input')]
      .find(i =>
        /optional name/i.test(i.placeholder || '') ||
        /name/i.test(i.placeholder || '') ||
        /name/i.test(i.name || '') ||
        /name/i.test(i.id || '')
      );
  }

  function ppaUrl(badge) {
    return `https://fclm-portal.amazon.com/employee/ppaTimeDetails?warehouseId=${WAREHOUSE_ID}&employeeId=${encodeURIComponent(badge)}`;
  }

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: resolve,
        onerror: reject,
        ontimeout: reject
      });
    });
  }

  function formatPpaName(text) {
    text = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();

    // Example:
    // Emley,Hadrian (hademley) -> Emley,Hadrian
    text = text.replace(/\s*\([^)]*\)\s*/g, '').trim();

    // Example:
    // Emley,Hadrian -> Hadrian Emley
    if (text.includes(',')) {
      const parts = text.split(',');
      const last = parts[0]?.trim();
      const first = parts[1]?.trim();

      if (first && last) {
        return `${first} ${last}`;
      }
    }

    return text;
  }

  function extractName(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Exact place shown on your PPA page:
    // <span class="fold-control">Emley,Hadrian (hademley)</span>
    const foldControl = doc.querySelector('span.fold-control');

    if (foldControl) {
      const raw = foldControl.textContent;
      const formatted = formatPpaName(raw);

      if (formatted) {
        console.log('[PPA] Found name from fold-control:', formatted);
        return formatted;
      }
    }

    // Backup search in page text
    const bodyText = doc.body?.innerText || '';

    const match = bodyText.match(/([A-Z][a-zA-Z'-]+)\s*,\s*([A-Z][a-zA-Z'-]+)\s*\([^)]+\)/);

    if (match) {
      const formatted = `${match[2]} ${match[1]}`;
      console.log('[PPA] Found name from body text:', formatted);
      return formatted;
    }

    console.warn('[PPA] Could not find name.');
    console.log('[PPA] Body text first 1500:', bodyText.slice(0, 1500));

    return '';
  }

  async function lookupName(badge) {
    badge = String(badge || '').trim();

    if (!isBadge(badge)) return '';

    if (cache.has(badge)) {
      return cache.get(badge);
    }

    try {
      console.log('[PPA] Looking up badge:', badge);

      const res = await gmGet(ppaUrl(badge));

      console.log('[PPA] Status:', res.status);
      console.log('[PPA] URL:', ppaUrl(badge));

      if (res.status !== 200) {
        console.warn('[PPA] Bad status:', res.status);
        return '';
      }

      const name = extractName(res.responseText);

      if (name) {
        cache.set(badge, name);
        console.log('[PPA] Final name:', name);
        return name;
      }

      return '';
    } catch (err) {
      console.error('[PPA] Lookup failed:', err);
      return '';
    }
  }

  function setNameInput(name) {
    const nameInput = getNameInput();

    if (!nameInput || !name) {
      console.warn('[PPA] Name input not found or name blank.');
      return false;
    }

    nameInput.value = name;

    nameInput.dispatchEvent(new Event('input', {
      bubbles: true
    }));

    nameInput.dispatchEvent(new Event('change', {
      bubbles: true
    }));

    console.log('[PPA] Filled name input:', name);

    return true;
  }

  async function handleBeforeSubmit(e) {
    if (e.key !== 'Enter') return;

    const badgeInput = getBadgeInput();
    if (!badgeInput) return;

    const badge = String(badgeInput.value || '').trim();
    if (!isBadge(badge)) return;

    // This prevents an infinite loop when we resend Enter
    if (badgeInput.dataset.ppaReady === badge) {
      delete badgeInput.dataset.ppaReady;
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    const oldPlaceholder = badgeInput.placeholder;
    badgeInput.placeholder = 'LOOKING UP NAME...';

    const name = await lookupName(badge);

    badgeInput.placeholder = oldPlaceholder;

    if (name) {
      setNameInput(name);
    } else {
      console.warn('[PPA] No name found. It will submit as Unknown.');
    }

    badgeInput.dataset.ppaReady = badge;

    setTimeout(() => {
      badgeInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      }));
    }, 75);
  }

  document.addEventListener('keydown', handleBeforeSubmit, true);

  window.lookupPpaName = lookupName;

  console.log('[PPA] BreaktimeTool PPA Auto Name Fixed loaded.');
})();
