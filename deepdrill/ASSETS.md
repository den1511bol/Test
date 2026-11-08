# Арт для «Бурильщик: Глубь» — промты и файлы
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
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set
```
## Negative prompt (общий)
```
text, letters, watermark, signature, logo, frame, border, UI, blurry, low resolution, cropped, multiple objects, duplicate, realistic photo, flat vector, simple geometric shapes, extra limbs, deformed
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

## Бур

### `assets/drill/body.png` — 720x800
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, a heavy steampunk mining drill machine seen from the front, sturdy riveted brass and steel body with a small glass cockpit, glowing amber engine core, pistons and gears, a round empty socket at the very bottom center where a drill auger attaches, pointing downward, rugged and powerful, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

## Шнеки (30)

### `assets/augers/a00.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, old rusty iron screw auger, orange rust, chipped spiral threads, worn and humble, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a01.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, copper spiral auger, shiny orange-brown copper threads with green patina spots, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a02.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, auger made from bone and teeth of ancient beasts, ivory spiral with bone spikes, tied with leather straps, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a03.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, black coal-forged auger, dark metal spiral with glowing ember cracks, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a04.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, hardened steel auger, bluish tempered spiral threads, reinforced collar, neat and strong, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a05.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, miner's master reaper auger, steel and copper hybrid with wide serrated blades, foreman's emblem engraved, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a06.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, mushroom-themed auger, spiral threads of glowing green fungal chitin, spore pods on the edges, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a07.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, light and fast chitin auger, sleek brown-gold insect-shell spiral, thin and sharp, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a08.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, heavy iron spiral auger, thick gray forged threads, rivets, brute strength, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a09.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, fungal reaper auger, wide curved blades covered in glowing mushroom caps and spore clouds, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a10.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, spider-silk auger, spiral wrapped in sticky glowing webbing, pale silver-blue fangs on the threads, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a11.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, mycelium living spiral auger, organic twisting roots fused with metal, bioluminescent teal glow, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a12.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, quartz crystal auger, clear faceted crystal spiral, prismatic light refraction, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a13.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, polished silver auger, bright mirror-silver spiral threads, elegant engravings, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a14.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, moonstone auger, pale lavender glowing spiral, soft moonlight aura, runes, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a15.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, prism spiral auger, rainbow-refracting crystal threads splitting light into beams, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a16.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, echo drill bit, sonic-wave shaped spiral with ringing rings of blue energy, tuning-fork details, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a17.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, crystal reaper auger, huge jagged crystal blades in electric blue, radiant and majestic, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a18.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, magmite auger, glowing molten orange spiral with black rock crust cracking open, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a19.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, obsidian auger, razor-sharp black volcanic glass spiral with red edge glow, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a20.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, golden auger, ornate gleaming gold spiral set with small rubies, luxurious yet battle-ready, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a21.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, ashcutter auger, charred dark spiral blades trailing smoke and falling ash, red embers, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a22.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, lava vortex auger, spiral made of swirling liquid fire held by a metal cage, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a23.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, volcanic reaper auger, giant jagged blades of magma rock and flame, fearsome, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a24.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, abyss auger, dark void-purple spiral with swirling cosmic energy inside the threads, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a25.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, heart drill, spiral that wraps a beating crimson titan heart crystal, pulsing red-violet glow, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a26.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, star drill bit, spiral of white-blue stardust and tiny stars, diamond tip blazing, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a27.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, devourer auger, spiral with fanged maw-like blades, dripping dark energy, predator design, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a28.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, titan spiral auger, massive ancient gold-and-obsidian threads with titan runes glowing crimson, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/augers/a29.png` — 360x560
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, crown of the abyss auger, the ultimate auger: regal spiral crowned with floating void-purple and star-white jewels, epic aura, tall narrow composition, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

## Монстры (20, включая 5 боссов)

### `assets/monsters/worm.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, giant earthworm monster with a toothy round mouth, pinkish-brown segmented body rising from soil, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/rat.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, huge feral cave rat with sharp yellow incisors, matted fur, glowing red eyes, hunched aggressive pose, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/skel_miner.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, undead skeleton miner wearing a battered helmet with a lamp, holding a rusty pickaxe, tattered clothes, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/queen_worm.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, colossal queen worm boss, armored segmented body, huge gaping maw ringed with teeth, eggs on her back, towering menacing, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/spore_walker.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, walking fungus creature with a big mushroom cap head, glowing green spores puffing out, stubby legs, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/shroom_beetle.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, armored beetle with mushrooms growing on its shell, large mandibles, bronze chitin plates, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/web_weaver.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, giant cave spider with a glowing web pattern on its back, long legs, many eyes, spinning silk, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/mycelium_king.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, mushroom king boss, massive fungal body with a crown-like cap, tendrils, glowing eyes, spore cloud, regal and terrifying, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/crystal_crawler.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, crawling creature made of blue crystal shards, many sharp legs, glowing core inside, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/echo_bat.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, large cave bat with translucent wings and sonic rings emanating from its mouth, pale blue fur, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/miner_ghost.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, translucent ghost of a dead miner with a helmet lamp, sorrowful glowing eyes, wisp tail, holding a pick, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/crystal_warden.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, crystal golem warden boss, towering humanoid of faceted crystal and silver armor, glowing violet heart, huge fists, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/salamander.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, fire salamander, black skin with glowing lava cracks, flames along its back, hissing, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/magma_golem.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, stocky magma golem, molten rock body with obsidian plates, lava dripping, glowing eyes, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/ash_fiend.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, small horned ash demon, charred skin, burning embers around, wicked grin, gold coins in its claws, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/ash_lord.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, lord of ash boss, enormous horned demon king, obsidian armor, burning cloak of ash, sword of fire, terrifying presence, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/shadow_worm.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, shadow worm from the void, black serpentine body with violet glowing rings, many small eyes, mist, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/abyss_eye.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, floating giant eye of the abyss, tentacles of dark energy, purple iris with star shapes, veined eyeball, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/void_knight.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, void knight in dark armor with a hollow glowing violet helmet, cosmic cape, greatsword leaking void energy, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/monsters/world_eater.png` — 680x680
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, fantasy monster front view, menacing but slightly stylized, world eater final boss, cosmic colossal worm-dragon with galaxy-filled maw, titan rune scars, floating debris, epic and horrifying, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

## Ресурсы (15)

### `assets/resources/copper.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, raw copper ore chunk, orange metal with green oxidation, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/bone.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, cluster of ancient yellowed bone shards, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/coal.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, pile of shiny black coal lumps with faint ember glints, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/spore.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, glowing green spore dust in a small pile with floating motes, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/chitin.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, curved brown-gold insect chitin plate, glossy, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/iron.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, rough raw iron ore chunk, gray metal with rust, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/crystal.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, bright blue crystal cluster, faceted and glowing, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/silver.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, silver ore nugget, shining white-silver, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/moon.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, pale lavender moonstone gem, glowing softly, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/magmite.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, glowing orange magmite rock with lava veins, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/obsidian.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, sharp black obsidian shard with red-violet sheen, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/gold.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, gold nugget, bright shining yellow gold, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/void.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, swirling purple void essence orb with cosmic wisps, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/titan.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, crimson titan heart crystal, pulsing glow, ancient runes, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/resources/diamond.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game item icon, radiant white-blue star diamond, perfect cut, sparkle, centered, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

## Иконки улучшений (7)

### `assets/upgrades/armor.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, heavy riveted steel armor plate for a drilling machine, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/regen.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, repair wrench with glowing green nanite sparks, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/power.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, amber energy engine core with lightning arcs, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/tap.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, big iron sledgehammer with glowing impact mark, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/dig.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, turbine engine with gears and speed motion lines, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/luck.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, mining scanner with a radar dish and glowing four-leaf clover symbol, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

### `assets/upgrades/crit.png` — 256x256
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, game upgrade icon, razor-sharp drill tooth with a sparkle and red critical glow, isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, whole object fully visible
```

## Фоны биомов (5)

### `assets/backgrounds/clay.png` — 720x1280
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical 9:16 side-view of narrow underground tunnel carved in warm brown clay and packed earth, exposed tree roots, scattered bones, small copper ore veins glinting, wooden mine supports, dim lantern light, dust in the air, a central open vertical shaft free of clutter so a drill can pass through the middle, darker edges, seamlessly tileable top to bottom, no characters, no text
```

### `assets/backgrounds/fungus.png` — 720x1280
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical 9:16 side-view of huge underground cavern full of giant glowing mushrooms, teal and green bioluminescent spores floating, damp mossy rock walls, spider webs, iron ore streaks, mysterious fog, a central open vertical shaft free of clutter so a drill can pass through the middle, darker edges, seamlessly tileable top to bottom, no characters, no text
```

### `assets/backgrounds/crystal.png` — 720x1280
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical 9:16 side-view of deep mine tunnels lined with enormous glowing blue and violet crystals, silver veins in dark rock, reflections and light rays, cold sparkling atmosphere, ancient abandoned rails, a central open vertical shaft free of clutter so a drill can pass through the middle, darker edges, seamlessly tileable top to bottom, no characters, no text
```

### `assets/backgrounds/magma.png` — 720x1280
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical 9:16 side-view of volcanic cavern with rivers of glowing orange lava, cracked black obsidian walls, rising embers and ash, gold veins in rock, intense red-orange glow, heat haze, a central open vertical shaft free of clutter so a drill can pass through the middle, darker edges, seamlessly tileable top to bottom, no characters, no text
```

### `assets/backgrounds/abyss.png` — 720x1280
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, vertical 9:16 side-view of bottomless alien abyss tunnel, dark purple void energy, floating stone fragments, glowing star-like diamonds embedded in black rock, eerie violet mist, ancient titan ruins barely visible, a central open vertical shaft free of clutter so a drill can pass through the middle, darker edges, seamlessly tileable top to bottom, no characters, no text
```

## Элементы интерфейса

### `assets/ui/panel.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, ornate dark wooden and iron card frame, 9-slice friendly, empty dark brown inner area, thin bronze border, riveted corners, no text, no icons, centered on plain flat background
```

### `assets/ui/button.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, chunky bronze and amber button plate, riveted, glowing warm edge, empty center, 9-slice friendly, no text, no icons, centered on plain flat background
```

### `assets/ui/button_hover.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, chunky bronze and amber button plate, brighter lit variant, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/button_pressed.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, chunky bronze and amber button plate, darker pressed-in variant, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/button_dis.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, chunky dull gray-brown button plate, disabled look, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/button_ok.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, chunky green-bronze button plate, emerald glow, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/tab.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, dark iron tab bar segment, subtle bronze outline, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/tab_sel.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, iron tab bar segment, selected state with glowing amber outline, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/header.png` — 720x150
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, dark iron top bar texture with bronze bottom edge, empty center, no text, no icons, centered on plain flat background
```

### `assets/ui/bar_bg.png` — 256x128
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, flat front-facing UI skin element, dark recessed metal progress bar trough, thin bronze rim, empty, no text, no icons, centered on plain flat background
```

## Иконка приложения

### `assets/../icon.png` — 512x512
```
hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, consistent art style across the whole set, square mobile game app icon: a glowing golden drill auger bit pointing down piercing dark rock, fiery amber light, monster eyes glowing in the dark below, bold simple composition, vignette background, no text
```
