const fs = require('fs');
const path = require('path');

const distDir    = path.join(__dirname, '..', 'dist');
const laravelPub = path.join(__dirname, '..', '..', 'backend-laravel', 'public');

if (!fs.existsSync(distDir)) {
  console.error('ERROR: dist/ not found — run vite build first.');
  process.exit(1);
}

// Copy a file, creating parent dirs as needed
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Recursively copy a directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Clear only the assets/ folder and index.html (leave other Laravel public files untouched)
const laravelAssets = path.join(laravelPub, 'assets');
if (fs.existsSync(laravelAssets)) {
  fs.rmSync(laravelAssets, { recursive: true, force: true });
  console.log('Cleared public/assets/');
}

// Copy index.html
const srcIndex  = path.join(distDir, 'index.html');
const destIndex = path.join(laravelPub, 'index.html');
if (fs.existsSync(srcIndex)) {
  copyFile(srcIndex, destIndex);
  console.log('Copied index.html → public/index.html');
}

// Copy assets/
const srcAssets = path.join(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  copyDir(srcAssets, laravelAssets);
  console.log('Copied assets/ → public/assets/');
}

// Copy any other top-level files from dist (e.g. vite.svg, favicon, etc.)
for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
  if (entry.isDirectory()) continue;
  if (entry.name === 'index.html') continue; // already copied
  const srcPath  = path.join(distDir, entry.name);
  const destPath = path.join(laravelPub, entry.name);
  copyFile(srcPath, destPath);
  console.log(`Copied ${entry.name} → public/${entry.name}`);
}

console.log('\nDone — frontend build deployed to backend-laravel/public/');
