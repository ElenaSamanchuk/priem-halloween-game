import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(800)
for (const id of ['cabinet-double', 'cabinet-single', 'pumpkin-lamp']) {
  const b = p.locator(`.hlw-item[data-id="${id}"]`); await b.hover(); await p.waitForTimeout(1900)
  const r = await b.boundingBox(); await p.screenshot({ path: `screens-dev/hover-${id}.png`, clip: { x: r.x - 30, y: r.y - 30, width: r.width + 60, height: r.height + 60 } })
}
await br.close()
