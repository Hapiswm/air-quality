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
    let gasChart = ctxGas ? new Chart(ctxGas.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "MQ-135 Indoor", data: [], borderColor: "#fbbf24", fill: false, tension: 0.4 }, { label: "MQ-7 Indoor", data: [], borderColor: "#ef4444", fill: false, tension: 0.4 }] }, options: getChartOpts('PPM') }) : null;

    const ctxParticle = document.getElementById("particleChart");
    let particleChart = ctxParticle ? new Chart(ctxParticle.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "PM 2.5 Indoor", data: [], borderColor: "#3b82f6", fill: false, tension: 0.4 }, { label: "PM 10 Indoor", data: [], borderColor: "#10b981", fill: false, tension: 0.4 }] }, options: getChartOpts('µg/m³') }) : null;

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

    // --- SETUP GRAFIK HISTORY (4 GRAFIK) ---
    const ctxMq135 = document.getElementById('chart-mq135');
    let c_Mq135 = ctxMq135 ? new Chart(ctxMq135.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    
    const ctxMq7 = document.getElementById('chart-mq7');
    let c_Mq7 = ctxMq7 ? new Chart(ctxMq7.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('PPM') }) : null;
    
    const ctxPm25 = document.getElementById('chart-pm25');
    let c_Pm25 = ctxPm25 ? new Chart(ctxPm25.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;
    
    const ctxPm10 = document.getElementById('chart-pm10');
    let c_Pm10 = ctxPm10 ? new Chart(ctxPm10.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "Outdoor", data: [], borderColor: "#e86b6b", fill: false, tension: 0.3 }, { label: "Indoor", data: [], borderColor: "#f4d35e", fill: false, tension: 0.3 }] }, options: getChartOpts('µg/m³') }) : null;

    // --- KONEKSI FIREBASE (REAL-TIME DASHBOARD) ---
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
            updateChart(gasChart, data['mq135_indoor']||0, data['mq7_indoor']||0, timeNow);
            updateChart(particleChart, data['pm25_indoor']||0, data['pm10_indoor']||0, timeNow);
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

    // =======================================================
    // 7. KONEKSI RIWAYAT: TABEL HISTORY & GRAFIK HISTORY
    // =======================================================
    const tableBody = document.getElementById('table-body');
    const filterBtn = document.querySelector('.filter-btn');
    const filterSensor = document.getElementById('filter-sensor');
    let globalHistoryData = []; // Menyimpan data riwayat sementara

    // Fungsi untuk menggambar ulang tabel sesuai filter
    function renderTable() {
        if (!tableBody) return;
        tableBody.innerHTML = "";
        
        // Ambil pilihan dari dropdown (all, mq135, mq7, pm25, pm10)
        let selectedSensor = filterSensor ? filterSensor.value : "all";
        
        let reversedData = [...globalHistoryData].reverse().slice(0, 20); 
        
        reversedData.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            let valISPU = 0;
            let strOutdoor = "";
            let strIndoor = "";
            let waktuStr = row.timestamp ? `Log-${row.timestamp.toString().slice(-4)}` : "Live";

            // JIKA MEMILIH "SEMUA SENSOR"
            if (selectedSensor === "all") {
                valISPU = Math.max((row.mq135_indoor||0), (row.mq7_indoor||0), (row.pm25_indoor||0), (row.pm10_indoor||0));
                strOutdoor = `MQ135: ${(row.mq135_outdoor||0).toFixed(1)} | MQ7: ${(row.mq7_outdoor||0).toFixed(1)} | PM2.5: ${(row.pm25_outdoor||0).toFixed(1)} | PM10: ${(row.pm10_outdoor||0).toFixed(1)}`;
                strIndoor = `MQ135: ${(row.mq135_indoor||0).toFixed(1)} | MQ7: ${(row.mq7_indoor||0).toFixed(1)} | PM2.5: ${(row.pm25_indoor||0).toFixed(1)} | PM10: ${(row.pm10_indoor||0).toFixed(1)}`;
            } 
            // JIKA MEMILIH SALAH SATU SENSOR
            else {
                let outVal = row[`${selectedSensor}_outdoor`] || 0;
                let inVal = row[`${selectedSensor}_indoor`] || 0;
                valISPU = inVal; // ISPU fokus ke sensor yang dipilih
                
                let unit = selectedSensor.includes("pm") ? "µg/m³" : "PPM";
                let namaSensor = selectedSensor.toUpperCase();
                if (namaSensor === "PM25") namaSensor = "PM 2.5";
                if (namaSensor === "PM10") namaSensor = "PM 10";

                strOutdoor = `${namaSensor}: ${outVal.toFixed(1)} ${unit}`;
                strIndoor = `${namaSensor}: ${inVal.toFixed(1)} ${unit}`;
            }

            const status = getIspu(valISPU);

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="color: var(--text-muted); font-family: monospace;">${waktuStr}</td>
                <td style="font-size: 11px;">${strOutdoor}</td>
                <td style="font-size: 11px; font-weight: bold; color: var(--accent-yellow);">${strIndoor}</td>
                <td><span style="background:${status.color}; color:#fff; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:bold;">${status.lbl}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    if (tableBody || ctxMq135) {
        db.ref('logs').limitToLast(30).on('value', (snapshot) => {
            globalHistoryData = [];
            snapshot.forEach((childSnapshot) => {
                globalHistoryData.push(childSnapshot.val());
            });

            // Gambar tabelnya
            renderTable();

            // UPDATE 4 GRAFIK KOMPARASI
            if (ctxMq135) {
                let c_Mq135 = Chart.getChart("chart-mq135");
                let c_Mq7 = Chart.getChart("chart-mq7");
                let c_Pm25 = Chart.getChart("chart-pm25");
                let c_Pm10 = Chart.getChart("chart-pm10");

                if(c_Mq135 && c_Mq7 && c_Pm25 && c_Pm10) {
                    let lbls = [], out135=[], in135=[], out7=[], in7=[], out25=[], in25=[], out10=[], in10=[];
                    globalHistoryData.forEach((row, idx) => {
                        lbls.push(row.timestamp ? `L-${row.timestamp.toString().slice(-4)}` : `${idx+1}`);
                        out135.push(row.mq135_outdoor||0); in135.push(row.mq135_indoor||0);
                        out7.push(row.mq7_outdoor||0);     in7.push(row.mq7_indoor||0);
                        out25.push(row.pm25_outdoor||0);   in25.push(row.pm25_indoor||0);
                        out10.push(row.pm10_outdoor||0);   in10.push(row.pm10_indoor||0);
                    });

                    c_Mq135.data.labels = lbls; c_Mq135.data.datasets[0].data = out135; c_Mq135.data.datasets[1].data = in135; c_Mq135.update();
                    c_Mq7.data.labels = lbls;   c_Mq7.data.datasets[0].data = out7;     c_Mq7.data.datasets[1].data = in7;     c_Mq7.update();
                    c_Pm25.data.labels = lbls;  c_Pm25.data.datasets[0].data = out25;   c_Pm25.data.datasets[1].data = in25;   c_Pm25.update();
                    c_Pm10.data.labels = lbls;  c_Pm10.data.datasets[0].data = out10;   c_Pm10.data.datasets[1].data = in10;   c_Pm10.update();
                }
            }
        });

        // Jika tombol Filter diklik, gambar ulang tabelnya
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                renderTable();
            });
        }
    }
}); // <-- Akhir dari Pelindung DOM

// =======================================================
// 8. FUNGSI HAPUS HISTORY
// =======================================================
window.resetHistory = function() {
    if (confirm("⚠️ PERINGATAN!\nApakah kamu yakin ingin menghapus SEMUA riwayat data?")) {
        db.ref('logs').remove()
            .then(() => alert("Riwayat berhasil dikosongkan!"))
            .catch((error) => alert("Gagal menghapus: " + error.message));
    }
};
