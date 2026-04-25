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

let gasChart = null, particleChart = null; 
let compMq135 = null, compMq7 = null, compPm25 = null, compPm10 = null; 
let maxDataPoints = 15; 

// =========================================================================
// 2. FITUR LOGIN & INISIALISASI HALAMAN
// =========================================================================
window.onload = () => {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');
    
    if(sessionStorage.getItem("isAdmin") === "true") {
        if(panel) panel.style.display = 'block';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
    }
    
    setTimeout(() => {
        if(document.getElementById('gasChart')) initDashboardCharts();
        if(document.getElementById('chart-mq135')) initComparisonCharts();
        if(document.getElementById('history-table-body')) initHistoryTable();
    }, 300); 
};

function toggleLogin() {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');

    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin");
        if(panel) panel.style.display = 'none';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-lock"></i> Login Admin';
        alert("Anda telah logout.");
    } else {
        let pass = prompt("Masukkan Password Admin:");
        if (pass === "hafidz123") {
            sessionStorage.setItem("isAdmin", "true");
            if(panel) panel.style.display = 'block';
            if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
        } else if (pass !== null) {
            alert("Password Salah!");
        }
    }
}

function setAlat(status) { db.ref('/kontrol/sistem').set(status); }

db.ref('/kontrol/sistem').on('value', (snapshot) => {
    let status = snapshot.val();
    let statusSistemEl = document.getElementById('status-sistem');
    if(statusSistemEl) {
        statusSistemEl.innerHTML = status === 'START' ? `<i class="fa-solid fa-satellite-dish"></i> Status: AKTIF (START)` : `<i class="fa-solid fa-satellite-dish"></i> Status: MATI (STOP)`;
        statusSistemEl.style.background = status === 'START' ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"; 
        statusSistemEl.style.color = status === 'START' ? "#10b981" : "#ef4444";
    }
});

// =========================================================================
// 3. GRAFIK (PRE-LOAD HISTORY)
// =========================================================================
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0;
    for (let i = 0; i < 8; i++) time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i));
    return new Date(time);
}

function fetchHistoricalDataForCharts(chartsObj, isDashboard) {
    db.ref('/logs').limitToLast(maxDataPoints).once('value').then(snapshot => {
        snapshot.forEach(child => {
            let d = child.val();
            let timeStr = new Date(getRealTimeFromFirebaseKey(child.key)).toLocaleTimeString('id-ID', { hour12: false });
            
            if (isDashboard) {
                chartsObj.gas.data.labels.push(timeStr);
                chartsObj.gas.data.datasets[0].data.push(parseFloat(d.mq135_indoor || 0));
                chartsObj.gas.data.datasets[1].data.push(parseFloat(d.mq7_indoor || 0));
                
                chartsObj.part.data.labels.push(timeStr);
                chartsObj.part.data.datasets[0].data.push(parseFloat(d.pm25_indoor || 0));
                chartsObj.part.data.datasets[1].data.push(parseFloat(d.pm10_indoor || 0));
            } else {
                const pushData = (ch, vIn, vOut) => {
                    ch.data.labels.push(timeStr);
                    ch.data.datasets[0].data.push(parseFloat(vIn || 0));
                    ch.data.datasets[1].data.push(parseFloat(vOut || 0));
                };
                pushData(chartsObj.m135, d.mq135_indoor, d.mq135_outdoor);
                pushData(chartsObj.m7, d.mq7_indoor, d.mq7_outdoor);
                pushData(chartsObj.p25, d.pm25_indoor, d.pm25_outdoor);
                pushData(chartsObj.p10, d.pm10_indoor, d.pm10_outdoor);
            }
        });
        if(isDashboard) { chartsObj.gas.update(); chartsObj.part.update(); } 
        else { chartsObj.m135.update(); chartsObj.m7.update(); chartsObj.p25.update(); chartsObj.p10.update(); }
    });
}

function initDashboardCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#cbd5e1';
    
    gasChart = new Chart(document.getElementById('gasChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'MQ-135 (PPM)', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 }, { label: 'MQ-7 (PPM)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', data: [], fill: true, tension: 0.4 }]}, options: { responsive: true, maintainAspectRatio: false }
    });

    particleChart = new Chart(document.getElementById('particleChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'PM 2.5', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], fill: true, tension: 0.4 }, { label: 'PM 10', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }]}, options: { responsive: true, maintainAspectRatio: false }
    });

    fetchHistoricalDataForCharts({gas: gasChart, part: particleChart}, true);
}

function initComparisonCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#cbd5e1';
    
    const commonOpts = { responsive: true, maintainAspectRatio: false };
    const createCompChart = (id) => {
        return new Chart(document.getElementById(id).getContext('2d'), {
            type: 'line', data: { labels: [], datasets: [{ label: 'INDOOR', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 }, { label: 'OUTDOOR', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }]}, options: commonOpts
        });
    };

    compMq135 = createCompChart('chart-mq135'); compMq7 = createCompChart('chart-mq7');
    compPm25 = createCompChart('chart-pm25'); compPm10 = createCompChart('chart-pm10');
    
    fetchHistoricalDataForCharts({m135: compMq135, m7: compMq7, p25: compPm25, p10: compPm10}, false);

    let filterEl = document.getElementById('chart-time-filter');
    if(filterEl) {
        filterEl.addEventListener('change', (e) => {
            maxDataPoints = parseInt(e.target.value);
            [compMq135, compMq7, compPm25, compPm10].forEach(ch => { ch.data.labels=[]; ch.data.datasets[0].data=[]; ch.data.datasets[1].data=[]; });
            fetchHistoricalDataForCharts({m135: compMq135, m7: compMq7, p25: compPm25, p10: compPm10}, false);
        });
    }
}

// =========================================================================
// 4. LOGIKA EMOJI ISPU & UPDATE KARTU (DASHBOARD + SPEEDO)
// =========================================================================
function getISPUStatus(val) {
    if (val <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" }; 
    if (val <= 100) return { text: "SEDANG", color: "#eab308", emoji: "😐" }; 
    if (val <= 199) return { text: "TIDAK SEHAT", color: "#ef4444", emoji: "😷" }; 
    if (val <= 299) return { text: "SANGAT TIDAK SEHAT", color: "#a855f7", emoji: "🤢" }; 
    return { text: "BERBAHAYA", color: "#78350f", emoji: "☠️" }; 
}

function updateGaugeAndCard(idPrefix, val, isDebu) {
    let numVal = parseFloat(val || 0);
    
    // Tampilan angka: jika gas (ppm) tampilkan 2 desimal, jika debu tampilkan tanpa desimal
    let displayVal = isDebu ? Math.round(numVal) : ((numVal % 1 !== 0) ? numVal.toFixed(2) : numVal);
    let ispu = getISPUStatus(numVal);

    // Seleksi Elemen
    let elVal = document.getElementById(`val-${idPrefix}`);
    let elStat = document.getElementById(`stat-${idPrefix}`);
    let elCard = document.getElementById(`card-${idPrefix}`);
    let needle = document.getElementById(`needle-${idPrefix}`);

    // Update Teks Angka
    if (elVal) {
        let unit = isDebu ? "µg/m³" : "ppm";
        elVal.innerHTML = `${displayVal} <span class="speedo-unit">${unit}</span>`;
    }
    
    // Update Emoji & Teks Status (Posisi Tengah)
    if (elStat) { 
        elStat.innerHTML = `<div style="font-size: 28px; margin-bottom: 2px;">${ispu.emoji}</div><div style="font-size: 13px; font-weight: 800; color: ${ispu.color}; text-transform: uppercase;">${ispu.text}</div>`; 
    }

    // Update Warna Kotak (Dashboard Regular Card)
    if (elCard && !needle) { 
        elCard.style.borderTop = `4px solid ${ispu.color}`; 
        elCard.style.boxShadow = `0 4px 15px ${ispu.color}33`; 
    }

    // Update Animasi Jarum Matematika (Khusus Speedometer CSS)
    if (needle) {
        let maxScale = 400; // Skala maksimal seperti di gambar mockup (0 - 400)
        let clamped = Math.min(Math.max(numVal, 0), maxScale);
        let angle = -90 + (clamped / maxScale) * 180;
        needle.style.transform = `rotate(${angle}deg)`;
    }
}

db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if(data) {
        let connEl = document.getElementById('conn-status');
        let statText = document.getElementById('status-text');
        if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

        // Update Dashboard Utama (id pakai garis bawah "_")
        updateGaugeAndCard('mq135_indoor', data.mq135_indoor, false);
        updateGaugeAndCard('mq7_indoor', data.mq7_indoor, false);
        updateGaugeAndCard('pm25_indoor', data.pm25_indoor, true);
        updateGaugeAndCard('pm10_indoor', data.pm10_indoor, true);
        
        updateGaugeAndCard('mq135_outdoor', data.mq135_outdoor, false);
        updateGaugeAndCard('mq7_outdoor', data.mq7_outdoor, false);
        updateGaugeAndCard('pm25_outdoor', data.pm25_outdoor, true);
        updateGaugeAndCard('pm10_outdoor', data.pm10_outdoor, true);
        
        // Update Halaman Speedometer (id pakai strip "-")
        updateGaugeAndCard('mq135-in', data.mq135_indoor, false);
        updateGaugeAndCard('mq7-in', data.mq7_indoor, false);
        updateGaugeAndCard('pm25-in', data.pm25_indoor, true);
        updateGaugeAndCard('pm10-in', data.pm10_indoor, true);
        
        updateGaugeAndCard('mq135-out', data.mq135_outdoor, false);
        updateGaugeAndCard('mq7-out', data.mq7_outdoor, false);
        updateGaugeAndCard('pm25-out', data.pm25_outdoor, true);
        updateGaugeAndCard('pm10-out', data.pm10_outdoor, true);

        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });

        // Update Grafik Live
        if(gasChart !== null && particleChart !== null) {
            gasChart.data.labels.push(now); gasChart.data.datasets[0].data.push(parseFloat(data.mq135_indoor || 0)); gasChart.data.datasets[1].data.push(parseFloat(data.mq7_indoor || 0));
            particleChart.data.labels.push(now); particleChart.data.datasets[0].data.push(parseFloat(data.pm25_indoor || 0)); particleChart.data.datasets[1].data.push(parseFloat(data.pm10_indoor || 0));
            if(gasChart.data.labels.length > maxDataPoints) { gasChart.data.labels.shift(); gasChart.data.datasets[0].data.shift(); gasChart.data.datasets[1].data.shift(); }
            if(particleChart.data.labels.length > maxDataPoints) { particleChart.data.labels.shift(); particleChart.data.datasets[0].data.shift(); particleChart.data.datasets[1].data.shift(); }
            gasChart.update('none'); particleChart.update('none');
        }

        if(compMq135 !== null) {
            const pushComp = (chart, valIn, valOut) => {
                chart.data.labels.push(now);
                chart.data.datasets[0].data.push(parseFloat(valIn || 0)); chart.data.datasets[1].data.push(parseFloat(valOut || 0));
                if(chart.data.labels.length > maxDataPoints) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); chart.data.datasets[1].data.shift(); }
                chart.update('none');
            };
            pushComp(compMq135, data.mq135_indoor, data.mq135_outdoor);
            pushComp(compMq7, data.mq7_indoor, data.mq7_outdoor);
            pushComp(compPm25, data.pm25_indoor, data.pm25_outdoor);
            pushComp(compPm10, data.pm10_indoor, data.pm10_outdoor);
        }
    }
});

// =========================================================================
// 5. HISTORY TABLE & EXCEL 
// =========================================================================
function formatTanggalWaktu(date) { let d=date.getDate().toString().padStart(2,'0'); let m=(date.getMonth()+1).toString().padStart(2,'0'); return `${d}/${m}/${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`; }
function initHistoryTable() {
    let tbody = document.getElementById('history-table-body'); if (!tbody) return; 
    db.ref('/logs').limitToLast(10).on('value', (s) => {
        tbody.innerHTML = ''; if (!s.exists()) { tbody.innerHTML = '<tr><td colspan="9">Belum ada data.</td></tr>'; return; }
        let rowsHTML = []; s.forEach(child => {
            let r = child.val(); let date = formatTanggalWaktu(getRealTimeFromFirebaseKey(child.key));
            rowsHTML.unshift(`<tr><td>${date}</td><td>${parseFloat(r.mq135_indoor||0).toFixed(1)}</td><td>${parseFloat(r.mq7_indoor||0).toFixed(1)}</td><td>${r.pm25_indoor||0}</td><td>${r.pm10_indoor||0}</td><td>${parseFloat(r.mq135_outdoor||0).toFixed(1)}</td><td>${parseFloat(r.mq7_outdoor||0).toFixed(1)}</td><td>${r.pm25_outdoor||0}</td><td>${r.pm10_outdoor||0}</td></tr>`);
        }); tbody.innerHTML = rowsHTML.join('');
    });
}
function downloadExcel(mode) {
    alert("Sistem merakit data Excel...");
    db.ref('/logs').limitToLast(10000).once('value').then(snapshot => {
        let dm = []; snapshot.forEach(child => { let r = child.val(); r.wAsli = getRealTimeFromFirebaseKey(child.key); dm.push(r); });
        if(dm.length===0) return; let dx = [];
        if (mode === 'raw') {
            dx = dm.map(r => ({ "Waktu": formatTanggalWaktu(r.wAsli), "In MQ135": +(parseFloat(r.mq135_indoor||0).toFixed(2)), "In MQ7": +(parseFloat(r.mq7_indoor||0).toFixed(2)), "In PM2.5": +(r.pm25_indoor||0), "In PM10": +(r.pm10_indoor||0), "Out MQ135": +(parseFloat(r.mq135_outdoor||0).toFixed(2)), "Out MQ7": +(parseFloat(r.mq7_outdoor||0).toFixed(2)), "Out PM2.5": +(r.pm25_outdoor||0), "Out PM10": +(r.pm10_outdoor||0) }));
        } else {
            let intv = mode==='15min'?15*60000 : mode==='1hour'?60*60000 : 120*60000; let gw = {};
            dm.forEach(r => { let lbl = formatTanggalWaktu(new Date(Math.floor(r.wAsli.getTime()/intv)*intv));
                if(!gw[lbl]) gw[lbl]={c:0,m1i:0,m7i:0,p2i:0,p1i:0,m1o:0,m7o:0,p2o:0,p1o:0};
                gw[lbl].c++; gw[lbl].m1i+=parseFloat(r.mq135_indoor||0); gw[lbl].m7i+=parseFloat(r.mq7_indoor||0); gw[lbl].p2i+=parseFloat(r.pm25_indoor||0); gw[lbl].p1i+=parseFloat(r.pm10_indoor||0); gw[lbl].m1o+=parseFloat(r.mq135_outdoor||0); gw[lbl].m7o+=parseFloat(r.mq7_outdoor||0); gw[lbl].p2o+=parseFloat(r.pm25_outdoor||0); gw[lbl].p1o+=parseFloat(r.pm10_outdoor||0);
            });
            for (let w in gw) { let g=gw[w]; let c=g.c; dx.push({"Waktu":w,"Sampel":c,"Avg In MQ135":+(g.m1i/c).toFixed(2),"Avg In MQ7":+(g.m7i/c).toFixed(2),"Avg In PM2.5":+(g.p2i/c).toFixed(1),"Avg In PM10":+(g.p1i/c).toFixed(1),"Avg Out MQ135":+(g.m1o/c).toFixed(2),"Avg Out MQ7":+(g.m7o/c).toFixed(2),"Avg Out PM2.5":+(g.p2o/c).toFixed(1),"Avg Out PM10":+(g.p1o/c).toFixed(1)}); }
        }
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Data_Air_Quality"); XLSX.writeFile(wb, `Data_AirQuality_${mode}.xlsx`);
    });
}
