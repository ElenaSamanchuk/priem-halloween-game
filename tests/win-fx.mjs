import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
await p.addStyleTag({ content: '#hlw-wrap .hlw-item:not(.is-found){animation:none!important}' })
const n = await p.locator('.hlw-item').count()
for (let i = 0; i < n; i++) {
  const b = await p.locator('.hlw-item').nth(i).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await p.waitForTimeout(80)
  if (await p.locator('.hlw-item.is-found').count()) { await p.waitForTimeout(650); console.log('мышей в стае:', await p.evaluate(() => document.querySelectorAll('.hlw-flock .hlw-bat').length)); await p.screenshot({ path: 'screens-dev/win-flock.png' }); break }
  await p.waitForTimeout(370)
  await p.waitForSelector('.hlw-overlay.is-visible'); await p.keyboard.press('Escape'); await p.waitForTimeout(450)
}
await p.waitForSelector('#hlw-win.is-visible'); await p.waitForTimeout(1300); await p.screenshot({ path: 'screens-dev/win-promo.png' })
console.log('ошибки', errs.length)
await br.close()
