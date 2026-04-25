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

// Variabel Speedometer
let gMq135In, gMq7In, gPm25In, gPm10In;
let gMq135Out, gMq7Out, gPm25Out, gPm10Out;

// =========================================================================
// 2. INISIALISASI HALAMAN
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
        if(document.getElementById('g-mq135-in')) initGauges(); 
    }, 500); 
};

function toggleLogin() {
    let panel = document.getElementById('admin-panel');
    let btnLogin = document.getElementById('btn-login');
    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin");
        if(panel) panel.style.display = 'none';
        if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-lock"></i> Login Admin';
    } else {
        if (prompt("Masukkan Password Admin:") === "hafidz123") {
            sessionStorage.setItem("isAdmin", "true");
            if(panel) panel.style.display = 'block';
            if(btnLogin) btnLogin.innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> Logout Admin';
        } else { alert("Password Salah!"); }
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
// 3. GRAFIK (ANTI-GAGAL)
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
            
            // Dipaksa menjadi Float agar Chart.js bisa membaca garisnya
            if (isDashboard) {
                chartsObj.gas.data.labels.push(timeStr);
                chartsObj.gas.data.datasets[0].data.push(parseFloat(d.mq135_indoor || 0));
                chartsObj.gas.data.datasets[1].data.push(parseFloat(d.mq7_indoor || 0));
                
                chartsObj.part.data.labels.push(timeStr);
                chartsObj.part.data.datasets[0].data.push(parseFloat(d.pm25_indoor || 0));
                chartsObj.part.data.datasets[1].data.push(parseFloat(d.pm10_indoor || 0));
            } else {
                chartsObj.m135.data.labels.push(timeStr);
                chartsObj.m135.data.datasets[0].data.push(parseFloat(d.mq135_indoor || 0));
                chartsObj.m135.data.datasets[1].data.push(parseFloat(d.mq135_outdoor || 0));

                chartsObj.m7.data.labels.push(timeStr);
                chartsObj.m7.data.datasets[0].data.push(parseFloat(d.mq7_indoor || 0));
                chartsObj.m7.data.datasets[1].data.push(parseFloat(d.mq7_outdoor || 0));

                chartsObj.p25.data.labels.push(timeStr);
                chartsObj.p25.data.datasets[0].data.push(parseFloat(d.pm25_indoor || 0));
                chartsObj.p25.data.datasets[1].data.push(parseFloat(d.pm25_outdoor || 0));

                chartsObj.p10.data.labels.push(timeStr);
                chartsObj.p10.data.datasets[0].data.push(parseFloat(d.pm10_indoor || 0));
                chartsObj.p10.data.datasets[1].data.push(parseFloat(d.pm10_outdoor || 0));
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
    const createCompChart = (id) => {
        return new Chart(document.getElementById(id).getContext('2d'), {
            type: 'line', data: { labels: [], datasets: [{ label: 'INDOOR', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', data: [], fill: true, tension: 0.4 }, { label: 'OUTDOOR', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }]}, options: { responsive: true, maintainAspectRatio: false }
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
// 4. SPEEDOMETER (WARNA ISPU LHK 2020)
// =========================================================================
function initGauges() {
    if (typeof JustGage === 'undefined') return;
    let fontColor = "#cbd5e1";
    let ispuSectors = [ {color: "#10b981", lo: 0, hi: 50}, {color: "#3b82f6", lo: 51, hi: 100}, {color: "#f59e0b", lo: 101, hi: 199}, {color: "#ef4444", lo: 200, hi: 299}, {color: "#4b5563", lo: 300, hi: 1000} ];

    gMq135In = new JustGage({ id: "g-mq135-in", value: 0, min: 0, max: 500, title: "MQ-135", label: "PPM", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gMq7In = new JustGage({ id: "g-mq7-in", value: 0, min: 0, max: 500, title: "MQ-7", label: "PPM", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gPm25In = new JustGage({ id: "g-pm25-in", value: 0, min: 0, max: 500, title: "PM 2.5", label: "µg/m³", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gPm10In = new JustGage({ id: "g-pm10-in", value: 0, min: 0, max: 500, title: "PM 10", label: "µg/m³", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });

    gMq135Out = new JustGage({ id: "g-mq135-out", value: 0, min: 0, max: 500, title: "MQ-135", label: "PPM", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gMq7Out = new JustGage({ id: "g-mq7-out", value: 0, min: 0, max: 500, title: "MQ-7", label: "PPM", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gPm25Out = new JustGage({ id: "g-pm25-out", value: 0, min: 0, max: 500, title: "PM 2.5", label: "µg/m³", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
    gPm10Out = new JustGage({ id: "g-pm10-out", value: 0, min: 0, max: 500, title: "PM 10", label: "µg/m³", titleFontColor: fontColor, valueFontColor: fontColor, customSectors: ispuSectors });
}

// =========================================================================
// 5. UPDATE EMOJI, TEKS & DATA REALTIME
// =========================================================================
function getISPUStatus(val) {
    if (val <= 50) return { text: "BAIK", color: "#10b981", emoji: "😃" }; 
    if (val <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" }; 
    if (val <= 199) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" }; 
    if (val <= 299) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" }; 
    return { text: "BERBAHAYA", color: "#4b5563", emoji: "☠️" }; 
}

function updateSensorCard(valId, statId, cardId, val) {
    let elVal = document.getElementById(valId);
    let elStat = document.getElementById(statId);
    let elCard = document.getElementById(cardId);
    let numVal = parseFloat(val || 0);
    
    if(elVal) elVal.innerText = (numVal % 1 !== 0) ? numVal.toFixed(2) : numVal;
    
    let ispu = getISPUStatus(numVal);
    
    // Injeksi Emoji di atas Teks Indikator (Berlaku di Dashboard & Speedometer)
    if(elStat) { 
        elStat.innerHTML = `<div style="font-size: 26px; margin-bottom: 5px;">${ispu.emoji}</div><div style="font-weight:bold;">${ispu.text}</div>`; 
        elStat.style.color = ispu.color; 
    }
    if(elCard) { elCard.style.borderTop = `4px solid ${ispu.color}`; elCard.style.boxShadow = `0 4px 15px ${ispu.color}33`; }
}

db.ref('/sensorData').on('value', (snapshot) => {
    let data = snapshot.val();
    if(data) {
        let connEl = document.getElementById('conn-status');
        let statText = document.getElementById('status-text');
        if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

        // Update Dashboard Cards
        updateSensorCard('val-mq135_indoor', 'stat-mq135_indoor', 'card-mq135_indoor', data.mq135_indoor);
        updateSensorCard('val-mq7_indoor', 'stat-mq7_indoor', 'card-mq7_indoor', data.mq7_indoor);
        updateSensorCard('val-pm25_indoor', 'stat-pm25_indoor', 'card-pm25_indoor', data.pm25_indoor);
        updateSensorCard('val-pm10_indoor', 'stat-pm10_indoor', 'card-pm10_indoor', data.pm10_indoor);
        updateSensorCard('val-mq135_outdoor', 'stat-mq135_outdoor', 'card-mq135_outdoor', data.mq135_outdoor);
        updateSensorCard('val-mq7_outdoor', 'stat-mq7_outdoor', 'card-mq7_outdoor', data.mq7_outdoor);
        updateSensorCard('val-pm25_outdoor', 'stat-pm25_outdoor', 'card-pm25_outdoor', data.pm25_outdoor);
        updateSensorCard('val-pm10_outdoor', 'stat-pm10_outdoor', 'card-pm10_outdoor', data.pm10_outdoor);

        // Update Text & Emoji di Speedometer
        updateSensorCard(null, 'stat-g-mq135-in', null, data.mq135_indoor);
        updateSensorCard(null, 'stat-g-mq7-in', null, data.mq7_indoor);
        updateSensorCard(null, 'stat-g-pm25-in', null, data.pm25_indoor);
        updateSensorCard(null, 'stat-g-pm10-in', null, data.pm10_indoor);
        updateSensorCard(null, 'stat-g-mq135-out', null, data.mq135_outdoor);
        updateSensorCard(null, 'stat-g-mq7-out', null, data.mq7_outdoor);
        updateSensorCard(null, 'stat-g-pm25-out', null, data.pm25_outdoor);
        updateSensorCard(null, 'stat-g-pm10-out', null, data.pm10_outdoor);

        // Update Jarum Speedometer
        if(gMq135In) {
            gMq135In.refresh(parseFloat(data.mq135_indoor||0)); gMq7In.refresh(parseFloat(data.mq7_indoor||0));
            gPm25In.refresh(parseFloat(data.pm25_indoor||0)); gPm10In.refresh(parseFloat(data.pm10_indoor||0));
            gMq135Out.refresh(parseFloat(data.mq135_outdoor||0)); gMq7Out.refresh(parseFloat(data.mq7_outdoor||0));
            gPm25Out.refresh(parseFloat(data.pm25_outdoor||0)); gPm10Out.refresh(parseFloat(data.pm10_outdoor||0));
        }

        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });

        // Update Live Charts
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
// 6. HISTORY TABLE & EXCEL REMAINS UNCHANGED...
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
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Data_KTI"); XLSX.writeFile(wb, `Data_AirQuality_${mode}.xlsx`);
    });
}
