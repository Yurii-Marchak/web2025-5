const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { Command } = require('commander');
const superagent = require('superagent');

const program = new Command();
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const { host, port, cache } = program.opts();

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const urlPath = req.url;

  // Перевірка: чи правильно вказаний код (наприклад /404)
  const match = urlPath.match(/^\/(\d{3})$/);
  if (!match) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  const code = match[1];
  const filePath = path.join(cache, `${code}.jpg`);

  if (method === 'GET') {
    try {
      // Спроба читання з кешу
      const data = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    } catch {
      try {
        // Якщо нема в кеші — запит до http.cat
        const response = await superagent.get(`https://http.cat/${code}`).responseType('blob');
        const imageData = response.body;

        // Запис у кеш
        await fs.writeFile(filePath, imageData);

        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imageData);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }
  } else if (method === 'PUT') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(body);
      await fs.writeFile(filePath, buffer);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Created');
    });
  } else if (method === 'DELETE') {
    try {
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Deleted');
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
