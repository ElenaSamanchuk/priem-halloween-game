/* Звук игры «найди ПриЕм»: всё синтезом Web Audio, без файлов. Фрагмент внутри общей IIFE. */
var HlwSound = (function () {
  var ctx = null;
  var master = null;      // общая громкость + лимитер
  var bus = null;         // шина эффектов
  var ambGain = null;     // громкость фона
  var reverb = null;
  var reverbSend = null;
  var on = false;
  var paused = false;
  var ambRev = null;
  var stopTimer = null;
  var MASTER = 0.16;

  function ensureCtx(forced) {
    if (ctx) { return ctx; }
    try {
      if (forced) { ctx = forced; }
      else {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return null; }
        ctx = new AC();
      }
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 8;
      comp.attack.value = 0.005; comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 3.2; bus.connect(master);
      // фон: тише эффектов, срез верха ~5 кГц
      ambGain = ctx.createGain(); ambGain.gain.value = 0.5;
      var ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 5000; ambLP.Q.value = 0.5;
      ambGain.connect(ambLP); ambLP.connect(master);
      // «пещерная» реверберация: шина создаётся сразу, тяжёлый импульс — на следующем кадре, чтобы клик не тормозил
      try {
        reverbSend = ctx.createGain(); reverbSend.gain.value = 0.28;
        ambRev = ctx.createGain(); ambRev.gain.value = 0.9; ambLP.connect(ambRev); ambRev.connect(reverbSend);
        var rctx = ctx;
        setTimeout(function () {
          try {
            var len = Math.floor(rctx.sampleRate * 1.6);
            var ir = rctx.createBuffer(2, len, rctx.sampleRate);
            for (var c = 0; c < 2; c++) {
              var d = ir.getChannelData(c);
              for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
            }
            reverb = rctx.createConvolver(); reverb.buffer = ir;
            reverbSend.connect(reverb); reverb.connect(master);
          } catch (e2) { reverb = null; }
        }, 700);
      } catch (e1) { reverb = null; reverbSend = null; }
      // разблокировка iOS тихим буфером
      var ub = ctx.createBuffer(1, 1, 22050), us = ctx.createBufferSource();
      us.buffer = ub; us.connect(ctx.destination); us.start(0);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function wake() {
    try {
      if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
        var p = ctx.resume();
        if (p && p.catch) { p.catch(function () {}); }
      }
    } catch (e) {}
  }

  function noiseBuffer(sec, kind) {
    var n = Math.floor(ctx.sampleRate * sec);
    var b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0), last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else { d[i] = w; }
    }
    return b;
  }

  // выход эффекта: в шину и немного в реверберацию
  function out(node) {
    node.connect(bus);
    if (reverbSend) { node.connect(reverbSend); }
  }

  // тон с огибающей; f2 — конечная частота (глиссандо)
  function tone(type, f1, f2, t0, dur, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    if (f2 && f2 !== f1) { o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    if (dest) { g.connect(dest); } else { out(g); }
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  // шумовой всплеск через фильтр; f1→f2 — движение частоты
  function noiseBurst(t0, dur, type, f1, f2, q, vol, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuffer(dur + 0.05, 'white');
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t0);
    f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g);
    if (dest) { g.connect(dest); } else { out(g); }
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  var fx = {
    miss: function (t) {
      // вой призрака: синус с вибрато, вниз ~0.8 с
      var o = tone('sine', 520, 150, t, 0.85, 0.5);
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 7; lg.gain.value = 18;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + 0.9);
      tone('sine', 1040, 300, t, 0.8, 0.12);
      // лёгкий скрип
      noiseBurst(t + 0.05, 0.5, 'bandpass', 900, 420, 9, 0.12);
    },
    win: function (t) {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
      for (var i = 0; i < notes.length; i++) {
        var st = t + i * 0.09;
        tone('triangle', notes[i], 0, st, 0.9, 0.3);
        tone('sine', notes[i] * 2, 0, st, 0.5, 0.08);
      }
      // мерцающий блеск
      noiseBurst(t + 0.1, 0.9, 'highpass', 6000, 9000, 1, 0.07);
      noiseBurst(t + 0.45, 0.8, 'highpass', 7000, 10000, 1, 0.05);
    },
    open: function (t) { noiseBurst(t, 0.25, 'bandpass', 400, 2200, 1.2, 0.25); },
    close: function (t) { noiseBurst(t, 0.15, 'bandpass', 1800, 450, 1.2, 0.12); },
    copy: function (t) {
      tone('square', 1900, 1700, t, 0.04, 0.1);
      tone('square', 2400, 2200, t + 0.07, 0.04, 0.1);
    },
    tap: function (t) {
      tone('sine', 220, 120, t, 0.1, 0.5);
      noiseBurst(t, 0.03, 'bandpass', 1400, 900, 2, 0.15);
    },
    thunder: function (t) {
      // далёкий гром: короткий треск и длинный низкий раскат
      noiseBurst(t, 0.18, 'bandpass', 2600, 700, 0.7, 0.08);
      noiseBurst(t + 0.08, 2.6, 'lowpass', 260, 45, 0.6, 0.55);
      noiseBurst(t + 0.5, 1.8, 'lowpass', 180, 40, 0.5, 0.35);
    },
    drip: function (t) {
      // «кап»: короткий синус вниз + эхо пещеры (через общий реверб)
      tone('sine', 1500, 620, t, 0.14, 0.22);
      tone('sine', 2300, 1400, t + 0.01, 0.06, 0.06);
    },
    wink: function (t) {
      // тыква подмигнула: два мягких «дзинь» и смешок вверх
      tone('triangle', 988, 988, t, 0.25, 0.14);
      tone('triangle', 1319, 1319, t + 0.16, 0.3, 0.12);
      tone('sine', 440, 880, t + 0.32, 0.25, 0.1);
    },
    hint: function (t) {
      // тихое «тиньк» подсказки
      tone('sine', 1568, 1568, t, 0.6, 0.12);
      tone('sine', 2093, 2093, t + 0.12, 0.7, 0.09);
    }
  };

  // ---- Фон: музыкальная шкатулка, ре минор, 3/4, ~80 bpm, 12 тактов по кругу ----
  var BEAT = 60 / 80;
  var BAR = BEAT * 3;
  // мелодия: 6 восьмых на такт (MIDI, 0 = пауза)
  var MEL = [
    [74, 77, 81, 77, 74, 0], [77, 81, 79, 77, 76, 0], [74, 79, 77, 74, 70, 0], [73, 76, 81, 76, 73, 69],
    [81, 79, 77, 74, 77, 81], [77, 72, 77, 81, 77, 72], [82, 79, 77, 74, 70, 74], [76, 73, 76, 81, 79, 76],
    [79, 74, 70, 74, 79, 82], [81, 77, 74, 77, 81, 77], [79, 76, 73, 76, 79, 76], [73, 76, 81, 76, 73, 0]
  ];
  var BASS = [50, 50, 43, 45, 50, 41, 46, 45, 43, 50, 45, 45];
  var barIdx = 0, loopIdx = 0, nextBar = 0, voices = 0, maxVoices = 12, sched = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // один «язычок» шкатулки: синус + 3-я и 5-я гармоники
  function boxNote(m, t, vol) {
    if (voices >= maxVoices) { return; }
    var f = mtof(m), dur = rnd(1.2, 2.0), det = rnd(-3, 3);
    var parts = [[1, 1, 1], [3, 0.12, 0.45], [5, 0.05, 0.25]];
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ambGain);
    var last = null;
    voices++;
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(), pg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * parts[i][0]; o.detune.value = det;
      pg.gain.setValueAtTime(parts[i][1], t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * parts[i][2]);
      o.connect(pg); pg.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
      last = o;
    }
    last.onended = function () { voices--; try { g.disconnect(); } catch (e) {} };
  }

  // тихое пиццикато баса
  function bassNote(m, t, vol) {
    if (voices >= maxVoices) { return; }
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(ambGain);
    voices++;
    o.onended = function () { voices--; try { g.disconnect(); } catch (e) {} };
    o.start(t); o.stop(t + 0.6);
  }

  // запланировать такт barIdx, начиная с t
  function scheduleBar(t) {
    var mel = MEL[barIdx], i;
    for (i = 0; i < 6; i++) {
      if (mel[i]) { boxNote(mel[i], t + i * BEAT / 2 + rnd(-0.008, 0.008), rnd(0.26, 0.4)); }
    }
    bassNote(BASS[barIdx], t, rnd(0.12, 0.17));
    bassNote(BASS[barIdx] + 7, t + BEAT * 2, rnd(0.05, 0.08));
    // колокольчик раз в 2 цикла в начале круга
    if (barIdx === 0 && loopIdx % 2 === 1) { boxNote(86, t + BEAT * 1.5, 0.22); }
    barIdx++;
    if (barIdx >= MEL.length) { barIdx = 0; loopIdx++; }
  }

  // lookahead: планируем всё, что попадает до until
  function schedule(until) {
    while (nextBar < until) {
      scheduleBar(nextBar);
      nextBar += BAR;
    }
  }

  function tick() {
    try {
      if (on && !paused && ctx) {
        schedule(ctx.currentTime + 0.3);
      }
    } catch (e) {}
    if (on && !paused) { sched = setTimeout(tick, 100); } else { sched = null; }
  }

  function startAmbient() {
    stopAmbient();
    barIdx = 0; loopIdx = 0;
    nextBar = ctx.currentTime + 0.15;
    tick();
  }

  function stopAmbient() {
    if (sched) { clearTimeout(sched); sched = null; }
  }

  function ramp(v, sec) {
    try {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(v, t + sec);
    } catch (e) {}
  }

  var api = {
    enable: function (v) {
      try {
        v = !!v;
        if (v === on) { return; }
        if (v) {
          if (!ensureCtx()) { return; }
          on = true;
          if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
          wake();
          startAmbient();
          ramp(paused ? 0 : MASTER, 1.5);
        } else {
          on = false;
          if (!ctx) { return; }
          ramp(0, 0.4);
          stopTimer = setTimeout(function () {
            stopTimer = null;
            if (!on) {
              stopAmbient();
              try { ctx.suspend(); } catch (e) {}
            }
          }, 450);
        }
      } catch (e) {}
    },
    isOn: function () { return on; },
    // служебное: сыграть фон в OfflineAudioContext (для превью/тестов)
    _offline: function (octx, sec) {
      try {
        if (!ensureCtx(octx)) { return; }
        master.gain.value = MASTER; maxVoices = 99999; barIdx = 0; loopIdx = 0; nextBar = 0.1;
        schedule(sec);
      } catch (e) {}
    },
    play: function (name) {
      try {
        if (!on || paused || !ctx || !fx[name]) { return; }
        wake();
        fx[name](ctx.currentTime + 0.01);
      } catch (e) {}
    },
    pause: function () {
      try {
        paused = true;
        stopAmbient();
        if (on && ctx) { ramp(0, 0.3); }
      } catch (e) {}
    },
    resume: function () {
      try {
        paused = false;
        if (on && ctx) {
          wake(); ramp(MASTER, 0.6);
          nextBar = ctx.currentTime + 0.15; // с начала такта
          if (!sched) { tick(); }
        }
      } catch (e) {}
    }
  };
  return api;
})();
