extends ScrollContainer
## Прокрутка пальцем по любому месту списка (в т.ч. по кнопкам) с инерцией.
## Если палец сдвинулся — нажатие кнопки под ним отменяется. Разработчик: @yfeeeee

const THRESHOLD := 14.0

var _down := false
var _dragging := false
var _start := Vector2.ZERO
var _vel := 0.0
var _held: Array = []      # [Button, был_disabled]


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if get_global_rect().has_point(event.position):
				_down = true
				_dragging = false
				_start = event.position
				_vel = 0.0
		elif _down:
			_down = false
			if _dragging:
				_dragging = false
				_release_buttons.call_deferred()
	elif event is InputEventMouseMotion and _down:
		if not _dragging and absf(event.position.y - _start.y) > THRESHOLD:
			_dragging = true
			_hold_buttons(_start)
		if _dragging:
			scroll_vertical -= int(event.relative.y)
			_vel = -event.relative.y / maxf(get_process_delta_time(), 0.001)
			get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	if not _down and absf(_vel) > 20.0:
		scroll_vertical += int(_vel * delta)
		_vel = lerpf(_vel, 0.0, minf(1.0, delta * 4.0))
	elif not _down:
		_vel = 0.0


func _hold_buttons(p: Vector2) -> void:
	for b in find_children("*", "Button", true, false):
		if b.is_visible_in_tree() and b.get_global_rect().has_point(p):
			_held.append([b, b.disabled])
			b.disabled = true


func _release_buttons() -> void:
	for h in _held:
		if is_instance_valid(h[0]):
			h[0].disabled = h[1]
	_held.clear()
