extends Control
## Улучшения бура. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")

var _cards: Array = []


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var pg := UI.scroll_page()
	add_child(pg[0])
	var v: VBoxContainer = pg[1]
	v.add_child(UI.heading("Улучшения бура"))
	var sub := UI.lbl("Сохраняются до перерождения.", 20, UI.C_DIM)
	v.add_child(sub)
	for u in Data.UPGRADES:
		v.add_child(_make_card(u))
	Game.changed.connect(refresh)
	visibility_changed.connect(func(): if visible: refresh())
	refresh()


func _make_card(u: Dictionary) -> Control:
	var card := UI.card()
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	card.add_child(h)
	h.add_child(Assets.icon("res://assets/upgrades/%s.png" % u.id, u.name.substr(0, 6), UI.C_ACCENT, Vector2(90, 90), 16))
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(mid)
	var title := UI.lbl("", 28, UI.C_ACCENT)
	mid.add_child(title)
	var d := UI.lbl(u.desc, 19, UI.C_DIM)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	mid.add_child(d)
	var chips := HFlowContainer.new()
	chips.add_theme_constant_override("h_separation", 12)
	mid.add_child(chips)
	var chip_map := {}
	for r in u.cost:
		var c := UI.chip(r)
		chips.add_child(c)
		chip_map[r] = c
	var b := UI.btn("Улучшить", 22)
	b.custom_minimum_size = Vector2(150, 70)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.pressed.connect(func():
		if Game.buy_upgrade(u.id):
			Audio.play("buy"))
	h.add_child(b)
	_cards.append({"u": u, "title": title, "btn": b, "chips": chip_map})
	return card


func refresh() -> void:
	for e in _cards:
		var u: Dictionary = e.u
		var lvl := Game.up(u.id)
		e.title.text = "%s  ур. %d/%d" % [u.name, lvl, u.max]
		var maxed: bool = lvl >= u.max
		var cost := Data.upgrade_cost(u, lvl)
		for r in e.chips:
			UI.chip_set(e.chips[r], Game.res(r), cost[r])
			e.chips[r].visible = not maxed
		e.btn.text = "Максимум" if maxed else "Улучшить"
		e.btn.disabled = maxed or not Game.can_afford(cost)
