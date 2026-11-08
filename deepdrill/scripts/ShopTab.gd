extends Control
## Магазин шнеков. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")

var _cards: Array = []
var _head: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var pg := UI.scroll_page()
	add_child(pg[0])
	var v: VBoxContainer = pg[1]
	_head = UI.lbl("", 22, UI.C_DIM)
	v.add_child(UI.heading("Шнеки"))
	v.add_child(_head)
	var last_tier := -1
	for a in Data.AUGERS:
		if a.tier != last_tier:
			last_tier = a.tier
			var bi: Dictionary = Data.BIOMES[a.tier]
			var t := UI.lbl("— %s —" % bi.name, 26, bi.color.lightened(0.4), HORIZONTAL_ALIGNMENT_CENTER)
			v.add_child(t)
		v.add_child(_make_card(a))
	Game.changed.connect(refresh)
	visibility_changed.connect(func(): if visible: refresh())
	refresh()


func _make_card(a: Dictionary) -> Control:
	var card := UI.card()
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	card.add_child(h)
	var bi: Dictionary = Data.BIOMES[a.tier]
	h.add_child(Assets.icon(a.icon, "", bi.color.lightened(0.2), Vector2(100, 150)))
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", 4)
	h.add_child(mid)
	mid.add_child(UI.lbl(a.name, 28, UI.C_ACCENT))
	var d := UI.lbl(a.desc, 18, UI.C_DIM)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mid.add_child(d)
	var stats := UI.lbl("", 20)
	stats.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	mid.add_child(stats)
	var chips := HFlowContainer.new()
	chips.add_theme_constant_override("h_separation", 12)
	mid.add_child(chips)
	var chip_map := {}
	for r in a.cost:
		var c := UI.chip(r)
		chips.add_child(c)
		chip_map[r] = c
	var b := UI.btn("", 22)
	b.custom_minimum_size = Vector2(150, 70)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.pressed.connect(_on_pressed.bind(a.id))
	h.add_child(b)
	stats.text = "Урон %s · %.2f/с · крит %d%% ×%.1f · удача +%d%%" % [
		Data.fmt(a.dmg), a.spd, round(a.crit * 100.0), a.cmult, round(a.luck * 100.0)]
	var entry := {"id": a.id, "btn": b, "chips": chip_map, "card": card}
	_cards.append(entry)
	return card


func _on_pressed(id: String) -> void:
	if Game.owns(id):
		Game.equip(id)
		Audio.play("click")
	elif Game.buy_auger(id):
		Audio.play("buy")


func refresh() -> void:
	if not visible and not _cards.is_empty() and _cards[0].has("done"):
		return
	_head.text = "Куплено %d из %d · бонус коллекции +%d%% к урону" % [Game.s.owned.size(), Data.AUGERS.size(), Game.s.owned.size()]
	for e in _cards:
		var a := Data.auger(e.id)
		var b: Button = e.btn
		for r in e.chips:
			UI.chip_set(e.chips[r], Game.res(r), a.cost[r])
			e.chips[r].visible = not Game.owns(e.id)
		if Game.s.equipped == e.id:
			b.text = "Установлен"
			b.disabled = true
			b.add_theme_stylebox_override("disabled", UI.style("button_ok"))
		elif Game.owns(e.id):
			b.text = "Установить"
			b.disabled = false
		else:
			b.text = "Купить"
			b.disabled = not Game.can_afford(a.cost)
			b.add_theme_stylebox_override("disabled", UI.style("button_dis"))
