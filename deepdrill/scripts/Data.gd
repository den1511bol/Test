extends Node
## Данные игры: биомы, ресурсы, монстры, шнеки, улучшения.
## Разработчик: @yfeeeee

const DEV := "@yfeeeee"
const GAME_NAME := "Бурильщик: Глубь"
const VERSION := "1.0.0"

const SUFFIX := ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"]

# ---------------------------------------------------------------- биомы
const BIOMES := [
	{"id": "clay",    "name": "Глиняные пещеры",    "start": 0.0,    "end": 100.0,  "color": Color("8a5a3c")},
	{"id": "fungus",  "name": "Грибной грот",       "start": 100.0,  "end": 300.0,  "color": Color("4f8f6a")},
	{"id": "crystal", "name": "Кристальные штольни", "start": 300.0,  "end": 600.0,  "color": Color("5aa8d8")},
	{"id": "magma",   "name": "Магмовые недра",     "start": 600.0,  "end": 1000.0, "color": Color("d8582a")},
	{"id": "abyss",   "name": "Бездна",             "start": 1000.0, "end": 1.0e9,  "color": Color("7a46c8")},
]
const BOSS_DEPTHS := [100.0, 300.0, 600.0, 1000.0]

# ---------------------------------------------------------------- ресурсы
# biome — индекс биома, где ресурс падает
const RES := {
	"copper":   {"name": "Медная руда",        "biome": 0, "color": Color("d98a4a")},
	"bone":     {"name": "Костяной осколок",   "biome": 0, "color": Color("e8e0c8")},
	"coal":     {"name": "Уголь",              "biome": 0, "color": Color("4a4a54")},
	"spore":    {"name": "Споровая пыль",      "biome": 1, "color": Color("9be07a")},
	"chitin":   {"name": "Хитин",              "biome": 1, "color": Color("b8863a")},
	"iron":     {"name": "Железная руда",      "biome": 1, "color": Color("9aa4b0")},
	"crystal":  {"name": "Кристалл",           "biome": 2, "color": Color("7fd8ff")},
	"silver":   {"name": "Серебро",            "biome": 2, "color": Color("d8dce8")},
	"moon":     {"name": "Лунный камень",      "biome": 2, "color": Color("b8a8ff")},
	"magmite":  {"name": "Магматит",           "biome": 3, "color": Color("ff7a3a")},
	"obsidian": {"name": "Обсидиан",           "biome": 3, "color": Color("3a2e4a")},
	"gold":     {"name": "Золото",             "biome": 3, "color": Color("ffd24a")},
	"void":     {"name": "Эссенция Бездны",    "biome": 4, "color": Color("a45cff")},
	"titan":    {"name": "Сердце титана",      "biome": 4, "color": Color("ff4a6a")},
	"diamond":  {"name": "Звёздный алмаз",     "biome": 4, "color": Color("c8f4ff")},
}
const RES_BY_BIOME := [
	["copper", "bone", "coal"],
	["spore", "chitin", "iron"],
	["crystal", "silver", "moon"],
	["magmite", "obsidian", "gold"],
	["void", "titan", "diamond"],
]

# ---------------------------------------------------------------- монстры
# hpf/atk — множители, drops: [ресурс, шанс, мин, макс]
const MONSTERS := [
	# биом 0
	{"id": "worm",      "name": "Земляной червь",       "biome": 0, "hpf": 0.8, "atk": 0.8, "boss": false,
		"drops": [["copper", 0.7, 1, 2], ["coal", 0.3, 1, 1]]},
	{"id": "rat",       "name": "Пещерный грызун",      "biome": 0, "hpf": 1.0, "atk": 1.0, "boss": false,
		"drops": [["bone", 0.55, 1, 2], ["copper", 0.25, 1, 1]]},
	{"id": "skel_miner", "name": "Скелет-шахтёр",       "biome": 0, "hpf": 1.3, "atk": 1.2, "boss": false,
		"drops": [["bone", 0.45, 1, 3], ["coal", 0.5, 1, 2], ["copper", 0.2, 1, 2]]},
	{"id": "queen_worm", "name": "Матка Червей",        "biome": 0, "hpf": 14.0, "atk": 1.0, "boss": true,
		"drops": [["copper", 1.0, 8, 14], ["bone", 1.0, 8, 14], ["coal", 1.0, 6, 10]]},
	# биом 1
	{"id": "spore_walker", "name": "Спороносец",        "biome": 1, "hpf": 0.9, "atk": 0.9, "boss": false,
		"drops": [["spore", 0.55, 1, 2], ["chitin", 0.25, 1, 1]]},
	{"id": "shroom_beetle", "name": "Грибной жук",      "biome": 1, "hpf": 1.1, "atk": 1.0, "boss": false,
		"drops": [["chitin", 0.55, 1, 2], ["iron", 0.25, 1, 1]]},
	{"id": "web_weaver", "name": "Паук-ткач",           "biome": 1, "hpf": 1.3, "atk": 1.2, "boss": false,
		"drops": [["iron", 0.5, 1, 2], ["spore", 0.3, 1, 2], ["chitin", 0.3, 1, 2]]},
	{"id": "mycelium_king", "name": "Король Мицелий",   "biome": 1, "hpf": 14.0, "atk": 1.0, "boss": true,
		"drops": [["spore", 1.0, 8, 14], ["chitin", 1.0, 8, 14], ["iron", 1.0, 8, 14]]},
	# биом 2
	{"id": "crystal_crawler", "name": "Кристальный ползун", "biome": 2, "hpf": 0.9, "atk": 0.9, "boss": false,
		"drops": [["crystal", 0.55, 1, 2], ["silver", 0.2, 1, 1]]},
	{"id": "echo_bat",  "name": "Эхо-нетопырь",         "biome": 2, "hpf": 1.0, "atk": 1.1, "boss": false,
		"drops": [["moon", 0.4, 1, 2], ["crystal", 0.3, 1, 2]]},
	{"id": "miner_ghost", "name": "Призрак шахтёра",    "biome": 2, "hpf": 1.3, "atk": 1.2, "boss": false,
		"drops": [["silver", 0.5, 1, 2], ["moon", 0.3, 1, 1], ["crystal", 0.3, 1, 2]]},
	{"id": "crystal_warden", "name": "Хрустальный Страж", "biome": 2, "hpf": 14.0, "atk": 1.0, "boss": true,
		"drops": [["crystal", 1.0, 8, 14], ["silver", 1.0, 8, 14], ["moon", 1.0, 8, 14]]},
	# биом 3
	{"id": "salamander", "name": "Огненный саламандр",  "biome": 3, "hpf": 0.9, "atk": 1.0, "boss": false,
		"drops": [["magmite", 0.55, 1, 2], ["obsidian", 0.25, 1, 1]]},
	{"id": "magma_golem", "name": "Магмовый голем",     "biome": 3, "hpf": 1.4, "atk": 1.1, "boss": false,
		"drops": [["obsidian", 0.55, 1, 2], ["magmite", 0.3, 1, 2]]},
	{"id": "ash_fiend", "name": "Пепельный бес",        "biome": 3, "hpf": 1.1, "atk": 1.3, "boss": false,
		"drops": [["gold", 0.45, 1, 2], ["magmite", 0.3, 1, 2], ["obsidian", 0.3, 1, 2]]},
	{"id": "ash_lord",  "name": "Повелитель Пепла",     "biome": 3, "hpf": 14.0, "atk": 1.0, "boss": true,
		"drops": [["magmite", 1.0, 8, 14], ["obsidian", 1.0, 8, 14], ["gold", 1.0, 8, 14]]},
	# биом 4
	{"id": "shadow_worm", "name": "Теневой червь",      "biome": 4, "hpf": 0.9, "atk": 1.0, "boss": false,
		"drops": [["void", 0.55, 1, 2], ["titan", 0.2, 1, 1]]},
	{"id": "abyss_eye", "name": "Око Бездны",           "biome": 4, "hpf": 1.1, "atk": 1.1, "boss": false,
		"drops": [["void", 0.4, 1, 2], ["diamond", 0.25, 1, 1], ["titan", 0.25, 1, 1]]},
	{"id": "void_knight", "name": "Рыцарь Пустоты",     "biome": 4, "hpf": 1.4, "atk": 1.3, "boss": false,
		"drops": [["titan", 0.5, 1, 2], ["diamond", 0.3, 1, 1], ["void", 0.3, 1, 2]]},
	{"id": "world_eater", "name": "Пожиратель Миров",   "biome": 4, "hpf": 14.0, "atk": 1.0, "boss": true,
		"drops": [["void", 1.0, 8, 14], ["titan", 1.0, 8, 14], ["diamond", 1.0, 8, 14]]},
]

# ---------------------------------------------------------------- шнеки (30 штук)
const AUGER_NAMES := [
	"Ржавый шнек", "Медная спираль", "Костяной бур", "Угольный бур", "Закалённый шнек", "Шахтёрский жнец",
	"Спороплюй", "Хитиновый шнек", "Железная спираль", "Грибной жнец", "Паутинный бур", "Мицелиевая спираль",
	"Кварцевый шнек", "Серебряный бур", "Лунное сверло", "Призматическая спираль", "Эхо-сверло", "Хрустальный жнец",
	"Магматитовый шнек", "Обсидиановый бур", "Золотая спираль", "Пеплорез", "Лавовый вихрь", "Вулканический жнец",
	"Шнек Бездны", "Бур-сердце", "Звёздное сверло", "Пожиратель глубин", "Титановая спираль", "Корона Бездны",
]
const AUGER_DESCS := [
	"Старый, но надёжный. С него все начинали.", "Медь режет мягкую породу, как масло.",
	"Зубья из костей древних тварей.", "Раскалённые угольные зубцы.", "Закалён в печи шахтёров.",
	"Любимый инструмент бригадиров.",
	"Разбрасывает споры, ослабляя врагов.", "Лёгкий и очень быстрый.", "Тяжёлая железная спираль.",
	"Жнёт монстров рядами.", "Липкие нити удачи.", "Растёт прямо во время бурения.",
	"Грани режут камень и плоть.", "Звенит серебром при каждом ударе.", "Притягивает редкие находки.",
	"Дробит свет и породу.", "Бьёт быстрее эха.", "Вершина кристальных мастеров.",
	"Плавится, но не ломается.", "Острее любого лезвия.", "Золото приносит удачу.",
	"Оставляет лишь пепел.", "Закручивает лаву в воронку.", "Выжигает всё на пути.",
	"Шёпот Бездны в каждом витке.", "Бьётся в такт с бездной.", "Сверло из упавшей звезды.",
	"Поглощает всё, что встречает.", "Сердце титана в основании.", "Тот, кто держит его, правит глубиной.",
]

# ---------------------------------------------------------------- улучшения
# cost: {ресурс: базовая цена}, цена уровня = ceil(base * grow^lvl)
const UPGRADES := [
	{"id": "armor", "name": "Броня корпуса",      "desc": "−3% получаемого урона за уровень", "max": 30, "grow": 1.18,
		"cost": {"bone": 8, "coal": 5}},
	{"id": "regen", "name": "Ремонтный контур",   "desc": "+0.5%/с к восстановлению корпуса", "max": 30, "grow": 1.18,
		"cost": {"coal": 6, "iron": 4}},
	{"id": "power", "name": "Усилитель привода",  "desc": "+10% к урону шнека",              "max": 30, "grow": 1.18,
		"cost": {"copper": 10, "crystal": 5}},
	{"id": "tap",   "name": "Кувалда",            "desc": "+25% к урону касаний",            "max": 30, "grow": 1.18,
		"cost": {"copper": 5, "bone": 4}},
	{"id": "dig",   "name": "Двигатель бура",     "desc": "+8% к скорости спуска",           "max": 30, "grow": 1.18,
		"cost": {"iron": 8, "spore": 5}},
	{"id": "luck",  "name": "Сканер жил",         "desc": "+4% к шансу добычи",              "max": 30, "grow": 1.18,
		"cost": {"silver": 6, "moon": 4}},
	{"id": "crit",  "name": "Заточка зубьев",     "desc": "+1% к шансу крита",               "max": 30, "grow": 1.18,
		"cost": {"obsidian": 6, "gold": 4}},
]

var AUGERS: Array = []
var MON_BY_ID := {}
var NORMALS_BY_BIOME := []
var BOSS_BY_BIOME := []
var UP_BY_ID := {}


func _ready() -> void:
	_build_augers()
	for i in 5:
		NORMALS_BY_BIOME.append([])
		BOSS_BY_BIOME.append(null)
	for m in MONSTERS:
		MON_BY_ID[m.id] = m
		if m.boss:
			BOSS_BY_BIOME[m.biome] = m
		else:
			NORMALS_BY_BIOME[m.biome].append(m)
	for u in UPGRADES:
		UP_BY_ID[u.id] = u


func _build_augers() -> void:
	AUGERS.clear()
	for i in 30:
		var tier: int = floori(i / 6.0)
		var j: int = i % 6
		var dmg: float = 6.0 * pow(1.52, i)
		var spd: float = 1.0 + 0.025 * i
		var crit: float = 0.03 + 0.006 * i
		var cmult: float = 1.5 + 0.03 * i
		var luck: float = 0.03 * i
		match j:
			1: spd *= 1.25; dmg *= 0.85
			2: luck += 0.15; dmg *= 0.9
			3: crit += 0.10; cmult += 0.4
			4: dmg *= 1.35; spd *= 0.8
			5: dmg *= 1.1; spd *= 1.1; luck += 0.08; crit += 0.05
		var cost := {}
		if i > 0:
			var k: float = 6.0 + 2.4 * i
			var a: int = ceili(k * 0.55 * (0.85 + 0.1 * j))
			var r: Array = RES_BY_BIOME[tier]
			cost[r[0]] = a
			cost[r[1]] = ceili(a * 0.7)
			if j >= 3:
				cost[r[2]] = ceili(a * 0.5)
		AUGERS.append({
			"id": "a%02d" % i, "idx": i, "name": AUGER_NAMES[i], "desc": AUGER_DESCS[i], "tier": tier,
			"dmg": round(dmg), "spd": snappedf(spd, 0.01), "crit": snappedf(minf(crit, 0.6), 0.001),
			"cmult": snappedf(cmult, 0.01), "luck": snappedf(luck, 0.01), "cost": cost,
			"icon": "res://assets/augers/a%02d.png" % i,
		})


func auger(id: String) -> Dictionary:
	var i := int(id.substr(1))
	return AUGERS[clampi(i, 0, AUGERS.size() - 1)]


func biome_index(depth: float) -> int:
	for i in range(BIOMES.size() - 1, -1, -1):
		if depth >= BIOMES[i].start:
			return i
	return 0


func boss_depth(idx: int) -> float:
	if idx < BOSS_DEPTHS.size():
		return BOSS_DEPTHS[idx]
	return 1000.0 + 500.0 * (idx - BOSS_DEPTHS.size() + 1)


func res_icon(id: String) -> String:
	return "res://assets/resources/%s.png" % id


func upgrade_cost(u: Dictionary, lvl: int) -> Dictionary:
	var out := {}
	for r in u.cost:
		out[r] = ceili(u.cost[r] * pow(u.grow, lvl))
	return out


func fmt(n: float) -> String:
	if n < 1000.0:
		if n < 10.0 and absf(n - floorf(n)) > 0.001:
			return "%.1f" % n
		return str(int(n))
	var e: int = mini(int(floor(log(n) / log(10.0) / 3.0)), SUFFIX.size() - 1)
	var v: float = n / pow(1000.0, e)
	var t: String
	if v < 10.0:
		t = "%.2f" % v
	elif v < 100.0:
		t = "%.1f" % v
	else:
		t = "%.0f" % v
	return t + SUFFIX[e]
