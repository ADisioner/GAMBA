const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-available/notgamba.ru', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', (data) => console.log(data.toString()))
          .stderr.on('data', (data) => console.log(data.toString()));
  });
}).connect({
  host: '159.194.208.69',
  port: 22,
  username: 'root',
  password: 'qG7&B0S3pOgq'
});
