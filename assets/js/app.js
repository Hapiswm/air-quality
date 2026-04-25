// =========================================================================
// 1. KONFIGURASI FIREBASE
// =========================================================================
const firebaseConfig = {
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Variabel Global untuk Grafik
let gasChart, particleChart;
const maxDataPoints = 15;

// =========================================================================
// 2. FITUR LOGIN & INISIALISASI HALAMAN
// =========================================================================
window.onload = () => {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');
    if(sessionStorage.getItem("isAdmin") === "true") {
        if(panel) panel.style.display = 'block';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
    }

    // Inisialisasi Grafik jika elemen canvas ada di halaman
    if(document.getElementById('gasChart')) initCharts();
};

function toggleLogin() {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');

    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin");
        if(panel) panel.style.display = 'none';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-lock"></i> Login Admin';
        alert("Anda telah logout dari mode Admin.");
    } else {
        let pass = prompt("Masukkan Password Admin:");
        if (pass === "hafidz123") {
            sessionStorage.setItem("isAdmin", "true");
            if(panel) panel.style.display = 'block';
            if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
            alert("Login Berhasil! Panel kontrol telah dibuka.");
        } else if (pass !== null) {
            alert("Password Salah!");
        }
    }
}

// Fungsi Kontrol Alat
function setAlat(status) {
    db.ref('/kontrol/sistem').set(status);
}

db.ref('/kontrol/sistem').on('value', (snapshot) => {
    let status = snapshot.val();
    let statusSistemEl = document.getElementById('status-sistem');
    if(statusSistemEl) {
        if(status === 'START') {
            statusSistemEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: AKTIF (START)`;
            statusSistemEl.style.background = "rgba(16, 185, 129, 0.2)"; 
            statusSistemEl.style.color = "#10b981";
        } else {
            statusSistemEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: MATI (STOP)`;
            statusSistemEl.style.background = "rgba(239, 68, 68, 0.2)"; 
            statusSistemEl.style.color = "#ef4444";
        }
    }
});

// =========================================================================
// 3. GRAFIK LIVE & UPDATE DASHBOARD
// =========================================================================
function initCharts() {
    const ctxGas = document.getElementById('gasChart').getContext('2d');
    const ctxParticle = document.getElementById('particleChart').getContext('2d');

    Chart.defaults.color = '#cbd5e1';
    
    gasChart = new Chart(ctxGas, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'MQ-135 (PPM)', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 },
            { label: 'MQ-7 (PPM)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', data: [], fill: true, tension: 0.4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
    });

    particleChart = new Chart(ctxParticle, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'PM 2.5', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], fill: true, tension: 0.4 },
            { label: 'PM 10', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
    });
}

function safeUpdateDOM(id, val, isStatus = false) {
    let el = document.getElementById(id);
    if(el) {
        if (isStatus) {
            el.innerText = val;
            if(val === "BAIK") el.style.color = "#10b981";
            else if(val === "SEDANG") el.style.color = "#f59e0b";
            else el.style.color = "#ef4444";
        } else {
            el.innerText = (typeof val === 'number' && val % 1 !== 0) ? val.toFixed(2) : val;
        }
    }
}

function hitungStatus(pm25) {
    if (pm25 <= 15) return "BAIK";
    if (pm25 <= 55) return "SEDANG";
    return "BERBAHAYA";
}

db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if(data) {
        let connEl = document.getElementById('conn-status');
        let statText = document.getElementById('status-text');
        if(connEl && statText) {
            connEl.className = 'status-badge online';
            statText.innerText = 'TERHUBUNG (LIVE)';
        }

        // Update Angka
        safeUpdateDOM('val-mq135_indoor', data.mq135_indoor);
        safeUpdateDOM('val-mq7_indoor', data.mq7_indoor);
        safeUpdateDOM('val-pm25_indoor', data.pm25_indoor);
        safeUpdateDOM('val-pm10_indoor', data.pm10_indoor);
        safeUpdateDOM('stat-pm25_indoor', hitungStatus(data.pm25_indoor), true);

        safeUpdateDOM('val-mq135_outdoor', data.mq135_outdoor);
        safeUpdateDOM('val-mq7_outdoor', data.mq7_outdoor);
        safeUpdateDOM('val-pm25_outdoor', data.pm25_outdoor);
        safeUpdateDOM('val-pm10_outdoor', data.pm10_outdoor);
        safeUpdateDOM('stat-pm25_outdoor', hitungStatus(data.pm25_outdoor), true);

        // Update Grafik Live
        if(gasChart && particleChart) {
            let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
            
            gasChart.data.labels.push(now);
            gasChart.data.datasets[0].data.push(data.mq135_indoor);
            gasChart.data.datasets[1].data.push(data.mq7_indoor);
            
            particleChart.data.labels.push(now);
            particleChart.data.datasets[0].data.push(data.pm25_indoor);
            particleChart.data.datasets[1].data.push(data.pm10_indoor);

            if(gasChart.data.labels.length > maxDataPoints) {
                gasChart.data.labels.shift();
                gasChart.data.datasets[0].data.shift();
                gasChart.data.datasets[1].data.shift();
            }
            if(particleChart.data.labels.length > maxDataPoints) {
                particleChart.data.labels.shift();
                particleChart.data.datasets[0].data.shift();
                particleChart.data.datasets[1].data.shift();
            }
            gasChart.update();
            particleChart.update();
        }
    }
});

// =========================================================================
// 4. FITUR EXPORT EXCEL
// =========================================================================
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0;
    for (let i = 0; i < 8; i++) { time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i)); }
    return new Date(time);
}

function formatTanggalWaktu(date) {
    let d = date.getDate().toString().padStart(2, '0');
    let m = (date.getMonth() + 1).toString().padStart(2, '0');
    let y = date.getFullYear();
    let jam = date.getHours().toString().padStart(2, '0');
    let mnt = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}/${y} ${jam}:${mnt}`;
}

function downloadExcel(mode) {
    alert("Sistem sedang merakit data Excel... Silakan tunggu sebentar.");
    
    db.ref('/logs').limitToLast(10000).once('value').then(snapshot => {
        let dataMentah = [];
        snapshot.forEach(childSnapshot => {
            let key = childSnapshot.key;
            let row = childSnapshot.val();
            row.waktuAsli = getRealTimeFromFirebaseKey(key); 
            dataMentah.push(row);
        });

        if(dataMentah.length === 0) { alert("Belum ada data history."); return; }

        let dataExcel = [];

        if (mode === 'raw') {
            dataExcel = dataMentah.map(r => ({
                "Waktu (WIB)": formatTanggalWaktu(r.waktuAsli),
                "Indoor MQ-135 (PPM)": +(parseFloat(r.mq135_indoor || 0).toFixed(2)),
                "Indoor MQ-7 (PPM)": +(parseFloat(r.mq7_indoor || 0).toFixed(2)),
                "Indoor PM2.5 (ug/m3)": +(r.pm25_indoor || 0),
                "Indoor PM10 (ug/m3)": +(r.pm10_indoor || 0),
                "Outdoor MQ-135 (PPM)": +(parseFloat(r.mq135_outdoor || 0).toFixed(2)),
                "Outdoor MQ-7 (PPM)": +(parseFloat(r.mq7_outdoor || 0).toFixed(2)),
                "Outdoor PM2.5 (ug/m3)": +(r.pm25_outdoor || 0),
                "Outdoor PM10 (ug/m3)": +(r.pm10_outdoor || 0)
            }));
        } else {
            let intervalMs;
            if (mode === '15min') intervalMs = 15 * 60 * 1000;
            else if (mode === '1hour') intervalMs = 60 * 60 * 1000;
            else if (mode === '2hour') intervalMs = 2 * 60 * 60 * 1000;

            let grupWaktu = {};

            dataMentah.forEach(r => {
                let blokWaktu = new Date(Math.floor(r.waktuAsli.getTime() / intervalMs) * intervalMs);
                let labelWaktu = formatTanggalWaktu(blokWaktu);

                if (!grupWaktu[labelWaktu]) {
                    grupWaktu[labelWaktu] = { count: 0, mq135_in: 0, mq7_in: 0, pm25_in: 0, pm10_in: 0, mq135_out: 0, mq7_out: 0, pm25_out: 0, pm10_out: 0 };
                }

                grupWaktu[labelWaktu].count++;
                grupWaktu[labelWaktu].mq135_in += parseFloat(r.mq135_indoor || 0);
                grupWaktu[labelWaktu].mq7_in += parseFloat(r.mq7_indoor || 0);
                grupWaktu[labelWaktu].pm25_in += parseFloat(r.pm25_indoor || 0);
                grupWaktu[labelWaktu].pm10_in += parseFloat(r.pm10_indoor || 0);
                grupWaktu[labelWaktu].mq135_out += parseFloat(r.mq135_outdoor || 0);
                grupWaktu[labelWaktu].mq7_out += parseFloat(r.mq7_outdoor || 0);
                grupWaktu[labelWaktu].pm25_out += parseFloat(r.pm25_outdoor || 0);
                grupWaktu[labelWaktu].pm10_out += parseFloat(r.pm10_outdoor || 0);
            });

            for (let waktu in grupWaktu) {
                let g = grupWaktu[waktu]; let c = g.count; 
                dataExcel.push({
                    "Waktu Rentang (WIB)": waktu,
                    "Total Sampel Data": c,
                    "Rata-rata Indoor MQ-135": +(g.mq135_in / c).toFixed(2),
                    "Rata-rata Indoor MQ-7": +(g.mq7_in / c).toFixed(2),
                    "Rata-rata Indoor PM2.5": +(g.pm25_in / c).toFixed(1),
                    "Rata-rata Indoor PM10": +(g.pm10_in / c).toFixed(1),
                    "Rata-rata Outdoor MQ-135": +(g.mq135_out / c).toFixed(2),
                    "Rata-rata Outdoor MQ-7": +(g.mq7_out / c).toFixed(2),
                    "Rata-rata Outdoor PM2.5": +(g.pm25_out / c).toFixed(1),
                    "Rata-rata Outdoor PM10": +(g.pm10_out / c).toFixed(1)
                });
            }
        }

        const worksheet = XLSX.utils.json_to_sheet(dataExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Penelitian");

        let labelFile = (mode === 'raw') ? 'Mentah' : (mode === '15min') ? '15Menit' : (mode === '1hour') ? '1Jam' : '2Jam';
        let namaFile = `Data_NanoBanana_${labelFile}.xlsx`;
        XLSX.writeFile(workbook, namaFile);

    }).catch(error => {
        alert("Gagal mengambil data dari Firebase. Error: " + error);
    });
}
