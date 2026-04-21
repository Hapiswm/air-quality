// 1. Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "ISI_API_KEY_KAMU",
    authDomain: "air-quality-2f87d.firebaseapp.com",
    databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "air-quality-2f87d",
    storageBucket: "air-quality-2f87d.appspot.com",
    messagingSenderId: "ISI_SENDER_ID",
    appId: "ISI_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. Logika Status ISPU (6 Warna)
function getIspu(val) {
    if (val <= 50) return { lbl: "Baik", cls: "baik" };
    if (val <= 100) return { lbl: "Sedang", cls: "sedang" };
    if (val <= 150) return { lbl: "Sensitif", cls: "sensitif" };
    if (val <= 200) return { lbl: "Tidak Sehat", cls: "tidak-sehat" };
    if (val <= 300) return { lbl: "Sangat Tidak Sehat", cls: "sangat-tidak-sehat" };
    return { lbl: "Berbahaya", cls: "berbahaya" };
}

// 3. Ambil Data Real-time
const container = document.getElementById('dashboard-container');

if (container) {
    db.ref('sensorData').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            container.innerHTML = ""; // Bersihkan tampilan lama
            
            // Loop data dari Firebase (Contoh: mq7_outdoor, dll)
            for (let key in data) {
                let val = data[key];
                let status = getIspu(val);
                let unit = key.includes('pm') ? 'µg/m³' : 'ppm';
                let title = key.replace('_', ' ').toUpperCase();

                container.innerHTML += `
                    <div class="sensor-card ${status.cls}">
                        <div class="sensor-title">${title}</div>
                        <div class="sensor-value-line">
                            <span class="sensor-value">${val}</span>
                            <span class="sensor-unit">${unit}</span>
                        </div>
                        <div class="sensor-badge badge-${status.cls}">${status.lbl}</div>
                    </div>
                `;
            }
        }
    });
}
