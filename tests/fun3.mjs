import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:8765/preview.html?fixed'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
await p.waitForSelector('.hlw-drop', { timeout: 15000 }); await p.waitForTimeout(250)
await p.screenshot({ path: 'screens-dev/fun-drop.png' })
await p.waitForSelector('.hlw-splash', { timeout: 3000 }); await p.screenshot({ path: 'screens-dev/fun-splash.png' })
const c = await p.locator('.hlw-item[data-id="cauldron"]').boundingBox()
await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.waitForTimeout(1400)
await p.screenshot({ path: 'screens-dev/fun-steam.png', clip: { x: c.x - 120, y: c.y - c.height * 1.6, width: c.width + 240, height: c.height * 2.8 } })
// тыква: если это не победитель — открываем, затем тройной клик
const pk = p.locator('.hlw-item[data-id="pumpkin-lamp"]')
await p.addStyleTag({ content: '#hlw-wrap .hlw-item:not(.is-wink){animation:none!important}' })
await pk.click(); await p.waitForSelector('.hlw-overlay.is-visible')
const isWin = await p.locator('#hlw-win.is-visible').count()
if (isWin) { console.log('тыква оказалась победителем — подмигивание не проверить в этом прогоне') } else {
  await p.keyboard.press('Escape'); await p.waitForTimeout(500)
  const b = await pk.boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2
  await p.mouse.click(cx, cy); await p.mouse.click(cx, cy); await p.mouse.click(cx, cy); await p.waitForTimeout(130)
  await p.screenshot({ path: 'screens-dev/fun-wink.png', clip: { x: 300, y: 80, width: 520, height: 420 } })
  const winked = await p.evaluate(() => document.querySelector('.hlw-item[data-id="pumpkin-lamp"]').classList.contains('is-wink'))
  const popup = await p.locator('.hlw-overlay.is-visible').count()
  console.log('подмигнула', winked, '| попап не открылся', popup === 0)
  await p.waitForTimeout(1600); await p.mouse.click(cx, cy); await p.waitForTimeout(1200)
  console.log('одиночный клик по проверенной тыкве открыл попап', await p.locator('#hlw-miss.is-visible').count() === 1)
}
console.log('ошибки', errs.length)
await br.close()
