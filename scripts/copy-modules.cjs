const fs = require('fs');
const path = require('path');

const rootModules = path.resolve(__dirname, '..', 'node_modules');
const frontendModules = path.resolve(__dirname, 'node_modules');

try {
  // remove existing frontend/node_modules
  fs.rmSync(frontendModules, { recursive: true, force: true });
  console.log('removed existing frontend node_modules');
} catch (err) {
  // ignore
}

try {
  fs.cpSync(rootModules, frontendModules, { recursive: true });
  console.log('copied root node_modules into frontend/node_modules');
} catch (err) {
  console.error('failed to copy node_modules', err);
  process.exit(1);
}
