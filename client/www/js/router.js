// Ashen Crown — простой роутер экранов. Developer: @yfeeeee
const state = { name: 'campaign', params: {}, render: null };

export function setRenderer(fn) { state.render = fn; }
export function current() { return state; }

export function go(name, params = {}) {
  state.name = name;
  state.params = params;
  if (state.render) state.render();
}

export function refresh() {
  if (state.render) state.render();
}
