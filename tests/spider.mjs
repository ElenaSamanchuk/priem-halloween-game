import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: m, hasTouch: m })
  const errs = []; p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('.hlw-spider.is-down', { timeout: 12000, state: 'attached' })
  await p.evaluate(() => document.getAnimations().forEach(a => { if (a.animationName === 'hlw-sp-down') { a.pause(); a.currentTime = 3500 } }))
  await p.waitForTimeout(200); await p.screenshot({ path: `screens-dev/spider-${w}.png`, clip: m ? { x: 0, y: 0, width: w, height: 420 } : { x: 300, y: 0, width: 840, height: 520 } })
  console.log(w, 'ошибки', errs.length); await p.close()
}
await br.close()
