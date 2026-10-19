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
import { execSync } from 'child_process'
let esbuild = null
try { esbuild = (await import('esbuild')).default } catch (e) { console.warn('esbuild не найден — JS без минификации') }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')


/* =====================================================================
 *  HLW_CONFIG — всё, что правит человек. После правки: node scripts/build.mjs
 * ===================================================================== */

/**
 * CDN с ассетами: jsDelivr из публичного репозитория. Ссылка закрепляется на коммит,
 * в котором последний раз менялась папка assets/ (имена файлов ещё и с хешем содержимого).
 * Переопределить: HLW_REF=<sha|main> node scripts/build.mjs
 */
const REPO = 'ElenaSamanchuk/priem-halloween-game'
function assetsRef() {
  if (process.env.HLW_REF) return process.env.HLW_REF
  try { return execSync('git log -1 --format=%H -- assets', { cwd: ROOT }).toString().trim().slice(0, 12) || 'main' } catch (e) { return 'main' }
}
const ASSETS_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@${assetsRef()}/assets`
/** Для превью и priem-sim: ассеты лежат рядом со страницей. */
const LOCAL_ASSETS = './assets'

/** assets/manifest.json пишет scripts/prepare-assets.py (имена с хешем, координаты предметов) */
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'))

const HLW_CONFIG = {
  ymId: null, // номер счётчика Яндекс.Метрики (цели hlw_*) или null — события всё равно уходят в dataLayer

  /** Палитра бренда (макет: плашка #4C2F72, кнопки #FF1A6C и #8C41E3) */
  theme: { panel: '#4c2f72', pink: '#ff1a6c', yellow: '#feda00', secondary: '#8c41e3', glow: '255,200,40' },

  copy: {
    sceneLabel: 'Страшная кухня: найди, где спрятан ПриЕм',
    pillStart: 'Найди, где спрятался <b>ПриЕм</b>',
    pillProgress: 'Проверено <b>{n}</b> из {total}', // {n}, {total}
    pillWin: '<b>ПриЕм найден!</b> Промокод ниже',
    soundOn: 'Включить звук',
    soundOff: 'Выключить звук',
    continueCta: 'Продолжить поиск',
    closeLabel: 'Закрыть',
    win: {
      img: 'win',
      title: 'Ого, ты не только смелый, но и удачливый!',
      text: 'Ты нашёл ПриЕм, а значит тебе больше не нужно заходить на страшную кухню. Заказывай готовую еду ещё выгоднее с промокодом {promo} на 1000 ₽ (на заказы от 5 дней)',
      orderCta: 'Смело заказать ПриЕм с выгодой',
      shareCta: 'Рассказать друзьям', // в макете «Поделиться в соцсетях», в ТЗ — «Рассказать друзьям»
      copyCta: 'Скопировать',
      copiedTip: 'Скопировано',
      orderToast: 'Промокод <b>{promo}</b> скопирован — вставь его при оформлении заказа',
      copyFailTip: 'Не удалось, выдели код вручную',
      barLabel: 'Твой промокод',
      shareVk: 'ВКонтакте',
      shareTg: 'Telegram',
      shareCopy: 'Скопировать ссылку',
      shareText: 'Я нашёл ПриЕм на страшной кухне и забрал скидку 1000 ₽. Рискнёшь?',
      shareTitle: 'Найди ПриЕм на страшной кухне',
    },
    /**
     * 8 текстов промаха [заголовок, текст, иллюстрация]. Нарисовано 5 иллюстраций (miss-01…05),
     * у трёх текстов картинка общая с близким по смыслу. За игру 5 пустых предметов — рантайм берёт
     * по одному тексту на иллюстрацию, поэтому картинки за игру не повторяются, а тексты — случайные.
     */
    miss: [
      ['Мимо!', 'Тут только пыль и старый рецепт, который даже не стоит пытаться готовить', 'miss-01'],
      ['Иу', 'Тут прячется лишь сельдерей, которому год. Советую его не брать', 'miss-02'],
      ['Не в этот раз', 'Здесь живёт дух пригоревшей запеканки', 'miss-05'],
      ['Фуэ', 'Кажется, это тут лежит аж с прошлого века', 'miss-03'],
      ['Пусто', 'Только паутина и запах недельного борща', 'miss-03'],
      ['Оу', 'Ты разбудил призрак вчерашней немытой посуды. Он явно недоволен', 'miss-04'],
      ['Аааа', 'Тут живёт только проклятие вечной готовки. Жутко, правда?', 'miss-05'],
      ['Мимо', 'Но кухонный дух оценил твою смелость', 'miss-04'],
    ],
  },

  promo: 'СТРАШНОВКУСНО',

  links: {
    order: '#menu-plans-v2', // якорь блока заказа на странице (плавный скролл) или полный URL
    shareUrl: null, // ссылка с ?cmz=… для шеринга; null = адрес текущей страницы без параметров
  },

  /**
   * Предметы (порядок = порядок обхода с клавиатуры). Координаты и картинки — из manifest.json.
   *  anim — мини-анимация на ховере: swing (качается на цепи), creak (скрипит), wobble (покачивается), rattle (дребезжит)
   *  origin — точка вращения
   */
  items: [
    { id: 'pumpkin-lamp', label: 'Светильник-тыква', anim: 'swing', origin: '50% 0%' },
    { id: 'cabinet-double', label: 'Шкаф с приоткрытой дверцей', anim: 'creak', origin: '50% 0%' },
    { id: 'cabinet-single', label: 'Навесной шкафчик', anim: 'creak', origin: '50% 0%' },
    { id: 'veg-crate', label: 'Ящик с овощами', anim: 'rattle', origin: '50% 100%' },
    { id: 'cauldron', label: 'Котёл', anim: 'wobble', origin: '50% 100%' },
    { id: 'pan', label: 'Сковорода под крышкой', anim: 'rattle', origin: '50% 100%' },
  ],

  /** Сцена: свет лампы и туман по полу — в % кадра (деск) и % окна кухни (<1024) */
  scene: {
    top: 11.9, // высота каменной полки над окном кухни, % кадра — там счётчик и звук
    lamp: { x: 31.8, y: 36, w: 20, kx: 12.8, ky: 32, kw: 46 },
    fog: { x: 27.2, y: 70, w: 43.8, h: 24, kx: 2.8, ky: 69, kw: 94.4, kh: 28 },
  },
}

/* ===================== типограф (применяется к текстам при сборке) ===================== */
const NB = '\u00a0'
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
      s = s.replace(/[ \t]+([^\s]{1,6})$/u, `${NB}$1`) // короткое последнее слово не остаётся одно
      return s
    })
    .join('\n')
}


const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\u00a0/g, '&nbsp;')

/* Паутина: тонкий SVG из угла (0,0), радиальные нити + провисающие дуги. Детерминированная — без рандома при сборке */
function cobwebSvg(cls) {
  const R = 200, rays = [4, 19, 34, 50, 66, 81, 88].map((d) => (d * Math.PI) / 180)
  const pt = (a, r) => [+(Math.cos(a) * r).toFixed(1), +(Math.sin(a) * r).toFixed(1)]
  let d = ''
  rays.forEach((a, i) => { const [x, y] = pt(a, R * (0.86 + (i % 3) * 0.07)); d += `M0 0L${x} ${y}` })
  for (let k = 1; k <= 6; k++) {
    const r = R * (0.14 * k) * (1 + (k % 2) * 0.04)
    for (let i = 0; i < rays.length - 1; i++) {
      const [x1, y1] = pt(rays[i], r), [x2, y2] = pt(rays[i + 1], r * (1 + ((i + k) % 3 - 1) * 0.03))
      const mid = (rays[i] + rays[i + 1]) / 2, [cx, cy] = pt(mid, r * 0.8)
      d += `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`
    }
  }
  return `<svg class="${cls}" viewBox="0 0 ${R} ${R}" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="rgba(232,228,240,.55)" stroke-width=".7" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`
}

/* ===================== сборка блока ===================== */
const url = (base, file) => base.replace(/\/$/, '') + '/' + file
const pct = (v) => (+v).toFixed(3) + '%'
const ICON_SOUND_OFF = '<svg class="hlw-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>'
const ICON_SOUND_ON = '<svg class="hlw-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none"/></svg>'

function buildBlock(base) {
  const C = HLW_CONFIG
  const T = typograph
  const copy = C.copy
  const w = copy.win
  const S = MAN.scene
  const kb = S.kitchenBox
  const modal = (key) => MAN.modals[key]
  const picSet = (key) => {
    const m = modal(key)
    return { src: url(base, m.w720), srcset: `${url(base, m.w720)} 720w, ${url(base, m.w1200)} 1200w`, avif: `${url(base, m.a720)} 720w, ${url(base, m.a1200)} 1200w` }
  }

  // Предметы
  const itemsHtml = C.items
    .map((it, i) => {
      const m = MAN.items[it.id]
      if (!m) throw new Error('Нет предмета в manifest: ' + it.id)
      const f = m.frame, k = m.kitchen
      const style = `--fx:${pct(f.x)};--fy:${pct(f.y)};--fw:${pct(f.w)};--fh:${pct(f.h)};--kx:${pct(k.x)};--ky:${pct(k.y)};--kw:${pct(k.w)};--kh:${pct(k.h)};--o:${it.origin};--hlw-d:${(i * 0.43).toFixed(2)}s`
      return `<button type="button" class="hlw-item" data-id="${esc(it.id)}" aria-label="${esc(it.label)}" style="${style}"><img class="hlw-item__img" src="${esc(url(base, m.src))}" alt="" draggable="false" decoding="async"></button>`
    })
    .join('')

  const L = C.scene.lamp, G = C.scene.fog
  const wrapStyle = [
    `--hlw-panel:${C.theme.panel}`, `--hlw-pink:${C.theme.pink}`, `--hlw-yellow:${C.theme.yellow}`, `--hlw-sec:${C.theme.secondary}`, `--hlw-glow:${C.theme.glow}`,
    `--hlw-kar:${kb.w}/${kb.h}`, `--hlw-cave:url(${url(base, S.frame1x)})`, `--hlw-topk:${C.scene.top / 100}`,
    `--lx:${L.x}%`, `--ly:${L.y}%`, `--lw:${L.w}%`, `--klx:${L.kx}%`, `--kly:${L.ky}%`, `--klw:${L.kw}%`,
    `--gx:${G.x}%`, `--gy:${G.y}%`, `--gw:${G.w}%`, `--gh:${G.h}%`, `--kgx:${G.kx}%`, `--kgy:${G.ky}%`, `--kgw:${G.kw}%`, `--kgh:${G.kh}%`,
  ].join(';')

  // Фон сцены: деск — весь кадр, <1024 — окно кухни
  const bg = `<picture><source media="(min-width:1024px)" type="image/avif" srcset="${esc(url(base, S.frame1xA))} 1440w, ${esc(url(base, S.frame2xA))} 2880w" sizes="100vw"><source media="(min-width:1024px)" type="image/webp" srcset="${esc(url(base, S.frame1x))} 1440w, ${esc(url(base, S.frame2x))} 2880w" sizes="100vw"><source type="image/avif" srcset="${esc(url(base, S.kitchenSmallA))} 800w, ${esc(url(base, S.kitchenA))} 1400w" sizes="(max-width:760px) 100vw, 760px"><img class="hlw-scene__bg" src="${esc(url(base, S.kitchenSmall))}" srcset="${esc(url(base, S.kitchenSmall))} 800w, ${esc(url(base, S.kitchen))} 1400w" sizes="(max-width:760px) 100vw, 760px" alt="" draggable="false" decoding="async" fetchpriority="high"></picture>`

  const webs = ['l', 'r'].map((side) => `<div class="hlw-web hlw-web--${side}" aria-hidden="true">${cobwebSvg('hlw-web__svg')}</div>`).join('')
  // глаза в темноте пещеры: позиции в % кадра (только деск), период и задержка — разные, чтобы не синхронились
  const EYES = [[4, 30, 13, 0], [9, 62, 17, 5], [93, 26, 15, 9], [95.5, 56, 19, 2.5], [88, 76, 23, 13]]
  const eyes = EYES.map(([x, y, dur, del]) => `<div class="hlw-eyes" aria-hidden="true" style="left:${x}%;top:${y}%;animation-duration:${dur}s;animation-delay:${del}s"><i></i><i></i></div>`).join('')
  const G2 = MAN.ghost
  const ghost = G2 ? `<div class="hlw-ghost" aria-hidden="true" style="--gr:${G2.ratio}"><div class="hlw-ghost__bob"><picture><source type="image/avif" srcset="${esc(url(base, G2.avif))}"><img src="${esc(url(base, G2.webp))}" alt="" draggable="false" decoding="async" loading="lazy"></picture></div></div>` : ''
  const promoText = esc(T(w.text)).replace('{promo}', `<b class="hlw-hl">${esc(C.promo)}</b>`)
  const promoBox = `<div class="hlw-promo"><button type="button" class="hlw-code" aria-label="Скопировать промокод ${esc(C.promo)}">${esc(C.promo)}</button><button type="button" class="hlw-copy">${esc(w.copyCta)}</button><span class="hlw-tip" role="status" aria-live="polite"></span></div>`
  const orderBtn = `<a class="hlw-btn" href="${esc(C.links.order)}" data-hlw-order${/^https?:/.test(C.links.order) ? ' target="_blank" rel="noopener"' : ''}>${esc(T(w.orderCta))}</a>`
  const closeBtn = `<button type="button" class="hlw-close" data-hlw-close aria-label="${esc(copy.closeLabel)}">${ICON_CLOSE}</button>`
  const winPic = picSet(w.img)

  const css = fs.readFileSync(path.join(ROOT, 'src/game.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, '\n').trim() + '\n#hlw-wrap .hlw-hl{color:#fff;font-weight:800;white-space:nowrap;background:var(--hlw-pink);padding:1px 6px;border-radius:5px;-webkit-box-decoration-break:clone;box-decoration-break:clone}'

  const norm = (s) => s.replace(/ /g, '\\u00a0')
  const rt = {
    ymId: C.ymId,
    promo: C.promo,
    shareUrl: C.links.shareUrl,
    shareText: T(w.shareText),
    shareTitle: T(w.shareTitle),
    copiedText: w.copiedTip,
    copyFailText: w.copyFailTip,
    pillProgress: copy.pillProgress,
    pillWin: copy.pillWin,
    orderToast: T(w.orderToast).replace('{promo}', C.promo),
    soundOn: copy.soundOn,
    soundOff: copy.soundOff,
    lamp: { x: L.x / 100, y: L.y / 100, kx: L.kx / 100, ky: L.ky / 100 },
    miss: copy.miss.map(([t, d, i]) => ({ t: T(t), d: T(d), g: i, i: picSet(i) })),
    preload: Object.keys(MAN.modals).map((k) => picSet(k)),
  }
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
  const parts = ['src/sound.js', 'src/fx.js'].filter((f) => fs.existsSync(path.join(ROOT, f))).map(read).join('\n')
  const js = read('src/game.js')
    .replace('/*__HLW_MODULES__*/', () => parts)
    .replace('/*__HLW_RT__*/{}', () => norm(JSON.stringify(rt)))
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
  let jsOut = js
  if (esbuild) {
    jsOut = esbuild.transformSync(js, { minify: true, target: 'es5', legalComments: 'none', charset: 'utf8' }).code.trim()
  }
  if (/<\/script/i.test(jsOut)) throw new Error('JS содержит </script')

  const beaconGo =
    "(function(){function go(){if(window.__hlwInstalled)return true;var s=document.getElementById('hlw-js');if(!s)return false;try{(0,eval)(s.text||s.textContent||'')}catch(e){}return true}if(go())return;var n=0;var t=setInterval(function(){n+=1;if(go()||n>40)clearInterval(t)},250)})()"
  const beacon = `<img id="hlw-boot-beacon" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="1" height="1" aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" onload="${beaconGo}" onerror="${beaconGo}">`

  const markup = `<section id="halloween-game" aria-label="${esc(T(copy.sceneLabel))}">
<div id="hlw-wrap" class="hlw-wrap" style="${wrapStyle}">
<div class="hlw-top"><div class="hlw-pill" role="status" aria-live="polite"><span class="hlw-pill__dot" aria-hidden="true"></span><span class="hlw-pill__txt">${T(copy.pillStart)}</span></div>
<button type="button" class="hlw-sound" aria-pressed="true" aria-label="${esc(copy.soundOff)}" title="${esc(copy.soundOff)}">${ICON_SOUND_OFF}${ICON_SOUND_ON}</button></div>
<div class="hlw-ambient" aria-hidden="true"><img src="${esc(url(base, S.kitchenSmall))}" alt="" decoding="async" loading="lazy"></div>
<div class="hlw-scene">
<div class="hlw-stage">${bg}
<div class="hlw-lamp" aria-hidden="true"></div><div class="hlw-fog" aria-hidden="true"></div>${webs}<div class="hlw-warm" aria-hidden="true"></div>
<div class="hlw-items" role="group" aria-label="${esc(T(copy.sceneLabel))}">${itemsHtml}</div>
</div>
${eyes}<div class="hlw-flash" aria-hidden="true"></div>${ghost}
<div class="hlw-torch" aria-hidden="true"><div class="hlw-torch__beam"></div></div><canvas class="hlw-fx" aria-hidden="true"></canvas>

</div>
<div class="hlw-bar" id="hlw-bar" hidden><span class="hlw-bar__label">${esc(w.barLabel)}</span>${promoBox}${orderBtn}</div>
<div class="hlw-overlay" id="hlw-miss" hidden>
<div class="hlw-dialog" role="dialog" aria-modal="true" aria-labelledby="hlw-miss-title" aria-describedby="hlw-miss-text" tabindex="-1">
${closeBtn}<div class="hlw-pic"><picture><source id="hlw-miss-avif" type="image/avif" sizes="(max-width:560px) 100vw, 560px"><img id="hlw-miss-img" alt="" sizes="(max-width:560px) 100vw, 560px" decoding="async"></picture></div><div class="hlw-body"><h2 class="hlw-dtitle" id="hlw-miss-title"></h2><p class="hlw-dtext" id="hlw-miss-text"></p><div class="hlw-actions"><button type="button" class="hlw-btn" data-hlw-close>${esc(T(copy.continueCta))}</button></div></div>
</div></div>
<div class="hlw-overlay" id="hlw-win" hidden>
<div class="hlw-dialog" role="dialog" aria-modal="true" aria-labelledby="hlw-win-title" aria-describedby="hlw-win-text" tabindex="-1">
${closeBtn}<div class="hlw-pic"><picture><source type="image/avif" srcset="${esc(winPic.avif)}" sizes="(max-width:640px) 100vw, 640px"><img alt="Тыквоголовый скелет с клевером и довольный призрак" src="${esc(winPic.src)}" srcset="${esc(winPic.srcset)}" sizes="(max-width:640px) 100vw, 640px" decoding="async"></picture></div><div class="hlw-body"><h2 class="hlw-dtitle" id="hlw-win-title">${esc(T(w.title))}</h2><p class="hlw-dtext" id="hlw-win-text">${promoText}</p>${promoBox}<div class="hlw-actions">${orderBtn}<button type="button" class="hlw-btn hlw-btn--sec" id="hlw-share" aria-expanded="false" aria-controls="hlw-sharerow">${esc(T(w.shareCta))}</button></div>
<div class="hlw-sharerow" id="hlw-sharerow" hidden><a class="hlw-sharelink" id="hlw-share-vk" href="https://vk.com/share.php" target="_blank" rel="noopener">${esc(w.shareVk)}</a><a class="hlw-sharelink" id="hlw-share-tg" href="https://t.me/share/url" target="_blank" rel="noopener">${esc(w.shareTg)}</a><button type="button" class="hlw-sharelink" id="hlw-share-copy">${esc(w.shareCopy)}</button></div></div>
</div></div>
<div class="hlw-toast" role="status" aria-live="polite"></div>
</div>
</section>`.replace(/\n/g, '')

  const preload = `<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(url(base, S.frame1xA))} 1440w, ${esc(url(base, S.frame2xA))} 2880w" imagesizes="100vw" media="(min-width:1024px)"><link rel="preload" as="image" type="image/avif" imagesrcset="${esc(url(base, S.kitchenSmallA))} 800w, ${esc(url(base, S.kitchenA))} 1400w" imagesizes="(max-width:760px) 100vw, 760px" media="(max-width:1023px)">`
  return `${preload}\n<style>\n${css}\n</style>\n${markup}\n${beacon}\n<script id="hlw-js">\n${jsOut}\n</script>\n`
}

/* ===================== страницы просмотра (только игровой блок) ===================== */
function pageShell(title, body) {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>html,body{margin:0;background:#130c0e}</style></head><body>
${body}
</body></html>`
}

/** Превью: только блок, как он встанет в T123 */
function buildPreview(block) {
  return pageShell('Найди ПриЕм — игровой блок', `<div class="t-records"><div class="t-rec">${block}</div></div>`)
}

/** Проверка для priem.menu: сайт кладёт страницу Тильды через innerHTML — <script> там сам не запускается */
function buildSim() {
  const body = `<div id="tilda" class="tilda-page t-records"></div>
<script>
(function(){
  fetch('./halloween-game-tilda.html?'+Date.now()).then(function(r){return r.text()}).then(function(t){
    var host=document.getElementById('tilda');
    host.innerHTML=t;
    if(/repatch/.test(location.search)){setTimeout(function(){host.innerHTML=t},1500)}
  });
})();
</script>`
  return pageShell('Найди ПриЕм — проверка вставки через innerHTML', body)
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
if (false) throw new Error('base64 в блоке')
console.log(`dist/halloween-game-tilda.html  ${(bytes / 1024).toFixed(1)} KB (${bytes} B)`)
if (bytes > 100000) console.warn('ВНИМАНИЕ: больше ~100 КБ')
try { new Function(fs.readFileSync(path.join(DIST, 'halloween-game-tilda.html'), 'utf8').match(/<script id="hlw-js">\n([\s\S]*)<\/script>/)[1]) } catch (e) { throw new Error('Синтаксис JS: ' + e.message) }
