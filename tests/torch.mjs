import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
const c = await p.context().newCDPSession(p); await c.send('Performance.enable')
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]'); await p.waitForTimeout(1000)
await p.mouse.move(560, 300); await p.waitForTimeout(700); await p.screenshot({ path: 'screens-dev/torch-1440.png' })
const g = async () => (await c.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {})
const a = await g(); const t0 = Date.now()
for (let i = 0; i < 120; i++) { await p.mouse.move(400 + (i * 7) % 600, 200 + (i * 5) % 300) }
const b = await g(); const sec = (Date.now() - t0) / 1000
console.log('движение мыши 120 шагов:', sec.toFixed(1), 'с | CPU', ((b.TaskDuration - a.TaskDuration) / sec * 100).toFixed(1) + '% | layout', (b.LayoutCount - a.LayoutCount), '| style', (b.RecalcStyleCount - a.RecalcStyleCount))
await br.close()
