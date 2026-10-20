import { chromium } from 'playwright'
import fs from 'fs'
const src = fs.readFileSync(new URL('../src/sound.js', import.meta.url), 'utf8')
// синтаксис
new Function('(function(){' + src + '})')
let fail = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++ }

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('about:blank')
await page.setContent('<button id="b">go</button>')
await page.evaluate((code) => {
  (function () {
    var s = document.createElement('script')
    s.textContent = '(function(){' + code + '\nwindow.__s = HlwSound;})();'
    document.head.appendChild(s)
  })()
}, src)
ok(await page.evaluate(() => typeof window.__s === 'object' && typeof window.HlwSound === 'undefined'), 'модуль загружен, глобалей нет')
await page.evaluate(() => document.getElementById('b').addEventListener('click', () => window.__s.enable(true)))
await page.click('#b')
ok(await page.evaluate(() => window.__s.isOn()), 'enable(true) -> isOn')
await page.waitForTimeout(300)
const state = await page.evaluate(() => window.__s.play('tap') || 'called')
for (const n of ['miss', 'win', 'open', 'close', 'copy', 'tap', 'nope']) {
  await page.evaluate((n) => window.__s.play(n), n)
  await page.waitForTimeout(150)
}
await page.evaluate(() => { window.__s.pause(); window.__s.play('miss'); window.__s.resume() })
await page.waitForTimeout(600)
await page.evaluate(() => window.__s.enable(false))
ok(!(await page.evaluate(() => window.__s.isOn())), 'enable(false) -> выкл')
await page.waitForTimeout(700)
await page.evaluate(() => { window.__s.play('win'); window.__s.enable(true); window.__s.enable(false) })
await page.waitForTimeout(600)
// превью: каждый рендер на свежей странице (состояние модуля одноразовое)
const OUT = new URL('../screens-dev/sound-preview/', import.meta.url)
fs.mkdirSync(OUT, { recursive: true })
async function render(file, sec, what) {
  const pg = await browser.newPage()
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
  pg.on('pageerror', (e) => errors.push(String(e)))
  await pg.goto('about:blank')
  await pg.evaluate((code) => {
    var s = document.createElement('script')
    s.textContent = '(function(){' + code + '\nwindow.__s = HlwSound;})();'
    document.head.appendChild(s)
  }, src)
  const r = await pg.evaluate(async ([sec, what]) => {
    const sr = 44100
    const oc = new OfflineAudioContext(2, sr * sec, sr)
    window.__s._offline(oc, sec, what)
    const buf = await oc.startRendering()
    const L = buf.getChannelData(0), R = buf.getChannelData(1)
    let peak = 0, sq = 0
    const out = new Int16Array(L.length * 2)
    for (let i = 0; i < L.length; i++) {
      peak = Math.max(peak, Math.abs(L[i])); sq += L[i] * L[i]
      out[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767
      out[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767
    }
    const hdr = new DataView(new ArrayBuffer(44))
    const w = (o, t) => { for (let i = 0; i < t.length; i++) hdr.setUint8(o + i, t.charCodeAt(i)) }
    w(0, 'RIFF'); hdr.setUint32(4, 36 + out.length * 2, true); w(8, 'WAVEfmt ')
    hdr.setUint32(16, 16, true); hdr.setUint16(20, 1, true); hdr.setUint16(22, 2, true)
    hdr.setUint32(24, sr, true); hdr.setUint32(28, sr * 4, true); hdr.setUint16(32, 4, true); hdr.setUint16(34, 16, true)
    w(36, 'data'); hdr.setUint32(40, out.length * 2, true)
    const bytes = new Uint8Array(44 + out.length * 2)
    bytes.set(new Uint8Array(hdr.buffer), 0); bytes.set(new Uint8Array(out.buffer), 44)
    let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
    return { b64: btoa(bin), peak, rms: Math.sqrt(sq / L.length) }
  }, [sec, what])
  fs.writeFileSync(new URL(file, OUT), Buffer.from(r.b64, 'base64'))
  ok(r.peak > 0.005 && r.peak < 0.6, file + ': пик ' + r.peak.toFixed(3) + ', rms ' + r.rms.toFixed(4))
  await pg.close()
}
await render('Шкатулка 1 — как сейчас.wav', 20, 'musicbox')
await render('Шкатулка 2 — колыбельная.wav', 20, 'musicbox2')
await render('Шкатулка 3 — заводная.wav', 20, 'musicbox3')
await render('Капля — 6 раз подряд.wav', 10, [0, 1, 2, 3, 4, 5].map((i) => ['drip', 0.3 + i * 1.5]))
// переключение фона вживую
await page.evaluate(() => { window.__s.enable(true); ['musicbox3', 'musicbox2', 'musicbox', 'nope'].forEach((n) => window.__s.setAmbient(n)); window.__s.pause(); window.__s.setAmbient('musicbox3'); window.__s.resume(); window.__s.play('drip') })
await page.waitForTimeout(1500)
await page.evaluate(() => window.__s.enable(false))
await page.waitForTimeout(600)
ok(errors.length === 0, 'ошибок консоли: ' + errors.length + (errors.length ? ' ' + errors.join('|') : ''))
await browser.close()
process.exit(fail ? 1 : 0)
