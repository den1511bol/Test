extends Node
## Загрузка арта. Если файла нет — рисуется временная светящаяся заглушка с подписью.
## Разработчик: @yfeeeee

var orb: GradientTexture2D
var _cache := {}


func _ready() -> void:
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	g.offsets = PackedFloat32Array([0.0, 1.0])
	orb = GradientTexture2D.new()
	orb.gradient = g
	orb.fill = GradientTexture2D.FILL_RADIAL
	orb.fill_from = Vector2(0.5, 0.5)
	orb.fill_to = Vector2(1.0, 0.5)
	orb.width = 128
	orb.height = 128


func get_tex(path: String) -> Texture2D:
	if _cache.has(path):
		return _cache[path]
	var t: Texture2D = null
	if ResourceLoader.exists(path):
		t = load(path)
	_cache[path] = t
	return t


func has_art(path: String) -> bool:
	return get_tex(path) != null


## Контейнер с картинкой (или заглушкой). Размер задаётся custom_minimum_size.
func icon(path: String, label: String, color: Color, sz: Vector2, font_size: int = 14) -> Control:
	var holder := Control.new()
	holder.custom_minimum_size = sz
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tr := TextureRect.new()
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	holder.add_child(tr)
	var t := get_tex(path)
	if t:
		tr.texture = t
	else:
		tr.texture = orb
		tr.modulate = color
		if label != "":
			var l := Label.new()
			l.text = label
			l.set_anchors_preset(Control.PRESET_FULL_RECT)
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			l.add_theme_font_size_override("font_size", font_size)
			l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
			l.add_theme_constant_override("outline_size", 4)
			l.mouse_filter = Control.MOUSE_FILTER_IGNORE
			holder.add_child(l)
	return holder
