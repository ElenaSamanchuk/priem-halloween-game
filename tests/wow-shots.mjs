import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
const p = await br.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
// глаза: перематываем анимацию в фазу «открыты»
await p.evaluate(() => document.getAnimations().filter(a => a.animationName === 'hlw-eyes' || a.animationName === 'hlw-blink').forEach(a => { a.pause(); a.currentTime = a.effect.getTiming().duration * 0.74 }))
await p.waitForTimeout(300); await p.screenshot({ path: 'screens-dev/wow-eyes.png', clip: { x: 0, y: 100, width: 420, height: 420 } })
// молния
await p.evaluate(() => { const f = document.querySelector('.hlw-flash'); f.classList.add('is-on'); f.getAnimations().forEach(a => { a.pause(); a.currentTime = 70 }) })
await p.waitForTimeout(200); await p.screenshot({ path: 'screens-dev/wow-flash.png' })
await p.evaluate(() => document.querySelector('.hlw-flash').classList.remove('is-on'))
// подсказка: ждём 12 с без кликов
await p.waitForSelector('.hlw-item.is-hint', { timeout: 16000 }); await p.waitForTimeout(800)
await p.screenshot({ path: 'screens-dev/wow-hint.png' })
const hinted = await p.evaluate(() => document.querySelector('.hlw-item.is-hint').dataset.id)
// победа и тёплый свет
for (let i = 0; i < 6; i++) { await p.locator('.hlw-item').nth(i).click(); await p.waitForSelector('.hlw-overlay.is-visible'); if (await p.locator('#hlw-win.is-visible').count()) break; await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
await p.keyboard.press('Escape'); await p.waitForTimeout(2600)
await p.screenshot({ path: 'screens-dev/wow-win.png' })
console.log('подсказка на', hinted, '| ошибки', errs.length)
await br.close()
