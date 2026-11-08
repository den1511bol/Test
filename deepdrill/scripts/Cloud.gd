extends Node
## Облачные сохранения и рейтинг (сервер на Railway + PostgreSQL).
## Адрес берётся из res://config.json {"api_url": "https://..."}. Разработчик: @yfeeeee

signal leaderboard_loaded(rows: Array)
signal status(msg: String)

var api_url := ""
var busy := false


func _ready() -> void:
	if FileAccess.file_exists("res://config.json"):
		var f := FileAccess.open("res://config.json", FileAccess.READ)
		var d = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			api_url = str(d.get("api_url", "")).rstrip("/")
	var t := Timer.new()
	t.wait_time = 90.0
	t.autostart = true
	t.timeout.connect(func():
		if enabled() and Game.s.settings.get("cloud", false):
			upload(true))
	add_child(t)


func enabled() -> bool:
	return api_url != ""


func _request(method: int, path: String, body: Variant, token: String, cb: Callable) -> void:
	var http := HTTPRequest.new()
	http.timeout = 15.0
	add_child(http)
	http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, data: PackedByteArray):
		http.queue_free()
		var parsed = null
		if data.size() > 0:
			parsed = JSON.parse_string(data.get_string_from_utf8())
		cb.call(result == HTTPRequest.RESULT_SUCCESS, code, parsed))
	var headers := PackedStringArray(["Content-Type: application/json"])
	if token != "":
		headers.append("Authorization: Bearer " + token)
	var payload := "" if body == null else JSON.stringify(body)
	if http.request(api_url + path, headers, method, payload) != OK:
		http.queue_free()
		cb.call(false, 0, null)


func _ensure_token(then: Callable) -> void:
	if str(Game.s.token) != "":
		then.call(true)
		return
	var body := {"device_id": Game.s.device_id, "name": Game.s.name}
	_request(HTTPClient.METHOD_POST, "/api/drill/register", body, "", _on_registered.bind(then))


func _on_registered(ok: bool, code: int, data, then: Callable) -> void:
	if ok and code == 200 and data is Dictionary and data.has("token"):
		Game.s.token = data.token
		Game.save_game()
		then.call(true)
	else:
		then.call(false)


func upload(silent: bool = false) -> void:
	if not enabled() or busy:
		return
	busy = true
	_ensure_token(_do_upload.bind(silent))


func _do_upload(ok: bool, silent: bool) -> void:
	if not ok:
		busy = false
		if not silent:
			status.emit("Нет связи с сервером")
		return
	Game.save_game()
	var body := {"device_id": Game.s.device_id, "name": Game.s.name, "save": Game.s}
	_request(HTTPClient.METHOD_PUT, "/api/drill/save", body, Game.s.token, _on_uploaded.bind(silent))


func _on_uploaded(ok: bool, code: int, _d, silent: bool) -> void:
	busy = false
	if not silent:
		if ok and code == 200:
			status.emit("Сохранено в облаке")
		else:
			status.emit("Ошибка сохранения (%d)" % code)


func download() -> void:
	if not enabled() or busy:
		return
	busy = true
	_ensure_token(_do_download)


func _do_download(ok: bool) -> void:
	if not ok:
		busy = false
		status.emit("Нет связи с сервером")
		return
	var path := "/api/drill/save?device_id=" + str(Game.s.device_id)
	_request(HTTPClient.METHOD_GET, path, null, Game.s.token, _on_downloaded)


func _on_downloaded(ok: bool, code: int, data) -> void:
	busy = false
	if ok and code == 200 and data is Dictionary and data.get("save") is Dictionary:
		var keep_id: String = Game.s.device_id
		var keep_tok: String = Game.s.token
		Game.s = Game.new_state()
		Game._merge(Game.s, data.save)
		Game.s.device_id = keep_id
		Game.s.token = keep_tok
		Game.monster = {}
		Game.save_game()
		Game.monster_changed.emit()
		Game.changed.emit()
		status.emit("Сохранение загружено")
	elif code == 404:
		status.emit("В облаке пока нет сохранения")
	else:
		status.emit("Ошибка загрузки (%d)" % code)


func leaderboard() -> void:
	if not enabled():
		return
	_request(HTTPClient.METHOD_GET, "/api/drill/leaderboard", null, "", _on_board)


func _on_board(ok: bool, code: int, data) -> void:
	if ok and code == 200 and data is Dictionary and data.get("rows") is Array:
		leaderboard_loaded.emit(data.rows)
	else:
		status.emit("Не удалось получить рейтинг")
