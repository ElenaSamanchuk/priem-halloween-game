import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
const variants = {
  'всё включено': '',
  'без CSS-анимаций': '#hlw-wrap *,#hlw-wrap *::before,#hlw-wrap *::after{animation:none!important}',
  'без canvas': '#hlw-wrap .hlw-fx{display:none!important}',
  'без тумана': '#hlw-wrap .hlw-fog{display:none!important}',
  'без лампы': '#hlw-wrap .hlw-lamp{display:none!important}',
  'без дыхания предметов': '#hlw-wrap .hlw-item__img{animation:none!important}',
}
for (const [name, css] of Object.entries(variants)) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true })
  const p = await ctx.newPage(); const c = await ctx.newCDPSession(p)
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await c.send('Performance.enable')
  if (name === 'без canvas') await p.addInitScript(() => { const o = window.requestAnimationFrame; window.__raf = o })
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  if (css) await p.addStyleTag({ content: css })
  await p.waitForTimeout(1500)
  const g = async () => (await c.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {})
  const a = await g(); await p.waitForTimeout(3000); const b = await g()
  console.log(name.padEnd(24), 'CPU', ((b.TaskDuration - a.TaskDuration) / 3 * 100).toFixed(1) + '%', 'layout', (b.LayoutDuration - a.LayoutDuration).toFixed(3), 'style', (b.RecalcStyleDuration - a.RecalcStyleDuration).toFixed(3))
  await ctx.close()
}
await br.close()
