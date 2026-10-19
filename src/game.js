/* Хэллоуин «найди ПриЕм» — рантайм. IIFE, ES5, без глобалов (кроме флага window.__hlwInstalled и dataLayer). */
(function () {
  if (window.__hlwInstalled) return;
  window.__hlwInstalled = 1;

  /*__HLW_MODULES__*/
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
    var missOv = wrap.querySelector('#hlw-miss');
    var winOv = wrap.querySelector('#hlw-win');
    var bar = wrap.querySelector('#hlw-bar');
    var shareRow = wrap.querySelector('#hlw-sharerow');
    var shareUrlFn = function () { return RT.shareUrl || (location.origin + location.pathname); };

    var winner = rnd(items.length);
    // Тексты промаха: группируем по иллюстрации, из каждой группы — случайный текст,
    // чтобы за игру картинки не повторялись; если предметов больше, чем групп — добираем остальными
    var groups = {}, gk = [], n0;
    for (n0 = 0; n0 < RT.miss.length; n0++) {
      var g = RT.miss[n0].g || ('t' + n0);
      if (!groups[g]) { groups[g] = []; gk.push(g); }
      groups[g].push(RT.miss[n0]);
    }
    var first = [], rest = [];
    shuffle(gk).forEach(function (key) {
      var list = shuffle(groups[key]);
      first.push(list[0]);
      rest = rest.concat(list.slice(1));
    });
    var pool = first.concat(shuffle(rest));
    var missFor = [], k = 0, i;
    for (i = 0; i < items.length; i++) {
      if (i === winner) { missFor.push(null); continue; }
      missFor.push(pool[k % pool.length]); k++;
    }
    var total = items.length, opened = 0;
    var scene = wrap.querySelector('.hlw-scene');
    var pillTxt = wrap.querySelector('.hlw-pill__txt');
    var canvas = wrap.querySelector('.hlw-fx');
    var desk = window.matchMedia ? window.matchMedia('(min-width:1024px)') : null;
    var fx = null;
    try {
      if (typeof HlwFx === 'function' && canvas) fx = HlwFx(canvas, { reduce: reduce, light: lampPoint(), floorY: 0.85 });
    } catch (e) { fx = null; }
    function lampPoint() {
      var d = !desk || desk.matches;
      return d ? { x: RT.lamp.x, y: RT.lamp.y } : { x: RT.lamp.kx, y: RT.lamp.ky };
    }
    if (desk && fx && fx.setOpts) {
      var onMq = function () { try { fx.setOpts({ reduce: reduce, light: lampPoint(), floorY: 0.85 }); } catch (e) {} };
      if (desk.addEventListener) desk.addEventListener('change', onMq); else if (desk.addListener) desk.addListener(onMq);
    }
    var snd = typeof HlwSound === 'object' && HlwSound ? HlwSound : null;
    var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    function buzz(pattern) {
      if (!touch || reduce || typeof navigator.vibrate !== 'function') return;
      try { navigator.vibrate(pattern); } catch (e) {}
    }
    function sfx(name) { if (snd) { try { snd.play(name); } catch (e) {} } }
    function setPill(html) { if (pillTxt) pillTxt.innerHTML = html; }
    function burstAt(el, kind) {
      if (!fx || !canvas) return;
      var r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      try { fx.burst(r.left + r.width / 2 - c.left, r.top + r.height / 2 - c.top, kind); } catch (e) {}
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
      sfx('open');
      void ov.offsetWidth;
      ov.classList.add('is-visible');
      var f = focusSel && ov.querySelector(focusSel);
      (f || ov.querySelector('.hlw-dialog')).focus();
    }

    function closeOv(instant) {
      var ov = st.ov;
      if (!ov) return;
      st.ov = null;
      if (!instant) sfx('close');
      ov.classList.remove('is-visible');
      var done = function () { ov.hidden = true; };
      if (instant || reduce) done(); else st.timer = setTimeout(done, 380);
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
      setPill(RT.pillWin);
      var tc = wrap.querySelector('.hlw-torch'); if (tc) tc.classList.remove('is-on');
      if (inst.ghostCheer) inst.ghostCheer();
      track('win', { clicks: opened + 1 });
    }

    var busy = false;
    items.forEach(function (el, idx) {
      el.addEventListener('click', function () {
        if (st.won || busy) return;
        if (!st.started) { st.started = true; track('start'); }
        sfx('tap');
        if (idx === winner) {
          busy = true;
          var wi = winOv.querySelector('.hlw-pic img');
          if (wi && wi.decode) { try { wi.decode().catch(function () {}); } catch (e) {} }
          markWin(el);
          burstAt(el, 'gold');
          sfx('win');
          buzz([30, 60, 30, 60, 140]);
          setTimeout(function () { busy = false; openOv(winOv, el, '.hlw-btn'); }, reduce ? 0 : 750);
          return;
        }
        var m = missFor[idx];
        if (!el.classList.contains('is-open')) {
          el.classList.add('is-open');
          opened += 1;
          setPill(RT.pillProgress.replace('{n}', opened).replace('{total}', total));
        }
        wrap.querySelector('#hlw-miss-title').textContent = m.t;
        wrap.querySelector('#hlw-miss-text').textContent = m.d;
        var pi = wrap.querySelector('#hlw-miss-img');
        if (pi.getAttribute('data-src') !== m.i.src) {
          pi.setAttribute('data-src', m.i.src);
          var pa = wrap.querySelector('#hlw-miss-avif');
          if (pa && m.i.avif) pa.srcset = m.i.avif;
          pi.srcset = m.i.srcset;
          pi.src = m.i.src;
        }
        // распаковываем картинку заранее, пока предмет вздрагивает — попап открывается без рывка
        if (pi.decode) { try { pi.decode().catch(function () {}); } catch (e) {} }
        track('miss', { item: el.getAttribute('data-id') });
        burstAt(el, 'smoke');
        sfx('miss');
        buzz(22);
        if (reduce) { openOv(missOv, el, '.hlw-btn'); return; }
        busy = true;
        el.classList.remove('is-shake');
        void el.offsetWidth;
        el.classList.add('is-shake');
        setTimeout(function () { el.classList.remove('is-shake'); busy = false; openOv(missOv, el, '.hlw-btn'); }, 480);
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
          if (ok) { tip.textContent = RT.copiedText; flashTip(tip); sfx('copy'); track('copy_code'); }
          else { tip.textContent = RT.copyFailText; flashTip(tip); }
        });
      }
      box.querySelector('.hlw-code').addEventListener('click', doCopy);
      box.querySelector('.hlw-copy').addEventListener('click', doCopy);
    });

    var toast = wrap.querySelector('.hlw-toast');
    function showToast(html) {
      if (!toast) return;
      toast.innerHTML = html;
      toast.classList.add('is-on');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toast.classList.remove('is-on'); }, 4200);
    }

    /* --- заказ: плавный скролл с учётом фиксированной шапки --- */
    [].slice.call(wrap.querySelectorAll('[data-hlw-order]')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        track('order_click');
        copyText(RT.promo).then(function (ok) { if (ok) showToast(RT.orderToast); });
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

    /* --- звук: по умолчанию включён, но браузер разрешает его только после нажатия — стартуем на первом клике в игре --- */
    var sb = wrap.querySelector('.hlw-sound');
    var wantSound = true;
    if (sb && !snd) sb.hidden = true;
    function armSound() {
      if (!snd || !wantSound || snd.isOn()) return;
      try { snd.enable(true); } catch (e) {}
    }
    wrap.addEventListener('click', function (e) {
      if (sb && sb.contains(e.target)) return;
      armSound();
    }, true);
    if (sb && snd) sb.addEventListener('click', function () {
      var on = !wantSound;
      wantSound = on;
      try { snd.enable(on); } catch (e) {}
      sb.setAttribute('aria-pressed', on ? 'true' : 'false');
      sb.setAttribute('aria-label', on ? RT.soundOff : RT.soundOn);
      sb.title = on ? RT.soundOff : RT.soundOn;
      track('sound', { on: on ? 1 : 0 });
    });

    /* --- «фонарик» за курсором (только мышь на деске) --- */
    var torch = wrap.querySelector('.hlw-torch'), beam = torch && torch.firstChild;
    if (torch && scene && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      var tx = 0, ty = 0, tq = false;
      var place = function () { tq = false; beam.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)'; };
      scene.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = scene.getBoundingClientRect();
        tx = e.clientX - r.left; ty = e.clientY - r.top;
        if (!torch.classList.contains('is-on') && !st.won) torch.classList.add('is-on');
        if (!tq) { tq = true; raf(place); }
      });
      scene.addEventListener('pointerleave', function () { torch.classList.remove('is-on'); });
    }

    /* --- призрак выглядывает из-за края (раз в 10–16 с, пока блок на экране и попап закрыт) --- */
    var ghost = wrap.querySelector('.hlw-ghost'), gTimer = null, gSide = rnd(2) ? 'r' : 'l', gFirst = true;
    function ghostSchedule() {
      clearTimeout(gTimer);
      if (!ghost || reduce || st.won) return;
      gTimer = setTimeout(ghostPeek, gFirst ? 3500 : 10000 + rnd(6000));
      gFirst = false;
    }
    function ghostPeek() {
      if (!ghost || st.won) return;
      if (!inView || doc.hidden || st.ov) { ghostSchedule(); return; }
      gSide = gSide === 'l' ? 'r' : 'l';
      ghost.className = 'hlw-ghost is-' + gSide;
      void ghost.offsetWidth;
      ghost.classList.add('is-peek');
      gTimer = setTimeout(function () { ghost.classList.remove('is-peek'); ghostSchedule(); }, 4700);
    }
    inst.ghostCheer = function () {
      if (!ghost) return;
      clearTimeout(gTimer);
      ghost.className = 'hlw-ghost is-r';
      void ghost.offsetWidth;
      ghost.classList.add('is-cheer');
    };

    /* --- эффекты и звук работают, только пока блок на экране и вкладка видима --- */
    var inView = false, preloaded = false;
    function sync() {
      var live = inView && !doc.hidden;
      if (fx) { try { live ? fx.start() : fx.stop(); } catch (e) {} }
      if (snd) { try { live ? snd.resume() : snd.pause(); } catch (e) {} }
    }
    function preload() {
      if (preloaded) return;
      preloaded = true;
      var go = function () {
        // через <picture> в памяти: браузер сам выберет AVIF или WebP и нужный размер
        (RT.preload || []).forEach(function (p) {
          var pic = doc.createElement('picture'), so = doc.createElement('source'), im = doc.createElement('img');
          so.type = 'image/avif'; so.srcset = p.avif || ''; so.sizes = '(max-width:560px) 100vw, 560px';
          im.decoding = 'async'; im.sizes = '(max-width:560px) 100vw, 560px'; im.srcset = p.srcset;
          if (p.avif) pic.appendChild(so);
          pic.appendChild(im);
          im.src = p.src;
        });
      };
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 600);
    }
    if (window.IntersectionObserver && scene) {
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        if (inView) { preload(); if (!gTimer) ghostSchedule(); }
        sync();
      }, { rootMargin: '200px 0px' }).observe(scene);
    } else { inView = true; preload(); sync(); ghostSchedule(); }
    doc.addEventListener('visibilitychange', sync);
    inst.destroy = function () { inView = false; sync(); if (fx && fx.destroy) { try { fx.destroy(); } catch (e) {} } };
  }

  /* ---------- установка / переустановка (innerHTML в priem.menu) ---------- */
  function ensure() {
    var w = doc.getElementById('hlw-wrap');
    if (active && !doc.body.contains(active.wrap) && active.destroy) { active.destroy(); }
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
