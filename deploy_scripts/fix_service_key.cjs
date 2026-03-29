// Копирует serviceAccountKey.json из gamba-server в GAMBA_SOURCE/server и перезапускает
const { Client } = require('ssh2');

const config = {
  host: '159.194.208.69',
  port: 22,
  username: 'root',
  password: 'qG7&B0S3pOgq',
  readyTimeout: 15000
};

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    // Сначала проверяем что файл есть в gamba-server (старая директория)
    'ls -la /root/gamba-server/serviceAccountKey.json 2>&1',
    // Проверяем что есть в GAMBA_SOURCE
    'ls -la /root/GAMBA_SOURCE/server/serviceAccountKey.json 2>&1',
    // Копируем ключ если старый есть
    'cp /root/gamba-server/serviceAccountKey.json /root/GAMBA_SOURCE/server/serviceAccountKey.json 2>&1 && echo "KEY COPIED"',
    // Проверяем .env файл (нужен ADMIN_NICKNAME и PORT)
    'cat /root/GAMBA_SOURCE/server/.env 2>&1',
    // Перезапускаем
    'pm2 restart gamba-backend 2>&1',
    'sleep 2',
    'pm2 logs gamba-backend --lines 10 --nostream'
  ].join(' && ');
  
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream
      .on('close', () => { console.log('\n✅ Done'); conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect(config);
