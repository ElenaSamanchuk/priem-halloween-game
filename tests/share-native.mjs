import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
const p = await br.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' })
await p.addInitScript(() => { window.__sh = []; navigator.share = (d) => { window.__sh.push({ keys: Object.keys(d), text: d.text, url: d.url, files: d.files ? d.files.length : 0 }); return Promise.resolve() }; navigator.canShare = () => true })
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
await p.addStyleTag({ content: '#hlw-wrap .hlw-item{animation:none!important}' })
for (let i = 0; i < 6; i++) { const b = await p.locator('.hlw-item').nth(i).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.waitForSelector('.hlw-overlay.is-visible'); if (await p.locator('#hlw-win.is-visible').count()) break; await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
await p.waitForTimeout(1500); await p.locator('#hlw-share').click(); await p.waitForTimeout(300)
console.log(JSON.stringify(await p.evaluate(() => window.__sh)))
await br.close()
