import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(1000)
await p.addStyleTag({ content: '#hlw-wrap .hlw-torch,#hlw-wrap .hlw-fx,#hlw-wrap .hlw-fog,#hlw-wrap .hlw-ghost{display:none!important}' })
const k = await p.locator('.hlw-klayer').boundingBox()
await p.screenshot({ path: 'screens-dev/seam-rest.png', clip: { x: k.x + k.width - 260, y: k.y + k.height - 330, width: 380, height: 360 } })
await br.close()
