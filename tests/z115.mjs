import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
for (const [w,h] of [[360,780],[390,844],[412,915]]) {
  const p = await br.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:3, isMobile:true, hasTouch:true })
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  // имитация крупного системного шрифта: только текст +15 %, картинки и vh не трогаем
  await p.addStyleTag({content:'#hlw-wrap .hlw-dtitle,#hlw-wrap .hlw-dtext,#hlw-wrap .hlw-btn,#hlw-wrap .hlw-code,#hlw-wrap .hlw-copy{font-size:calc(1.15em)!important}'})
  for (let i=0;i<6;i++){ await p.locator('.hlw-item').nth(i).click(); await p.waitForSelector('.hlw-overlay.is-visible'); if(await p.locator('#hlw-win.is-visible').count()) break; await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
  await p.waitForTimeout(450)
  const r = await p.evaluate(()=>{const d=document.querySelector('#hlw-win .hlw-dialog').getBoundingClientRect();return {dh:Math.round(d.height),vh:innerHeight}})
  await p.screenshot({path:`screens-dev/z115-${w}.png`})
  console.log(w, 'попап', r.dh, 'экран', r.vh, r.dh>r.vh-20 ? 'не влезает на '+(r.dh-r.vh+20)+'px' : 'влезает')
  await p.close()
}
await br.close()
