// 主要的JavaScript文件
document.addEventListener('DOMContentLoaded', function() {
    console.log('华棠班级管理系统已加载');
    
    // 小组加分功能
    if (document.getElementById('addGroupRecordBtn') || document.getElementById('resetWeeklyScoresBtn')) {
        initGroupPoints();
    }
    
    // 这里可以添加一些交互效果
    // 例如：移动端菜单、表单验证等
    
    // 添加一个简单的欢迎提示（仅在开发时显示）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.info('提示：这是开发版本。生产环境请使用实际域名访问。');
    }
});

// 页面加载完成后的效果
window.addEventListener('load', function() {
    // 淡入效果
    document.body.style.opacity = '1';
    document.body.style.transition = 'opacity 0.5s';
});

// XSS 防护：HTML 转义
function esc(str){
  if(typeof str !== 'string') str = String(str);
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// 小组加分功能实现
function initGroupPoints() {
    // 从localStorage加载小组数据
    let groups = JSON.parse(localStorage.getItem('classGroups') || '[]');
    
    // 如果没有数据，初始化默认数据
    if (groups.length === 0) {
        groups = [
            { id: 1, name: '创新组', members: ['张三', '李四', '王五', '赵六'], weeklyScore: 85, totalScore: 420 },
            { id: 2, name: '探索组', members: ['钱七', '孙八', '周九', '吴十'], weeklyScore: 78, totalScore: 395 },
            { id: 3, name: '合作组', members: ['郑十一', '冯十二', '陈十三', '褚十四'], weeklyScore: 72, totalScore: 380 },
            { id: 4, name: '进取组', members: ['沈十五', '韩十六', '杨十七', '朱十八'], weeklyScore: 65, totalScore: 350 },
            { id: 5, name: '活力组', members: ['秦十九', '尤二十', '林廿一', '盛廿二'], weeklyScore: 58, totalScore: 320 }
        ];
        saveGroups();
    }
    
    // 渲染小组卡片
    renderGroupCards();
    
    // 绑定事件
    const addRecordBtn = document.getElementById('addGroupRecordBtn');
    const resetWeeklyBtn = document.getElementById('resetWeeklyScoresBtn');
    
    if (addRecordBtn) {
        addRecordBtn.addEventListener('click', showAddRecordModal);
    }
    
    if (resetWeeklyBtn) {
        resetWeeklyBtn.addEventListener('click', resetWeeklyScores);
    }
}

// 保存小组数据到localStorage
function saveGroups() {
    localStorage.setItem('classGroups', JSON.stringify(groups));
}

// 渲染小组卡片
function renderGroupCards() {
    const scoreCardsContainer = document.querySelector('.score-cards');
    if (!scoreCardsContainer) return;
    
    // 按本周得分排序（降序）
    const sortedGroups = [...groups].sort((a, b) => b.weeklyScore - a.weeklyScore);
    
    scoreCardsContainer.innerHTML = '';
    sortedGroups.forEach((group, index) => {
        const scoreCard = document.createElement('div');
        scoreCard.className = 'score-card';;
        scoreCard.innerHTML = `
            <div class="card-header">
                <div class="rank">${index + 1}</div>
                <div class="card-title">${esc(group.name)}</div>
            </div>
            <div class="card-body">
                <div class="card-members">${esc(group.members.join('、'))}</div>
                <div class="card-score">
                    <span class="score-label">本周得分：</span>
                    <span class="score-value">${group.weeklyScore}</span>
                </div>
                <div class="card-score">
                    <span class="score-label">总得分：</span>
                    <span class="score-value">${group.totalScore}</span>
                </div>
            </div>
        `;
        scoreCardsContainer.appendChild(scoreCard);
    });
}

// 显示添加记录模态框
function showAddRecordModal() {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal';;
    modal.innerHTML = `
        <div class="modal-content">
            <h2>添加小组记录</h2>
            <form id="addRecordForm">
                <div class="form-group">
                    <label for="groupSelect">选择小组：</label>
                    <select id="groupSelect" required>
                        ${groups.map(group => `<option value="${group.id}">${group.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="scoreInput">得分（可正可负）：</span>
                    <input type="number" id="scoreInput" min="-20" max="20" required>
                </div>
                <div class="form-group">
                    <label for="reasonInput">记录事由：</span>
                    <input type="text" id="reasonInput" placeholder="例如：积极回答问题、帮助同学等" required>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn-primary">确定添加</button>
                    <button type="button" class="btn-secondary" id="closeModal">取消</button>
                </div>
            </form>
        </div>
    `;
    
    // 添加模态框样式
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: bold;
        }
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
        }
        .form-buttons {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
        }
        .btn-secondary {
            background-color: #95a5a6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-secondary:hover {
            background-color: #7f8c8d;
        }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 绑定事件
    const form = document.getElementById('addRecordForm');
    const closeBtn = document.getElementById('closeModal');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const groupId = parseInt(document.getElementById('groupSelect').value);
        const score = parseInt(document.getElementById('scoreInput').value);
        const reason = document.getElementById('reasonInput').value.trim();
        
        if (groupId && score && reason) {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                group.weeklyScore += score;
                group.totalScore += score;
                saveGroups();
                renderGroupCards();
                
                // 显示成功提示
                alert(`成功为${group.name}加${score}分！事由：${reason}`);
            }
        }
        
        // 关闭模态框
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
    
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
}

// 重置本周得分
function resetWeeklyScores() {
    if (confirm('确定要重置所有小组的本周得分吗？这将清空本周的所有加分记录。')) {
        groups.forEach(group => {
            group.weeklyScore = 0;
        });
        saveGroups();
        renderGroupCards();
        alert('已重置所有小组的本周得分！');
    }
}
