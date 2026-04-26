// =========================================================================
// 1. KONFIGURASI FIREBASE
// =========================================================================
const firebaseConfig = { databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let gasChart, particleChart, gasChartOut, particleChartOut; 
let compMq135, compMq7, compPm25, compPm10; 
let maxDataPoints = 15; 
let chartMode = 'live'; 

// =========================================================================
// 2. INISIALISASI & KONTROL
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
    if (sessionStorage.getItem("isAdmin") === "true") {
        sessionStorage.removeItem("isAdmin"); location.reload();
    } else if (prompt("Masukkan Password Admin:") === "hafidz123") {
        sessionStorage.setItem("isAdmin", "true"); location.reload();
    } else { alert("Password Salah!"); }
}
function setAlat(status) { db.ref('/kontrol/sistem').set(status); }

db.ref('/kontrol/sistem').on('value', (snap) => {
    let stat = snap.val(); let el = document.getElementById('status-sistem');
    if(el) {
        el.innerHTML = stat === 'START' ? `<i class="fa-solid fa-satellite-dish"></i> Status: AKTIF (START)` : `<i class="fa-solid fa-satellite-dish"></i> Status: MATI (STOP)`;
        el.style.background = stat === 'START' ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"; el.style.color = stat === 'START' ? "#10b981" : "#ef4444";
    }
});

// =========================================================================
// 3. LOGIKA ISPU & SPEEDO
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

// FORMAT WAKTU CANGGIH UNTUK GRAFIK & EXCEL
function formatWaktuKTI(date, includeDate = true, includeTime = true) {
    let d = date.getDate().toString().padStart(2,'0');
    let m = (date.getMonth()+1).toString().padStart(2,'0');
    let y = date.getFullYear();
    let h = date.getHours().toString().padStart(2,'0');
    let min = date.getMinutes().toString().padStart(2,'0');
    
    if(includeDate && includeTime) return `${d}/${m}/${y} ${h}:${min}`;
    if(includeDate && !includeTime) return `${d}/${m}/${y}`;
    if(!includeDate && includeTime) return `${h}:${min}`;
}

// =========================================================================
// 4. GRAFIK LIVE & HISTORY (SENDER VS RECEIVER)
// =========================================================================
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0; for (let i=0; i<8; i++) time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i)); return new Date(time);
}

function clearCompCharts() {
    [compMq135, compMq7, compPm25, compPm10].forEach(ch => { ch.data.labels=[]; ch.data.datasets[0].data=[]; ch.data.datasets[1].data=[]; });
}

function loadChartDataByRange(startMs, endMs) {
    db.ref('/logs').limitToLast(15000).once('value').then(snap => {
        let filtered = [];
        snap.forEach(child => {
            let t = getRealTimeFromFirebaseKey(child.key);
            if(t >= startMs && t <= endMs) {
                let d = child.val(); d.waktuAsli = t; filtered.push(d);
            }
        });
        
        if(filtered.length === 0) return alert("Data kosong pada rentang waktu yang Anda pilih.");

        // Downsampling agar browser tidak lag jika data terlalu banyak
        let sampled = [];
        let step = Math.ceil(filtered.length / 50); 
        for(let i=0; i<filtered.length; i+=step) { sampled.push(filtered[i]); }
        
        clearCompCharts();
        sampled.forEach(d => {
            // Tampilkan Tanggal dan Jam di Grafik
            let timeStr = formatWaktuKTI(d.waktuAsli, true, true);
            compMq135.data.labels.push(timeStr); compMq135.data.datasets[0].data.push(parseFloat(d.mq135_indoor||0)); compMq135.data.datasets[1].data.push(parseFloat(d.mq135_outdoor||0));
            compMq7.data.labels.push(timeStr); compMq7.data.datasets[0].data.push(parseFloat(d.mq7_indoor||0)); compMq7.data.datasets[1].data.push(parseFloat(d.mq7_outdoor||0));
            compPm25.data.labels.push(timeStr); compPm25.data.datasets[0].data.push(parseFloat(d.pm25_indoor||0)); compPm25.data.datasets[1].data.push(parseFloat(d.pm25_outdoor||0));
            compPm10.data.labels.push(timeStr); compPm10.data.datasets[0].data.push(parseFloat(d.pm10_indoor||0)); compPm10.data.datasets[1].data.push(parseFloat(d.pm10_outdoor||0));
        });
        compMq135.update(); compMq7.update(); compPm25.update(); compPm10.update();
        alert(`Grafik diperbarui. Menampilkan sampel dari rentang waktu yang dipilih.`);
    });
}

function changeChartMode() {
    let val = document.getElementById('chart-time-filter').value;
    let customCtrl = document.getElementById('custom-chart-controls');
    
    if(val === 'custom') {
        customCtrl.style.display = 'flex';
    } else {
        customCtrl.style.display = 'none';
        if(val === 'live') {
            chartMode = 'live'; clearCompCharts(); alert("Beralih ke mode Live");
        } else if(val === '24h') {
            chartMode = 'history';
            let end = new Date(); let start = new Date(end.getTime() - 24*60*60*1000);
            loadChartDataByRange(start, end);
        }
    }
}

function applyCustomChart() {
    let s = document.getElementById('chart-start').value;
    let e = document.getElementById('chart-end').value;
    if(!s || !e) return alert("Pilih tanggal dan jam Mulai & Selesai terlebih dahulu!");
    chartMode = 'history';
    loadChartDataByRange(new Date(s), new Date(e));
}

function initDashboardCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#cbd5e1';
    const cnf = (l1, c1, l2, c2) => ({ type: 'line', data: { labels: [], datasets: [{ label: l1, borderColor: c1, backgroundColor: c1+'1A', fill: true, tension: 0.4, data: [] }, { label: l2, borderColor: c2, backgroundColor: c2+'1A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    gasChart = new Chart(document.getElementById('gasChart').getContext('2d'), cnf('MQ-135', '#f59e0b', 'MQ-7', '#ef4444'));
    particleChart = new Chart(document.getElementById('particleChart').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));
    gasChartOut = new Chart(document.getElementById('gasChartOut').getContext('2d'), cnf('MQ-135', '#f59e0b', 'MQ-7', '#ef4444'));
    particleChartOut = new Chart(document.getElementById('particleChartOut').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));
}

function initComparisonCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#cbd5e1';
    const cC = (id) => new Chart(document.getElementById(id).getContext('2d'), { type: 'line', data: { labels: [], datasets: [{ label: 'RECEIVER', borderColor: '#f59e0b', backgroundColor: '#f59e0b1A', fill: true, tension: 0.4, data: [] }, { label: 'SENDER', borderColor: '#3b82f6', backgroundColor: '#3b82f61A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    compMq135 = cC('chart-mq135'); compMq7 = cC('chart-mq7'); compPm25 = cC('chart-pm25'); compPm10 = cC('chart-pm10');
}

// =========================================================================
// 5. LISTENER DATA REALTIME (Update Speedo & Dashboard)
// =========================================================================
db.ref('/sensorData').on('value', (snap) => {
    let d = snap.val(); if(!d) return;
    let connEl = document.getElementById('conn-status'); let statText = document.getElementById('status-text');
    if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

    // Map Kunci Firebase ke ID HTML (UI text Sender/Receiver sudah diatur di HTML)
    const sensors = [
        {k:'mq135_indoor', id:'mq135-recv', b:false}, {k:'mq7_indoor', id:'mq7-recv', b:false},
        {k:'pm25_indoor', id:'pm25-recv', b:true}, {k:'pm10_indoor', id:'pm10-recv', b:true},
        {k:'mq135_outdoor', id:'mq135-send', b:false}, {k:'mq7_outdoor', id:'mq7-send', b:false},
        {k:'pm25_outdoor', id:'pm25-send', b:true}, {k:'pm10_outdoor', id:'pm10-send', b:true}
    ];

    sensors.forEach(s => {
        let val = parseFloat(d[s.k] || 0); let st = getISPUStatus(val); let sid = s.id, kid = s.id; 
        
        if(document.getElementById(`needle-${sid}`)) document.getElementById(`needle-${sid}`).style.transform = `rotate(${valueToAngle(val)}deg)`;
        if(document.getElementById(`val-${sid}`)) document.getElementById(`val-${sid}`).innerHTML = `${val.toFixed(s.b?0:2)} <span class="speedo-unit">${s.b?'µg/m³':'ppm'}</span>`;
        if(document.getElementById(`emoji-${sid}`)) document.getElementById(`emoji-${sid}`).innerHTML = st.emoji;
        if(document.getElementById(`stat-${sid}`)) { document.getElementById(`stat-${sid}`).innerText = st.text; document.getElementById(`stat-${sid}`).style.color = st.color; }
        
        if(document.getElementById(`val-${kid}`)) document.getElementById(`val-${kid}`).innerText = val.toFixed(2);
        if(document.getElementById(`stat-${kid}`)) { document.getElementById(`stat-${kid}`).innerHTML = `<div style="font-size:24px; margin-bottom:5px;">${st.emoji}</div><b>${st.text}</b>`; document.getElementById(`stat-${kid}`).style.color = st.color; }
        if(document.getElementById(`card-${kid}`)) document.getElementById(`card-${kid}`).style.borderTop = `4px solid ${st.color}`;
    });

    let now = formatWaktuKTI(new Date(), false, true); // Menit:Jam untuk Live

    if(gasChart && particleChart && gasChartOut && particleChartOut) {
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

    if(compMq135 && chartMode === 'live') {
        const pushC = (ch, vI, vO) => { ch.data.labels.push(now); ch.data.datasets[0].data.push(parseFloat(vI||0)); ch.data.datasets[1].data.push(parseFloat(vO||0)); if(ch.data.labels.length > maxDataPoints){ ch.data.labels.shift(); ch.data.datasets[0].data.shift(); ch.data.datasets[1].data.shift(); } ch.update('none'); };
        pushC(compMq135, d.mq135_indoor, d.mq135_outdoor); pushC(compMq7, d.mq7_indoor, d.mq7_outdoor); pushC(compPm25, d.pm25_indoor, d.pm25_outdoor); pushC(compPm10, d.pm10_indoor, d.pm10_outdoor);
    }
});

// =========================================================================
// 6. LOGIKA EXCEL DOWNLOAD CANGGIH (RAW, HOURLY, DAILY)
// =========================================================================
function initHistoryTable() {
    let tbody = document.getElementById('history-table-body'); if (!tbody) return; 
    db.ref('/logs').limitToLast(10).on('value', (s) => {
        tbody.innerHTML = ''; if (!s.exists()) { tbody.innerHTML = '<tr><td colspan="9">Belum ada data.</td></tr>'; return; }
        let rowsHTML = []; s.forEach(child => {
            let r = child.val(); let date = formatWaktuKTI(getRealTimeFromFirebaseKey(child.key));
            rowsHTML.unshift(`<tr><td>${date}</td><td>${parseFloat(r.mq135_indoor||0).toFixed(1)}</td><td>${parseFloat(r.mq7_indoor||0).toFixed(1)}</td><td>${r.pm25_indoor||0}</td><td>${r.pm10_indoor||0}</td><td>${parseFloat(r.mq135_outdoor||0).toFixed(1)}</td><td>${parseFloat(r.mq7_outdoor||0).toFixed(1)}</td><td>${r.pm25_outdoor||0}</td><td>${r.pm10_outdoor||0}</td></tr>`);
        }); tbody.innerHTML = rowsHTML.join('');
    });
}

function processDownload() {
    let sVal = document.getElementById('hist-start').value;
    let eVal = document.getElementById('hist-end').value;
    let format = document.getElementById('hist-format').value;

    if(!sVal || !eVal) return alert("Mohon isi Waktu Mulai dan Waktu Selesai terlebih dahulu!");
    
    let start = new Date(sVal); 
    let end = new Date(eVal);
    if(start >= end) return alert("Waktu Mulai harus lebih awal dari waktu Selesai!");

    alert("Mengekstrak data dari database... Proses ini butuh waktu beberapa detik.");
    
    db.ref('/logs').limitToLast(30000).once('value').then(snapshot => {
        let dm = []; 
        snapshot.forEach(child => { 
            let t = getRealTimeFromFirebaseKey(child.key); 
            if(t >= start && t <= end) {
                let r = child.val(); r.wAsli = t; dm.push(r);
            }
        });
        
        if(dm.length === 0) return alert("Tidak ada data ditemukan pada rentang waktu tersebut!");

        let dx = [];
        if (format === 'raw') {
            dx = dm.map(r => ({ 
                "Waktu (WIB)": formatWaktuKTI(r.wAsli), 
                "Receiver MQ-135": +(parseFloat(r.mq135_indoor||0).toFixed(2)), "Receiver MQ-7": +(parseFloat(r.mq7_indoor||0).toFixed(2)), 
                "Receiver PM2.5": +(parseFloat(r.pm25_indoor||0).toFixed(1)), "Receiver PM10": +(parseFloat(r.pm10_indoor||0).toFixed(1)), 
                "Sender MQ-135": +(parseFloat(r.mq135_outdoor||0).toFixed(2)), "Sender MQ-7": +(parseFloat(r.mq7_outdoor||0).toFixed(2)), 
                "Sender PM2.5": +(parseFloat(r.pm25_outdoor||0).toFixed(1)), "Sender PM10": +(parseFloat(r.pm10_outdoor||0).toFixed(1)) 
            }));
        } else {
            // Rata-rata: hourly (per jam), daily (per hari)
            let gw = {};
            dm.forEach(r => { 
                let t = r.wAsli;
                let lbl = format === 'hourly' ? formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), 0, 0)) : formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate()), true, false);
                
                if(!gw[lbl]) gw[lbl]={c:0,m1i:0,m7i:0,p2i:0,p1i:0,m1o:0,m7o:0,p2o:0,p1o:0};
                gw[lbl].c++; 
                gw[lbl].m1i+=parseFloat(r.mq135_indoor||0); gw[lbl].m7i+=parseFloat(r.mq7_indoor||0); gw[lbl].p2i+=parseFloat(r.pm25_indoor||0); gw[lbl].p1i+=parseFloat(r.pm10_indoor||0); 
                gw[lbl].m1o+=parseFloat(r.mq135_outdoor||0); gw[lbl].m7o+=parseFloat(r.mq7_outdoor||0); gw[lbl].p2o+=parseFloat(r.pm25_outdoor||0); gw[lbl].p1o+=parseFloat(r.pm10_outdoor||0);
            });

            for (let w in gw) { 
                let g=gw[w]; let c=g.c; 
                dx.push({
                    "Rentang Waktu": w, "Total Sampel": c, 
                    "Rata-rata Recv MQ-135": +(g.m1i/c).toFixed(2), "Rata-rata Recv MQ-7": +(g.m7i/c).toFixed(2), 
                    "Rata-rata Recv PM2.5": +(g.p2i/c).toFixed(1), "Rata-rata Recv PM10": +(g.p1i/c).toFixed(1), 
                    "Rata-rata Send MQ-135": +(g.m1o/c).toFixed(2), "Rata-rata Send MQ-7": +(g.m7o/c).toFixed(2), 
                    "Rata-rata Send PM2.5": +(g.p2o/c).toFixed(1), "Rata-rata Send PM10": +(g.p1o/c).toFixed(1)
                }); 
            }
        }

        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Data_KTI_Penelitian"); 
        XLSX.writeFile(wb, `Data_AirQuality_${format}_${Date.now()}.xlsx`);
    });
}
