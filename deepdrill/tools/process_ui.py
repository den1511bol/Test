#!/usr/bin/env python3
"""UI-рамки на сером фоне -> 9-slice текстуры для Godot + assets/ui/margins.json.
Убирает фон заливкой от краёв, вырезает средние украшения (чтобы не растягивались),
уменьшает так, чтобы угол рамки был ~corner px. Разработчик: @yfeeeee"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# kind: (cut_x, cut_y, margin_x, margin_y, corner_px)   — доли от размеров рамки
FRAME = ((0.33, 0.67), (0.32, 0.66), 0.22, 0.29, 30)
SPEC = {
    "button": FRAME, "button_hover": FRAME, "button_pressed": FRAME, "button_dis": FRAME, "button_ok": FRAME,
    "panel": ((0.36, 0.64), (0.20, 0.80), 0.23, 0.16, 30),
    "tab": (None, None, 0.11, 0.30, 22), "tab_sel": (None, None, 0.11, 0.30, 22),
    "header": (None, None, 0.11, 0.30, 26), "bar_bg": (None, None, 0.09, 0.30, 12),
}


def key_bg(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    near = (np.abs(a - bg).max(axis=2) < 22)
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    out = np.isin(lab, list(edge))
    alpha = np.where(out, 0, 255).astype(np.uint8)
    alpha = ndimage.binary_erosion(alpha > 0, iterations=1).astype(np.uint8) * 255  # снять серую кайму
    rgba = np.dstack([a.astype(np.uint8), alpha])
    img = Image.fromarray(rgba, "RGBA")
    return img.crop(img.getchannel("A").getbbox())


def cut(img, cx, cy):
    w, h = img.size
    if cx:
        l, r = int(w * cx[0]), int(w * cx[1])
        n = Image.new("RGBA", (l + w - r, h)); n.paste(img.crop((0, 0, l, h)), (0, 0)); n.paste(img.crop((r, 0, w, h)), (l, 0)); img = n
    w, h = img.size
    if cy:
        t, b = int(h * cy[0]), int(h * cy[1])
        n = Image.new("RGBA", (w, t + h - b)); n.paste(img.crop((0, 0, w, t)), (0, 0)); n.paste(img.crop((0, b, w, h)), (0, t)); img = n
    return img


def main(raw):
    out_dir = os.path.join(ROOT, "assets", "ui"); os.makedirs(out_dir, exist_ok=True)
    margins = {}
    for kind, (cx, cy, mx, my, corner) in SPEC.items():
        src = os.path.join(raw, kind + ".png")
        if not os.path.exists(src):
            continue
        img = key_bg(Image.open(src))
        W, H = img.size
        mpx_x, mpx_y = W * mx, H * my                     # поля в пикселях оригинала
        img = cut(img, cx, cy)
        s = corner / mpx_y if kind in ("tab", "tab_sel", "header", "bar_bg") else corner / max(mpx_x, mpx_y)
        img = img.resize((max(4, round(img.size[0] * s)), max(4, round(img.size[1] * s))), Image.LANCZOS)
        img.save(os.path.join(out_dir, kind + ".png"))
        margins[kind] = [round(mpx_x * s), round(mpx_y * s)]
        print("ok", kind, img.size, margins[kind])
    json.dump(margins, open(os.path.join(out_dir, "margins.json"), "w"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "raw/ui")
