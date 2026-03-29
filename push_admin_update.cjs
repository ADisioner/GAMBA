const Sftp = require('ssh2-sftp-client');
const { Client } = require('ssh2');

async function pushUpdate() {
  const sftp = new Sftp();
  try {
    await sftp.connect({ host: '159.194.208.69', username: 'root', password: 'qG7&B0S3pOgq' });
    await sftp.put('d:/GAMBA/update_files.zip', '/root/update_files.zip');
    await sftp.end();

    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('unzip -o /root/update_files.zip -d /root/update_temp && rm -rf /var/www/notgamba.ru/* && cp -r /root/update_temp/dist/* /var/www/notgamba.ru/ && cp /root/update_temp/server_index.js /root/gamba-server/index.js && cp /root/update_temp/server_index.js /root/GAMBA_SOURCE/server/index.js && rm -rf /root/update_temp /root/update_files.zip && pm2 restart gamba-backend', (err, stream) => {
        stream.on('close', () => { console.log('Update pushed successfully'); conn.end(); }).on('data', d => console.log(d.toString()));
      });
    }).connect({ host: '159.194.208.69', username: 'root', password: 'qG7&B0S3pOgq' });
  } catch(e) { console.error(e) }
}
pushUpdate();
