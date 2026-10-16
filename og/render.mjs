import { chromium } from 'playwright'
const exe = '/Users/elena/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-x64/chrome-headless-shell'
const br = await chromium.launch({ executablePath: exe }); const p = await br.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const dir = new URL('.', import.meta.url).pathname
await p.goto('file://' + dir + 'og.html'); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready)
await p.locator('.og').screenshot({ path: dir + 'og-text.png' })
await p.addStyleTag({ content: '.t,.og::after{display:none}' })
await p.locator('.og').screenshot({ path: dir + 'og-clean.png' })
await br.close()
