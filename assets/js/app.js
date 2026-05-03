// =========================================================================
// 1. KONFIGURASI FIREBASE
// =========================================================================
const firebaseConfig = { databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let gasChart, particleChart, gasChartOut, particleChartOut; 
let compSuhu, compHum, compNo2, compCo, compPm25, compPm10; 
let maxDataPoints = 15; 
let chartMode = 'live'; 

// =========================================================================
// 2. LOGIKA MATEMATIKA ISPU KLHK & KONVERSI MASSA (NEW)
// =========================================================================
// Konversi PPM ke ug/m3 berdasarkan Berat Molekul (M_w)
function convertToMass(ppm, gasType) {
    if (gasType === 'CO') return ppm * 1145.6; 
    if (gasType === 'NO2') return ppm * 1881.8;
    return ppm; 
}

// Tabel ISPU Resmi [Xb, Xa, Ib, Ia]
const ispuLimits = {
    'PM10': [[0,50,0,50], [51,150,51,100], [151,350,101,200], [351,420,201,300], [421,500,301,500]],
    'PM25': [[0,15.5,0,50], [15.6,55.4,51,100], [55.5,150.4,101,200], [150.5,250.4,201,300], [250.5,500,301,500]],
    'CO':   [[0,4000,0,50], [4001,8000,51,100], [8001,15000,101,200], [15001,30000,201,300], [30001,45000,301,500]],
    'NO2':  [[0,80,0,50], [81,200,51,100], [201,1130,101,200], [1131,2260,201,300], [2261,3000,301,500]]
};

// Rumus Interpolasi ISPU
function calculateISPU(value, type) {
    if (type === 'SUHU' || type === 'HUM') return value; // Suhu/Hum tidak pakai ISPU
    let limits = ispuLimits[type];
    if (!limits) return 0;
    for (let i = 0; i < limits.length; i++) {
        let Xb = limits[i][0], Xa = limits[i][1], Ib = limits[i][2], Ia = limits[i][3];
        if (value >= Xb && value <= Xa) return Math.round(((Ia - Ib) / (Xa - Xb)) * (value - Xb) + Ib);
    }
    return 500; 
}

// Warna Status ISPU
function getISPUStatus(score) {
    if (score <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" }; 
    if (score <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" }; 
    if (score <= 200) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" }; 
    if (score <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" }; 
    return { text: "BERBAHAYA", color: "#000000", emoji: "☠️" }; 
}

// Map Angka ke Jarum Speedometer (Skala 0 - 500 ISPU)
function valueToAngle(val) {
    let v = Math.max(0, Math.min(val, 500));
    if (v <= 50)  return -90 + (v / 50) * 36;
    if (v <= 100) return -54 + ((v - 50) / 50) * 36;
    if (v <= 200) return -18 + ((v - 100) / 100) * 36;
    if (v <= 300) return 18 + ((v - 200) / 100) * 36;
    if (v <= 400) return 54 + ((v - 300) / 100) * 36;
    return 90 + ((v - 400) / 100) * 36;
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

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let time = 0; for (let i=0; i<8; i++) time = time * 64 + PUSH_CHARS.indexOf(id.charAt(i)); return new Date(time);
}

// =========================================================================
// 3. GRAFIK LIVE & HISTORY (SENDER VS RECEIVER)
// =========================================================================
function fetchHistoricalDataForCharts(chartsObj, isDashboard) {
    db.ref('/logs').limitToLast(maxDataPoints).once('value').then(snapshot => {
        snapshot.forEach(child => {
            let d = child.val();
            let timeStr = new Date(getRealTimeFromFirebaseKey(child.key)).toLocaleTimeString('id-ID', { hour12: false });
            
            let no2In = convertToMass(d.no2_indoor||0, 'NO2'), coIn = convertToMass(d.co_indoor||0, 'CO');
            let no2Out = convertToMass(d.no2_outdoor||0, 'NO2'), coOut = convertToMass(d.co_outdoor||0, 'CO');

            if (isDashboard) {
                chartsObj.gas.data.labels.push(timeStr); chartsObj.gas.data.datasets[0].data.push(no2In); chartsObj.gas.data.datasets[1].data.push(coIn);
                chartsObj.part.data.labels.push(timeStr); chartsObj.part.data.datasets[0].data.push(d.pm25_indoor||0); chartsObj.part.data.datasets[1].data.push(d.pm10_indoor||0);
                chartsObj.gasOut.data.labels.push(timeStr); chartsObj.gasOut.data.datasets[0].data.push(no2Out); chartsObj.gasOut.data.datasets[1].data.push(coOut);
                chartsObj.partOut.data.labels.push(timeStr); chartsObj.partOut.data.datasets[0].data.push(d.pm25_outdoor||0); chartsObj.partOut.data.datasets[1].data.push(d.pm10_outdoor||0);
            } else {
                chartsObj.suhu.data.labels.push(timeStr); chartsObj.suhu.data.datasets[0].data.push(d.suhu_indoor||0); chartsObj.suhu.data.datasets[1].data.push(d.suhu_outdoor||0);
                chartsObj.hum.data.labels.push(timeStr); chartsObj.hum.data.datasets[0].data.push(d.hum_indoor||0); chartsObj.hum.data.datasets[1].data.push(d.hum_outdoor||0);
                chartsObj.n2.data.labels.push(timeStr); chartsObj.n2.data.datasets[0].data.push(no2In); chartsObj.n2.data.datasets[1].data.push(no2Out);
                chartsObj.c0.data.labels.push(timeStr); chartsObj.c0.data.datasets[0].data.push(coIn); chartsObj.c0.data.datasets[1].data.push(coOut);
                chartsObj.p25.data.labels.push(timeStr); chartsObj.p25.data.datasets[0].data.push(d.pm25_indoor||0); chartsObj.p25.data.datasets[1].data.push(d.pm25_outdoor||0);
                chartsObj.p10.data.labels.push(timeStr); chartsObj.p10.data.datasets[0].data.push(d.pm10_indoor||0); chartsObj.p10.data.datasets[1].data.push(d.pm10_outdoor||0);
            }
        });
        if(isDashboard) { chartsObj.gas.update(); chartsObj.part.update(); chartsObj.gasOut.update(); chartsObj.partOut.update(); } 
        else { chartsObj.suhu.update(); chartsObj.hum.update(); chartsObj.n2.update(); chartsObj.c0.update(); chartsObj.p25.update(); chartsObj.p10.update(); }
    });
}

function clearCompCharts() {
    [compSuhu, compHum, compNo2, compCo, compPm25, compPm10].forEach(ch => { ch.data.labels=[]; ch.data.datasets[0].data=[]; ch.data.datasets[1].data=[]; });
}

function loadChartDataByRange(startMs, endMs) {
    db.ref('/logs').limitToLast(15000).once('value').then(snap => {
        let filtered = [];
        snap.forEach(child => {
            let t = getRealTimeFromFirebaseKey(child.key);
            if(t >= startMs && t <= endMs) { let d = child.val(); d.waktuAsli = t; filtered.push(d); }
        });
        if(filtered.length === 0) return alert("Data kosong pada rentang waktu yang Anda pilih.");

        let sampled = []; let step = Math.ceil(filtered.length / 50); 
        for(let i=0; i<filtered.length; i+=step) { sampled.push(filtered[i]); }
        
        clearCompCharts();
        sampled.forEach(d => {
            let timeStr = formatWaktuKTI(d.waktuAsli, true, true);
            compSuhu.data.labels.push(timeStr); compSuhu.data.datasets[0].data.push(d.suhu_indoor||0); compSuhu.data.datasets[1].data.push(d.suhu_outdoor||0);
            compHum.data.labels.push(timeStr); compHum.data.datasets[0].data.push(d.hum_indoor||0); compHum.data.datasets[1].data.push(d.hum_outdoor||0);
            compNo2.data.labels.push(timeStr); compNo2.data.datasets[0].data.push(convertToMass(d.no2_indoor||0, 'NO2')); compNo2.data.datasets[1].data.push(convertToMass(d.no2_outdoor||0, 'NO2'));
            compCo.data.labels.push(timeStr); compCo.data.datasets[0].data.push(convertToMass(d.co_indoor||0, 'CO')); compCo.data.datasets[1].data.push(convertToMass(d.co_outdoor||0, 'CO'));
            compPm25.data.labels.push(timeStr); compPm25.data.datasets[0].data.push(d.pm25_indoor||0); compPm25.data.datasets[1].data.push(d.pm25_outdoor||0);
            compPm10.data.labels.push(timeStr); compPm10.data.datasets[0].data.push(d.pm10_indoor||0); compPm10.data.datasets[1].data.push(d.pm10_outdoor||0);
        });
        compSuhu.update(); compHum.update(); compNo2.update(); compCo.update(); compPm25.update(); compPm10.update();
        alert(`Grafik diperbarui. Menampilkan sampel dari rentang waktu yang dipilih.`);
    });
}

function changeChartMode() {
    let val = document.getElementById('chart-time-filter').value;
    let customCtrl = document.getElementById('custom-chart-controls');
    if(val === 'custom') { customCtrl.style.display = 'flex'; } 
    else {
        customCtrl.style.display = 'none';
        if(val === 'live') { chartMode = 'live'; clearCompCharts(); alert("Beralih ke mode Live"); } 
        else if(val === '24h') {
            chartMode = 'history';
            let end = new Date(); let start = new Date(end.getTime() - 24*60*60*1000);
            loadChartDataByRange(start, end);
        }
    }
}

function applyCustomChart() {
    let s = document.getElementById('chart-start').value; let e = document.getElementById('chart-end').value;
    if(!s || !e) return alert("Pilih tanggal dan jam Mulai & Selesai terlebih dahulu!");
    chartMode = 'history'; loadChartDataByRange(new Date(s), new Date(e));
}

function initDashboardCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#64748b';
    const cnf = (l1, c1, l2, c2) => ({ type: 'line', data: { labels: [], datasets: [{ label: l1, borderColor: c1, backgroundColor: c1+'1A', fill: true, tension: 0.4, data: [] }, { label: l2, borderColor: c2, backgroundColor: c2+'1A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    
    gasChart = new Chart(document.getElementById('gasChart').getContext('2d'), cnf('NO2', '#f59e0b', 'CO', '#ef4444'));
    particleChart = new Chart(document.getElementById('particleChart').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));
    gasChartOut = new Chart(document.getElementById('gasChartOut').getContext('2d'), cnf('NO2', '#f59e0b', 'CO', '#ef4444'));
    particleChartOut = new Chart(document.getElementById('particleChartOut').getContext('2d'), cnf('PM 2.5', '#10b981', 'PM 10', '#3b82f6'));

    fetchHistoricalDataForCharts({gas: gasChart, part: particleChart, gasOut: gasChartOut, partOut: particleChartOut}, true);
}

function initComparisonCharts() {
    if (typeof Chart === 'undefined') return; Chart.defaults.color = '#64748b';
    const cC = (id) => new Chart(document.getElementById(id).getContext('2d'), { type: 'line', data: { labels: [], datasets: [{ label: 'RECEIVER', borderColor: '#f59e0b', backgroundColor: '#f59e0b1A', fill: true, tension: 0.4, data: [] }, { label: 'SENDER', borderColor: '#3b82f6', backgroundColor: '#3b82f61A', fill: true, tension: 0.4, data: [] }]}, options: { responsive: true, maintainAspectRatio: false } });
    
    compSuhu = cC('chart-suhu'); compHum = cC('chart-hum'); compNo2 = cC('chart-no2'); compCo = cC('chart-co'); compPm25 = cC('chart-pm25'); compPm10 = cC('chart-pm10');
    fetchHistoricalDataForCharts({suhu: compSuhu, hum: compHum, n2: compNo2, c0: compCo, p25: compPm25, p10: compPm10}, false);

    let filterEl = document.getElementById('chart-time-filter');
    if(filterEl) {
        filterEl.addEventListener('change', (e) => {
            maxDataPoints = parseInt(e.target.value);
            [compSuhu, compHum, compNo2, compCo, compPm25, compPm10].forEach(ch => { ch.data.labels=[]; ch.data.datasets[0].data=[]; ch.data.datasets[1].data=[]; });
            fetchHistoricalDataForCharts({suhu: compSuhu, hum: compHum, n2: compNo2, c0: compCo, p25: compPm25, p10: compPm10}, false);
        });
    }
}

// =========================================================================
// 4. LISTENER DATA REALTIME (Update Speedo & Dashboard)
// =========================================================================
db.ref('/sensorData').on('value', (snap) => {
    let d = snap.val(); if(!d) return;
    
    let connEl = document.getElementById('conn-status'); let statText = document.getElementById('status-text');
    if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

    // Update Suhu & Kelembaban (Atas Dashboard)
    if(document.getElementById('val-suhu-recv')) document.getElementById('val-suhu-recv').innerText = (d.suhu_indoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-recv')) document.getElementById('val-hum-recv').innerText = (d.hum_indoor||0).toFixed(1) + " %";
    if(document.getElementById('val-suhu-send')) document.getElementById('val-suhu-send').innerText = (d.suhu_outdoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-send')) document.getElementById('val-hum-send').innerText = (d.hum_outdoor||0).toFixed(1) + " %";

    // Konversi gas ke ug/m3
    let massData = {
        no2_in: convertToMass(d.no2_indoor||0, 'NO2'), co_in: convertToMass(d.co_indoor||0, 'CO'),
        pm25_in: d.pm25_indoor||0, pm10_in: d.pm10_indoor||0,
        no2_out: convertToMass(d.no2_outdoor||0, 'NO2'), co_out: convertToMass(d.co_outdoor||0, 'CO'),
        pm25_out: d.pm25_outdoor||0, pm10_out: d.pm10_outdoor||0
    };

    const sensors = [
        {val: massData.no2_in, id:'no2-recv', type:'NO2'}, {val: massData.co_in, id:'co-recv', type:'CO'},
        {val: massData.pm25_in, id:'pm25-recv', type:'PM25'}, {val: massData.pm10_in, id:'pm10-recv', type:'PM10'},
        {val: massData.no2_out, id:'no2-send', type:'NO2'}, {val: massData.co_out, id:'co-send', type:'CO'},
        {val: massData.pm25_out, id:'pm25-send', type:'PM25'}, {val: massData.pm10_out, id:'pm10-send', type:'PM10'},
        // Speedo Khusus Cuaca
        {val: d.suhu_indoor||0, id:'suhu-recv', type:'SUHU'}, {val: d.hum_indoor||0, id:'hum-recv', type:'HUM'},
        {val: d.suhu_outdoor||0, id:'suhu-send', type:'SUHU'}, {val: d.hum_outdoor||0, id:'hum-send', type:'HUM'}
    ];

    sensors.forEach(s => {
        let ispuScore = calculateISPU(s.val, s.type);
        let st = s.type === 'SUHU' || s.type === 'HUM' ? { text: "INFO", color: "#3b82f6", emoji: "🌡️" } : getISPUStatus(ispuScore);

        // Update Speedometer UI (Jarum berputar sesuai Score ISPU, bukan raw value)
        if(document.getElementById(`needle-${s.id}`)) document.getElementById(`needle-${s.id}`).style.transform = `rotate(${valueToAngle(ispuScore)}deg)`;
        if(document.getElementById(`val-${s.id}`)) document.getElementById(`val-${s.id}`).innerHTML = `${s.val.toFixed(1)}`;
        if(document.getElementById(`stat-${s.id}`)) { document.getElementById(`stat-${s.id}`).innerText = s.type === 'SUHU' || s.type === 'HUM' ? 'INFO CUACA' : `ISPU: ${ispuScore} (${st.text})`; document.getElementById(`stat-${s.id}`).style.color = st.color; }

        // Update Dashboard Cards
        if(document.getElementById(`val-${s.id}`)) document.getElementById(`val-${s.id}`).innerText = s.val.toFixed(1);
        if(document.getElementById(`stat-${s.id}`) && document.getElementById(`card-${s.id}`)) { 
            document.getElementById(`stat-${s.id}`).innerText = st.text; 
            document.getElementById(`stat-${s.id}`).style.color = st.color;
            document.getElementById(`emo-${s.id}`).innerText = st.emoji;
            document.getElementById(`card-${s.id}`).style.borderTopColor = st.color; 
        }
    });

    // Update Live Charts (Hanya berjalan di index.html)
    if(gasChart && particleChart && gasChartOut && particleChartOut) {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        gasChart.data.labels.push(now); gasChart.data.datasets[0].data.push(massData.no2_in); gasChart.data.datasets[1].data.push(massData.co_in);
        particleChart.data.labels.push(now); particleChart.data.datasets[0].data.push(massData.pm25_in); particleChart.data.datasets[1].data.push(massData.pm10_in);
        gasChartOut.data.labels.push(now); gasChartOut.data.datasets[0].data.push(massData.no2_out); gasChartOut.data.datasets[1].data.push(massData.co_out);
        particleChartOut.data.labels.push(now); particleChartOut.data.datasets[0].data.push(massData.pm25_out); particleChartOut.data.datasets[1].data.push(massData.pm10_out);

        if(gasChart.data.labels.length > maxDataPoints) { 
            gasChart.data.labels.shift(); gasChart.data.datasets[0].data.shift(); gasChart.data.datasets[1].data.shift(); 
            particleChart.data.labels.shift(); particleChart.data.datasets[0].data.shift(); particleChart.data.datasets[1].data.shift(); 
            gasChartOut.data.labels.shift(); gasChartOut.data.datasets[0].data.shift(); gasChartOut.data.datasets[1].data.shift(); 
            particleChartOut.data.labels.shift(); particleChartOut.data.datasets[0].data.shift(); particleChartOut.data.datasets[1].data.shift(); 
        }
        gasChart.update('none'); particleChart.update('none'); gasChartOut.update('none'); particleChartOut.update('none');
    }

    // Update Comparison Charts (Hanya berjalan di grafik.html saat mode live)
    if(compNo2 && chartMode === 'live') {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const pushC = (ch, vI, vO) => { ch.data.labels.push(now); ch.data.datasets[0].data.push(vI); ch.data.datasets[1].data.push(vO); if(ch.data.labels.length > maxDataPoints){ ch.data.labels.shift(); ch.data.datasets[0].data.shift(); ch.data.datasets[1].data.shift(); } ch.update('none'); };
        pushC(compSuhu, d.suhu_indoor, d.suhu_outdoor); pushC(compHum, d.hum_indoor, d.hum_outdoor);
        pushC(compNo2, massData.no2_in, massData.no2_out); pushC(compCo, massData.co_in, massData.co_out); 
        pushC(compPm25, massData.pm25_in, massData.pm25_out); pushC(compPm10, massData.pm10_in, massData.pm10_out);
    }
});

// =========================================================================
// 5. LOGIKA EXCEL DOWNLOAD CANGGIH (RAW, HOURLY, DAILY) & HISTORY TABLE
// =========================================================================
function initHistoryTable() {
    let tbody = document.getElementById('history-table-body'); if (!tbody) return; 
    db.ref('/logs').limitToLast(10).on('value', (s) => {
        tbody.innerHTML = ''; if (!s.exists()) { tbody.innerHTML = '<tr><td colspan="13">Belum ada data.</td></tr>'; return; }
        let rowsHTML = []; s.forEach(child => {
            let r = child.val(); let date = formatWaktuKTI(getRealTimeFromFirebaseKey(child.key));
            let no2In = convertToMass(r.no2_indoor||0, 'NO2'), coIn = convertToMass(r.co_indoor||0, 'CO');
            let no2Out = convertToMass(r.no2_outdoor||0, 'NO2'), coOut = convertToMass(r.co_outdoor||0, 'CO');
            
            rowsHTML.unshift(`<tr><td>${date}</td>
            <td style="background:#e2e8f0;font-weight:bold;">${(r.suhu_indoor||0).toFixed(1)}</td><td>${(r.hum_indoor||0).toFixed(1)}</td><td>${no2In.toFixed(1)}</td><td>${coIn.toFixed(1)}</td><td>${r.pm25_indoor||0}</td><td>${r.pm10_indoor||0}</td>
            <td style="background:#e2e8f0;font-weight:bold;">${(r.suhu_outdoor||0).toFixed(1)}</td><td>${(r.hum_outdoor||0).toFixed(1)}</td><td>${no2Out.toFixed(1)}</td><td>${coOut.toFixed(1)}</td><td>${r.pm25_outdoor||0}</td><td>${r.pm10_outdoor||0}</td></tr>`);
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
                "Recv Suhu": +(parseFloat(r.suhu_indoor||0).toFixed(1)), "Recv Hum": +(parseFloat(r.hum_indoor||0).toFixed(1)),
                "Recv NO2": +(convertToMass(r.no2_indoor||0, 'NO2').toFixed(1)), "Recv CO": +(convertToMass(r.co_indoor||0, 'CO').toFixed(1)), 
                "Recv PM2.5": +(parseFloat(r.pm25_indoor||0).toFixed(1)), "Recv PM10": +(parseFloat(r.pm10_indoor||0).toFixed(1)), 
                "Send Suhu": +(parseFloat(r.suhu_outdoor||0).toFixed(1)), "Send Hum": +(parseFloat(r.hum_outdoor||0).toFixed(1)),
                "Send NO2": +(convertToMass(r.no2_outdoor||0, 'NO2').toFixed(1)), "Send CO": +(convertToMass(r.co_outdoor||0, 'CO').toFixed(1)), 
                "Send PM2.5": +(parseFloat(r.pm25_outdoor||0).toFixed(1)), "Send PM10": +(parseFloat(r.pm10_outdoor||0).toFixed(1)) 
            }));
        } else {
            // Rata-rata: hourly (per jam), daily (per hari)
            let gw = {};
            dm.forEach(r => { 
                let t = r.wAsli;
                let lbl = format === 'hourly' ? formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), 0, 0)) : formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate()), true, false);
                
                if(!gw[lbl]) gw[lbl]={c:0,si:0,hi:0,n2i:0,c0i:0,p2i:0,p1i:0,so:0,ho:0,n2o:0,c0o:0,p2o:0,p1o:0};
                gw[lbl].c++; 
                gw[lbl].si+=parseFloat(r.suhu_indoor||0); gw[lbl].hi+=parseFloat(r.hum_indoor||0);
                gw[lbl].n2i+=convertToMass(r.no2_indoor||0, 'NO2'); gw[lbl].c0i+=convertToMass(r.co_indoor||0, 'CO'); 
                gw[lbl].p2i+=parseFloat(r.pm25_indoor||0); gw[lbl].p1i+=parseFloat(r.pm10_indoor||0); 
                gw[lbl].so+=parseFloat(r.suhu_outdoor||0); gw[lbl].ho+=parseFloat(r.hum_outdoor||0);
                gw[lbl].n2o+=convertToMass(r.no2_outdoor||0, 'NO2'); gw[lbl].c0o+=convertToMass(r.co_outdoor||0, 'CO'); 
                gw[lbl].p2o+=parseFloat(r.pm25_outdoor||0); gw[lbl].p1o+=parseFloat(r.pm10_outdoor||0);
            });

            for (let w in gw) { 
                let g=gw[w]; let c=g.c; 
                dx.push({
                    "Rentang Waktu": w, "Total Sampel": c, 
                    "Avg Recv Suhu": +(g.si/c).toFixed(1), "Avg Recv Hum": +(g.hi/c).toFixed(1),
                    "Avg Recv NO2": +(g.n2i/c).toFixed(1), "Avg Recv CO": +(g.c0i/c).toFixed(1), 
                    "Avg Recv PM2.5": +(g.p2i/c).toFixed(1), "Avg Recv PM10": +(g.p1i/c).toFixed(1), 
                    "Avg Send Suhu": +(g.so/c).toFixed(1), "Avg Send Hum": +(g.ho/c).toFixed(1),
                    "Avg Send NO2": +(g.n2o/c).toFixed(1), "Avg Send CO": +(g.c0o/c).toFixed(1), 
                    "Avg Send PM2.5": +(g.p2o/c).toFixed(1), "Avg Send PM10": +(g.p1o/c).toFixed(1)
                }); 
            }
        }

        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Data_KTI_Penelitian"); 
        XLSX.writeFile(wb, `Data_AirQuality_${format}_${Date.now()}.xlsx`);
    });
}

// =========================================================================
// Inisialisasi Otomatis Saat Halaman Dimuat
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('gasChart')) initDashboardCharts();
    if(document.getElementById('chart-mq135') || document.getElementById('chart-no2')) initComparisonCharts();
    if(document.getElementById('history-table-body')) initHistoryTable();
});
