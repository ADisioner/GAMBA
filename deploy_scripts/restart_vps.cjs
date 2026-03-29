// Перезапускает бекенд на VPS и показывает последние логи PM2
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
  // Обновляем сервер из git и перезапускаем
  const cmd = 'cd /root/GAMBA_SOURCE/server && git pull origin main && pm2 restart gamba-backend && sleep 2 && pm2 logs gamba-backend --lines 30 --nostream';
  
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream
      .on('close', () => { console.log('\n✅ Done'); conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect(config);
