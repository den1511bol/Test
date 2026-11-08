extends SceneTree
## Симулятор баланса: godot --headless -s tools/sim.gd
## Жадный игрок: покупает следующий шнек и самые полезные улучшения. @yfeeeee

func _initialize() -> void:
	await process_frame
	var G = root.get_node("Game")
	var D = root.get_node("Data")
	G.running = false
	G.s = G.new_state()
	G.rng.seed = 12345
	var t := 0.0
	var dt := 0.1
	var deaths := 0
	var last_report := 0.0
	var marks := {}
	G.hull_broken.connect(func(): deaths += 1)
	var total := float(OS.get_environment("SIM_SECONDS") if OS.get_environment("SIM_SECONDS") != "" else 7200)
	while t < total:
		G.tick(dt)
		t += dt
		if int(t * 10) % 20 == 0:
			_shop(G, D)
		for m in [100, 300, 600, 1000, 1500, 2000]:
			if G.s.max_depth >= m and not marks.has(m):
				marks[m] = t
		if t - last_report >= 600.0:
			last_report = t
			print("t=%5dm depth=%7.1f gate=%d aug=%s dps=%s deaths=%d" % [t / 60, G.s.depth, G.s.gate, G.s.equipped, D.fmt(G.dps()), deaths])
	print("milestones (min): ", marks.keys().map(func(k): return "%d m @ %.1f" % [k, marks[k] / 60.0]))
	print("upgrades: ", G.s.up)
	quit()


func _shop(G, D) -> void:
	# сначала шнек, если можем
	var nxt: int = G.s.owned.size()
	if nxt < D.AUGERS.size():
		G.buy_auger(D.AUGERS[nxt].id)
	# затем улучшения: броня/мощность/реген, по порядку наименьшего уровня
	var order := ["armor", "power", "regen", "tap", "dig", "luck", "crit"]
	var best_id := ""
	var best_lvl := 999
	for id in order:
		var u = D.UP_BY_ID[id]
		var lvl: int = G.up(id)
		if lvl >= u.max:
			continue
		if G.can_afford(D.upgrade_cost(u, lvl)) and lvl < best_lvl:
			best_lvl = lvl
			best_id = id
	# не тратим ресурсы шнека на улучшения, если до следующего шнека близко
	if best_id != "" and nxt < D.AUGERS.size():
		var cost: Dictionary = D.AUGERS[nxt].cost
		var short: float = 0.0
		for r in cost:
			short += maxf(0.0, float(cost[r]) - G.res(r)) / float(cost[r])
		if short < 0.8:
			return
	if best_id != "":
		G.buy_upgrade(best_id)
