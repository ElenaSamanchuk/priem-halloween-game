import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 2, isMobile: m, hasTouch: m })
  const errs = []; p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await p.waitForSelector('.hlw-bat.is-fly', { timeout: 14000 })
  // ждём, пока мышь окажется над серединой сцены
  await p.waitForFunction(() => { const r = document.querySelector('.hlw-bat').getBoundingClientRect(); return r.left > innerWidth * 0.38 && r.left < innerWidth * 0.62 }, null, { timeout: 8000, polling: 16 })
  const r = await p.evaluate(() => { const r = document.querySelector('.hlw-bat').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  await p.screenshot({ path: `screens-dev/bat-${w}.png` })
  await p.screenshot({ path: `screens-dev/bat-zoom-${w}.png`, clip: { x: Math.max(0, r.x - 80), y: Math.max(0, r.y - 60), width: r.w + 160, height: r.h + 120 } })
  console.log(w, 'мышь', Math.round(r.w), 'px в точке', Math.round(r.x), Math.round(r.y), '| ошибки', errs.length)
  await p.close()
}
await br.close()
