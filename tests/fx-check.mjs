import { chromium } from 'playwright'
import fs from 'fs'
const SRC = fs.readFileSync(new URL('../src/fx.js', import.meta.url), 'utf8')
const SHOTS = new URL('../screens-dev/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let fail = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++ }

try { new Function('(function(){' + SRC + '\nreturn HlwFx})()'); ok(true, 'синтаксис new Function') } catch (e) { ok(false, 'синтаксис: ' + e.message) }
ok(!/=>|\blet\b|\bconst\b|`|\bclass\b/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), 'ES5: нет стрелок/let/const/шаблонов/class')

const html = `<!doctype html><body style="margin:0;background:#0b0705">
<div id="s" style="position:relative;width:900px;height:500px;background:radial-gradient(circle at 70% 55%,#a8531a 0,#4a2410 18%,#150b07 55%,#0b0705 100%)">
<canvas id="c" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
<script>${SRC}</script>`

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell' })
const page = await browser.newPage({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.setContent(html)
await page.evaluate(() => { window.fx = HlwFx(document.getElementById('c'), { light: { x: 0.7, y: 0.55 }, floorY: 0.7 }); fx.start() })
await page.waitForTimeout(1000)
await page.screenshot({ path: SHOTS + 'fx-ambient.png' })
await page.evaluate(() => fx.burst(450, 250, 'smoke'))
await page.waitForTimeout(380)
await page.screenshot({ path: SHOTS + 'fx-smoke.png' })
await page.waitForTimeout(1000)
await page.evaluate(() => fx.burst(450, 250, 'gold'))
await page.waitForTimeout(500)
await page.screenshot({ path: SHOTS + 'fx-gold.png' })
// остановка: после stop и доигрывания rAF не должен держаться
await page.evaluate(() => fx.stop())
await page.waitForTimeout(1800)
const idle = await page.evaluate(() => {
  const c = document.getElementById('c'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s
})
ok(idle === 0, 'после stop холст пуст')
// reduce
await page.evaluate(() => { fx.setOpts({ reduce: true }); fx.start(); fx.burst(450, 250, 'gold') })
await page.waitForTimeout(150)
await page.screenshot({ path: SHOTS + 'fx-reduce.png' })
await page.evaluate(() => fx.destroy())
ok(errors.length === 0, 'ошибок консоли: ' + errors.length + ' ' + errors.join(' | '))
await browser.close()
process.exit(fail ? 1 : 0)
