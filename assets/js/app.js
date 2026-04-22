// =======================================================
// 1. KONFIGURASI FIREBASE
// =======================================================
const firebaseConfig = {
  // MASUKKAN URL FIREBASE KAMU DI BAWAH INI:
  databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =======================================================
// 2. LOGIKA ISPU & DAFTAR SENSOR
// =======================================================
function getIspu(val) {
  if (val <= 50) return { lbl: "BAIK", cls: "baik", color: "#10b981" };
  if (val <= 100) return { lbl: "SEDANG", cls: "sedang", color: "#fbbf24" };
  if (val <= 150) return { lbl: "SENSITIF", cls: "sensitif", color: "#f97316" };
  if (val <= 200) return { lbl: "TIDAK SEHAT", cls: "tidak-sehat", color: "#ef4444" };
  if (val <= 300) return { lbl: "SANGAT TDK SEHAT", cls: "sangat-tidak-sehat", color: "#a855f7" };
  return { lbl: "BERBAHAYA", cls: "berbahaya", color: "#dc2626" };
}

const SENSORS = [
  { id: 'mq135_outdoor', title: 'MQ-135 Outdoor', unit: 'PPM', max: 400 },
  { id: 'mq7_outdoor', title: 'MQ-7 Outdoor', unit: 'PPM', max: 400 },
  { id: 'pm25_outdoor', title: 'PM 2.5 Outdoor', unit: 'µg/m³', max: 400 },
  { id: 'pm10_outdoor', title: 'PM 10 Outdoor', unit: 'µg/m³', max: 400 },
  { id: 'mq135_indoor', title: 'MQ-135 Indoor', unit: 'PPM', max: 400 },
  { id: 'mq7_indoor', title: 'MQ-7 Indoor', unit: 'PPM', max: 400 },
  { id: 'pm25_indoor', title: 'PM 2.5 Indoor', unit: 'µg/m³', max: 400 },
  { id: 'pm10_indoor', title: 'PM 10 Indoor', unit: 'µg/m³', max: 400 }
];

function getChartOpts(yLabel) {
  return { 
    responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, 
    plugins: { legend: { labels: { color: "#e2e8f0" } } }, 
    scales: { 
      y: { title: { display: true, text: yLabel, color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, 
      x: { grid: { display: false }, ticks: { color: "#94a3b8" } } 
    } 
  };
}

function updateChart(chart, d1, d2, timeStr) {
  if(!chart) return;
  chart.data.labels.push(timeStr); chart.data.datasets[0].data.push(d1); chart.data.datasets[1].data.push(d2);
  if (chart.data.labels.length > 15) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); chart.data.datasets[1].data.shift(); }
  chart.update();
}

// =======================================================
// PELINDUNG DOM (Menunggu HTML selesai dimuat)
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- SETUP DASHBOARD ---
    const ctxGas = document.getElementById("gasChart");
    let gasChart = ctxGas ? new Chart(ctxGas.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "MQ-135 Outdoor", data: [], borderColor: "#fbbf24", fill: false, tension: 0.4 }, { label: "MQ-7 Outdoor", data: [], borderColor: "#ef4444", fill: false, tension: 0.4 }] }, options: getChartOpts('PPM') }) : null;

    const ctxParticle = document.getElementById("particleChart");
    let particleChart = ctxParticle ? new Chart(ctxParticle.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "PM 2.5 Outdoor", data: [], borderColor: "#3b82f6", fill: false, tension: 0.4 }, { label: "PM 10 Outdoor", data: [], borderColor: "#10b981", fill: false, tension: 0.4 }] }, options: getChartOpts('µg/m³') }) : null;

    // --- SETUP SPEEDOMETER ---
    const speedContainer = document.getElementById('speedometer-container');
    let echartsInstances = {};
    const ispuColors = [ [50/400, '#10b981'], [100/400, '#fbbf24'], [150/400, '#f97316'], [200/400, '#ef4444'], [300/400, '#a855f7'], [1, '#dc2626'] ];

    if (speedContainer) {
        SENSORS.forEach(s => {
            speedContainer.innerHTML += `
            <div class="glass-card">
                <h3 style="text-align:center; color: var(--accent-yellow); font-size:16px; margin-bottom:10px; letter-spacing: 1px;">${s.title}</h3>
                <div id="sp-${s.id}" style="width:100%; height:250px;"></div>
            </div>`;
        });
    }

    // --- SETUP GRAFIK HISTORY ---
    const ctxHistGas = document.getElementById("historyGasChart");
    let histGasChart = ctxHistGas ? new Chart(ctxHistGas.getContext("2d"), { 
        type: "line", 
        data: { labels: [], datasets: [{ label: "MQ-135 Indoor", data: [], borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }, { label: "MQ-7 Indoor", data: [], borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, 
        options: getChartOpts('Nilai Gas (PPM)') 
    }) : null;

    const ctxHistPart = document.getElementById("historyParticleChart");
    let histPartChart = ctxHistPart ? new Chart(ctxHistPart.getContext("2d"), { 
        type: "line", 
        data: { labels: [], datasets: [{ label: "PM 2.5 Indoor", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }, { label: "PM 10 Indoor", data: [], borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, 
        options: getChartOpts('Nilai Partikel (µg/m³)') 
    }) : null;

    // --- KONEKSI FIREBASE (REAL-TIME) ---
    db.ref('.info/connected').on('value', snap => {
        const badge = document.getElementById("conn-status");
        if (badge) {
            if (snap.val() === true) { 
                badge.className = "status-badge"; badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> <span id="status-text">TERHUBUNG (LIVE)</span>'; 
            } else { 
                badge.className = "status-badge offline"; badge.innerHTML = '<i class="fa-solid fa-cloud-bolt"></i> <span id="status-text">MENUNGGU DATA...</span>'; 
            }
        }
    });

    db.ref('sensorData').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        SENSORS.forEach(s => {
            let val = data[s.id] || 0; let status = getIspu(val);
            let elVal = document.getElementById(`val-${s.id}`); if (elVal) elVal.innerText = val.toFixed(1);
            let elStat = document.getElementById(`stat-${s.id}`); if (elStat) { elStat.innerText = status.lbl; elStat.style.color = status.color; }
            let elCard = document.getElementById(`card-${s.id}`); if (elCard) elCard.className = `glass-card sensor-card ${status.cls}`;
        });

        if (gasChart || particleChart) {
            const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            updateChart(gasChart, data['mq135_outdoor']||0, data['mq7_outdoor']||0, timeNow);
            updateChart(particleChart, data['pm25_outdoor']||0, data['pm10_outdoor']||0, timeNow);
        }

        if (speedContainer) {
            setTimeout(() => {
                SENSORS.forEach(s => {
                    let val = data[s.id] || 0; let status = getIspu(val);
                    let domId = `sp-${s.id}`; let chartDom = document.getElementById(domId);
                    if (chartDom) {
                        if (!echartsInstances[s.id]) { echartsInstances[s.id] = echarts.init(chartDom); }
                        echartsInstances[s.id].setOption({
                            series: [{
                                type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: s.max, splitNumber: 8,
                                axisLine: { lineStyle: { width: 14, color: ispuColors } },
                                pointer: { width: 4, itemStyle: { color: '#e2e8f0' } },
                                axisTick: { distance: -14, length: 8, lineStyle: { color: '#0a192f', width: 2 } },
                                splitLine: { distance: -14, length: 14, lineStyle: { color: '#0a192f', width: 3 } },
                                axisLabel: { distance: 18, color: '#94a3b8', fontSize: 10, formatter: function(v) { return [0, 50, 100, 150, 200, 300, 400].includes(v) ? v : ''; } },
                                detail: {
                                    formatter: function(v) { return '{value|' + v.toFixed(1) + '} {unit|' + s.unit + '}\n{status|' + status.lbl + '}'; },
                                    rich: { value: { fontSize: 24, fontWeight: 'bold', color: '#e2e8f0', lineHeight: 30 }, unit: { fontSize: 12, color: '#94a3b8', lineHeight: 30 }, status: { fontSize: 12, fontWeight: 'bold', color: status.color, lineHeight: 20 } },
                                    offsetCenter: [0, '60%']
                                }, data: [{ value: val }]
                            }]
                        });
                    }
                });
            }, 100);
        }
    });

    // --- KONEKSI FIREBASE (HISTORY / LOGS) ---
    const tableBody = document.getElementById('table-body');
    if (tableBody || ctxHistGas) {
        db.ref('logs').limitToLast(30).on('value', (snapshot) => {
            let dataArray = [];
            snapshot.forEach((childSnapshot) => {
                dataArray.push(childSnapshot.val());
            });

            if (tableBody) {
                tableBody.innerHTML = "";
                let reversedData = [...dataArray].reverse().slice(0, 20); 
                
                reversedData.forEach((row, index) => {
                    const tr = document.createElement('tr');
                    let valISPU = row.mq135_indoor || 0;
                    const status = getIspu(valISPU);
                    let waktuStr = row.timestamp ? `Log-${row.timestamp.toString().slice(-4)}` : "Live Data";

                    tr.innerHTML = `
                        <td>${index + 1}</td>
                        <td style="color: var(--text-muted); font-family: monospace;">${waktuStr}</td>
                        <td style="font-weight: bold;">${(row.mq135_indoor || 0).toFixed(1)} PPM</td>
                        <td>${(row.mq7_indoor || 0).toFixed(1)} PPM</td>
                        <td>${(row.pm25_indoor || 0).toFixed(1)} µg/m³</td>
                        <td>${(row.pm10_indoor || 0).toFixed(1)} µg/m³</td>
                        <td><span style="background:${status.color}; color:#fff; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold; letter-spacing:1px;">${status.lbl}</span></td>
                    `;
                    tableBody.appendChild(tr);
                });
            }

            if (histGasChart && histPartChart) {
                let labels = [];
                let dMQ135 = [], dMQ7 = [], dPM25 = [], dPM10 = [];

                dataArray.forEach((row, index) => {
                    labels.push(row.timestamp ? `Log-${row.timestamp.toString().slice(-4)}` : `Data-${index+1}`);
                    dMQ135.push(row.mq135_indoor || 0);
                    dMQ7.push(row.mq7_indoor || 0);
                    dPM25.push(row.pm25_indoor || 0);
                    dPM10.push(row.pm10_indoor || 0);
                });

                histGasChart.data.labels = labels;
                histGasChart.data.datasets[0].data = dMQ135;
                histGasChart.data.datasets[1].data = dMQ7;
                histGasChart.update();

                histPartChart.data.labels = labels;
                histPartChart.data.datasets[0].data = dPM25;
                histPartChart.data.datasets[1].data = dPM10;
                histPartChart.update();
            }
        });
    }
}); // <-- Akhir dari Pelindung DOM

// Fungsi Reset History harus berada di luar pelindung agar bisa diakses tombol
window.resetHistory = function() {
    if (confirm("⚠️ PERINGATAN!\n\nApakah kamu yakin ingin menghapus SEMUA riwayat data dari database? Tindakan ini tidak bisa dibatalkan.")) {
        db.ref('logs').remove()
            .then(() => alert("Riwayat berhasil dikosongkan!"))
            .catch((error) => alert("Gagal menghapus: " + error.message));
    }
};
