// 1. KONFIGURASI FIREBASE (GANTI URL INI)
const firebaseConfig = {
    // Masukkan URL Firebase milikmu di bawah ini:
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. LOGIKA ISPU
function getIspu(val) {
    if (val <= 50) return { lbl: "Baik", cls: "baik", hex: "#00b050" };
    if (val <= 100) return { lbl: "Sedang", cls: "sedang", hex: "#ffc107" };
    if (val <= 150) return { lbl: "Sensitif", cls: "sensitif", hex: "#ff9800" };
    if (val <= 200) return { lbl: "Tidak Sehat", cls: "tidak-sehat", hex: "#ff0000" };
    if (val <= 300) return { lbl: "Sangat Tidak Sehat", cls: "sangat-tidak-sehat", hex: "#9c27b0" };
    return { lbl: "Berbahaya", cls: "berbahaya", hex: "#222222" };
}

const sensorsList = [
    { id: 'mq7_outdoor', title: 'MQ-7 Outdoor', unit: 'ppm', max: 400 },
    { id: 'mq7_indoor', title: 'MQ-7 Indoor', unit: 'ppm', max: 400 },
    { id: 'mq135_outdoor', title: 'MQ-135 Outdoor', unit: 'ppm', max: 400 },
    { id: 'mq135_indoor', title: 'MQ-135 Indoor', unit: 'ppm', max: 400 },
    { id: 'pm25_outdoor', title: 'PM2.5 Outdoor', unit: 'µg/m³', max: 400 },
    { id: 'pm25_indoor', title: 'PM2.5 Indoor', unit: 'µg/m³', max: 400 },
    { id: 'pm10_outdoor', title: 'PM10 Outdoor', unit: 'µg/m³', max: 400 },
    { id: 'pm10_indoor', title: 'PM10 Indoor', unit: 'µg/m³', max: 400 }
];

// 3. IDENTIFIKASI HALAMAN
const dashContainer = document.getElementById('dashboard-container');
const sumContainer = document.getElementById('summary-container');
const speedContainer = document.getElementById('speedometer-container');

// Simpan variabel ECharts agar tidak render ulang dari awal
let echartsInstances = {}; 

// 4. MENGAMBIL DATA REAL-TIME
db.ref('sensorData').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // --- JIKA BERADA DI HALAMAN DASHBOARD ---
    if (dashContainer) {
        let htmlCards = "";
        let totalGas = 0, totalPm = 0, countGas = 0, countPm = 0;

        sensorsList.forEach(s => {
            let val = data[s.id] || 0;
            let status = getIspu(val);
            
            // Hitung rata-rata
            if (s.id.includes('pm')) { totalPm += val; countPm++; } 
            else { totalGas += val; countGas++; }

            htmlCards += `
                <div class="sensor-card ${status.cls}">
                    <div class="sensor-title">${s.title}</div>
                    <div class="sensor-value-line">
                        <span class="sensor-value">${val}</span>
                        <span class="sensor-unit">${s.unit}</span>
                    </div>
                    <div class="sensor-badge badge-${status.cls}">${status.lbl}</div>
                </div>`;
        });

        dashContainer.innerHTML = htmlCards;
        
        let avgGas = countGas > 0 ? (totalGas / countGas).toFixed(1) : 0;
        let avgPm = countPm > 0 ? (totalPm / countPm).toFixed(1) : 0;
        
        sumContainer.innerHTML = `
            <div class="summary-box">
                <div class="summary-title">Rata-rata Gas</div>
                <div class="summary-value">${avgGas} <span style="font-size:16px;">ppm</span></div>
            </div>
            <div class="summary-box">
                <div class="summary-title">Rata-rata Partikel</div>
                <div class="summary-value">${avgPm} <span style="font-size:16px;">µg/m³</span></div>
            </div>`;
    }

    // --- JIKA BERADA DI HALAMAN SPEEDOMETER ---
    if (speedContainer) {
        const ispuColors = [
            [50/400, '#00b050'], [100/400, '#ffc107'], [150/400, '#ff9800'],
            [200/400, '#ff0000'], [300/400, '#9c27b0'], [1, '#222222']
        ];

        // Buat kotak div pertama kali jika belum ada
        if (speedContainer.innerHTML.trim() === "") {
            sensorsList.forEach(s => {
                speedContainer.innerHTML += `
                <div class="chart-box">
                    <h3 style="text-align:center; border:none; padding:0; margin-bottom:0; font-size:16px;">${s.title}</h3>
                    <div id="sp-${s.id}" style="width:100%; height:280px;"></div>
                </div>`;
            });
        }

        // Update nilai masing-masing jarum
        setTimeout(() => {
            sensorsList.forEach(s => {
                let val = data[s.id] || 0;
                let status = getIspu(val);
                let domId = `sp-${s.id}`;
                let chartDom = document.getElementById(domId);
                
                if (chartDom) {
                    if (!echartsInstances[s.id]) {
                        echartsInstances[s.id] = echarts.init(chartDom);
                    }
                    
                    let chart = echartsInstances[s.id];
                    chart.setOption({
                        series: [{
                            type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: s.max, splitNumber: 8,
                            axisLine: { lineStyle: { width: 16, color: ispuColors } },
                            pointer: { width: 5 },
                            axisTick: { distance: -16, length: 8, lineStyle: { color: '#fff', width: 2 } },
                            splitLine: { distance: -16, length: 16, lineStyle: { color: '#fff', width: 3 } },
                            axisLabel: {
                                distance: 22, color: '#444', fontSize: 11, fontWeight: 'bold',
                                formatter: function (v) { return [0, 50, 100, 150, 200, 300, 400].includes(v) ? v : ''; }
                            },
                            detail: {
                                formatter: function(v) { return '{value|' + v + '} {unit|' + s.unit + '}\n{status|' + status.lbl + '}'; },
                                rich: {
                                    value: { fontSize: 26, fontWeight: '900', color: '#111', lineHeight: 30 },
                                    unit: { fontSize: 13, color: '#666', lineHeight: 30 },
                                    status: { fontSize: 12, fontWeight: 'bold', color: status.hex, lineHeight: 20 }
                                },
                                offsetCenter: [0, '65%']
                            },
                            data: [{ value: val }]
                        }]
                    });
                }
            });
        }, 100);
    }
});
