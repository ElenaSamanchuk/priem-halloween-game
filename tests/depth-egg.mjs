import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: m, hasTouch: m })
  const errs = []; p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(1200)
  if (!m) {
    await p.mouse.move(80, 120); await p.waitForTimeout(1500); await p.screenshot({ path: 'screens-dev/depth-tl.png' })
    await p.mouse.move(w - 80, h - 120); await p.waitForTimeout(1500); await p.screenshot({ path: 'screens-dev/depth-br.png' })
    const tr = await p.evaluate(() => [document.querySelector('.hlw-front').style.transform, document.querySelector('.hlw-scene__bg').style.transform])
    console.log('transforms', tr)
  }
  await p.locator('.hlw-egg').click(); await p.waitForTimeout(800)
  await p.screenshot({ path: `screens-dev/egg-${w}.png` })
  console.log(w, 'errors', errs.length)
  await p.close()
}
await br.close()
