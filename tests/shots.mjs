import { chromium } from 'playwright'
const B = process.env.BASE || 'http://localhost:8765'
const OUT = new URL('../screens-dev/', import.meta.url).pathname
const exe = process.env.CHROME || '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const browser = await chromium.launch({ executablePath: exe })
const vps = (process.env.VPS || '1440x900,390x844').split(',')
for (const v of vps) {
  const [w, h] = v.split('x').map(Number)
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 3 : 1, hasTouch: w < 800, isMobile: w < 800 })
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await p.goto(B + '/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await p.locator('#halloween-game').scrollIntoViewIfNeeded(); await p.evaluate(() => 0); await p.waitForTimeout(1500)
  await p.screenshot({ path: `${OUT}${w}-a-scene.png` })
  // промах: кликаем первый не-победитель
  const n = await p.locator('.hlw-item').count()
  let missShot = false
  for (let i = 0; i < n; i++) {
    await p.locator('.hlw-item').nth(i).click(); await p.waitForTimeout(250)
    if (!missShot) await p.screenshot({ path: `${OUT}${w}-b-click.png` })
    await p.waitForTimeout(900)
    if (await p.locator('#hlw-win.is-visible').count()) { await p.screenshot({ path: `${OUT}${w}-d-win.png` }); break }
    if (!missShot) { await p.screenshot({ path: `${OUT}${w}-c-miss.png` }); missShot = true }
    await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  }
  await p.keyboard.press('Escape'); await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}${w}-e-after.png`, fullPage: false })
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(v, 'errors:', errs.length ? errs : 0, 'hscroll:', sw)
  await ctx.close()
}
await browser.close()
