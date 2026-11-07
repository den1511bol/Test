// Правки сгенерированного Android-проекта после `cap add android`:
// иконки, портретная ориентация, цвет фона иконки, версия приложения.
// Developer: @yfeeeee
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const androidDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(clientDir, 'android');
const res = path.join(androidDir, 'app', 'src', 'main', 'res');
const manifest = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const gradle = path.join(androidDir, 'app', 'build.gradle');

if (!fs.existsSync(androidDir)) {
  console.error(`android-patch: нет каталога ${androidDir}. Сначала выполните "npx cap add android".`);
  process.exit(1);
}

// 1. иконки
const iconSrc = path.join(clientDir, 'resources', 'android');
if (fs.existsSync(iconSrc)) {
  fs.cpSync(iconSrc, res, { recursive: true });
  console.log('android-patch: иконки скопированы');
}

// 2. цвет фона адаптивной иконки
const colorFile = path.join(res, 'values', 'ic_launcher_background.xml');
fs.mkdirSync(path.dirname(colorFile), { recursive: true });
fs.writeFileSync(colorFile, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0D17</color>\n</resources>\n');

// 3. ориентация
if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, 'utf8');
  if (!xml.includes('android:screenOrientation')) {
    if (xml.includes('android:launchMode="singleTask"')) {
      xml = xml.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="portrait"');
    } else {
      xml = xml.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
    }
    fs.writeFileSync(manifest, xml);
    console.log('android-patch: ориентация portrait');
  }
  if (!xml.includes('android.permission.INTERNET')) {
    xml = xml.replace('</manifest>', '    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>');
    fs.writeFileSync(manifest, xml);
  }
}

// 4. версия приложения
if (fs.existsSync(gradle)) {
  const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${run}`).replace(/versionName\s+"[^"]*"/, `versionName "1.0.${run}"`);
  fs.writeFileSync(gradle, g);
  console.log(`android-patch: версия 1.0.${run}`);
}
