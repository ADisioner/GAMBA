const { Client } = require('ssh2');
const config = {
  host: '159.194.208.69',
  port: 22,
  username: 'root',
  password: 'qG7&B0S3pOgq',
  readyTimeout: 15000
};

const newNginx = `server {
    server_name notgamba.ru www.notgamba.ru 159.194.208.69;

    root /var/www/notgamba.ru;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; 
    ssl_certificate /etc/letsencrypt/live/notgamba.ru/fullchain.pem; 
    ssl_certificate_key /etc/letsencrypt/live/notgamba.ru/privkey.pem; 
    include /etc/letsencrypt/options-ssl-nginx.conf; 
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; 

}
server {
    listen 80;
    server_name notgamba.ru www.notgamba.ru 159.194.208.69;

    if ($host = notgamba.ru) {
        return 301 https://$host$request_uri;
    }
    
    # Allow IP access on port 80 just in case
    root /var/www/notgamba.ru;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}`;

const commands = [
    `echo '${newNginx}' > /etc/nginx/sites-available/notgamba.ru`,
    'nginx -t && systemctl reload nginx'
];

const conn = new Client();
conn.on('ready', async () => {
    for (const cmd of commands) {
        await new Promise((resolve) => {
            conn.exec(cmd, (err, stream) => {
                if (err) return resolve();
                stream.on('close', () => resolve())
                      .on('data', (d) => process.stdout.write(d))
                      .stderr.on('data', (d) => process.stderr.write(d));
            });
        });
    }
    conn.end();
}).connect(config);
