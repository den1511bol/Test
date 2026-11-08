extends Node
## Звуки и музыка. Файлы кладутся в res://assets/sfx/*.ogg и res://assets/music/*.ogg.
## Если файла нет — тишина (ошибок нет). Разработчик: @yfeeeee

const SFX := ["hit", "crit", "kill", "drop", "buy", "boss", "click", "hull", "prestige"]
var _players: Array = []
var _music: AudioStreamPlayer
var _music_name := ""
var _idx := 0


func _ready() -> void:
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)
	_music = AudioStreamPlayer.new()
	_music.volume_db = -8.0
	add_child(_music)


func _enabled() -> bool:
	return Game.s.get("settings", {}).get("sound", true)


func play(name: String, pitch: float = 1.0) -> void:
	if not _enabled():
		return
	var path := "res://assets/sfx/%s.ogg" % name
	if not ResourceLoader.exists(path):
		return
	var p: AudioStreamPlayer = _players[_idx]
	_idx = (_idx + 1) % _players.size()
	p.stream = load(path)
	p.pitch_scale = pitch
	p.play()


func play_music(biome_id: String) -> void:
	if biome_id == _music_name:
		return
	_music_name = biome_id
	var path := "res://assets/music/%s.ogg" % biome_id
	if not _enabled() or not ResourceLoader.exists(path):
		_music.stop()
		return
	var st: AudioStream = load(path)
	if st is AudioStreamOggVorbis:
		st.loop = true
	_music.stream = st
	_music.play()


func refresh() -> void:
	var n := _music_name
	_music_name = ""
	play_music(n)
