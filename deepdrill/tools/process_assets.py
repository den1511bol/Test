#!/usr/bin/env python3
"""Обработка сгенерированного арта: вырезает пурпурный фон (#FF00FF), обрезает поля, приводит к нужному размеру,
делает фоны бесшовными по вертикали и кладёт файлы в assets/.
Использование: python3 tools/process_assets.py raw      (raw/ повторяет структуру assets/)
Разработчик: @yfeeeee"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import manifest as M

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = (".png", ".jpg", ".jpeg", ".webp")


def find_source(raw, rel):
    base = os.path.splitext(rel.replace("../", ""))[0]
    for e in EXTS:
        p = os.path.join(raw, base + e)
        if os.path.exists(p):
            return p
    return None


def chroma_key(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    # расстояние до пурпурного, учитывая, что генераторы дают оттенки
    d = np.sqrt((a[..., 0] - 255) ** 2 + a[..., 1] ** 2 + (a[..., 2] - 255) ** 2)
    magenta_ness = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]      # высокий у пурпурного
    alpha = np.clip((d - 70.0) / 70.0, 0.0, 1.0)
    alpha = np.where(magenta_ness > 90, np.minimum(alpha, 0.0 + np.clip((d - 40) / 60.0, 0, 1)), alpha)
    # убираем пурпурную кайму: на полупрозрачных краях гасим R и B до уровня G
    edge = (alpha > 0) & (alpha < 1)
    for ch in (0, 2):
        a[..., ch] = np.where(edge, np.minimum(a[..., ch], a[..., 1] + 25), a[..., ch])
    out = np.dstack([a, alpha * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def drop_edge_junk(im):
    """Убирает мелкие обрезки других картинок у краёв (генераторы иногда их оставляют)."""
    try:
        from scipy import ndimage
    except ImportError:
        return im
    a = np.asarray(im).copy()
    mask = a[..., 3] > 30
    lab, n = ndimage.label(mask)
    if n < 2:
        return im
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    big = sizes.max()
    h, w = mask.shape
    bw, bh = int(w * 0.12), int(h * 0.12)
    band = np.zeros_like(mask)
    band[:bh] = band[-bh:] = True
    band[:, :bw] = band[:, -bw:] = True
    edge = set(np.unique(lab[band & mask])) - {0}
    for k in edge:
        inside = (lab == k)
        if sizes[k - 1] < big * 0.1 and (inside & band).sum() > 0.5 * sizes[k - 1]:
            a[lab == k, 3] = 0
    return Image.fromarray(a, "RGBA")


def fit_contain(im, size, margin=0.05):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = size
    iw, ih = im.size
    s = min(w * (1 - 2 * margin) / iw, h * (1 - 2 * margin) / ih)
    im = im.resize((max(1, round(iw * s)), max(1, round(ih * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(im, ((w - im.size[0]) // 2, (h - im.size[1]) // 2), im)
    return canvas


def fit_cover(im, size):
    w, h = size
    iw, ih = im.size
    s = max(w / iw, h / ih)
    im = im.resize((round(iw * s) + 1, round(ih * s) + 1), Image.LANCZOS)
    l, t = (im.size[0] - w) // 2, (im.size[1] - h) // 2
    return im.crop((l, t, l + w, t + h))


def make_seamless_v(im, band=0.14):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h = a.shape[0]
    b = int(h * band)
    for i in range(b):
        t = (i + 1) / b                     # к нижнему краю t -> 1: строка совпадает с верхней
        a[h - b + i] = a[h - b + i] * (1 - t) + a[i] * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGB")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    raw = sys.argv[1]
    done = missing = 0
    for rel, size, kind, _ in M.entries():
        src = find_source(raw, rel)
        dst = os.path.normpath(os.path.join(ROOT, "assets", rel))
        if not src:
            missing += 1
            continue
        im = Image.open(src)
        if kind == "key":
            out = fit_contain(drop_edge_junk(chroma_key(im)), size)
        elif kind == "bg":
            out = fit_cover(im.convert("RGB"), size)   # стык делает игра зеркалом
        else:                                  # ui, icon
            out = fit_cover(im.convert("RGBA" if kind == "ui" else "RGB"), size)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst)
        done += 1
        print("ok ", os.path.relpath(dst, ROOT))
    print(f"Готово: {done}, нет исходника: {missing}")


if __name__ == "__main__":
    main()
