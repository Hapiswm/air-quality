// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// ==========================================
// 2. LOGIKA ISPU (KLHK STANDARDS)
// ==========================================

// Fungsi Konversi PPM ke mikrogram/m3 berdasarkan Berat Molekul
function convertToMass(ppm, gasType) {
    if (gasType === 'CO') return ppm * 1145.6; 
    if (gasType === 'NO2') return ppm * 1881.8;
    return ppm; // Jika sudah dalam mikrogram (seperti debu PMS5003), biarkan
}

// Tabel Batas ISPU [Batas Bawah (Xb), Batas Atas (Xa), ISPU Bawah (Ib), ISPU Atas (Ia)]
const ispuLimits = {
    'PM10': [[0,50,0,50], [51,150,51,100], [151,350,101,200], [351,420,201,300], [421,500,301,500]],
    'PM25': [[0,15.5,0,50], [15.6,55.4,51,100], [55.5,150.4,101,200], [150.5,250.4,201,300], [250.5,500,301,500]],
    'CO': [[0,4000,0,50], [4001,8000,51,100], [8001,15000,101,200], [15001,30000,201,300], [30001,45000,301,500]],
    'NO2': [[0,80,0,50], [81,200,51,100], [201,1130,101,200], [1131,2260,201,300], [2261,3000,301,500]]
};

// Rumus Interpolasi Matematika ISPU
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
    return 500; // Jika nilai melebihi batas maksimal tabel, return 500 (Berbahaya)
}

function getISPUCategory(ispuScore) {
    if (ispuScore <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" };
    if (ispuScore <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" };
    if (ispuScore <= 200) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" };
    if (ispuScore <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" };
    return { text: "BERBAHAYA", color: "#000000", emoji: "☠️", isDanger: true }; 
}

// ==========================================
// 3. FUNGSI UPDATE UI
// ==========================================
function updateDashboardCard(id, value, ispuScore, category) {
    // Update Halaman Dashboard (index.html)
    let valEl = document.getElementById(`val-${id}`);
    if(valEl) {
        valEl.innerText = value.toFixed(1);
        document.getElementById(`emo-${id}`).innerText = category.emoji;
        document.getElementById(`stat-${id}`).innerText = category.text;
        document.getElementById(`stat-${id}`).style.color = category.color;
        
        let card = document.getElementById(`card-${id}`);
        card.style.borderTopColor = category.color;
        if(category.isDanger) {
            card.style.boxShadow = "0px 0px 20px rgba(255, 0, 0, 0.5)";
        } else {
            card.style.boxShadow = "15px 15px 30px var(--shadow-dark), -5px -5px 15px var(--shadow-light)";
        }
    }

    // Update Halaman Speedometer (speedometer.html)
    let spdEl = document.getElementById(`spd-${id}`);
    if(spdEl) {
        spdEl.innerText = value.toFixed(1);
        let spdStat = document.getElementById(`ispu-spd-${id}`);
        spdStat.innerText = `ISPU: ${ispuScore} (${category.text})`;
        spdStat.style.color = category.color;
    }
}

// ==========================================
// 4. MENGAMBIL DATA DARI FIREBASE
// ==========================================
db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if (data) {
        // --- 1. Suhu & Kelembaban (BME280) ---
        let suhu = data.suhu_indoor || 0;
        let hum = data.hum_indoor || 0;
        
        if(document.getElementById('val-suhu')) document.getElementById('val-suhu').innerText = suhu.toFixed(1) + " °C";
        if(document.getElementById('val-hum')) document.getElementById('val-hum').innerText = hum.toFixed(1) + " %";
        if(document.getElementById('spd-suhu')) document.getElementById('spd-suhu').innerText = suhu.toFixed(1);
        if(document.getElementById('spd-hum')) document.getElementById('spd-hum').innerText = hum.toFixed(1);

        // --- 2. Konversi MiCS-6814 (PPM -> ug/m3) ---
        let no2_mass = convertToMass(data.no2_indoor || 0, 'NO2');
        let co_mass = convertToMass(data.co_indoor || 0, 'CO');
        let pm25_mass = data.pm25_indoor || 0; // PMS sudah dalam ug/m3
        let pm10_mass = data.pm10_indoor || 0;

        // --- 3. Hitung Skor ISPU ---
        let ispu_no2 = calculateISPU(no2_mass, 'NO2');
        let ispu_co = calculateISPU(co_mass, 'CO');
        let ispu_pm25 = calculateISPU(pm25_mass, 'PM25');
        let ispu_pm10 = calculateISPU(pm10_mass, 'PM10');

        // --- 4. Lempar ke UI (Dashboard & Speedo) ---
        updateDashboardCard('no2', no2_mass, ispu_no2, getISPUCategory(ispu_no2));
        updateDashboardCard('co', co_mass, ispu_co, getISPUCategory(ispu_co));
        updateDashboardCard('pm25', pm25_mass, ispu_pm25, getISPUCategory(ispu_pm25));
        updateDashboardCard('pm10', pm10_mass, ispu_pm10, getISPUCategory(ispu_pm10));
    }
});

// ==========================================
// 5. MENGAMBIL DATA LOG (HISTORY)
// ==========================================
if(document.getElementById('tableBody')) {
    db.ref('/logs').limitToLast(20).on('value', (snapshot) => {
        let tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            let data = childSnapshot.val();
            let timeString = new Date(data.timestamp || Date.now()).toLocaleString('id-ID');
            
            // Konversi PPM ke massa untuk tabel history agar akurat
            let no2_m = convertToMass(data.no2_indoor || 0, 'NO2').toFixed(1);
            let co_m = convertToMass(data.co_indoor || 0, 'CO').toFixed(1);

            let row = `<tr>
                <td>${timeString}</td>
                <td>${(data.suhu_indoor || 0).toFixed(1)}</td>
                <td>${(data.hum_indoor || 0).toFixed(1)}</td>
                <td>${no2_m}</td>
                <td>${co_m}</td>
                <td>${data.pm25_indoor || 0}</td>
                <td>${data.pm10_indoor || 0}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    });
}
