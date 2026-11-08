extends Control
## Склад ресурсов и бестиарий. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")

var _res_labels := {}
var _mon_cards: Array = []


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var pg := UI.scroll_page()
	add_child(pg[0])
	var v: VBoxContainer = pg[1]
	v.add_child(UI.heading("Склад"))
	for b in 5:
		var bi: Dictionary = Data.BIOMES[b]
		v.add_child(UI.lbl(bi.name, 24, bi.color.lightened(0.4)))
		var grid := GridContainer.new()
		grid.columns = 3
		grid.add_theme_constant_override("h_separation", 10)
		grid.add_theme_constant_override("v_separation", 10)
		v.add_child(grid)
		for r in Data.RES_BY_BIOME[b]:
			grid.add_child(_res_tile(r))
	v.add_child(UI.spacer(10))
	v.add_child(UI.heading("Бестиарий"))
	for m in Data.MONSTERS:
		v.add_child(_mon_card(m))
	Game.changed.connect(refresh)
	visibility_changed.connect(func(): if visible: refresh())
	refresh()


func _res_tile(r: String) -> Control:
	var info: Dictionary = Data.RES[r]
	var c := UI.card()
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	c.add_child(v)
	var ic := Assets.icon(Data.res_icon(r), "", info.color, Vector2(72, 72))
	ic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(ic)
	var n := UI.lbl("0", 26, UI.C_TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	v.add_child(n)
	var nm := UI.lbl(info.name, 16, UI.C_DIM, HORIZONTAL_ALIGNMENT_CENTER)
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(nm)
	_res_labels[r] = n
	return c


func _mon_card(m: Dictionary) -> Control:
	var card := UI.card()
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	card.add_child(h)
	var bi: Dictionary = Data.BIOMES[m.biome]
	h.add_child(Assets.icon("res://assets/monsters/%s.png" % m.id, "", bi.color.lightened(0.3), Vector2(110, 110)))
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(mid)
	var title := UI.lbl("", 26, UI.C_ACCENT if m.boss else UI.C_TEXT)
	mid.add_child(title)
	var sub := UI.lbl("", 18, UI.C_DIM)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	mid.add_child(sub)
	_mon_cards.append({"m": m, "title": title, "sub": sub})
	return card


func refresh() -> void:
	for r in _res_labels:
		_res_labels[r].text = Data.fmt(Game.res(r))
	for e in _mon_cards:
		var m: Dictionary = e.m
		var k := int(Game.s.kills.get(m.id, 0))
		if k == 0:
			e.title.text = "??? (%s)" % Data.BIOMES[m.biome].name
			e.sub.text = "Победите, чтобы узнать добычу."
		else:
			e.title.text = ("БОСС · " if m.boss else "") + m.name + "  ×%d" % k
			var parts: Array = []
			for d in m.drops:
				parts.append("%s %d%%" % [Data.RES[d[0]].name, round(d[1] * 100.0)])
			e.sub.text = "Добыча: " + ", ".join(parts)
