#!/usr/bin/env python3
"""Вырезает из набора Елены (assets-src/halloween-kit.webp): угловую паутину без паука и паука без нити."""
import os, sys, numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = np.asarray(Image.open(os.path.join(ROOT, 'assets-src/halloween-kit.webp')).convert('RGBA'))
m = (A[..., 3] > 20).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m[:250], 8)
def comp(i):
    x, y, w, h = st[i, :4]; sub = A[y:y + h, x:x + w].copy()
    sub[..., 3] = np.where(lab[y:y + h, x:x + w] == i, sub[..., 3], 0); return sub
# паутина: компонента у левого верхнего угла; паука и нить под ней стираем
wi = min((i for i in range(1, n) if st[i, 4] > 8000), key=lambda i: st[i, 0])
web = comp(wi); h, w = web.shape[:2]
web[int(h * 0.62):, int(w * 0.32):, 3] = 0
L = web[..., :3].mean(2); web[..., 3] = np.where(L < 90, 0, web[..., 3])  # тёмные остатки паука
Image.fromarray(web).crop(Image.fromarray(web).getbbox()).save(os.path.join(ROOT, 'assets-src/web-corner.png'))
# паук: самый крупный висящий паук; нить срезаем по месту, где фигура становится шире 12 px
si = max((i for i in range(1, n) if 3000 < st[i, 4] < 8000), key=lambda i: st[i, 4])
sp = comp(si); widths = (sp[..., 3] > 20).sum(1); top = int(np.argmax(widths > 12))
sp = sp[max(0, top - 6):]; Image.fromarray(sp).crop(Image.fromarray(sp).getbbox()).save(os.path.join(ROOT, 'assets-src/spider.png'))
print('паутина', web.shape[1], 'x', web.shape[0], '| паук', sp.shape[1], 'x', sp.shape[0])
if len(sys.argv) > 1:
    tiles = [Image.open(os.path.join(ROOT, 'assets-src', f)) for f in ('web-corner.png', 'spider.png')]
    s = Image.new('RGBA', (sum(t.width for t in tiles) * 2 + 20, max(t.height for t in tiles) * 2), (60, 45, 40, 255)); x = 0
    for t in tiles: t2 = t.resize((t.width * 2, t.height * 2)); s.alpha_composite(t2, (x, 0)); x += t2.width + 20
    s.convert('RGB').save(sys.argv[1] + '/kit-cut.png')
