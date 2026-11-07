// Подготовка веб-ресурсов клиента: копирует shared/ в client/www/shared и пишет config.js.
// Использование: API_URL=https://your-app.up.railway.app node client/scripts/prepare.js
// Developer: @yfeeeee
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const www = path.resolve(here, '..', 'www');
const shared = path.resolve(here, '..', '..', 'shared');

fs.rmSync(path.join(www, 'shared'), { recursive: true, force: true });
fs.cpSync(shared, path.join(www, 'shared'), { recursive: true });

const api = (process.env.API_URL || '').trim().replace(/\/+$/, '');
if (api) {
  fs.writeFileSync(
    path.join(www, 'config.js'),
    `// Сгенерировано client/scripts/prepare.js\nwindow.GAME_CONFIG = { apiUrl: ${JSON.stringify(api)} };\n`,
  );
}
console.log(`prepare: shared скопирован, apiUrl=${api || '(config.js не менялся)'}`);
