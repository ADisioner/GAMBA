// Загружает новый serviceAccountKey.json на VPS и перезапускает бекенд
const { Client } = require('ssh2');
const Sftp = require('ssh2-sftp-client');
const fs = require('fs');

const VPS = {
  host: '159.194.208.69',
  port: 22,
  username: 'root',
  password: 'qG7&B0S3pOgq',
};

const LOCAL_KEY = 'd:/GAMBA/server/serviceAccountKey.json';
const REMOTE_KEY = '/root/GAMBA_SOURCE/server/serviceAccountKey.json';

async function main() {
  if (!fs.existsSync(LOCAL_KEY)) {
    console.error('❌ Файл не найден:', LOCAL_KEY);
    process.exit(1);
  }

  console.log('📤 Загружаем serviceAccountKey.json на VPS...');
  const sftp = new Sftp();
  await sftp.connect(VPS);
  await sftp.put(LOCAL_KEY, REMOTE_KEY);
  await sftp.end();
  console.log('✅ Файл загружен');

  console.log('🔄 Перезапускаем бекенд...');
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      conn.exec('pm2 restart gamba-backend && sleep 2 && pm2 logs gamba-backend --lines 10 --nostream', (err, stream) => {
        if (err) { reject(err); return; }
        stream
          .on('close', () => { conn.end(); resolve(); })
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
      });
    }).connect(VPS);
  });

  console.log('\n✅ Готово! Проверь перевод в банке.');
}

main().catch(err => { console.error('Ошибка:', err); process.exit(1); });
