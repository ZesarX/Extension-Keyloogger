// npm install; despues: node obfuscate.js
const fs = require('fs');
const Obf = require('javascript-obfuscator');

const opts = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  stringArray: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.9,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 5,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

for (const f of ['background.js', 'content.js', 'popup.js']) {
  const src = fs.readFileSync(f, 'utf8');
  // decoy: funcion falsa de notas para ensuciar firmas estaticas
  const decoy = 'function syncNotesCache(){let a=[1,2,3].map(x=>x*2);return a.join(",");}syncNotesCache();\n' + src;
  const out = Obf.obfuscate(decoy, opts).getObfuscatedCode();
  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  fs.writeFileSync('dist/' + f, out);
  console.log('OK dist/' + f + ' (' + out.length + ' bytes)');
}
// copia manifest + popup + iconos renombrando dist a listo-para-cargar
fs.copyFileSync('manifest.json', 'dist/manifest.json');
fs.copyFileSync('popup.html', 'dist/popup.html');

for (const f of ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png', 'icon.png', 'icon.ico']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, 'dist/' + f);
}
console.log('Listo: carga dist/ como extension descomprimida.');
