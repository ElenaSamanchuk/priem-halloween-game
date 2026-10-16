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
  var ambNodes = [];      // источники фона, чтобы остановить
  var ambTimer = null;
  var stopTimer = null;
  var MASTER = 0.16;

  function ensureCtx() {
    if (ctx) { return ctx; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return null; }
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 8;
      comp.attack.value = 0.005; comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = 3.2; bus.connect(master);
      ambGain = ctx.createGain(); ambGain.gain.value = 1; ambGain.connect(master);
      // «пещерная» реверберация из затухающего шума
      try {
        var len = Math.floor(ctx.sampleRate * 1.6);
        var ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var c = 0; c < 2; c++) {
          var d = ir.getChannelData(c);
          for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
        }
        reverb = ctx.createConvolver(); reverb.buffer = ir;
        reverbSend = ctx.createGain(); reverbSend.gain.value = 0.28;
        reverbSend.connect(reverb); reverb.connect(master);
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
    }
  };

  // фоновая атмосфера: гул + ветер
  function startAmbient() {
    stopAmbient();
    var t = ctx.currentTime;
    var layers = [
      { kind: 'brown', f: 220, lfoF: 0.06, lfoD: 90, vol: 1.0 },
      { kind: 'pink', f: 500, lfoF: 0.09, lfoD: 220, vol: 0.28 }
    ];
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuffer(6, L.kind); s.loop = true;
      f.type = 'lowpass'; f.frequency.value = L.f; f.Q.value = 0.7;
      g.gain.value = L.vol;
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = L.lfoF; lg.gain.value = L.lfoD;
      lfo.connect(lg); lg.connect(f.frequency);
      s.connect(f); f.connect(g); g.connect(ambGain);
      s.start(t); lfo.start(t);
      ambNodes.push(s, lfo);
    }
    scheduleOdd();
  }

  function stopAmbient() {
    if (ambTimer) { clearTimeout(ambTimer); ambTimer = null; }
    for (var i = 0; i < ambNodes.length; i++) {
      try { ambNodes[i].stop(); } catch (e) {}
    }
    ambNodes = [];
  }

  // редкий далёкий скрип или капля
  function scheduleOdd() {
    ambTimer = setTimeout(function () {
      try {
        if (on && !paused && ctx && ctx.state === 'running') {
          var t = ctx.currentTime + 0.02;
          if (Math.random() < 0.5) {
            // скрип половицы
            var f0 = 140 + Math.random() * 80;
            var o = tone('sawtooth', f0, f0 * 0.7, t, 0.5, 0.05, ambGain);
            var fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 400; fl.Q.value = 5;
            o.disconnect();
            var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.18, t + 0.15);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            o.connect(fl); fl.connect(g); g.connect(ambGain);
          } else {
            // капля
            var fr = 900 + Math.random() * 500;
            var og = ctx.createGain();
            og.connect(ambGain);
            tone('sine', fr, fr * 0.5, t, 0.18, 0.2, og);
            if (reverbSend) { og.connect(reverbSend); }
          }
        }
      } catch (e) {}
      if (on) { scheduleOdd(); }
    }, 7000 + Math.random() * 8000);
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
          if (ambTimer) { clearTimeout(ambTimer); ambTimer = null; }
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
        if (on && ctx) { ramp(0, 0.3); }
      } catch (e) {}
    },
    resume: function () {
      try {
        paused = false;
        if (on && ctx) { wake(); ramp(MASTER, 0.6); }
      } catch (e) {}
    }
  };
  return api;
})();
