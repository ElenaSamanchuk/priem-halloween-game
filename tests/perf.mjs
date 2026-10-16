import { chromium, webkit } from 'playwright'
const B = process.env.BASE || 'http://localhost:8765'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
async function fps(page, ms = 3000) {
  return page.evaluate((ms) => new Promise((res) => { let n = 0, worst = 0, last = performance.now(); const t0 = last
    function f(t) { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res({ fps: Math.round(n / ((t - t0) / 1000)), worstFrameMs: Math.round(worst) }) }
    requestAnimationFrame(f) }), ms)
}
const br = await chromium.launch({ executablePath: exe })
for (const [label, vp, mob, cpu] of [['desk 1440', { width: 1440, height: 900 }, false, 1], ['phone 390, CPU×4', { width: 390, height: 844 }, true, 4]]) {
  const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: mob ? 3 : 1, isMobile: mob, hasTouch: mob })
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); await cdp.send('Performance.enable')
  const t0 = Date.now(); await p.goto(B + '/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await p.waitForLoadState('load'); const load = Date.now() - t0
  const idle = await fps(p)
  const m1 = (await cdp.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {})
  await p.waitForTimeout(3000)
  const m2 = (await cdp.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {})
  const cpuShare = ((m2.TaskDuration - m1.TaskDuration) / 3 * 100).toFixed(1)
  // во время дыма
  const it = p.locator('.hlw-item').nth(3); const fpsP = fps(p, 1200); await it.click(); const burst = await fpsP
  const heap = (m2.JSHeapUsedSize / 1048576).toFixed(1)
  console.log(label, '| загрузка', load, 'мс | фон', idle, '| во время эффекта', burst, '| CPU главного потока', cpuShare + '%', '| JS heap', heap, 'МБ')
  await ctx.close()
}
await br.close()
// WebKit (движок Safari)
const wk = await webkit.launch()
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await wk.newContext({ viewport: vp, isMobile: false }); const p = await ctx.newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(B + '/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]', { timeout: 8000 })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: new URL(`../screens-dev/webkit-${vp.width}.png`, import.meta.url).pathname })
  let won = false
  for (let i = 0; i < 6 && !won; i++) { await p.locator('.hlw-item').nth(i).click(); await p.waitForSelector('.hlw-overlay.is-visible'); won = !!(await p.locator('#hlw-win.is-visible').count()); if (!won) { await p.keyboard.press('Escape'); await p.waitForTimeout(400) } }
  await p.waitForTimeout(500); await p.screenshot({ path: new URL(`../screens-dev/webkit-${vp.width}-win.png`, import.meta.url).pathname })
  console.log('WebKit', vp.width, '| победа:', won, '| ошибки:', errs.length ? errs : 0)
  await ctx.close()
}
await wk.close()
