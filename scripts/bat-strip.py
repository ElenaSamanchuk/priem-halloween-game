#!/usr/bin/env python3
"""Режет 8 кадров полёта сбоку из спрайта Елены (assets-src/bat-sprite.webp, ряд 2) в ленту для CSS steps().
Кадры выравниваются по мордочке (самая правая точка + её высота), чтобы при смене кадров не было дрожания."""
import os, sys, numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, 'assets-src/bat-sprite.webp')).convert('RGBA')
A = np.asarray(im); al = A[..., 3]
y0, y1 = 455, 675
import cv2
m = (al[y0:y1] > 20).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
comps = sorted([i for i in range(1, n) if st[i, 4] > 800], key=lambda i: st[i, 0])
print('кадров', len(comps))
frames = []
for i in comps:
    x, y, w, h = st[i, 0], st[i, 1], st[i, 2], st[i, 3]
    sub = A[y0 + y:y0 + y + h, x:x + w].copy()
    sub[..., 3] = np.where(lab[y:y + h, x:x + w] == i, sub[..., 3], 0)  # только своя мышь, без крыла соседа
    ys, xx = np.nonzero(sub[..., 3] > 20)
    rx = xx.max(); ry = int(np.median(ys[xx >= rx - 3]))
    frames.append((sub, rx, ry))
W = max(f[1] for f in frames) + 12
H = max(f[0].shape[0] + (max(fr[2] for fr in frames) - f[2]) for f in frames) + 12
anchor_y = max(f[2] for f in frames) + 6
strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
for i, (img, rx, ry) in enumerate(frames):
    fi = Image.fromarray(img)
    strip.alpha_composite(fi, (i * W + (W - 6 - rx), anchor_y - ry))
strip.save(os.path.join(ROOT, 'assets-src/bat-strip.png'))
print('лента', strip.size, 'кадр', W, H)
if len(sys.argv) > 1:
    bg = Image.new('RGBA', strip.size, (200, 180, 140, 255)); bg.alpha_composite(strip); bg.convert('RGB').save(sys.argv[1] + '/bat-strip-check.png')
