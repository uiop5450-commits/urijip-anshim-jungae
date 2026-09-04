/**
 * ====================================================================
 * [utils_ui.js] 글로벌 DOM 업데이트 유틸리티 및 알림(Toast) 시스템
 * ====================================================================
 */

function safeUpdateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function safeUpdateValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function maskName(name) {
    if (!name) return '고객';
    const stripped = name.trim();
    if (stripped.length <= 1) return stripped;
    if (stripped.length === 2) return stripped.charAt(0) + '*';
    return stripped.charAt(0) + '*'.repeat(stripped.length - 2) + stripped.charAt(stripped.length - 1);
}

function maskPhone(phone) {
    if (!phone) return '010-****-****';
    const parts = phone.split('-');
    if (parts.length === 3) return `${parts[0]}-****-****`;
    return phone.slice(0, 3) + '-****-' + phone.slice(-4);
}

function getHolidayName(year, month, day) {
    const holidays = {
        '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
        '7-17': '제헌절(임시)', '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절'
    };
    return holidays[`${month}-${day}`] || null;
}

function pushLog(category, target, message, status = 'INFO') {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    window.AppState.logs.unshift({ time: timeStr, category, target, message, status });
    if (window.AppState.logs.length > 300) window.AppState.logs.length = 300;
    if (typeof syncAuditLogs === 'function') syncAuditLogs();
}

/* ----------------------------------------------------------------
 * 실시간 알림(Toast) 스택 — 비차단형, 자동 소멸, 접근성 aria-live
 * ---------------------------------------------------------------- */
const TOAST_ICONS = {
    success: { icon: 'check-circle', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
    warning: { icon: 'alert-circle', bg: 'bg-amber-50', fg: 'text-amberCustom' },
    info:    { icon: 'bell', bg: 'bg-brand-50', fg: 'text-brand-500' },
    error:   { icon: 'x-circle', bg: 'bg-rose-50', fg: 'text-roseCustom' }
};

function ensureToastStack() {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'fixed top-4 right-4 z-[650] flex flex-col gap-2 items-end pointer-events-none';
        document.body.appendChild(stack);
    }
    return stack;
}

function showToast(message, type = 'info') {
    if (!message) return;
    const stack = ensureToastStack();
    const meta = TOAST_ICONS[type] || TOAST_ICONS.info;

    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.setAttribute('aria-live', 'polite');
    item.className = 'pointer-events-auto w-[min(360px,88vw)] bg-white rounded-2xl border border-ink-100 p-4 flex items-start gap-3 transform translate-x-4 opacity-0 transition-all duration-300';
    item.style.boxShadow = 'var(--shadow-3)';
    item.innerHTML = `
        <span class="w-8 h-8 rounded-xl ${meta.bg} ${meta.fg} flex items-center justify-center shrink-0">
            <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
        </span>
        <p class="text-xs font-bold text-ink-800 leading-relaxed flex-1 whitespace-pre-line pt-1">${message.replace(/</g, '&lt;')}</p>
        <button type="button" class="text-ink-300 hover:text-ink-600 bg-transparent border-0 cursor-pointer shrink-0 p-0.5" aria-label="알림 닫기">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
    `;
    stack.appendChild(item);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    requestAnimationFrame(() => {
        item.classList.remove('translate-x-4', 'opacity-0');
    });

    const dismiss = () => {
        if (!item.isConnected) return;
        item.classList.add('translate-x-4', 'opacity-0');
        setTimeout(() => item.remove(), 260);
    };

    item.querySelector('button').onclick = dismiss;
    const timer = setTimeout(dismiss, 4200);
    item.addEventListener('mouseenter', () => clearTimeout(timer));
}

/* 레거시 중앙 모달형 알림(선택적 사용) — id 유지용 */
function closeToast() {
    const toast = document.getElementById('custom-toast');
    const toastCard = document.getElementById('custom-toast-card');
    if (toast && toastCard) {
        toastCard.classList.remove('scale-100', 'opacity-100');
        toastCard.classList.add('scale-95', 'opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 200);
    }
}

window.safeUpdateText = safeUpdateText;
window.safeUpdateValue = safeUpdateValue;
window.maskName = maskName;
window.maskPhone = maskPhone;
window.getHolidayName = getHolidayName;
window.pushLog = pushLog;
window.showToast = showToast;
window.closeToast = closeToast;
