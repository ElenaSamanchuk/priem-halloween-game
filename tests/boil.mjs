import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  for (let run = 0; run < 6; run++) {
    const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: m, hasTouch: m })
    const errs = []; p.on('pageerror', e => errs.push(String(e)))
    await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
    await p.addStyleTag({ content: '#hlw-wrap .hlw-item:not(.is-boil){animation:none!important}' })
    const c = p.locator('.hlw-item[data-id="cauldron"]'); const b = await c.boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2
    await p.mouse.click(cx, cy); await p.waitForSelector('.hlw-overlay.is-visible')
    if (await p.locator('#hlw-win.is-visible').count()) { await p.close(); continue }
    await p.keyboard.press('Escape'); await p.waitForTimeout(500)
    for (let i = 0; i < 4; i++) await p.mouse.click(cx, cy)
    await p.waitForTimeout(900)
    const jet = await p.evaluate(() => document.querySelector('.hlw-steam').classList.contains('is-jet'))
    const pop = await p.locator('.hlw-overlay.is-visible').count()
    await p.screenshot({ path: `screens-dev/boil-${w}.png`, clip: m ? { x: 0, y: 0, width: w, height: 420 } : { x: b.x - 200, y: b.y - b.height * 2.6, width: b.width + 400, height: b.height * 3.7 } })
    console.log(w, 'струя пара', jet, '| попап не открылся', pop === 0, '| ошибки', errs.length)
    await p.close(); break
  }
}
await br.close()
