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
    var shareUrlFn = function () { return RT.shareUrl || (location.origin + location.pathname); };

    var winner = RT.fixedWinner >= 0 && RT.fixedWinner < items.length ? RT.fixedWinner : rnd(items.length);
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
      var l = wrap.querySelector('.hlw-lamp'), c = canvas && canvas.getBoundingClientRect();
      if (!l || !c || !c.width) return { x: RT.lamp.x, y: RT.lamp.y };
      var r = l.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - c.left) / c.width, y: (r.top + r.height / 2 - c.top) / c.height };
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
    // стая из 5 мышей разлетается веером из найденного предмета (клоны готовой мыши со спрайтом)
    function flockFrom(el) {
      var tpl = wrap.querySelector('.hlw-bat'), fl = wrap.querySelector('.hlw-flock');
      if (!tpl || !fl || reduce || fl.offsetParent === null) return;
      var r = el.getBoundingClientRect(), c = fl.getBoundingClientRect();
      var cx = r.left + r.width / 2 - c.left, cy = r.top + r.height / 2 - c.top;
      for (var i = 0; i < 5; i++) {
        var b = tpl.cloneNode(true), ang = (-160 + i * 35 + rnd(14) - 7) * Math.PI / 180, dist = Math.max(c.width, c.height) * 0.8;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        b.className = 'hlw-bat' + (dx < 0 ? ' is-rtl' : '');
        b.style.setProperty('--x0', (cx - 30) + 'px'); b.style.setProperty('--y0', (cy - 20) + 'px');
        b.style.setProperty('--x1', (cx - 30 + dx) + 'px'); b.style.setProperty('--y1', (cy - 20 + dy) + 'px');
        b.style.setProperty('--t', (2 + rnd(6) / 10) + 's'); b.style.setProperty('--dl', (i * 0.09) + 's');
        var img = b.querySelector('img'); if (img) img.loading = 'eager';
        fl.appendChild(b);
      }
      setTimeout(function () { fl.innerHTML = ''; }, 3400);
      setTimeout(function () { sfx('bat'); }, 150);
    }
    function markWin(el) {
      st.won = true;
      items.forEach(function (it) { it.disabled = true; });
      el.classList.add('is-found');
      el.classList.remove('is-open');
      bar.hidden = false;
      setPill(RT.pillWin);
      var tc = wrap.querySelector('.hlw-torch'); if (tc) tc.classList.remove('is-on');
      if (inst.ghostCheer) inst.ghostCheer();
      wrap.classList.add('is-won');
      if (inst.prefetchOg) inst.prefetchOg();
      track('win', { clicks: opened + 1 });
    }

    var busy = false;
    // рамка фокуса — только при работе с клавиатуры: мышь/палец её выключают, Tab возвращает
    wrap.addEventListener('pointerdown', function () { wrap.classList.add('hlw-pointer'); }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Tab') wrap.classList.remove('hlw-pointer'); });
    var winkN = 0, winkT = null, winkEl = null;
    function boil(el) {
      el.classList.remove('is-boil'); void el.offsetWidth; el.classList.add('is-boil');
      sfx('boil'); buzz([10, 30, 10, 30, 10, 30, 60]); track('easter_boil');
      var stm = wrap.querySelector('.hlw-steam');
      setTimeout(function () {
        if (stm) { stm.classList.remove('is-on', 'is-face', 'is-jet'); void stm.offsetWidth; stm.classList.add('is-jet'); setTimeout(function () { stm.classList.remove('is-jet'); }, 2000); }
        burstAt(el, 'smoke');
      }, 550);
      setTimeout(function () { el.classList.remove('is-boil'); }, 1000);
    }
    function wink(el) {
      el.classList.remove('is-wink'); wrap.classList.remove('is-wink'); void el.offsetWidth;
      el.classList.add('is-wink'); wrap.classList.add('is-wink');
      sfx('wink'); buzz([15, 60, 15]); track('easter_wink');
      setTimeout(function () { el.classList.remove('is-wink'); wrap.classList.remove('is-wink'); }, 1500);
    }
    items.forEach(function (el, idx) {
      el.addEventListener('click', function (ev) {
        if (st.won || busy) return;
        // пасхалки: 3 быстрых клика по проверенной тыкве — подмигнёт, 4 по проверенному котлу — закипит
        var eggN = { 'pumpkin-lamp': 3, cauldron: 4 }[el.getAttribute('data-id')];
        if (eggN && el.classList.contains('is-open') && !ev.hlwReplay) {
          if (winkEl !== el) { winkN = 0; winkEl = el; }
          winkN += 1; clearTimeout(winkT);
          if (winkN >= eggN) { winkN = 0; if (eggN === 3) wink(el); else boil(el); return; }
          winkT = setTimeout(function () { var n = winkN; winkN = 0; if (n) { var e2 = new MouseEvent('click'); e2.hlwReplay = true; el.dispatchEvent(e2); } }, 350);
          return;
        }
        if (!st.started) { st.started = true; track('start'); }
        sfx('tap');
        if (idx === winner) {
          busy = true;
          var wi = winOv.querySelector('.hlw-pic img');
          if (wi && wi.decode) { try { wi.decode().catch(function () {}); } catch (e) {} }
          markWin(el);
          burstAt(el, 'gold');
          flockFrom(el);
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
          // результат пишем прямо на кнопке — всплывашка над плашкой закрывала текст попапа
          var btn = box.querySelector('.hlw-copy');
          if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
          btn.textContent = ok ? RT.copiedText + ' ✓' : RT.copyFailText;
          btn.classList.toggle('is-done', !!ok);
          tip.textContent = ok ? RT.copiedText : RT.copyFailText; // для экранного диктора (aria-live)
          clearTimeout(btn._t); btn._t = setTimeout(function () { btn.textContent = btn.getAttribute('data-label'); btn.classList.remove('is-done'); }, 2000);
          if (ok) { sfx('copy'); track('copy_code'); }
        });
      }
      box.querySelector('.hlw-code').addEventListener('click', doCopy);
      box.querySelector('.hlw-copy').addEventListener('click', doCopy);
    });

    var toast = wrap.querySelector('.hlw-toast');
    function showToast(html) {
      if (!toast) return;
      toast.innerHTML = html;
      // не перекрывать пилюлю «ПриЕм найден!»: если она на экране — тост сразу под ней
      var pill = wrap.querySelector('.hlw-pill'), top = '';
      if (pill) { var pr = pill.getBoundingClientRect(); if (pr.bottom > 0 && pr.top < innerHeight) top = Math.round(pr.bottom + 8) + 'px'; }
      toast.style.top = top;
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

    /* --- шеринг: одна кнопка, как в мемо-игре.
       Телефон — системное «Поделиться» (с OG-картинкой файлом, если браузер умеет);
       компьютер — окно репоста ВК с нашей картинкой + текст со ссылкой в буфер. --- */
    var shareBtn = wrap.querySelector('#hlw-share');
    // Файл картинки в системное «Поделиться» не передаём: Telegram и др. тогда отправляют только картинку без текста.
    // Картинку для превью мессенджер берёт по ссылке из OG-тегов страницы.
    var ogAbs = RT.ogImage ? new URL(RT.ogImage, location.href).href : '';
    function shareUrlNow() { return RT.shareUrl || (location.origin + location.pathname); }
    inst.prefetchOg = function () {};
    if (shareBtn) shareBtn.addEventListener('click', function () {
      var url = shareUrlNow(), text = RT.shareText, full = text + '\n\n' + url;
      function fallback() { copyText(full).then(function (ok) { if (ok) showToast(RT.shareCopied); }); }
      if (typeof navigator.share === 'function') {
        // только text: с отдельным url Telegram на Android ставит ссылку первой, Safari теряет текст
        var payload = { title: RT.shareTitle, text: full };
        track('share_click', { channel: 'native' });
        navigator.share(payload).catch(function (err) { if (!err || err.name !== 'AbortError') fallback(); });
        return;
      }
      var vk = 'https://vk.com/share.php?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(text) +
        '&description=' + encodeURIComponent(text) + (ogAbs ? '&image=' + encodeURIComponent(ogAbs) : '') + '&noparse=1';
      track('share_click', { channel: 'vk' });
      copyText(full).then(function () { showToast(RT.shareCopiedVk); });
      window.open(vk, '_blank', 'noopener,noreferrer,width=626,height=436');
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

    /* --- молния: раз в 30–45 с, пока блок на экране --- */
    var flash = wrap.querySelector('.hlw-flash'), fTimer = null;
    function flashSchedule() {
      clearTimeout(fTimer);
      if (!flash || reduce) return;
      fTimer = setTimeout(function () {
        if (inView && !doc.hidden && !st.ov) {
          flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
          setTimeout(function () { sfx('thunder'); }, 350);
        }
        flashSchedule();
      }, 30000 + rnd(15000));
    }

    /* --- подсказка: 12 с без кликов — случайный непроверенный предмет вспыхивает, призрак выглядывает с его стороны --- */
    var hTimer = null;
    function hintSchedule() {
      clearTimeout(hTimer);
      if (st.won) return;
      hTimer = setTimeout(function () {
        if (st.won) return;
        if (!inView || doc.hidden || st.ov) { hintSchedule(); return; }
        var left = items.filter(function (it) { return !it.classList.contains('is-open'); });
        if (!left.length) return;
        var el = left[rnd(left.length)];
        el.classList.remove('is-hint'); void el.offsetWidth; el.classList.add('is-hint');
        setTimeout(function () { el.classList.remove('is-hint'); }, 3300);
        sfx('hint');
        if (ghost && !reduce && !ghost.classList.contains('is-peek')) {
          var r = el.getBoundingClientRect(), c = scene.getBoundingClientRect();
          gSide = (r.left + r.width / 2 - c.left) > c.width / 2 ? 'l' : 'r'; // ghostPeek сменит сторону на противоположную — получится сторона предмета
          clearTimeout(gTimer); ghostPeek();
        }
        hintSchedule();
      }, 12000);
    }
    wrap.addEventListener('click', function () { hintSchedule(); }, true);

    /* --- глубина (деск, мышь): кухня и пещера сдвигаются чуть по-разному --- */
    var front = wrap.querySelector('.hlw-front'), back = wrap.querySelector('.hlw-scene__bg');
    if (front && back && scene && !reduce && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      var px = 0, py = 0, tx2 = 0, ty2 = 0, pRun = false;
      var deskMq = window.matchMedia('(min-width:1024px)');
      var stepP = function () {
        px += (tx2 - px) * 0.06; py += (ty2 - py) * 0.06;
        var on = deskMq.matches;
        front.style.transform = on ? 'translate3d(' + (px * 5).toFixed(2) + 'px,' + (py * 3).toFixed(2) + 'px,0)' : '';
        back.style.transform = on ? 'translate3d(' + (px * -3).toFixed(2) + 'px,' + (py * -2).toFixed(2) + 'px,0) scale(1.02)' : '';
        if (Math.abs(tx2 - px) > 0.002 || Math.abs(ty2 - py) > 0.002) raf(stepP);
        else {
          pRun = false;
          // мышь ушла и всё вернулось в ноль — снимаем трансформации, чтобы браузер не держал огромные слои
          if (!tx2 && !ty2) { front.style.transform = ''; back.style.transform = ''; }
        }
      };
      var kick = function () { if (!pRun) { pRun = true; raf(stepP); } };
      scene.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = scene.getBoundingClientRect();
        tx2 = ((e.clientX - r.left) / r.width - 0.5) * 2; ty2 = ((e.clientY - r.top) / r.height - 0.5) * 2;
        kick();
      });
      scene.addEventListener('pointerleave', function () { tx2 = 0; ty2 = 0; kick(); });
    }

    /* --- капли с потолка: раз в 6–12 с, пока блок на экране --- */
    var drops = wrap.querySelector('.hlw-drops'), dTimer = null;
    function dropSchedule() {
      clearTimeout(dTimer);
      if (!drops || reduce) return;
      dTimer = setTimeout(function () {
        if (inView && !doc.hidden && !st.ov && drops.offsetParent !== null) {
          var W = drops.clientWidth, H = drops.clientHeight;
          var x = (rnd(2) ? 0.04 + rnd(20) / 100 : 0.76 + rnd(20) / 100) * W; // над пещерой по бокам
          if (rnd(4) === 0) x = (0.32 + rnd(36) / 100) * W; // иногда — над кухней
          var land = H * (0.82 + rnd(12) / 100), t = Math.sqrt(land / 900) + 0.15;
          var d = doc.createElement('i'); d.className = 'hlw-drop';
          d.style.left = x + 'px'; d.style.setProperty('--d', land + 'px'); d.style.setProperty('--t', t.toFixed(2) + 's');
          drops.appendChild(d);
          setTimeout(function () {
            if (d.parentNode) d.parentNode.removeChild(d);
            var sp = doc.createElement('i'); sp.className = 'hlw-splash'; sp.style.left = x + 'px'; sp.style.top = land + 'px';
            drops.appendChild(sp); sfx('drip');
            setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
          }, t * 1000);
        }
        dropSchedule();
      }, 6000 + rnd(6000));
    }

    /* --- летучая мышь: раз в 20–32 с пролетает поперёк, через верх окна кухни --- */
    var batEl = wrap.querySelector('.hlw-bat'), bTimer = null, bFirst = true;
    function batSchedule() {
      clearTimeout(bTimer);
      if (!batEl || reduce) return;
      bTimer = setTimeout(function () {
        if (inView && !doc.hidden && !st.ov) {
          var W = scene.clientWidth, H = scene.clientHeight, bw = batEl.offsetWidth || 48;
          var ltr = rnd(2) === 0, y0 = H * (0.16 + rnd(16) / 100), y1 = H * (0.12 + rnd(20) / 100);
          batEl.style.setProperty('--x0', (ltr ? -bw * 1.5 : W + bw * 0.5) + 'px');
          batEl.style.setProperty('--x1', (ltr ? W + bw * 0.5 : -bw * 1.5) + 'px');
          batEl.style.setProperty('--y0', y0 + 'px'); batEl.style.setProperty('--y1', y1 + 'px');
          batEl.style.setProperty('--r', ((y1 - y0) / W * 40).toFixed(1) + 'deg');
          batEl.style.setProperty('--t', (Math.max(2.6, W / 420) + rnd(10) / 10).toFixed(1) + 's');
          batEl.classList.toggle('is-rtl', !ltr);
          batEl.classList.remove('is-fly'); void batEl.offsetWidth; batEl.classList.add('is-fly');
          setTimeout(function () { sfx('bat'); }, 500);
        }
        batSchedule();
      }, bFirst ? 9000 : 20000 + rnd(12000));
      bFirst = false;
    }

    /* --- паук: раз в 15–25 с спускается на нити, по клику убегает вверх --- */
    var spider = wrap.querySelector('.hlw-spider'), spT = null, spFirst = true;
    function spiderSchedule() {
      clearTimeout(spT);
      if (!spider || reduce) return;
      spT = setTimeout(function () {
        if (inView && !doc.hidden && !st.ov && !st.won) {
          spider.style.setProperty('--sd', (240 + rnd(140)) + '%');
          spider.classList.remove('is-down', 'is-flee'); void spider.offsetWidth; spider.classList.add('is-down');
          setTimeout(function () { spider.classList.remove('is-down'); }, 7100);
        }
        spiderSchedule();
      }, spFirst ? 6000 : 15000 + rnd(10000));
      spFirst = false;
    }
    var spBody = spider && spider.querySelector('.hlw-spider__body');
    if (spBody) spBody.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!spider.classList.contains('is-down')) return;
      spider.classList.remove('is-down'); void spider.offsetWidth; spider.classList.add('is-flee');
      sfx('bat'); buzz(15); track('easter_spider');
      setTimeout(function () { spider.classList.remove('is-flee'); }, 600);
    });

    /* --- пар над котлом при наведении (деск); лицо — не чаще раза в 6 с --- */
    var steam = wrap.querySelector('.hlw-steam'), caul = wrap.querySelector('.hlw-item[data-id="cauldron"]'), sBusy = false, faceAt = 0;
    if (steam && caul) caul.addEventListener('mouseenter', function () {
      if (sBusy || reduce) return;
      sBusy = true;
      var now = Date.now(), face = now - faceAt > 6000;
      if (face) {
        faceAt = now;
        var im = steam.querySelector('img'), so = steam.querySelector('source');
        if (im && !im.getAttribute('src')) { if (so) so.srcset = so.getAttribute('data-srcset'); im.src = im.getAttribute('data-src'); }
      }
      steam.classList.remove('is-on', 'is-face'); void steam.offsetWidth;
      steam.classList.add('is-on'); if (face) steam.classList.add('is-face');
      setTimeout(function () { steam.classList.remove('is-on', 'is-face'); sBusy = false; }, 3300);
    });

    /* --- пасхалка: значок «!!» — призрак говорит «Бу!» и уплывает --- */
    var egg = wrap.querySelector('.hlw-egg'), boo = wrap.querySelector('.hlw-boo'), booT = null;
    if (egg && boo) egg.addEventListener('click', function () {
      var im = boo.querySelector('img'), so = boo.querySelector('source');
      if (im && !im.getAttribute('src')) { if (so) so.srcset = so.getAttribute('data-srcset'); im.src = im.getAttribute('data-src'); }
      boo.classList.remove('is-on'); void boo.offsetWidth; boo.classList.add('is-on');
      sfx('miss'); buzz([20, 40, 20]);
      clearTimeout(booT); booT = setTimeout(function () { boo.classList.remove('is-on'); }, 2900);
      track('easter_egg');
    });

    /* --- высота блока = экран минус фиксированная шапка сайта (#navbar на priem.menu) --- */
    var section = doc.getElementById('halloween-game');
    function fitHeader() {
      var off = 0, nb = doc.getElementById('navbar') || doc.querySelector('.t228,.t-menu__fixed');
      if (nb) {
        var cs = window.getComputedStyle(nb);
        if (cs.position === 'fixed' || cs.position === 'sticky') off = Math.round(nb.getBoundingClientRect().height);
      }
      wrap.style.setProperty('--hlw-off', off + 'px');
      if (section) section.style.scrollMarginTop = off + 'px';
      if (fx && fx.setOpts) { try { fx.setOpts({ reduce: reduce, light: lampPoint(), floorY: 0.85 }); } catch (e) {} }
    }
    fitHeader();
    window.addEventListener('resize', function () { raf(fitHeader); });
    window.addEventListener('load', fitHeader);

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
      // всё, что появляется позже (попапы, призрак, мышь, паук), качаем и распаковываем заранее,
      // чтобы при открытии ничего не догружалось на глазах; сцена к этому моменту уже показана
      var go = function () {
        (RT.preload || []).forEach(function (p) {
          var pic = doc.createElement('picture'), so = doc.createElement('source'), im = doc.createElement('img');
          so.type = 'image/avif'; so.srcset = p.avif || ''; so.sizes = '(max-width:640px) 100vw, 640px';
          im.decoding = 'async'; im.sizes = '(max-width:640px) 100vw, 640px'; im.srcset = p.srcset;
          if (p.avif) pic.appendChild(so);
          pic.appendChild(im);
          im.src = p.src;
          if (im.decode) im.decode().catch(function () {});
        });
        [].slice.call(wrap.querySelectorAll('img[loading="lazy"], img[data-src]')).forEach(function (im) {
          var ds = im.getAttribute('data-src'), so = im.parentNode && im.parentNode.querySelector('source[data-srcset]');
          if (so && !so.srcset) so.srcset = so.getAttribute('data-srcset');
          if (ds && !im.getAttribute('src')) im.src = ds;
          im.loading = 'eager';
          if (im.decode) im.decode().catch(function () {});
        });
      };
      setTimeout(go, 400);
    }
    if (window.IntersectionObserver && scene) {
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        if (inView) { preload(); if (!gTimer) ghostSchedule(); if (!fTimer) flashSchedule(); if (!hTimer) hintSchedule(); if (!dTimer) dropSchedule(); if (!bTimer) batSchedule(); if (!spT) spiderSchedule(); }
        sync();
      }, { rootMargin: '200px 0px' }).observe(scene);
    } else { inView = true; preload(); sync(); ghostSchedule(); flashSchedule(); hintSchedule(); dropSchedule(); batSchedule(); spiderSchedule(); }
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
