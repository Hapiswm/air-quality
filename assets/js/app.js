// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
    // GANTI DENGAN URL DATABASE-MU
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// ==========================================
// 2. LOGIKA ISPU (Konversi & Interpolasi KLHK)
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
// 3. FUNGSI UPDATE UI (Dinamis untuk In/Out)
// ==========================================
function updateDashboardCard(id, suffix, value, ispuScore, category) {
    let elementID = `${id}-${suffix}`; // contoh: no2-in atau no2-out
    
    let valEl = document.getElementById(`val-${elementID}`);
    if(valEl) {
        valEl.innerText = value.toFixed(1);
        document.getElementById(`emo-${elementID}`).innerText = category.emoji;
        document.getElementById(`stat-${elementID}`).innerText = category.text;
        document.getElementById(`stat-${elementID}`).style.color = category.color;
        
        let card = document.getElementById(`card-${elementID}`);
        card.style.borderTopColor = category.color;
        if(category.isDanger) {
            card.style.boxShadow = "0px 0px 15px rgba(239, 68, 68, 0.4)"; // Efek glow merah jika bahaya
        } else {
            card.style.boxShadow = "5px 5px 15px rgba(148, 163, 184, 0.2), -5px -5px 15px rgba(255, 255, 255, 1)";
        }
    }
}

// Fungsi utama yang membaca data Indoor dan Outdoor secara bergantian
function processNodeData(data, locationType) {
    // suffix = '-in' (Indoor) atau '-out' (Outdoor)
    let uiSuffix = locationType === 'indoor' ? 'in' : 'out';
    // key di database Firebase (misal: suhu_indoor atau suhu_outdoor)
    let fbSuffix = locationType === 'indoor' ? '_indoor' : '_outdoor';

    // 1. Proses Suhu & Kelembaban
    let suhu = data['suhu' + fbSuffix] || 0;
    let hum = data['hum' + fbSuffix] || 0;
    if(document.getElementById(`val-suhu-${uiSuffix}`)) {
        document.getElementById(`val-suhu-${uiSuffix}`).innerText = suhu.toFixed(1) + " °C";
        document.getElementById(`val-hum-${uiSuffix}`).innerText = hum.toFixed(1) + " %";
    }

    // 2. Konversi PPM ke ug/m3
    let no2_mass = convertToMass(data['no2' + fbSuffix] || 0, 'NO2');
    let co_mass = convertToMass(data['co' + fbSuffix] || 0, 'CO');
    let pm25_mass = data['pm25' + fbSuffix] || 0;
    let pm10_mass = data['pm10' + fbSuffix] || 0;

    // 3. Hitung ISPU
    let ispu_no2 = calculateISPU(no2_mass, 'NO2');
    let ispu_co = calculateISPU(co_mass, 'CO');
    let ispu_pm25 = calculateISPU(pm25_mass, 'PM25');
    let ispu_pm10 = calculateISPU(pm10_mass, 'PM10');

    // 4. Update Kotak di Layar
    updateDashboardCard('no2', uiSuffix, no2_mass, ispu_no2, getISPUCategory(ispu_no2));
    updateDashboardCard('co', uiSuffix, co_mass, ispu_co, getISPUCategory(ispu_co));
    updateDashboardCard('pm25', uiSuffix, pm25_mass, ispu_pm25, getISPUCategory(ispu_pm25));
    updateDashboardCard('pm10', uiSuffix, pm10_mass, ispu_pm10, getISPUCategory(ispu_pm10));
}

// ==========================================
// 4. TERIMA DATA DARI FIREBASE (REALTIME)
// ==========================================
db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if (data) {
        // Panggil fungsi proses untuk Node Bos (Indoor)
        processNodeData(data, 'indoor');
        // Panggil fungsi proses untuk Node Karyawan (Outdoor)
        processNodeData(data, 'outdoor');
    }
});
