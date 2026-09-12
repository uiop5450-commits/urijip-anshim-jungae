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

/* 빈 목록 상태 공용 마크업 — 마이페이지 의뢰이력/파트너 오더심사 등에서 이미 쓰던
 * "아이콘 칩 + 짧은 안내문" 패턴을 재사용해, 목록마다 텍스트 한 줄로만 다르게
 * 보이던 것(팜플렛/직원목록/내글/알림)을 통일한다. */
function buildEmptyStateHtml(icon, message) {
    return `<div class="text-center py-8 space-y-2.5">
        <span class="w-10 h-10 rounded-2xl bg-ink-100 text-ink-400 flex items-center justify-center mx-auto"><i data-lucide="${icon}" class="w-5 h-5"></i></span>
        <p class="text-xs font-bold text-ink-500">${message}</p>
    </div>`;
}

/* 검색창 옆 X(지우기) 버튼 — 입력값이 있을 때만 보이고, 누르면 비운 뒤 해당 목록의
 * 렌더 함수를 다시 호출해 필터를 즉시 초기화한다(파트너 탐색/커뮤니티/관리자 모니터링 검색 공용). */
function toggleSearchClearBtn(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.classList.toggle('hidden', input.value.length === 0);
}

function clearSearchInput(inputId, btnId, renderFnName) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = '';
    toggleSearchClearBtn(inputId, btnId);
    if (typeof window[renderFnName] === 'function') window[renderFnName]();
    input.focus();
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

/* new Date().toISOString()은 UTC 기준이라, 한국 시간 00~09시 사이에는 실제 날짜보다
 * 하루 이른 날짜를 반환한다(예: KST 새벽 3시 = UTC로는 아직 전날). 계약서 발행일자,
 * 댓글/게시글 작성일, 캘린더 "지난 날짜" 판정처럼 실제 달력 날짜가 중요한 곳은
 * 브라우저 로컬 시간 기준으로 이 함수를 써야 한다. */
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    // 매니저 권한이 계정별로 분리되고 만료일까지 지정할 수 있게 됐는데(4065e13), 정작
    // 관제 로그의 개별 관리자 조치 대부분은 "매니저가"로만 기록되어 여러 스태프 중
    // 누가 실제로 그 조치를 했는지 알 방법이 없었다 — 호출부 36곳을 전부 고치는
    // 대신 이 한 곳에서 실명을 메시지 앞에 붙인다.
    if (category === 'MANAGER' && window.AppState.managerName) {
        message = `[${window.AppState.managerName}] ${message}`;
    }
    window.AppState.logs.unshift({ time: timeStr, category, target, message, status });
    if (window.AppState.logs.length > 300) window.AppState.logs.length = 300;
    if (typeof syncAuditLogs === 'function') syncAuditLogs();
}

/* 고객 마이페이지 > 알림 탭에 쌓이는 개인화 알림. 토스트는 그 순간 안 보면 사라지지만
 * 이 목록은 남아있어서, 매칭/배정/계약 같은 이력을 나중에 다시 확인할 수 있다. */
function pushClientNotification(clientPhone, message, extra) {
    if (!clientPhone) return;
    // 지금까지 알림을 끌 방법이 전혀 없었다 — 계정 설정에서 끄면(notificationsEnabled=false)
    // 이 시점에서 조용히 무시한다(구버전 계정은 필드가 없으므로 !== false로 기본값 켜짐 유지).
    const account = (window.AppState.clientAccounts || []).find(acc => acc.phone === clientPhone);
    if (account && account.notificationsEnabled === false) return;
    window.AppState.clientNotifications.unshift({
        id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        clientPhone, message, date: new Date().toISOString(), read: false,
        ...(extra || {})
    });
    if (window.AppState.clientNotifications.length > 200) window.AppState.clientNotifications.length = 200;
    if (typeof renderClientMyPage === 'function') renderClientMyPage();
}

/* 후기/시공사례/커뮤니티 글·댓글·답글 신고가 전부 원클릭·사유 없이 처리되어,
 * 관리자는 신고 "건수"만 보고 정작 "왜" 신고됐는지 전혀 알 수 없었다 — 신고 사유를
 * 입력받는 모달 하나를 여러 신고 지점이 공유하고, 제출 시 등록해둔 콜백을 사유와
 * 함께 실행한다(콜백 쪽에서 실제 reportXxx 함수를 사유와 함께 호출). */
let _reportReasonPendingCallback = null;

function openReportReasonPrompt(onSubmit) {
    _reportReasonPendingCallback = onSubmit;
    if (typeof safeUpdateValue === 'function') safeUpdateValue('report-reason-input', '');
    if (typeof openModal === 'function') openModal('report-reason-modal', 'report-reason-modal-card');
}

function closeReportReasonPrompt() {
    _reportReasonPendingCallback = null;
    if (typeof closeModal === 'function') closeModal('report-reason-modal', 'report-reason-modal-card');
}

function submitReportReasonPrompt() {
    const reason = document.getElementById('report-reason-input')?.value.trim();
    if (!reason) { showToast('신고 사유를 입력해 주세요.', 'warning'); return; }
    const callback = _reportReasonPendingCallback;
    closeReportReasonPrompt();
    if (typeof callback === 'function') callback(reason);
}

/* 후기/시공사례/커뮤니티 글·댓글·답글을 신고해도(reportReview/reportPortfolio/
 * reportCommunityPost 등, 모두 clientAuth.id를 reportedBy 배열에 쌓는 동일 패턴)
 * 관리자가 실제로 조치했는지 신고자는 전혀 알 방법이 없었다 — 신고 처리(삭제) 시점에
 * reportedBy에 쌓인 신고자 전원에게 한 번에 알린다. */
/* reportReasons([{id, reason}, ...])를 관리자 모더레이션 목록에서 공통으로 보여주는
 * 작은 마크업 조각. 사유를 남기지 않은(구버전) 신고는 그냥 건수만 표시되므로 빈
 * 배열/undefined면 아무것도 렌더링하지 않는다. */
function buildReportReasonsHtml(reportReasons) {
    if (!reportReasons || reportReasons.length === 0) return '';
    return `<div class="mt-1.5 space-y-1">${reportReasons.map(r => `<p class="text-[10px] text-roseCustom font-semibold leading-relaxed">· ${escapeHtml(r.reason)}</p>`).join('')}</div>`;
}

function notifyReportResolved(reportedByIds, message) {
    if (!reportedByIds || reportedByIds.length === 0 || typeof pushClientNotification !== 'function') return;
    (window.AppState.clientAccounts || []).forEach(acc => {
        if (reportedByIds.includes(acc.id) && acc.phone) pushClientNotification(acc.phone, message);
    });
}

/* 파트너 콘솔 > 알림 탭에 쌓이는 개인화 알림. 지금까지 파트너는 새 오더 매칭·계약
 * 체결·후기 등록·경고/제명 같은 중요한 이벤트를 알 방법이 전혀 없었다(고객에게만
 * pushClientNotification이 있었음) — 동일한 패턴으로 파트너용도 추가한다. */
function pushPartnerNotification(partnerName, message, extra) {
    if (!partnerName) return;
    const partner = (window.AppState.partners || []).find(p => p.name === partnerName);
    if (partner && partner.notificationsEnabled === false) return;
    window.AppState.partnerNotifications.unshift({
        id: `pntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        partnerName, message, date: new Date().toISOString(), read: false,
        ...(extra || {})
    });
    if (window.AppState.partnerNotifications.length > 200) window.AppState.partnerNotifications.length = 200;
    if (typeof renderPartnerNotifications === 'function') renderPartnerNotifications();
    if (typeof updatePartnerNotificationBadge === 'function') updatePartnerNotificationBadge();
}

/* 계약 체결 후 고객이 확인할 수 있는 건 서명·서류·수수료 결제 상태뿐이라, 실제
 * 시공이 지금 어느 단계인지는 전혀 알 방법이 없었다 — 일정/금액 변경 요청과
 * 하자보수는 있지만 "지금 뭐가 진행되고 있는지"에 대한 답이 없는 공백이었다.
 * 계약 진행 스테퍼(renderPartnerContractProgressStepperHtml, partner_panel.js)와
 * 동일한 시각적 패턴을 시공 단계에도 재사용한다. */
const CONSTRUCTION_PROGRESS_STAGE_LABELS = ['철거', '설비/골조', '마감', '준공'];

function getOrInitProgressStages(order) {
    if (!order.progressStages) {
        order.progressStages = CONSTRUCTION_PROGRESS_STAGE_LABELS.map(label => ({ label, done: false, date: null }));
    }
    return order.progressStages;
}

/* commissionPaid는 플랫폼 중개 수수료 완납 여부만 표시할 뿐, 정작 고객이 파트너에게
 * 지불하는 공사대금 자체는 finalPrice 총액 하나로만 다뤄졌다 — 실제 인테리어 계약은
 * 항상 계약금/중도금/잔금으로 나눠 단계별로 청구·지급되는데 그 흐름을 추적할
 * 방법이 전혀 없었다. 방금 추가한 시공 진행 단계(progressStages)와 자연스럽게
 * 짝을 이루는 지급 마일스톤을 둔다. */
const PAYMENT_MILESTONE_DEFS = [
    { key: 'downpayment', label: '계약금', percent: 30 },
    { key: 'interim', label: '중도금', percent: 40 },
    { key: 'final', label: '잔금', percent: 30 }
];

function getOrInitPaymentMilestones(order) {
    if (!order.paymentMilestones) {
        order.paymentMilestones = PAYMENT_MILESTONE_DEFS.map(def => ({ ...def, status: 'pending', requestedDate: null, paidDate: null }));
    }
    return order.paymentMilestones;
}

/* 홈 화면 이벤트 배너(pamphlets, config_state.js)가 "첫 견적 신청 5만원 상품권",
 * "후기 작성 10만원 상품권", "계약 시 3년 하자이행보증 쿠폰"을 100% 증정한다고
 * 광고하지만, 실제로 이 혜택을 적립·확인할 방법이 어디에도 없었다 — 순수 마케팅
 * 문구뿐인 광고-미구현 공백. 견적 신청/계약 양측 서명/후기 작성(사진 3장+50자
 * 이상) 시점에 계정에 적립하고, 마이페이지에서 확인·수령 신청할 수 있게 한다. */
function grantClientBenefit(clientPhone, type, label, amount, orderCode) {
    if (!clientPhone) return;
    const account = (window.AppState.clientAccounts || []).find(a => a.phone === clientPhone);
    if (!account) return;
    if (!account.benefits) account.benefits = [];
    const dupKey = orderCode ? `${type}:${orderCode}` : type;
    if (account.benefits.some(b => (b.orderCode ? `${b.type}:${b.orderCode}` : b.type) === dupKey)) return;

    account.benefits.unshift({
        id: `bnf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type, label, amount, orderCode: orderCode || null,
        status: 'eligible', earnedDate: getLocalDateString(), claimedDate: null
    });
    if (typeof pushClientNotification === 'function') pushClientNotification(clientPhone, `혜택이 적립되었습니다: ${label} (${amount}) — 마이페이지에서 확인하세요.`);
    if (typeof renderClientBenefitsStatus === 'function') renderClientBenefitsStatus();
}

/* 아직 구현되지 않은 부가 링크(이용약관 등) 클릭 시 보여줄 안내 — 죽은 링크로 보이지 않게. */
function showComingSoon(label) {
    showToast(`${label}은(는) 준비 중인 페이지예요.`, 'info');
}

/* 푸터의 이용약관/개인정보처리방침/사업자정보확인 링크 — 지금까지는 showComingSoon()만
 * 띄우는 죽은 링크였다. 실제 내용을 보여주는 모달로 교체한다("고객센터"는 별도의
 * 1:1 문의 티켓 시스템으로 이미 교체됨 — openSupportInquiryModal 참고). */
const FOOTER_INFO_CONTENT = {
    terms: {
        title: '이용약관',
        body: `제1조 (목적)
이 약관은 (주)우리집안심중개(이하 "회사")가 제공하는 인테리어 중개 서비스의
이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정합니다.

제2조 (서비스의 제공)
회사는 이용자와 검증된 인테리어 파트너사를 중개하며, 매칭·견적 비교·계약
체결 지원 서비스를 제공합니다.

제3조 (회원의 의무)
이용자는 서비스 이용 시 허위 정보를 등록하거나 타인의 권리를 침해하는
행위를 해서는 안 됩니다.

제4조 (책임의 한계)
회사는 중개 플랫폼으로서 파트너사와 이용자 간 실제 계약의 이행에 대해
보증 범위 내에서만 책임을 부담합니다.`
    },
    privacy: {
        title: '개인정보처리방침',
        body: `(주)우리집안심중개는 이용자의 개인정보를 중요시하며, 관련 법령을 준수합니다.

1. 수집하는 개인정보
성명, 휴대폰 번호, 시공 희망 주소, 예산 등 견적 신청 시 입력하는 정보를
수집합니다.

2. 이용 목적
파트너사 매칭, 계약 진행 안내, 고객센터 문의 응대 목적으로만 이용합니다.

3. 보유 및 이용 기간
서비스 이용 종료 또는 회원 탈퇴 시까지 보유하며, 관계 법령에 따라 일정
기간 보관이 필요한 정보는 해당 기간 동안 보관합니다.

4. 문의
개인정보 관련 문의는 고객센터(1:1 문의)를 통해 접수해 주세요.`
    },
    bizinfo: {
        title: '사업자정보확인',
        body: `상호: (주)우리집안심중개
대표자: 박서준
사업자등록번호: 000-00-00000
주소: 부산광역시 해운대구 센텀중앙로 90, 8층
고객센터: 1588-0000 (평일 09:00~18:00)

본 서비스는 프로토타입 데모이며, 위 사업자 정보는 실제 등록된 사업자가
아닌 데모용 예시 정보입니다.`
    }
};

function openFooterInfoModal(type) {
    const info = FOOTER_INFO_CONTENT[type];
    if (!info) return;
    safeUpdateText('footer-info-modal-title', info.title);
    const bodyEl = document.getElementById('footer-info-modal-body');
    if (bodyEl) bodyEl.innerText = info.body;
    const modal = document.getElementById('footer-info-modal');
    const card = document.getElementById('footer-info-modal-card');
    if (!modal || !card) return;
    modal.classList.remove('hidden');
    setTimeout(() => card.classList.add('modal-open'), 30);
}

function closeFooterInfoModal() {
    const modal = document.getElementById('footer-info-modal');
    const card = document.getElementById('footer-info-modal-card');
    if (modal && card) { card.classList.remove('modal-open'); setTimeout(() => modal.classList.add('hidden'), 150); }
}

/* ----------------------------------------------------------------
 * 실시간 알림(Toast) 스택 — 비차단형, 자동 소멸, 접근성 aria-live
 * ---------------------------------------------------------------- */
/* accent는 관리자 KPI 카드(.kpi-card::before)와 같은 "좌측 컬러 레일" 색상 —
 * 토스트도 같은 언어를 써서 큰 컬러 아이콘 칩 대신 얇은 레일 + 작은 아이콘으로 조용하게 알린다. */
const TOAST_ICONS = {
    success: { icon: 'check-circle', accent: 'var(--emerald-500)' },
    warning: { icon: 'alert-circle', accent: 'var(--amber-500)' },
    info:    { icon: 'bell', accent: 'var(--brand-500)' },
    error:   { icon: 'x-circle', accent: 'var(--rose-500)' }
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
    item.className = 'pointer-events-auto w-[min(440px,92vw)] bg-white border border-ink-100 pl-4 pr-3 py-3.5 flex items-start gap-2.5 transform -translate-y-3 opacity-0 transition-all duration-300';
    item.style.boxShadow = 'var(--shadow-2)';
    item.style.borderLeft = `3px solid ${meta.accent}`;
    item.innerHTML = `
        <i data-lucide="${meta.icon}" class="w-4 h-4 mt-0.5 shrink-0" style="color:${meta.accent}"></i>
        <p class="text-[13px] font-bold text-ink-800 leading-relaxed flex-1 whitespace-pre-line pt-px">${message.replace(/</g, '&lt;')}</p>
        <button type="button" class="text-ink-300 hover:text-ink-600 bg-transparent border-0 cursor-pointer shrink-0 p-0.5" aria-label="알림 닫기">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
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
window.toggleSearchClearBtn = toggleSearchClearBtn;
window.buildEmptyStateHtml = buildEmptyStateHtml;
window.clearSearchInput = clearSearchInput;
window.pushClientNotification = pushClientNotification;
window.pushPartnerNotification = pushPartnerNotification;
window.notifyReportResolved = notifyReportResolved;
window.buildReportReasonsHtml = buildReportReasonsHtml;
window.openReportReasonPrompt = openReportReasonPrompt;
window.closeReportReasonPrompt = closeReportReasonPrompt;
window.submitReportReasonPrompt = submitReportReasonPrompt;
window.showComingSoon = showComingSoon;
window.openFooterInfoModal = openFooterInfoModal;
window.closeFooterInfoModal = closeFooterInfoModal;
window.getLocalDateString = getLocalDateString;
window.getOrInitProgressStages = getOrInitProgressStages;
window.getOrInitPaymentMilestones = getOrInitPaymentMilestones;
window.grantClientBenefit = grantClientBenefit;
window.showToast = showToast;
window.closeToast = closeToast;
