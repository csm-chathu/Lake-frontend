const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');

// Kill only electron related processes
try {
  if (process.platform === 'win32') {
    execSync('taskkill /IM electron.exe /F', { stdio: 'ignore' });
    execSync('taskkill /IM "Vet Final.exe" /F', { stdio: 'ignore' });
  }
} catch (e) {
  // ignore if not running
}

// Small delay to allow Windows to release file locks
function tryClean(attempt = 1) {
  if (fs.existsSync(distPath)) {
    try {
      // attempt to rename the directory first; renaming often succeeds even when files are locked
      const newName = distPath + '.old.' + Date.now();
      fs.renameSync(distPath, newName);
      console.log(`dist folder renamed to ${newName}`);
      // remove the renamed folder asynchronously
      setTimeout(() => {
        try {
          fs.rmSync(newName, { recursive: true, force: true });
        } catch {}
      }, 1000);
      return;
    } catch (renameErr) {
      // ignore and fall through to removal
    }
  }
  try {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('dist folder cleaned');
  } catch (err) {
    if (attempt < 5) {
      console.log(`dist folder locked (attempt ${attempt}), retrying in 500ms...`);
      setTimeout(() => tryClean(attempt + 1), 500);
    } else {
      console.log('dist folder still locked after multiple attempts; you may need to close any Explorer windows or running apps using it');
    }
  }
}
setTimeout(() => tryClean(), 500);