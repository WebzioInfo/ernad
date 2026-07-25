import * as net from 'net';

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`Port ${port} is OPEN`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, '127.0.0.1');
  });
}

async function scan() {
  console.log('Scanning localhost ports 5430-5435...');
  for (let p = 5430; p <= 5435; p++) {
    await checkPort(p);
  }
  console.log('Port scan complete.');
}

scan();
