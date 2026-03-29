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
  console.log('🚀 Подключено к VPS. Начинаем полный деплой...');
  
  const cmd = [
    // 1. Переходим в директорию
    'cd /root/GAMBA_SOURCE',
    
    // 2. Скачиваем последние обновления
    'echo "📥 Git Pull..." && git pull origin main',
    
    // 3. Обновляем зависимости сервера и собираем
    'echo "📦 Обновляем серверные пакеты..." && cd server && npm install',
    
    // 4. Перезапускаем PM2
    'echo "🔄 Перезапускаем backend..." && pm2 restart gamba-backend',
    
    // 5. Переходим к сборке клиентской части
    'echo "🛠 Сборка Frontend (Vite)..." && cd ../casino && npm install && npm run build',
    
    // 6. Копируем результат в веб-сервер
    'echo "📂 Разворачиваем статику в Nginx..." && rm -rf /var/www/notgamba.ru/* && cp -r dist/* /var/www/notgamba.ru/',
    
    // 7. Готово
    'echo "✅ Деплой успешно завершен!"'
  ].join(' && ');

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream
      .on('close', () => { conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect(config);
