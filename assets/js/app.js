const firebaseConfig = {
  // MASUKKAN URL FIREBASE KAMU DI BAWAH INI:
  databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function getIspu(val) {
  if (val <= 50) return { lbl: "BAIK", cls: "baik", color: "#10b981" };
  if (val <= 100) return { lbl: "SEDANG", cls: "sedang", color: "#fbbf24" };
  if (val <= 150) return { lbl: "SENSITIF", cls: "sensitif", color: "#f97316" };
  if (val <= 200) return { lbl: "TIDAK SEHAT", cls: "tidak-sehat", color: "#ef4444" };
  if (val <= 300) return { lbl: "SANGAT TDK SEHAT", cls: "sangat-tidak-sehat", color: "#a855f7" };
  return { lbl: "BERBAHAYA", cls: "berbahaya", color: "#1f2937" };
}

const SENSORS = ['mq135_outdoor', 'mq7_outdoor', 'pm25_outdoor', 'pm10_outdoor', 'mq135_indoor', 'mq7_indoor'];

// --- SETUP GRAFIK ---
function getChartOpts(yLabel) {
  return { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, 
    plugins: { legend: { labels: { color: "#e2e8f0" } } }, 
    scales: { y: { title: { display: true, text: yLabel, color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, x: { grid: { display: false }, ticks: { color: "#94a3b8" } } } };
}

const ctxGas = document.getElementById("gasChart");
let gasChart = ctxGas ? new Chart(ctxGas.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "MQ-135 Outdoor", data: [], borderColor: "#fbbf24", fill: false, tension: 0.4 }, { label: "MQ-7 Outdoor", data: [], borderColor: "#ef4444", fill: false, tension: 0.4 }] }, options: getChartOpts('PPM') }) : null;

const ctxParticle = document.getElementById("particleChart");
let particleChart = ctxParticle ? new Chart(ctxParticle.getContext("2d"), { type: "line", data: { labels: [], datasets: [{ label: "PM 2.5 Outdoor", data: [], borderColor: "#3b82f6", fill: false, tension: 0.4 }, { label: "PM 10 Outdoor", data: [], borderColor: "#10b981", fill: false, tension: 0.4 }] }, options: getChartOpts('µg/m³') }) : null;

function updateChart(chart, d1, d2, timeStr) {
  if(!chart) return;
  chart.data.labels.push(timeStr); chart.data.datasets[0].data.push(d1); chart.data.datasets[1].data.push(d2);
  if (chart.data.labels.length > 15) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); chart.data.datasets[1].data.shift(); }
  chart.update();
}

// --- AMBIL DATA ---
db.ref('.info/connected').on('value', snap => {
  const badge = document.getElementById("conn-status");
  if (!badge) return;
  if (snap.val() === true) { badge.className = "status-badge"; badge.innerHTML = '<span id="status-text">TERHUBUNG (LIVE)</span>'; } 
  else { badge.className = "status-badge offline"; badge.innerHTML = '<span id="status-text">MENUNGGU DATA...</span>'; }
});

db.ref('sensorData').on('value', (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  SENSORS.forEach(id => {
      let val = data[id] || 0; let status = getIspu(val);
      let elVal = document.getElementById(`val-${id}`); if (elVal) elVal.innerText = val.toFixed(1);
      let elStat = document.getElementById(`stat-${id}`); if (elStat) { elStat.innerText = status.lbl; elStat.style.color = status.color; }
      let elCard = document.getElementById(`card-${id}`); if (elCard) elCard.className = `glass-card sensor-card ${status.cls}`;
  });

  const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  updateChart(gasChart, data['mq135_outdoor']||0, data['mq7_outdoor']||0, timeNow);
  updateChart(particleChart, data['pm25_outdoor']||0, data['pm10_outdoor']||0, timeNow);
});
