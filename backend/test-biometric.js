const ZKLib = require('zklib');

const zk = new ZKLib({
    ipAddress: '192.168.31.201',
    port: 4370,
    inport: 5200,
    timeout: 5000,
});

async function test() {
    try {
        console.log('CONNECTING...');

        await zk.createSocket();

        console.log('CONNECTED');

        const users = await zk.getUsers();

        console.log('USERS:', users);

        const attendances = await zk.getAttendances();

        console.log('ATTENDANCES:', attendances);

        await zk.disconnect();

        console.log('DONE');
    } catch (err) {
        console.error('ERROR:', err);
    }
}

test();