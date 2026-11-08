extends RefCounted
## Помощники интерфейса. Если есть арт в res://assets/ui/*.png — используется он,
## иначе временные плоские стили. Разработчик: @yfeeeee

const C_BG := Color("120e0c")
const C_PANEL := Color("231a14")
const C_PANEL2 := Color("2e2219")
const C_BORDER := Color("6a4a2c")
const C_ACCENT := Color("f0b040")
const C_TEXT := Color("f4e8d2")
const C_DIM := Color("a89880")
const C_GOOD := Color("8be07a")
const C_BAD := Color("ff7060")


static func style(kind: String) -> StyleBox:
	var path := "res://assets/ui/%s.png" % kind
	if Assets.has_art(path):
		var sb := StyleBoxTexture.new()
		sb.texture = Assets.get_tex(path)
		sb.texture_margin_left = 28
		sb.texture_margin_right = 28
		sb.texture_margin_top = 28
		sb.texture_margin_bottom = 28
		return sb
	var f := StyleBoxFlat.new()
	f.set_corner_radius_all(14)
	f.set_border_width_all(3)
	f.content_margin_left = 14
	f.content_margin_right = 14
	f.content_margin_top = 10
	f.content_margin_bottom = 10
	match kind:
		"panel":
			f.bg_color = C_PANEL
			f.border_color = C_BORDER
		"header":
			f.bg_color = Color("1a130f")
			f.border_color = C_BORDER
			f.set_corner_radius_all(0)
			f.border_width_left = 0
			f.border_width_right = 0
			f.border_width_top = 0
		"button":
			f.bg_color = Color("8a5a1c")
			f.border_color = C_ACCENT
		"button_hover":
			f.bg_color = Color("a8701f")
			f.border_color = C_ACCENT
		"button_pressed":
			f.bg_color = Color("6a4412")
			f.border_color = C_ACCENT
		"button_dis":
			f.bg_color = Color("2c2620")
			f.border_color = Color("4a4036")
		"button_ok":
			f.bg_color = Color("2f5a2a")
			f.border_color = C_GOOD
		"tab":
			f.bg_color = Color("1a130f")
			f.border_color = Color("3a2a1c")
			f.set_corner_radius_all(0)
		"tab_sel":
			f.bg_color = Color("3a2814")
			f.border_color = C_ACCENT
			f.set_corner_radius_all(0)
		"bar_bg":
			f.bg_color = Color("0a0706")
			f.border_color = Color("3a2a1c")
			f.set_corner_radius_all(8)
			f.set_border_width_all(2)
			f.content_margin_top = 2
			f.content_margin_bottom = 2
		"overlay":
			f.bg_color = Color(0, 0, 0, 0.78)
			f.set_border_width_all(0)
			f.set_corner_radius_all(0)
		_:
			f.bg_color = C_PANEL
	return f


static func lbl(text: String, size: int = 24, color: Color = C_TEXT, align: int = HORIZONTAL_ALIGNMENT_LEFT, outline: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if outline:
		l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.95))
		l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func btn(text: String, size: int = 26, kind: String = "button") -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_color_override("font_disabled_color", Color("7a6e60"))
	b.add_theme_stylebox_override("normal", style(kind))
	b.add_theme_stylebox_override("hover", style(kind + "_hover" if kind == "button" else kind))
	b.add_theme_stylebox_override("pressed", style(kind + "_pressed" if kind == "button" else kind))
	b.add_theme_stylebox_override("disabled", style("button_dis" if kind == "button" else kind))
	return b


static func card() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", style("panel"))
	return p


static func bar(fill: Color) -> ProgressBar:
	var pb := ProgressBar.new()
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(0, 26)
	pb.add_theme_stylebox_override("background", style("bar_bg"))
	var f := StyleBoxFlat.new()
	f.bg_color = fill
	f.set_corner_radius_all(7)
	pb.add_theme_stylebox_override("fill", f)
	pb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return pb


static func spacer(h: int) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


static func chip(res_id: String) -> HBoxContainer:
	var r: Dictionary = Data.RES[res_id]
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	h.add_child(Assets.icon(Data.res_icon(res_id), "", r.color, Vector2(40, 40)))
	var l := lbl("0", 22)
	l.name = "n"
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	h.add_child(l)
	return h


static func chip_set(c: HBoxContainer, have: int, need: int) -> void:
	var l: Label = c.get_node("n")
	l.text = "%s/%s" % [Data.fmt(have), Data.fmt(need)]
	l.add_theme_color_override("font_color", C_GOOD if have >= need else C_BAD)


static func heading(text: String, color: Color = C_ACCENT) -> Label:
	var l := lbl(text, 30, color)
	return l


static func scroll_page() -> Array:
	## возвращает [ScrollContainer, VBoxContainer]
	var sc := ScrollContainer.new()
	sc.set_anchors_preset(Control.PRESET_FULL_RECT)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var m := MarginContainer.new()
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for k in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + k, 14)
	sc.add_child(m)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	m.add_child(v)
	return [sc, v]
