extends Control
## Главный экран: шапка, страницы, нижние вкладки. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")
const Stage = preload("res://scripts/Stage.gd")
const ShopTab = preload("res://scripts/ShopTab.gd")
const StorageTab = preload("res://scripts/StorageTab.gd")
const UpgradeTab = preload("res://scripts/UpgradeTab.gd")
const MoreTab = preload("res://scripts/MoreTab.gd")

const HEADER_H := 150.0
const TABS_H := 100.0
const TAB_NAMES := ["Бур", "Шнеки", "Склад", "Прокачка", "Ещё"]

var header: PanelContainer
var depth_lbl: Label
var biome_lbl: Label
var hull_bar: ProgressBar
var rec_lbl: Label
var toast_lbl: Label
var pages: Array = []
var tab_btns: Array = []
var _toast_tw: Tween
var _cur := 0


func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = UI.C_BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	# страницы
	var content := Control.new()
	content.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.offset_top = HEADER_H
	content.offset_bottom = -TABS_H
	content.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(content)
	var stage := Stage.new()
	var shop := ShopTab.new()
	var storage := StorageTab.new()
	var upg := UpgradeTab.new()
	var more := MoreTab.new()
	pages = [stage, shop, storage, upg, more]
	for p in pages:
		p.set_anchors_preset(Control.PRESET_FULL_RECT)
		content.add_child(p)

	_build_header()
	_build_tabs()
	stage.fly_target = tab_btns[2]

	toast_lbl = UI.lbl("", 24, UI.C_ACCENT, HORIZONTAL_ALIGNMENT_CENTER, true)
	toast_lbl.set_anchors_preset(Control.PRESET_TOP_WIDE)
	toast_lbl.offset_top = HEADER_H + 12
	toast_lbl.offset_bottom = HEADER_H + 60
	toast_lbl.modulate.a = 0.0
	add_child(toast_lbl)

	Game.toast.connect(_toast)
	Game.changed.connect(_update_header)
	Game.prestiged.connect(func(_c): _select(0))
	_select(0)
	_update_header()
	if not Game.offline_report.is_empty():
		_show_offline(Game.offline_report)
		Game.offline_report = {}
	if "--shots" in OS.get_cmdline_user_args():
		_run_shots()


func _build_header() -> void:
	header = PanelContainer.new()
	header.add_theme_stylebox_override("panel", UI.style("header"))
	header.set_anchors_preset(Control.PRESET_TOP_WIDE)
	header.offset_bottom = HEADER_H
	add_child(header)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	header.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	depth_lbl = UI.lbl("", 46, UI.C_ACCENT)
	depth_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(depth_lbl)
	rec_lbl = UI.lbl("", 20, UI.C_DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	top.add_child(rec_lbl)
	biome_lbl = UI.lbl("", 22, UI.C_TEXT)
	v.add_child(biome_lbl)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	row.add_child(UI.lbl("Корпус", 20, UI.C_DIM))
	hull_bar = UI.bar(Color("58b858"))
	hull_bar.max_value = Game.HULL_MAX
	hull_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hull_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(hull_bar)


func _build_tabs() -> void:
	var bar := HBoxContainer.new()
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.offset_top = -TABS_H
	bar.add_theme_constant_override("separation", 0)
	add_child(bar)
	for i in TAB_NAMES.size():
		var b := UI.btn(TAB_NAMES[i], 22, "tab")
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.size_flags_vertical = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func():
			Audio.play("click")
			_select(i))
		bar.add_child(b)
		tab_btns.append(b)


func _select(i: int) -> void:
	_cur = i
	for k in pages.size():
		pages[k].visible = (k == i)
		var sty := "tab_sel" if k == i else "tab"
		tab_btns[k].add_theme_stylebox_override("normal", UI.style(sty))
		tab_btns[k].add_theme_stylebox_override("hover", UI.style(sty))
		tab_btns[k].add_theme_stylebox_override("pressed", UI.style(sty))
		tab_btns[k].add_theme_color_override("font_color", UI.C_ACCENT if k == i else UI.C_TEXT)


func _update_header() -> void:
	var bi := Game.biome()
	biome_lbl.text = bi.name + ("  ·  ядра: %d" % int(Game.s.cores) if int(Game.s.cores) > 0 else "")
	rec_lbl.text = "рекорд %d м\nбосс на %d м" % [int(Game.s.max_depth), int(Game.next_boss_depth())]


func _process(_d: float) -> void:
	depth_lbl.text = "%d м" % int(Game.s.depth)
	hull_bar.value = Game.hull
	var low := Game.hull < 30.0
	hull_bar.get_theme_stylebox("fill").bg_color = Color("d8452f") if low else Color("58b858")


func _toast(msg: String) -> void:
	toast_lbl.text = msg
	if _toast_tw:
		_toast_tw.kill()
	toast_lbl.modulate.a = 1.0
	_toast_tw = create_tween()
	_toast_tw.tween_interval(2.0)
	_toast_tw.tween_property(toast_lbl, "modulate:a", 0.0, 0.5)


func _show_offline(rep: Dictionary) -> void:
	var ov := PanelContainer.new()
	ov.name = "Offline"
	ov.add_theme_stylebox_override("panel", UI.style("overlay"))
	ov.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(ov)
	var center := CenterContainer.new()
	ov.add_child(center)
	var card := UI.card()
	card.custom_minimum_size = Vector2(560, 0)
	center.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	card.add_child(v)
	v.add_child(UI.lbl("Пока вас не было", 34, UI.C_ACCENT, HORIZONTAL_ALIGNMENT_CENTER))
	var mins := int(rep.seconds / 60.0)
	v.add_child(UI.lbl("Бур работал %d ч %d мин и убил ~%d монстров." % [mins / 60, mins % 60, rep.kills], 22,
		UI.C_TEXT, HORIZONTAL_ALIGNMENT_CENTER))
	for r in rep.gains:
		var h := HBoxContainer.new()
		h.alignment = BoxContainer.ALIGNMENT_CENTER
		h.add_child(Assets.icon(Data.res_icon(r), "", Data.RES[r].color, Vector2(48, 48)))
		h.add_child(UI.lbl("  +%s %s" % [Data.fmt(rep.gains[r]), Data.RES[r].name], 24, Data.RES[r].color.lightened(0.3)))
		v.add_child(h)
	var ok := UI.btn("Забрать", 28)
	ok.custom_minimum_size = Vector2(0, 74)
	ok.pressed.connect(func():
		ov.queue_free()
		Game.changed.emit())
	v.add_child(ok)


# ---------------------------------------------------------------- отладка: скриншоты (--shots)
func _run_shots() -> void:
	await get_tree().process_frame
	Game.s = Game.new_state()
	Game.monster = {}
	var out := "/tmp/shots"
	if has_node("Offline"):
		get_node("Offline").queue_free()
	DirAccess.make_dir_recursive_absolute(out)
	for r in Data.RES:
		Game.s.res[r] = 40 + randi() % 200
	Game.s.owned = ["a00"]
	Game.s.equipped = "a00"
	Game.s.depth = 140.0
	Game.s.max_depth = 140.0
	Game.s.gate = 1
	Game.s.kills["worm"] = 12
	Game.s.kills["queen_worm"] = 1
	Game.changed.emit()
	for i in 5:
		_select(i)
		for f in 70:
			await get_tree().process_frame
		if i == 0:
			await get_tree().create_timer(2.5).timeout
		get_viewport().get_texture().get_image().save_png("%s/tab%d.png" % [out, i])
	get_tree().quit()
