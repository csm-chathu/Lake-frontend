const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

let phpProcess;
let mysqlProcess;

function checkPhpInstalled() {
  try {
    const phpBin = process.env.PHP_PATH || 'php';
    execSync(`${phpBin} -v`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch (err) {
    return false;
  }
}

function checkPortablePhp() {
  const portablePaths = [
    path.join(__dirname, '..', 'php', 'php.exe'),
    path.join(__dirname, '..', 'php', 'bin', 'php.exe'),
    path.join(__dirname, 'php', 'php.exe'),
    path.join(__dirname, 'php', 'bin', 'php.exe'),
  ];
  
  for (const phpPath of portablePaths) {
    if (fs.existsSync(phpPath)) {
      return phpPath;
    }
  }
  return null;
}

function getPhpBinary() {
  // First check environment variable
  if (process.env.PHP_PATH && fs.existsSync(process.env.PHP_PATH)) {
    return process.env.PHP_PATH;
  }
  
  // Check for portable PHP
  const portablePhp = checkPortablePhp();
  if (portablePhp) {
    console.log('[php] Using portable PHP:', portablePhp);
    return portablePhp;
  }
  
  // Check if system PHP is available
  if (checkPhpInstalled()) {
    console.log('[php] Using system PHP');
    return 'php';
  }
  
  return null;
}

function startPhp() {
  return new Promise((resolve, reject) => {
    const phpBin = getPhpBinary();
    // Support both dev (../backend-laravel) and packaged (dist/backend-laravel) modes
    let backendPath;
    const devPath = path.join(__dirname, '..', 'backend-laravel');
    const distPath = path.join(__dirname, 'backend-laravel');
    const devArtisan = path.join(devPath, 'artisan');
    const distArtisan = path.join(distPath, 'artisan');
    console.log('[debug] Checking backend paths...');
    console.log('[debug] devPath:', devPath, '| exists:', fs.existsSync(devPath), '| artisan:', fs.existsSync(devArtisan));
    console.log('[debug] distPath:', distPath, '| exists:', fs.existsSync(distPath), '| artisan:', fs.existsSync(distArtisan));
    if (fs.existsSync(distPath) && fs.existsSync(distArtisan)) {
      backendPath = distPath;
    } else if (fs.existsSync(devPath) && fs.existsSync(devArtisan)) {
      backendPath = devPath;
    } else {
      console.error('[backend] ERROR: Could not find backend-laravel folder or artisan script in either dev or dist locations.');
      reject(new Error('backend-laravel not found'));
      return;
    }
    console.log('[debug] PATH:', process.env.PATH);
    console.log('[debug] phpBin:', phpBin);
    console.log('[debug] backendPath:', backendPath);
    if (!fs.existsSync(path.join(backendPath, 'vendor'))) {
      console.error('[backend] ERROR: vendor folder missing in backend-laravel.');
    }
    if (!fs.existsSync(path.join(backendPath, 'artisan'))) {
      console.error('[backend] ERROR: artisan script missing in backend-laravel.');
    }
    
    if (!phpBin) {
      console.error('[php] PHP interpreter not found!');
      console.error('[php] Please install PHP or set PHP_PATH environment variable');
      reject(new Error('PHP not found'));
      return;
    }

    console.log('[backend] Starting PHP server with:', phpBin);
    phpProcess = spawn(phpBin, ['artisan', 'serve', '--host=127.0.0.1', '--port=8000'], {
      cwd: backendPath,
      env: { 
        ...process.env, 
        APP_ENV: 'production',
        APP_DEBUG: 'false'
      },
      shell: true,
      detached: false
    });

    let started = false;
    let hasErrors = false;
    
    phpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[php] ${output}`);
      if (output.includes('started') || output.includes('listening')) {
        if (!started) {
          started = true;
          setTimeout(() => resolve(), 1000);
        }
      }
    });

    phpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[php-err] ${output}`);
      if (output.includes('error') || output.includes('Error')) {
        hasErrors = true;
      }
    });

    phpProcess.on('error', (err) => {
      console.error('[php] Failed to start: ', err.message);
      reject(err);
    });

    phpProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[php] Process exited with code ${code}`);
        if (!started) {
          reject(new Error(`PHP exited with code ${code}`));
        }
      }
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!started) {
        if (hasErrors) {
          reject(new Error('PHP failed to start - check logs'));
        } else {
          resolve();
        }
      }
    }, 15000);
  });
}

function startMysql() {
  return new Promise((resolve, reject) => {
    const mysqlDir = path.join(__dirname, 'mysql');
    const mysqld = path.join(mysqlDir, 'bin', process.platform === 'win32' ? 'mysqld.exe' : 'mysqld');
    
    if (!fs.existsSync(mysqld)) {
      console.warn('[mysql] Portable MySQL not found; using system MySQL or SQLite');
      resolve();
      return;
    }

    console.log('[backend] Starting MySQL server...');
    mysqlProcess = spawn(mysqld, ['--defaults-file=' + path.join(mysqlDir, 'my.ini')], {
      cwd: mysqlDir,
      shell: true,
      detached: false
    });

    let started = false;

    mysqlProcess.stdout.on('data', (data) => {
      console.log(`[mysql] ${data}`);
      if (!started) {
        started = true;
        setTimeout(() => resolve(), 2000);
      }
    });

    mysqlProcess.stderr.on('data', (data) => {
      console.error(`[mysql-err] ${data}`);
    });

    mysqlProcess.on('error', (err) => {
      console.error('[mysql] Failed to start: ', err.message);
      resolve(); // Don't reject, MySQL is optional
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        resolve();
      }
    }, 10000);
  });
}

async function checkApiHealth(maxAttempts = 30, delayMs = 1000) {
  console.log('[backend] Checking API health...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/clinic-settings', {
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      
      if (response.status < 500) {
        console.log('[backend] API is ready!');
        return true;
      }
    } catch (err) {
      // Continue trying
    }
    
    if (i < maxAttempts - 1) {
      console.log(`[backend] Attempt ${i + 1}/${maxAttempts} - waiting for API...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  console.warn('[backend] API did not respond in time');
  return false;
}

async function startAll() {
  try {
    // Start MySQL first
    await startMysql();
    
    // Try to start PHP
    try {
      await startPhp();
    } catch (err) {
      console.error('[backend] WARNING: Could not start backend services');
      console.error('[backend]', err.message);
      console.error('[backend]');
      console.error('[backend] SOLUTION:');
      console.error('[backend] 1. Install PHP from https://www.php.net/downloads');
      console.error('[backend] 2. OR set PHP_PATH environment variable to your PHP installation');
      console.error('[backend] 3. OR place portable PHP in: frontend/php/');
      console.error('[backend]');
      console.error('[backend] You can still run the backend manually:');
      console.error('[backend] cd backend-laravel && php artisan serve --host=127.0.0.1 --port=8000');
      console.error('[backend]');
      
      // Still try to connect to existing backend
      console.log('[backend] Checking if backend is already running...');
      const ready = await checkApiHealth(5, 2000);
      if (!ready) {
        throw err;
      }
      return;
    }
    
    // Wait for API to be ready
    await checkApiHealth();
  } catch (err) {
    console.error('[backend] Error during startup:', err.message);
    throw err;
  }
}

function stopAll() {
  console.log('[backend] Shutting down services...');
  
  if (phpProcess) {
    try {
      phpProcess.kill();
    } catch (e) {
      console.warn('[php] Error killing process:', e.message);
    }
  }
  
  if (mysqlProcess) {
    try {
      mysqlProcess.kill();
    } catch (e) {
      console.warn('[mysql] Error killing process:', e.message);
    }
  }
}

module.exports = { startAll, stopAll };
