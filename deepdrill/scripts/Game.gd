extends Node
## Состояние игры, бой, добыча, сохранение. Разработчик: @yfeeeee

signal changed                       # любые изменения (ресурсы, покупки) — для обновления UI
signal toast(msg: String)
signal monster_changed               # появился/исчез монстр
signal hit(dmg: float, crit: bool, tapped: bool)
signal dropped(res_id: String, qty: int)
signal monster_killed(mon: Dictionary)
signal hull_broken
signal prestiged(cores: int)

const SAVE_PATH := "user://deepdrill_save.json"
const ENC_DIST := 5.0                # метров между встречами с монстрами
const HULL_MAX := 100.0
const OFFLINE_CAP := 12.0 * 3600.0
const OFFLINE_EFF := 0.5
const BASE_HP := 24.0
const BIOME_HP_MULT := 12.3

var s: Dictionary = {}
var monster: Dictionary = {}
var hull: float = HULL_MAX
var rng := RandomNumberGenerator.new()
var offline_report: Dictionary = {}
var running := true                  # false — тик остановлен (симуляции вызывают tick сами)

var _since_enc := 0.0
var _atk_acc := 0.0
var _farm_wait := 0.0
var _save_t := 0.0
var _changed_t := 0.0
var _dirty := false


func _ready() -> void:
	rng.randomize()
	load_game()


func _process(delta: float) -> void:
	if not running:
		return
	tick(minf(delta, 0.25))
	_save_t += delta
	if _save_t >= 10.0:
		_save_t = 0.0
		save_game()
	if _dirty:
		_changed_t += delta
		if _changed_t >= 0.15:
			_changed_t = 0.0
			_dirty = false
			changed.emit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST \
			or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		save_game()


# ---------------------------------------------------------------- состояние
func new_state() -> Dictionary:
	return {
		"v": 1, "res": {}, "owned": ["a00"], "equipped": "a00", "up": {},
		"depth": 0.0, "max_depth": 0.0, "run_max": 0.0, "gate": 0,
		"cores": 0, "prestiges": 0, "kills": {}, "total_kills": 0, "bosses": 0,
		"settings": {"sound": true, "vibrate": true, "auto": true, "cloud": false},
		"device_id": "", "token": "", "name": "", "last_time": 0,
	}


func load_game() -> void:
	s = new_state()
	if FileAccess.file_exists(SAVE_PATH):
		var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
		if f:
			var parsed = JSON.parse_string(f.get_as_text())
			if parsed is Dictionary:
				_merge(s, parsed)
	if str(s.device_id) == "":
		s.device_id = _make_id()
	hull = HULL_MAX
	var now := int(Time.get_unix_time_from_system())
	var last := int(s.last_time)
	if last > 0 and now - last >= 60:
		apply_offline(float(now - last))
	s.last_time = now


func _merge(dst: Dictionary, src: Dictionary) -> void:
	for k in src:
		if dst.has(k) and dst[k] is Dictionary and src[k] is Dictionary:
			_merge(dst[k], src[k])
		else:
			dst[k] = src[k]


func _make_id() -> String:
	var chars := "abcdefghijklmnopqrstuvwxyz0123456789"
	var out := ""
	for i in 24:
		out += chars[rng.randi() % chars.length()]
	return out


func save_game() -> void:
	s.last_time = int(Time.get_unix_time_from_system())
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(s))


func reset_all() -> void:
	var dev: String = s.device_id
	s = new_state()
	s.device_id = dev
	monster = {}
	hull = HULL_MAX
	save_game()
	monster_changed.emit()
	changed.emit()


# ---------------------------------------------------------------- характеристики
func up(id: String) -> int:
	return int(s.up.get(id, 0))


func res(id: String) -> int:
	return int(s.res.get(id, 0))


func aug() -> Dictionary:
	return Data.auger(s.equipped)


func owns(id: String) -> bool:
	return s.owned.has(id)


func dmg_mult() -> float:
	return (1.0 + 0.10 * up("power")) * (1.0 + 0.08 * int(s.cores)) * (1.0 + 0.01 * s.owned.size())


func hit_dmg() -> float:
	return aug().dmg * dmg_mult()


func crit_chance() -> float:
	return minf(0.8, aug().crit + 0.01 * up("crit"))


func avg_hit() -> float:
	var cc := crit_chance()
	return hit_dmg() * (1.0 + cc * (aug().cmult - 1.0))


func dps() -> float:
	return avg_hit() * aug().spd


func tap_dmg() -> float:
	return hit_dmg() * (0.8 + 0.25 * up("tap"))


func dig_speed() -> float:
	return 1.5 * (0.8 + 0.2 * aug().spd) * (1.0 + 0.08 * up("dig"))


func luck_mult() -> float:
	return 1.0 + aug().luck + 0.04 * up("luck") + 0.02 * int(s.cores)


func armor() -> float:
	return pow(0.97, up("armor"))


func regen() -> float:
	return 2.0 + 0.5 * up("regen")


func next_boss_depth() -> float:
	return Data.boss_depth(int(s.gate))


func biome() -> Dictionary:
	return Data.BIOMES[Data.biome_index(s.depth)]


# ---------------------------------------------------------------- масштабирование
func scale_at(b: int, d: float) -> float:
	if b < 4:
		var bi: Dictionary = Data.BIOMES[b]
		var t := clampf((d - bi.start) / (bi.end - bi.start), 0.0, 1.0)
		return 1.0 + 1.2 * t
	return 2.2 * pow(1.04, maxf(d - 1000.0, 0.0) / 10.0)


func monster_hp(def: Dictionary, b: int, d: float) -> float:
	return BASE_HP * pow(BIOME_HP_MULT, minf(b, 4.0)) * def.hpf * scale_at(b, d)


func monster_atk(def: Dictionary, b: int, d: float) -> float:
	var ramp := sqrt(scale_at(b, d))
	var v: float = 1.5 * def.atk * (1.0 + 0.25 * b) * ramp
	return v * (3.5 if def.boss else 1.0)


# ---------------------------------------------------------------- тик
func tick(delta: float) -> void:
	if monster.is_empty():
		hull = minf(HULL_MAX, hull + regen() * delta)
		if s.settings.auto:
			if s.depth >= next_boss_depth():
				s.depth = next_boss_depth()
				spawn_monster(true)
			else:
				var step: float = dig_speed() * delta
				s.depth += step
				_since_enc += step
				if s.depth > s.max_depth:
					s.max_depth = s.depth
				if s.depth > s.run_max:
					s.run_max = s.depth
				if _since_enc >= ENC_DIST:
					_since_enc = 0.0
					spawn_monster(false)
		else:
			_farm_wait += delta
			if _farm_wait >= 2.0:
				_farm_wait = 0.0
				spawn_monster(false)
	else:
		_atk_acc += delta
		var interval: float = 1.0 / aug().spd
		while _atk_acc >= interval and not monster.is_empty():
			_atk_acc -= interval
			_do_hit(false)
		if not monster.is_empty():
			hull -= monster.atk * armor() * delta
			if hull <= 0.0:
				_break_hull()


func spawn_monster(boss: bool) -> void:
	var d: float = s.depth
	var b := Data.biome_index(d)
	var def: Dictionary
	if boss:
		b = mini(int(s.gate), 4)
		def = Data.BOSS_BY_BIOME[b]
	else:
		var list: Array = Data.NORMALS_BY_BIOME[b]
		def = list[rng.randi() % list.size()]
	var mutant := not boss and rng.randf() < 0.06
	var hp := monster_hp(def, b, d)
	var atk := monster_atk(def, b, d)
	if mutant:
		hp *= 3.0
		atk *= 1.3
	monster = {
		"def": def, "id": def.id, "name": ("Мутант: " if mutant else "") + def.name,
		"boss": boss, "mutant": mutant, "hp": hp, "hp_max": hp, "atk": atk, "biome": b,
	}
	_atk_acc = 0.0
	monster_changed.emit()


func tap() -> void:
	if monster.is_empty():
		if s.settings.auto and s.depth < next_boss_depth():
			s.depth += 0.25
			_since_enc += 0.25
			if s.depth > s.max_depth:
				s.max_depth = s.depth
			if s.depth > s.run_max:
				s.run_max = s.depth
		return
	_do_hit(true)


func _do_hit(tapped: bool) -> void:
	var crit := rng.randf() < crit_chance()
	var dmg: float = tap_dmg() if tapped else hit_dmg()
	if crit:
		dmg *= aug().cmult
	monster.hp -= dmg
	hit.emit(dmg, crit, tapped)
	if monster.hp <= 0.0:
		_kill()


func roll_drops(mon: Dictionary, luck: float, rnd: RandomNumberGenerator) -> Dictionary:
	var out := {}
	var cm: float = 1.5 if mon.get("mutant", false) else 1.0
	var qm: int = 2 if mon.get("mutant", false) else 1
	for d in mon.def.drops:
		var ch: float = 1.0 if mon.def.boss else minf(0.95, d[1] * luck * cm)
		if rnd.randf() < ch:
			var q: int = rnd.randi_range(d[2], d[3]) * qm
			out[d[0]] = int(out.get(d[0], 0)) + q
	return out


func _kill() -> void:
	var m := monster
	var drops := roll_drops(m, luck_mult(), rng)
	for r in drops:
		s.res[r] = res(r) + drops[r]
		dropped.emit(r, drops[r])
	s.kills[m.id] = int(s.kills.get(m.id, 0)) + 1
	s.total_kills = int(s.total_kills) + 1
	if m.boss:
		s.gate = int(s.gate) + 1
		s.bosses = int(s.bosses) + 1
		toast.emit("Босс повержен: %s!" % m.def.name)
	monster = {}
	_since_enc = 0.0
	monster_killed.emit(m)
	monster_changed.emit()
	_dirty = true


func _break_hull() -> void:
	s.depth = maxf(0.0, s.depth - 10.0)
	hull = HULL_MAX * 0.5
	monster = {}
	_since_enc = 0.0
	hull_broken.emit()
	toast.emit("Корпус не выдержал! Бур откатился на 10 м.")
	monster_changed.emit()
	_dirty = true


# ---------------------------------------------------------------- покупки
func can_afford(cost: Dictionary) -> bool:
	for r in cost:
		if res(r) < int(cost[r]):
			return false
	return true


func pay(cost: Dictionary) -> void:
	for r in cost:
		s.res[r] = res(r) - int(cost[r])


func buy_auger(id: String) -> bool:
	if owns(id):
		return false
	var a := Data.auger(id)
	if not can_afford(a.cost):
		return false
	pay(a.cost)
	s.owned.append(id)
	s.equipped = id
	toast.emit("Куплен шнек: %s" % a.name)
	changed.emit()
	save_game()
	return true


func equip(id: String) -> void:
	if owns(id):
		s.equipped = id
		_atk_acc = 0.0
		changed.emit()


func buy_upgrade(id: String) -> bool:
	var u: Dictionary = Data.UP_BY_ID[id]
	var lvl := up(id)
	if lvl >= u.max:
		return false
	var cost := Data.upgrade_cost(u, lvl)
	if not can_afford(cost):
		return false
	pay(cost)
	s.up[id] = lvl + 1
	changed.emit()
	return true


func set_setting(k: String, v) -> void:
	s.settings[k] = v
	changed.emit()


func retreat(meters: float) -> void:
	s.depth = maxf(0.0, s.depth - meters)
	monster = {}
	_since_enc = 0.0
	monster_changed.emit()
	changed.emit()


# ---------------------------------------------------------------- перерождение
func prestige_gain() -> int:
	return floori(pow(float(s.run_max) / 60.0, 1.3))


func can_prestige() -> bool:
	return float(s.run_max) >= 300.0


func do_prestige() -> void:
	if not can_prestige():
		return
	var gain := prestige_gain()
	s.cores = int(s.cores) + gain
	s.prestiges = int(s.prestiges) + 1
	s.res = {}
	s.owned = ["a00"]
	s.equipped = "a00"
	s.up = {}
	s.depth = 0.0
	s.run_max = 0.0
	s.gate = 0
	monster = {}
	hull = HULL_MAX
	_since_enc = 0.0
	prestiged.emit(gain)
	toast.emit("Перерождение! Получено ядер: %d" % gain)
	changed.emit()
	monster_changed.emit()
	save_game()


# ---------------------------------------------------------------- офлайн
func offline_estimate(seconds: float) -> Dictionary:
	var secs := minf(seconds, OFFLINE_CAP)
	var d: float = s.depth
	var b := Data.biome_index(d)
	var list: Array = Data.NORMALS_BY_BIOME[b]
	var avg_hpf := 0.0
	for m in list:
		avg_hpf += m.hpf
	avg_hpf /= list.size()
	var avg_hp: float = BASE_HP * pow(BIOME_HP_MULT, minf(b, 4.0)) * avg_hpf * scale_at(b, d)
	var kill_t: float = avg_hp / maxf(dps(), 0.001)
	var walk_t: float = 2.0
	var cycle: float = kill_t + walk_t
	var kills: float = minf(secs * OFFLINE_EFF / cycle, 20000.0)
	var gains := {}
	var luck := luck_mult()
	for m in list:
		for dr in m.drops:
			var ch: float = minf(0.95, dr[1] * luck)
			var q: float = (dr[2] + dr[3]) * 0.5
			gains[dr[0]] = float(gains.get(dr[0], 0.0)) + ch * q * kills / list.size()
	var out := {}
	for r in gains:
		var n := int(floor(gains[r]))
		if n > 0:
			out[r] = n
	return {"seconds": secs, "kills": int(kills), "gains": out}


func apply_offline(seconds: float) -> void:
	var rep := offline_estimate(seconds)
	for r in rep.gains:
		s.res[r] = res(r) + rep.gains[r]
	if not rep.gains.is_empty():
		offline_report = rep
