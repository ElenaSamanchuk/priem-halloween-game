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
ok(errors.length === 0, 'ошибок консоли: ' + errors.length + (errors.length ? ' ' + errors.join('|') : ''))
await browser.close()
process.exit(fail ? 1 : 0)
