const fs = require('fs');
const pngToIco = require('png-to-ico');
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');
fs.writeFileSync('build/icon.png', pngBuffer);
pngToIco('build/icon.png').then(buf => {
  fs.writeFileSync('build/icon.ico', buf);
  console.log('icon sizes', fs.statSync('build/icon.png').size, fs.statSync('build/icon.ico').size);
}).catch(console.error);
