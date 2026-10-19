import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe })
const sizes = [[320,693,1],[360,780,1],[390,844,1],[412,915,1],[768,1024,1],[844,390,1],[1024,768,0],[1280,800,0],[1440,900,0],[1920,1080,0],[2560,1440,0]]
for (const [w,h,mob] of sizes) for (const zoom of (w<=412 ? [1,1.15] : [1])) {
  const ctx = await br.newContext({ viewport:{width:w,height:h}, deviceScaleFactor: mob?3:1, isMobile:!!mob, hasTouch:!!mob })
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
  await p.goto('http://localhost:8765/preview.html'); await p.waitForSelector('#hlw-wrap[data-hlw-ready]')
  if (zoom!==1) await p.addStyleTag({content:`html{zoom:${zoom}}`})
  await p.waitForTimeout(800)
  const tag = `${w}x${h}${zoom!==1?'-z115':''}`
  const hs = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  const small = await p.evaluate(()=>[...document.querySelectorAll('.hlw-item')].map(b=>{const r=b.getBoundingClientRect();return Math.round(Math.min(r.width,r.height))}))
  const pill = await p.evaluate(()=>{const a=document.querySelector('.hlw-pill').getBoundingClientRect(),b=document.querySelector('.hlw-sound').getBoundingClientRect();return a.right>b.left-4&&a.bottom>b.top&&a.top<b.bottom})
  await p.screenshot({ path:`screens-dev/ad-${tag}-1.png` })
  for (let i=0;i<6;i++){ await p.locator('.hlw-item').nth(i).click(); await p.waitForSelector('.hlw-overlay.is-visible'); if(await p.locator('#hlw-win.is-visible').count()) break; if(i===0){ await p.waitForTimeout(400); await p.screenshot({path:`screens-dev/ad-${tag}-2miss.png`}) } await p.keyboard.press('Escape'); await p.waitForTimeout(450) }
  await p.waitForTimeout(450)
  const dlg = await p.evaluate(()=>{const d=document.querySelector('#hlw-win .hlw-dialog').getBoundingClientRect();const o=document.querySelector('#hlw-win');return {fits:d.height<=innerHeight-8, scroll:o.scrollHeight>o.clientHeight}})
  const btns = await p.evaluate(()=>[...document.querySelectorAll('#hlw-win .hlw-btn,#hlw-win .hlw-copy')].map(b=>b.scrollWidth>b.clientWidth+1).some(Boolean))
  const code = await p.evaluate(()=>{const c=document.querySelector('#hlw-win .hlw-code');return c.scrollWidth>c.clientWidth+1})
  await p.screenshot({ path:`screens-dev/ad-${tag}-3win.png` })
  await p.keyboard.press('Escape'); await p.waitForTimeout(700)
  const bar = await p.evaluate(()=>{const b=document.querySelector('#hlw-bar').getBoundingClientRect();return {w:Math.round(b.width), over: b.right>innerWidth||b.left<0}})
  await p.screenshot({ path:`screens-dev/ad-${tag}-4after.png` })
  console.log(tag.padEnd(14),'hscroll',hs,'| мин.предмет',Math.min(...small),'px | пилюля∩звук',pill,'| попап влезает',dlg.fits,'скролл',dlg.scroll,'| текст кнопок обрезан',btns,'| код обрезан',code,'| плашка',bar.w,bar.over?'ВЫЛЕЗАЕТ':'ok','| ошибки',errs.length)
  await ctx.close()
}
await br.close()
