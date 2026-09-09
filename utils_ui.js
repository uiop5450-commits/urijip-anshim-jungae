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

/* 사용자 입력값(제목/이름/댓글 등)을 innerHTML에 삽입하기 전 반드시 이 함수로 이스케이프한다.
 * 그렇지 않으면 회원가입 아이디·이름, 커뮤니티 글 제목 같은 자유 입력 필드에 <script>나
 * onerror= 같은 페이로드를 넣어 다른 사용자·관리자 세션에서 실행시키는 저장형 XSS가 가능하다. */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

// 설날·추석·대체공휴일처럼 매년 날짜가 바뀌거나(음력) 요일에 따라 정해지는 공휴일은
// 고정 월-일 표로 계산할 수 없어, 확인된 연도만 별도 표에 정확한 날짜로 채워둔다.
// (2026년 기준 — 출처: 정부 공휴일 발표. 다른 연도는 음력 공휴일이 표시되지 않는다.)
const YEARLY_LUNAR_AND_SUBSTITUTE_HOLIDAYS = {
    2026: {
        '2-16': '설날 연휴', '2-17': '설날', '2-18': '설날 연휴',
        '3-2': '삼일절 대체공휴일',
        '8-17': '광복절 대체공휴일',
        '9-24': '추석 연휴', '9-25': '추석', '9-26': '추석 연휴',
        '10-5': '개천절 대체공휴일'
    }
};

function getHolidayName(year, month, day) {
    const yearTable = YEARLY_LUNAR_AND_SUBSTITUTE_HOLIDAYS[year];
    if (yearTable && yearTable[`${month}-${day}`]) return yearTable[`${month}-${day}`];

    const fixedHolidays = {
        '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
        '7-17': '제헌절', '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절'
    };
    return fixedHolidays[`${month}-${day}`] || null;
}

function pushLog(category, target, message, status = 'INFO') {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    window.AppState.logs.unshift({ time: timeStr, category, target, message, status });
    if (window.AppState.logs.length > 300) window.AppState.logs.length = 300;
    if (typeof syncAuditLogs === 'function') syncAuditLogs();
}

/* 고객 마이페이지 > 알림 탭에 쌓이는 개인화 알림. 토스트는 그 순간 안 보면 사라지지만
 * 이 목록은 남아있어서, 매칭/배정/계약 같은 이력을 나중에 다시 확인할 수 있다. */
function pushClientNotification(clientPhone, message) {
    if (!clientPhone) return;
    window.AppState.clientNotifications.unshift({
        id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        clientPhone, message, date: new Date().toISOString(), read: false
    });
    if (window.AppState.clientNotifications.length > 200) window.AppState.clientNotifications.length = 200;
    if (typeof renderClientMyPage === 'function') renderClientMyPage();
}

/* 아직 구현되지 않은 부가 링크(이용약관 등) 클릭 시 보여줄 안내 — 죽은 링크로 보이지 않게. */
function showComingSoon(label) {
    showToast(`${label}은(는) 준비 중인 페이지예요.`, 'info');
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
        stack.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[650] flex flex-col gap-2.5 items-center pointer-events-none';
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
    item.className = 'pointer-events-auto w-[min(480px,92vw)] bg-white rounded-2xl border border-ink-100 p-5 flex items-start gap-3.5 transform -translate-y-3 opacity-0 transition-all duration-300';
    item.style.boxShadow = 'var(--shadow-3)';
    item.innerHTML = `
        <span class="w-10 h-10 rounded-xl ${meta.bg} ${meta.fg} flex items-center justify-center shrink-0">
            <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
        </span>
        <p class="text-sm font-bold text-ink-800 leading-relaxed flex-1 whitespace-pre-line pt-1.5">${message.replace(/</g, '&lt;')}</p>
        <button type="button" class="text-ink-300 hover:text-ink-600 bg-transparent border-0 cursor-pointer shrink-0 p-0.5" aria-label="알림 닫기">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;
    stack.appendChild(item);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    requestAnimationFrame(() => {
        item.classList.remove('-translate-y-3', 'opacity-0');
    });

    const dismiss = () => {
        if (!item.isConnected) return;
        item.classList.add('-translate-y-3', 'opacity-0');
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
window.escapeHtml = escapeHtml;
window.maskPhone = maskPhone;
window.getHolidayName = getHolidayName;
window.pushLog = pushLog;
window.pushClientNotification = pushClientNotification;
window.showComingSoon = showComingSoon;
window.showToast = showToast;
window.closeToast = closeToast;
