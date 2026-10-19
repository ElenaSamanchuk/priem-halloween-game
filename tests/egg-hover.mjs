import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(800)
const b = await p.locator('.hlw-egg').boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(1300)
await p.screenshot({ path: 'screens-dev/egg-hover.png', clip: { x: b.x - 160, y: b.y - 120, width: b.width + 320, height: b.height + 200 } })
const tr = await p.evaluate(() => document.querySelector('.hlw-front').style.transform)
console.log('сдвиг кухни у правого-нижнего края:', tr)
await br.close()
