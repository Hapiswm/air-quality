// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
    // URL DATABASE KAMU
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// ==========================================
// 2. LOGIKA ISPU KLHK (Massa & Interpolasi)
// ==========================================
function convertToMass(ppm, gasType) {
    if (gasType === 'CO') return ppm * 1145.6; 
    if (gasType === 'NO2') return ppm * 1881.8;
    return ppm; 
}

const ispuLimits = {
    'PM10': [[0,50,0,50], [51,150,51,100], [151,350,101,200], [351,420,201,300], [421,500,301,500]],
    'PM25': [[0,15.5,0,50], [15.6,55.4,51,100], [55.5,150.4,101,200], [150.5,250.4,201,300], [250.5,500,301,500]],
    'CO': [[0,4000,0,50], [4001,8000,51,100], [8001,15000,101,200], [15001,30000,201,300], [30001,45000,301,500]],
    'NO2': [[0,80,0,50], [81,200,51,100], [201,1130,101,200], [1131,2260,201,300], [2261,3000,301,500]]
};

function calculateISPU(value, type) {
    let limits = ispuLimits[type];
    if (!limits) return 0;
    for (let i = 0; i < limits.length; i++) {
        let Xb = limits[i][0], Xa = limits[i][1];
        let Ib = limits[i][2], Ia = limits[i][3];
        if (value >= Xb && value <= Xa) {
            let I = ((Ia - Ib) / (Xa - Xb)) * (value - Xb) + Ib;
            return Math.round(I);
        }
    }
    return 500; 
}

function getISPUCategory(ispuScore) {
    if (ispuScore <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" };
    if (ispuScore <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" };
    if (ispuScore <= 200) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" };
    if (ispuScore <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" };
    return { text: "BERBAHAYA", color: "#000000", emoji: "☠️", isDanger: true }; 
}

// ==========================================
// 3. INISIALISASI GRAFIK (CHART.JS)
// ==========================================
let myChart;
if(document.getElementById('airChart')) {
    const ctx = document.getElementById('airChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                { label: 'CO Receiver (µg/m³)', borderColor: '#ef4444', backgroundColor: 'transparent', data: [], tension: 0.3 },
                { label: 'NO2 Receiver (µg/m³)', borderColor: '#f59e0b', backgroundColor: 'transparent', data: [], tension: 0.3 },
                { label: 'PM 2.5 Receiver', borderColor: '#3b82f6', backgroundColor: 'transparent', data: [], tension: 0.3 }
            ]
        },
        options: { responsive: true, scales: { x: { display: true }, y: { beginAtZero: true } } }
    });
}

// ==========================================
// 4. FUNGSI PROSES DATA (UI Dashboard)
// ==========================================
function updateDashboardCard(id, suffix, value, ispuScore, category) {
    let elID = `${id}-${suffix}`;
    if(document.getElementById(`val-${elID}`)) {
        document.getElementById(`val-${elID}`).innerText = value.toFixed(1);
        document.getElementById(`emo-${elID}`).innerText = category.emoji;
        document.getElementById(`stat-${elID}`).innerText = category.text;
        document.getElementById(`stat-${elID}`).style.color = category.color;
        document.getElementById(`card-${elID}`).style.borderTopColor = category.color;
    }
    // Update Speedometer
    if(document.getElementById(`spd-${elID}`)) {
        document.getElementById(`spd-${elID}`).innerText = value.toFixed(1);
        let ispuEl = document.getElementById(`ispu-spd-${elID}`);
        if(ispuEl) {
            ispuEl.innerText = `ISPU: ${ispuScore}`;
            ispuEl.style.color = category.color;
        }
    }
}

function processNodeData(data, locationType) {
    let uiSuffix = locationType === 'receiver' ? 'in' : 'out';
    let fbSuffix = locationType === 'receiver' ? '_indoor' : '_outdoor'; 

    let suhu = data['suhu' + fbSuffix] || 0;
    let hum = data['hum' + fbSuffix] || 0;
    
    if(document.getElementById(`val-suhu-${uiSuffix}`)) document.getElementById(`val-suhu-${uiSuffix}`).innerText = suhu.toFixed(1) + " °C";
    if(document.getElementById(`val-hum-${uiSuffix}`)) document.getElementById(`val-hum-${uiSuffix}`).innerText = hum.toFixed(1) + " %";
    if(document.getElementById(`spd-suhu-${uiSuffix}`)) document.getElementById(`spd-suhu-${uiSuffix}`).innerText = suhu.toFixed(1);

    let no2_m = convertToMass(data['no2' + fbSuffix] || 0, 'NO2');
    let co_m = convertToMass(data['co' + fbSuffix] || 0, 'CO');
    let pm25_m = data['pm25' + fbSuffix] || 0;
    let pm10_m = data['pm10' + fbSuffix] || 0;

    let i_no2 = calculateISPU(no2_m, 'NO2');
    let i_co = calculateISPU(co_m, 'CO');
    let i_pm25 = calculateISPU(pm25_m, 'PM25');
    let i_pm10 = calculateISPU(pm10_m, 'PM10');

    updateDashboardCard('no2', uiSuffix, no2_m, i_no2, getISPUCategory(i_no2));
    updateDashboardCard('co', uiSuffix, co_m, i_co, getISPUCategory(i_co));
    updateDashboardCard('pm25', uiSuffix, pm25_m, i_pm25, getISPUCategory(i_pm25));
    updateDashboardCard('pm10', uiSuffix, pm10_m, i_pm10, getISPUCategory(i_pm10));
}

// MENDENGARKAN DATA REALTIME
db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if (data) {
        processNodeData(data, 'receiver');
        processNodeData(data, 'sender');
    }
});

// ==========================================
// 5. DATA LOG UNTUK GRAFIK & HISTORY TABLE
// ==========================================
db.ref('/logs').limitToLast(15).on('value', (snapshot) => {
    let tbody = document.getElementById('tableBody');
    if(tbody) tbody.innerHTML = '';
    
    let labels = [], coData = [], no2Data = [], pmData = [];

    snapshot.forEach((child) => {
        let d = child.val();
        let timeStr = new Date(d.timestamp || Date.now()).toLocaleTimeString('id-ID');
        
        // Konversi Data
        let no2_in = convertToMass(d.no2_indoor || 0, 'NO2').toFixed(1);
        let co_in = convertToMass(d.co_indoor || 0, 'CO').toFixed(1);
        let no2_out = convertToMass(d.no2_outdoor || 0, 'NO2').toFixed(1);
        let co_out = convertToMass(d.co_outdoor || 0, 'CO').toFixed(1);

        // Isi Tabel History
        if(tbody) {
            tbody.innerHTML += `<tr>
                <td>${timeStr}</td>
                <td>${(d.suhu_indoor||0).toFixed(1)}</td><td>${(d.hum_indoor||0).toFixed(1)}</td>
                <td>${no2_in}</td><td>${co_in}</td><td>${d.pm25_indoor||0}</td><td>${d.pm10_indoor||0}</td>
                <td>${(d.suhu_outdoor||0).toFixed(1)}</td><td>${(d.hum_outdoor||0).toFixed(1)}</td>
                <td>${no2_out}</td><td>${co_out}</td><td>${d.pm25_outdoor||0}</td><td>${d.pm10_outdoor||0}</td>
            </tr>`;
        }

        labels.push(timeStr);
        coData.push(co_in);
        no2Data.push(no2_in);
        pmData.push(d.pm25_indoor || 0);
    });

    // Perbarui Grafik
    if(myChart) {
        myChart.data.labels = labels;
        myChart.data.datasets[0].data = coData;
        myChart.data.datasets[1].data = no2Data;
        myChart.data.datasets[2].data = pmData;
        myChart.update();
    }
});
