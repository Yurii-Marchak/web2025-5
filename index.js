const http = require('http');
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const code = req.url.slice(1); // Витягуємо код зі шляху URL: /200 => 200
  const filePath = path.join(options.cache, `${code}.jpg`);

  if (!/^\d+$/.test(code)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request: Некоректний код');
  }

  if (method === 'GET') {
    try {
      const data = await fsPromises.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: Картинку не знайдено в кеші');
    }
  }

  else if (method === 'PUT') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      try {
        await fsPromises.writeFile(filePath, buffer);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('Created: Картинку збережено в кеш');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: Не вдалося зберегти');
      }
    });
  }

  else if (method === 'DELETE') {
    try {
      await fsPromises.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK: Картинку видалено з кешу');
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: Картинку не знайдено для видалення');
    }
  }

  else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено на http://${options.host}:${options.port}`);
  console.log(`Кешова директорія: ${path.resolve(options.cache)}`);
});
