"""Генерирует ASSETS.md и prompts.json из manifest.py. Запуск: python3 tools/gen_prompts.py  (@yfeeeee)"""
import json, os
import manifest as M

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = M.entries()
rows = [{"file": "assets/" + p, "size": f"{s[0]}x{s[1]}", "kind": k, "prompt": f"{M.STYLE}, {d}"} for p, s, k, d in E]
json.dump({"style": M.STYLE, "negative": M.NEG, "items": rows}, open(os.path.join(root, "tools", "prompts.json"), "w"),
          ensure_ascii=False, indent=1)

def section(title, prefix):
    out = [f"\n## {title}\n"]
    for r in rows:
        if r["file"].startswith(prefix):
            out.append(f"### `{r['file']}` — {r['size']}\n```\n{r['prompt']}\n```\n")
    return "\n".join(out)

md = f"""# Арт для «Бурильщик: Глубь» — промты и файлы
Разработчик: @yfeeeee

Игра уже умеет загружать всё из `assets/`. Пока файла нет — рисуется временная светящаяся заглушка с подписью.
Положите готовые PNG в `assets/…` под **точно такими именами** — игра подхватит их сама (звуки/музыка — по желанию).

## Как делать быстро (рекомендуемый порядок)
1. Сгенерируйте всё в одном генераторе (Midjourney / Flux / SDXL / DALL·E / Leonardo / Ideogram), чтобы стиль совпал.
   Для Midjourney добавляйте `--ar 1:1` (иконки, монстры), `--ar 9:16` (фоны), `--ar 2:3` (шнеки) и `--no` из блока «Negative».
2. Предметы генерируются на **сплошном пурпурном фоне #FF00FF** — потом он вырезается автоматически.
3. Сложите картинки в папку `raw/` с **теми же подпапками и именами**, что в списке ниже (пример: `raw/augers/a05.png`, `raw/monsters/worm.png`, `raw/backgrounds/fungus.png`, `raw/ui/panel.png`; иконка приложения — `raw/icon.png`). Расширение любое: png/jpg/webp.
4. Запустите: `python3 tools/process_assets.py raw` — скрипт вырежет фон, обрежет поля, приведёт к нужному размеру и положит в `assets/`.
5. Откройте проект в Godot (или соберите APK в GitHub Actions) — арт появится в игре.

## Общий стиль (вставляется в каждый промт)
```
{M.STYLE}
```
## Negative prompt (общий)
```
{M.NEG}
```
Советы по единству стиля: фиксируйте seed/стиль-референс (`--sref` в Midjourney или IP-Adapter), генерируйте набор одной сессией,
для монстров и шнеков просите «front view» и «tip facing DOWN» — иначе шнеки выйдут повёрнутыми.

## Важные требования
- **Шнеки** (`augers/aXX.png`): вертикально, остриё строго **вниз**, сверху круглый воротник крепления; по ним строится крепление к буру.
- **Бур** (`drill/body.png`): снизу по центру — пустое гнездо, шнек крепится сразу под ним.
- **Монстры**: вид спереди, силуэт читаемый, босс заметно больше и грознее обычных.
- **Фоны**: вертикальный бесшовный тайл (верх стыкуется с низом), в центре свободная «шахта» без деталей.
- **UI-плашки**: без текста и иконок; границы по 28 px не растягиваются (9-slice).
- Все ресурсы 15 + улучшения 7 — иконки 256×256, чёткий силуэт даже при размере 40 px.

## Звук (необязательно, `.ogg`)
Положите в `assets/sfx/`: `hit, crit, kill, drop, buy, boss, click, hull, prestige` и в `assets/music/`: `clay, fungus, crystal, magma, abyss` (зацикленные).
Промты для ElevenLabs SFX / Suno:
- hit: "short heavy metal drill hit on rock, crunchy, game sfx"
- crit: "powerful drill critical strike with sparks and deep impact, game sfx"
- kill: "monster defeated, quick crunchy squish with rocky crumble, game sfx"
- drop: "small bright ore coin pickup chime, game sfx"
- buy: "satisfying upgrade purchase, anvil clink with magical shimmer"
- boss: "deep ominous boss roar with rumbling cave, 2 seconds"
- hull: "metal machine overload, alarm and rock collapse"
- prestige: "epic rising magical rebirth whoosh with choir"
- музыка биома: "loopable ambient dark-fantasy underground exploration music, <биом: dripping caves / glowing mushroom wonder / crystalline chimes / volcanic drums / eerie void choir>, no vocals, 90 seconds seamless loop"
""" + section("Бур", "assets/drill/") + section("Шнеки (30)", "assets/augers/") \
    + section("Монстры (20, включая 5 боссов)", "assets/monsters/") + section("Ресурсы (15)", "assets/resources/") \
    + section("Иконки улучшений (7)", "assets/upgrades/") + section("Фоны биомов (5)", "assets/backgrounds/") \
    + section("Элементы интерфейса", "assets/ui/") + section("Иконка приложения", "assets/../icon")

open(os.path.join(root, "ASSETS.md"), "w", encoding="utf-8").write(md)
print(len(rows), "items ->", "ASSETS.md, tools/prompts.json")
