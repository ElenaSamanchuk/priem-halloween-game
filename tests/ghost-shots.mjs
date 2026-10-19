import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: m, hasTouch: m })
  const errs = []; p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await p.waitForSelector('.hlw-ghost.is-peek', { timeout: 9000 }); await p.waitForTimeout(1600)
  await p.screenshot({ path: `screens-dev/ghost-peek-${w}.png` })
  for (let i = 0; i < 6; i++) { await p.locator('.hlw-item').nth(i).click(); await p.waitForSelector('.hlw-overlay.is-visible'); if (await p.locator('#hlw-win.is-visible').count()) break; await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500)
  await p.screenshot({ path: `screens-dev/ghost-win-${w}.png` })
  console.log(w, 'errors', errs.length)
  await p.close()
}
await br.close()
