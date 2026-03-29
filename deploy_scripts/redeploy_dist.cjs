const Sftp = require('ssh2-sftp-client');
const { Client } = require('ssh2');

async function redeployDist() {
  const sftp = new Sftp();
  try {
    await sftp.connect({
      host: '159.194.208.69',
      port: 22,
      username: 'root',
      password: 'qG7&B0S3pOgq'
    });
    console.log('SFTP connected');
    await sftp.put('d:/GAMBA/dist_only.zip', '/root/dist_only.zip');
    console.log('Dist ZIP uploaded');
    await sftp.end();

    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('mkdir -p /root/dist_temp && unzip -o /root/dist_only.zip -d /root/dist_temp && rm -rf /var/www/notgamba.ru/* && cp -r /root/dist_temp/dist/* /var/www/notgamba.ru/ && rm -rf /root/dist_temp /root/dist_only.zip', (err, stream) => {
        stream.on('close', () => {
             console.log('Redeploy finished');
             conn.end();
        }).on('data', d => console.log(d.toString()));
      });
    }).connect({
      host: '159.194.208.69',
      port: 22,
      username: 'root',
      password: 'qG7&B0S3pOgq'
    });
  } catch(e) { console.error(e) }
}
redeployDist();
