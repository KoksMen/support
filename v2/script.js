let shiftDate = null;
let shiftStartTime = null;
let shiftEndTime = null;
let breaksLunches = [];
let calls = [];
let payIntervals = [];

// --- GLOBAL VARS ---
let notificationInterval = null;
let notifiedBreakId = null; 
let showBreakNotifications = true;
let saveEscalationText = true; 
let breakNotificationModal; 
let isInitialLoad = true;
let dismissedNotifications = [];
let originalTitle = document.title;
let titleFlashInterval = null;

// --- MODES & SETTINGS ---
// 'light', 'medium', 'complex'
let currentMode = 'complex'; 
let isDarkMode = false;
let isSwapButtons = false; 
let globalMultiplier = 1; 
let liteSolved = 0;
let liteEscalated = 0;
let liteRated = 0;
const liteModeHiddenCards = ['card1', 'card3', 'card4', 'card5', 'card6', 'card11', 'card13', 'card14']; 

// --- MAPS ---
const callDurationMap = { "1": 30, "2": 90, "3": 150, "4": 210, "5": 270, "6": 330, "7": 390, "8": 450, "9": 510, "10": 570, "11": 720 };
const pvoDurationMap = { "1": 15, "2": 45, "3": 90 };

function getDurationColorClass(val) {
    const v = parseInt(val);
    if(v <= 3) return 'bg-green';
    if(v <= 6) return 'bg-yellow';
    if(v <= 9) return 'bg-orange';
    return 'bg-red';
}
function getPvoColorClass(val) {
    const v = parseInt(val);
    if(v === 1) return 'bg-green';
    if(v === 2) return 'bg-yellow';
    return 'bg-red';
}

// --- HELPER FUNCTIONS ---
function checkColumnVisibility() {
    document.querySelectorAll('.oo-col').forEach(col => {
        const cardsInCol = col.querySelectorAll('.card');
        if (cardsInCol.length > 0) {
            const allCardsHidden = Array.from(cardsInCol).every(c => c.style.display === 'none');
            col.style.display = allCardsHidden ? 'none' : 'flex';
        } else {
             col.style.display = 'flex';
        }
    });
}
function getMultiplierForTime(dateObj) {
    if (!payIntervals || payIntervals.length === 0) return globalMultiplier;
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    for (const interval of payIntervals) {
        if (timeStr >= interval.start && timeStr < interval.end) return interval.multiplier;
    }
    return globalMultiplier;
}
function getSelfHandlingCost(callDateObj) {
    const baseCost = parseFloat(document.getElementById('selfHandlingCostMain').value) || 0;
    const multiplier = callDateObj ? getMultiplierForTime(callDateObj) : globalMultiplier;
    return baseCost * multiplier;
}
function getEscalationCost(callDateObj) {
    const baseCost = parseFloat(document.getElementById('escalationCostMain').value) || 0;
    const multiplier = callDateObj ? getMultiplierForTime(callDateObj) : globalMultiplier;
    return baseCost * multiplier;
}

function flashTitle(isBreak, breakText) {
    if (isBreak) {
        if (!titleFlashInterval) {
            let state = false;
            const link = document.querySelector("link[rel~='icon']");
            // if(link) link.href = "break_icon.ico"; 
            
            titleFlashInterval = setInterval(() => {
                document.title = state ? originalTitle : `☕ ${breakText.toUpperCase()}!`;
                state = !state;
            }, 1000);
        }
    } else {
        if (titleFlashInterval) {
            clearInterval(titleFlashInterval);
            titleFlashInterval = null;
            document.title = originalTitle;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Modal
    const modalElement = document.getElementById('breakNotificationModal');
    if (modalElement) {
        breakNotificationModal = new bootstrap.Modal(modalElement);
        modalElement.addEventListener('hidden.bs.modal', function () {
            if (notificationInterval) { clearInterval(notificationInterval); notificationInterval = null; }
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
    const saveEscalationTextToggle = document.getElementById('saveEscalationTextToggle');
    if(saveEscalationTextToggle) {
        saveEscalationTextToggle.addEventListener('change', function() {
            saveEscalationText = this.checked;
            localStorage.setItem('saveEscalationText', JSON.stringify(saveEscalationText));
            updateEscalationVisibility();
        });
    }
    
    // Toggles
    document.getElementById('darkModeToggle').addEventListener('change', function() {
        isDarkMode = this.checked; localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode)); applyDarkModeState();
    });
    
    const swapButtonsToggle = document.getElementById('swapButtonsToggle');
    if(swapButtonsToggle) {
        swapButtonsToggle.addEventListener('change', function() {
            isSwapButtons = this.checked;
            localStorage.setItem('isSwapButtons', JSON.stringify(isSwapButtons));
            applyButtonOrder();
        });
    }

    // Mode Selector Listener
    document.querySelectorAll('input[name="appMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentMode = this.value;
            localStorage.setItem('currentMode', currentMode);
            applyModeLogic();
        });
    });

    document.querySelectorAll('input[name="globalMultiplier"]').forEach(radio => {
        radio.addEventListener('change', function() {
            globalMultiplier = parseInt(this.value); localStorage.setItem('globalMultiplier', globalMultiplier); updateStatistics(); updateLiteModeUI();
        });
    });

    // Medium Mode Input Listeners
    document.querySelectorAll('input[name="medCallDur"]').forEach(radio => {
        radio.addEventListener('change', function() { document.getElementById('callDuration').value = this.value; updateButtonState(); });
    });
    document.querySelectorAll('input[name="medPvoDur"]').forEach(radio => {
        radio.addEventListener('change', function() { document.getElementById('postCallDuration').value = this.value; updateButtonState(); });
    });
    
    document.querySelectorAll('input[name="medEscalated"]').forEach(radio => {
        radio.addEventListener('change', function() { 
            const val = this.value === 'true';
            document.getElementById('escalated').checked = val;
            document.getElementById('escalated').dispatchEvent(new Event('change'));
        });
    });
    document.querySelectorAll('input[name="medRated"]').forEach(radio => {
        radio.addEventListener('change', function() { 
            const val = this.value === 'true';
            document.getElementById('rated').checked = val;
        });
    });


    // Lite Buttons
    document.getElementById('lite-solved-plus').addEventListener('click', () => { liteSolved++; updateLiteModeUI(); });
    document.getElementById('lite-solved-minus').addEventListener('click', () => { if (liteSolved > 0) liteSolved--; updateLiteModeUI(); });
    document.getElementById('lite-escalated-plus').addEventListener('click', () => { liteEscalated++; updateLiteModeUI(); });
    document.getElementById('lite-escalated-minus').addEventListener('click', () => { if (liteEscalated > 0) liteEscalated--; updateLiteModeUI(); });
    document.getElementById('lite-rated-plus').addEventListener('click', () => { liteRated++; updateLiteModeUI(); });
    document.getElementById('lite-rated-minus').addEventListener('click', () => { if (liteRated > 0) liteRated--; updateLiteModeUI(); });
    
    // Hide/Show
    document.querySelectorAll('.hide-card-btn').forEach(button => {
        button.addEventListener('click', function() {
            const cardId = this.getAttribute('data-card-id');
            const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
            if (card) {
                let hiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];
                if (card.style.display === 'none') {
                    card.style.display = 'flex';
                    hiddenCards = hiddenCards.filter(id => id !== cardId);
                } else {
                    card.style.display = 'none';
                    if (!hiddenCards.includes(cardId)) hiddenCards.push(cardId);
                }
                localStorage.setItem('hiddenCards', JSON.stringify(hiddenCards));
                checkColumnVisibility();
                if(cardId === 'card14') updateEscalationVisibility(); 
            }
        });
    });
    document.getElementById('resetVisibilityButton').addEventListener('click', function() {
        localStorage.removeItem('hiddenCards');
        document.querySelectorAll('.card').forEach(card => { if (card.id !== 'liteModeBlock') card.style.display = 'flex'; });
        applyModeLogic();
        updateEscalationVisibility(); 
    });
    document.getElementById('resetOrderButton').addEventListener('click', function() {
        if(confirm("Сбросить расположение блоков?")) { localStorage.removeItem('cardOrder'); location.reload(); }
    });

    initSortableDragDrop(); loadCardOrder();
});

function initSortableDragDrop() {
    const columns = document.querySelectorAll('.oo-col');
    columns.forEach(col => {
        new Sortable(col, { group: 'shared', handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', onSort: function (evt) { saveCardOrder(); checkColumnVisibility(); } });
    });
}
function saveCardOrder() {
    const order = {};
    document.querySelectorAll('.oo-col').forEach(col => { const cardIds = []; col.querySelectorAll('.card').forEach(card => { cardIds.push(card.getAttribute('data-card-id')); }); order[col.id] = cardIds; });
    localStorage.setItem('cardOrder', JSON.stringify(order));
}
function loadCardOrder() {
    const order = JSON.parse(localStorage.getItem('cardOrder'));
    if (!order) return;
    for (const [colId, cardIds] of Object.entries(order)) { const col = document.getElementById(colId); if (col) { cardIds.forEach(cardId => { const card = document.querySelector(`.card[data-card-id="${cardId}"]`); if (card) col.appendChild(card); }); } }
}

document.getElementById('callDuration').addEventListener('change', function() { updateButtonState(); });
document.getElementById('postCallDuration').addEventListener('change', function() { updateButtonState(); });
window.addEventListener('beforeunload', function(event) { event.preventDefault(); event.returnValue = ''; });

// ... (Add Shift, Break, Pay Interval same) ...
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
    if(!breakStartTime || !breakEndTime) { alert('Заполните время перерыва'); return; }
    const breakId = Date.now(); 
    breaksLunches.push({ id: breakId, date: breakDate, start: breakStartTime, end: breakEndTime, type: breakType });
    localStorage.setItem('breaksLunches', JSON.stringify(breaksLunches));
    updateTimers(); updateBreaksLunchesList();
}
function addPayInterval() {
    const start = document.getElementById('payStartTime').value;
    const end = document.getElementById('payEndTime').value;
    const multiplier = parseInt(document.getElementById('payMultiplierSelect').value);
    if (!start || !end) { alert("Укажите начало и конец интервала"); return; }
    payIntervals.push({ id: Date.now(), start, end, multiplier });
    localStorage.setItem('payIntervals', JSON.stringify(payIntervals));
    updatePayIntervalList(); updateStatistics(); updateLiteModeUI();
}
function removePayInterval(id) {
    payIntervals = payIntervals.filter(i => i.id !== id);
    localStorage.setItem('payIntervals', JSON.stringify(payIntervals));
    updatePayIntervalList(); updateStatistics(); updateLiteModeUI();
}
function updatePayIntervalList() {
    const list = document.getElementById('payIntervalList');
    list.innerHTML = '';
    payIntervals.sort((a,b) => a.start.localeCompare(b.start));
    payIntervals.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent px-0';
        li.innerHTML = `<div><span class="badge bg-secondary me-2">${item.start} - ${item.end}</span><span class="badge bg-success rounded-pill">x${item.multiplier}</span></div><button class="btn btn-sm btn-outline-danger border-0" onclick="removePayInterval(${item.id})"><i class="bi bi-x-lg"></i></button>`;
        list.appendChild(li);
    });
}

function addCall() {
    if (currentMode === 'light') { alert('Добавление звонков отключено в Лёгком режиме.'); return; }

    const callDuration = document.getElementById('callDuration').value;
    const postCallDuration = document.getElementById('postCallDuration').value;
    const escalated = document.getElementById('escalated').checked;
    let escalationQuestion = document.getElementById('escalationQuestionInput').value;
    const rated = document.getElementById('rated').checked;
    
    if (callDuration === "" || postCallDuration === "") { alert("Нужно выбрать время звонка и поствызова!"); return; }
    if (escalated && saveEscalationText && escalationQuestion === "") { alert("В эскалируемом звонке, должен быть указан эскалируемый вопрос!"); return; }
    if (!saveEscalationText) escalationQuestion = ""; 

    calls.push({ callDuration, postCallDuration, escalated, escalationQuestion, rated, date: new Date() });
    localStorage.setItem('calls', JSON.stringify(calls));

    updateStatistics(); updateCallList(); updateEscalatedCalls(); updateCallDurationStats(); updatePostCallDurationStats();
    resetCallForm();
}

function updateTimers() {
    const now = new Date();
    const shiftTimer = document.getElementById('shiftTimer');
    const breakTimers = document.getElementById('breakTimers');
    shiftTimer.innerHTML = ''; breakTimers.innerHTML = '';

    if (shiftDate && shiftStartTime && shiftEndTime) {
        const start = new Date(`${shiftDate}T${shiftStartTime}`);
        const end = new Date(`${shiftDate}T${shiftEndTime}`);
        const timeToStart = start - now;
        const timeToEnd = end - now;
        if (timeToStart > 0) shiftTimer.innerHTML = `<div class="text-primary"><i class="bi bi-hourglass-top"></i> ${formatTime(timeToStart)}</div><div class="fs-6 text-muted">до начала</div>`;
        else if (timeToEnd > 0) shiftTimer.innerHTML = `<div class="text-success"><i class="bi bi-hourglass-split"></i> ${formatTime(timeToEnd)}</div><div class="fs-6 text-muted">до конца</div>`;
        else shiftTimer.innerHTML = '<div class="text-secondary">Смена закончена</div>';
    }
    const activeBreak = breaksLunches.find(bl => { const start = new Date(`${bl.date}T${bl.start}`); const end = new Date(`${bl.date}T${bl.end}`); return now >= start && now < end; });
    if (activeBreak) {
        const start = new Date(`${activeBreak.date}T${activeBreak.start}`);
        const end = new Date(`${activeBreak.date}T${activeBreak.end}`);
        const timeToEnd = end - now; const timeElapsed = now - start;
        const typeText = activeBreak.type === 'break' ? 'перерыв' : 'обед'; const typeIcon = activeBreak.type === 'break' ? 'bi-cup-hot-fill' : 'bi-egg-fried';
        const displayType = typeText.charAt(0).toUpperCase() + typeText.slice(1);
        
        breakTimers.innerHTML = `<div class="text-danger fw-bold fs-5 mt-2"><i class="${typeIcon}"></i> Идет ${typeText}</div><div class="fs-4 fw-bold">${formatTime(timeToEnd)}</div><small class="text-muted">Прошло: ${formatTime(timeElapsed)}</small>`;
        
        flashTitle(true, displayType); 

        if (showBreakNotifications && !isInitialLoad && !dismissedNotifications.includes(activeBreak.id)) {
            notifiedBreakId = activeBreak.id; const elapsedTimeSpan = document.getElementById('elapsedTime');
            document.getElementById('notificationTitle').textContent = displayType + '!';
            if (notificationInterval) clearInterval(notificationInterval);
            elapsedTimeSpan.textContent = formatTime(new Date() - start);
            notificationInterval = setInterval(() => { const elapsed = new Date() - start; elapsedTimeSpan.textContent = formatTime(elapsed); }, 1000);
            if (breakNotificationModal) breakNotificationModal.show();
        }
    } else {
        flashTitle(false); 
        const upcomingBreaks = breaksLunches.filter(bl => new Date(`${bl.date}T${bl.start}`) > now).sort((a, b) => new Date(`${a.date}T${a.start}`) - new Date(`${b.date}T${b.start}`));
        if (upcomingBreaks.length > 0) {
            const nextBreak = upcomingBreaks[0]; const start = new Date(`${nextBreak.date}T${nextBreak.start}`); const timeToStart = start - now; const typeText = nextBreak.type === 'break' ? 'перерыва' : 'обеда';
            breakTimers.innerHTML = `<div class="mt-2 text-primary fw-bold"><i class="bi bi-clock-history"></i> ${formatTime(timeToStart)}</div><small>до ${typeText}</small>`;
        } else { breakTimers.innerHTML = '<div class="mt-2 text-muted small">Нет перерывов</div>'; }
    }
    if (isInitialLoad) isInitialLoad = false;
}

function saveCallCost() {
    const selfHandlingCost = parseFloat(document.getElementById('selfHandlingCostMain').value);
    const escalationCost = parseFloat(document.getElementById('escalationCostMain').value);
    localStorage.setItem('selfHandlingCost', selfHandlingCost);
    localStorage.setItem('escalationCost', escalationCost);
    if (currentMode === 'light') updateLiteModeUI(); else { updateStatistics(); updateCallList(); }
    alert('Стоимость звонков сохранена!');
}

window.addEventListener('load', function() {
    isDarkMode = JSON.parse(localStorage.getItem('isDarkMode')) || false; applyDarkModeState();
    const savedShiftDate = new Date().toISOString().split('T')[0];
    const savedShiftStartTime = localStorage.getItem('shiftStartTime');
    const savedShiftEndTime = localStorage.getItem('shiftEndTime');
    const savedSelfHandlingCost = localStorage.getItem('selfHandlingCost');
    const savedEscalationCost = localStorage.getItem('escalationCost');
    const savedBreaksLunches = JSON.parse(localStorage.getItem('breaksLunches')) || [];
    const savedCalls = JSON.parse(localStorage.getItem('calls')) || [];
    const savedBreakDate = new Date().toISOString().split('T')[0];
    const savedPayIntervals = JSON.parse(localStorage.getItem('payIntervals')) || [];
    const savedNotificationSetting = localStorage.getItem('showBreakNotifications');
    if (savedNotificationSetting !== null) showBreakNotifications = JSON.parse(savedNotificationSetting);
    document.getElementById('notificationSwitch').checked = showBreakNotifications;
    dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications')) || [];
    const savedEscalationSetting = localStorage.getItem('saveEscalationText');
    if (savedEscalationSetting !== null) saveEscalationText = JSON.parse(savedEscalationSetting);
    const escalationToggle = document.getElementById('saveEscalationTextToggle');
    if (escalationToggle) escalationToggle.checked = saveEscalationText;
    
    const savedSwapButtons = localStorage.getItem('isSwapButtons');
    if (savedSwapButtons !== null) isSwapButtons = JSON.parse(savedSwapButtons);
    const swapToggle = document.getElementById('swapButtonsToggle');
    if(swapToggle) swapToggle.checked = isSwapButtons;

    if (savedBreakDate) document.getElementById('breakDate').value = savedBreakDate;
    if (savedShiftDate) { document.getElementById('shiftDate').value = savedShiftDate; shiftDate = savedShiftDate; }
    if (savedShiftStartTime) { document.getElementById('startTime').value = savedShiftStartTime; shiftStartTime = savedShiftStartTime; }
    if (savedShiftEndTime) { document.getElementById('endTime').value = savedShiftEndTime; shiftEndTime = savedShiftEndTime; }
    if (savedSelfHandlingCost) document.getElementById('selfHandlingCostMain').value = savedSelfHandlingCost;
    if (savedEscalationCost) document.getElementById('escalationCostMain').value = savedEscalationCost;
    breaksLunches = savedBreaksLunches.map((bl, index) => ({ ...bl, id: bl.id || Date.now() + index }));
    calls = savedCalls.map(c => ({...c, date: new Date(c.date)})); payIntervals = savedPayIntervals;
    
    // Modes
    let savedMode = localStorage.getItem('currentMode');
    if (!savedMode) {
        const oldLite = JSON.parse(localStorage.getItem('isLiteMode'));
        savedMode = oldLite ? 'light' : 'complex';
    }
    currentMode = savedMode;
    const modeRadio = document.querySelector(`input[name="appMode"][value="${currentMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    globalMultiplier = JSON.parse(localStorage.getItem('globalMultiplier')) || 1;
    const radio = document.querySelector(`input[name="globalMultiplier"][value="${globalMultiplier}"]`);
    if(radio) radio.checked = true;
    liteSolved = JSON.parse(localStorage.getItem('liteSolved')) || 0;
    liteEscalated = JSON.parse(localStorage.getItem('liteEscalated')) || 0;
    liteRated = JSON.parse(localStorage.getItem('liteRated')) || 0;
    
    const hiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];
    hiddenCards.forEach(cardId => { const card = document.querySelector(`.card[data-card-id="${cardId}"]`); if (card) card.style.display = 'none'; });
    
    updateTimers(); updatePayIntervalList(); updateStatistics(); updateCallList(); updateEscalatedCalls(); updateCallDurationStats(); updatePostCallDurationStats(); updateBreaksLunchesList(); 
    
    applyModeLogic(); 
    applyButtonOrder();
    updateEscalationVisibility(); 
    
    updateLiteModeUI(); updateButtonState();
});

function applyModeLogic() {
    const liteModeBlock = document.getElementById('liteModeBlock');
    const complexInputs = document.getElementById('complexInputs');
    const mediumInputs = document.getElementById('mediumInputs');
    const complexSwitches = document.getElementById('complexSwitches');
    const manuallyHiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];

    if (currentMode === 'light') {
        if (!manuallyHiddenCards.includes('liteModeCard')) liteModeBlock.style.display = 'flex';
        liteModeHiddenCards.forEach(cardId => { const card = document.querySelector(`.card[data-card-id="${cardId}"]`); if (card) card.style.display = 'none'; });
        complexInputs.style.display = 'none'; mediumInputs.style.display = 'none';
        if(complexSwitches) complexSwitches.style.display = 'none';
    } else {
        liteModeBlock.style.display = 'none';
        liteModeHiddenCards.forEach(cardId => { const card = document.querySelector(`.card[data-card-id="${cardId}"]`); if (card && !manuallyHiddenCards.includes(cardId)) card.style.display = 'flex'; });
        
        if (currentMode === 'medium') {
            complexInputs.style.display = 'none';
            if(complexSwitches) complexSwitches.style.display = 'none'; 
            mediumInputs.style.display = 'block';
        } else {
            complexInputs.style.display = 'block';
            if(complexSwitches) complexSwitches.style.display = 'block'; 
            mediumInputs.style.display = 'none';
        }
    }
    updateButtonState();
    checkColumnVisibility();
    updateEscalationVisibility(); 
}

function applyButtonOrder() {
    const containers = ['medCallContainer', 'medPvoContainer', 'medEscContainer', 'medRateContainer'];
    
    containers.forEach(id => {
        const container = document.getElementById(id);
        if(!container) return;
        
        const leftWrapper = container.querySelector('.swap-wrapper[data-side="left"]');
        const rightWrapper = container.querySelector('.swap-wrapper[data-side="right"]');
        
        if (leftWrapper && rightWrapper) {
            container.innerHTML = '';
            if (isSwapButtons) {
                container.appendChild(rightWrapper);
                container.appendChild(leftWrapper);
            } else {
                container.appendChild(leftWrapper);
                container.appendChild(rightWrapper);
            }
        }
    });
}

function resetData() {
    if (confirm("Вы уверены, что хотите сбросить все данные? Это действие нельзя отменить.")) {
        localStorage.removeItem('breaksLunches'); localStorage.removeItem('calls'); localStorage.removeItem('selfHandlingCost'); localStorage.removeItem('escalationCost'); localStorage.removeItem('dismissedNotifications'); localStorage.removeItem('liteSolved'); localStorage.removeItem('liteEscalated'); localStorage.removeItem('liteRated'); localStorage.removeItem('payIntervals');
        localStorage.removeItem('shiftStartTime'); localStorage.removeItem('shiftEndTime');
        shiftDate = null; shiftStartTime = null; shiftEndTime = null;
        document.getElementById('shiftDate').value = ''; document.getElementById('startTime').value = ''; document.getElementById('endTime').value = '';
        breaksLunches = []; calls = []; dismissedNotifications = []; payIntervals = []; liteSolved = 0; liteEscalated = 0; liteRated = 0;
        updateTimers(); updatePayIntervalList(); updateStatistics(); updateCallList(); updateEscalatedCalls(); updateCallDurationStats(); updatePostCallDurationStats(); updateBreaksLunchesList(); updateLiteModeUI();
        alert('Данные сброшены!');
    }
}

// ... (Stats, CalcAverage, UpdateDurationStats, UpdatePvoStats, UpdateCallList, UpdateEscalatedCalls, UpdateBreaksList, RemoveCall, RemoveBreak, FormatTime, ResetCallForm SAME AS BEFORE) ...
function updateStatistics() {
    const statistics = document.getElementById('statistics'); const callCosts = document.getElementById('callCosts'); statistics.innerHTML = ''; callCosts.innerHTML = '';
    const totalCalls = calls.length; const nonEscalatedCalls = calls.filter(call => !call.escalated).length; const escalatedCalls = calls.filter(call => call.escalated).length;
    let totalEarnings = 0; let nonEscalatedEarnings = 0; let escalatedEarnings = 0;
    calls.forEach(call => { const callDate = new Date(call.date); const selfCost = getSelfHandlingCost(callDate); const escCost = getEscalationCost(callDate); if (call.escalated) { escalatedEarnings += escCost; totalEarnings += escCost; } else { nonEscalatedEarnings += selfCost; totalEarnings += selfCost; } });
    const nonEscalatedPercentage = totalCalls > 0 ? ((nonEscalatedCalls / totalCalls) * 100).toFixed(2) : '0'; const escalatedPercentage = totalCalls > 0 ? ((escalatedCalls / totalCalls) * 100).toFixed(2) : '0'; const ratedCalls = calls.filter(call => call.rated).length; const ratedPercentage = totalCalls > 0 ? ((ratedCalls / totalCalls) * 100).toFixed(2) : '0';
    let callsPerHour = 0; if (shiftDate && shiftStartTime) { const timeSinceShiftStart = new Date() - new Date(`${shiftDate}T${shiftStartTime}`); if (timeSinceShiftStart > 0) { const hoursSinceShiftStart = timeSinceShiftStart / (1000 * 60 * 60); callsPerHour = totalCalls / hoursSinceShiftStart; } }
    statistics.innerHTML = `<div class="row g-2"><div class="col-6"><small class="text-muted"><i class="bi bi-telephone"></i> Всего:</small><div class="fw-bold">${totalCalls}</div></div><div class="col-6"><small class="text-muted"><i class="bi bi-speedometer2"></i> В час:</small><div class="fw-bold">${callsPerHour.toFixed(2)}</div></div><div class="col-6"><small class="text-muted"><i class="bi bi-check-circle"></i> Не эскал.:</small><div class="fw-bold text-success">${nonEscalatedCalls} (${nonEscalatedPercentage}%)</div></div><div class="col-6"><small class="text-muted"><i class="bi bi-arrow-up-right-circle"></i> Эскал.:</small><div class="fw-bold text-danger">${escalatedCalls} (${escalatedPercentage}%)</div></div><div class="col-12"><small class="text-muted"><i class="bi bi-star"></i> Оцененные:</small><div class="fw-bold text-primary">${ratedCalls} (${ratedPercentage}%)</div></div></div>`;
    callCosts.innerHTML = `<div class="d-flex justify-content-between border-bottom pb-2 mb-2"><span><i class="bi bi-wallet2 me-1"></i>Всего:</span><span class="fw-bold fs-5 text-success">${totalEarnings.toFixed(2)} БО</span></div><div class="small text-muted d-flex justify-content-between"><span>Обычные:</span><span>${nonEscalatedEarnings.toFixed(2)} БО</span></div><div class="small text-muted d-flex justify-content-between"><span>Эскалации:</span><span>${escalatedEarnings.toFixed(2)} БО</span></div>`;
}
function calculateAverageTime(totalSeconds) { if (totalSeconds === 0) return "00:00"; const minutes = Math.floor(totalSeconds / 60); const seconds = Math.floor(totalSeconds % 60); return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
function updateCallDurationStats() { const callDurationStats = document.getElementById('callDurationStats'); const avgDisplay = document.getElementById('avgCallDuration'); callDurationStats.innerHTML = ''; const callDurationCounts = Array(11).fill(0); let totalWeightedSeconds = 0; let countWithDuration = 0; calls.forEach(call => { if(call.callDuration) { callDurationCounts[call.callDuration - 1]++; totalWeightedSeconds += callDurationMap[call.callDuration]; countWithDuration++; } }); const avgSeconds = countWithDuration > 0 ? totalWeightedSeconds / countWithDuration : 0; avgDisplay.textContent = calculateAverageTime(avgSeconds); const labels = ["0-1м", "1-2м", "2-3м", "3-4м", "4-5м", "5-6м", "6-7м", "7-8м", "8-9м", "9-10м", ">10м"]; labels.forEach((label, i) => { if(callDurationCounts[i] > 0) { const colorClass = getDurationColorClass(i + 1); callDurationStats.innerHTML += `<div class="stat-row ${colorClass}"><span><i class="bi bi-clock me-2"></i>${label}</span><span class="badge bg-white text-dark rounded-pill">${callDurationCounts[i]}</span></div>`; } }); if(callDurationStats.innerHTML === '') callDurationStats.innerHTML = '<div class="text-muted text-center small">Нет данных</div>'; }
function updatePostCallDurationStats() { const postCallDurationStats = document.getElementById('postCallDurationStats'); const avgDisplay = document.getElementById('avgPvoDuration'); postCallDurationStats.innerHTML = ''; const postCallDurationCounts = Array(3).fill(0); let totalWeightedSeconds = 0; let countWithDuration = 0; calls.forEach(call => { if(call.postCallDuration) { postCallDurationCounts[call.postCallDuration - 1]++; totalWeightedSeconds += pvoDurationMap[call.postCallDuration]; countWithDuration++; } }); const avgSeconds = countWithDuration > 0 ? totalWeightedSeconds / countWithDuration : 0; avgDisplay.textContent = calculateAverageTime(avgSeconds); const labels = ["<30 сек", "30-60 сек", ">60 сек"]; labels.forEach((label, i) => { if(postCallDurationCounts[i] > 0) { const colorClass = getPvoColorClass(i + 1); postCallDurationStats.innerHTML += `<div class="stat-row ${colorClass}"><span><i class="bi bi-stopwatch me-2"></i>${label}</span> <span class="badge bg-white text-dark rounded-pill">${postCallDurationCounts[i]}</span></div>`; } }); if(postCallDurationStats.innerHTML === '') postCallDurationStats.innerHTML = '<div class="text-muted text-center small">Нет данных</div>'; }
function updateCallList() { const callList = document.getElementById('callList'); callList.innerHTML = ''; calls.forEach((call, index) => { const callDate = new Date(call.date); const cost = call.escalated ? getEscalationCost(callDate) : getSelfHandlingCost(callDate); const multiplier = getMultiplierForTime(callDate); const timeString = callDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); const getBadgeClass = (val, type) => { const v = parseInt(val); if (type === 'call') return v <= 3 ? 'bg-success text-white' : (v <= 9 ? 'bg-warning text-dark' : 'bg-danger text-white'); return v === 1 ? 'bg-success text-white' : (v === 2 ? 'bg-warning text-dark' : 'bg-danger text-white'); }; const itemHtml = `<div class="call-history-item p-3 position-relative"><div class="d-flex justify-content-between align-items-center mb-2"><span class="badge bg-light text-dark border"><i class="bi bi-clock"></i> ${timeString}</span><span class="fw-bold text-success">${cost.toFixed(2)} (x${multiplier})</span></div><div class="d-flex gap-2 mb-2"><span class="badge ${getBadgeClass(call.callDuration, 'call')} rounded-pill"><i class="bi bi-hourglass-split"></i> ${getCallDurationText(call.callDuration)}</span><span class="badge ${getBadgeClass(call.postCallDuration, 'pvo')} rounded-pill"><i class="bi bi-hourglass"></i> ${getPvoDurationText(call.postCallDuration)}</span></div><div class="d-flex gap-2">${call.escalated ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger">Эскалация</span>' : '<span class="badge bg-success bg-opacity-10 text-success border border-success">Решено</span>'}${call.rated ? '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="bi bi-star-fill"></i> Оценен</span>' : ''}</div><button class="btn btn-sm text-danger position-absolute top-0 end-0 m-1 p-1" onclick="removeCall(${index})"><i class="bi bi-trash"></i></button></div>`; callList.innerHTML += itemHtml; }); }
function updateEscalatedCalls() { const escalatedCallsDiv = document.getElementById('escalatedCalls'); escalatedCallsDiv.innerHTML = ''; const escalatedCallsData = calls.filter(call => call.escalated); escalatedCallsData.forEach((call, index) => { const originalIndex = calls.findIndex(c => c === call); const displayText = call.escalationQuestion ? call.escalationQuestion : '<span class="text-muted fst-italic">Текст не сохранен</span>'; escalatedCallsDiv.innerHTML += `<div class="call-history-item p-3 position-relative"><div class="small fw-bold mb-2 text-dark"><i class="bi bi-chat-quote me-1"></i>${displayText}</div><div class="d-flex justify-content-between small text-muted border-top pt-2 mt-2"><span>${getCallDurationText(call.callDuration)}</span><span>${getPvoDurationText(call.postCallDuration)}</span></div><button class="btn btn-sm text-danger position-absolute top-0 end-0 m-1 p-1" onclick="removeCall(${originalIndex})"><i class="bi bi-trash"></i></button></div>`; }); }
function updateBreaksLunchesList() { const breaksLunchesList = document.getElementById('breaksLunchesList'); breaksLunchesList.innerHTML = ''; breaksLunches.forEach((breakLunch, index) => { const typeBadge = breakLunch.type === 'break' ? '<span class="badge bg-info text-dark">Перерыв</span>' : '<span class="badge bg-warning text-dark">Обед</span>'; breaksLunchesList.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><div>${typeBadge}<span class="fw-bold ms-2 font-monospace">${breakLunch.start} - ${breakLunch.end}</span><div class="small text-muted ms-1">${breakLunch.date}</div></div><button class="btn btn-sm btn-outline-danger border-0" onclick="removeBreakLunch(${index})"><i class="bi bi-x-lg"></i></button></div>`; }); }
function removeCall(index) { calls.splice(index, 1); localStorage.setItem('calls', JSON.stringify(calls)); updateStatistics(); updateCallList(); updateEscalatedCalls(); updateCallDurationStats(); updatePostCallDurationStats(); }
function removeBreakLunch(index) { breaksLunches.splice(index, 1); localStorage.setItem('breaksLunches', JSON.stringify(breaksLunches)); updateBreaksLunchesList(); }
function formatTime(ms) { if (ms < 0) ms = 0; const totalSeconds = Math.floor(ms / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
function resetCallForm() { const callDur = document.getElementById('callDuration'); callDur.selectedIndex = 0; callDur.style.backgroundColor = ""; callDur.style.color = ""; callDur.style.fontWeight = ""; const postCallDur = document.getElementById('postCallDuration'); postCallDur.selectedIndex = 0; postCallDur.style.backgroundColor = ""; postCallDur.style.color = ""; postCallDur.style.fontWeight = ""; document.getElementById('escalated').checked = false; document.getElementById('escalationQuestionInput').value = ''; document.getElementById('rated').checked = false; document.getElementById('escalationQuestion').style.display = 'none'; document.querySelectorAll('input[name="medCallDur"]').forEach(r => r.checked = false); document.querySelectorAll('input[name="medPvoDur"]').forEach(r => r.checked = false); document.getElementById('medEscNo').checked = true; document.getElementById('medRateNo').checked = true; updateButtonState(); }

// VISIBILITY FIX: Always checks global setting first
function updateEscalationVisibility() {
    const block = document.getElementById('escalationBlock'); 
    const btn = document.getElementById('exportEscalationBtn'); 
    const inputGroup = document.getElementById('escalationQuestion');
    const manuallyHiddenCards = JSON.parse(localStorage.getItem('hiddenCards')) || [];

    if (!saveEscalationText) { 
        if(block) block.style.display = 'none'; 
        if(btn) btn.style.display = 'none'; 
        if(inputGroup) inputGroup.classList.add('d-none'); 
    } else { 
        // Logic: if Setting is ON, show it UNLESS hidden manually or mode is Lite
        if(btn) btn.style.display = 'inline-block'; 
        if(inputGroup) {
             // In complex mode, escalation input is shown when checkbox is checked. Handled by checkbox listener.
             // Just remove the 'd-none' which is the hard override.
             inputGroup.classList.remove('d-none'); 
        }
        
        if (currentMode === 'light') {
             if(block) block.style.display = 'none';
        } else {
             // Normal mode. Show block unless manually hidden
             if(block) {
                 if (manuallyHiddenCards.includes('card14')) {
                     block.style.display = 'none';
                 } else {
                     block.style.display = 'flex'; // Restore
                 }
             }
        }
    }
}

// === EXPORT FUNCTIONS (IMPROVED STYLES) ===
async function exportCalls() {
    if (currentMode === 'light') { alert('Экспорт отключен в Лёгком режиме.'); return; }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('История звонков');

    // Headers
    worksheet.columns = [
        { header: '№', key: 'index', width: 5 },
        { header: '⏳ Длительность', key: 'callDuration', width: 25 },
        { header: '⏱ ПВО', key: 'postCallDuration', width: 25 },
        { header: '📢 Эскалация', key: 'escalated', width: 15 },
        { header: '⭐ Оценка', key: 'rated', width: 15 },
        { header: '💰 Цена', key: 'price', width: 15 },
        { header: '📅 Дата', key: 'date', width: 22 }
    ];

    // Header Style
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; // Blue header
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    // Fills definitions
    const fills = {
        green: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E7DD' } }, // Success
        yellow: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }, // Warning
        orange: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBD1' } }, // Orange
        red: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } },   // Danger
        none: { type: 'pattern', pattern: 'none' }
    };

    calls.forEach((call, index) => {
        const row = worksheet.addRow([
            index + 1,
            getCallDurationText(call.callDuration),
            getPvoDurationText(call.postCallDuration),
            call.escalated ? '❗ Да' : 'Нет',
            call.rated ? '⭐ Да' : 'Нет',
            (call.escalated ? getEscalationCost(new Date(call.date)) : getSelfHandlingCost(new Date(call.date))).toFixed(2),
            new Date(call.date).toLocaleString('ru-RU')
        ]);

        const rowIndex = index + 2; // 1-based + header

        // Styling Cells
        // Center all
        row.alignment = { horizontal: 'center' };
        
        // Colors for Duration
        let durColor = fills.none;
        const durVal = parseInt(call.callDuration);
        if(durVal <= 3) durColor = fills.green;
        else if(durVal <= 6) durColor = fills.yellow;
        else if(durVal <= 9) durColor = fills.orange;
        else durColor = fills.red;
        worksheet.getCell(`B${rowIndex}`).fill = durColor;

        // Colors for PVO
        let pvoColor = fills.none;
        const pvoVal = parseInt(call.postCallDuration);
        if(pvoVal === 1) pvoColor = fills.green;
        else if(pvoVal === 2) pvoColor = fills.yellow;
        else pvoColor = fills.red;
        worksheet.getCell(`C${rowIndex}`).fill = pvoColor;

        // Colors for Escalation
        if (call.escalated) worksheet.getCell(`D${rowIndex}`).font = { color: { argb: 'FFFF0000' }, bold: true };
        
        // Borders
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // Totals Section at the bottom
    const totalRowIndex = calls.length + 4;
    worksheet.getCell(`A${totalRowIndex}`).value = "ИТОГИ:";
    worksheet.getCell(`A${totalRowIndex}`).font = { bold: true, size: 12 };
    
    // Simple stats output
    const stats = [
        ['Всего звонков:', calls.length],
        ['Эскалаций:', calls.filter(c=>c.escalated).length],
        ['Оценок:', calls.filter(c=>c.rated).length]
    ];
    
    stats.forEach((stat, i) => {
        const r = totalRowIndex + i + 1;
        worksheet.getCell(`A${r}`).value = stat[0];
        worksheet.getCell(`B${r}`).value = stat[1];
        worksheet.getCell(`A${r}`).font = { bold: true };
    });

    await workbook.xlsx.writeBuffer().then(function(buffer) {
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Звонки_${new Date().toLocaleDateString()}.xlsx`);
    });
}

function exportEscalations() {
    if (currentMode === 'light') { alert('Экспорт отключен в Лёгком режиме.'); return; }
    if (!saveEscalationText) { alert('Сохранение текста эскалаций отключено.'); return; }
    const escalatedCalls = calls.filter(call => call.escalated);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('История эскалаций');
    
    worksheet.columns = [{ header: '№', key: 'index', width: 5 }, { header: '📝 Вопрос эскалации', key: 'question', width: 100 }];
    
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }; // Dark Red
    
    escalatedCalls.forEach((call, index) => { 
        const row = worksheet.addRow({ index: index + 1, question: call.escalationQuestion });
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { wrapText: true }; // Wrap text for questions
        row.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
    
    workbook.xlsx.writeBuffer().then(function(buffer) {
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Эскалации_${new Date().toLocaleDateString()}.xlsx`);
    });
}

function getCallDurationText(val) { if(!val) return ""; const map = { "1": "0-1 мин", "2": "1-2 мин", "3": "2-3 мин", "4": "3-4 мин", "5": "4-5 мин", "6": "5-6 мин", "7": "6-7 мин", "8": "7-8 мин", "9": "8-9 мин", "10": "9-10 мин", "11": "> 10 мин" }; return map[val] || val; }
function getPvoDurationText(val) { if(!val) return ""; const map = {"1": "< 30 сек", "2": "30-60 сек", "3": "> 60 сек"}; return map[val] || val; }
document.getElementById('escalated').addEventListener('change', function() { 
    const inputGroup = document.getElementById('escalationQuestion'); 
    if (this.checked && saveEscalationText) { inputGroup.style.display = 'block'; } else { inputGroup.style.display = 'none'; } 
    updateButtonState(); 
});
setInterval(updateTimers, 1000);
document.getElementById('resetButton').addEventListener('click', resetData);
function updateButtonState() {
    const callDuration = document.getElementById('callDuration').value; const postCallDuration = document.getElementById('postCallDuration').value;
    const escalated = document.getElementById('escalated').checked; const escalationQuestion = document.getElementById('escalationQuestionInput').value;
    const button = document.getElementById('addCallButton');
    if (currentMode === 'light') { button.disabled = true; return; }
    if (escalated && saveEscalationText) { button.disabled = !(callDuration && postCallDuration && escalationQuestion); } else { button.disabled = !(callDuration && postCallDuration); }
}
document.getElementById('callDuration').addEventListener('input', updateButtonState); document.getElementById('postCallDuration').addEventListener('input', updateButtonState); document.getElementById('escalationQuestionInput').addEventListener('input', updateButtonState);
function applyDarkModeState() { const toggle = document.getElementById('darkModeToggle'); const label = document.querySelector('label[for="darkModeToggle"]'); if (isDarkMode) { document.body.classList.add('dark-mode'); if (toggle) toggle.checked = true; if (label) label.textContent = 'Включен'; } else { document.body.classList.remove('dark-mode'); if (toggle) toggle.checked = false; if (label) label.textContent = 'Выключен'; } resetCallForm(); }
function updateLiteModeUI() {
    const now = new Date(); const selfHandlingCost = parseFloat(document.getElementById('selfHandlingCostMain').value) || 0; const escalationCost = parseFloat(document.getElementById('escalationCostMain').value) || 0; const currentMultiplier = getMultiplierForTime(now);
    document.getElementById('lite-solved-count').textContent = liteSolved; document.getElementById('lite-escalated-count').textContent = liteEscalated; document.getElementById('lite-rated-count').textContent = liteRated;
    const totalCalls = liteSolved + liteEscalated; document.getElementById('lite-total-calls').textContent = totalCalls;
    const escalPercent = totalCalls > 0 ? ((liteEscalated / totalCalls) * 100).toFixed(0) : 0; const escalPercentEl = document.getElementById('lite-escal-percent'); escalPercentEl.textContent = `${escalPercent}%`; escalPercentEl.style.color = escalPercent > 10 ? 'var(--stat-danger)' : 'var(--stat-success)';
    const totalEarnings = ((liteSolved * selfHandlingCost) + (liteEscalated * escalationCost)) * currentMultiplier; const earningsEl = document.getElementById('lite-total-earnings'); earningsEl.textContent = totalEarnings.toFixed(2) + (currentMultiplier > 1 ? ` (x${currentMultiplier})` : '');
    localStorage.setItem('liteSolved', JSON.stringify(liteSolved)); localStorage.setItem('liteEscalated', JSON.stringify(liteEscalated)); localStorage.setItem('liteRated', JSON.stringify(liteRated));
}