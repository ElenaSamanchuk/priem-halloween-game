#!/usr/bin/env python3
"""Делит кадр игры на два слоя для эффекта глубины (деск):
  assets-src/layer-cave.png    — пещера, проём залит тёмным (видно при сдвиге слоёв)
  assets-src/layer-kitchen.png — кухня по форме проёма (выпуклая оболочка), с альфой
Координаты — кадр 2880×1203; кухня кладётся в box из assets-src/layer-kitchen.json."""
import os, sys, json, numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src')
f3 = np.asarray(Image.open(os.path.join(SRC, 'game-frame-3x.png')).convert('RGB'))
fr = cv2.resize(f3, (2880, 1203), interpolation=cv2.INTER_AREA)
L = cv2.cvtColor(fr, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
KX, KY, KW, KH = 784, 143.5, 1261.5, 985
m = (L > 0.2).astype(np.uint8)
roi = np.zeros_like(m); roi[int(KY) - 40:int(KY + KH) + 40, int(KX) - 40:int(KX + KW) + 40] = 1; m *= roi
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8); m = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
pts = cv2.findNonZero(m); hull = cv2.convexHull(pts)
mask = np.zeros_like(m); cv2.fillConvexPoly(mask, hull, 1)
# значок «!!» на нижнем правом крае — тоже в слой кухни
cv2.circle(mask, (1961, 1048), 46, 1, -1)
mask = cv2.erode(mask, np.ones((5, 5), np.uint8))
alpha = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 2.2)
x, y, w, h = cv2.boundingRect(mask); pad = 8; x -= pad; y -= pad; w += 2 * pad; h += 2 * pad
# слой кухни в 3× (резкость на ретине), режем по box
s3 = f3.shape[1] / 2880
a3 = cv2.resize(alpha, (f3.shape[1], f3.shape[0]), interpolation=cv2.INTER_LINEAR)
box3 = (round(x * s3), round(y * s3), round((x + w) * s3), round((y + h) * s3))
k = np.dstack([f3, (np.clip(a3, 0, 1) * 255).astype(np.uint8)])[box3[1]:box3[3], box3[0]:box3[2]]
Image.fromarray(k).save(os.path.join(SRC, 'layer-kitchen.png'))
# пещера: проём залит тёмным с мягкой внутренней тенью
dark = np.array([12, 7, 9], np.float32)
hole = cv2.GaussianBlur(cv2.erode(mask, np.ones((17, 17), np.uint8)).astype(np.float32), (0, 0), 3)[..., None]  # провал уже кухни: в покое не виден, темнота только при сдвиге
f3f = f3.astype(np.float32); h3 = cv2.resize(hole, (f3.shape[1], f3.shape[0]))[..., None]
cave = f3f * (1 - h3) + dark * h3
Image.fromarray(cave.astype(np.uint8)).save(os.path.join(SRC, 'layer-cave.png'))
json.dump({'x': x, 'y': y, 'w': w, 'h': h, 'badge': {'x': 1961, 'y': 1048, 'r': 40}}, open(os.path.join(SRC, 'layer-kitchen.json'), 'w'))
print('kitchen box', x, y, w, h)
if len(sys.argv) > 1:
    S = sys.argv[1]
    c = Image.fromarray(cave.astype(np.uint8)).resize((1440, 602))
    kk = Image.fromarray(k).resize((round(w / 2), round(h / 2)))
    shot = c.convert('RGBA'); shot.alpha_composite(kk.convert('RGBA'), (round(x / 2) + 6, round(y / 2) + 4))
    shot.convert('RGB').save(S + '/layers-shift.jpg', quality=85)
