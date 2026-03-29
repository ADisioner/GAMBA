const { Client } = require('ssh2');
const config = {
  host: '159.194.208.69',
  port: 22,
  username: 'root',
  password: 'qG7&B0S3pOgq'
};

const commands = [
    'cd /root && git clone https://github.com/ADisioner/GAMBA.git /root/GAMBA_SOURCE || (cd /root/GAMBA_SOURCE && git pull)',
    'cp /root/gamba-server/.env /root/GAMBA_SOURCE/server/.env || true',
    'cp /root/gamba-server/serviceAccountKey.json /root/GAMBA_SOURCE/server/serviceAccountKey.json || true',
    'cd /root/GAMBA_SOURCE/server && npm install',
    'cd /root/GAMBA_SOURCE/casino && npm install && npm run build',
    'rm -rf /var/www/notgamba.ru/* && cp -r /root/GAMBA_SOURCE/casino/dist/* /var/www/notgamba.ru/',
    'pm2 stop gamba-backend || true',
    'pm2 delete gamba-backend || true',
    'cd /root/GAMBA_SOURCE/server && pm2 start index.js --name gamba-backend',
    'pm2 save',
    `cat <<EOF > /root/deploy.sh
#!/bin/bash
cd /root/GAMBA_SOURCE
git pull
cd server && npm install
cd ../casino && npm install && npm run build
rm -rf /var/www/notgamba.ru/* && cp -r dist/* /var/www/notgamba.ru/
pm2 restart gamba-backend
EOF
`,
    'chmod +x /root/deploy.sh'
];

const conn = new Client();
conn.on('ready', async () => {
    for (const cmd of commands) {
        await new Promise((resolve) => {
            conn.exec(cmd, (err, stream) => {
                stream.on('close', resolve).on('data', d => console.log(d.toString())).stderr.on('data', d => console.log(d.toString()));
            });
        });
    }
    conn.end();
}).connect(config);
