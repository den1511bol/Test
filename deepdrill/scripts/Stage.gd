extends Control
## Сцена бурения: фон-параллакс, бур со шнеком, монстры, эффекты. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")

var fly_target: Control            # куда улетает добыча (кнопка «Склад»)

var world: Control
var bg_a: TextureRect
var bg_b: TextureRect
var shade: TextureRect
var body_node: Control
var auger_holder: Control
var auger_node: Control
var mon_root: Control
var mon_sprite: Control
var mon_name: Label
var mon_hp: ProgressBar
var mon_hp_text: Label
var dust: CPUParticles2D
var sparks: CPUParticles2D
var info: Label
var btn_auto: Button
var btn_up: Button

var _scroll := 0.0
var _bg_biome := -1
var _auger_id := ""
var _mon_id := ""
var _bob: Tween
var _shake: Tween
var _jit := 0.0
var _flash: Tween

const BODY_SIZE := Vector2(340, 380)
const AUGER_SIZE := Vector2(180, 280)
const MON_SIZE := 340.0


func _ready() -> void:
	clip_contents = true
	world = Control.new()
	world.set_anchors_preset(Control.PRESET_FULL_RECT)
	world.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(world)

	bg_a = _make_bg()
	bg_b = _make_bg()

	# затемнение сверху/снизу для глубины
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.7)])
	g.offsets = PackedFloat32Array([0.0, 0.25, 0.7, 1.0])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0, 1)
	gt.height = 256
	gt.width = 8
	shade = TextureRect.new()
	shade.texture = gt
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	world.add_child(shade)

	# монстр
	mon_root = Control.new()
	mon_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mon_root.visible = false
	world.add_child(mon_root)

	# бур
	body_node = Assets.icon("res://assets/drill/body.png", "БУР", Color("c8862a"), BODY_SIZE, 30)
	world.add_child(body_node)
	auger_holder = Control.new()
	auger_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	auger_holder.size = AUGER_SIZE
	world.add_child(auger_holder)

	dust = _make_particles(false)
	sparks = _make_particles(true)
	world.add_child(dust)
	world.add_child(sparks)

	# имя / полоса здоровья монстра
	mon_name = UI.lbl("", 30, UI.C_TEXT, HORIZONTAL_ALIGNMENT_CENTER, true)
	add_child(mon_name)
	mon_hp = UI.bar(Color("d8452f"))
	add_child(mon_hp)
	mon_hp_text = UI.lbl("", 20, UI.C_TEXT, HORIZONTAL_ALIGNMENT_CENTER, true)
	add_child(mon_hp_text)

	# нижняя панель управления
	info = UI.lbl("", 22, UI.C_TEXT, HORIZONTAL_ALIGNMENT_CENTER, true)
	add_child(info)
	btn_auto = UI.btn("", 26)
	btn_auto.pressed.connect(_on_auto)
	add_child(btn_auto)
	btn_up = UI.btn("Подняться на 25 м", 24)
	btn_up.pressed.connect(func(): Game.retreat(25.0); Audio.play("click"))
	add_child(btn_up)

	resized.connect(_layout)
	Game.monster_changed.connect(_on_monster_changed)
	Game.hit.connect(_on_hit)
	Game.dropped.connect(_on_dropped)
	Game.monster_killed.connect(_on_killed)
	Game.hull_broken.connect(func(): _do_shake(18.0); Audio.play("hull"))
	Game.changed.connect(_refresh_info)
	Game.prestiged.connect(func(_c): _on_monster_changed())
	_layout()
	_refresh_info()
	_on_monster_changed()


func _make_bg() -> TextureRect:
	var t := TextureRect.new()
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_SCALE
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world.add_child(t)
	return t


func _make_particles(burst: bool) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.texture = Assets.orb
	p.amount = 14 if burst else 26
	p.lifetime = 0.55
	p.one_shot = burst
	p.explosiveness = 0.95 if burst else 0.0
	p.emitting = false
	p.direction = Vector2(0, -1)
	p.spread = 75.0
	p.initial_velocity_min = 160.0
	p.initial_velocity_max = 380.0 if burst else 260.0
	p.gravity = Vector2(0, 900)
	p.scale_amount_min = 0.05
	p.scale_amount_max = 0.14
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	p.color_ramp = g
	return p


# ---------------------------------------------------------------- раскладка
func _layout() -> void:
	var w := size.x
	var h := size.y
	for bg in [bg_a, bg_b]:
		bg.size = Vector2(w, h)
	body_node.position = Vector2(w * 0.5 - BODY_SIZE.x * 0.5, h * 0.03)
	auger_holder.position = Vector2(w * 0.5 - AUGER_SIZE.x * 0.5, h * 0.03 + BODY_SIZE.y * 0.74)
	var tip := _tip()
	dust.position = tip
	sparks.position = tip
	mon_root.position = Vector2(w * 0.5, minf(tip.y + MON_SIZE * 0.42, h * 0.84 - MON_SIZE * 0.5))
	mon_name.position = Vector2(0, h - 218)
	mon_name.size = Vector2(w, 40)
	mon_hp.position = Vector2(60, h - 172)
	mon_hp.size = Vector2(w - 120, 30)
	mon_hp_text.position = Vector2(60, h - 172)
	mon_hp_text.size = Vector2(w - 120, 30)
	info.position = Vector2(0, h - 128)
	info.size = Vector2(w, 34)
	btn_auto.position = Vector2(20, h - 84)
	btn_auto.size = Vector2(w * 0.5 - 30, 70)
	btn_up.position = Vector2(w * 0.5 + 10, h - 84)
	btn_up.size = Vector2(w * 0.5 - 30, 70)


func _tip() -> Vector2:
	return auger_holder.position + Vector2(AUGER_SIZE.x * 0.5, AUGER_SIZE.y - 10.0)


# ---------------------------------------------------------------- фон и шнек
func _update_bg() -> void:
	var b := Data.biome_index(Game.s.depth)
	if b == _bg_biome:
		return
	_bg_biome = b
	var bi: Dictionary = Data.BIOMES[b]
	var tex := Assets.get_tex("res://assets/backgrounds/%s.png" % bi.id)
	for bg in [bg_a, bg_b]:
		if tex:
			bg.texture = tex
			bg.modulate = Color.WHITE
		else:
			bg.texture = _fallback_bg(bi.color)
			bg.modulate = Color.WHITE
	dust.color = bi.color.lightened(0.35)
	Audio.play_music(bi.id)


func _fallback_bg(c: Color) -> Texture2D:
	var g := Gradient.new()
	g.colors = PackedColorArray([c.darkened(0.3), c.darkened(0.6), c.darkened(0.3)])
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0, 1)
	gt.width = 8
	gt.height = 256
	return gt


func _update_auger() -> void:
	var a := Game.aug()
	if a.id == _auger_id:
		return
	_auger_id = a.id
	if auger_node:
		auger_node.queue_free()
	var tcol: Color = Data.BIOMES[a.tier].color.lightened(0.2)
	auger_node = Assets.icon(a.icon, a.name, tcol, AUGER_SIZE, 20)
	auger_node.size = AUGER_SIZE
	auger_holder.add_child(auger_node)


func _refresh_info() -> void:
	_update_auger()
	_update_bg()
	var a := Game.aug()
	info.text = "%s  ·  урон %s  ·  DPS %s" % [a.name, Data.fmt(Game.hit_dmg()), Data.fmt(Game.dps())]
	btn_auto.text = "Спуск: ВКЛ" if Game.s.settings.auto else "Фарм здесь (спуск выкл.)"
	if Game.s.settings.auto:
		btn_auto.add_theme_stylebox_override("normal", UI.style("button"))
	else:
		btn_auto.add_theme_stylebox_override("normal", UI.style("button_ok"))


func _on_auto() -> void:
	Game.set_setting("auto", not Game.s.settings.auto)
	Audio.play("click")


# ---------------------------------------------------------------- монстр
func _on_monster_changed() -> void:
	_update_bg()
	var m := Game.monster
	if m.is_empty():
		if _bob:
			_bob.kill()
		mon_root.visible = false
		mon_name.text = ""
		mon_hp.visible = false
		mon_hp_text.text = ""
		return
	if mon_sprite:
		mon_sprite.queue_free()
	var bi: Dictionary = Data.BIOMES[m.biome]
	var sz := MON_SIZE * (1.3 if m.boss else 1.0)
	mon_sprite = Assets.icon("res://assets/monsters/%s.png" % m.id, m.def.name, bi.color.lightened(0.3), Vector2(sz, sz), 24)
	mon_sprite.size = Vector2(sz, sz)
	mon_sprite.position = Vector2(-sz * 0.5, -sz * 0.5)
	mon_sprite.pivot_offset = Vector2(sz * 0.5, sz * 0.5)
	if m.mutant:
		mon_sprite.modulate = Color(1.0, 0.55, 1.0)
	mon_root.add_child(mon_sprite)
	mon_root.visible = true
	mon_hp.visible = true
	mon_name.text = ("БОСС · " if m.boss else "") + m.name
	mon_name.add_theme_color_override("font_color", UI.C_ACCENT if m.boss else (Color("ff9cff") if m.mutant else UI.C_TEXT))
	mon_hp.max_value = m.hp_max
	mon_hp.value = m.hp
	# появление
	mon_root.scale = Vector2(0.4, 0.4)
	mon_root.modulate.a = 0.0
	var tw := create_tween().set_parallel(true)
	tw.tween_property(mon_root, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(mon_root, "modulate:a", 1.0, 0.25)
	if _bob:
		_bob.kill()
	_bob = create_tween().set_loops()
	_bob.tween_property(mon_sprite, "position:y", mon_sprite.position.y - 10.0, 0.7).set_trans(Tween.TRANS_SINE)
	_bob.tween_property(mon_sprite, "position:y", mon_sprite.position.y, 0.7).set_trans(Tween.TRANS_SINE)
	if m.boss:
		Audio.play("boss")
		_do_shake(14.0)


func _on_hit(dmg: float, crit: bool, tapped: bool) -> void:
	if mon_sprite == null or not is_instance_valid(mon_sprite):
		return
	sparks.color = Color("ffd070") if not crit else Color("ff7040")
	sparks.amount = 22 if crit else 12
	sparks.restart()
	sparks.emitting = true
	Audio.play("crit" if crit else "hit", randf_range(0.92, 1.1))
	# вспышка
	if _flash:
		_flash.kill()
	mon_sprite.modulate = Color(1.7, 1.3, 1.3)
	_flash = create_tween()
	var base := Color(1.0, 0.55, 1.0) if Game.monster.get("mutant", false) else Color.WHITE
	_flash.tween_property(mon_sprite, "modulate", base, 0.12)
	# отдача шнека
	var tw := create_tween()
	tw.tween_property(auger_holder, "scale", Vector2(1.0, 0.94), 0.04)
	tw.tween_property(auger_holder, "scale", Vector2.ONE, 0.08)
	if crit:
		_do_shake(7.0)
	if Game.s.settings.vibrate and (crit or tapped):
		Input.vibrate_handheld(18 if crit else 8)
	_float(("%s" % Data.fmt(dmg)) + ("!" if crit else ""), mon_root.position + Vector2(randf_range(-80, 80), -90),
		Color("ff9040") if crit else (Color("9ad8ff") if tapped else UI.C_TEXT), 38 if crit else 28)


func _on_dropped(res_id: String, qty: int) -> void:
	var r: Dictionary = Data.RES[res_id]
	var start := mon_root.position + Vector2(randf_range(-70, 70), randf_range(-40, 40))
	_float("+%d %s" % [qty, r.name], start + Vector2(0, -30), r.color.lightened(0.3), 26)
	Audio.play("drop", randf_range(0.95, 1.15))
	# летящая иконка к «Складу»
	var ic := Assets.icon(Data.res_icon(res_id), "", r.color, Vector2(54, 54))
	ic.size = Vector2(54, 54)
	ic.position = start - Vector2(27, 27)
	add_child(ic)
	var target := Vector2(size.x * 0.5, size.y + 40.0)
	if fly_target and is_instance_valid(fly_target):
		target = fly_target.global_position + fly_target.size * 0.5 - global_position
	var tw := create_tween().set_parallel(true)
	tw.tween_property(ic, "position", target - Vector2(27, 27), 0.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN).set_delay(0.25)
	tw.tween_property(ic, "scale", Vector2(0.4, 0.4), 0.8).set_delay(0.25)
	tw.chain().tween_callback(ic.queue_free)


func _on_killed(m: Dictionary) -> void:
	Audio.play("kill")
	if mon_sprite and is_instance_valid(mon_sprite):
		var spr := mon_sprite
		mon_sprite = null
		var pos := mon_root.position
		var clone := Control.new()
		clone.position = pos
		mon_root.remove_child(spr)
		clone.add_child(spr)
		add_child(clone)
		var tw := create_tween().set_parallel(true)
		tw.tween_property(clone, "scale", Vector2(1.25, 0.2), 0.35).set_trans(Tween.TRANS_QUAD)
		tw.tween_property(clone, "modulate:a", 0.0, 0.35)
		tw.chain().tween_callback(clone.queue_free)
	if m.boss:
		_do_shake(20.0)


func _float(text: String, pos: Vector2, color: Color, fsize: int) -> void:
	var l := UI.lbl(text, fsize, color, HORIZONTAL_ALIGNMENT_CENTER, true)
	l.size = Vector2(300, 50)
	l.position = pos - Vector2(150, 0)
	add_child(l)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(l, "position:y", pos.y - 90.0, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.3)
	tw.chain().tween_callback(l.queue_free)


func _do_shake(power: float) -> void:
	if _shake:
		_shake.kill()
	_shake = create_tween()
	for i in 5:
		var k := 1.0 - i / 5.0
		_shake.tween_property(world, "position", Vector2(randf_range(-1, 1), randf_range(-1, 1)) * power * k, 0.04)
	_shake.tween_property(world, "position", Vector2.ZERO, 0.04)


# ---------------------------------------------------------------- каждый кадр
func _process(delta: float) -> void:
	var m := Game.monster
	var digging: bool = m.is_empty() and Game.s.settings.auto and Game.s.depth < Game.next_boss_depth()
	if digging:
		_scroll += Game.dig_speed() * 90.0 * delta
	elif m.is_empty() and not Game.s.settings.auto:
		_scroll += 40.0 * delta
	var h := maxf(size.y, 1.0)
	var off := fmod(_scroll, h)
	bg_a.position.y = -off
	bg_b.position.y = h - off
	# дрожь шнека
	_jit += delta * 60.0
	var amp := 3.0 if digging else (1.5 if not m.is_empty() else 0.5)
	auger_holder.position.x = size.x * 0.5 - AUGER_SIZE.x * 0.5 + sin(_jit) * amp
	body_node.position.y = size.y * 0.03 + cos(_jit * 0.9) * amp * 0.6
	dust.emitting = digging or not m.is_empty()
	dust.amount = 26 if digging else 10
	if not m.is_empty() and mon_sprite and is_instance_valid(mon_sprite):
		mon_hp.value = m.hp
		mon_hp_text.text = "%s / %s" % [Data.fmt(maxf(m.hp, 0.0)), Data.fmt(m.hp_max)]


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		Game.tap()
