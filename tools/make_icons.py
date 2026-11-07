#!/usr/bin/env python3
"""Генерация иконок Ashen Crown (корона). Запуск: python3 tools/make_icons.py
Developer: @yfeeeee"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4  # суперсэмплинг


def crown_layer(size, scale=1.0):
    """Корона на прозрачном фоне. scale — доля холста (для безопасной зоны адаптивной иконки)."""
    n = size * SS
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def P(x, y):
        # координаты 0..1 -> холст с учётом scale вокруг центра
        return ((0.5 + (x - 0.5) * scale) * n, (0.5 + (y - 0.49) * scale) * n)

    pts = [(0.20, 0.64), (0.16, 0.30), (0.34, 0.47), (0.50, 0.22), (0.66, 0.47), (0.84, 0.30), (0.80, 0.64)]
    body = Image.new('L', (n, n), 0)
    bd = ImageDraw.Draw(body)
    bd.polygon([P(*p) for p in pts], fill=255)
    bd.rounded_rectangle([P(0.20, 0.62), P(0.80, 0.76)], radius=int(0.025 * n), fill=255)

    # золотой градиент
    ys = np.linspace(0, 1, n)[:, None]
    top = np.array([253, 230, 138]); bot = np.array([217, 119, 6])
    grad = (top[None, None, :] * (1 - ys[:, :, None]) + bot[None, None, :] * ys[:, :, None]) * np.ones((1, n, 1))
    gold = Image.fromarray(grad.astype('uint8'), 'RGB').convert('RGBA')
    img.paste(gold, (0, 0), body)

    d = ImageDraw.Draw(img)
    # контур
    outline = body.filter(ImageFilter.MaxFilter(SS * 2 + 1))
    edge = Image.new('RGBA', (n, n), (120, 53, 15, 255))
    ring = Image.eval(Image.composite(outline, Image.new('L', (n, n), 0), outline), lambda v: v)
    mask = Image.new('L', (n, n), 0)
    mask.paste(outline, (0, 0))
    mask = Image.fromarray(np.clip(np.array(mask, dtype=int) - np.array(body, dtype=int), 0, 255).astype('uint8'))
    img.paste(edge, (0, 0), mask)

    # камни
    r = 0.032 * n * scale
    for (x, y, col) in [(0.16, 0.30, (239, 68, 68)), (0.50, 0.22, (59, 130, 246)), (0.84, 0.30, (239, 68, 68))]:
        cx, cy = P(x, y)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,), outline=(255, 255, 255, 255), width=max(1, SS))
    for i, x in enumerate([0.32, 0.50, 0.68]):
        cx, cy = P(x, 0.69)
        rr = 0.028 * n * scale
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(251, 113, 133, 255) if i != 1 else (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def background(size, shape='square'):
    n = size
    yy, xx = np.mgrid[0:n, 0:n] / n
    dist = np.sqrt((xx - 0.5) ** 2 + (yy - 0.78) ** 2)
    a = np.array([11, 13, 23]); b = np.array([124, 45, 18])
    t = np.clip(1 - dist * 1.5, 0, 1)[:, :, None]
    arr = (a * (1 - t) + b * t).astype('uint8')
    img = Image.fromarray(arr, 'RGB').convert('RGBA')
    if shape in ('rounded', 'circle'):
        m = Image.new('L', (n * 2, n * 2), 0)
        md = ImageDraw.Draw(m)
        if shape == 'circle':
            md.ellipse([0, 0, n * 2 - 1, n * 2 - 1], fill=255)
        else:
            md.rounded_rectangle([0, 0, n * 2 - 1, n * 2 - 1], radius=int(n * 2 * 0.22), fill=255)
        m = m.resize((n, n), Image.LANCZOS)
        out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        out.paste(img, (0, 0), m)
        return out
    return img


def compose(size, shape, scale):
    return Image.alpha_composite(background(size, shape), crown_layer(size, scale))


def save(img, rel):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, optimize=True)
    print('->', rel)


if __name__ == '__main__':
    # веб / манифест
    save(compose(192, 'rounded', 1.0), 'client/www/icons/icon-192.png')
    save(compose(512, 'rounded', 1.0), 'client/www/icons/icon-512.png')
    # Android: densities
    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for dens, s in legacy.items():
        save(compose(s, 'rounded', 1.0), f'client/resources/android/mipmap-{dens}/ic_launcher.png')
        save(compose(s, 'circle', 0.92), f'client/resources/android/mipmap-{dens}/ic_launcher_round.png')
    for dens, s in fg.items():
        # безопасная зона адаптивной иконки ~ 61% холста
        save(crown_layer(s, 0.62), f'client/resources/android/mipmap-{dens}/ic_launcher_foreground.png')
