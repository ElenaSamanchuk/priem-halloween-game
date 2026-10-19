#!/usr/bin/env python3
"""Вырезает призрака из иллюстрации победы (assets-src/illus/win.png) в assets-src/ghost.png.
GrabCut по подсказкам «холодный белый» + выпуклая оболочка верхней части + мягкая альфа ткани."""
import sys, os, numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, 'assets-src/illus/win.png')).convert('RGB'); W, H = im.size
box = (int(W * .585), int(H * .06), int(W * .935), int(H * .66))
crop = np.asarray(im.crop(box))
sc = 0.5; small = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
bgr = cv2.cvtColor(small, cv2.COLOR_RGB2BGR); h, w = bgr.shape[:2]
a = small.astype(np.float32) / 255; R, G, B = a[..., 0], a[..., 1], a[..., 2]; lum = .3 * R + .59 * G + .11 * B; cool = B - R
mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
mask[(cool > 0) & (lum > .45)] = cv2.GC_PR_FGD
mask[(cool > .04) & (lum > .6)] = cv2.GC_FGD
mask[:6, :] = mask[-6:, :] = cv2.GC_BGD; mask[:, :6] = mask[:, -6:] = cv2.GC_BGD
mask[(R - B > .12)] = cv2.GC_BGD
bgd = np.zeros((1, 65)); fgd = np.zeros((1, 65))
cv2.grabCut(bgr, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8); m = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
ys, xs = np.nonzero(m); top, bot = ys.min(), ys.max(); cut = int(top + (bot - top) * .62)
hull = np.zeros_like(m); pts = np.column_stack([xs[ys <= cut], ys[ys <= cut]]).astype(np.int32)
cv2.fillConvexPoly(hull, cv2.convexHull(pts), 1); hull[cut + 1:, :] = 0
m = np.maximum(m, hull)
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); f = np.zeros_like(m); cv2.drawContours(f, cnts, -1, 1, -1)
f = cv2.resize(f.astype(np.float32), (crop.shape[1], crop.shape[0]), interpolation=cv2.INTER_LINEAR)
# левый край головы на фоне светлого шкафа автоматика не различает — контур задан вручную (координаты кропа)
EDGE = [(350, 120), (300, 170), (268, 230), (250, 300), (242, 380), (243, 480), (248, 580), (255, 660), (263, 730), (262, 790), (240, 840), (200, 870)]
bg_poly = np.array([(0, 0), (350, 0)] + EDGE[:9] + [(262, 780), (0, 780)], np.int32)
fg_poly = np.array(EDGE[:-2] + [(420, 790), (420, 120)], np.int32)
hard = np.zeros(f.shape, np.uint8); cv2.fillPoly(hard, [fg_poly], 1)
f = np.maximum(f, hard.astype(np.float32))
cut_bg = np.zeros(f.shape, np.uint8); cv2.fillPoly(cut_bg, [bg_poly, np.array([(0, 700), (100, 700), (102, 800), (100, 850), (52, 875), (0, 875)], np.int32), np.array([(108, 780), (258, 780), (250, 840), (205, 868), (168, 858), (160, 805), (140, 792), (115, 795)], np.int32)], 1)
f[cut_bg > 0] = 0
f = cv2.GaussianBlur(f, (0, 0), 2.5)
A = crop.astype(np.float32) / 255; L = .3 * A[..., 0] + .59 * A[..., 1] + .11 * A[..., 2]
op = np.clip(.5 + .6 * (L - .35), .45, .97); op[L < .3] = .92
# тёплый фон, просвечивающий сквозь ткань, приглушаем к холодному белому
cold = np.stack([L * .97, L * 1.0, L * 1.05], -1)
rgb = A * .55 + cold * .45; rgb[L < .3] = A[L < .3]
out = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), f * op]) * 255).astype(np.uint8))
out = out.crop(out.getbbox()); out.save(os.path.join(ROOT, 'assets-src/ghost.png')); print(out.size)
if len(sys.argv) > 1:
    S = sys.argv[1]
    tiles = []
    for bg in ((19, 12, 14), (90, 70, 55)):
        c = Image.new('RGBA', out.size, bg + (255,)); c.alpha_composite(out); tiles.append(c.convert('RGB').resize((out.width // 3, out.height // 3)))
    s = Image.new('RGB', (tiles[0].width * 2 + 10, tiles[0].height), 'white'); s.paste(tiles[0], (0, 0)); s.paste(tiles[1], (tiles[0].width + 10, 0)); s.save(S + '/ghost-test.jpg')
