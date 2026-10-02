#!/usr/bin/env node

/**
 * bin/cli.js - Автономный CLI-раннер NySse Writer для запуска через npx.
 * Работает на чистом Node.js без внешних зависимостей.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = 8089;

function getPort() {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const p = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return DEFAULT_PORT;
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd = '';

  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`[!] Откройте в браузере вручную: ${url}`);
    }
  });
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
      reqPath = '/editor/index.html';
    }

    const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(ROOT_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404: Файл не найден');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[i] Порт ${port} занят, пробуем ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Ошибка сервера:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}/editor/index.html`;
    console.log('\n======================================================');
    console.log('   NySse Writer — Локальный академический редактор    ');
    console.log('   Тактический терминал аудита текста без облаков    ');
    console.log('======================================================');
    console.log(`\n  >> Локальный адрес: ${url}`);
    console.log('  >> Нажмите Ctrl+C для завершения работы\n');

    openBrowser(url);
  });
}

const targetPort = getPort();
startServer(targetPort);
