// =========================================================================
// 1. KONFIGURASI FIREBASE & VARIABEL GLOBAL
// =========================================================================
const firebaseConfig = { databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let gasChart, particleChart, gasChartOut, particleChartOut; 
let compMq135, compMq7, compPm25, compPm10; 
let maxDataPoints = 15; 

// =========================================================================
// 2. FITUR LOGIN & INISIALISASI
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
    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin"); location.reload();
    } else if (prompt("Masukkan Password Admin:") === "hafidz123") {
        sessionStorage.setItem("isAdmin", "true"); location.reload();
    } else { alert("Password Salah!"); }
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
// 3. LOGIKA ISPU & SPEEDOMETER
// =========================================================================
function getISPUStatus(val) {
    if (val <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" }; 
    if (val <= 100) return { text: "SEDANG", color: "#eab308", emoji: "😐" }; 
    if (val <= 200) return { text: "TIDAK SEHAT", color: "#ef4444", emoji: "😷" }; 
    if (val <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#a855f7", emoji: "🤢" }; 
    return { text: "BERBAHAYA", color: "#78350f", emoji: "☠️" }; 
}

function valueToAngle(val) {
    let v = Math.max(0, Math.min(val, 400));
    if (v <= 50) return -90 + (v / 50) * 36;
    if (v <= 100) return -54 + ((v - 50) / 50) * 36;
    if (v <= 200) return -18 + ((v - 100) / 100) * 36;
    if (v <= 300) return 18 + ((v - 200) / 100) * 36;
    return 54 + ((v - 300) / 100) * 36;
}

// =========================================================================
// 4. GRAFIK LIVE & KOMPARASI
// =========================================================================
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0; for (let i=0; i<8; i++) time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i)); return new Date(time);
}

function fetchHistoricalDataForCharts(chartsObj, isDashboard) {
    db.ref('/logs').limitToLast(maxDataPoints).once('value').then(snapshot => {
        snapshot.forEach(child => {
            let d = child.val();
            let timeStr = new Date(getRealTimeFromFirebaseKey(child.key)).toLocaleTimeString('id-ID', { hour12: false });
            if (isDashboard) {
                chartsObj.gas.data.labels.push(timeStr); chartsObj.gas.data.datasets[0].data.push(parseFloat(d.mq135_indoor||0)); chartsObj.gas.data.datasets[1].data.push(parseFloat(d.mq7_indoor||0));
                chartsObj.part.data.labels.push(timeStr); chartsObj.part.data.datasets[0].data.push(parseFloat(d.pm25_indoor||0)); chartsObj.part.data.datasets[1].data.push(parseFloat(d.pm10_indoor||0));
                chartsObj.gasOut.data.labels.push(timeStr); chartsObj.gasOut.data.datasets[0].data.push(parseFloat(d.mq135_outdoor||0)); chartsObj.gasOut.data.datasets[1].data.push(parseFloat(d.mq7_outdoor||0));
                chartsObj.partOut.data.labels.push(timeStr); chartsObj.partOut.data.datasets[0].data.push(parseFloat(d.pm25_outdoor||0)); chartsObj.partOut.data.datasets[1].data.push(parseFloat(d.pm10_outdoor||0));
            } else {
                chartsObj.m135.data.labels.push(timeStr); chartsObj.m135.data.datasets[0].data.push(parseFloat(d.mq135_indoor||0)); chartsObj.m135.data.datasets[1].data.push(parseFloat(d.mq135_outdoor||0));
                chartsObj.m7.data.labels.push(timeStr); chartsObj.m7.data.datasets[0].data.push(parseFloat(d.mq7_indoor||0)); chartsObj.m7.data.datasets[1].data.push(parseFloat(d.mq7_outdoor||0));
                chartsObj.p25.data.labels.push(timeStr); chartsObj.p25.data.datasets[0].data.push(parseFloat(d.pm25_indoor||0)); chartsObj.p25.data.datasets[1].data.push(parseFloat(d.pm25_outdoor||0));
                chartsObj.p10.data.labels.push(timeStr); chartsObj.p10.data.datasets[0].data.push(parseFloat(d.pm10_indoor||0)); chartsObj.p10.data.datasets[1].data.push(parseFloat(d.pm10_outdoor||0));
            }
        });
        if(isDashboard) { chartsObj.gas.update(); chartsObj.part.update(); chartsObj.gasOut.update(); chartsObj.partOut.update(); } 
        else { chartsObj.m135.update(); chartsObj.m7.update(); chartsObj.p25.update(); chartsObj.p10.update(); }
    });
}

function initDashboardCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#cbd5e1';
    const cnf = (l1, c1, l2, c2) => ({ type: 'line', data: { labels: [], datasets: [{ label: l1, borderColor: c1, backgroundColor: c1+'1A', fill: true, tension: 0.4, data: [] }, { label: l2, borderColor: c2, backgroundColor: c2+'1A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    
    gasChart = new Chart(document.getElementById('gasChart').getContext('2d'), cnf('MQ-135', '#f59e0b', 'MQ-7', '#ef4444'));
    particleChart = new Chart(document.getElementById('particleChart').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));
    gasChartOut = new Chart(document.getElementById('gasChartOut').getContext('2d'), cnf('MQ-135', '#f59e0b', 'MQ-7', '#ef4444'));
    particleChartOut = new Chart(document.getElementById('particleChartOut').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));

    fetchHistoricalDataForCharts({gas: gasChart, part: particleChart, gasOut: gasChartOut, partOut: particleChartOut}, true);
}

function initComparisonCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#cbd5e1';
    const cC = (id) => new Chart(document.getElementById(id).getContext('2d'), { type: 'line', data: { labels: [], datasets: [{ label: 'INDOOR', borderColor: '#f59e0b', backgroundColor: '#f59e0b1A', fill: true, tension: 0.4, data: [] }, { label: 'OUTDOOR', borderColor: '#3b82f6', backgroundColor: '#3b82f61A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    
    compMq135 = cC('chart-mq135'); compMq7 = cC('chart-mq7'); compPm25 = cC('chart-pm25'); compPm10 = cC('chart-pm10');
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
// 5. LISTENER FIREBASE UTAMA (UPDATE UI DASHBOARD & SPEEDO)
// =========================================================================
db.ref('/sensorData').on('value', (snap) => {
    let d = snap.val(); if(!d) return;
    
    let connEl = document.getElementById('conn-status'); let statText = document.getElementById('status-text');
    if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

    const sensors = [
        {k:'mq135_indoor', id:'mq135-in', b:false}, {k:'mq7_indoor', id:'mq7-in', b:false},
        {k:'pm25_indoor', id:'pm25-in', b:true}, {k:'pm10_indoor', id:'pm10-in', b:true},
        {k:'mq135_outdoor', id:'mq135-out', b:false}, {k:'mq7_outdoor', id:'mq7-out', b:false},
        {k:'pm25_outdoor', id:'pm25-out', b:true}, {k:'pm10_outdoor', id:'pm10-out', b:true}
    ];

    sensors.forEach(s => {
        let val = parseFloat(d[s.k] || 0); let st = getISPUStatus(val);
        let sid = s.id, kid = s.k; 
        
        // Update Speedometer UI
        if(document.getElementById(`needle-${sid}`)) document.getElementById(`needle-${sid}`).style.transform = `rotate(${valueToAngle(val)}deg)`;
        if(document.getElementById(`val-${sid}`)) document.getElementById(`val-${sid}`).innerHTML = `${val.toFixed(s.b?0:2)} <span class="speedo-unit">${s.b?'µg/m³':'ppm'}</span>`;
        if(document.getElementById(`emoji-${sid}`)) document.getElementById(`emoji-${sid}`).innerHTML = st.emoji;
        if(document.getElementById(`stat-${sid}`)) { document.getElementById(`stat-${sid}`).innerText = st.text; document.getElementById(`stat-${sid}`).style.color = st.color; }

        // Update Dashboard UI
        if(document.getElementById(`val-${kid}`)) document.getElementById(`val-${kid}`).innerText = val.toFixed(2);
        if(document.getElementById(`stat-${kid}`)) { document.getElementById(`stat-${kid}`).innerHTML = `<div style="font-size:24px; margin-bottom:5px;">${st.emoji}</div><b>${st.text}</b>`; document.getElementById(`stat-${kid}`).style.color = st.color; }
        if(document.getElementById(`card-${kid}`)) document.getElementById(`card-${kid}`).style.borderTop = `4px solid ${st.color}`;
    });

    // Update Live Charts (Indoor & Outdoor)
    if(gasChart && particleChart && gasChartOut && particleChartOut) {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        gasChart.data.labels.push(now); gasChart.data.datasets[0].data.push(parseFloat(d.mq135_indoor||0)); gasChart.data.datasets[1].data.push(parseFloat(d.mq7_indoor||0));
        particleChart.data.labels.push(now); particleChart.data.datasets[0].data.push(parseFloat(d.pm25_indoor||0)); particleChart.data.datasets[1].data.push(parseFloat(d.pm10_indoor||0));
        gasChartOut.data.labels.push(now); gasChartOut.data.datasets[0].data.push(parseFloat(d.mq135_outdoor||0)); gasChartOut.data.datasets[1].data.push(parseFloat(d.mq7_outdoor||0));
        particleChartOut.data.labels.push(now); particleChartOut.data.datasets[0].data.push(parseFloat(d.pm25_outdoor||0)); particleChartOut.data.datasets[1].data.push(parseFloat(d.pm10_outdoor||0));

        if(gasChart.data.labels.length > maxDataPoints) { 
            gasChart.data.labels.shift(); gasChart.data.datasets[0].data.shift(); gasChart.data.datasets[1].data.shift(); 
            particleChart.data.labels.shift(); particleChart.data.datasets[0].data.shift(); particleChart.data.datasets[1].data.shift(); 
            gasChartOut.data.labels.shift(); gasChartOut.data.datasets[0].data.shift(); gasChartOut.data.datasets[1].data.shift(); 
            particleChartOut.data.labels.shift(); particleChartOut.data.datasets[0].data.shift(); particleChartOut.data.datasets[1].data.shift(); 
        }
        gasChart.update('none'); particleChart.update('none'); gasChartOut.update('none'); particleChartOut.update('none');
    }

    // Update Comparison Charts
    if(compMq135) {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const pushC = (ch, vI, vO) => { ch.data.labels.push(now); ch.data.datasets[0].data.push(parseFloat(vI||0)); ch.data.datasets[1].data.push(parseFloat(vO||0)); if(ch.data.labels.length > maxDataPoints){ ch.data.labels.shift(); ch.data.datasets[0].data.shift(); ch.data.datasets[1].data.shift(); } ch.update('none'); };
        pushC(compMq135, d.mq135_indoor, d.mq135_outdoor); pushC(compMq7, d.mq7_indoor, d.mq7_outdoor); pushC(compPm25, d.pm25_indoor, d.pm25_outdoor); pushC(compPm10, d.pm10_indoor, d.pm10_outdoor);
    }
});

// =========================================================================
// 6. HISTORY TABLE & EXCEL (AMAN)
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
