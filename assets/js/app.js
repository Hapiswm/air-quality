// ==========================================
// 1. KONFIGURASI FIREBASE & ISPU
// ==========================================
const firebaseConfig = { databaseURL: "https://air-quality-2f87d-default-rtdb.asia-southeast1.firebasedatabase.app" };
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

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
        if (value >= Xb && value <= Xa) return Math.round(((Ia - Ib) / (Xa - Xb)) * (value - Xb) + Ib);
    }
    return 500; 
}

function getISPUCategory(score) {
    if (score <= 50) return { text: "BAIK", color: "#22c55e", emoji: "😃" };
    if (score <= 100) return { text: "SEDANG", color: "#3b82f6", emoji: "😐" };
    if (score <= 200) return { text: "TIDAK SEHAT", color: "#f59e0b", emoji: "😷" };
    if (score <= 300) return { text: "SANGAT TIDAK SEHAT", color: "#ef4444", emoji: "🤢" };
    return { text: "BERBAHAYA", color: "#000000", emoji: "☠️", isDanger: true }; 
}

// ==========================================
// 2. DASHBOARD LIVE UPDATE (index.html & speedometer.html)
// ==========================================
function updateDashboardUI(id, suffix, val, score, cat) {
    let el = `${id}-${suffix}`;
    if(document.getElementById(`val-${el}`)) {
        document.getElementById(`val-${el}`).innerText = val.toFixed(1);
        document.getElementById(`emo-${el}`).innerText = cat.emoji;
        document.getElementById(`stat-${el}`).innerText = cat.text;
        document.getElementById(`stat-${el}`).style.color = cat.color;
        document.getElementById(`card-${el}`).style.borderTopColor = cat.color;
    }
}

db.ref('/sensorData').on('value', (snap) => {
    let d = snap.val();
    if (!d) return;
    
    // Suhu & Hum
    ['indoor', 'outdoor'].forEach(loc => {
        let suf = loc === 'indoor' ? 'in' : 'out';
        if(document.getElementById(`val-suhu-${suf}`)) document.getElementById(`val-suhu-${suf}`).innerText = (d[`suhu_${loc}`]||0).toFixed(1) + " °C";
        if(document.getElementById(`val-hum-${suf}`)) document.getElementById(`val-hum-${suf}`).innerText = (d[`hum_${loc}`]||0).toFixed(1) + " %";
        
        let no2 = convertToMass(d[`no2_${loc}`]||0, 'NO2');
        let co = convertToMass(d[`co_${loc}`]||0, 'CO');
        let pm25 = d[`pm25_${loc}`]||0;
        let pm10 = d[`pm10_${loc}`]||0;

        updateDashboardUI('no2', suf, no2, calculateISPU(no2, 'NO2'), getISPUCategory(calculateISPU(no2, 'NO2')));
        updateDashboardUI('co', suf, co, calculateISPU(co, 'CO'), getISPUCategory(calculateISPU(co, 'CO')));
        updateDashboardUI('pm25', suf, pm25, calculateISPU(pm25, 'PM25'), getISPUCategory(calculateISPU(pm25, 'PM25')));
        updateDashboardUI('pm10', suf, pm10, calculateISPU(pm10, 'PM10'), getISPUCategory(calculateISPU(pm10, 'PM10')));
    });
});

// Live Chart di index.html
let liveChart;
if(document.getElementById('liveChart')) {
    let ctx = document.getElementById('liveChart').getContext('2d');
    liveChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [
        { label: 'CO Receiver', borderColor: '#ef4444', data: [], tension: 0.3 },
        { label: 'NO2 Receiver', borderColor: '#f59e0b', data: [], tension: 0.3 }
    ]}, options: { responsive: true, animation: false }});
    
    db.ref('/logs').limitToLast(15).on('value', (snap) => {
        let lbls = [], dCO = [], dNO2 = [];
        snap.forEach(c => {
            let v = c.val();
            lbls.push(new Date(v.timestamp).toLocaleTimeString('id-ID'));
            dCO.push(convertToMass(v.co_indoor||0, 'CO'));
            dNO2.push(convertToMass(v.no2_indoor||0, 'NO2'));
        });
        liveChart.data.labels = lbls; liveChart.data.datasets[0].data = dCO; liveChart.data.datasets[1].data = dNO2; liveChart.update();
    });
}

// ==========================================
// 3. FITUR FILTER, GRAFIK & EXCEL (grafik.html & history.html)
// ==========================================
let analysisChart;

// Fungsi Agregasi Rata-rata Array
function averageData(dataArray, interval) {
    let grouped = {};
    dataArray.forEach(item => {
        let d = new Date(item.timestamp);
        let key = '';
        if(interval === 'perjam') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:00`;
        else if(interval === '24jam') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} (Rata-rata Harian)`;
        else key = d.toLocaleString('id-ID'); // raw
        
        if(!grouped[key]) grouped[key] = { count: 0, s_in:0, h_in:0, n_in:0, c_in:0, p2_in:0, p10_in:0, s_out:0, h_out:0, n_out:0, c_out:0, p2_out:0, p10_out:0 };
        
        grouped[key].s_in += item.suhu_indoor||0; grouped[key].h_in += item.hum_indoor||0;
        grouped[key].n_in += convertToMass(item.no2_indoor||0, 'NO2'); grouped[key].c_in += convertToMass(item.co_indoor||0, 'CO');
        grouped[key].p2_in += item.pm25_indoor||0; grouped[key].p10_in += item.pm10_indoor||0;
        
        grouped[key].s_out += item.suhu_outdoor||0; grouped[key].h_out += item.hum_outdoor||0;
        grouped[key].n_out += convertToMass(item.no2_outdoor||0, 'NO2'); grouped[key].c_out += convertToMass(item.co_outdoor||0, 'CO');
        grouped[key].p2_out += item.pm25_outdoor||0; grouped[key].p10_out += item.pm10_outdoor||0;
        
        grouped[key].count++;
    });

    let result = [];
    for(let k in grouped) {
        let c = grouped[k].count;
        result.push({ timeStr: k, 
            s_in: (grouped[k].s_in/c).toFixed(1), h_in: (grouped[k].h_in/c).toFixed(1), n_in: (grouped[k].n_in/c).toFixed(1), c_in: (grouped[k].c_in/c).toFixed(1), p2_in: (grouped[k].p2_in/c).toFixed(1), p10_in: (grouped[k].p10_in/c).toFixed(1),
            s_out: (grouped[k].s_out/c).toFixed(1), h_out: (grouped[k].h_out/c).toFixed(1), n_out: (grouped[k].n_out/c).toFixed(1), c_out: (grouped[k].c_out/c).toFixed(1), p2_out: (grouped[k].p2_out/c).toFixed(1), p10_out: (grouped[k].p10_out/c).toFixed(1)
        });
    }
    return result;
}

// Fungsi Fetch Filtered Data
function fetchFilteredData(dateStr, mode, callback) {
    let ref = db.ref('/logs');
    if(mode === 'realtime' && !dateStr) { ref.limitToLast(50).once('value', s => callback(s)); } 
    else {
        // Ambil 1 hari penuh jika ada filter tanggal
        let start = new Date(dateStr).setHours(0,0,0,0);
        let end = new Date(dateStr).setHours(23,59,59,999);
        ref.orderByChild('timestamp').startAt(start).endAt(end).once('value', s => callback(s));
    }
}

// Render Grafik Filter
window.loadGrafikData = function() {
    let mode = document.getElementById('grafik-mode').value;
    let date = document.getElementById('grafik-date').value;
    if((mode==='perjam' || mode==='24jam') && !date) { alert("Pilih tanggal dulu!"); return; }

    fetchFilteredData(date, mode, (snap) => {
        let rawData = []; snap.forEach(c => { rawData.push(c.val()); });
        let processed = averageData(rawData, mode);
        
        let lbls = [], co = [], no2 = [];
        processed.forEach(p => { lbls.push(p.timeStr); co.push(p.c_in); no2.push(p.n_in); });

        if(!analysisChart) {
            let ctx = document.getElementById('mainChart').getContext('2d');
            analysisChart = new Chart(ctx, { type: 'line', data: { labels: lbls, datasets: [{ label: 'CO Receiver', borderColor: 'red', data: co }, { label: 'NO2 Receiver', borderColor: 'orange', data: no2 }]} });
        } else {
            analysisChart.data.labels = lbls; analysisChart.data.datasets[0].data = co; analysisChart.data.datasets[1].data = no2; analysisChart.update();
        }
    });
}

// Render Tabel History & Fungsi Export CSV
window.loadHistoryData = function() {
    let mode = document.getElementById('hist-mode').value;
    let date = document.getElementById('hist-date').value;
    if((mode==='perjam' || mode==='24jam') && !date) { alert("Pilih tanggal dulu!"); return; }

    fetchFilteredData(date, mode, (snap) => {
        let rawData = []; snap.forEach(c => { rawData.push(c.val()); });
        let processed = averageData(rawData, mode);
        
        let tbody = document.getElementById('tableBody'); tbody.innerHTML = '';
        if(processed.length === 0) tbody.innerHTML = '<tr><td colspan="13">Data tidak ditemukan di tanggal tersebut.</td></tr>';
        
        processed.forEach(p => {
            tbody.innerHTML += `<tr>
                <td>${p.timeStr}</td>
                <td class="th-group">${p.s_in}</td><td>${p.h_in}</td><td>${p.n_in}</td><td>${p.c_in}</td><td>${p.p2_in}</td><td>${p.p10_in}</td>
                <td class="th-group">${p.s_out}</td><td>${p.h_out}</td><td>${p.n_out}</td><td>${p.c_out}</td><td>${p.p2_out}</td><td>${p.p10_out}</td>
            </tr>`;
        });
    });
}

window.exportToCSV = function() {
    let csv = []; let rows = document.querySelectorAll("#dataTable tr");
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) row.push(cols[j].innerText.replace(/,/g, "")); 
        csv.push(row.join(","));
    }
    let csvFile = new Blob([csv.join("\n")], {type: "text/csv"});
    let dl = document.createElement("a"); dl.download = "Export_Data_KTI.csv"; dl.href = window.URL.createObjectURL(csvFile);
    document.body.appendChild(dl); dl.click();
}
