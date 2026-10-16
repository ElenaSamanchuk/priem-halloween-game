import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] })
for (const mute of [false, true]) for (const run of [1, 2]) {
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(1500)
  if (mute) await p.locator('.hlw-sound').click()
  await p.evaluate(() => { window.__w = 0; let l = performance.now(); (function f(t) { window.__w = Math.max(window.__w, t - l); l = t; requestAnimationFrame(f) })(l) })
  const t0 = Date.now(); await p.locator('.hlw-item').nth(3).click(); const clickMs = Date.now() - t0
  await p.waitForTimeout(1500)
  console.log(mute ? 'звук выкл' : 'звук вкл ', 'run', run, '| худший кадр', Math.round(await p.evaluate(() => window.__w)), 'мс | клик', clickMs, 'мс')
  await p.close()
}
await br.close()
