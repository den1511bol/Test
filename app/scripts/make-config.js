// Генерирует capacitor.config.json с адресом вашего сервера. Developer: @yfeeeee
const fs = require('node:fs');
const url = (process.env.SERVER_URL || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+/.test(url)) {
  console.error('SERVER_URL должен быть вида https://что-то.up.railway.app');
  process.exit(1);
}
const config = {
  appId: 'com.yfeeeee.pixelminers',
  appName: 'Pixel Miners',
  webDir: 'www',
  backgroundColor: '#1a1226',
  server: { url, cleartext: false, errorPath: 'error.html' },
  android: { backgroundColor: '#1a1226' },
};
fs.writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2));
console.log('capacitor.config.json создан, сервер:', url);
