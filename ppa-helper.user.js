// ==UserScript==
// @name         BreaktimeTool PPA Auto Name
// @namespace    hadrianemley111-breaktime
// @Author       @hademley
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

  function clean(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/Employee Name/i, '')
      .replace(/Name/i, '')
      .replace(/[:\-]/g, '')
      .trim();
  }

  function looksLikeName(text) {
    text = clean(text);

    if (!text) return false;
    if (/\d/.test(text)) return false;
    if (text.length > 80) return false;

    const badWords = [
      'amazon',
      'ppa',
      'midway',
      'login',
      'sign in',
      'employee details',
      'time details',
      'error'
    ];

    if (badWords.some(w => text.toLowerCase().includes(w))) return false;

    const parts = text.split(' ');
    return parts.length >= 2 && parts.length <= 4;
  }

  function extractName(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bodyText = doc.body?.innerText || '';

    const patterns = [
      /Employee\s+Name\s*[:\-]?\s*([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3})/,
      /Name\s*[:\-]?\s*([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3})/,
      /"employeeName"\s*:\s*"([^"]+)"/i,
      /"name"\s*:\s*"([^"]+)"/i
    ];

    for (const p of patterns) {
      const match = html.match(p) || bodyText.match(p);
      if (match && looksLikeName(match[1])) {
        return clean(match[1]);
      }
    }

    const selectors = [
      '[id*="name" i]',
      '[class*="name" i]',
      'h1',
      'h2'
    ];

    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      const text = clean(el?.textContent);
      if (looksLikeName(text)) return text;
    }

    return '';
  }

  async function lookupName(badge) {
    badge = String(badge || '').trim();

    if (!isBadge(badge)) return '';

    if (cache.has(badge)) return cache.get(badge);

    try {
      console.log('[PPA] Looking up badge:', badge);

      const res = await gmGet(ppaUrl(badge));

      console.log('[PPA] Status:', res.status);
      console.log('[PPA] First 500 chars:', res.responseText.slice(0, 500));

      if (res.status !== 200) return '';

      const name = extractName(res.responseText);

      if (name) {
        cache.set(badge, name);
        console.log('[PPA] Found:', name);
        return name;
      }

      console.warn('[PPA] No name found in page.');
      return '';
    } catch (err) {
      console.error('[PPA] Lookup failed:', err);
      return '';
    }
  }

  function setNameInput(name) {
    const nameInput = getNameInput();

    if (!nameInput || !name) return false;

    nameInput.value = name;
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  async function handleBeforeSubmit(e) {
    if (e.key !== 'Enter') return;

    const badgeInput = getBadgeInput();
    if (!badgeInput) return;

    const badge = String(badgeInput.value || '').trim();
    if (!isBadge(badge)) return;

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
      console.warn('[PPA] Name not found, submitting as Unknown.');
    }

    badgeInput.dataset.ppaReady = badge;

    setTimeout(() => {
      badgeInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      }));
    }, 50);
  }

  document.addEventListener('keydown', handleBeforeSubmit, true);

  window.lookupPpaName = lookupName;

  console.log('[PPA] BreaktimeTool PPA Auto Name loaded.');
})();
