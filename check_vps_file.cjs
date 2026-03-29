const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /root/GAMBA_SOURCE/casino/src/pages/AdminPage.tsx', (err, stream) => {
    let out = '';
    stream.on('data', (d) => { out += d.toString(); });
    stream.on('close', () => {
      const lines = out.split('\n');
      console.log('--- ADMIN PAGE ON VPS (Lines 275-305) ---');
      console.log(lines.slice(275, 305).join('\n'));
      conn.end();
    });
  });
}).connect({ host: '159.194.208.69', username: 'root', password: 'qG7&B0S3pOgq' });
