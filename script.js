let shiftDate = null;
let shiftStartTime = null;
let shiftEndTime = null;
let breaksLunches = [];
let calls = [];

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ УВЕДОМЛЕНИЙ ---
let notificationInterval = null;
let notifiedBreakId = null; 
let showBreakNotifications = true;
let breakNotificationModal; 
let isInitialLoad = true;
let dismissedNotifications = [];

// --- LITE & DARK MODE VARS ---
let isLiteMode = false;
let isDarkMode = false;
let liteSolved = 0;
let liteEscalated = 0;
let liteRated = 0;
const liteModeHiddenCards = ['card1', 'card3', 'card4', 'card5', 'card6', 'card10', 'card11', 'card13', 'card14']; 
// ----------------------------------------------------


// --- HELPER FUNCTION ---
function checkColumnVisibility() {
    document.querySelectorAll('.oo-col').forEach(col => {
        const cardsInCol = col.querySelectorAll('.card');
        if (cardsInCol.length > 0) {
            const allCardsHidden = Array.from(cardsInCol).every(c => c.style.display === 'none');
            if (allCardsHidden) {
                col.style.display = 'none';
            } else {
                col.style.display = 'block';
            }
        }
    });
}
// --- END HELPER FUNCTION ---


document.addEventListener('DOMContentLoaded', function() {
    // --- ИНИЦИАЛИЗАЦИЯ МОДАЛЬНОГО ОКНА И НАСТРОЕК УВЕДОМЛЕНИЙ ---
    const modalElement = document.getElementById('breakNotificationModal');
    if (modalElement) {
        breakNotificationModal = new bootstrap.Modal(modalElement);
        modalElement.addEventListener('hidden.bs.modal', function () {
            if (notificationInterval) {
                clearInterval(notificationInterval);
                notificationInterval = null;
            }
            if (notifiedBreakId && !dismissedNotifications.includes(notifiedBreakId)) {
                dismissedNotifications.push(notifiedBreakId);
                localStorage.setItem('dismissedNotifications', JSON.stringify(dismissedNotifications));
            }
            document.getElementById('elapsedTime').textContent = '00:00:00';
        });
    }

    const notificationSwitch = document.getElementById('notificationSwitch');
    if (notificationSwitch) {
        notificationSwitch.addEventListener('change', function() {
            showBreakNotifications = this.checked;
            localStorage.setItem('showBreakNotifications', JSON.stringify(showBreakNotifications));
        });
    }
    
    // --- NEW DARK MODE LISTENER ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            isDarkMode = this.checked;
            localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
            applyDarkModeState();
        });
    }

    // --- LITE MODE LISTENERS ---
    document.getElementById('liteModeToggle').addEventListener('change', function() {
        isLiteMode = this.checked;
        localStorage.setItem('isLiteMode', JSON.stringify(isLiteMode));
        applyLiteModeState();
    });

    // ... (listeners for lite mode counters)
    document.getElementById('lite-solved-plus').addEventListener('click', () => { liteSolved++; updateLiteModeUI(); });
    document.getElementById('lite-solved-minus').addEventListener('click', () => { if (liteSolved > 0) liteSolved--; updateLiteModeUI(); });
    document.getElementById('lite-escalated-plus').addEventListener('click', () => { liteEscalated++; updateLiteModeUI(); });
    document.getElementById('lite-escalated-minus').addEventListener('click', () => { if (liteEscalated > 0) liteEscalated--; updateLiteModeUI(); });
    document.getElementById('lite-rated-plus').addEventListener('click', () => { liteRated++; updateLiteModeUI(); });
    document.getElementById('lite-rated-minus').addEventListener('click', () => { if (liteRated > 0) liteRated--; updateLiteModeUI(); });
    document.getElementById('lite-reset').addEventListener('click', () => {
        if (confirm('Сбросить счетчики лёгкого режима?')) {
            liteSolved = 0;
            liteEscalated = 0;
            liteRated = 0;
            updateLiteModeUI();
        }
    });

    // --- HIDE/SHOW CARD LISTENERS ---
    document.querySelectorAll('.hide-card-btn').forEach(button => {
        button.addEventListener('click', function() {
            const cardId = this.getAttribute('data-card-id');
            const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
            if (card) {
                if (card.style.display === 'none') {
                    card.style.display = 'flex';
                    let hiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];
                    hiddenCards = hiddenCards.filter(id => id !== cardId);
                    localStorage.setItem('hiddenCards', JSON.stringify(hiddenCards));
                } else {
                    card.style.display = 'none';
                    let hiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];
                    if (!hiddenCards.includes(cardId)) {
                        hiddenCards.push(cardId);
                    }
                    localStorage.setItem('hiddenCards', JSON.stringify(hiddenCards));
                }
                checkColumnVisibility();
            } else {
                console.error(`Card with id ${cardId} not found.`);
            }
        });
    });

    document.getElementById('resetVisibilityButton').addEventListener('click', function() {
        localStorage.removeItem('hiddenCards');
        document.querySelectorAll('.card').forEach(card => {
            if (card.id !== 'liteModeBlock') {
                card.style.display = 'flex';
            }
        });
        document.querySelectorAll('.oo-col').forEach(col => {
            col.style.display = 'block';
        });
        applyLiteModeState();
    });

    // --- SYNC COST INPUTS ---
    const selfCostInput = document.getElementById('selfHandlingCost');
    const escCostInput = document.getElementById('escalationCost');
    const selfCostMainInput = document.getElementById('selfHandlingCostMain');
    const escCostMainInput = document.getElementById('escalationCostMain');

    selfCostInput.addEventListener('input', () => selfCostMainInput.value = selfCostInput.value);
    escCostInput.addEventListener('input', () => escCostMainInput.value = escCostInput.value);
    selfCostMainInput.addEventListener('input', () => selfCostInput.value = selfCostMainInput.value);
    escCostMainInput.addEventListener('input', () => escCostInput.value = escCostMainInput.value);
});


document.getElementById('callDuration').addEventListener('change', function() {
    var selectedOption = this.options[this.selectedIndex];
    var selectedColor = selectedOption.style.backgroundColor;
    this.style.backgroundColor = selectedColor;
    if (!isDarkMode) {
        this.style.color = "black";
    } else {
        this.style.color = "black";
    }
    this.style.fontWeight = "bold";
});

document.getElementById('postCallDuration').addEventListener('change', function() {
    var selectedOption = this.options[this.selectedIndex];
    var selectedColor = selectedOption.style.backgroundColor;
    this.style.backgroundColor = selectedColor;
    if (!isDarkMode) {
        this.style.color = "black";
    } else {
        this.style.color = "black";
    }
    this.style.fontWeight = "bold";
});

window.addEventListener('beforeunload', function(event) {
    event.preventDefault();
    event.returnValue = '';
});

function addShift() {
    shiftDate = document.getElementById('shiftDate').value;
    shiftStartTime = document.getElementById('startTime').value;
    shiftEndTime = document.getElementById('endTime').value;

    localStorage.setItem('shiftStartTime', shiftStartTime);
    localStorage.setItem('shiftEndTime', shiftEndTime);

    updateTimers();
    alert('Время смены сохранено!');
}

function addBreak() {
    const breakDate = document.getElementById('breakDate').value;
    const breakStartTime = document.getElementById('breakStartTime').value;
    const breakEndTime = document.getElementById('breakEndTime').value;
    const breakType = document.getElementById('breakType').value;
    
    const breakId = Date.now(); 
    breaksLunches.push({ id: breakId, date: breakDate, start: breakStartTime, end: breakEndTime, type: breakType });

    localStorage.setItem('breaksLunches', JSON.stringify(breaksLunches));

    updateTimers();
    updateBreaksLunchesList();
}

function addCall() {
    if (isLiteMode) {
        alert('Добавление звонков отключено в Лёгком режиме.');
        return;
    }

    const callDuration = document.getElementById('callDuration').value;
    const postCallDuration = document.getElementById('postCallDuration').value;
    const escalated = document.getElementById('escalated').checked;
    const escalationQuestion = document.getElementById('escalationQuestionInput').value;
    const rated = document.getElementById('rated').checked;
    const selfHandlingCost = parseFloat(document.getElementById('selfHandlingCostMain').value);
    const escalationCost = parseFloat(document.getElementById('escalationCostMain').value);

    if (callDuration === "" || postCallDuration === "") {
        alert("Нужно выбрать время звонка и поствызова!");
        return;
    }

    if (escalated && escalationQuestion === "") {
        alert("В эскалируемом звонке, должен быть указан эскалируемый вопрос!");
        return;
    }

    const totalCost = escalated ? escalationCost : selfHandlingCost;

    calls.push({
        callDuration,
        postCallDuration,
        escalated,
        escalationQuestion,
        rated,
        selfHandlingCost,
        escalationCost,
        totalCost,
        date: new Date()
    });

    localStorage.setItem('calls', JSON.stringify(calls));

    updateStatistics();
    updateCallList();
    updateEscalatedCalls();
    updateCallDurationStats();
    updatePostCallDurationStats();
    resetCallForm();
}

function updateTimers() {
    const now = new Date();
    const shiftTimer = document.getElementById('shiftTimer');
    const breakTimers = document.getElementById('breakTimers');

    shiftTimer.innerHTML = '';
    breakTimers.innerHTML = '';

    if (shiftDate && shiftStartTime && shiftEndTime) {
        const start = new Date(`${shiftDate}T${shiftStartTime}`);
        const end = new Date(`${shiftDate}T${shiftEndTime}`);
        const timeToStart = start - now;
        const timeToEnd = end - now;

        if (timeToStart > 0) {
            shiftTimer.innerHTML = `<div class="bold">Время до начала смены: ${formatTime(timeToStart)}</div>`;
        } else if (timeToEnd > 0) {
            shiftTimer.innerHTML = `<div class="bold">Время до окончания смены: ${formatTime(timeToEnd)}</div>`;
        } else {
            shiftTimer.innerHTML = '<div class="bold">Смена закончена</div>';
        }
    }

    const activeBreak = breaksLunches.find(bl => {
        const start = new Date(`${bl.date}T${bl.start}`);
        const end = new Date(`${bl.date}T${bl.end}`);
        return now >= start && now < end;
    });

    if (activeBreak) {
        const start = new Date(`${activeBreak.date}T${activeBreak.start}`);
        const end = new Date(`${activeBreak.date}T${activeBreak.end}`);
        const timeToEnd = end - now;
        const timeElapsed = now - start;
        const typeText = activeBreak.type === 'break' ? 'перерыв' : 'обед';
        const typeIcon = activeBreak.type === 'break' ? 'bi-cup-hot-fill' : 'bi-egg-fried';
        const timeRange = `${activeBreak.start}-${activeBreak.end}`;

        breakTimers.innerHTML = `<div>Время до окончания ${typeText} (${timeRange}): ${formatTime(timeToEnd)}</div>
                                  <div>Прошло времени с начала ${typeText} (${timeRange}): ${formatTime(timeElapsed)}</div>`;

        if (showBreakNotifications && !isInitialLoad && !dismissedNotifications.includes(activeBreak.id)) {
            notifiedBreakId = activeBreak.id;
            document.getElementById('notificationTitle').innerHTML = `<i class="${typeIcon} me-2"></i>Начался ${typeText}!`;
            
            const elapsedTimeSpan = document.getElementById('elapsedTime');
            
            if (notificationInterval) clearInterval(notificationInterval);
            
            elapsedTimeSpan.textContent = formatTime(new Date() - start);

            notificationInterval = setInterval(() => {
                const elapsed = new Date() - start;
                elapsedTimeSpan.textContent = formatTime(elapsed);
            }, 1000);

            if (breakNotificationModal) {
                 breakNotificationModal.show();
            }
        }
    } else {
        const upcomingBreaks = breaksLunches
            .filter(bl => new Date(`${bl.date}T${bl.start}`) > now)
            .sort((a, b) => new Date(`${a.date}T${a.start}`) - new Date(`${b.date}T${b.start}`));

        if (upcomingBreaks.length > 0) {
            const nextBreak = upcomingBreaks[0];
            const start = new Date(`${nextBreak.date}T${nextBreak.start}`);
            const timeToStart = start - now;
            const typeText = nextBreak.type === 'break' ? 'перерыва' : 'обеда';
            const timeRange = `${nextBreak.start}-${nextBreak.end}`;
            breakTimers.innerHTML = `<div>Время до начала следующего ${typeText} (${timeRange}): ${formatTime(timeToStart)}</div>`;
        } else {
            breakTimers.innerHTML = '<div>Все перерывы и обеды закончены</div>';
        }
    }
    
    if (isInitialLoad) {
        isInitialLoad = false;
    }
}


function saveCallCost() {
    const selfHandlingCost = parseFloat(document.getElementById('selfHandlingCostMain').value);
    const escalationCost = parseFloat(document.getElementById('escalationCostMain').value);

    localStorage.setItem('selfHandlingCost', selfHandlingCost);
    localStorage.setItem('escalationCost', escalationCost);

    document.getElementById('selfHandlingCost').value = selfHandlingCost;
    document.getElementById('escalationCost').value = escalationCost;
    
    if (isLiteMode) {
        updateLiteModeUI();
    }

    alert('Стоимость звонков сохранена!');
}

window.addEventListener('load', function() {
    isDarkMode = JSON.parse(localStorage.getItem('isDarkMode')) || false;
    applyDarkModeState();
    
    const savedShiftDate = new Date().toISOString().split('T')[0];
    const savedShiftStartTime = localStorage.getItem('shiftStartTime');
    const savedShiftEndTime = localStorage.getItem('shiftEndTime');
    const savedSelfHandlingCost = localStorage.getItem('selfHandlingCost');
    const savedEscalationCost = localStorage.getItem('escalationCost');
    const savedBreaksLunches = JSON.parse(localStorage.getItem('breaksLunches')) || [];
    const savedCalls = JSON.parse(localStorage.getItem('calls')) || [];
    const savedBreakDate = new Date().toISOString().split('T')[0];
    
    const savedNotificationSetting = localStorage.getItem('showBreakNotifications');
    if (savedNotificationSetting !== null) {
        showBreakNotifications = JSON.parse(savedNotificationSetting);
    }
    document.getElementById('notificationSwitch').checked = showBreakNotifications;
    dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications')) || [];

    if (savedBreakDate) {
        document.getElementById('breakDate').value = savedBreakDate;
    }
    if (savedShiftDate) {
        document.getElementById('shiftDate').value = savedShiftDate;
        shiftDate = savedShiftDate;
    }
    if (savedShiftStartTime) {
        document.getElementById('startTime').value = savedShiftStartTime;
        shiftStartTime = savedShiftStartTime;
    }
    if (savedShiftEndTime) {
        document.getElementById('endTime').value = savedShiftEndTime;
        shiftEndTime = savedShiftEndTime;
    }

    if (savedSelfHandlingCost) {
        document.getElementById('selfHandlingCost').value = savedSelfHandlingCost;
        document.getElementById('selfHandlingCostMain').value = savedSelfHandlingCost;
    }
    if (savedEscalationCost) {
        document.getElementById('escalationCost').value = savedEscalationCost;
        document.getElementById('escalationCostMain').value = savedEscalationCost;
    }

    breaksLunches = savedBreaksLunches.map((bl, index) => ({ ...bl, id: bl.id || Date.now() + index }));
    calls = savedCalls;

    isLiteMode = JSON.parse(localStorage.getItem('isLiteMode')) || false;
    document.getElementById('liteModeToggle').checked = isLiteMode;
    liteSolved = JSON.parse(localStorage.getItem('liteSolved')) || 0;
    liteEscalated = JSON.parse(localStorage.getItem('liteEscalated')) || 0;
    liteRated = JSON.parse(localStorage.getItem('liteRated')) || 0;

    const hiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];
    hiddenCards.forEach(cardId => {
        const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
        if (card) {
            card.style.display = 'none';
        }
    });
    
    updateTimers();
    updateStatistics();
    updateCallList();
    updateEscalatedCalls();
    updateCallDurationStats();
    updatePostCallDurationStats();
    updateBreaksLunchesList();
    
    applyLiteModeState(); 
    updateLiteModeUI(); 
    updateButtonState();
});

function resetData() {
    if (confirm("Вы уверены, что хотите сбросить все данные? Это действие нельзя отменить.")) {
        localStorage.removeItem('breaksLunches');
        localStorage.removeItem('calls');
        localStorage.removeItem('selfHandlingCost');
        localStorage.removeItem('escalationCost');
        localStorage.removeItem('dismissedNotifications');
        localStorage.removeItem('liteSolved');
        localStorage.removeItem('liteEscalated');
        localStorage.removeItem('liteRated');

        breaksLunches = [];
        calls = [];
        dismissedNotifications = [];
        liteSolved = 0;
        liteEscalated = 0;
        liteRated = 0;

        updateTimers();
        updateStatistics();
        updateCallList();
        updateEscalatedCalls();
        updateCallDurationStats();
        updatePostCallDurationStats();
        updateBreaksLunchesList();
        updateLiteModeUI();

        alert('Данные сброшены!');
    }
}

function updateStatistics() {
    const statistics = document.getElementById('statistics');
    const callCosts = document.getElementById('callCosts');
    statistics.innerHTML = '';
    callCosts.innerHTML = '';

    const totalCalls = calls.length;
    const nonEscalatedCalls = calls.filter(call => !call.escalated).length;
    const escalatedCalls = calls.filter(call => call.escalated).length;
    const totalEarnings = calls.reduce((sum, call) => sum + call.totalCost, 0);
    const nonEscalatedEarnings = calls.filter(call => !call.escalated).reduce((sum, call) => sum + call.totalCost, 0);
    const escalatedEarnings = calls.filter(call => call.escalated).reduce((sum, call) => sum + call.totalCost, 0);
    const nonEscalatedPercentage = totalCalls > 0 ? ((nonEscalatedCalls / totalCalls) * 100).toFixed(2) : '0';
    const escalatedPercentage = totalCalls > 0 ? ((escalatedCalls / totalCalls) * 100).toFixed(2) : '0';
    const ratedCalls = calls.filter(call => call.rated).length;
    const ratedPercentage = totalCalls > 0 ? ((ratedCalls / totalCalls) * 100).toFixed(2) : '0';

    let callsPerHour = 0;
    if (shiftDate && shiftStartTime) {
        const timeSinceShiftStart = new Date() - new Date(`${shiftDate}T${shiftStartTime}`);
        if (timeSinceShiftStart > 0) {
            const hoursSinceShiftStart = timeSinceShiftStart / (1000 * 60 * 60);
            callsPerHour = totalCalls / hoursSinceShiftStart;
        }
    }

    statistics.innerHTML = `
        <div class="bold">Всего звонков: ${totalCalls}</div>
        <div>Звонков в час: ${callsPerHour.toFixed(2)}</div>
        <div>Не эскалированные звонки: ${nonEscalatedCalls} (${nonEscalatedPercentage}%)</div>
        <div>Эскалированные звонки: ${escalatedCalls} (${escalatedPercentage}%)</div>
        <div>Оцененные звонки: ${ratedCalls} (${ratedPercentage}%)</div>
    `;

    callCosts.innerHTML = `
        <div class="bold">Общий заработок: ${totalEarnings.toFixed(2)} БО</div>
        <div>Заработок с не эскалированных звонков: ${nonEscalatedEarnings.toFixed(2)} БО</div>
        <div>Заработок с эскалированных звонков: ${escalatedEarnings.toFixed(2)} БО</div>
    `;
}


function updateCallDurationStats() {
    const callDurationStats = document.getElementById('callDurationStats');
    callDurationStats.innerHTML = '';

    const callDurationCounts = Array(11).fill(0);
    calls.forEach(call => {
        if(call.callDuration) callDurationCounts[call.callDuration - 1]++;
    });

    callDurationStats.innerHTML = `
        <div style="background-color: limegreen; color: black; font-weight: bold; border-top-left-radius: 10px; border-top-right-radius: 10px" class="p-1">От 0-я до 1-й минуты: ${callDurationCounts[0]}</div>
        <div style="background-color: limegreen; color: black; font-weight: bold" class="p-1">От 1-2 минуты: ${callDurationCounts[1]}</div>
        <div style="background-color: limegreen; color: black; font-weight: bold" class="p-1">От 2-3 минуты: ${callDurationCounts[2]}</div>
        <div style="background-color: yellow; color: black; font-weight: bold" class="p-1">От 3-4 минуты: ${callDurationCounts[3]}</div>
        <div style="background-color: yellow; color: black; font-weight: bold" class="p-1">От 4-х 5-и минут: ${callDurationCounts[4]}</div>
        <div style="background-color: yellow; color: black; font-weight: bold" class="p-1">От 5-и 6-и минут: ${callDurationCounts[5]}</div>
        <div style="background-color: darkorange; color: black; font-weight: bold" class="p-1">От 6-и 7-и минут: ${callDurationCounts[6]}</div>
        <div style="background-color: darkorange; color: black; font-weight: bold" class="p-1">От 7-и 8-и минут: ${callDurationCounts[7]}</div>
        <div style="background-color: darkorange; color: black; font-weight: bold" class="p-1">От 8-и 9-и минут: ${callDurationCounts[8]}</div>
        <div style="background-color: red; color: black; font-weight: bold" class="p-1">От 9-и до 10-и минут: ${callDurationCounts[9]}</div>
        <div style="background-color: red; color: black; font-weight: bold; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;" class="p-1">Больше 10 минут: ${callDurationCounts[10]}</div>
    `;
}

function updatePostCallDurationStats() {
    const postCallDurationStats = document.getElementById('postCallDurationStats');
    postCallDurationStats.innerHTML = '';

    const postCallDurationCounts = Array(3).fill(0);
    calls.forEach(call => {
         if(call.postCallDuration) postCallDurationCounts[call.postCallDuration - 1]++;
    });

    postCallDurationStats.innerHTML = `
        <div style="background-color: limegreen; color: black; font-weight: bold; border-top-left-radius: 10px; border-top-right-radius: 10px; " class="p-1">До 30-и секунд: ${postCallDurationCounts[0]}</div>
        <div style="background-color: yellow; color: black; font-weight: bold" class="p-1">От 31-й до 60-и секунд: ${postCallDurationCounts[1]}</div>
        <div style="background-color: red; color: black; font-weight: bold; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;" class="p-1">Больше 60-и секунд: ${postCallDurationCounts[2]}</div>
    `;
}

function updateCallList() {
    const callList = document.getElementById('callList');
    callList.innerHTML = '';

    calls.forEach((call, index) => {
        callList.innerHTML += `
            <div class="card mb-2">
                <div class="card-body">
                    <div>Длительность звонка: ${getCallDurationText(call.callDuration)}</div>
                    <div>Длительность поствызова: ${getPvoDurationText(call.postCallDuration)}</div>
                    <div>Эскалирован: ${call.escalated ? 'Да' : 'Нет'}</div>
                    <div>Оценен: ${call.rated ? 'Да' : 'Нет'}</div>
                    <button class="btn btn-danger btn-sm mt-2" onclick="removeCall(${index})">Удалить</button>
                </div>
            </div>
        `;
    });
}

function updateEscalatedCalls() {
    const escalatedCallsDiv = document.getElementById('escalatedCalls');
    escalatedCallsDiv.innerHTML = '';

    const escalatedCallsData = calls.filter(call => call.escalated);

    escalatedCallsData.forEach((call, index) => {
        const originalIndex = calls.findIndex(c => c === call);
        escalatedCallsDiv.innerHTML += `
            <div class="card mb-2">
                <div class="card-body">
                    <div>Длительность звонка: ${getCallDurationText(call.callDuration)}</div>
                    <div>Длительность поствызова: ${getPvoDurationText(call.postCallDuration)}</div>
                    <div>Вопрос эскалации: ${call.escalationQuestion}</div>
                    <div>Оценен: ${call.rated ? 'Да' : 'Нет'}</div>
                    <button class="btn btn-danger btn-sm mt-2" onclick="removeCall(${originalIndex})">Удалить</button>
                </div>
            </div>
        `;
    });
}

function updateBreaksLunchesList() {
    const breaksLunchesList = document.getElementById('breaksLunchesList');
    breaksLunchesList.innerHTML = '';

    breaksLunches.forEach((breakLunch, index) => {
        breaksLunchesList.innerHTML += `
            <div class="card mb-2">
                <div class="card-body">
                    <div>Дата: ${breakLunch.date}</div>
                    <div>Время начала: ${breakLunch.start}</div>
                    <div>Время окончания: ${breakLunch.end}</div>
                    <div>Тип: ${breakLunch.type === 'break' ? 'Перерыв' : 'Обед'}</div>
                    <button class="btn btn-danger btn-sm mt-2" onclick="removeBreakLunch(${index})">Удалить</button>
                </div>
            </div>
        `;
    });
}

function removeCall(index) {
    calls.splice(index, 1);
    localStorage.setItem('calls', JSON.stringify(calls));
    updateStatistics();
    updateCallList();
    updateEscalatedCalls();
    updateCallDurationStats();
    updatePostCallDurationStats();
}

function removeBreakLunch(index) {
    breaksLunches.splice(index, 1);
    localStorage.setItem('breaksLunches', JSON.stringify(breaksLunches));
    updateBreaksLunchesList();
}

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resetCallForm() {
    document.getElementById('callDuration').selectedIndex = 0;
    document.getElementById('callDuration').style.backgroundColor = "white";
    document.getElementById('callDuration').style.color = "black";
    document.getElementById('postCallDuration').selectedIndex = 0;
    document.getElementById('postCallDuration').style.backgroundColor = "white";
    document.getElementById('postCallDuration').style.color = "black";
    document.getElementById('escalated').checked = false;
    document.getElementById('escalationQuestionInput').value = '';
    document.getElementById('rated').checked = false;
    document.getElementById('escalationQuestion').style.display = 'none';
    updateButtonState();
}

async function exportCalls() {
    if (isLiteMode) {
        alert('Экспорт отключен в Лёгком режиме.');
        return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('История звонков');
    const callDurationColors = {
        "1": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } },
        "2": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } },
        "3": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } },
        "4": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
        "5": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
        "6": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
        "7": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } },
        "8": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } },
        "9": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } },
        "10": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } },
        "11": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
    };
    const pvoDurationColors = {
        "1": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } },
        "2": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
        "3": { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
    };
    worksheet.columns = [
        { header: '№', key: 'index', width: 5, style: { font: { bold: true } } },
        { header: 'Длительность звонка', key: 'callDuration', width: 25, style: { font: { bold: true } } },
        { header: 'Время в ПВО', key: 'postCallDuration', width: 25, style: { font: { bold: true } } },
        { header: 'Эскалирован?', key: 'escalated', width: 15, style: { font: { bold: true } } },
        { header: 'Оценен?', key: 'rated', width: 10, style: { font: { bold: true } } },
        { header: 'Цена', key: 'price', width: 7, style: { font: { bold: true } } },
        { header: 'Дата', key: 'date', width: 21, style: { font: { bold: true } } },
        { header: '', key: 'empty1', width: 10, style: { font: { bold: true } } },
        { header: '', key: 'empty2', width: 34, style: { font: { bold: true } } }
    ];
    const headerStyle = { font: { bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center' } };
    const headerRow = worksheet.getRow(1);
    for (let colNumber = 1; colNumber <= 6; colNumber++) {
        const cell = headerRow.getCell(colNumber);
        cell.style = headerStyle;
    }
    worksheet.getRow(1).getCell(7).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(1).getCell(7).alignment = { horizontal: 'center' };
    calls.forEach((call, index) => {
        const callDurationText = getCallDurationText(call.callDuration);
        const pvoDurationText = getPvoDurationText(call.postCallDuration);
        const escalatedText = call.escalated ? 'Да' : 'Нет';
        const ratedText = call.rated ? 'Да' : 'Нет';
        const priceText = call.escalated ? call.escalationCost.toFixed(2) : call.selfHandlingCost.toFixed(2);
        const callDate = new Date(call.date);
        const dateInfo = callDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeInfo = callDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateText = `${dateInfo} ${timeInfo}`;
        const row = worksheet.addRow([
            index + 1,
            callDurationText,
            pvoDurationText,
            escalatedText,
            ratedText,
            priceText,
            dateText
        ]);
        row.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).fill = callDurationColors[call.callDuration];
        row.getCell(2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(2).font = { bold: false, color: { argb: 'FF000000' } }; // Force black text
        row.getCell(3).fill = pvoDurationColors[call.postCallDuration];
        row.getCell(3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(3).font = { bold: false, color: { argb: 'FF000000' } }; // Force black text
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: call.escalated ? 'FF00FF00' : 'FFFF0000' } };
        row.getCell(4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(4).font = { bold: false };
        row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: call.rated ? 'FF00FF00' : 'FFFF0000' } };
        row.getCell(5).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(5).font = { bold: false };
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: call.escalated ? 'FF8080FF' : 'FF00FF00' } };
        row.getCell(6).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(6).font = { bold: false };
        row.getCell(7).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(7).font = { bold: false };
        if (index === calls.length - 1) {
            row.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(5).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(6).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
            row.getCell(7).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
        }
    });
    
    let hoursSinceShiftStart = 1;
    if(shiftDate && shiftStartTime) {
        const timeSinceShiftStart = new Date() - new Date(`${shiftDate}T${shiftStartTime}`);
        if(timeSinceShiftStart > 0) {
             hoursSinceShiftStart = Math.ceil(timeSinceShiftStart / (1000 * 60 * 60));
        }
    }
    const selfCallsBasicScores = calls.filter(call => !call.escalated).length * parseFloat(document.getElementById('selfHandlingCostMain').value);
    const escalateCallsBasicScores = calls.filter(call => call.escalated).length * parseFloat(document.getElementById('escalationCostMain').value);
    const callDurationCounts = Array(11).fill(0);
    const pvoDurationCounts = Array(3).fill(0);
    calls.forEach(call => {
        if(call.callDuration) callDurationCounts[call.callDuration - 1]++;
        if(call.postCallDuration) pvoDurationCounts[call.postCallDuration - 1]++;
    });
    const totalCalls = calls.length; // Defined for percentage calculation
    const stats = [
        ['Количество звонков:', calls.length],
        ['Звонков в час:', (calls.length / hoursSinceShiftStart).toFixed(2)],
        [],
        ['Количество эскалаций:', calls.filter(call => call.escalated).length],
        ['Процент эскалаций:', (totalCalls > 0 ? (calls.filter(call => call.escalated).length / calls.length) * 100 : 0).toFixed(2) + '%'],
        [],
        ['Количество запросов оценок:', calls.filter(call => call.rated).length],
        ['Процент запросов оценок:', (totalCalls > 0 ? (calls.filter(call => call.rated).length / calls.length) * 100 : 0).toFixed(2) + '%'],
        [],
        ['Заработанные БО:', (selfCallsBasicScores + escalateCallsBasicScores).toFixed(2)],
        ['БО за самостоятельную обработку:', selfCallsBasicScores.toFixed(2)],
        ['БО за эскалирование:', escalateCallsBasicScores.toFixed(2)],
        [],
        ['Звонки до 1-й минуты:', callDurationCounts[0]],
        ['Звонки до 2-х минут:', callDurationCounts[1]],
        ['Звонки до 3-х минут:', callDurationCounts[2]],
        ['Звонки до 4-х минут:', callDurationCounts[3]],
        ['Звонки до 5-и минут:', callDurationCounts[4]],
        ['Звонки до 6-и минут:', callDurationCounts[5]],
        ['Звонки до 7-и минут:', callDurationCounts[6]],
        ['Звонки до 8-и минут:', callDurationCounts[7]],
        ['Звонки до 9-и минут:', callDurationCounts[8]],
        ['Звонки до 10-и минут:', callDurationCounts[9]],
        ['Звонки больше 10 минут:', callDurationCounts[10]],
        [],
        ['ПВО <= 30 секунд:', pvoDurationCounts[0]],
        ['30 секунд < ПВО <= 60 секунд:', pvoDurationCounts[1]],
        ['ПВО > 60 секунд:', pvoDurationCounts[2]]
    ];
    stats.forEach((stat, index) => {
        const row = worksheet.getRow(index + 1);
        row.getCell(9).value = stat[0];
        row.getCell(10).value = stat[1];
    });
    // (Styling for stats cells)
    // ... (rest of exportCalls) ...
    worksheet.getRow(1).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(1).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(1).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(1).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(1).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(2).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(2).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(2).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(2).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(2).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(4).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(4).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(4).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(4).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(4).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(5).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(5).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(5).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(5).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(5).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(7).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(7).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(7).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(7).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(7).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(8).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(8).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(8).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(8).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(8).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(10).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(10).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(10).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(10).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(10).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(11).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(11).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(11).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(11).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(11).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(12).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(12).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8080FF' } };
    worksheet.getRow(12).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(12).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(12).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(14).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(14).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(14).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(14).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(14).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(15).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(15).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(15).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(15).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(15).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(16).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(16).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(16).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(16).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(16).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(17).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(17).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(17).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(17).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(17).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(18).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(18).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(18).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(18).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(18).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(19).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(19).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(19).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(19).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(19).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(20).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(20).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(20).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(20).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(20).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(21).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(21).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(21).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(21).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(21).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(22).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(22).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8000' } };
    worksheet.getRow(22).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(22).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(22).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(23).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(23).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(23).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(23).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(23).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(24).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(24).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(24).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(24).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(24).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(26).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(26).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    worksheet.getRow(26).getCell(9).border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(26).getCell(10).border = { top: { style: 'thick' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(26).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(27).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(27).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.getRow(27).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    worksheet.getRow(27).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thick' } };
    worksheet.getRow(27).getCell(10).alignment = { horizontal: 'left' };
    worksheet.getRow(28).getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(28).getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    worksheet.getRow(28).getCell(9).border = { top: { style: 'thin' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thin' } };
    worksheet.getRow(28).getCell(10).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thick' }, right: { style: 'thick' } };
    worksheet.getRow(28).getCell(10).alignment = { horizontal: 'left' };

    await workbook.xlsx.writeBuffer().then(function(buffer) {
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `История звонков - ${new Date().toLocaleDateString('ru-RU')}.xlsx`);
    });
}

function exportEscalations() {
    if (isLiteMode) {
        alert('Экспорт отключен в Лёгком режиме.');
        return;
    }
    
    const escalatedCalls = calls.filter(call => call.escalated);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('История эскалаций');

    worksheet.columns = [
        { header: '№', key: 'index', width: 5 },
        { header: 'Эскалируемый вопрос', key: 'escalationQuestion', width: 100 }
    ];

    escalatedCalls.forEach((call, index) => {
        worksheet.addRow({ index: index + 1, escalationQuestion: call.escalationQuestion });
    });

    workbook.xlsx.writeBuffer().then(function(buffer) {
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `История эскалаций - ${new Date().toLocaleDateString('ru-RU')}.xlsx`);
    });
}

function getCallDurationText(callDuration) {
    switch (callDuration) {
        case "1": return "От 0-я до 1-й минуты";
        case "2": return "От 1-й до 2-х минут";
        case "3": return "От 2-х до 3-х минут";
        case "4": return "От 3-х до 4-х минут";
        case "5": return "От 4-х до 5-и минут";
        case "6": return "От 5-и до 6-и минут";
        case "7": return "От 6-и до 7-и минут";
        case "8": return "От 7-и до 8-и минут";
        case "9": return "От 8-и до 9-и минут";
        case "10": return "От 9-и до 10-и минут";
        case "11": return "Больше 10 минут";
        default: return "";
    }
}

function getPvoDurationText(pvoDuration) {
    switch (pvoDuration) {
        case "1": return "До 30 секунд";
        case "2": return "От 31 до 60 секунд";
        case "3": return "Больше 60 секунд";
        default: return "";
    }
}

document.getElementById('escalated').addEventListener('change', function() {
    const escalationQuestion = document.getElementById('escalationQuestion');
    if (this.checked) {
        escalationQuestion.style.display = 'block';
    } else {
        escalationQuestion.style.display = 'none';
    }
    updateButtonState();
});

setInterval(updateTimers, 1000);

document.getElementById('resetButton').addEventListener('click', resetData);

function updateButtonState() {
    const callDuration = document.getElementById('callDuration').value;
    const postCallDuration = document.getElementById('postCallDuration').value;
    const escalated = document.getElementById('escalated').checked;
    const escalationQuestion = document.getElementById('escalationQuestionInput').value;
    const button = document.getElementById('addCallButton');
    
    if (isLiteMode) {
        button.disabled = true;
        return;
    }
    
    button.disabled = !(callDuration && postCallDuration && (!escalated || (escalated && escalationQuestion)));
}

document.getElementById('callDuration').addEventListener('input', updateButtonState);
document.getElementById('postCallDuration').addEventListener('input', updateButtonState);
document.getElementById('escalationQuestionInput').addEventListener('input', updateButtonState);


// --- NEW DARK MODE FUNCTION ---
function applyDarkModeState() {
    const toggle = document.getElementById('darkModeToggle');
    const label = document.querySelector('label[for="darkModeToggle"]');
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (toggle) toggle.checked = true;
        if (label) label.textContent = 'Включен';
    } else {
        document.body.classList.remove('dark-mode');
        if (toggle) toggle.checked = false;
        if (label) label.textContent = 'Выключен';
    }
    
    // Reset call duration dropdown styles on theme change
    resetCallForm();
}

// --- LITE MODE FUNCTIONS ---
function applyLiteModeState() {
    const liteModeBlock = document.getElementById('liteModeBlock');
    const toggle = document.getElementById('liteModeToggle');
    const label = document.querySelector('label[for="liteModeToggle"]');
    const manuallyHiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];

    if (isLiteMode) {
        if (!manuallyHiddenCards.includes('liteModeCard')) {
            liteModeBlock.style.display = 'flex';
        }
        liteModeHiddenCards.forEach(cardId => {
            const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
            if (card) {
                card.style.display = 'none';
            }
        });
        
        if (toggle) toggle.checked = true;
        if (label) label.textContent = 'Включен';
    } else {
        liteModeBlock.style.display = 'none';
        liteModeHiddenCards.forEach(cardId => {
            const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
            if (card && !manuallyHiddenCards.includes(cardId)) {
                card.style.display = 'flex';
            }
        });

        if (toggle) toggle.checked = false;
        if (label) label.textContent = 'Выключен';
    }
    
    updateButtonState();
    checkColumnVisibility();
}

// ### MODIFIED FUNCTION ###
function updateLiteModeUI() {
    // Убедимся, что значения стоимости загружены из ГЛАВНОГО поля
    const selfHandlingCost = parseFloat(document.getElementById('selfHandlingCostMain').value) || 0;
    const escalationCost = parseFloat(document.getElementById('escalationCostMain').value) || 0;

    // Обновляем счетчики
    document.getElementById('lite-solved-count').textContent = liteSolved;
    document.getElementById('lite-escalated-count').textContent = liteEscalated;
    document.getElementById('lite-rated-count').textContent = liteRated;

    // Считаем и обновляем статистику
    const totalCalls = liteSolved + liteEscalated; // Всего звонков = Решено + Эскалировано
    document.getElementById('lite-total-calls').textContent = totalCalls;

    // Процент эскалаций
    const escalPercent = totalCalls > 0 ? ((liteEscalated / totalCalls) * 100).toFixed(0) : 0;
    
    // --- NEW LOGIC FOR COLOR ---
    const escalPercentEl = document.getElementById('lite-escal-percent');
    escalPercentEl.textContent = `${escalPercent}%`;
    
    escalPercentEl.classList.remove('color-success', 'color-danger');
    if (escalPercent > 10) {
        escalPercentEl.classList.add('color-danger');
    } else {
        escalPercentEl.classList.add('color-success');
    }
    // --- END NEW LOGIC ---

    // Общий заработок
    const totalEarnings = (liteSolved * selfHandlingCost) + (liteEscalated * escalationCost);
    document.getElementById('lite-total-earnings').textContent = totalEarnings.toFixed(2);
    
    // Сохраняем счетчики в localStorage
    localStorage.setItem('liteSolved', JSON.stringify(liteSolved));
    localStorage.setItem('liteEscalated', JSON.stringify(liteEscalated));
    localStorage.setItem('liteRated', JSON.stringify(liteRated));
}
// --- END LITE MODE FUNCTIONS ---