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
// 2. LOGIKA MATEMATIKA ISPU & MASSA 
// =========================================================================
function convertToMass(ppm, gasType) {
    if (gasType === 'CO') return ppm * 1145.6; 
    if (gasType === 'NO2') return ppm * 1881.8;
    return ppm; 
}

const ispuLimits = {
    'PM10': [[0,50,0,50], [51,150,51,100], [151,350,101,200], [351,420,201,300], [421,500,301,500]],
    'PM25': [[0,15.5,0,50], [15.6,55.4,51,100], [55.5,150.4,101,200], [150.5,250.4,201,300], [250.5,500,301,500]],
    'CO':   [[0,4000,0,50], [4001,8000,51,100], [8001,15000,101,200], [15001,30000,201,300], [30001,45000,301,500]],
    'NO2':  [[0,80,0,50], [81,200,51,100], [201,1130,101,200], [1131,2260,201,300], [2261,3000,301,500]]
};

function calculateISPU(value, type) {
    if (type === 'SUHU' || type === 'HUM') return value; 
    let limits = ispuLimits[type];
    if (!limits) return 0;
    for (let i = 0; i < limits.length; i++) {
        let Xb = limits[i][0], Xa = limits[i][1], Ib = limits[i][2], Ia = limits[i][3];
        if (value >= Xb && value <= Xa) return Math.round(((Ia - Ib) / (Xa - Xb)) * (value - Xb) + Ib);
    }
    return 500; 
}

function getISPUStatus(score) {
    if (score <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" }; 
    if (score <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" }; 
    if (score <= 200) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" }; 
    if (score <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" }; 
    return { text: "BERBAHAYA", color: "#000000", emoji: "☠️" }; 
}

function valueToAngle(val) {
    let v = Math.max(0, Math.min(val, 500));
    if (v <= 50) return -90 + (v/50)*36;
    if (v <= 100) return -54 + ((v-50)/50)*36;
    if (v <= 200) return -18 + ((v-100)/100)*36;
    if (v <= 300) return 18 + ((v-200)/100)*36;
    if (v <= 400) return 54 + ((v-300)/100)*36;
    return 90 + ((v-400)/100)*36;
}

function formatWaktuKTI(date, inclDate = true, inclTime = true) {
    let d = date.getDate().toString().padStart(2,'0'), m = (date.getMonth()+1).toString().padStart(2,'0'), y = date.getFullYear();
    let h = date.getHours().toString().padStart(2,'0'), min = date.getMinutes().toString().padStart(2,'0');
    if(inclDate && inclTime) return `${d}/${m}/${y} ${h}:${min}`;
    if(inclDate && !inclTime) return `${d}/${m}/${y}`;
    return `${h}:${min}`;
}

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getRealTimeFromFirebaseKey(id) {
    let t = 0; for (let i=0; i<8; i++) t = t * 64 + PUSH_CHARS.indexOf(id.charAt(i)); return new Date(t);
}

// =========================================================================
// 3. GRAFIK KOMPARASI (Custom Time Filter)
// =========================================================================
function fetchHistoricalDataForCharts(chartsObj, isDashboard) {
    db.ref('/logs').limitToLast(maxDataPoints).once('value').then(snap => {
        snap.forEach(child => {
            let d = child.val();
            let tStr = new Date(getRealTimeFromFirebaseKey(child.key)).toLocaleTimeString('id-ID', { hour12: false });
            let n2i = convertToMass(d.no2_indoor||0,'NO2'), c0i = convertToMass(d.co_indoor||0,'CO');
            let n2o = convertToMass(d.no2_outdoor||0,'NO2'), c0o = convertToMass(d.co_outdoor||0,'CO');

            if (isDashboard) {
                chartsObj.gas.data.labels.push(tStr); chartsObj.gas.data.datasets[0].data.push(n2i); chartsObj.gas.data.datasets[1].data.push(c0i);
                chartsObj.part.data.labels.push(tStr); chartsObj.part.data.datasets[0].data.push(d.pm25_indoor||0); chartsObj.part.data.datasets[1].data.push(d.pm10_indoor||0);
                chartsObj.gasOut.data.labels.push(tStr); chartsObj.gasOut.data.datasets[0].data.push(n2o); chartsObj.gasOut.data.datasets[1].data.push(c0o);
                chartsObj.partOut.data.labels.push(tStr); chartsObj.partOut.data.datasets[0].data.push(d.pm25_outdoor||0); chartsObj.partOut.data.datasets[1].data.push(d.pm10_outdoor||0);
            } else {
                chartsObj.suhu.data.labels.push(tStr); chartsObj.suhu.data.datasets[0].data.push(d.suhu_indoor||0); chartsObj.suhu.data.datasets[1].data.push(d.suhu_outdoor||0);
                chartsObj.hum.data.labels.push(tStr); chartsObj.hum.data.datasets[0].data.push(d.hum_indoor||0); chartsObj.hum.data.datasets[1].data.push(d.hum_outdoor||0);
                chartsObj.n2.data.labels.push(tStr); chartsObj.n2.data.datasets[0].data.push(n2i); chartsObj.n2.data.datasets[1].data.push(n2o);
                chartsObj.c0.data.labels.push(tStr); chartsObj.c0.data.datasets[0].data.push(c0i); chartsObj.c0.data.datasets[1].data.push(c0o);
                chartsObj.p25.data.labels.push(tStr); chartsObj.p25.data.datasets[0].data.push(d.pm25_indoor||0); chartsObj.p25.data.datasets[1].data.push(d.pm25_outdoor||0);
                chartsObj.p10.data.labels.push(tStr); chartsObj.p10.data.datasets[0].data.push(d.pm10_indoor||0); chartsObj.p10.data.datasets[1].data.push(d.pm10_outdoor||0);
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
        let filtered = []; snap.forEach(c => { let t=getRealTimeFromFirebaseKey(c.key); if(t>=startMs && t<=endMs){ let d=c.val(); d.wAsli=t; filtered.push(d); } });
        if(filtered.length === 0) return alert("Data kosong pada rentang waktu yang Anda pilih.");

        let sampled = []; let step = Math.ceil(filtered.length / 50); 
        for(let i=0; i<filtered.length; i+=step) sampled.push(filtered[i]);
        
        clearCompCharts();
        sampled.forEach(d => {
            let tStr = formatWaktuKTI(d.wAsli, true, true);
            compSuhu.data.labels.push(tStr); compSuhu.data.datasets[0].data.push(d.suhu_indoor||0); compSuhu.data.datasets[1].data.push(d.suhu_outdoor||0);
            compHum.data.labels.push(tStr); compHum.data.datasets[0].data.push(d.hum_indoor||0); compHum.data.datasets[1].data.push(d.hum_outdoor||0);
            compNo2.data.labels.push(tStr); compNo2.data.datasets[0].data.push(convertToMass(d.no2_indoor||0,'NO2')); compNo2.data.datasets[1].data.push(convertToMass(d.no2_outdoor||0,'NO2'));
            compCo.data.labels.push(tStr); compCo.data.datasets[0].data.push(convertToMass(d.co_indoor||0,'CO')); compCo.data.datasets[1].data.push(convertToMass(d.co_outdoor||0,'CO'));
            compPm25.data.labels.push(tStr); compPm25.data.datasets[0].data.push(d.pm25_indoor||0); compPm25.data.datasets[1].data.push(d.pm25_outdoor||0);
            compPm10.data.labels.push(tStr); compPm10.data.datasets[0].data.push(d.pm10_indoor||0); compPm10.data.datasets[1].data.push(d.pm10_outdoor||0);
        });
        compSuhu.update(); compHum.update(); compNo2.update(); compCo.update(); compPm25.update(); compPm10.update();
    });
}

window.changeChartMode = function() {
    let val = document.getElementById('chart-time-filter').value;
    let customCtrl = document.getElementById('custom-chart-controls');
    if(val === 'custom') customCtrl.style.display = 'flex'; 
    else {
        customCtrl.style.display = 'none';
        if(val === 'live') { chartMode = 'live'; clearCompCharts(); } 
        else if(val === '24h') { chartMode = 'history'; let e=new Date(); let s=new Date(e.getTime() - 24*60*60*1000); loadChartDataByRange(s, e); }
    }
}
window.applyCustomChart = function() {
    let s = document.getElementById('chart-start').value, e = document.getElementById('chart-end').value;
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
}

// =========================================================================
// 4. LISTENER DATA REALTIME (Update Speedo, Dashboard, Live Chart)
// =========================================================================
db.ref('/sensorData').on('value', (snap) => {
    let d = snap.val(); if(!d) return;
    
    let connEl = document.getElementById('conn-status'); let statText = document.getElementById('status-text');
    if(connEl && statText) { connEl.className = 'status-badge online'; statText.innerText = 'TERHUBUNG (LIVE)'; }

    // Weather Box Dashboard
    if(document.getElementById('val-suhu-recv')) document.getElementById('val-suhu-recv').innerText = (d.suhu_indoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-recv')) document.getElementById('val-hum-recv').innerText = (d.hum_indoor||0).toFixed(1) + " %";
    if(document.getElementById('val-suhu-send')) document.getElementById('val-suhu-send').innerText = (d.suhu_outdoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-send')) document.getElementById('val-hum-send').innerText = (d.hum_outdoor||0).toFixed(1) + " %";

    // Weather Box Speedometer
    if(document.getElementById('val-suhu-recv-spd')) document.getElementById('val-suhu-recv-spd').innerText = (d.suhu_indoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-recv-spd')) document.getElementById('val-hum-recv-spd').innerText = (d.hum_indoor||0).toFixed(1) + " %";
    if(document.getElementById('val-suhu-send-spd')) document.getElementById('val-suhu-send-spd').innerText = (d.suhu_outdoor||0).toFixed(1) + " °C";
    if(document.getElementById('val-hum-send-spd')) document.getElementById('val-hum-send-spd').innerText = (d.hum_outdoor||0).toFixed(1) + " %";

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
        {val: massData.pm25_out, id:'pm25-send', type:'PM25'}, {val: massData.pm10_out, id:'pm10-send', type:'PM10'}
    ];

    sensors.forEach(s => {
        let score = calculateISPU(s.val, s.type);
        let st = getISPUStatus(score);

        // Speedo Update (Hanya ada 8 gas speedo sekarang)
        if(document.getElementById(`needle-${s.id}`)) document.getElementById(`needle-${s.id}`).style.transform = `rotate(${valueToAngle(score)}deg)`;
        if(document.getElementById(`val-${s.id}`)) document.getElementById(`val-${s.id}`).innerHTML = `${s.val.toFixed(1)}`;
        if(document.getElementById(`stat-${s.id}`)) { document.getElementById(`stat-${s.id}`).innerText = `ISPU: ${score} (${st.text})`; document.getElementById(`stat-${s.id}`).style.color = st.color; }

        // Dashboard 8 Cards Update
        if(document.getElementById(`val-${s.id}`)) document.getElementById(`val-${s.id}`).innerText = s.val.toFixed(1);
        if(document.getElementById(`stat-${s.id}`) && document.getElementById(`card-${s.id}`)) { 
            document.getElementById(`stat-${s.id}`).innerText = st.text; document.getElementById(`stat-${s.id}`).style.color = st.color;
            document.getElementById(`emo-${s.id}`).innerText = st.emoji; document.getElementById(`card-${s.id}`).style.borderTopColor = st.color; 
        }
    });

    // Update Live Charts
    if(gasChart && particleChart && gasChartOut && particleChartOut) {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        gasChart.data.labels.push(now); gasChart.data.datasets[0].data.push(massData.no2_in); gasChart.data.datasets[1].data.push(massData.co_in);
        particleChart.data.labels.push(now); particleChart.data.datasets[0].data.push(massData.pm25_in); particleChart.data.datasets[1].data.push(massData.pm10_in);
        gasChartOut.data.labels.push(now); gasChartOut.data.datasets[0].data.push(massData.no2_out); gasChartOut.data.datasets[1].data.push(massData.co_out);
        particleChartOut.data.labels.push(now); particleChartOut.data.datasets[0].data.push(massData.pm25_out); particleChartOut.data.datasets[1].data.push(massData.pm10_out);

        if(gasChart.data.labels.length > maxDataPoints) { 
            [gasChart, particleChart, gasChartOut, particleChartOut].forEach(ch => { ch.data.labels.shift(); ch.data.datasets[0].data.shift(); ch.data.datasets[1].data.shift(); });
        }
        gasChart.update('none'); particleChart.update('none'); gasChartOut.update('none'); particleChartOut.update('none');
    }
    
    // Update Comparison Live
    if(compNo2 && chartMode === 'live') {
        let now = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const pC = (ch, vI, vO) => { ch.data.labels.push(now); ch.data.datasets[0].data.push(vI); ch.data.datasets[1].data.push(vO); if(ch.data.labels.length>maxDataPoints){ ch.data.labels.shift(); ch.data.datasets[0].data.shift(); ch.data.datasets[1].data.shift(); } ch.update('none'); };
        pC(compSuhu, d.suhu_indoor||0, d.suhu_outdoor||0); pC(compHum, d.hum_indoor||0, d.hum_outdoor||0);
        pC(compNo2, massData.no2_in, massData.no2_out); pC(compCo, massData.co_in, massData.co_out); 
        pC(compPm25, massData.pm25_in, massData.pm25_out); pC(compPm10, massData.pm10_in, massData.pm10_out);
    }
});

// =========================================================================
// 5. FITUR FILTER TABLE & EXCEL
// =========================================================================
function fetchAggregatedData(start, end, format, callback) {
    db.ref('/logs').limitToLast(30000).once('value').then(snap => {
        let dm = []; snap.forEach(c => { let t = getRealTimeFromFirebaseKey(c.key); if(t>=start && t<=end){ let r=c.val(); r.wAsli=t; dm.push(r); } });
        if(dm.length===0) return callback([]);

        if (format === 'raw') {
            callback(dm.map(r => ({ w: formatWaktuKTI(r.wAsli), s_in: r.suhu_indoor||0, h_in: r.hum_indoor||0, n_in: convertToMass(r.no2_indoor||0,'NO2'), c_in: convertToMass(r.co_indoor||0,'CO'), p2_in: r.pm25_indoor||0, p1_in: r.pm10_indoor||0, s_out: r.suhu_outdoor||0, h_out: r.hum_outdoor||0, n_out: convertToMass(r.no2_outdoor||0,'NO2'), c_out: convertToMass(r.co_outdoor||0,'CO'), p2_out: r.pm25_outdoor||0, p1_out: r.pm10_outdoor||0 })));
        } else {
            let gw = {};
            dm.forEach(r => { 
                let t = r.wAsli; let lbl = format === 'hourly' ? formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), 0, 0)) : formatWaktuKTI(new Date(t.getFullYear(), t.getMonth(), t.getDate()), true, false);
                if(!gw[lbl]) gw[lbl]={c:0,si:0,hi:0,n2i:0,c0i:0,p2i:0,p1i:0,so:0,ho:0,n2o:0,c0o:0,p2o:0,p1o:0};
                gw[lbl].c++; gw[lbl].si+=r.suhu_indoor||0; gw[lbl].hi+=r.hum_indoor||0; gw[lbl].n2i+=convertToMass(r.no2_indoor||0,'NO2'); gw[lbl].c0i+=convertToMass(r.co_indoor||0,'CO'); gw[lbl].p2i+=r.pm25_indoor||0; gw[lbl].p1i+=r.pm10_indoor||0; gw[lbl].so+=r.suhu_outdoor||0; gw[lbl].ho+=r.hum_outdoor||0; gw[lbl].n2o+=convertToMass(r.no2_outdoor||0,'NO2'); gw[lbl].c0o+=convertToMass(r.co_outdoor||0,'CO'); gw[lbl].p2o+=r.pm25_outdoor||0; gw[lbl].p1o+=r.pm10_outdoor||0;
            });
            let dx = []; for (let w in gw) { let g=gw[w], c=g.c; dx.push({ w: w, s_in: g.si/c, h_in: g.hi/c, n_in: g.n2i/c, c_in: g.c0i/c, p2_in: g.p2i/c, p1_in: g.p1i/c, s_out: g.so/c, h_out: g.ho/c, n_out: g.n2o/c, c_out: g.c0o/c, p2_out: g.p2o/c, p1_out: g.p1o/c }); }
            callback(dx);
        }
    });
}

function renderDynamicTable(dataArray, sensorType) {
    let head = document.getElementById('table-head'); let body = document.getElementById('history-table-body');
    if(dataArray.length === 0) { head.innerHTML = ''; body.innerHTML = '<tr><td style="color:#0f172a;">Tidak ada data pada rentang ini.</td></tr>'; return; }
    
    let hHTML = `<tr><th rowspan="2" style="background:#e2e8f0; border-right:1px solid #cbd5e1;">Waktu</th><th colspan="${sensorType==='all'?6:1}">RECEIVER</th><th colspan="${sensorType==='all'?6:1}">SENDER</th></tr><tr>`;
    const cols = {
        'suhu': '<th>Suhu (°C)</th>', 'hum': '<th>Hum (%)</th>', 'no2': '<th>NO2 (µg)</th>', 'co': '<th>CO (µg)</th>', 'pm25': '<th>PM 2.5</th>', 'pm10': '<th>PM 10</th>',
        'all': '<th>Suhu</th><th>Hum</th><th>NO2</th><th>CO</th><th>PM2.5</th><th>PM10</th>'
    };
    hHTML += (cols[sensorType] || cols['all']) + (cols[sensorType] || cols['all']) + `</tr>`;
    head.innerHTML = hHTML;

    let bHTML = '';
    dataArray.forEach(p => {
        let v_in = '', v_out = '';
        if(sensorType === 'all') { v_in = `<td>${p.s_in.toFixed(1)}</td><td>${p.h_in.toFixed(1)}</td><td>${p.n_in.toFixed(1)}</td><td>${p.c_in.toFixed(1)}</td><td>${p.p2_in.toFixed(1)}</td><td>${p.p1_in.toFixed(1)}</td>`; v_out = `<td>${p.s_out.toFixed(1)}</td><td>${p.h_out.toFixed(1)}</td><td>${p.n_out.toFixed(1)}</td><td>${p.c_out.toFixed(1)}</td><td>${p.p2_out.toFixed(1)}</td><td>${p.p1_out.toFixed(1)}</td>`; }
        else if(sensorType === 'suhu') { v_in = `<td>${p.s_in.toFixed(1)}</td>`; v_out = `<td>${p.s_out.toFixed(1)}</td>`; }
        else if(sensorType === 'hum') { v_in = `<td>${p.h_in.toFixed(1)}</td>`; v_out = `<td>${p.h_out.toFixed(1)}</td>`; }
        else if(sensorType === 'no2') { v_in = `<td>${p.n_in.toFixed(1)}</td>`; v_out = `<td>${p.n_out.toFixed(1)}</td>`; }
        else if(sensorType === 'co') { v_in = `<td>${p.c_in.toFixed(1)}</td>`; v_out = `<td>${p.c_out.toFixed(1)}</td>`; }
        else if(sensorType === 'pm25') { v_in = `<td>${p.p2_in.toFixed(1)}</td>`; v_out = `<td>${p.p2_out.toFixed(1)}</td>`; }
        else if(sensorType === 'pm10') { v_in = `<td>${p.p1_in.toFixed(1)}</td>`; v_out = `<td>${p.p1_out.toFixed(1)}</td>`; }
        bHTML += `<tr><td style="background:#f8fafc; font-weight:bold; border-right:1px solid #cbd5e1; color:#0f172a;">${p.w}</td>${v_in}${v_out}</tr>`;
    });
    body.innerHTML = bHTML;
}

window.processHistoryView = function() {
    let sVal = document.getElementById('hist-start').value, eVal = document.getElementById('hist-end').value;
    let format = document.getElementById('hist-format').value, sensorType = document.getElementById('hist-sensor').value;
    if(!sVal || !eVal) return alert("Pilih Waktu Mulai & Selesai.");
    document.getElementById('history-table-body').innerHTML = '<tr><td colspan="100%" style="color:#0f172a;">Mengekstrak data...</td></tr>';
    fetchAggregatedData(new Date(sVal), new Date(eVal), format, (data) => renderDynamicTable(data, sensorType));
}

window.processDownload = function() {
    let sVal = document.getElementById('hist-start').value, eVal = document.getElementById('hist-end').value;
    let format = document.getElementById('hist-format').value, sensorType = document.getElementById('hist-sensor').value;
    if(!sVal || !eVal) return alert("Pilih Waktu Mulai & Selesai.");
    alert("Merakit data Excel...");
    fetchAggregatedData(new Date(sVal), new Date(eVal), format, (data) => {
        if(data.length === 0) return alert("Data kosong.");
        let dx = data.map(p => {
            let row = { "Waktu": p.w };
            if(sensorType === 'all' || sensorType === 'suhu') { row["Suhu Recv"] = +(p.s_in).toFixed(1); row["Suhu Send"] = +(p.s_out).toFixed(1); }
            if(sensorType === 'all' || sensorType === 'hum') { row["Hum Recv"] = +(p.h_in).toFixed(1); row["Hum Send"] = +(p.h_out).toFixed(1); }
            if(sensorType === 'all' || sensorType === 'no2') { row["NO2 Recv"] = +(p.n_in).toFixed(1); row["NO2 Send"] = +(p.n_out).toFixed(1); }
            if(sensorType === 'all' || sensorType === 'co') { row["CO Recv"] = +(p.c_in).toFixed(1); row["CO Send"] = +(p.c_out).toFixed(1); }
            if(sensorType === 'all' || sensorType === 'pm25') { row["PM2.5 Recv"] = +(p.p2_in).toFixed(1); row["PM2.5 Send"] = +(p.p2_out).toFixed(1); }
            if(sensorType === 'all' || sensorType === 'pm10') { row["PM10 Recv"] = +(p.p1_in).toFixed(1); row["PM10 Send"] = +(p.p1_out).toFixed(1); }
            return row;
        });
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dx), "Data_KTI"); XLSX.writeFile(wb, `Data_AirQuality_${sensorType}_${format}.xlsx`);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('gasChart')) initDashboardCharts();
    if(document.getElementById('chart-suhu')) initComparisonCharts();
});
