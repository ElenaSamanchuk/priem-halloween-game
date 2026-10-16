/* Частицы на canvas для мини-игры «найди ПриЕм».
   Файл вставляется внутрь общей IIFE: одно объявление, без глобалов. ES5. */
var HlwFx = function (canvas, opts) {
  var ctx = null;
  var W = 0, H = 0, DPR = 1;
  var o = { reduce: false, light: null, floorY: null };
  var running = false;      // ambient включён (start/stop)
  var raf = 0;
  var last = 0;
  var clock = 0;            // своё время в секундах
  var dust = [];
  var embers = [];
  var parts = [];           // частицы burst: дым, искры
  var flashes = [];         // световые вспышки
  var emberTimer = 1.5;
  var dustMode = '';        // 'm' | 'd' — сколько пылинок собрано
  var ro = null, onWin = null, destroyed = false;
  var sprites = {};

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  /* Предрендеренный мягкий спрайт: радиальный градиент цвета rgb */
  function sprite(key, r, g, b, size, core) {
    var s = sprites[key];
    if (s) return s;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    var h = size / 2;
    var gr = x.createRadialGradient(h, h, 0, h, h, h);
    var rgb = r + ',' + g + ',' + b;
    gr.addColorStop(0, 'rgba(' + rgb + ',1)');
    gr.addColorStop(core, 'rgba(' + rgb + ',0.45)');
    gr.addColorStop(0.7, 'rgba(' + rgb + ',0.1)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, size, size);
    sprites[key] = c;
    return c;
  }
  function spDust() { return sprite('dust', 255, 214, 150, 48, 0.25); }
  function spEmber() { return sprite('ember', 255, 130, 30, 48, 0.2); }
  function spGold() { return sprite('gold', 254, 218, 0, 48, 0.2); }
  function spWhite() { return sprite('white', 255, 238, 214, 48, 0.2); }
  function spPink() { return sprite('pink', 255, 26, 108, 48, 0.2); }
  function spSmoke() { return sprite('smoke', 118, 104, 138, 128, 0.3); }
  function spFlashGold() { return sprite('fg', 255, 200, 70, 128, 0.3); }
  function spFlashSmoke() { return sprite('fs', 170, 150, 200, 128, 0.3); }

  /* Размер буфера и DPR */
  function resize() {
    safe(function () {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) {
        var rc = canvas.getBoundingClientRect();
        cw = rc.width; ch = rc.height;
      }
      if (!cw || !ch) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var nw = Math.round(cw * dpr), nh = Math.round(ch * dpr);
      var oldW = W, oldH = H;
      if (canvas.width !== nw) canvas.width = nw;
      if (canvas.height !== nh) canvas.height = nh;
      W = cw; H = ch; DPR = dpr;
      ctx = ctx || canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (oldW && (oldW !== W || oldH !== H)) {
        var i, p;
        for (i = 0; i < parts.length; i++) { p = parts[i]; p.x *= W / oldW; p.y *= H / oldH; }
        for (i = 0; i < embers.length; i++) { p = embers[i]; p.x *= W / oldW; p.y *= H / oldH; }
      }
      buildDust();
      if (!loopNeeded()) render(0); else schedule();
    });
  }

  /* Пылинки: координаты в долях, скорости в px/с */
  function buildDust() {
    var mode = W < 600 ? 'm' : 'd';
    if (mode === dustMode && dust.length) return;
    dustMode = mode;
    var n = mode === 'm' ? Math.round(rnd(18, 25)) : Math.round(rnd(30, 45));
    dust = [];
    for (var i = 0; i < n; i++) {
      dust.push({
        fx: Math.random(), fy: Math.random(),
        vx: rnd(-5, 7), vy: rnd(-7, 3),
        r: rnd(0.6, 1.8),
        a: rnd(0.15, 0.6),
        ph: rnd(0, 6.28), fr: rnd(0.3, 0.9),
        tw: rnd(0, 6.28), tf: rnd(0.8, 2.2),
        amp: rnd(3, 9)
      });
    }
  }

  function spawnEmber() {
    if (embers.length > 8) return;
    var fl = (typeof o.floorY === 'number') ? o.floorY : 0.7;
    var top = Math.min(0.9, Math.max(0.55, fl));
    embers.push({
      x: rnd(0.08, 0.92) * W, y: rnd(top, 1.0) * H,
      vy: -rnd(28, 55), ph: rnd(0, 6.28), fr: rnd(0.8, 1.6), amp: rnd(6, 14),
      r: rnd(1.4, 2.4), life: 0, max: rnd(2.6, 4.2)
    });
  }

  function addFlash(x, y, rad, a, dur, sp) {
    flashes.push({ x: x, y: y, r0: rad * 0.45, r1: rad, a: a, t: 0, dur: dur, sp: sp });
  }

  function spark(x, y, sp, ang, spd, life, size, g, drag) {
    parts.push({
      k: 's', x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0, max: life, r: size, sp: sp, g: g, drag: drag,
      ph: rnd(0, 6.28), tf: rnd(14, 30)
    });
  }

  function burst(x, y, kind) {
    safe(function () {
      if (destroyed) return;
      if (!ctx) resize();
      if (!ctx) return;
      if (parts.length > 400) parts.length = 0;
      var i, a;
      if (o.reduce) {
        addFlash(x, y, kind === 'gold' ? 110 : 80, kind === 'gold' ? 0.4 : 0.22, 0.4,
          kind === 'gold' ? spFlashGold() : spFlashSmoke());
        schedule();
        return;
      }
      if (kind === 'gold') {
        var n = Math.round(rnd(70, 110));
        for (i = 0; i < n; i++) {
          var q = Math.random();
          var sp = q < 0.6 ? spGold() : (q < 0.88 ? spWhite() : spPink());
          a = rnd(0, 6.283);
          var v = rnd(80, 430) * (0.35 + Math.random() * 0.65);
          spark(x, y, sp, a, v, rnd(1.0, 1.6), rnd(2.4, 4.6), 380, 1.6);
        }
        addFlash(x, y, 150, 0.6, 0.55, spFlashGold());
      } else {
        var m = Math.round(rnd(12, 18));
        for (i = 0; i < m; i++) {
          a = rnd(0, 6.283);
          var d = rnd(55, 170);
          parts.push({
            k: 'm', x: x + Math.cos(a) * rnd(0, 8), y: y + Math.sin(a) * rnd(0, 8),
            vx: Math.cos(a) * d, vy: Math.sin(a) * d - rnd(8, 30),
            life: -rnd(0, 0.08), max: rnd(0.8, 1.0),
            r: rnd(16, 28), grow: rnd(1.9, 2.6), a: rnd(0.3, 0.5)
          });
        }
        var k = Math.round(rnd(4, 6));
        for (i = 0; i < k; i++) {
          spark(x, y, i % 2 ? spEmber() : spGold(), rnd(0, 6.283), rnd(70, 190), rnd(0.4, 0.7), rnd(1.4, 2.2), 260, 2.2);
        }
      }
      schedule();
    });
  }

  function ease(t) { return t * t * (3 - 2 * t); }

  /* Одна отрисовка кадра */
  function render(dt) {
    if (!ctx || !W) return;
    var i, p, t;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    clock += dt;
    var lt = o.light && typeof o.light.x === 'number' ? o.light : null;
    var lx = lt ? lt.x * W : 0, ly = lt ? lt.y * H : 0;

    /* ambient */
    if (running) {
      ctx.globalCompositeOperation = 'lighter';
      var dsp = spDust();
      var cnt = o.reduce ? Math.min(10, dust.length) : dust.length;
      for (i = 0; i < cnt; i++) {
        p = dust[i];
        if (!o.reduce) {
          p.fx += p.vx * dt / W; p.fy += p.vy * dt / H;
          if (p.fx < -0.02) p.fx += 1.04; else if (p.fx > 1.02) p.fx -= 1.04;
          if (p.fy < -0.02) p.fy += 1.04; else if (p.fy > 1.02) p.fy -= 1.04;
        }
        var sx = p.fx * W, sy = p.fy * H;
        if (!o.reduce) {
          sx += Math.sin(clock * p.fr + p.ph) * p.amp;
          sy += Math.cos(clock * p.fr * 0.8 + p.ph) * p.amp * 0.6;
        }
        var al = p.a;
        if (!o.reduce) al *= 0.65 + 0.35 * Math.sin(clock * p.tf + p.tw);
        if (lt) {
          var dx = (sx - lx) / W, dy = (sy - ly) / W;
          var dd = Math.sqrt(dx * dx + dy * dy);
          al *= 1 + 1.6 * Math.max(0, 1 - dd / 0.4);
        }
        if (al > 0.95) al = 0.95;
        var s = p.r * 5.6;
        ctx.globalAlpha = al;
        ctx.drawImage(dsp, sx - s / 2, sy - s / 2, s, s);
      }
      if (!o.reduce) {
        var esp = spEmber();
        for (i = embers.length - 1; i >= 0; i--) {
          p = embers[i];
          p.life += dt;
          t = p.life / p.max;
          if (t >= 1) { embers.splice(i, 1); continue; }
          p.y += p.vy * dt;
          var ex = p.x + Math.sin(clock * p.fr + p.ph) * p.amp;
          var ea = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.7 + 0.3 * Math.sin(clock * 9 + p.ph));
          var es = p.r * (1 - t * 0.5) * 6;
          ctx.globalAlpha = Math.max(0, Math.min(1, ea));
          ctx.drawImage(esp, ex - es / 2, p.y - es / 2, es, es);
        }
        emberTimer -= dt;
        if (emberTimer <= 0) { spawnEmber(); emberTimer = rnd(2, 4); }
      }
    }

    /* дым (обычное смешение) */
    ctx.globalCompositeOperation = 'source-over';
    var smk = spSmoke();
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      if (p.k !== 'm') continue;
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.life < 0) continue;
      t = p.life / p.max;
      var damp = Math.exp(-1.9 * dt);
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      var sz = p.r * (1 + (p.grow - 1) * (1 - (1 - t) * (1 - t))) * 2;
      ctx.globalAlpha = p.a * Math.sin(Math.PI * Math.pow(t, 0.55)) ;
      ctx.drawImage(smk, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }

    /* искры (аддитивно, с короткими следами) */
    ctx.globalCompositeOperation = 'lighter';
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      if (p.k !== 's') continue;
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      t = p.life / p.max;
      var dm = Math.exp(-p.drag * dt);
      p.vx *= dm; p.vy = p.vy * dm + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      var tw = 0.6 + 0.4 * Math.sin(clock * p.tf + p.ph);
      var a0 = (1 - t) * (1 - t * 0.3) * tw;
      var sr = p.r * (1 - t * 0.5) * 5.4;
      var j;
      for (j = 0; j < 3; j++) {
        var back = j * 0.028;
        var k2 = 1 - j * 0.28;
        var ss = sr * k2;
        ctx.globalAlpha = Math.max(0, a0 * (1 - j * 0.32));
        ctx.drawImage(p.sp, p.x - p.vx * back - ss / 2, p.y - p.vy * back - ss / 2, ss, ss);
      }
    }

    /* вспышки */
    for (i = flashes.length - 1; i >= 0; i--) {
      p = flashes[i];
      p.t += dt;
      if (p.t >= p.dur) { flashes.splice(i, 1); continue; }
      t = p.t / p.dur;
      var fr = p.r0 + (p.r1 - p.r0) * (1 - (1 - t) * (1 - t));
      ctx.globalAlpha = p.a * (1 - ease(t));
      ctx.drawImage(p.sp, p.x - fr, p.y - fr, fr * 2, fr * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function loopNeeded() {
    return (running && !o.reduce) || parts.length > 0 || flashes.length > 0;
  }

  function frame(ts) {
    raf = 0;
    if (destroyed) return;
    safe(function () {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      render(dt);
    });
    if (loopNeeded()) {
      raf = window.requestAnimationFrame(frame);
    } else {
      last = 0;
      /* нечего анимировать: в reduce оставляем статику, иначе чистим холст */
      if (!running && ctx && W) ctx.clearRect(0, 0, W, H);
    }
  }

  function schedule() {
    if (destroyed || raf) return;
    if (!ctx) resize();
    if (!ctx) return;
    if (loopNeeded()) raf = window.requestAnimationFrame(frame);
    else render(0);
  }

  var api = {
    start: function () {
      safe(function () {
        if (destroyed) return;
        running = true;
        if (!ctx) resize();
        schedule();
      });
    },
    stop: function () {
      safe(function () {
        running = false;
        embers.length = 0;
        /* если идёт burst, цикл сам доиграет и остановится */
        if (!loopNeeded()) {
          if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
          last = 0;
          if (ctx && W) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
        }
      });
    },
    burst: burst,
    setOpts: function (n) {
      safe(function () {
        if (!n) return;
        var wasReduce = o.reduce;
        if (n.reduce !== undefined) o.reduce = !!n.reduce;
        if (n.light !== undefined) o.light = n.light;
        if (n.floorY !== undefined) o.floorY = n.floorY;
        if (wasReduce !== o.reduce) {
          parts.length = 0; flashes.length = 0; embers.length = 0;
        }
        if (running) schedule();
      });
    },
    destroy: function () {
      safe(function () {
        destroyed = true; running = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        if (ro) { ro.disconnect(); ro = null; }
        if (onWin) { window.removeEventListener('resize', onWin); onWin = null; }
        parts.length = 0; flashes.length = 0; embers.length = 0; dust.length = 0;
        if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
      });
    }
  };

  safe(function () {
    if (opts) api.setOpts(opts);
    if (typeof window.ResizeObserver === 'function') {
      ro = new window.ResizeObserver(function () { resize(); });
      ro.observe(canvas);
    } else {
      onWin = function () { resize(); };
      window.addEventListener('resize', onWin);
    }
    resize();
  });

  return api;
};
