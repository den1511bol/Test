// Ashen Crown — точка входа сервера (Railway). Developer: @yfeeeee
import { createApp } from './app.js';
import { PgStore, MemoryStore } from './store.js';

const port = Number(process.env.PORT) || 3000;
const dbUrl = process.env.DATABASE_URL;

let store;
if (dbUrl) {
  store = await PgStore.connect(dbUrl);
  console.log('PostgreSQL подключён, схема применена');
} else {
  store = new MemoryStore();
  console.warn('⚠ DATABASE_URL не задан — данные хранятся в памяти и пропадут при перезапуске');
}

const server = createApp(store);
server.listen(port, '0.0.0.0', () => console.log(`Ashen Crown server слушает порт ${port} (${store.kind})`));

const shutdown = async () => {
  console.log('Останавливаюсь...');
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
