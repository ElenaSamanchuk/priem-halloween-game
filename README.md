# priem-halloween-game — игра «найди ПриЕм» (Хэллоуин) для Tilda T123

Один спецблок для лендинга ПриЕм: кухня с 6 предметами, один прячет ПриЕм (случайно при каждой загрузке), остальные дают забавные «промахи». Победа показывает промокод. Остальные блоки лендинга делает админка сайта. Схема повторяет мемо-игру (`priem-vibe-landings/scripts/build-memo-tilda.mjs`). Сейчас все картинки — заглушки; настоящая графика из Figma подставляется заменой конфига.

## Структура
- `scripts/build.mjs` — сборка; **`HLW_CONFIG`** и `ASSETS_BASE` в самом верху.
- `src/game.css`, `src/game.js` — стили (всё под `#hlw-wrap`/`.hlw-*`) и рантайм (IIFE, ES5).
- `dist/halloween-game-tilda.html` — **вставлять в T123** (~32 КБ, без base64 кроме 1×1 GIF-маячка).
- `dist/halloween-game-local.html`, `dist/preview.html` (страница-имитация лендинга), `dist/priem-sim.html` (имитация priem.menu: innerHTML в `div#tilda`; `?repatch=1` — повторная вставка).
- `assets/` — локальные ассеты для превью (копируются в `dist/assets/`).
- `tests/check.mjs` — проверки Playwright, `screens-dev/` — скрины.

## Сборка и проверка
```
node scripts/build.mjs
cd dist && python3 -m http.server 8765   # http://localhost:8765/preview.html
node tests/check.mjs                      # нужен playwright (npm i), Chromium из ~/Library/Caches/ms-playwright
```

## Подмена ассетов (конфиг)
- `scene.caveBg` — фон-пещера на всю ширину (кадр 2880×1203, cover); `scene.kitchen` — окно кухни с рваным краем (≈1261×985, PNG/WebP с альфой), по центру ≈44% ширины.
- `items[]`: `{ id, label (aria), x, y, w, h (% ОТ ОКНА КУХНИ), src (PNG-слой с альфой), shape (для заглушки) }`. Свечение рисуется по альфе PNG (`drop-shadow`).
- `copy.miss[]`: `[заголовок, текст, иллюстрация]`; `copy.win.img` — иллюстрация победы (≈1298×1000, cover).
- `copy.win.*` — тексты и кнопки, `promo`, `links.order` (якорь или URL), `links.shareUrl`, `theme` (палитра, цвет вторичной кнопки), `mobileMode` (`'fit'` по умолчанию / `'pan'`), `ymId`.
- Файлы лежат в `ElenaSamanchuk/priem-halloween-assets`; после пуша подставить sha в `ASSETS_BASE` (сейчас `SHA_TBD`) и пересобрать. Для превью положить файлы в `assets/`.
- Типограф (убирает точку в конце абзаца, неразрывные пробелы после коротких слов/перед ₽) применяется при сборке ко всем текстам.

## Вставка на Тильду
1. В редакторе Тильды удалить старые блоки игры (если были).
2. Добавить **один** блок T123 (HTML).
3. Открыть `dist/halloween-game-tilda.html`, выделить всё, вставить в T123, сохранить.
4. Опубликовать страницу, обновить жёстко (⌘⇧R). jsDelivr обновляется через 2–10 минут после пуша ассетов.
5. Кнопка героя «Найти ПриЕм» должна вести на `#halloween-game`; якорь заказа по умолчанию `#menu-plans-v2`.
6. На priem.menu (Vue подтягивает Тильду через innerHTML, `<script>` не исполняется) блок запускается «маячком» `<img onload/onerror>`, который делает eval текста `<script id="hlw-js">`. Двойной запуск закрыт флагом `window.__hlwInstalled`; при повторной вставке HTML MutationObserver заново инициализирует новый `#hlw-wrap`.

## Состояние игры
Ничего не хранится: перезагрузка = новая игра. Аналитика: `dataLayer` `hlw_start|miss|win|copy_code|order_click|share_click{channel}` и `ym(id,'reachGoal')` при заданном `ymId`.
