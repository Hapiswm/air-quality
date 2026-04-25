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

// =========================================================================
// 2. KONTROL SISTEM (START / STOP DARI DASHBOARD)
// =========================================================================
function setAlat(status) {
    db.ref('/kontrol/sistem').set(status);
}

// Pantau status alat untuk mengubah warna indikator di web
db.ref('/kontrol/sistem').on('value', (snapshot) => {
    let status = snapshot.val();
    let statusSistemEl = document.getElementById('status-sistem');
    
    if(statusSistemEl) {
        if(status === 'START') {
            statusSistemEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: AKTIF (START)`;
            statusSistemEl.style.background = "rgba(16, 185, 129, 0.2)"; // Hijau
            statusSistemEl.style.color = "#10b981";
        } else {
            statusSistemEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Status: MATI (STOP)`;
            statusSistemEl.style.background = "rgba(239, 68, 68, 0.2)"; // Merah
            statusSistemEl.style.color = "#ef4444";
        }
    }
});

// =========================================================================
// 3. MENAMPILKAN DATA REAL-TIME KE DASHBOARD
// =========================================================================
function safeUpdateDOM(id, val) {
    let el = document.getElementById(id);
    if(el) {
        // Jika nilainya angka desimal, bulatkan 2 angka di belakang koma
        el.innerText = (typeof val === 'number' && val % 1 !== 0) ? val.toFixed(2) : val;
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

        // Update Indoor
        safeUpdateDOM('val-mq135_indoor', data.mq135_indoor);
        safeUpdateDOM('val-mq7_indoor', data.mq7_indoor);
        safeUpdateDOM('val-pm25_indoor', data.pm25_indoor);
        safeUpdateDOM('val-pm10_indoor', data.pm10_indoor);

        // Update Outdoor
        safeUpdateDOM('val-mq135_outdoor', data.mq135_outdoor);
        safeUpdateDOM('val-mq7_outdoor', data.mq7_outdoor);
        safeUpdateDOM('val-pm25_outdoor', data.pm25_outdoor);
        safeUpdateDOM('val-pm10_outdoor', data.pm10_outdoor);
    }
});

// =========================================================================
// 4. FITUR EXPORT EXCEL (RAW, 15 MENIT, 1 JAM) UNTUK PENELITIAN
// =========================================================================

// Dekode Waktu Asli dari Push ID Firebase
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0;
    for (let i = 0; i < 8; i++) { time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i)); }
    return new Date(time);
}

// Format Waktu ke bentuk yang rapi di Excel
function formatTanggalWaktu(date) {
    let d = date.getDate().toString().padStart(2, '0');
    let m = (date.getMonth() + 1).toString().padStart(2, '0');
    let y = date.getFullYear();
    let jam = date.getHours().toString().padStart(2, '0');
    let mnt = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}/${y} ${jam}:${mnt}`;
}

// Fungsi Tarik dan Rakit Data
function downloadExcel(mode) {
    alert("Sistem sedang merakit data Excel... Silakan tunggu sebentar.");
    
    // Mencegah browser hang, ambil 10.000 data terakhir saja
    db.ref('/logs').limitToLast(10000).once('value').then(snapshot => {
        let dataMentah = [];
        
        snapshot.forEach(childSnapshot => {
            let key = childSnapshot.key;
            let row = childSnapshot.val();
            row.waktuAsli = getRealTimeFromFirebaseKey(key); 
            dataMentah.push(row);
        });

        if(dataMentah.length === 0) {
            alert("Belum ada data history yang tersimpan di database.");
            return;
        }

        let dataExcel = [];

        // MODE: MENTAH
        if (mode === 'raw') {
            dataExcel = dataMentah.map(r => ({
                "Waktu (WIB)": formatTanggalWaktu(r.waktuAsli),
                "MQ-135 Indoor (PPM)": parseFloat(r.mq135_indoor || 0).toFixed(2),
                "MQ-7 Indoor (PPM)": parseFloat(r.mq7_indoor || 0).toFixed(2),
                "PM2.5 Indoor (ug/m3)": r.pm25_indoor || 0,
                "PM10 Indoor (ug/m3)": r.pm10_indoor || 0,
                "MQ-135 Outdoor (PPM)": parseFloat(r.mq135_outdoor || 0).toFixed(2),
                "MQ-7 Outdoor (PPM)": parseFloat(r.mq7_outdoor || 0).toFixed(2),
                "PM2.5 Outdoor (ug/m3)": r.pm25_outdoor || 0,
                "PM10 Outdoor (ug/m3)": r.pm10_outdoor || 0
            }));
        } 
        // MODE: RATA-RATA
        else {
            let intervalMs = (mode === '15min') ? (15 * 60 * 1000) : (60 * 60 * 1000);
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
                    "Waktu Blok (WIB)": waktu,
                    "Total Sampel": c,
                    "Rata-rata MQ-135 Indoor": +(g.mq135_in / c).toFixed(2),
                    "Rata-rata MQ-7 Indoor": +(g.mq7_in / c).toFixed(2),
                    "Rata-rata PM2.5 Indoor": +(g.pm25_in / c).toFixed(1),
                    "Rata-rata PM10 Indoor": +(g.pm10_in / c).toFixed(1),
                    "Rata-rata MQ-135 Outdoor": +(g.mq135_out / c).toFixed(2),
                    "Rata-rata MQ-7 Outdoor": +(g.mq7_out / c).toFixed(2),
                    "Rata-rata PM2.5 Outdoor": +(g.pm25_out / c).toFixed(1),
                    "Rata-rata PM10 Outdoor": +(g.pm10_out / c).toFixed(1)
                });
            }
        }

        // Susun file Excel dan Download Otomatis
        const worksheet = XLSX.utils.json_to_sheet(dataExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Pemantauan");

        let labelFile = (mode === 'raw') ? 'SemuaData' : (mode === '15min') ? 'Per15Menit' : 'Per1Jam';
        let namaFile = `Rekap_AirQuality_${labelFile}.xlsx`;
        XLSX.writeFile(workbook, namaFile);

    }).catch(error => {
        alert("Gagal mengambil data dari Firebase. Pastikan internet Anda lancar. Error: " + error);
    });
}
