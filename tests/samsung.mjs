// Samsung (реальный Chrome через adb + CDP): реальные тапы adb input tap, скрины с устройства
import { chromium } from 'playwright'
import { execSync } from 'child_process'
const OUT = new URL('../screens-dev/devices/', import.meta.url).pathname
const adb = (c) => execSync('adb -s RZCY71AGDWW ' + c).toString()
const URL_ = 'https://elenasamanchuk.github.io/priem-halloween-game/dist/preview.html?qa=samsung-' + Date.now()
execSync(`adb -s RZCY71AGDWW shell am start -a android.intent.action.VIEW -d "${URL_}" com.android.chrome`); await new Promise(r => setTimeout(r, 8000))
const br = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 90000 })
const p = br.contexts()[0].pages().find(x => x.url().includes('qa=samsung-'))
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.waitForSelector('#hlw-wrap[data-hlw-ready]', { timeout: 20000 }); await p.waitForTimeout(2500)
const info = await p.evaluate(() => ({ vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, hs: document.documentElement.scrollWidth - innerWidth, avif: !!document.querySelector('.hlw-scene__bg').currentSrc.match(/avif/), img: document.querySelector('.hlw-scene__bg').currentSrc.split('/').pop() }))
console.log('экран', JSON.stringify(info))
const shot = async (n) => { await p.screenshot({ path: OUT + 'samsung-' + n + '.png' }); console.log('SHOT', n) }
await shot('1-scene')
// пересчёт CSS-координат в экранные: смещение панели Chrome сверху
const dpr = info.dpr
const top = Number(adb("shell dumpsys window | grep -m1 'mStableInsets\\|mContentInsets' || true").match(/\[\d+,(\d+)\]/)?.[1] || 0)
async function tapEl(sel, i = 0) {
  const r = await p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }, [sel, i])
  await p.waitForTimeout(400)
  const r2 = await p.evaluate(([s, i]) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }, [sel, i])
  const chromeTop = await p.evaluate(() => (screen.height - innerHeight) * 0) // Chrome не раскрывает высоту панели — берём из скрина ниже
  return r2
}
const TOP = Number(process.env.TOP || 272) // низ панели Chrome на S25, device px
const tap = async (x, y) => { adb(`shell input tap ${Math.round(x * dpr)} ${Math.round(TOP + y * dpr)}`) }
const n = await p.locator('.hlw-item').count(); let won = false, k = 0
for (let i = 0; i < n && !won; i++) {
  const c = await tapEl('.hlw-item', i); await tap(c.x, c.y); k++
  try { await p.waitForSelector('.hlw-overlay.is-visible', { timeout: 4000 }) } catch (e) { console.log('ТАП НЕ СРАБОТАЛ по предмету', i, c); await shot('fail-' + i); continue }
  won = !!(await p.locator('#hlw-win.is-visible').count())
  await p.waitForTimeout(700)
  if (!won) { if (i === 0) await shot('2-miss'); const b = await tapEl('#hlw-miss .hlw-btn'); await tap(b.x, b.y); await p.waitForTimeout(600) }
}
console.log('победа', won, 'за', k, 'тапов')
await p.waitForTimeout(1500); await shot('3-win')
// копирование и шеринг
const cp = await tapEl('#hlw-win .hlw-copy'); await tap(cp.x, cp.y); await p.waitForTimeout(500)
console.log('подсказка «Скопировано»', await p.locator('#hlw-win .hlw-tip.is-on').count() === 1)
await shot('4-copied')
const sh = await tapEl('#hlw-share'); await tap(sh.x, sh.y); await p.waitForTimeout(2500)
execSync('adb -s RZCY71AGDWW exec-out screencap -p > ' + OUT + 'samsung-5-share-sheet.png'); console.log('SHOT 5-share-sheet (системное меню)')
adb('shell input keyevent KEYCODE_BACK'); await p.waitForTimeout(1200)
const cl = await tapEl('#hlw-win .hlw-close'); await tap(cl.x, cl.y); await p.waitForTimeout(1200)
await p.evaluate(() => document.getElementById('halloween-game').scrollIntoView()); await p.waitForTimeout(800); await shot('6-after')
console.log('ошибки консоли', errs)
await br.close()
