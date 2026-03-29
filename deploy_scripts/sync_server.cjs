// Проверяем откуда реально запускается gamba-backend и синхронизируем
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
    // Где реально запущен бекенд
    'pm2 show gamba-backend | grep "exec path\\|cwd\\|script"',
    // Копируем новый файл из git-источника туда, где бекенд реально работает
    'cp /root/GAMBA_SOURCE/server/index.js /root/gamba-server/index.js',
    'pm2 restart gamba-backend',
    'sleep 2',
    // Смотрим что в работающем файле (строки с AUTH логами)
    'grep "\\.\\[AUTH\\]" /root/gamba-server/index.js | head -5',
    // Последние логи
    'pm2 logs gamba-backend --lines 20 --nostream'
  ].join(' && ');
  
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream
      .on('close', () => { console.log('\n✅ Done'); conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect(config);
