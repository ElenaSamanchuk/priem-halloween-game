import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'http://localhost:8765'
const SHOTS = new URL('../screens-dev/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let fail = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++ }

async function run(page, label, vp, mobile) {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.waitForSelector('#hlw-wrap[data-hlw-ready]', { timeout: 8000 })
  // робот кликает только по «неподвижным» элементам: пульс подсказки и подъём на ховере в тесте выключаем
  await page.addStyleTag({ content: '#hlw-wrap .hlw-item{animation:none!important}' })
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'menu-plans-v2'; d.style.height = '1500px'; document.body.appendChild(d) })
  ok(true, `${label}: игра стартовала`)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(sw <= 0, `${label}: нет горизонтальной прокрутки страницы (${sw})`)
  // hit-area
  const hit = await page.evaluate(() => [...document.querySelectorAll('.hlw-item')].map((b) => { const r = b.getBoundingClientRect(); return Math.max(r.width, 44) >= 44 && Math.max(r.height, 44) >= 44 }).every(Boolean))
  ok(hit, `${label}: зоны нажатия >=44`)
  await page.locator('#halloween-game').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}${label}-1-scene.png` })
  const items = page.locator('.hlw-item')
  const n = await items.count()
  ok(n === 6, `${label}: 6 предметов`)
  const titles = [], pics = []; let clicks = 0, won = false
  for (let i = 0; i < n; i++) {
    await items.nth(i).click(); clicks++
    await page.waitForSelector('.hlw-overlay.is-visible', { timeout: 3000 })
    if (await page.locator('#hlw-win.is-visible').count()) {
      won = true
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${SHOTS}${label}-3-win.png` })
      break
    }
    await page.waitForTimeout(350)
    titles.push(await page.locator('#hlw-miss-title').textContent() + '|' + await page.locator('#hlw-miss-text').textContent())
    pics.push(await page.locator('#hlw-miss-img').getAttribute('data-src'))
    if (i === 0) {
      await page.screenshot({ path: `${SHOTS}${label}-2-miss.png` })
      const locked = await page.evaluate(() => document.documentElement.classList.contains('hlw-lock'))
      ok(locked, `${label}: скролл заблокирован`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(400)
      ok(!(await page.evaluate(() => document.documentElement.classList.contains('hlw-lock'))), `${label}: Esc закрыл, скролл разблокирован`)
      // повторный клик тот же текст
      await items.nth(0).click(); await page.waitForSelector('#hlw-miss.is-visible'); await page.waitForTimeout(350)
      const again = await page.locator('#hlw-miss-title').textContent() + '|' + await page.locator('#hlw-miss-text').textContent()
      ok(again === titles[0], `${label}: повторный клик показывает тот же текст`)
      // подложка
      await page.mouse.click(3, 3); await page.waitForTimeout(400)
      ok(await page.locator('#hlw-miss.is-visible').count() === 0, `${label}: подложка закрыла`)
      continue
    }
    await page.locator('#hlw-miss .hlw-btn').click(); await page.waitForTimeout(400)
  }
  ok(won, `${label}: победитель найден за ${clicks} кликов`)
  ok(new Set(titles).size === titles.length, `${label}: промахи без повторов (${titles.length})`)
  ok(new Set(pics).size === pics.length, `${label}: иллюстрации промахов без повторов (${pics.length})`)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.locator('#hlw-win .hlw-copy').click(); await page.waitForTimeout(200)
  ok((await page.evaluate(() => navigator.clipboard.readText())) === 'СТРАШНОВКУСНО', `${label}: копирование промокода`)
  ok((await page.locator('#hlw-win .hlw-tip.is-on').count()) === 1, `${label}: подсказка «Скопировано»`)
  await page.evaluate(() => navigator.clipboard.writeText('x'))
  await page.locator('#hlw-win .hlw-code').click(); await page.waitForTimeout(100)
  ok((await page.evaluate(() => navigator.clipboard.readText())) === 'СТРАШНОВКУСНО', `${label}: клик по коду копирует`)
  await page.context().grantPermissions(['clipboard-read','clipboard-write']); await page.evaluate(() => { window.__open = []; window.open = (u) => { window.__open.push(u); return null } }); await page.locator('#hlw-share').click(); await page.waitForTimeout(300); if (!mobile) { const u = await page.evaluate(() => window.__open[0] || ''); ok(u.startsWith('https://vk.com/share.php?url=https%3A%2F%2Fpriem.menu%2F%3Fcmz%3DYznM') && /image=/.test(u), label + ': ВК-шеринг с cmz и картинкой'); ok((await page.evaluate(() => navigator.clipboard.readText())).includes('cmz=YznM'), label + ': текст со ссылкой в буфере') }
  if (!mobile) await page.screenshot({ path: `${SHOTS}${label}-4-share.png` })
  const dis = await page.evaluate(() => [...document.querySelectorAll('.hlw-item')].every((b) => b.disabled))
  ok(dis, `${label}: после победы предметы disabled`)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  ok(await page.locator('#hlw-bar:not([hidden])').count() === 1, `${label}: плашка с промокодом есть`)
  await page.locator('#hlw-bar').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}${label}-5-bar.png` })
  // заказ -> скролл к якорю
  await page.locator('#hlw-bar [data-hlw-order]').click(); await page.waitForTimeout(1200)
  const top = await page.evaluate(() => document.getElementById('menu-plans-v2').getBoundingClientRect().top)
  ok(top > -2 && top < 20, `${label}: плавный скролл к #menu-plans-v2 (top=${Math.round(top)})`)
  ok(errors.length === 0, `${label}: нет ошибок консоли ${errors.join(' ; ')}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell' })
for (const [name, vp, mobile] of [['d', { width: 1280, height: 800 }, false], ['m', { width: 390, height: 844 }, true]]) {
  for (const pg of ['preview', 'priem-sim']) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await ctx.newPage()
    const label = `${pg}-${name}`
    await page.goto(`${BASE}/${pg}.html`)
    await run(page, label, vp, mobile)
    await ctx.close()
  }
}
// priem-sim: повторная вставка innerHTML
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)))
  await page.goto(`${BASE}/priem-sim.html?repatch=1`)
  await page.waitForSelector('#hlw-wrap[data-hlw-ready]')
  await page.waitForTimeout(2200)
  await page.waitForTimeout(800)
  ok(await page.locator('#hlw-wrap[data-hlw-ready]').count() === 1, 'sim: после повторного innerHTML игра переинициализирована')
  await page.locator('.hlw-item').first().click(); await page.waitForTimeout(1300)
  ok(await page.locator('.hlw-overlay.is-visible').count() === 1, 'sim: после repatch клик работает')
  ok(errs.length === 0, 'sim repatch: нет ошибок')
  await ctx.close()
}
await browser.close()
console.log(fail ? `ПРОВАЛОВ: ${fail}` : 'ВСЕ ПРОВЕРКИ ПРОШЛИ')
process.exit(fail ? 1 : 0)
