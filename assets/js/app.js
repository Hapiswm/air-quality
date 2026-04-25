// =======================================================
// 1. KONFIGURASI FIREBASE (Pastikan URL-mu benar!)
// 1. KONFIGURASI FIREBASE
// =======================================================
const firebaseConfig = {
  databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const ADMIN_PASSWORD = "admin123"; 

let globalHistoryData = []; 
let currentLogListener = null; 

// Fungsi Logika Sensor
// =======================================================
// 2. FUNGSI DASAR
// =======================================================
function getIspu(val) {
  if (val <= 50) return { lbl: "BAIK", cls: "baik", color: "#10b981" };
  if (val <= 100) return { lbl: "SEDANG", cls: "sedang", color: "#fbbf24" };
@@ -19,62 +22,90 @@
  if (val <= 300) return { lbl: "SANGAT TDK SEHAT", cls: "sangat-tidak-sehat", color: "#a855f7" };
  return { lbl: "BERBAHAYA", cls: "berbahaya", color: "#dc2626" };
}

const SENSORS = [ { id: 'mq135_outdoor', title: 'MQ-135 Outdoor', unit: 'PPM', max: 400 }, { id: 'mq7_outdoor', title: 'MQ-7 Outdoor', unit: 'PPM', max: 400 }, { id: 'pm25_outdoor', title: 'PM 2.5 Outdoor', unit: 'µg/m³', max: 400 }, { id: 'pm10_outdoor', title: 'PM 10 Outdoor', unit: 'µg/m³', max: 400 }, { id: 'mq135_indoor', title: 'MQ-135 Indoor', unit: 'PPM', max: 400 }, { id: 'mq7_indoor', title: 'MQ-7 Indoor', unit: 'PPM', max: 400 }, { id: 'pm25_indoor', title: 'PM 2.5 Indoor', unit: 'µg/m³', max: 400 }, { id: 'pm10_indoor', title: 'PM 10 Indoor', unit: 'µg/m³', max: 400 } ];
function getChartOpts(yLabel) { return { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, plugins: { legend: { labels: { color: "#e2e8f0" } } }, scales: { y: { title: { display: true, text: yLabel, color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, x: { grid: { display: false }, ticks: { color: "#94a3b8" } } } }; }
function updateChart(chart, d1, d2, timeStr) { if(!chart) return; chart.data.labels.push(timeStr); chart.data.datasets[0].data.push(d1); chart.data.datasets[1].data.push(d2); if (chart.data.labels.length > 15) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); chart.data.datasets[1].data.shift(); } chart.update(); }

// =======================================================
// 3. PELINDUNG DOM (JALANKAN SAAT HTML SELESAI)
// =======================================================
document.addEventListener('DOMContentLoaded', () => {

    // SETUP LOGIN MODAL
    // --- SETUP LOGIN MODAL ---
    const style = document.createElement('style');
    style.innerHTML = `.modal { display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); align-items: center; justify-content: center; backdrop-filter: blur(5px); } .modal-content { background: var(--glass-bg, #1e293b); padding: 30px; border-radius: 15px; width: 320px; text-align: center; color: white; border: 1px solid var(--glass-border); box-shadow: 0 10px 25px rgba(0,0,0,0.5); } .modal-content h3 { margin-top: 0; color: var(--accent-yellow); letter-spacing: 1px; } .modal-content input { width: 90%; padding: 12px; margin: 15px 0; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; outline: none; } .modal-btn { background: #3b82f6; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.3s; } .modal-btn:hover { background: #2563eb; } .close-modal { color: #aaa; float: right; font-size: 24px; cursor: pointer; margin-top: -15px; margin-right: -10px; } .close-modal:hover { color: white; }`;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', `<div id="login-modal" class="modal"><div class="modal-content"><span class="close-modal" onclick="closeLogin()">&times;</span><h3><i class="fa-solid fa-shield-halved"></i> Login Admin</h3><input type="password" id="admin-pass" placeholder="Masukkan Password"><button class="modal-btn" onclick="checkLogin()">Masuk</button></div></div>`);
    const topbarMenu = document.querySelector('.topbar-menu');
    if (topbarMenu) { const loginMenu = document.createElement('a'); loginMenu.href = "#"; loginMenu.id = "menu-login"; loginMenu.onclick = (e) => { e.preventDefault(); toggleLogin(); }; topbarMenu.appendChild(loginMenu); }

    applyAdminRights();

    // REAL-TIME DASHBOARD & CHARTS
    // --- SETUP DASHBOARD & SPEEDOMETER ---
    const ctxGas = document.getElementById("gasChart"); let gasChart = ctxGas ? new Chart(ctxGas.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "MQ-135 Indoor", data: [], borderColor: "#fbbf24", fill: false, tension: 0.4 }, { label: "MQ-7 Indoor", data: [], borderColor: "#ef4444", fill: false, tension: 0.4 }] }, options: getChartOpts('PPM') }) : null;
    const ctxParticle = document.getElementById("particleChart"); let particleChart = ctxParticle ? new Chart(ctxParticle.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "PM 2.5 Indoor", data: [], borderColor: "#3b82f6", fill: false, tension: 0.4 }, { label: "PM 10 Indoor", data: [], borderColor: "#10b981", fill: false, tension: 0.4 }] }, options: getChartOpts('µg/m³') }) : null;
    const speedContainer = document.getElementById('speedometer-container'); let echartsInstances = {}; const ispuColors = [ [50/400, '#10b981'], [100/400, '#fbbf24'], [150/400, '#f97316'], [200/400, '#ef4444'], [300/400, '#a855f7'], [1, '#dc2626'] ];
    if (speedContainer) { SENSORS.forEach(s => { speedContainer.innerHTML += `<div class="glass-card"><h3 style="text-align:center; color: var(--accent-yellow); font-size:16px; margin-bottom:10px; letter-spacing: 1px;">${s.title}</h3><div id="sp-${s.id}" style="width:100%; height:250px;"></div></div>`; }); }

    // 4 KOMPARASI CHARTS
    const ctxMq135 = document.getElementById('chart-mq135'); let c_Mq135 = ctxMq135 ? new Chart(ctxMq135.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    const ctxMq7 = document.getElementById('chart-mq7'); let c_Mq7 = ctxMq7 ? new Chart(ctxMq7.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    const ctxPm25 = document.getElementById('chart-pm25'); let c_Pm25 = ctxPm25 ? new Chart(ctxPm25.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;
    const ctxPm10 = document.getElementById('chart-pm10'); let c_Pm10 = ctxPm10 ? new Chart(ctxPm10.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;

    // FIREBASE KONTROL LISTENER (UPDATE TEKS STATUS)
    // --- FIREBASE: REAL-TIME & KONTROL ---
    db.ref('.info/connected').on('value', snap => { const badge = document.getElementById("conn-status"); if (badge) { if (snap.val() === true) { badge.className = "status-badge"; badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> <span id="status-text">TERHUBUNG (LIVE)</span>'; } else { badge.className = "status-badge offline"; badge.innerHTML = '<i class="fa-solid fa-cloud-bolt"></i> <span id="status-text">MENUNGGU DATA...</span>'; } } });
    db.ref('kontrol/sistem').on('value', snap => {
        let val = snap.val();
        let statEl = document.getElementById('status-alat');
        let val = snap.val(); let statEl = document.getElementById('status-sistem');
        if (statEl) {
            if(val === "START") statEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: <span style="color:#10b981;">AKTIF (MENGAMBIL DATA)</span>`;
            else statEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: <span style="color:#ef4444;">BERHENTI (STANDBY)</span>`;
        }
    });

    // DATA LISTENER
    db.ref('.info/connected').on('value', snap => { const badge = document.getElementById("conn-status"); if (badge) { if (snap.val() === true) { badge.className = "status-badge"; badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> <span id="status-text">TERHUBUNG (LIVE)</span>'; } else { badge.className = "status-badge offline"; badge.innerHTML = '<i class="fa-solid fa-cloud-bolt"></i> <span id="status-text">MENUNGGU DATA...</span>'; } } });
    db.ref('sensorData').on('value', (snapshot) => {
        const data = snapshot.val(); if (!data) return;
        SENSORS.forEach(s => { let val = data[s.id] || 0; let status = getIspu(val); let elVal = document.getElementById(`val-${s.id}`); if (elVal) elVal.innerText = val.toFixed(1); let elStat = document.getElementById(`stat-${s.id}`); if (elStat) { elStat.innerText = status.lbl; elStat.style.color = status.color; } let elCard = document.getElementById(`card-${s.id}`); if (elCard) elCard.className = `glass-card sensor-card ${status.cls}`; });
        if (gasChart || particleChart) { const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" }); updateChart(gasChart, data['mq135_indoor']||0, data['mq7_indoor']||0, timeNow); updateChart(particleChart, data['pm25_indoor']||0, data['pm10_indoor']||0, timeNow); }
        if (speedContainer) { setTimeout(() => { SENSORS.forEach(s => { let val = data[s.id] || 0; let status = getIspu(val); let domId = `sp-${s.id}`; let chartDom = document.getElementById(domId); if (chartDom) { if (!echartsInstances[s.id]) { echartsInstances[s.id] = echarts.init(chartDom); } echartsInstances[s.id].setOption({ series: [{ type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: s.max, splitNumber: 8, axisLine: { lineStyle: { width: 14, color: ispuColors } }, pointer: { width: 4, itemStyle: { color: '#e2e8f0' } }, axisTick: { distance: -14, length: 8, lineStyle: { color: '#0a192f', width: 2 } }, splitLine: { distance: -14, length: 14, lineStyle: { color: '#0a192f', width: 3 } }, axisLabel: { distance: 18, color: '#94a3b8', fontSize: 10, formatter: function(v) { return [0, 50, 100, 150, 200, 300, 400].includes(v) ? v : ''; } }, detail: { formatter: function(v) { return '{value|' + v.toFixed(1) + '} {unit|' + s.unit + '}\n{status|' + status.lbl + '}'; }, rich: { value: { fontSize: 24, fontWeight: 'bold', color: '#e2e8f0', lineHeight: 30 }, unit: { fontSize: 12, color: '#94a3b8', lineHeight: 30 }, status: { fontSize: 12, fontWeight: 'bold', color: status.color, lineHeight: 20 } }, offsetCenter: [0, '60%'] }, data: [{ value: val }] }] }); } }); }, 100); }
    });

    // --- SETUP KOMPARASI CHARTS ---
    const ctxMq135 = document.getElementById('chart-mq135'); let c_Mq135 = ctxMq135 ? new Chart(ctxMq135.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    const ctxMq7 = document.getElementById('chart-mq7'); let c_Mq7 = ctxMq7 ? new Chart(ctxMq7.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    const ctxPm25 = document.getElementById('chart-pm25'); let c_Pm25 = ctxPm25 ? new Chart(ctxPm25.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;
    const ctxPm10 = document.getElementById('chart-pm10'); let c_Pm10 = ctxPm10 ? new Chart(ctxPm10.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;

    // --- FIREBASE: FUNGSI TARIK DATA HISTORY (Filter Waktu & Sensor) ---
    const tableBody = document.getElementById('table-body');
    const filterBtn = document.querySelector('.filter-btn');
    const chartTimeFilter = document.getElementById('chart-time-filter');
    const filterSensor = document.getElementById('filter-sensor');

    window.loadHistoryData = function(dataLimit) {
        if (!tableBody && !ctxMq135) return; 
        if (currentLogListener) { db.ref('logs').off('value', currentLogListener); }

        currentLogListener = db.ref('logs').limitToLast(Number(dataLimit)).on('value', (snapshot) => {
            globalHistoryData = [];
            snapshot.forEach((child) => { globalHistoryData.push(child.val()); });
            if (tableBody) renderTable();

            if (ctxMq135) {
                let lbls = [], out135=[], in135=[], out7=[], in7=[], out25=[], in25=[], out10=[], in10=[];
                globalHistoryData.forEach((row, idx) => {
                    lbls.push(row.timestamp ? `L-${row.timestamp.toString().slice(-4)}` : `${idx+1}`);
                    out135.push(row.mq135_outdoor||0); in135.push(row.mq135_indoor||0); out7.push(row.mq7_outdoor||0); in7.push(row.mq7_indoor||0); out25.push(row.pm25_outdoor||0); in25.push(row.pm25_indoor||0); out10.push(row.pm10_outdoor||0); in10.push(row.pm10_indoor||0);
                });
                c_Mq135.data.labels = lbls; c_Mq135.data.datasets[0].data = out135; c_Mq135.data.datasets[1].data = in135; c_Mq135.update();
                c_Mq7.data.labels = lbls; c_Mq7.data.datasets[0].data = out7; c_Mq7.data.datasets[1].data = in7; c_Mq7.update();
                c_Pm25.data.labels = lbls; c_Pm25.data.datasets[0].data = out25; c_Pm25.data.datasets[1].data = in25; c_Pm25.update();
                c_Pm10.data.labels = lbls; c_Pm10.data.datasets[0].data = out10; c_Pm10.data.datasets[1].data = in10; c_Pm10.update();
            }
        });
    }

    loadHistoryData(30);
    if (chartTimeFilter) { chartTimeFilter.addEventListener('change', function() { loadHistoryData(this.value); }); }

    function renderTable() {
        if (!tableBody) return;
        tableBody.innerHTML = "";
        let selectedSensor = filterSensor ? filterSensor.value : "all";
        let reversedData = [...globalHistoryData].reverse().slice(0, 50); // Menampilkan 50 data di tabel
        let reversedData = [...globalHistoryData].reverse().slice(0, 50); 

        reversedData.forEach((row, index) => {
            const tr = document.createElement('tr');
@@ -99,95 +130,48 @@
        });
    }

    if (tableBody || ctxMq135) {
        db.ref('logs').limitToLast(50).on('value', (snapshot) => {
            globalHistoryData = [];
            snapshot.forEach((childSnapshot) => { globalHistoryData.push(childSnapshot.val()); });
            renderTable();

            if (ctxMq135) {
                let c_Mq135 = Chart.getChart("chart-mq135"); let c_Mq7 = Chart.getChart("chart-mq7"); let c_Pm25 = Chart.getChart("chart-pm25"); let c_Pm10 = Chart.getChart("chart-pm10");
                if(c_Mq135 && c_Mq7 && c_Pm25 && c_Pm10) {
                    let lbls = [], out135=[], in135=[], out7=[], in7=[], out25=[], in25=[], out10=[], in10=[];
                    globalHistoryData.forEach((row, idx) => {
                        lbls.push(row.timestamp ? `L-${row.timestamp.toString().slice(-4)}` : `${idx+1}`);
                        out135.push(row.mq135_outdoor||0); in135.push(row.mq135_indoor||0); out7.push(row.mq7_outdoor||0); in7.push(row.mq7_indoor||0); out25.push(row.pm25_outdoor||0); in25.push(row.pm25_indoor||0); out10.push(row.pm10_outdoor||0); in10.push(row.pm10_indoor||0);
                    });
                    c_Mq135.data.labels = lbls; c_Mq135.data.datasets[0].data = out135; c_Mq135.data.datasets[1].data = in135; c_Mq135.update();
                    c_Mq7.data.labels = lbls; c_Mq7.data.datasets[0].data = out7; c_Mq7.data.datasets[1].data = in7; c_Mq7.update();
                    c_Pm25.data.labels = lbls; c_Pm25.data.datasets[0].data = out25; c_Pm25.data.datasets[1].data = in25; c_Pm25.update();
                    c_Pm10.data.labels = lbls; c_Pm10.data.datasets[0].data = out10; c_Pm10.data.datasets[1].data = in10; c_Pm10.update();
                }
            }
        });
        if (filterBtn) filterBtn.addEventListener('click', () => { renderTable(); });
    }
    if (filterBtn) filterBtn.addEventListener('click', () => { renderTable(); });
}); 

// =======================================================
// 4. FUNGSI ADMIN: LOGIN, EXPORT CSV, HAPUS, & KONTROL
// =======================================================
window.toggleLogin = function() {
    if (sessionStorage.getItem('isAdmin') === 'true') {
        sessionStorage.removeItem('isAdmin'); applyAdminRights(); alert("Berhasil Logout! Mode Publik aktif.");
    if (sessionStorage.getItem('isAdmin') === 'true') { sessionStorage.removeItem('isAdmin'); applyAdminRights(); alert("Berhasil Logout! Mode Publik aktif.");
    } else document.getElementById('login-modal').style.display = 'flex';
}
window.closeLogin = function() { document.getElementById('login-modal').style.display = 'none'; document.getElementById('admin-pass').value = ""; }
window.checkLogin = function() {
    if (document.getElementById('admin-pass').value === ADMIN_PASSWORD) {
        sessionStorage.setItem('isAdmin', 'true'); alert("Akses Admin Terbuka!"); closeLogin(); applyAdminRights();
    if (document.getElementById('admin-pass').value === ADMIN_PASSWORD) { sessionStorage.setItem('isAdmin', 'true'); alert("Akses Admin Terbuka!"); closeLogin(); applyAdminRights();
    } else alert("❌ Password Salah!");
}
window.applyAdminRights = function() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const btnReset = document.querySelector('.btn-reset');
    const menuLogin = document.getElementById('menu-login');
    const adminPanel = document.getElementById('admin-panel');

    const btnReset = document.querySelector('.btn-reset'); const menuLogin = document.getElementById('menu-login'); const adminPanel = document.getElementById('admin-panel');
    if (menuLogin) { menuLogin.innerHTML = isAdmin ? '<i class="fa-solid fa-unlock"></i> Logout' : '<i class="fa-solid fa-lock"></i> Login Admin'; menuLogin.style.color = isAdmin ? "#fbbf24" : ""; }
    if (btnReset) btnReset.style.display = isAdmin ? 'flex' : 'none';
    if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none'; // Sembunyikan/Tampilkan Panel Alat
    if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none'; 
}

// Fitur 1: EXPORT EXCEL (CSV)
window.exportToExcel = function() {
    if (globalHistoryData.length === 0) { alert("Tidak ada data untuk didownload!"); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Waktu,MQ135_Indoor,MQ7_Indoor,PM2.5_Indoor,PM10_Indoor,MQ135_Outdoor,MQ7_Outdoor,PM2.5_Outdoor,PM10_Outdoor\n";
    
    let csvContent = "data:text/csv;charset=utf-8,Waktu,MQ135_Indoor,MQ7_Indoor,PM2.5_Indoor,PM10_Indoor,MQ135_Outdoor,MQ7_Outdoor,PM2.5_Outdoor,PM10_Outdoor\n";
    let dataToExport = [...globalHistoryData].reverse();
    dataToExport.forEach(row => {
        let baris = [
            row.timestamp || "Live",
            (row.mq135_indoor||0).toFixed(2), (row.mq7_indoor||0).toFixed(2), (row.pm25_indoor||0).toFixed(2), (row.pm10_indoor||0).toFixed(2),
            (row.mq135_outdoor||0).toFixed(2), (row.mq7_outdoor||0).toFixed(2), (row.pm25_outdoor||0).toFixed(2), (row.pm10_outdoor||0).toFixed(2)
        ];
        let baris = [ row.timestamp || "Live", (row.mq135_indoor||0).toFixed(2), (row.mq7_indoor||0).toFixed(2), (row.pm25_indoor||0).toFixed(2), (row.pm10_indoor||0).toFixed(2), (row.mq135_outdoor||0).toFixed(2), (row.mq7_outdoor||0).toFixed(2), (row.pm25_outdoor||0).toFixed(2), (row.pm10_outdoor||0).toFixed(2) ];
        csvContent += baris.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Data_Rekap_AirQuality.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "Data_Rekap_AirQuality.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// Fitur 2: REMOTE KONTROL ALAT
window.setAlat = function(perintah) {
    if (sessionStorage.getItem('isAdmin') !== 'true') { alert("Akses Ditolak!"); return; }
    
    // Kirim perintah ke folder /kontrol/sistem di Firebase
    db.ref('kontrol').update({ sistem: perintah })
        .then(() => alert(`Perintah [${perintah}] berhasil dikirim ke alat!`))
        .catch((e) => alert("Gagal kirim perintah: " + e.message));
    db.ref('kontrol').update({ sistem: perintah }).then(() => alert(`Perintah [${perintah}] dikirim ke alat!`)).catch((e) => alert("Gagal kirim: " + e.message));
}

// Fitur 3: HAPUS RIWAYAT
window.resetHistory = function() {
    if (sessionStorage.getItem('isAdmin') !== 'true') return;
    if (confirm("⚠️ PERINGATAN!\nApakah kamu yakin ingin menghapus SEMUA riwayat data?")) {
        db.ref('logs').remove().then(() => alert("Riwayat dikosongkan!")).catch((e) => alert("Error: " + e.message));
    }
};
