// 午休吵闹监控 — 升级版（与 unified-v2 风格统一）
document.addEventListener('DOMContentLoaded', function() {
    const noiseSlider = document.getElementById('noiseSlider');
    const currentLevel = document.getElementById('currentLevel');
    const currentIdiom = document.getElementById('currentIdiom');
    const currentLevelNum = document.getElementById('currentLevelNum');
    const recordButton = document.getElementById('recordButton');
    const resetButton = document.getElementById('resetButton');
    const historyTable = document.getElementById('historyTable');
    const chartContainer = document.getElementById('chartContainer');

    // 7级噪音映射（与 unified-v2 一致）
    const LEVELS = [
        { name: '鸦雀无声', color: '#27ae60', short: '安静' },
        { name: '窃窃私语', color: '#2ecc71', short: '私语' },
        { name: '低声细语', color: '#f1c40f', short: '低语' },
        { name: '交头接耳', color: '#f39c12', short: '接耳' },
        { name: '人声嘈杂', color: '#e67e22', short: '嘈杂' },
        { name: '人声鼎沸', color: '#e74c3c', short: '鼎沸' },
        { name: '惊天动地', color: '#8e44ad', short: '动地' }
    ];

    const STORAGE_KEY = 'noise_monitor_v2';
    
    function loadData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return { history: [] };
    }
    
    var data = loadData();
    
    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    
    function fmt() {
        var d = new Date();
        return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2) + ':' + ('0'+d.getSeconds()).slice(-2);
    }
    
    function updateDisplay() {
        var v = parseFloat(noiseSlider.value);
        var vi = Math.min(LEVELS.length - 1, Math.max(0, Math.round(v)));
        var lv = LEVELS[vi];
        currentLevel.textContent = lv.name;
        currentLevel.style.color = lv.color;
        currentIdiom.textContent = '当前等级';
        currentLevelNum.textContent = v.toFixed(1);
        
        // 滑块渐变
        var pct = (v / 6) * 100;
        noiseSlider.style.background = 'linear-gradient(to right, #27ae60 0%, #2ecc71 ' + (pct * 0.6) + '%, #f1c40f ' + pct + '%, #f39c12 ' + Math.min(100, pct + 10) + '%, #e74c3c 100%)';
    }
    
    function recordNoise() {
        var v = parseFloat(noiseSlider.value);
        var vi = Math.min(LEVELS.length - 1, Math.max(0, Math.round(v)));
        var lv = LEVELS[vi];
        var ts = fmt();
        
        data.history.push({
            time: ts,
            level: v,
            name: lv.name,
            color: lv.color,
            recorder: '班干部'
        });
        
        saveData();
        updateHistoryTable();
        drawChart();
        updateStats();
        
        // 反馈提示
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e8f5e9;border-radius:12px;padding:10px 20px;box-shadow:0 4px 20px rgba(0,0,0,.12);z-index:3000;font-size:.85rem;border:2px solid #27ae60;font-weight:500;';
        toast.textContent = '✅ 已记录：' + lv.name;
        document.body.appendChild(toast);
        setTimeout(function() { document.body.removeChild(toast); }, 2000);
    }
    
    function resetHistory() {
        if (!data.history.length) return;
        if (!confirm('确定清空今日所有吵闹记录吗？')) return;
        data.history = [];
        saveData();
        updateHistoryTable();
        drawChart();
        updateStats();
    }
    
    function updateStats() {
        var total = data.history.length;
        document.getElementById('statTotal').textContent = total;
        if (!total) {
            document.getElementById('statAvg').textContent = '—';
            document.getElementById('statMax').textContent = '—';
            document.getElementById('statQuiet').textContent = '0';
            return;
        }
        var sum = 0, maxV = 0, quiet = 0;
        data.history.forEach(function(r) {
            var v = r.level !== undefined ? r.level : 0;
            sum += v;
            if (v > maxV) maxV = v;
            if (v <= 1) quiet++;
        });
        document.getElementById('statAvg').textContent = (sum / total).toFixed(1);
        document.getElementById('statMax').textContent = LEVELS[Math.min(LEVELS.length - 1, Math.round(maxV))].name;
        document.getElementById('statQuiet').textContent = quiet;
    }
    
    function updateHistoryTable() {
        var tbody = document.getElementById('historyTable');
        if (!data.history.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="color:#999;padding:20px;">暂无记录</td></tr>';
            return;
        }
        var show = data.history.slice(-50).reverse();
        var h = '';
        show.forEach(function(r) {
            h += '<tr><td>' + r.time + '</td><td>' + r.level.toFixed(1) + '</td><td style="color:' + r.color + ';font-weight:600;">' + r.name + '</td><td>' + (r.recorder || '班干部') + '</td></tr>';
        });
        tbody.innerHTML = h;
    }
    
    function drawChart() {
        if (!data.history.length) {
            chartContainer.innerHTML = '<div style="text-align:center;color:#999;padding:40px 20px;">📊 暂无数据<br><span style="font-size:.8rem;">开始记录后趋势图自动生成</span></div>';
            return;
        }
        
        var rect = chartContainer.getBoundingClientRect();
        var w = Math.max(300, rect.width - 10);
        var h = 180;
        
        chartContainer.innerHTML = '<canvas id="noiseCanvas" width="' + w + '" height="' + h + '" style="width:' + w + 'px;height:' + h + 'px;"></canvas>';
        var canvas = document.getElementById('noiseCanvas');
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
        
        var pd = { top: 10, bottom: 18, left: 28, right: 10 };
        var pw = w - pd.left - pd.right;
        var ph = h - pd.top - pd.bottom;
        var ml = LEVELS.length - 1;
        var ct = data.history.length;
        
        // 网格
        ctx.strokeStyle = '#eef0f8';
        ctx.lineWidth = 1;
        for (var gi = 0; gi <= ml; gi++) {
            var gy = pd.top + ph - (gi / ml) * ph;
            ctx.beginPath();
            ctx.moveTo(pd.left, gy);
            ctx.lineTo(w - pd.right, gy);
            ctx.stroke();
            ctx.fillStyle = '#b0b8d0';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(LEVELS[gi].short, pd.left - 4, gy + 2);
        }
        
        // 数据
        var pts = [];
        for (var j = 0; j < ct; j++) {
            var vj = data.history[j].level !== undefined ? data.history[j].level : 0;
            pts.push({
                x: pd.left + (j / Math.max(ct - 1, 1)) * pw,
                y: pd.top + ph - (vj / ml) * ph,
                lv: vj
            });
        }
        
        // 填充
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pd.top + ph);
        for (var a = 0; a < pts.length; a++) ctx.lineTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[pts.length - 1].x, pd.top + ph);
        ctx.closePath();
        var gr = ctx.createLinearGradient(0, pd.top, 0, pd.top + ph);
        gr.addColorStop(0, 'rgba(102,126,234,0.08)');
        gr.addColorStop(1, 'rgba(102,126,234,0.01)');
        ctx.fillStyle = gr;
        ctx.fill();
        
        // 折线
        for (var s = 0; s < pts.length - 1; s++) {
            var pk = Math.min(ml, Math.max(0, Math.round(pts[s].lv)));
            ctx.strokeStyle = LEVELS[pk].color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(pts[s].x, pts[s].y);
            ctx.lineTo(pts[s + 1].x, pts[s + 1].y);
            ctx.stroke();
        }
        
        // 数据点
        for (var k = 0; k < pts.length; k++) {
            var pi = Math.min(ml, Math.max(0, Math.round(pts[k].lv)));
            ctx.fillStyle = LEVELS[pi].color;
            ctx.beginPath();
            ctx.arc(pts[k].x, pts[k].y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pts[k].x, pts[k].y, 3.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // 事件绑定
    noiseSlider.addEventListener('input', updateDisplay);
    recordButton.addEventListener('click', recordNoise);
    if (resetButton) resetButton.addEventListener('click', resetHistory);

    // 初始化
    updateDisplay();
    updateHistoryTable();
    drawChart();
    updateStats();
});