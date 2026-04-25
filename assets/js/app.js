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

let gasChart = null, particleChart = null; 
let compMq135 = null, compMq7 = null, compPm25 = null, compPm10 = null; 
let maxDataPoints = 15; 

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
    
    setTimeout(() => {
        if(document.getElementById('gasChart')) initDashboardCharts();
        if(document.getElementById('chart-mq135')) initComparisonCharts();
        if(document.getElementById('history-table-body')) initHistoryTable();
    }, 300); 
};

function toggleLogin() {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');

    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin");
        if(panel) panel.style.display = 'none';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-lock"></i> Login Admin';
        alert("Anda telah logout.");
    } else {
        let pass = prompt("Masukkan Password Admin:");
        if (pass === "hafidz123") {
            sessionStorage.setItem("isAdmin", "true");
            if(panel) panel.style.display = 'block';
            if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
        } else if (pass !== null) {
            alert("Password Salah!");
        }
    }
}

function setAlat(status) { db.ref('/kontrol/sistem').set(status); }

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
// 3. INISIALISASI GRAFIK
// =========================================================================
function initDashboardCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#cbd5e1';
    
    gasChart = new Chart(document.getElementById('gasChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'MQ-135 (PPM)', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 },
            { label: 'MQ-7 (PPM)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', data: [], fill: true, tension: 0.4 }
        ]}, options: { responsive: true, maintainAspectRatio: false }
    });

    particleChart = new Chart(document.getElementById('particleChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'PM 2.5', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], fill: true, tension: 0.4 },
            { label: 'PM 10', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }
        ]}, options: { responsive: true, maintainAspectRatio: false }
    });
}

function initComparisonCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#cbd5e1';
    
    const commonOpts = { responsive: true, maintainAspectRatio: false };
    const createCompChart = (id) => {
        return new Chart(document.getElementById(id).getContext('2d'), {
            type: 'line', data: { labels: [], datasets: [
                { label: 'INDOOR', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 },
                { label: 'OUTDOOR', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }
            ]}, options: commonOpts
        });
    };

    compMq135 = createCompChart('chart-mq135');
    compMq7 = createCompChart('chart-mq7');
    compPm25 = createCompChart('chart-pm25');
    compPm10 = createCompChart('chart-pm10');
    
    let filterEl = document.getElementById('chart-time-filter');
    if(filterEl) {
        filterEl.addEventListener('change', (e) => {
            maxDataPoints = parseInt(e.target.value);
            alert("Rentang waktu diperbarui.");
        });
    }
}

// =========================================================================
// 4. UPDATE DATA DASHBOARD & WARNA KOTAK KARTU (SMART UI)
// =========================================================================
function hitungStatusDebu(val) { return val <= 50 ? "BAIK" : val <= 150 ? "SEDANG" : "BERBAHAYA"; }
function hitungStatusGas(ppm) { return ppm <= 100 ? "BAIK" : ppm <= 250 ? "SEDANG" : "BERBAHAYA"; }

// Fungsi sakti untuk mewarnai tulisan dan garis atas kotak sekaligus
function updateSensorCard(valId, statId, cardId, val, type) {
    let elVal = document.getElementById(valId);
    let elStat = document.getElementById(statId);
    let elCard = document.getElementById(cardId);
    
    if(elVal) elVal.innerText = (typeof val === 'number' && val % 1 !== 0) ? val.toFixed(2) : val;
    
    let status = (type === 'debu') ? hitungStatusDebu(val) : hitungStatusGas(val);
    let warna = "#10b981"; // Default Hijau (BAIK)
    
    if(status === "SEDANG") warna = "#f59e0b"; // Kuning
    else if(status === "BERBAHAYA") warna = "#ef4444"; // Merah
    
    if(elStat) {
        elStat.innerText = status;
        elStat.style.color = warna;
    }
    
    if(elCard) {
        elCard.style.borderTop = `4px solid ${warna}`;
        // Opsional: Tambahkan sedikit cahaya (glow) sesuai warna agar makin cantik
        elCard.style.boxShadow = `0 4px 15px ${warna}22`; 
    }
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

        // --- UPDATE DASHBOARD DENGAN KARTU BERWARNA ---
        updateSensorCard('val-mq135_indoor', 'stat-mq135_indoor', 'card-mq135_indoor', data.mq135_indoor, 'gas');
        updateSensorCard('val-mq7_indoor', 'stat-mq7_indoor', 'card-mq7_indoor', data.mq7_indoor, 'gas');
        updateSensorCard('val-pm25_indoor', 'stat-pm25_indoor', 'card-pm25_indoor', data.pm25_indoor, 'debu');
        updateSensorCard('val-pm10_indoor', 'stat-pm10_indoor', 'card-pm10_indoor', data.pm10_indoor, 'debu');

        updateSensorCard('val-mq135_outdoor', 'stat-mq135_outdoor', 'card-mq135_outdoor', data.mq135_outdoor, 'gas');
        updateSensorCard('val-mq7_outdoor', 'stat-mq7_outdoor', 'card-mq7_outdoor', data.mq7_outdoor, 'gas');
        updateSensorCard('val-pm25_outdoor', 'stat-pm25_outdoor', 'card-pm25_outdoor', data.pm25_outdoor, 'debu');
        updateSensorCard('val-pm10_outdoor', 'stat-pm10_outdoor', 'card-pm10_outdoor', data.pm10_outdoor, 'debu');

        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });

        // --- UPDATE GRAFIK DASHBOARD ---
        if(gasChart !== null && particleChart !== null) {
            gasChart.data.labels.push(now); gasChart.data.datasets[0].data.push(data.mq135_indoor || 0); gasChart.data.datasets[1].data.push(data.mq7_indoor || 0);
            particleChart.data.labels.push(now); particleChart.data.datasets[0].data.push(data.pm25_indoor || 0); particleChart.data.datasets[1].data.push(data.pm10_indoor || 0);

            if(gasChart.data.labels.length > maxDataPoints) { gasChart.data.labels.shift(); gasChart.data.datasets[0].data.shift(); gasChart.data.datasets[1].data.shift(); }
            if(particleChart.data.labels.length > maxDataPoints) { particleChart.data.labels.shift(); particleChart.data.datasets[0].data.shift(); particleChart.data.datasets[1].data.shift(); }
            gasChart.update('none'); particleChart.update('none');
        }

        // --- UPDATE GRAFIK KOMPARASI ---
        if(compMq135 !== null) {
            const pushComp = (chart, valIn, valOut) => {
                chart.data.labels.push(now);
                chart.data.datasets[0].data.push(valIn || 0); chart.data.datasets[1].data.push(valOut || 0);
                if(chart.data.labels.length > maxDataPoints) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); chart.data.datasets[1].data.shift(); }
                chart.update('none');
            };
            pushComp(compMq135, data.mq135_indoor, data.mq135_outdoor);
            pushComp(compMq7, data.mq7_indoor, data.mq7_outdoor);
            pushComp(compPm25, data.pm25_indoor, data.pm25_outdoor);
            pushComp(compPm10, data.pm10_indoor, data.pm10_outdoor);
        }
    }
});

// =========================================================================
// 5. TABEL PRATINJAU HISTORY
// =========================================================================
function initHistoryTable() {
    let tbody = document.getElementById('history-table-body');
    if (!tbody) return; 

    db.ref('/logs').limitToLast(10).on('value', (snapshot) => {
        tbody.innerHTML = '';
        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="9">Belum ada data history yang tersimpan.</td></tr>'; 
            return;
        }

        let rowsHTML = [];
        snapshot.forEach(child => {
            let r = child.val();
            let date = formatTanggalWaktu(getRealTimeFromFirebaseKey(child.key));
            rowsHTML.unshift(`
                <tr>
                    <td>${date}</td>
                    <td>${parseFloat(r.mq135_indoor||0).toFixed(1)}</td>
                    <td>${parseFloat(r.mq7_indoor||0).toFixed(1)}</td>
                    <td>${r.pm25_indoor||0}</td>
                    <td>${r.pm10_indoor||0}</td>
                    <td>${parseFloat(r.mq135_outdoor||0).toFixed(1)}</td>
                    <td>${parseFloat(r.mq7_outdoor||0).toFixed(1)}</td>
                    <td>${r.pm25_outdoor||0}</td>
                    <td>${r.pm10_outdoor||0}</td>
                </tr>
            `);
        });
        tbody.innerHTML = rowsHTML.join('');
    });
}

// =========================================================================
// 6. EXPORT EXCEL
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
        let namaFile = `Data_AirQuality_${labelFile}.xlsx`;
        XLSX.writeFile(workbook, namaFile);

    }).catch(error => {
        alert("Gagal mengambil data dari Firebase. Error: " + error);
    });
}
