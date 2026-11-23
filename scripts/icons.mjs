// Same as scripts/icons.py, for a PC without Python: reads the names from icons.py and writes
// assets/fonts/icons.ttf + icons.json. Needs the subset-font package (not a dependency of the app):
//   npm i --no-save subset-font   (or install it in a scratch folder and set NODE_PATH)
//   node scripts/icons.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const subsetFont = require('subset-font');
const py = fs.readFileSync('scripts/icons.py', 'utf8');
const list = py.slice(py.indexOf('NAMES = ['), py.indexOf(']', py.indexOf('NAMES = [')));
const names = [...list.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
const SRC = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons';
const full = JSON.parse(fs.readFileSync(`${SRC}/glyphmaps/Ionicons.json`, 'utf8'));
const glyphs = Object.fromEntries(names.map((n) => {
  if (!(n in full)) throw new Error(`No Ionicon called ${n}`);
  return [n, full[n]];
}));
const text = Object.values(glyphs).map((c) => String.fromCodePoint(c)).join('');
const out = await subsetFont(fs.readFileSync(`${SRC}/Fonts/Ionicons.ttf`), text, { targetFormat: 'truetype' });
fs.writeFileSync('assets/fonts/icons.ttf', out);
fs.writeFileSync('assets/fonts/icons.json', JSON.stringify(glyphs, null, 2) + '\n');
console.log(`${names.length} icons written, ${out.length} bytes`);
