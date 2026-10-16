#!/usr/bin/env node
/**
 * Сборка спецблока «найди ПриЕм» для Tilda T123.
 * Запуск: node scripts/build.mjs
 * Выход: dist/halloween-game-tilda.html (вставлять в T123), dist/halloween-game-local.html (то же, ассеты ./assets/),
 *        dist/preview.html, dist/priem-sim.html
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

/* =====================================================================
 *  HLW_CONFIG — всё, что правит человек. После правки: node scripts/build.mjs
 * ===================================================================== */

/** CDN с ассетами. После пуша ассетов в ElenaSamanchuk/priem-halloween-assets подставь sha коммита. */
const ASSETS_BASE = 'https://cdn.jsdelivr.net/gh/ElenaSamanchuk/priem-halloween-assets@SHA_TBD'
/** Для превью и priem-sim: ассеты лежат рядом со страницей. */
const LOCAL_ASSETS = './assets/'

const HLW_CONFIG = {
  /** 'fit' — на <768px пещера скрыта, окно кухни во всю ширину (отступ 8px); 'pan' — окно кухни листается пальцем (опция) */
  mobileMode: 'fit',
  ymId: null, // номер счётчика Яндекс.Метрики или null

  /**
   * Сцена (макет Figma): caveBg — фон-пещера на всю ширину (кадр 2880x1203, cover);
   * kitchen — «окно» кухни с рваным краем по центру (≈1261x985 в кадре 2880x1203, PNG/WebP с альфой).
   * Предметы позиционируются в процентах ОТ ОКНА КУХНИ.
   */
  scene: {
    caveBg: '', // файл относительно ASSETS_BASE; пусто = градиент-заглушка
    kitchen: '', // файл окна кухни; пусто = заглушка с рваным краем
    kitchenW: 1261, // пропорции окна
    kitchenH: 985,
    frameW: 2880, // пропорции кадра-пещеры
    frameH: 1203,
  },

  /** Палитра бренда */
  theme: { bg: '#362050', panel: '#4c2f72', pink: '#ff1a6c', yellow: '#feda00', secondary: '#7b4fd1', glow: '255,200,40' },

  copy: {
    title: 'Найди ПриЕм на страшной кухне',
    lead: 'Открывай предметы и ищи, где спрятался ПриЕм',
    continueCta: 'Продолжить поиск',
    closeLabel: 'Закрыть',
    win: {
      img: '', // иллюстрация победы (≈1298x1000), файл относительно ASSETS_BASE; пусто = заглушка
      title: 'Ого, ты не только смелый, но и удачливый!',
      text: 'Ты нашёл ПриЕм, а значит тебе больше не нужно заходить на страшную кухню. Заказывай готовую еду ещё выгоднее с промокодом СТРАШНОВКУСНО на 1000 ₽ (на заказы от 5 дней)',
      orderCta: 'Смело заказать ПриЕм с выгодой',
      shareCta: 'Рассказать друзьям',
      copyCta: 'Скопировать',
      copiedTip: 'Скопировано',
      copyFailTip: 'Не удалось, выдели код вручную',
      barLabel: 'Твой промокод',
      shareVk: 'ВКонтакте',
      shareTg: 'Telegram',
      shareCopy: 'Скопировать ссылку',
      shareText: 'Я нашёл ПриЕм на страшной кухне. Попробуй и ты',
      shareTitle: 'Найди ПриЕм',
    },
    /** 8 вариантов промаха [заголовок, текст, иллюстрация] — выдаются без повторов случайным пустым предметам; иллюстрация — файл относительно ASSETS_BASE, '' = заглушка */
    miss: [
      ['Мимо!', 'Тут только пыль и старый рецепт, который даже не стоит пытаться готовить', ''],
      ['Иу', 'Тут прячется лишь сельдерей, которому год. Советую его не брать', ''],
      ['Не в этот раз', 'Здесь живёт дух пригоревшей запеканки', ''],
      ['Фуэ', 'Кажется, это тут лежит аж с прошлого века', ''],
      ['Пусто', 'Только паутина и запах недельного борща', ''],
      ['Оу', 'Ты разбудил призрак вчерашней немытой посуды. Он явно недоволен', ''],
      ['Аааа', 'Тут живёт только проклятие вечной готовки. Жутко, правда?', ''],
      ['Мимо', 'Но кухонный дух оценил твою смелость', ''],
    ],
  },

  promo: 'СТРАШНОВКУСНО',

  links: {
    order: '#menu-plans-v2', // якорь (плавный скролл) или полный URL
    shareUrl: null, // null = location.origin + location.pathname
  },

  /**
   * Предметы. Координаты — проценты от сцены (scene.w × scene.h).
   *  id    — стабильный идентификатор (аналитика)
   *  label — aria-label кнопки (озвучивается скринридером, подпись на заглушке)
   *  x,y,w,h — левый верх и размер слоя, % от ОКНА КУХНИ
   *  src   — файл слоя (PNG/WebP с прозрачностью) относительно ASSETS_BASE; '' = заглушка-фигура
   *  shape — только для заглушки: 'rect' | 'round' | 'tall' | 'pumpkin'
   */
  items: [
    { id: 'cabinet-double', label: 'Шкаф', x: 5, y: 10, w: 36, h: 40, src: '', shape: 'rect' },
    { id: 'cabinet-single', label: 'Шкафчик', x: 44, y: 12, w: 18, h: 30, src: '', shape: 'tall' },
    { id: 'pumpkin-lamp', label: 'Светильник-тыква', x: 68, y: 14, w: 14, h: 20, src: '', shape: 'pumpkin' },
    { id: 'veg-crate', label: 'Ящик с овощами', x: 6, y: 66, w: 24, h: 22, src: '', shape: 'rect' },
    { id: 'cauldron', label: 'Котёл', x: 40, y: 58, w: 22, h: 32, src: '', shape: 'round' },
    { id: 'pan', label: 'Сковорода', x: 68, y: 56, w: 22, h: 26, src: '', shape: 'round' },
  ],
}

/* ===================== типограф (применяется к текстам при сборке) ===================== */
const NB = ' '
const SHORT = [
  'а','и','в','во','на','но','не','ни','о','об','от','по','за','из','до','с','со','к','ко','у','я','он','же','бы','ли','ты','да',
  'для','при','под','над','без','про','или','как','что','то','это','тут',
]
export function typograph(text) {
  return text
    .split('\n')
    .map((p) => {
      let s = p.trim()
      s = s.replace(/(^|[^.…])\.$/u, '$1') // точка в конце абзаца
      const re = new RegExp(`(?<=^|[\\s(«„"])(${SHORT.join('|')})[ \\t]+(?=\\S)`, 'giu')
      s = s.replace(re, (m, w) => w + NB)
      s = s.replace(/(\d)[ \t]+(₽|руб\.?|дн\.)/gu, `$1${NB}$2`)
      s = s.replace(/(\d{1,2})[ \t]+(?=[А-Яа-яЁё])/gu, `$1${NB}`)
      s = s.replace(/[ \t]+—/gu, `${NB}—`)
      return s
    })
    .join('\n')
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;')

/* ===================== сборка блока ===================== */
function assetUrl(base, file) {
  return base.replace(/\/$/, '') + '/' + file
}

function buildBlock(base) {
  const C = HLW_CONFIG
  const T = typograph
  const copy = C.copy
  const w = copy.win
  const pic = (file, id, label) =>
    `<div class="hlw-pic"${id ? ` id="${id}"` : ''}><img src="${file ? esc(assetUrl(base, file)) : ''}" alt=""${file ? '' : ' hidden'}><div class="hlw-pic__ph"${file ? ' hidden' : ''} aria-hidden="true">${label}</div></div>`
  const cave = C.scene.caveBg ? `<img class="hlw-cave" src="${esc(assetUrl(base, C.scene.caveBg))}" alt="" draggable="false">` : ''
  const bg = C.scene.kitchen ? `<img class="hlw-bg" src="${esc(assetUrl(base, C.scene.kitchen))}" alt="" draggable="false">` : ''
  const itemsHtml = C.items
    .map((it) => {
      const style = `left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%`
      const inner = it.src
        ? `<img class="hlw-item__img" src="${esc(assetUrl(base, it.src))}" alt="" draggable="false">`
        : `<span class="hlw-art">${esc(T(it.label))}</span>`
      return `<button type="button" class="hlw-item" data-id="${esc(it.id)}" data-shape="${esc(it.shape || 'rect')}" aria-label="${esc(it.label)}" style="${style}">${inner}</button>`
    })
    .join('')
  const promoBox = `<div class="hlw-promo"><button type="button" class="hlw-code" aria-label="Скопировать промокод ${esc(C.promo)}">${esc(C.promo)}</button><button type="button" class="hlw-copy">${esc(w.copyCta)}</button><span class="hlw-tip" role="status" aria-live="polite"></span></div>`
  const orderBtn = `<a class="hlw-btn" href="${esc(C.links.order)}" data-hlw-order${/^https?:/.test(C.links.order) ? ' target="_blank" rel="noopener"' : ''}>${esc(T(w.orderCta))}</a>`
  const closeBtn = `<button type="button" class="hlw-close" data-hlw-close aria-label="${esc(copy.closeLabel)}">&times;</button>`

  const css = fs.readFileSync(path.join(ROOT, 'src/game.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, '\n').trim()

  const norm = (s) => s.replace(/ /g, '\\u00a0')
  const rt = {
    mobileMode: C.mobileMode,
    ymId: C.ymId,
    promo: C.promo,
    shareUrl: C.links.shareUrl,
    shareText: T(w.shareText),
    shareTitle: T(w.shareTitle),
    copiedText: w.copiedTip,
    copyFailText: w.copyFailTip,
    miss: copy.miss.map(([t, d, i]) => ({ t: T(t), d: T(d), i: i ? assetUrl(base, i) : '' })),
  }
  const js = fs
    .readFileSync(path.join(ROOT, 'src/game.js'), 'utf8')
    .replace('/*__HLW_RT__*/{}', norm(JSON.stringify(rt)))
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
    .split('\n')
    .filter((l) => !/^\s*\/\/(?!\s*<)/.test(l))
    .join('\n')
  if (/<\/script/i.test(js)) throw new Error('JS содержит </script')

  const beaconGo =
    "(function(){function go(){if(window.__hlwInstalled)return true;var s=document.getElementById('hlw-js');if(!s)return false;try{(0,eval)(s.text||s.textContent||'')}catch(e){}return true}if(go())return;var n=0;var t=setInterval(function(){n+=1;if(go()||n>40)clearInterval(t)},250)})()"
  const beacon = `<img id="hlw-boot-beacon" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="1" height="1" aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" onload="${beaconGo}" onerror="${beaconGo}">`

  const preload = C.items
    .filter((it) => it.src)
    .map((it) => `<link rel="preload" as="image" href="${esc(assetUrl(base, it.src))}">`)
    .concat([C.scene.caveBg, C.scene.kitchen].filter(Boolean).map((f) => `<link rel="preload" as="image" href="${esc(assetUrl(base, f))}">`))
    .join('\n')

  const markup = `<section id="halloween-game" aria-label="${esc(T(copy.title))}">
<div id="hlw-wrap" class="hlw-wrap hlw--${C.mobileMode === 'pan' ? 'pan' : 'fit'}" style="--hlw-bg:${C.theme.bg};--hlw-panel:${C.theme.panel};--hlw-pink:${C.theme.pink};--hlw-yellow:${C.theme.yellow};--hlw-sec:${C.theme.secondary};--hlw-glow:${C.theme.glow};--hlw-kw:${(C.scene.kitchenW / C.scene.frameW * 100).toFixed(2)}%;--hlw-kar:${C.scene.kitchenW}/${C.scene.kitchenH}">
<div class="hlw-head"><h2 class="hlw-title">${esc(T(copy.title))}</h2><p class="hlw-lead">${esc(T(copy.lead))}</p></div>
<div class="hlw-bar" id="hlw-bar" hidden><span class="hlw-bar__label">${esc(w.barLabel)}</span>${promoBox}${orderBtn.replace('class="hlw-btn"', 'class="hlw-btn"')}</div>
<div class="hlw-stagewrap">${cave}
<div class="hlw-stage" role="group" aria-label="Кухня"><div class="hlw-scene${C.scene.kitchen ? '' : ' hlw-scene--ph'}">${bg}${itemsHtml}</div></div>
<div class="hlw-hint" aria-hidden="true">листай кухню &#8596;</div>
</div>
<div class="hlw-overlay" id="hlw-miss" hidden>
<div class="hlw-dialog" role="dialog" aria-modal="true" aria-labelledby="hlw-miss-title" aria-describedby="hlw-miss-text" tabindex="-1">
${closeBtn}${pic('', 'hlw-miss-pic', 'иллюстрация промаха')}<div class="hlw-body"><h2 class="hlw-dtitle" id="hlw-miss-title"></h2><p class="hlw-dtext" id="hlw-miss-text"></p><button type="button" class="hlw-btn" data-hlw-close>${esc(T(copy.continueCta))}</button></div>
</div></div>
<div class="hlw-overlay" id="hlw-win" hidden>
<div class="hlw-dialog" role="dialog" aria-modal="true" aria-labelledby="hlw-win-title" aria-describedby="hlw-win-text" tabindex="-1">
${closeBtn}${pic(w.img, '', 'иллюстрация победы')}<div class="hlw-body"><h2 class="hlw-dtitle" id="hlw-win-title">${esc(T(w.title))}</h2><p class="hlw-dtext" id="hlw-win-text">${esc(T(w.text))}</p>${promoBox}${orderBtn}<button type="button" class="hlw-btn hlw-btn--sec" id="hlw-share" aria-expanded="false" aria-controls="hlw-sharerow">${esc(T(w.shareCta))}</button>
<div class="hlw-sharerow" id="hlw-sharerow" hidden><a class="hlw-sharelink" id="hlw-share-vk" href="https://vk.com/share.php?url=" target="_blank" rel="noopener">${esc(w.shareVk)}</a><a class="hlw-sharelink" id="hlw-share-tg" href="https://t.me/share/url?url=" target="_blank" rel="noopener">${esc(w.shareTg)}</a><button type="button" class="hlw-sharelink" id="hlw-share-copy">${esc(w.shareCopy)}</button></div></div>
</div></div></div>
</div>
</section>`.replace(/\n/g, '')

  return `${preload ? preload + '\n' : ''}<style>\n${css}\n</style>\n${markup}\n${beacon}\n<script id="hlw-js">\n${js}\n</script>\n`
}

/* ===================== страницы-имитации ===================== */
const stub = (id, title, extra = '') =>
  `<section${id ? ` id="${id}"` : ''} class="stub"><h2>${title}</h2><p>Заглушка экрана — его генерирует админка сайта.</p>${extra}</section>`

function pageShell(title, body, extraHead = '') {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#fff;color:#222}
#navbar{position:fixed;left:0;right:0;top:0;height:57px;z-index:1000;background:#2b1b3f;color:#fff;display:flex;align-items:center;padding:0 16px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.3)}
#navbar.navbar{display:flex}
main,#tilda{padding-top:57px}
.stub{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;border-bottom:1px solid #ddd;background:#f6f3fa}
.stub:nth-child(even){background:#eef6f1}
.stub a.cta{display:inline-block;padding:14px 22px;background:#7a3cff;color:#fff;border-radius:10px;text-decoration:none;font-weight:700}
/* имитация стилей Тильды, которые мешают */
.t-records a{color:#ff8562}.t-records ul{padding-left:40px}
</style>${extraHead}</head><body>
<div id="navbar" class="navbar">PriEm · шапка (fixed)</div>
${body}
</body></html>`
}

function buildPreview(block) {
  const body = `<main class="t-records">
${stub('screen1', 'Экран 1 (заглушка)', '<a class="cta" id="to-game" href="#halloween-game">Найти ПриЕм</a>')}
<div class="t-rec">${block}</div>
${stub('menu-plans-v2', 'Экран 3: меню и тарифы')}
${stub('screen4', 'Экран 4')}
${stub('screen5', 'Экран 5')}
${stub('order', 'Экран 6: заказ')}
</main>`
  return pageShell('Превью: найди ПриЕм', body)
}

function buildSim() {
  const body = `<div id="tilda" class="tilda-page t-records"></div>
<script>
/* Имитация priem.menu: Vue кладёт страницу Тильды через innerHTML, <script> не исполняется */
(function(){
  var q=location.search;
  fetch('./halloween-game-tilda.html?'+Date.now()).then(function(r){return r.text()}).then(function(t){
    var host=document.getElementById('tilda');
    var full='<section id="screen1" class="stub"><h2>Экран 1</h2><a class="cta" href="#halloween-game">Найти ПриЕм</a></section>'
      +t
      +'<section id="menu-plans-v2" class="stub"><h2>Экран 3: меню и тарифы</h2></section><section id="order" class="stub"><h2>Экран 6</h2></section>';
    host.innerHTML=full;
    window.__simInjected=1;
    if(/repatch/.test(q)){
      setTimeout(function(){host.innerHTML=full;window.__simRepatched=1},1500);
    }
  });
})();
</script>`
  return pageShell('Имитация priem.menu (innerHTML)', body)
}

/* ===================== запуск ===================== */
fs.mkdirSync(DIST, { recursive: true })
const tilda = buildBlock(ASSETS_BASE)
const local = buildBlock(LOCAL_ASSETS)
fs.writeFileSync(path.join(DIST, 'halloween-game-tilda.html'), tilda)
fs.writeFileSync(path.join(DIST, 'halloween-game-local.html'), local)
fs.writeFileSync(path.join(DIST, 'preview.html'), buildPreview(local))
fs.writeFileSync(path.join(DIST, 'priem-sim.html'), buildSim())
const assetsSrc = path.join(ROOT, 'assets')
if (fs.existsSync(assetsSrc)) fs.cpSync(assetsSrc, path.join(DIST, 'assets'), { recursive: true })

const bytes = Buffer.byteLength(tilda, 'utf8')
if (/;base64,/.test(tilda.replace(/src="data:image\/gif;base64,[^"]+"/, ''))) throw new Error('base64 в блоке')
console.log(`dist/halloween-game-tilda.html  ${(bytes / 1024).toFixed(1)} KB (${bytes} B)`)
if (bytes > 100000) console.warn('ВНИМАНИЕ: больше ~100 КБ')
try { new Function(fs.readFileSync(path.join(DIST, 'halloween-game-tilda.html'), 'utf8').match(/<script id="hlw-js">\n([\s\S]*)<\/script>/)[1]) } catch (e) { throw new Error('Синтаксис JS: ' + e.message) }
