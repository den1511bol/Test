extends Control
## Перерождение, настройки, облако, об игре. Разработчик: @yfeeeee

const UI = preload("res://scripts/UI.gd")

var _pres_info: Label
var _pres_btn: Button
var _cloud_status: Label
var _board: VBoxContainer
var _name_edit: LineEdit
var _confirm_reset := false
var _reset_btn: Button
var _sound: Button
var _vib: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var pg := UI.scroll_page()
	add_child(pg[0])
	var v: VBoxContainer = pg[1]

	# перерождение
	var c1 := UI.card()
	var b1 := VBoxContainer.new()
	c1.add_child(b1)
	b1.add_child(UI.heading("Перерождение бура"))
	_pres_info = UI.lbl("", 20, UI.C_TEXT)
	_pres_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b1.add_child(_pres_info)
	_pres_btn = UI.btn("Переродиться", 26)
	_pres_btn.custom_minimum_size = Vector2(0, 70)
	_pres_btn.pressed.connect(_on_prestige)
	b1.add_child(UI.spacer(8))
	b1.add_child(_pres_btn)
	v.add_child(c1)

	# настройки
	var c2 := UI.card()
	var b2 := VBoxContainer.new()
	b2.add_theme_constant_override("separation", 8)
	c2.add_child(b2)
	b2.add_child(UI.heading("Настройки"))
	_sound = UI.btn("", 24)
	_sound.custom_minimum_size = Vector2(0, 64)
	_sound.pressed.connect(func():
		Game.set_setting("sound", not Game.s.settings.sound)
		Audio.refresh())
	b2.add_child(_sound)
	_vib = UI.btn("", 24)
	_vib.custom_minimum_size = Vector2(0, 64)
	_vib.pressed.connect(func(): Game.set_setting("vibrate", not Game.s.settings.vibrate))
	b2.add_child(_vib)
	v.add_child(c2)

	# облако
	var c3 := UI.card()
	var b3 := VBoxContainer.new()
	b3.add_theme_constant_override("separation", 8)
	c3.add_child(b3)
	b3.add_child(UI.heading("Облако и рейтинг"))
	if Cloud.enabled():
		_name_edit = LineEdit.new()
		_name_edit.placeholder_text = "Ваш ник для рейтинга"
		_name_edit.max_length = 20
		_name_edit.text = str(Game.s.name)
		_name_edit.add_theme_font_size_override("font_size", 24)
		_name_edit.custom_minimum_size = Vector2(0, 60)
		_name_edit.text_changed.connect(func(t: String): Game.s.name = t)
		b3.add_child(_name_edit)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		b3.add_child(row)
		var up := UI.btn("Сохранить в облако", 20)
		up.custom_minimum_size = Vector2(0, 64)
		up.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		up.pressed.connect(func(): Cloud.upload())
		row.add_child(up)
		var down := UI.btn("Загрузить из облака", 20)
		down.custom_minimum_size = Vector2(0, 64)
		down.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		down.pressed.connect(func(): Cloud.download())
		row.add_child(down)
		var auto := UI.btn("", 20)
		auto.custom_minimum_size = Vector2(0, 56)
		auto.text = "Автосохранение в облако: " + ("ВКЛ" if Game.s.settings.cloud else "ВЫКЛ")
		auto.pressed.connect(func():
			Game.set_setting("cloud", not Game.s.settings.cloud)
			auto.text = "Автосохранение в облако: " + ("ВКЛ" if Game.s.settings.cloud else "ВЫКЛ"))
		b3.add_child(auto)
		var lb := UI.btn("Обновить рейтинг глубины", 20)
		lb.custom_minimum_size = Vector2(0, 56)
		lb.pressed.connect(func(): Cloud.leaderboard())
		b3.add_child(lb)
		_board = VBoxContainer.new()
		b3.add_child(_board)
		Cloud.leaderboard_loaded.connect(_on_board)
	else:
		var l := UI.lbl("Сервер не подключён. Укажите адрес Railway в config.json — см. README.", 20, UI.C_DIM)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b3.add_child(l)
	_cloud_status = UI.lbl("", 20, UI.C_ACCENT)
	b3.add_child(_cloud_status)
	Cloud.status.connect(func(m: String): _cloud_status.text = m)
	v.add_child(c3)

	# об игре
	var c4 := UI.card()
	var b4 := VBoxContainer.new()
	c4.add_child(b4)
	b4.add_child(UI.heading("Об игре"))
	b4.add_child(UI.lbl("%s  v%s" % [Data.GAME_NAME, Data.VERSION], 22))
	b4.add_child(UI.lbl("Разработчик: %s" % Data.DEV, 24, UI.C_ACCENT))
	var st := UI.lbl("", 18, UI.C_DIM)
	st.name = "stats"
	b4.add_child(st)
	v.add_child(c4)

	_reset_btn = UI.btn("Сбросить весь прогресс", 22)
	_reset_btn.custom_minimum_size = Vector2(0, 64)
	_reset_btn.pressed.connect(_on_reset)
	v.add_child(_reset_btn)
	v.add_child(UI.spacer(30))

	Game.changed.connect(refresh)
	visibility_changed.connect(func(): if visible: refresh())
	refresh()


func refresh() -> void:
	var gain := Game.prestige_gain()
	var cores := int(Game.s.cores)
	_pres_info.text = "Ядра бура: %d (+%d%% к урону, +%d%% к удаче).\nРекорд забега: %d м. " % [
		cores, cores * 8, cores * 2, int(Game.s.run_max)]
	if Game.can_prestige():
		_pres_info.text += "Перерождение даст +%d ядер, но сбросит ресурсы, шнеки, улучшения и глубину." % gain
	else:
		_pres_info.text += "Доступно с глубины 300 м."
	_pres_btn.disabled = not Game.can_prestige()
	_pres_btn.text = "Переродиться (+%d ядер)" % gain if Game.can_prestige() else "Недоступно"
	_sound.text = "Звук: " + ("ВКЛ" if Game.s.settings.sound else "ВЫКЛ")
	_vib.text = "Вибрация: " + ("ВКЛ" if Game.s.settings.vibrate else "ВЫКЛ")
	var st := find_child("stats", true, false)
	if st:
		st.text = "Рекорд глубины: %d м · убито монстров: %d · боссов: %d · перерождений: %d" % [
			int(Game.s.max_depth), int(Game.s.total_kills), int(Game.s.bosses), int(Game.s.prestiges)]


func _on_prestige() -> void:
	Game.do_prestige()
	Audio.play("prestige")
	if Cloud.enabled() and Game.s.settings.cloud:
		Cloud.upload(true)


func _on_reset() -> void:
	if not _confirm_reset:
		_confirm_reset = true
		_reset_btn.text = "Нажмите ещё раз для подтверждения"
		get_tree().create_timer(4.0).timeout.connect(func():
			_confirm_reset = false
			_reset_btn.text = "Сбросить весь прогресс")
		return
	_confirm_reset = false
	_reset_btn.text = "Сбросить весь прогресс"
	Game.reset_all()


func _on_board(rows: Array) -> void:
	for c in _board.get_children():
		c.queue_free()
	var i := 1
	for r in rows:
		_board.add_child(UI.lbl("%d. %s — %d м (ядер: %d)" % [i, str(r.get("name", "Безымянный")),
			int(r.get("max_depth", 0)), int(r.get("cores", 0))], 20))
		i += 1
