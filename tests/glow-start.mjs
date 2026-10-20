import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
// опрос прозрачности свечения каждого предмета 3 с: ищем скачки больше 0.15 за кадр
const jumps = await p.evaluate(() => new Promise(res => { const imgs = [...document.querySelectorAll('.hlw-item__img')]; const last = imgs.map(i => +getComputedStyle(i).opacity); let max = 0, n = 0
  const t0 = performance.now(); (function f() { imgs.forEach((im, k) => { const o = +getComputedStyle(im).opacity; max = Math.max(max, Math.abs(o - last[k])); last[k] = o }); n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res({ max: +max.toFixed(3), frames: n }) })() }))
console.log('макс. скачок прозрачности за кадр:', JSON.stringify(jumps)); await br.close()
