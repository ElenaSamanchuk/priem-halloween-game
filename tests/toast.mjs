import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: m, hasTouch: m })
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await p.addStyleTag({ content: '#hlw-wrap .hlw-item{animation:none!important}' })
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  for (let i = 0; i < 6; i++) { const b = await p.locator('.hlw-item').nth(i).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.waitForSelector('.hlw-overlay.is-visible'); if (await p.locator('#hlw-win.is-visible').count()) break; await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
  await p.keyboard.press('Escape'); await p.waitForTimeout(700)
  await p.locator('#hlw-bar [data-hlw-order]').click(); await p.waitForTimeout(500)
  await p.evaluate(() => scrollTo(0, document.getElementById('hlw-bar').getBoundingClientRect().top + scrollY - innerHeight * 0.6)); await p.waitForTimeout(300)
  await p.screenshot({ path: `screens-dev/toast-${w}.png` }); console.log(w, 'ok'); await p.close()
}
await br.close()
