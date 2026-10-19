#!/usr/bin/env python3
"""Готовит ассеты из выгрузок Figma (assets-src/) в assets/ (WebP) и пишет assets/manifest.json.

Источники (Figma «Иллюстрации (Copy) (Copy)», страница «Ноябрьская охватка»):
  assets-src/game-frame.jpg        — кадр игры 2880×1203 (пещера + окно кухни)
  assets-src/items/item-N.png      — вырезки предметов (Photoroom N), RGBA
  assets-src/items/positions.json  — где вырезка лежит в кадре (scripts/match-items.py)
  assets-src/modals/miss-0N.png, win.png — модалки 1298×1750/1990, верх 1000 px — иллюстрация

Запуск: python3 scripts/prepare-assets.py
"""
import json, os, subprocess, hashlib
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src')
OUT = os.path.join(ROOT, 'assets')
os.makedirs(OUT, exist_ok=True)

# Окно кухни в кадре 2880×1203 (Figma: Vector 5, X 784, Y 143.5, 1261.5×985)
KX, KY, KW, KH = 784, 143.5, 1261.5, 985

ITEMS = {  # файл вырезки → id предмета
    'item-1.png': 'pumpkin-lamp',
    'item-4.png': 'cabinet-double',
    'item-6.png': 'cabinet-single',
    'item-5.png': 'veg-crate',
    'item-3.png': 'cauldron',
    'item-2.png': 'pan',
}


def webp(img, name, q=82, lossless=False):
    tmp = os.path.join(OUT, '_tmp.png')
    img.save(tmp)
    path = os.path.join(OUT, name)
    args = ['cwebp', '-quiet', '-m', '6', '-mt']
    args += ['-lossless'] if lossless else ['-q', str(q), '-alpha_q', '100', '-sharp_yuv']
    subprocess.run(args + [tmp, '-o', path], check=True)
    os.remove(tmp)
    return name


def avif(img, name, q=55):
    """AVIF: при том же SSIM на ~30 % легче WebP (проверено на сцене и иллюстрациях)"""
    img.save(os.path.join(OUT, name), 'AVIF', quality=q, speed=4)
    return name


def hashed(name):
    """Имя с хешем содержимого — jsDelivr и браузеры не держат старую версию."""
    p = os.path.join(OUT, name)
    h = hashlib.sha1(open(p, 'rb').read()).hexdigest()[:8]
    base, ext = os.path.splitext(name)
    new = f'{base}.{h}{ext}'
    os.replace(p, os.path.join(OUT, new))
    return new


for f in os.listdir(OUT):  # чистим прошлую сборку
    if f.endswith('.webp') or f.endswith('.avif') or f == 'manifest.json':
        os.remove(os.path.join(OUT, f))

man = {'scene': {}, 'items': {}, 'modals': {}}
frame = Image.open(os.path.join(SRC, 'game-frame.jpg')).convert('RGB')
# Оригинал кадра в 3× (Елена скачала из Figma) — режем из него, качество выше
big3 = os.path.join(SRC, 'game-frame-3x.png')
frame3 = Image.open(big3).convert('RGB') if os.path.exists(big3) else frame.resize((8640, 3609), Image.LANCZOS)
F3 = frame3.width / frame.width

# Деск: весь кадр (пещера + кухня) — 2880 для ретины и 1440
f2 = frame3.resize((2880, 1203), Image.LANCZOS); f1 = frame3.resize((1440, 602), Image.LANCZOS)
man['scene']['frame2x'] = hashed(webp(f2, 'scene-2880.webp', 78)); man['scene']['frame2xA'] = hashed(avif(f2, 'scene-2880.avif'))
man['scene']['frame1x'] = hashed(webp(f1, 'scene-1440.webp', 80)); man['scene']['frame1xA'] = hashed(avif(f1, 'scene-1440.avif', 60))
# Мобайл: окно кухни с полем пещеры 3 % — рваный край остаётся
pad_x, pad_y = KW * 0.03, KH * 0.03
box = (round(KX - pad_x), round(KY - pad_y), round(KX + KW + pad_x), round(KY + KH + pad_y))
kit = frame3.crop(tuple(round(v * F3) for v in box))
kit = kit.resize((1400, round(1400 * kit.height / kit.width)), Image.LANCZOS)
man['scene']['kitchen'] = hashed(webp(kit, 'kitchen-1400.webp', 80)); man['scene']['kitchenA'] = hashed(avif(kit, 'kitchen-1400.avif'))
ks = kit.resize((800, round(800 * kit.height / kit.width)), Image.LANCZOS)
man['scene']['kitchenSmall'] = hashed(webp(ks, 'kitchen-800.webp', 80)); man['scene']['kitchenSmallA'] = hashed(avif(ks, 'kitchen-800.avif', 60))
man['scene']['kitchenBox'] = {'x': box[0], 'y': box[1], 'w': box[2] - box[0], 'h': box[3] - box[1]}
man['scene']['frame'] = {'w': frame.width, 'h': frame.height}

# Предметы: обрезаем прозрачные поля, масштаб = как в кадре, координаты в % кадра и % мобильного окна
pos = json.load(open(os.path.join(SRC, 'items', 'positions.json')))
for fname, iid in ITEMS.items():
    im = Image.open(os.path.join(SRC, 'items', fname)).convert('RGBA')
    p = pos[fname]
    s = p['s']
    alpha = im.split()[3].point(lambda v: 255 if v > 24 else 0)
    l, t, r, b = alpha.getbbox()
    crop = im.crop((l, t, r, b))
    w, h = round(crop.width * s), round(crop.height * s)
    x, y = p['fx'] + l * s, p['fy'] + t * s
    small = crop.resize((w, h), Image.LANCZOS)
    name = hashed(webp(small, f'item-{iid}.webp', 88))
    kb = man['scene']['kitchenBox']
    man['items'][iid] = {
        'src': name,
        'frame': {k: round(v, 3) for k, v in dict(x=x / frame.width * 100, y=y / frame.height * 100, w=w / frame.width * 100, h=h / frame.height * 100).items()},
        'kitchen': {k: round(v, 3) for k, v in dict(x=(x - kb['x']) / kb['w'] * 100, y=(y - kb['y']) / kb['h'] * 100, w=w / kb['w'] * 100, h=h / kb['h'] * 100).items()},
    }

# Модалки: только иллюстрация (верх 1000 px), текст и кнопки — вёрстка
for f in sorted(os.listdir(os.path.join(SRC, 'modals'))):
    if not f.endswith('.png'):
        continue
    key = f[:-4]
    if key.startswith('miss-') and int(key[5:]) > 5:
        continue  # 6–10 — дубли колонки «без кнопки»
    orig = os.path.join(SRC, 'illus', key + '.png')  # оригинал 3894×3000, если есть
    im = Image.open(orig).convert('RGB') if os.path.exists(orig) else Image.open(os.path.join(SRC, 'modals', f)).convert('RGB').crop((0, 0, 1298, 1000))
    big = im.resize((1200, round(1200 * im.height / im.width)), Image.LANCZOS)
    small = im.resize((720, round(720 * im.height / im.width)), Image.LANCZOS)
    man['modals'][key] = {'w1200': hashed(webp(big, f'modal-{key}-1200.webp', 78)), 'w720': hashed(webp(small, f'modal-{key}-720.webp', 78)),
                          'a1200': hashed(avif(big, f'modal-{key}-1200.avif')), 'a720': hashed(avif(small, f'modal-{key}-720.avif', 60)), 'ratio': round(im.width / im.height, 4)}

# Мобильный фон: заранее размытая и затемнённая кухня, крошечная (CSS-фильтр blur дорог на каждом кадре)
from PIL import ImageFilter, ImageEnhance
amb = kit.resize((240, round(240 * kit.height / kit.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
amb = ImageEnhance.Brightness(ImageEnhance.Color(amb).enhance(1.15)).enhance(0.42)
man['scene']['ambient'] = hashed(webp(amb, 'ambient-240.webp', 70))

# Слои для глубины на деске (scripts/split-layers.py): пещера с тёмным проёмом и кухня по форме проёма
lc, lk, lj = (os.path.join(SRC, n) for n in ('layer-cave.png', 'layer-kitchen.png', 'layer-kitchen.json'))
if os.path.exists(lc) and os.path.exists(lk):
    cave = Image.open(lc).convert('RGB'); kit2 = Image.open(lk).convert('RGBA'); box = json.load(open(lj))
    c2 = cave.resize((2880, 1203), Image.LANCZOS); c1 = cave.resize((1440, 602), Image.LANCZOS)
    k2 = kit2.resize((box['w'], box['h']), Image.LANCZOS); k3 = kit2.resize((round(box['w'] * 1.5), round(box['h'] * 1.5)), Image.LANCZOS)
    man['layers'] = {
        'cave1x': hashed(webp(c1, 'cave-1440.webp', 80)), 'cave1xA': hashed(avif(c1, 'cave-1440.avif', 60)),
        'cave2x': hashed(webp(c2, 'cave-2880.webp', 78)), 'cave2xA': hashed(avif(c2, 'cave-2880.avif')),
        'kit': hashed(webp(k2, 'kitchen-layer-1312.webp', 82)), 'kitA': hashed(avif(k2, 'kitchen-layer-1312.avif', 58)),
        'kitHi': hashed(webp(k3, 'kitchen-layer-1968.webp', 80)), 'kitHiA': hashed(avif(k3, 'kitchen-layer-1968.avif', 56)),
        'box': {k: round(v / d * 100, 3) for k, v, d in (('x', box['x'], 2880), ('y', box['y'], 1203), ('w', box['w'], 2880), ('h', box['h'], 1203))},
        'badge': box['badge'],
    }

# Призрак (вырезан из иллюстрации победы скриптом scripts/cut-ghost.py), с альфой
gp = os.path.join(SRC, 'ghost.png')
if os.path.exists(gp):
    g = Image.open(gp).convert('RGBA')
    g = g.resize((round(640 * g.width / g.height), 640), Image.LANCZOS)
    man['ghost'] = {'webp': hashed(webp(g, 'ghost-640.webp', 86)), 'avif': hashed(avif(g, 'ghost-640.avif', 62)), 'ratio': round(g.width / g.height, 4)}

json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
tot = 0
for f in sorted(os.listdir(OUT)):
    sz = os.path.getsize(os.path.join(OUT, f)); tot += sz
    print(f'{sz/1024:7.0f} КБ  {f}')
print(f'{tot/1024:7.0f} КБ  всего')
