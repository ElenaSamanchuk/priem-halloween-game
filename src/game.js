/* Хэллоуин «найди ПриЕм» — рантайм. IIFE, ES5, без глобалов (кроме флага window.__hlwInstalled и dataLayer). */
(function () {
  if (window.__hlwInstalled) return;
  window.__hlwInstalled = 1;

  var RT = /*__HLW_RT__*/{};
  var doc = document;
  var html = doc.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var active = null; // текущий экземпляр игры
  var lock = { on: false, y: 0, ios: false, pad: '', bodyCss: '' };

  function raf(fn) { (window.requestAnimationFrame || window.setTimeout)(fn, 16); }

  function rnd(n) {
    var c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      var a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = rnd(i + 1), t = r[i];
      r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  function track(name, params) {
    var o = { event: 'hlw_' + name }, k;
    if (params) for (k in params) if (params.hasOwnProperty(k)) o[k] = params[k];
    (window.dataLayer = window.dataLayer || []).push(o);
    if (RT.ymId && typeof window.ym === 'function') {
      try { window.ym(RT.ymId, 'reachGoal', 'hlw_' + name, params || undefined); } catch (e) {}
    }
  }

  /* ---------- блокировка прокрутки страницы ---------- */
  function lockScroll() {
    if (lock.on) return;
    lock.on = true;
    lock.y = window.pageYOffset || html.scrollTop || 0;
    lock.ios = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var sbw = window.innerWidth - html.clientWidth;
    lock.pad = html.style.paddingRight;
    if (sbw > 0) html.style.paddingRight = sbw + 'px';
    html.classList.add('hlw-lock');
    if (lock.ios) {
      var b = doc.body;
      lock.bodyCss = b.style.cssText;
      b.style.position = 'fixed';
      b.style.top = -lock.y + 'px';
      b.style.left = '0';
      b.style.right = '0';
      b.style.width = '100%';
    }
  }

  function unlockScroll() {
    if (!lock.on) return;
    lock.on = false;
    html.classList.remove('hlw-lock');
    html.style.paddingRight = lock.pad;
    if (lock.ios) {
      doc.body.style.cssText = lock.bodyCss;
      try { window.scrollTo({ top: lock.y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, lock.y); }
    }
  }

  /* ---------- буфер обмена ---------- */
  function copyText(text) {
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      doc.body.appendChild(ta);
      ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e) {}
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e2) {}
      doc.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* ---------- экземпляр игры ---------- */
  function init(wrap) {
    if (wrap.getAttribute('data-hlw-ready')) return;
    wrap.setAttribute('data-hlw-ready', '1');

    var items = [].slice.call(wrap.querySelectorAll('.hlw-item'));
    if (!items.length) return;
    var stage = wrap.querySelector('.hlw-stage');
    var hint = wrap.querySelector('.hlw-hint');
    var missOv = wrap.querySelector('#hlw-miss');
    var winOv = wrap.querySelector('#hlw-win');
    var bar = wrap.querySelector('#hlw-bar');
    var shareRow = wrap.querySelector('#hlw-sharerow');
    var shareUrlFn = function () { return RT.shareUrl || (location.origin + location.pathname); };

    var winner = rnd(items.length);
    var order = shuffle(RT.miss.map(function (_, i) { return i; }));
    var missFor = [];
    var k = 0, i;
    for (i = 0; i < items.length; i++) {
      if (i === winner) { missFor.push(null); continue; }
      if (k >= order.length) { order = shuffle(order); k = 0; }
      missFor.push(RT.miss[order[k++]]);
    }

    var st = { started: false, won: false, ov: null, opener: null, timer: null };
    var inst = { wrap: wrap, st: st };
    active = inst;

    /* --- попапы --- */
    function focusables(ov) {
      var list = ov.querySelectorAll('a[href],button:not([disabled])');
      var out = [];
      for (var n = 0; n < list.length; n++) if (list[n].offsetParent !== null || list[n] === doc.activeElement) out.push(list[n]);
      return out;
    }

    function openOv(ov, opener, focusSel) {
      if (st.ov) closeOv(true);
      st.ov = ov;
      st.opener = opener || null;
      clearTimeout(st.timer);
      lockScroll();
      ov.hidden = false;
      void ov.offsetWidth;
      ov.classList.add('is-visible');
      var f = focusSel && ov.querySelector(focusSel);
      (f || ov.querySelector('.hlw-dialog')).focus();
    }

    function closeOv(instant) {
      var ov = st.ov;
      if (!ov) return;
      st.ov = null;
      ov.classList.remove('is-visible');
      var done = function () { ov.hidden = true; };
      if (instant || reduce) done(); else st.timer = setTimeout(done, 300);
      unlockScroll();
      var back = st.opener;
      if (back && (back.disabled || !doc.body.contains(back))) back = st.won ? wrap.querySelector('#hlw-bar .hlw-copy') : null;
      if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); } }
    }
    inst.close = closeOv;

    [missOv, winOv].forEach(function (ov) {
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.setAttribute('data-bd', '1'); else ov.removeAttribute('data-bd'); });
      ov.addEventListener('click', function (e) {
        if (e.target === ov && ov.getAttribute('data-bd')) { ov.removeAttribute('data-bd'); closeOv(); }
      });
      ov.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = focusables(ov);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], a = doc.activeElement;
        if (e.shiftKey && (a === first || a === ov.querySelector('.hlw-dialog'))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      });
    });
    [].slice.call(wrap.querySelectorAll('[data-hlw-close]')).forEach(function (b) {
      b.addEventListener('click', function () { closeOv(); });
    });

    /* --- предметы --- */
    function markWin(el) {
      st.won = true;
      items.forEach(function (it) { it.disabled = true; });
      el.classList.add('is-found');
      el.classList.remove('is-open');
      bar.hidden = false;
      track('win');
    }

    items.forEach(function (el, idx) {
      el.style.setProperty('--hlw-d', (idx * 0.37).toFixed(2) + 's');
      el.addEventListener('click', function () {
        if (st.won) return;
        if (!st.started) { st.started = true; track('start'); }
        if (idx === winner) {
          markWin(el);
          openOv(winOv, el, '.hlw-btn');
          return;
        }
        var m = missFor[idx];
        el.classList.add('is-open');
        wrap.querySelector('#hlw-miss-title').textContent = m.t;
        wrap.querySelector('#hlw-miss-text').textContent = m.d;
        var pic = wrap.querySelector('#hlw-miss-pic'), pi = pic.querySelector('img'), ph = pic.querySelector('.hlw-pic__ph');
        if (m.i) { pi.src = m.i; pi.hidden = false; ph.hidden = true; } else { pi.hidden = true; ph.hidden = false; }
        track('miss', { item: el.getAttribute('data-id') });
        openOv(missOv, el, '.hlw-btn');
      });
    });

    /* --- копирование промокода --- */
    function flashTip(tip) {
      tip.classList.add('is-on');
      clearTimeout(tip._t);
      tip._t = setTimeout(function () { tip.classList.remove('is-on'); }, 2000);
    }
    [].slice.call(wrap.querySelectorAll('.hlw-promo')).forEach(function (box) {
      var tip = box.querySelector('.hlw-tip');
      function doCopy() {
        copyText(RT.promo).then(function (ok) {
          if (ok) { tip.textContent = RT.copiedText; flashTip(tip); track('copy_code'); }
          else { tip.textContent = RT.copyFailText; flashTip(tip); }
        });
      }
      box.querySelector('.hlw-code').addEventListener('click', doCopy);
      box.querySelector('.hlw-copy').addEventListener('click', doCopy);
    });

    /* --- заказ: плавный скролл с учётом фиксированной шапки --- */
    [].slice.call(wrap.querySelectorAll('[data-hlw-order]')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        track('order_click');
        var href = a.getAttribute('href') || '';
        if (href.charAt(0) !== '#' || href.length < 2) return;
        var t = doc.getElementById(href.slice(1));
        if (!t) return;
        e.preventDefault();
        closeOv(true);
        raf(function () {
          var nb = doc.getElementById('navbar'), off = 0;
          if (nb) {
            var pos = window.getComputedStyle(nb).position;
            if (pos === 'fixed' || pos === 'sticky') off = nb.getBoundingClientRect().height;
          }
          var y = t.getBoundingClientRect().top + (window.pageYOffset || 0) - off - 8;
          try { window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' }); } catch (e2) { window.scrollTo(0, Math.max(0, y)); }
        });
      });
    });

    /* --- шеринг --- */
    var shareBtn = wrap.querySelector('#hlw-share');
    var vk = wrap.querySelector('#hlw-share-vk');
    var tg = wrap.querySelector('#hlw-share-tg');
    var cl = wrap.querySelector('#hlw-share-copy');
    function fillShare() {
      var u = encodeURIComponent(shareUrlFn());
      vk.href = 'https://vk.com/share.php?url=' + u;
      tg.href = 'https://t.me/share/url?url=' + u + '&text=' + encodeURIComponent(RT.shareText);
    }
    function toggleRow(force) {
      var show = typeof force === 'boolean' ? force : shareRow.hidden;
      fillShare();
      shareRow.hidden = !show;
      shareBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    }
    shareBtn.addEventListener('click', function () {
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (coarse && navigator.share) {
        track('share_click', { channel: 'native' });
        navigator.share({ title: RT.shareTitle, text: RT.shareText, url: shareUrlFn() }).catch(function (err) {
          if (!err || err.name !== 'AbortError') toggleRow(true);
        });
        return;
      }
      toggleRow();
    });
    vk.addEventListener('click', function () { fillShare(); track('share_click', { channel: 'vk' }); });
    tg.addEventListener('click', function () { fillShare(); track('share_click', { channel: 'telegram' }); });
    cl.addEventListener('click', function () {
      track('share_click', { channel: 'copy_link' });
      copyText(shareUrlFn()).then(function (ok) {
        var old = cl.getAttribute('data-label') || cl.textContent;
        cl.setAttribute('data-label', old);
        cl.textContent = ok ? RT.copiedText : RT.copyFailText;
        clearTimeout(cl._t);
        cl._t = setTimeout(function () { cl.textContent = old; }, 2000);
      });
    });

    /* --- панорама сцены на мобильных --- */
    var progUntil = 0, userMoved = false;
    function center() {
      if (!stage || userMoved) return;
      var d = stage.scrollWidth - stage.clientWidth;
      if (d > 0) { progUntil = Date.now() + 500; stage.scrollLeft = d / 2; }
    }
    if (stage && hint) {
      stage.addEventListener('scroll', function () {
        if (Date.now() < progUntil) return;
        userMoved = true;
        hint.classList.add('is-gone');
      }, { passive: true });
      center();
      raf(center);
      window.addEventListener('load', center);
      window.addEventListener('resize', center);
    }
  }

  /* ---------- установка / переустановка (innerHTML в priem.menu) ---------- */
  function ensure() {
    var w = doc.getElementById('hlw-wrap');
    if (w && !w.getAttribute('data-hlw-ready')) init(w);
    if (lock.on && (!active || !doc.body.contains(active.wrap))) unlockScroll();
  }

  doc.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && active && active.st.ov) {
      e.preventDefault();
      active.close();
    }
  });

  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      raf(function () { pending = false; ensure(); });
    }).observe(html, { childList: true, subtree: true });
  }
  var tries = 0;
  var poll = setInterval(function () {
    tries += 1;
    ensure();
    var w = doc.getElementById('hlw-wrap');
    if ((w && w.getAttribute('data-hlw-ready')) || tries > 80) clearInterval(poll);
  }, 250);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ensure); else ensure();
})();
