"""Список всех артов игры: имя файла, размер, промт. Разработчик: @yfeeeee"""

STYLE = ("hand-painted 2D game art, dark-fantasy mining theme, rich painterly textures, crisp readable silhouette, "
         "dramatic rim lighting, warm amber highlights against cool cave tones, highly detailed, polished mobile game asset, "
         "consistent art style across the whole set")
KEY = ("isolated on a flat solid pure magenta #FF00FF background, no ground, no cast shadow, centered with small margin, "
       "whole object fully visible")
NEG = ("text, letters, watermark, signature, logo, frame, border, UI, blurry, low resolution, cropped, multiple objects, "
       "duplicate, realistic photo, flat vector, simple geometric shapes, extra limbs, deformed")

# (id, имя, описание для промта)
BIOMES = [
    ("clay", "Глиняные пещеры",
     "narrow underground tunnel carved in warm brown clay and packed earth, exposed tree roots, scattered bones, "
     "small copper ore veins glinting, wooden mine supports, dim lantern light, dust in the air"),
    ("fungus", "Грибной грот",
     "huge underground cavern full of giant glowing mushrooms, teal and green bioluminescent spores floating, "
     "damp mossy rock walls, spider webs, iron ore streaks, mysterious fog"),
    ("crystal", "Кристальные штольни",
     "deep mine tunnels lined with enormous glowing blue and violet crystals, silver veins in dark rock, "
     "reflections and light rays, cold sparkling atmosphere, ancient abandoned rails"),
    ("magma", "Магмовые недра",
     "volcanic cavern with rivers of glowing orange lava, cracked black obsidian walls, rising embers and ash, "
     "gold veins in rock, intense red-orange glow, heat haze"),
    ("abyss", "Бездна",
     "bottomless alien abyss tunnel, dark purple void energy, floating stone fragments, glowing star-like diamonds "
     "embedded in black rock, eerie violet mist, ancient titan ruins barely visible"),
]

DRILL = ("a heavy steampunk mining drill machine seen from the front, sturdy riveted brass and steel body with a small "
         "glass cockpit, glowing amber engine core, pistons and gears, a round empty socket at the very bottom center "
         "where a drill auger attaches, pointing downward, rugged and powerful")

AUGERS = [
    "old rusty iron screw auger, orange rust, chipped spiral threads, worn and humble",
    "copper spiral auger, shiny orange-brown copper threads with green patina spots",
    "auger made from bone and teeth of ancient beasts, ivory spiral with bone spikes, tied with leather straps",
    "black coal-forged auger, dark metal spiral with glowing ember cracks",
    "hardened steel auger, bluish tempered spiral threads, reinforced collar, neat and strong",
    "miner's master reaper auger, steel and copper hybrid with wide serrated blades, foreman's emblem engraved",
    "mushroom-themed auger, spiral threads of glowing green fungal chitin, spore pods on the edges",
    "light and fast chitin auger, sleek brown-gold insect-shell spiral, thin and sharp",
    "heavy iron spiral auger, thick gray forged threads, rivets, brute strength",
    "fungal reaper auger, wide curved blades covered in glowing mushroom caps and spore clouds",
    "spider-silk auger, spiral wrapped in sticky glowing webbing, pale silver-blue fangs on the threads",
    "mycelium living spiral auger, organic twisting roots fused with metal, bioluminescent teal glow",
    "quartz crystal auger, clear faceted crystal spiral, prismatic light refraction",
    "polished silver auger, bright mirror-silver spiral threads, elegant engravings",
    "moonstone auger, pale lavender glowing spiral, soft moonlight aura, runes",
    "prism spiral auger, rainbow-refracting crystal threads splitting light into beams",
    "echo drill bit, sonic-wave shaped spiral with ringing rings of blue energy, tuning-fork details",
    "crystal reaper auger, huge jagged crystal blades in electric blue, radiant and majestic",
    "magmite auger, glowing molten orange spiral with black rock crust cracking open",
    "obsidian auger, razor-sharp black volcanic glass spiral with red edge glow",
    "golden auger, ornate gleaming gold spiral set with small rubies, luxurious yet battle-ready",
    "ashcutter auger, charred dark spiral blades trailing smoke and falling ash, red embers",
    "lava vortex auger, spiral made of swirling liquid fire held by a metal cage",
    "volcanic reaper auger, giant jagged blades of magma rock and flame, fearsome",
    "abyss auger, dark void-purple spiral with swirling cosmic energy inside the threads",
    "heart drill, spiral that wraps a beating crimson titan heart crystal, pulsing red-violet glow",
    "star drill bit, spiral of white-blue stardust and tiny stars, diamond tip blazing",
    "devourer auger, spiral with fanged maw-like blades, dripping dark energy, predator design",
    "titan spiral auger, massive ancient gold-and-obsidian threads with titan runes glowing crimson",
    "crown of the abyss auger, the ultimate auger: regal spiral crowned with floating void-purple and star-white jewels, epic aura",
]

MONSTERS = [
    ("worm", "giant earthworm monster with a toothy round mouth, pinkish-brown segmented body rising from soil"),
    ("rat", "huge feral cave rat with sharp yellow incisors, matted fur, glowing red eyes, hunched aggressive pose"),
    ("skel_miner", "undead skeleton miner wearing a battered helmet with a lamp, holding a rusty pickaxe, tattered clothes"),
    ("queen_worm", "colossal queen worm boss, armored segmented body, huge gaping maw ringed with teeth, eggs on her back, towering menacing"),
    ("spore_walker", "walking fungus creature with a big mushroom cap head, glowing green spores puffing out, stubby legs"),
    ("shroom_beetle", "armored beetle with mushrooms growing on its shell, large mandibles, bronze chitin plates"),
    ("web_weaver", "giant cave spider with a glowing web pattern on its back, long legs, many eyes, spinning silk"),
    ("mycelium_king", "mushroom king boss, massive fungal body with a crown-like cap, tendrils, glowing eyes, spore cloud, regal and terrifying"),
    ("crystal_crawler", "crawling creature made of blue crystal shards, many sharp legs, glowing core inside"),
    ("echo_bat", "large cave bat with translucent wings and sonic rings emanating from its mouth, pale blue fur"),
    ("miner_ghost", "translucent ghost of a dead miner with a helmet lamp, sorrowful glowing eyes, wisp tail, holding a pick"),
    ("crystal_warden", "crystal golem warden boss, towering humanoid of faceted crystal and silver armor, glowing violet heart, huge fists"),
    ("salamander", "fire salamander, black skin with glowing lava cracks, flames along its back, hissing"),
    ("magma_golem", "stocky magma golem, molten rock body with obsidian plates, lava dripping, glowing eyes"),
    ("ash_fiend", "small horned ash demon, charred skin, burning embers around, wicked grin, gold coins in its claws"),
    ("ash_lord", "lord of ash boss, enormous horned demon king, obsidian armor, burning cloak of ash, sword of fire, terrifying presence"),
    ("shadow_worm", "shadow worm from the void, black serpentine body with violet glowing rings, many small eyes, mist"),
    ("abyss_eye", "floating giant eye of the abyss, tentacles of dark energy, purple iris with star shapes, veined eyeball"),
    ("void_knight", "void knight in dark armor with a hollow glowing violet helmet, cosmic cape, greatsword leaking void energy"),
    ("world_eater", "world eater final boss, cosmic colossal worm-dragon with galaxy-filled maw, titan rune scars, floating debris, epic and horrifying"),
]

RESOURCES = [
    ("copper", "raw copper ore chunk, orange metal with green oxidation"),
    ("bone", "cluster of ancient yellowed bone shards"),
    ("coal", "pile of shiny black coal lumps with faint ember glints"),
    ("spore", "glowing green spore dust in a small pile with floating motes"),
    ("chitin", "curved brown-gold insect chitin plate, glossy"),
    ("iron", "rough raw iron ore chunk, gray metal with rust"),
    ("crystal", "bright blue crystal cluster, faceted and glowing"),
    ("silver", "silver ore nugget, shining white-silver"),
    ("moon", "pale lavender moonstone gem, glowing softly"),
    ("magmite", "glowing orange magmite rock with lava veins"),
    ("obsidian", "sharp black obsidian shard with red-violet sheen"),
    ("gold", "gold nugget, bright shining yellow gold"),
    ("void", "swirling purple void essence orb with cosmic wisps"),
    ("titan", "crimson titan heart crystal, pulsing glow, ancient runes"),
    ("diamond", "radiant white-blue star diamond, perfect cut, sparkle"),
]

UPGRADES = [
    ("armor", "heavy riveted steel armor plate for a drilling machine"),
    ("regen", "repair wrench with glowing green nanite sparks"),
    ("power", "amber energy engine core with lightning arcs"),
    ("tap", "big iron sledgehammer with glowing impact mark"),
    ("dig", "turbine engine with gears and speed motion lines"),
    ("luck", "mining scanner with a radar dish and glowing four-leaf clover symbol"),
    ("crit", "razor-sharp drill tooth with a sparkle and red critical glow"),
]

# (путь относительно assets/, размер, тип)
def entries():
    out = []
    out.append(("drill/body.png", (720, 800), "key", f"{DRILL}, {KEY}"))
    for i, d in enumerate(AUGERS):
        out.append((f"augers/a{i:02d}.png", (360, 560), "key",
                    f"vertical drill auger bit seen from the side, the pointed tip faces DOWN, the top end has a round attachment collar, "
                    f"{d}, tall narrow composition, {KEY}"))
    for mid, d in MONSTERS:
        out.append((f"monsters/{mid}.png", (680, 680), "key", f"fantasy monster front view, menacing but slightly stylized, {d}, {KEY}"))
    for rid, d in RESOURCES:
        out.append((f"resources/{rid}.png", (256, 256), "key", f"game item icon, {d}, centered, {KEY}"))
    for uid, d in UPGRADES:
        out.append((f"upgrades/{uid}.png", (256, 256), "key", f"game upgrade icon, {d}, {KEY}"))
    for bid, name, d in BIOMES:
        out.append((f"backgrounds/{bid}.png", (720, 1280), "bg",
                    f"vertical 9:16 side-view of {d}, a central open vertical shaft free of clutter so a drill can pass through the middle, "
                    f"darker edges, seamlessly tileable top to bottom, no characters, no text"))
    ui = [
        ("panel", "ornate dark wooden and iron card frame, 9-slice friendly, empty dark brown inner area, thin bronze border, riveted corners"),
        ("button", "chunky bronze and amber button plate, riveted, glowing warm edge, empty center, 9-slice friendly"),
        ("button_hover", "chunky bronze and amber button plate, brighter lit variant, empty center"),
        ("button_pressed", "chunky bronze and amber button plate, darker pressed-in variant, empty center"),
        ("button_dis", "chunky dull gray-brown button plate, disabled look, empty center"),
        ("button_ok", "chunky green-bronze button plate, emerald glow, empty center"),
        ("tab", "dark iron tab bar segment, subtle bronze outline, empty center"),
        ("tab_sel", "iron tab bar segment, selected state with glowing amber outline, empty center"),
        ("header", "dark iron top bar texture with bronze bottom edge, empty center"),
        ("bar_bg", "dark recessed metal progress bar trough, thin bronze rim, empty"),
    ]
    for uid, d in ui:
        out.append((f"ui/{uid}.png", (256, 128) if uid != "header" else (720, 150), "ui",
                    f"flat front-facing UI skin element, {d}, no text, no icons, centered on plain flat background"))
    out.append(("../icon.png", (512, 512), "icon",
                "square mobile game app icon: a glowing golden drill auger bit pointing down piercing dark rock, "
                "fiery amber light, monster eyes glowing in the dark below, bold simple composition, vignette background, no text"))
    return out
