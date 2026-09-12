/**
 * ====================================================================
 * [client_panel.js] 고객 견적 신청 달력, 폼 제어, 안심 매칭 엔진,
 * 마이페이지 내 견적 상세/상담, 리뷰 작성
 * ====================================================================
 */

var safeUpdateValue = window.safeUpdateValue || function(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
};
var safeUpdateText = window.safeUpdateText || function(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
};
var showToast = window.showToast || function(msg, type) { console.log(`[Toast] ${type || 'info'}: ${msg}`); };
var escapeHtml = window.escapeHtml || function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

function changeMonth(dir) {
    window.AppState.calendar.month += dir;
    if (window.AppState.calendar.month > 12) { window.AppState.calendar.month = 1; window.AppState.calendar.year++; }
    else if (window.AppState.calendar.month < 1) { window.AppState.calendar.month = 12; window.AppState.calendar.year--; }
    renderCalendar();
}

function renderCalendar() {
    const calDaysGrid = document.getElementById('calendar-days');
    const calTitle = document.getElementById('calendar-title');
    if (!calDaysGrid || !calTitle) return;

    calDaysGrid.innerHTML = '';
    const year = window.AppState.calendar.year;
    const month = window.AppState.calendar.month;
    calTitle.innerText = `${year}년 ${month}월`;

    const todayStr = getLocalDateString();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) calDaysGrid.appendChild(document.createElement('div'));

    for (let d = 1; d <= totalDays; d++) {
        const dayCell = document.createElement('button');
        dayCell.type = 'button';
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isPast = dateString < todayStr;

        const isSelected = window.AppState.formData.preferredDate === dateString;
        const isToday = dateString === todayStr;
        const holiday = (typeof getHolidayName === 'function') ? getHolidayName(year, month, d) : null;
        const dayOfWeek = new Date(year, month - 1, d).getDay();

        dayCell.innerText = d;
        dayCell.title = isPast ? '지난 날짜는 착공일로 선택할 수 없어요.' : (holiday || '');
        let cls = 'h-10 text-xs font-semibold rounded-lg transition-all flex flex-col items-center justify-center relative border-0 ';
        if (isPast) {
            dayCell.disabled = true;
            cls += 'text-ink-200 cursor-not-allowed';
        } else {
            dayCell.onclick = () => {
                window.AppState.formData.preferredDate = dateString;
                renderCalendar();
                syncFormStateUI();
                saveQuoteDraftToStorage();
            };
            cls += 'cursor-pointer ';
            if (isSelected) {
                cls += 'bg-brand-500 text-white font-bold';
                dayCell.style.boxShadow = 'var(--shadow-brand)';
            } else if (holiday) {
                cls += 'text-roseCustom hover:bg-ink-100 font-bold';
            } else if (isToday) {
                cls += 'text-brand-600 bg-brand-50 font-bold ring-1 ring-inset ring-brand-200';
            } else if (dayOfWeek === 0) {
                cls += 'text-roseCustom hover:bg-ink-100';
            } else if (dayOfWeek === 6) {
                cls += 'text-brand-500 hover:bg-ink-100';
            } else {
                cls += 'text-ink-700 hover:bg-ink-100';
            }
            /* 공휴일명이 title 툴팁뿐이면 터치기기에서는 알 방법이 없어서, 선택되지 않은
             * 상태에서도 항상 보이는 작은 점을 함께 표시한다. */
            if (holiday && !isSelected) {
                const dot = document.createElement('span');
                dot.className = 'absolute bottom-0.5 w-1 h-1 rounded-full bg-roseCustom';
                dayCell.appendChild(dot);
            }
        }
        dayCell.className = cls;
        calDaysGrid.appendChild(dayCell);
    }
}

/* 파트너는 포트폴리오 작성 중 초안 저장이 가능한데(ab7ffa7), 클라이언트가 주소·평수·
 * 공정·일정 여러 단계로 구성된 견적 신청 폼을 작성하다 중단하면(다른 탭 이동, 실수로
 * 새로고침 등) 처음부터 다시 입력해야 했다 — localStorage에 자동 저장해두고 다시
 * 들어오면 복원한다. 계정 종속 정보(clientName/clientPhone)는 로그인 시 항상 새로
 * 채워지므로 저장 대상에서 제외한다. */
const QUOTE_DRAFT_STORAGE_KEY = 'anshim_quote_draft';

function saveQuoteDraftToStorage() {
    try {
        const fd = window.AppState.formData;
        const draft = { clientAddress: fd.clientAddress, spaceType: fd.spaceType, workType: fd.workType, pyung: fd.pyung, vacancy: fd.vacancy, preferredDate: fd.preferredDate, partnerCountLimit: fd.partnerCountLimit, budget: fd.budget };
        localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) { /* localStorage 접근 불가 환경(프라이빗 모드 등)에서도 폼 자체는 정상 동작해야 한다 */ }
}

function clearQuoteDraftFromStorage() {
    try { localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY); } catch (e) { /* no-op */ }
}

function restoreQuoteDraftFromStorage() {
    const fd = window.AppState.formData;
    if (fd.clientAddress || fd.pyung > 0) return; // 이미 작성 중인 내용이 있으면 덮어쓰지 않는다.
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY) || 'null'); } catch (e) { return; }
    if (!draft || (!draft.clientAddress && !(draft.pyung > 0))) return;

    Object.assign(fd, draft);
    safeUpdateValue('client-address', draft.clientAddress || '');
    safeUpdateValue('client-pyung', draft.pyung || '');
    safeUpdateValue('client-vacancy', draft.vacancy || 'empty');
    syncFormStateUI();
    showToast('이전에 작성 중이던 견적 신청 내용을 불러왔어요.', 'info');
}

function updateFormState(key, value) {
    window.AppState.formData[key] = value;
    syncFormStateUI();
    saveQuoteDraftToStorage();
}

/* 순수 입력창 포맷터 — 클라이언트 가입/파트너 입점 신청 두 폼이 공유해서 쓰므로,
 * 특정 폼의 상태를 여기서 직접 건드리지 않는다(각 폼의 제출 함수가 이 input의 값을
 * 직접 읽어간다 — formData.clientPhone은 실제로 아무 곳에서도 읽히지 않는 죽은 상태였음). */
function handlePhoneInput(target) {
    let val = target.value.replace(/[^0-9]/g, "");
    if (val.length > 3 && val.length <= 7) val = val.substring(0, 3) + "-" + val.substring(3);
    else if (val.length > 7) val = val.substring(0, 3) + "-" + val.substring(3, 7) + "-" + val.substring(7, 11);
    target.value = val;
}

function handlePyungChange(val) {
    const parsed = parseFloat(val);
    window.AppState.formData.pyung = isNaN(parsed) ? 0 : parsed;
    syncFormStateUI();
    saveQuoteDraftToStorage();
}

function handleBudgetChange(val) {
    window.AppState.formData.budget = parseInt(val, 10);
    syncFormStateUI();
    saveQuoteDraftToStorage();
}

function formatBudget(value) {
    if (value <= 1000) return "1000만원 이하";
    if (value >= 10000) return "1억 이상";
    return `${value.toLocaleString()} 만원`;
}

function setToggleActive(activeId, inactiveId) {
    const a = document.getElementById(activeId);
    const b = document.getElementById(inactiveId);
    if (a) a.classList.add('active');
    if (b) b.classList.remove('active');
}

function syncFormStateUI() {
    const fd = window.AppState.formData;
    const auth = window.AppState.clientAuth;

    /* 필수 항목을 채우면 해당 인라인 에러를 즉시 숨긴다(다음 제출 시도 때까지 남아있지 않도록). */
    if (fd.clientAddress) document.getElementById('field-error-address')?.classList.add('hidden');
    if (fd.pyung > 0) document.getElementById('field-error-pyung')?.classList.add('hidden');
    if (fd.preferredDate) document.getElementById('field-error-date')?.classList.add('hidden');

    safeUpdateText('report-client-info', auth.loggedIn ? `${auth.name} (${auth.phone})` : "인증 미완료");
    safeUpdateText('report-client-address', fd.clientAddress || '미입력');

    if (fd.spaceType === 'residential') setToggleActive('space-residential', 'space-commercial');
    else setToggleActive('space-commercial', 'space-residential');
    safeUpdateText('report-space', fd.spaceType === 'residential' ? '주거 공간' : '상업 공간');

    if (fd.workType === 'all') setToggleActive('work-all', 'work-partial');
    else setToggleActive('work-partial', 'work-all');
    safeUpdateText('report-work', fd.workType === 'all' ? '전체 시공' : '부분 시공');

    const limit3Btn = document.getElementById('limit-3');
    const limit5Btn = document.getElementById('limit-5');
    if (limit3Btn && limit5Btn) {
        const activeCls = "py-3 text-xs font-bold rounded-xl transition-all bg-white text-brand-600 border-0 cursor-pointer flex flex-col items-center justify-center gap-0.5";
        const inactiveCls = "py-3 text-xs font-bold rounded-xl transition-all text-ink-500 hover:text-ink-950 bg-transparent border-0 cursor-pointer flex flex-col items-center justify-center gap-0.5";
        if (parseInt(fd.partnerCountLimit, 10) === 3) {
            limit3Btn.className = activeCls; limit3Btn.style.boxShadow = 'var(--shadow-1)';
            limit5Btn.className = inactiveCls; limit5Btn.style.boxShadow = '';
            safeUpdateText('report-partner-limit', '3개 업체');
        } else {
            limit5Btn.className = activeCls; limit5Btn.style.boxShadow = 'var(--shadow-1)';
            limit3Btn.className = inactiveCls; limit3Btn.style.boxShadow = '';
            safeUpdateText('report-partner-limit', '5개 업체');
        }
    }

    const convertedM2 = (fd.pyung * 3.3058).toFixed(1);
    const m2Indicator = document.getElementById('m2-indicator');
    if (m2Indicator) m2Indicator.innerText = `${convertedM2} ㎡ 환산`;
    safeUpdateText('report-area', `${fd.pyung}평 (${convertedM2} ㎡)`);

    const budgetDisplay = formatBudget(fd.budget);
    safeUpdateText('report-budget', budgetDisplay);
    safeUpdateText('budget-text', budgetDisplay);

    safeUpdateText('report-date', fd.preferredDate || '선택 대기중');
    safeUpdateText('report-vacancy', fd.vacancy === 'living' ? '거주 중' : '공실');

    // 견적 신청 패널(client-panel) 자체가 이제 switchPanel 단계에서 로그인 여부를
    // 확인해 미로그인 시 client-login-panel로 보내므로, 여기 도달했다면 항상 로그인된
    // 상태다. 예전엔 미로그인 시 이 영역을 흐리게 잠가뒀지만 더 이상 그럴 일이 없다.
    const detailSection = document.getElementById('form-details-section');
    if (detailSection) {
        detailSection.classList.remove('opacity-40', 'pointer-events-none');
    }
}

/**
 * 견적 신청 2단계 폼(공간정보 → 일정예산) 스텝 이동 제어.
 * 로그인은 이제 별도 패널(client-login-panel)에서 처리되므로 qstep 내부에는
 * 없다 — 다만 마크업/기존 onclick 호출부(qstep-2/3, goToClientStep(2/3))를
 * 그대로 두기 위해 qstep id는 2,3을 유지하고, 화면에 보여주는 단계 번호(1,2)만
 * step-dot-1/2·step-label-1/2에 매핑해서 표시한다.
 */
function goToClientStep(step) {
    [1, 2, 3].forEach(n => {
        const panel = document.getElementById(`qstep-${n}`);
        if (panel) panel.classList.toggle('hidden', n !== step);
        const dot = document.getElementById(`step-dot-${n}`);
        if (dot) { dot.classList.toggle('active', n === step); dot.classList.toggle('done', n < step); }
        const label = document.getElementById(`step-label-${n}`);
        if (label) label.classList.toggle('current', n === step);
    });

    const formCard = document.getElementById('matching-form');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function triggerMatchingSim() {
    const fd = window.AppState.formData;
    const auth = window.AppState.clientAuth;

    if (!auth.loggedIn) {
        showToast('로그인이 필요합니다. 로그인 페이지로 이동합니다.', 'warning');
        if (typeof goToLoginPanel === 'function') goToLoginPanel('client-panel');
        return;
    }
    if (!fd.clientAddress || fd.pyung <= 0 || !fd.preferredDate) {
        ['field-error-address', 'field-error-pyung', 'field-error-date'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        if (!fd.clientAddress || fd.pyung <= 0) {
            goToClientStep(2);
            if (!fd.clientAddress) { document.getElementById('field-error-address')?.classList.remove('hidden'); document.getElementById('client-address')?.focus(); }
            else { document.getElementById('field-error-pyung')?.classList.remove('hidden'); document.getElementById('client-pyung')?.focus(); }
        } else {
            goToClientStep(3);
            document.getElementById('field-error-date')?.classList.remove('hidden');
        }
        showToast('필수 항목을 입력해 주세요.', 'warning');
        return;
    }

    const simArea = document.getElementById('matching-simulation-area');
    const successArea = document.getElementById('matching-success-area');
    if (simArea) simArea.classList.remove('hidden');
    if (successArea) successArea.classList.add('hidden');

    let progress = 10;
    const interval = setInterval(() => {
        progress += 30;
        if (progress >= 100) {
            clearInterval(interval);
            if (simArea) simArea.classList.add('hidden');
            if (successArea) successArea.classList.remove('hidden');
            completeMatchingSim();
        }
        const bar = document.getElementById('matching-progress-bar');
        if (bar) bar.style.width = `${Math.min(progress,100)}%`;
    }, 400);
}

function completeMatchingSim() {
    const code = `WJ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const fd = window.AppState.formData;
    const auth = window.AppState.clientAuth;
    const isHighBudget = fd.budget >= 7000;

    const newOrder = {
        code: code, clientName: auth.name, clientPhone: auth.phone, clientAddress: fd.clientAddress,
        spaceType: fd.spaceType, workType: fd.workType, pyung: fd.pyung, vacancy: fd.vacancy,
        preferredDate: fd.preferredDate, partnerCountLimit: fd.partnerCountLimit, budget: fd.budget,
        status: 'bidding', contractUploaded: false, clientSigned: false, reviewWritten: false,
        acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isRebidding: false,
        isHighBudgetAdminPending: isHighBudget, commissionPaid: false, contractDoc: null, estimateDoc: null
    };

    if (isHighBudget) {
        if (typeof pushLog === 'function') {
            pushLog('ADMIN', 'HIGH_BUDGET', `[7천만원 이상 고액 오더 접수] '${auth.name}' 고객님의 프리미엄 오더(${code}, 예산: ₩ ${fd.budget.toLocaleString()}만원)가 본사 관리자 수동 배정관에 등록되었습니다.`, 'WARNING');
        }
        if (typeof pushClientNotification === 'function') {
            pushClientNotification(auth.phone, `고액 오더(${code})가 접수되어, 관리자가 최상위 인증 파트너사를 직접 배정하고 있어요.`);
        }
    } else {
        // 심사 대기(pending)·반려(rejected)·삼진아웃 제명(banned) 파트너는 '안심' 매칭
        // 대상에서 제외한다 — 이 필터가 없으면 이제 막 접수된 첫 견적 신청에서부터
        // 아직 검증되지 않았거나 이미 제명된 파트너가 무작위로 뽑힐 수 있었다.
        const availablePartners = window.AppState.partners.filter(p => p.status === 'active' && !p.isPaused && !isPartnerBlockedByClient(p.name));
        const count = Math.min(newOrder.partnerCountLimit, availablePartners.length);
        const shuffled = [...availablePartners].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        newOrder.bids = selected.map(partner => ({
            partner: partner.name,
            price: Math.floor(newOrder.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        }));
        // 매칭 가능한 파트너가 0명이면(활동중단·전원 일시중단 등) 지금까지 "0곳이
        // 매칭되어 견적서를 보냈어요"라는 앞뒤가 안 맞는 성공 알림이 그대로 나갔다 —
        // 실패를 솔직하게 알리고 재매칭 버튼(triggerRebidding)으로 안내한다.
        if (typeof pushClientNotification === 'function') {
            pushClientNotification(auth.phone, newOrder.bids.length > 0
                ? `안심 견적(${code})에 파트너사 ${newOrder.bids.length}곳이 자동 매칭되어 견적서를 보냈어요.`
                : `안심 견적(${code})에 지금 매칭 가능한 파트너사가 없어요. 잠시 후 마이페이지에서 재매칭을 시도해 주세요.`);
        }
        if (typeof pushPartnerNotification === 'function') {
            selected.forEach(partner => pushPartnerNotification(partner.name, `새 오더(${code})에 매칭되었어요. 고객: ${maskName(newOrder.clientName)}님, ${newOrder.pyung}평형.`));
        }
    }

    window.AppState.orders.unshift(newOrder);
    window.AppState.lastCreatedOrderCode = code;
    clearQuoteDraftFromStorage();

    if (auth.loggedIn && typeof grantClientBenefit === 'function') {
        const account = window.AppState.clientAccounts.find(a => a.id === auth.id);
        const isFirstQuote = account && !(account.benefits || []).some(b => b.type === 'quote_voucher');

        grantClientBenefit(auth.phone, 'quote_voucher', '첫 견적 신청 축하 상품권', '5만원');

        // 추천 가입(referredBy) 보상은 "추천받은 친구가 실제로 서비스를 이용했을 때"만
        // 지급해야 어뷰징(가입만 하고 활동 없는 유령 계정)을 막을 수 있다 — 첫 견적
        // 신청 시점을 그 기준으로 삼는다.
        if (isFirstQuote && account && account.referredBy) {
            const referrer = window.AppState.clientAccounts.find(a => a.id === account.referredBy);
            if (referrer) {
                grantClientBenefit(referrer.phone, 'referral_reward', `친구 초대 감사 상품권 (${maskName(account.name)}님 추천)`, '3만원', code);
                grantClientBenefit(auth.phone, 'referral_reward', '추천 가입 축하 상품권', '3만원', code);
            }
        }
    }

    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();

    if (auth.loggedIn) {
        renderClientMyPage();
        if (isHighBudget) {
            showToast(`7,000만원 이상 고액 오더로 지정되어,\n본사 최고 관리자가 최상위 '우리집 인증 파트너사'를 직접 전속 심사 후 나눠 배정합니다!\n(의뢰 코드: ${code})`, 'info');
        } else {
            showToast(`안심 견적이 성실히 접수되었습니다!\n(의뢰 코드: ${code})`, 'success');
        }
        setTimeout(() => {
            if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
            selectMyPageEstimate(code);
        }, 1200);
    }
}

function cancelPartnerBid(orderCode, partnerName, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    order.bids = order.bids.filter(b => b.partner !== partnerName);
    if (!order.excludedPartners) order.excludedPartners = [];
    if (!order.excludedPartners.includes(partnerName)) order.excludedPartners.push(partnerName);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CANCEL_BID', `[${order.clientName}] 고객님이 [${partnerName}] 파트너의 매칭을 취소하였습니다.${reason ? ` 사유: ${reason}` : ''}`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `고객님이 오더(${orderCode}) 매칭을 취소했어요.${reason ? ` 사유: ${reason}` : ''}`);
    // 마지막 남은 매칭까지 취소하면 오더가 조용히 "무응답" 상태로 남는다 — 재매칭
    // 버튼(triggerRebidding)이 이미 있지만 존재를 몰라 그냥 방치되는 경우가 많으므로
    // 입찰이 0건이 된 시점에 바로 알려준다.
    if (order.bids.length === 0 && typeof pushClientNotification === 'function') {
        pushClientNotification(order.clientPhone, `오더(${orderCode})에 남은 입찰 제안이 없어요. 마이페이지에서 재매칭을 받아보세요.`);
    }
    showToast(`[${partnerName}] 매칭을 취소했습니다.`, 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
}

let bidQuestionTarget = null;

/* 여러 입찰 제안서를 비교할 때 지금까지는 "매칭취소" 아니면 "계약 체결하기" 둘 중
 * 하나만 고를 수 있었다 — 계약을 결정하기 전에 자재/일정 등을 가볍게 물어볼 방법이
 * 없어서 궁금증이 남아도 바로 계약하거나 매칭을 취소해야 했다. 입찰(bid) 객체에
 * questions 배열을 두고, 알림 파이프(pushPartnerNotification/pushClientNotification)를
 * 그대로 재사용해 답변 도착을 알린다. */
function openBidQuestionModal(orderCode, partnerName) {
    if (!requireClientLoginForCommunity()) return;
    bidQuestionTarget = { orderCode, partnerName };
    safeUpdateText('bid-question-modal-title', `${partnerName}에게 문의하기`);
    safeUpdateValue('bid-question-text', '');
    openModal('bid-question-modal', 'bid-question-modal-card');
}

function closeBidQuestionModal() {
    bidQuestionTarget = null;
    closeModal('bid-question-modal', 'bid-question-modal-card');
}

function submitBidQuestion() {
    if (!bidQuestionTarget) return;
    const { orderCode, partnerName } = bidQuestionTarget;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const bid = order && order.bids && order.bids.find(b => b.partner === partnerName);
    if (!bid) { closeBidQuestionModal(); return; }

    const text = document.getElementById('bid-question-text')?.value.trim();
    if (!text) { showToast('문의 내용을 입력해 주세요.', 'warning'); return; }

    if (!bid.questions) bid.questions = [];
    bid.questions.push({ text, date: getLocalDateString(), reply: null, replyDate: null });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'BID_QUESTION', `[${order.clientName}] 고객님이 [${partnerName}] 파트너의 입찰(${orderCode})에 문의를 남겼습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `오더(${orderCode}) 입찰에 대해 고객님이 문의를 남겼어요: "${text}"`);
    showToast('문의를 보냈습니다. 답변이 도착하면 알려드릴게요.', 'success');
    closeBidQuestionModal();
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
}

/* 고객은 이미 입찰한 파트너에게 계약 전 문의를 할 수 있는데(위 openBidQuestionModal),
 * 반대로 파트너가 입찰 전에 남긴 문의(order.partnerPreQuestions, partner_panel.js의
 * submitPreBidQuestion)에 고객이 답변할 방법이 없었다 — 아직 입찰 전이라 특정 bid에
 * 속하지 않으므로 오더 상세 화면에 파트너별로 모아 보여준다. */
function buildClientPreBidQnaHtml(order) {
    const questions = order.partnerPreQuestions || [];
    if (questions.length === 0) return '';
    return `
        <div class="surface-flat p-4 space-y-2.5 text-left">
            <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="message-circle-question" class="w-4 h-4 text-brand-500"></i> 입찰 전 문의 (${questions.length}건)</h5>
            <div class="space-y-2">${questions.map((q, qIdx) => `
                <div class="p-3 bg-ink-50 rounded-xl space-y-1.5">
                    <p class="text-xs text-ink-700 font-semibold leading-relaxed"><b class="text-ink-900">${escapeHtml(q.partnerName)}</b>: ${escapeHtml(q.text)} <span class="text-[10px] text-ink-400 font-bold">(${q.date})</span></p>
                    ${q.reply
                        ? `<p class="text-xs text-brand-700 font-semibold leading-relaxed pl-3 border-l-2 border-brand-200">${escapeHtml(q.reply)}</p>`
                        : `<div class="flex gap-1.5"><input type="text" id="prebid-question-reply-input-${order.code}-${qIdx}" placeholder="답변을 입력하세요" class="input flex-1 text-xs"><button type="button" onclick="replyToPreBidQuestion('${order.code}', ${qIdx})" class="btn btn-dark btn-sm shrink-0">답변</button></div>`}
                </div>`).join('')}</div>
        </div>`;
}

function replyToPreBidQuestion(orderCode, questionIdx) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const question = order && order.partnerPreQuestions && order.partnerPreQuestions[questionIdx];
    if (!question) return;

    const input = document.getElementById(`prebid-question-reply-input-${orderCode}-${questionIdx}`);
    const reply = input ? input.value.trim() : '';
    if (!reply) { showToast('답변 내용을 입력해 주세요.', 'warning'); return; }

    question.reply = reply;
    question.replyDate = getLocalDateString();
    if (typeof pushLog === 'function') pushLog('CLIENT', 'PRE_BID_QUESTION_REPLY', `[${order.clientName}] 고객님이 ${question.partnerName}의 입찰 전 문의에 답변했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(question.partnerName, `문의하신 오더(${orderCode})에 고객님이 답변했어요.`);
    showToast('답변이 등록되었습니다.', 'success');
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
}

/* 지금까지는 파트너 매칭을 하나씩 취소(cancelPartnerBid)할 수만 있었고, 의뢰(오더)
 * 자체를 철회할 방법은 없었다 — 이사 계획이 바뀌거나 마음이 바뀌어도 오더가
 * '입찰 심사 중'으로 영원히 남아 있었다. 이미 계약이 체결된 오더는 철회 대상이
 * 아니므로(계약 파기는 다른 절차), status !== 'bidding'이면 막는다. */
function withdrawOrder(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    if (order.status !== 'bidding') { showToast('이미 계약이 진행 중이거나 완료된 의뢰는 철회할 수 없어요.', 'warning'); return; }

    const biddingPartners = (order.bids || []).map(b => b.partner);
    order.status = 'withdrawn';

    if (typeof pushLog === 'function') pushLog('CLIENT', 'WITHDRAW_ORDER', `[${order.clientName}] 고객님이 의뢰(${orderCode})를 철회하였습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') {
        biddingPartners.forEach(partnerName => pushPartnerNotification(partnerName, `고객님이 오더(${orderCode})를 철회했어요. 더 이상 진행되지 않아요.`));
    }
    showToast('의뢰가 철회되었습니다.', 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
}

let editOrderBudgetTargetCode = null;

/* 지금까지는 의뢰서를 한 번 제출하면 예산을 잘못 적었거나 마음이 바뀌어도 고칠 방법이
 * 없어서 전체를 철회하고 새로 써야 했다 — 계약 전(입찰 진행 중)이라면 가볍게 예산만
 * 수정할 수 있게 한다. */
function openEditOrderBudgetModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding') return;
    editOrderBudgetTargetCode = orderCode;
    safeUpdateValue('edit-order-address-input', order.clientAddress);
    safeUpdateValue('edit-order-spacetype-input', order.spaceType);
    safeUpdateValue('edit-order-worktype-input', order.workType);
    safeUpdateValue('edit-order-pyung-input', order.pyung);
    safeUpdateValue('edit-order-vacancy-input', order.vacancy);
    safeUpdateValue('edit-order-date-input', order.preferredDate);
    safeUpdateValue('edit-order-budget-input', order.budget);
    openModal('edit-order-budget-modal', 'edit-order-budget-modal-card');
}

function closeEditOrderBudgetModal() {
    editOrderBudgetTargetCode = null;
    closeModal('edit-order-budget-modal', 'edit-order-budget-modal-card');
}

function saveOrderBudgetEdit() {
    const order = window.AppState.orders.find(o => o.code === editOrderBudgetTargetCode);
    if (!order) { closeEditOrderBudgetModal(); return; }
    if (order.status !== 'bidding') { showToast('이미 계약이 진행 중이거나 완료된 의뢰는 수정할 수 없어요.', 'warning'); closeEditOrderBudgetModal(); return; }

    const newAddress = document.getElementById('edit-order-address-input')?.value.trim();
    const newSpaceType = document.getElementById('edit-order-spacetype-input')?.value;
    const newWorkType = document.getElementById('edit-order-worktype-input')?.value;
    const newPyung = parseInt(document.getElementById('edit-order-pyung-input')?.value, 10);
    const newVacancy = document.getElementById('edit-order-vacancy-input')?.value;
    const newDate = document.getElementById('edit-order-date-input')?.value;
    const newBudget = parseInt(document.getElementById('edit-order-budget-input')?.value, 10);
    if (!newAddress) { showToast('시공 주소를 입력해주세요.', 'warning'); return; }
    if (!newPyung || newPyung <= 0) { showToast('면적(평)을 올바르게 입력해주세요.', 'warning'); return; }
    if (!newDate) { showToast('희망 착공일을 선택해주세요.', 'warning'); return; }
    if (!newBudget || newBudget <= 0) { showToast('희망 예산을 올바르게 입력해주세요.', 'warning'); return; }

    // 실제로 바뀐 항목만 파트너에게 알려야, 예산만 살짝 고친 건데도 매번 "주소/평형/일정이
    // 모두 바뀌었다"는 오해를 주는 알림이 가지 않는다.
    const changedLabels = [];
    if (newAddress !== order.clientAddress) changedLabels.push('시공 주소');
    if (newSpaceType !== order.spaceType) changedLabels.push('공간 구분');
    if (newWorkType !== order.workType) changedLabels.push('시공 범위');
    if (newPyung !== order.pyung) changedLabels.push('면적');
    if (newVacancy !== order.vacancy) changedLabels.push('공실 여부');
    if (newDate !== order.preferredDate) changedLabels.push('희망 착공일');
    if (newBudget !== order.budget) changedLabels.push('희망 예산');

    if (changedLabels.length === 0) { showToast('변경된 내용이 없습니다.', 'info'); closeEditOrderBudgetModal(); return; }

    order.clientAddress = newAddress;
    order.spaceType = newSpaceType;
    order.workType = newWorkType;
    order.pyung = newPyung;
    order.vacancy = newVacancy;
    order.preferredDate = newDate;
    order.budget = newBudget;

    const biddingPartners = (order.bids || []).map(b => b.partner);
    // 이미 입찰한 파트너에게만 알림이 갔는데, 아직 입찰 전이라도 관심 오더로 찜해둔
    // 파트너(favoriteOrders)는 바뀐 조건을 보고 입찰 여부를 다시 판단해야 하므로
    // 똑같이 알려야 한다 — 중복 알림 방지를 위해 이미 입찰한 파트너는 제외한다.
    const favoritedNotBidding = (window.AppState.partners || [])
        .filter(p => (p.favoriteOrders || []).includes(order.code) && !biddingPartners.includes(p.name))
        .map(p => p.name);
    const changeSummary = changedLabels.join(', ');
    if (typeof pushLog === 'function') pushLog('CLIENT', 'EDIT_ORDER_BUDGET', `[${order.clientName}] 고객님이 의뢰(${order.code})의 상세정보(${changeSummary})를 수정했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') {
        biddingPartners.forEach(partnerName => pushPartnerNotification(partnerName, `고객님이 오더(${order.code})의 상세정보(${changeSummary})를 수정했어요.`));
        favoritedNotBidding.forEach(partnerName => pushPartnerNotification(partnerName, `찜해두신 오더(${order.code})의 상세정보(${changeSummary})가 변경됐어요.`));
    }
    showToast('의뢰 상세정보가 수정되었습니다.', 'success');

    closeEditOrderBudgetModal();
    renderClientMyPage();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
}

/* 계약서/견적서 원문 파일은 있는데, 최종 계약금액·수수료·완료일 등을 한눈에
 * 정리한 짧은 거래 확인서(영수증)는 없어서 매번 원문 서류를 열어 확인해야 했다 —
 * downloadContractDoc/downloadEstimateDoc과 동일한 buildDocFile 패턴으로 요약본을 만든다. */
function downloadTransactionReceipt(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') { showToast('계약이 체결된 의뢰만 확인서를 발급할 수 있어요.', 'warning'); return; }

    const price = order.finalPrice || order.budget;
    const commission = Math.floor(price * PLATFORM_COMMISSION_RATE);
    const content = `====================================================\n[우리집 안심 중개] 거래 완료 확인서\n====================================================\n\n1. 거래 정보\n   - 의뢰 코드: ${order.code}\n   - 시공 장소: ${order.clientAddress}\n   - 고객명: ${order.clientName} 고객님\n   - 계약 파트너사: ${order.acceptedPartner || '-'}\n   - 착공 예정일: ${order.preferredDate || '미정'}\n\n2. 정산 내역 (단위: 만원)\n   --------------------------------------------------\n   - 최종 계약 금액: ₩ ${price.toLocaleString()} 만원\n   - 플랫폼 중개 수수료 (${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)}%): ₩ ${commission.toLocaleString()} 만원\n   - 수수료 납부 상태: ${order.commissionPaid ? '납부 완료' : '납부 대기중 (안심 에스크로 보관)'}\n\n3. 서류 현황\n   - 계약서: ${order.contractDoc ? '업로드 완료' : '미업로드'}\n   - 견적서: ${order.estimateDoc ? '업로드 완료' : '미업로드'}\n\n발급일자: ${getLocalDateString()}\n본 확인서는 우리집 안심 중개 플랫폼에서 자동 발급되었습니다.\n====================================================`;
    buildDocFile(content, `[우리집안심중개]_거래확인서_${order.code}.txt`);
    showToast('거래 확인서 다운로드가 시작되었습니다.', 'success');
}

let contractCancelRequestTargetCode = null;

/* 계약이 체결되면(order.status='contracted') 지금까지 되돌릴 방법이 전혀 없었다 —
 * 오탈자나 파트너와의 분쟁 등 어떤 사유든 영구 확정이었던 공백. 즉시 취소하지 않고
 * 매니저 센터 심사를 거치는 별도 상태(cancel_requested)를 둬서, 관리자가 실제
 * 계약 취소를 승인/반려하는 절차를 갖춘다. */
function openContractCancelRequestModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    contractCancelRequestTargetCode = orderCode;
    safeUpdateValue('contract-cancel-request-reason', '');
    openModal('contract-cancel-request-modal', 'contract-cancel-request-modal-card');
}

function closeContractCancelRequestModal() {
    contractCancelRequestTargetCode = null;
    closeModal('contract-cancel-request-modal', 'contract-cancel-request-modal-card');
}

function submitContractCancellationRequest() {
    const order = window.AppState.orders.find(o => o.code === contractCancelRequestTargetCode);
    if (!order || order.status !== 'contracted') { closeContractCancelRequestModal(); return; }

    const reason = document.getElementById('contract-cancel-request-reason')?.value.trim();
    if (!reason) { showToast('취소 요청 사유를 입력해주세요.', 'warning'); return; }

    order.status = 'cancel_requested';
    order.cancelRequest = { reason, requestedBy: 'client', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONTRACT_CANCEL_REQUEST', `[${order.clientName}] 고객님이 계약(${order.code})의 취소를 요청했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약(${order.code}) 취소를 요청했어요. 매니저 센터에서 심사 중입니다.`);
    showToast('취소 요청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeContractCancelRequestModal();
    renderClientMyPage();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof renderAdminContractCancellations === 'function') renderAdminContractCancellations();
}

function retractContractCancellationRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'cancel_requested') return;
    if (order.cancelRequest && order.cancelRequest.requestedBy !== 'client') { showToast('파트너사가 요청한 취소는 고객이 직접 철회할 수 없어요. 매니저 센터 심사를 기다려주세요.', 'warning'); return; }
    order.status = 'contracted';
    order.cancelRequest = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONTRACT_CANCEL_RETRACT', `[${order.clientName}] 고객님이 계약(${order.code}) 취소 요청을 철회했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약(${order.code}) 취소 요청을 철회했어요. 계약이 그대로 유지됩니다.`);
    showToast('취소 요청을 철회했습니다. 계약이 그대로 유지됩니다.', 'info');

    renderClientMyPage();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof renderAdminContractCancellations === 'function') renderAdminContractCancellations();
}

/* 관리자가 계약을 직권으로 강제 취소하면(adminForceCancelContract, partner_panel.js)
 * 고객·파트너 둘 다 알림만 받을 뿐 그 조치가 부당하다고 여겨도 대응할 방법이
 * 없었다 — 계정 정지 이의신청(suspensionAppeal), 옐로카드 이의신청(strikeAppeal)과
 * 동일한 비대칭이다. 양측 중 먼저 제출한 이의신청 하나를 order.cancelRequest.appeal에
 * 담아 관리자가 심사하게 한다. */
let forceCancelAppealTargetCode = null;

function openForceCancelAppealModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'cancelled' || !order.cancelRequest || order.cancelRequest.requestedBy !== 'admin') return;
    if (order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    forceCancelAppealTargetCode = orderCode;
    safeUpdateValue('force-cancel-appeal-reason-input', '');
    openModal('force-cancel-appeal-modal', 'force-cancel-appeal-modal-card');
}

function closeForceCancelAppealModal() {
    forceCancelAppealTargetCode = null;
    closeModal('force-cancel-appeal-modal', 'force-cancel-appeal-modal-card');
}

function submitForceCancelAppeal() {
    const order = window.AppState.orders.find(o => o.code === forceCancelAppealTargetCode);
    if (!order || !order.cancelRequest) { closeForceCancelAppealModal(); return; }
    const reason = document.getElementById('force-cancel-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    order.cancelRequest.appeal = { reason, filedBy: 'client', status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'FORCE_CANCEL_APPEAL', `[${order.clientName}] 고객님이 계약(${order.code}) 강제 취소 조치에 대해 이의신청을 제출했습니다.`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약(${order.code}) 강제 취소에 대한 이의신청을 제출했어요.`);
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeForceCancelAppealModal();
    selectMyPageEstimate(order.code);
}

/* "3년 무상 하자보증"이 홈 화면·프로모션 문구에 반복 노출되지만(index.html,
 * cms.js:1110, config_state.js:296) 실제로 하자보수를 신청할 방법이 어디에도
 * 없었다 — 양측 서명이 완료된 계약(공사 완료를 나타내는 대체 지표)에 한해
 * 하자보수/A/S를 신청하고 파트너의 처리 현황(접수→처리중→처리완료)을
 * 추적할 수 있게 한다. */
let repairClaimTargetCode = null;

function openRepairClaimModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    if (!order.clientSigned || !order.partnerSigned) { showToast('양측 서명이 완료된 계약만 하자보수를 신청할 수 있어요.', 'warning'); return; }
    if (typeof isWarrantyExpired === 'function' && isWarrantyExpired(order)) { showToast('무상 보증기간(준공일로부터 3년)이 만료되어 하자보수를 신청할 수 없어요.', 'warning'); return; }
    repairClaimTargetCode = orderCode;
    safeUpdateValue('repair-claim-title', '');
    safeUpdateValue('repair-claim-desc', '');
    openModal('repair-claim-modal', 'repair-claim-modal-card');
}

function closeRepairClaimModal() {
    repairClaimTargetCode = null;
    closeModal('repair-claim-modal', 'repair-claim-modal-card');
}

function submitRepairClaim() {
    const order = window.AppState.orders.find(o => o.code === repairClaimTargetCode);
    if (!order) { closeRepairClaimModal(); return; }

    const title = document.getElementById('repair-claim-title')?.value.trim();
    const desc = document.getElementById('repair-claim-desc')?.value.trim();
    if (!title || !desc) { showToast('하자 부위와 상세 내용을 모두 입력해주세요.', 'warning'); return; }

    if (!order.repairClaims) order.repairClaims = [];
    order.repairClaims.unshift({
        id: `rc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title, description: desc,
        status: 'submitted',
        createdDate: getLocalDateString(),
        partnerResponse: null,
        resolvedDate: null
    });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_CLAIM_SUBMIT', `[${order.clientName}] 고객님이 계약(${order.code})에 하자보수를 신청했습니다: ${title}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 하자보수를 신청했어요: ${title}`);
    showToast('하자보수 신청이 접수되었습니다.', 'success');

    closeRepairClaimModal();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

/* 계약 취소·일정 변경·금액 변경 요청은 모두 진행 전이면 신청자가 직접 철회할 수
 * 있는데(retractContractCancellationRequest, retractScheduleChangeRequest,
 * retractPriceChangeRequest), 하자보수 신청만 유일하게 철회 방법이 없었다 —
 * 오탈자로 잘못 신청했거나 스스로 해결했는데도 파트너가 처리를 시작하기 전까지
 * 취소할 방법이 없는 공백이었다. */
function retractRepairClaim(orderCode, claimId) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim) return;
    if (claim.status !== 'submitted') { showToast('파트너사가 이미 처리를 시작한 신청은 철회할 수 없어요.', 'warning'); return; }

    order.repairClaims = order.repairClaims.filter(c => c.id !== claimId);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_CLAIM_RETRACT', `[${order.clientName}] 고객님이 계약(${order.code})의 하자보수 신청("${claim.title}")을 철회했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 하자보수 신청("${claim.title}")을 철회했어요.`);
    showToast('하자보수 신청을 철회했습니다.', 'info');

    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

/* 파트너가 하자보수 신청을 반려할 수 있게 됐는데(submitRepairClaimResponse,
 * partner_panel.js), 그 반려가 부당하다고 느껴도 고객이 할 수 있는 건 없었다 —
 * 관리자는 반려된 사실조차 파악할 방법이 없어 결국 방치되는 공백이었다. 고객이
 * 명시적으로 재검토를 요청한 건만 관리자 오더 조회의 분쟁 목록에 노출한다. */
function escalateRepairClaimToAdmin(orderCode, claimId, note) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.status !== 'rejected' || claim.escalated) return;

    claim.escalated = true;
    claim.escalationNote = note;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_CLAIM_ESCALATE', `[${order.clientName}] 고객님이 반려된 하자보수 신청("${claim.title}")에 대해 매니저 재검토를 요청했습니다. 사유: ${note}`, 'WARNING');
    showToast('매니저 센터에 재검토를 요청했습니다.', 'success');

    selectMyPageEstimate(order.code);
}

/* 파트너가 하자보수를 "처리완료"로 표시하면 고객은 배지만 볼 뿐 실제로 제대로
 * 고쳐졌는지 확인/이의제기할 방법이 없었다 — 반려된 신청에는 이미 재검토 요청
 * (escalateRepairClaimToAdmin)이 있는데, 완료 처리에만 이 경로가 빠져 있던
 * 비대칭을 해소한다. */
function disputeCompletedRepairClaim(orderCode, claimId, note) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.status !== 'completed' || claim.completionDisputed) return;

    claim.completionDisputed = true;
    claim.completionDisputeNote = note;
    claim.completionDisputeResolution = null;
    claim.completionDisputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_CLAIM_COMPLETION_DISPUTE', `[${order.clientName}] 고객님이 처리완료된 하자보수 신청("${claim.title}")에 이의를 제기했습니다: ${note}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 처리완료된 하자보수("${claim.title}")에 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('매니저 센터에 이의제기를 접수했습니다.', 'success');

    selectMyPageEstimate(order.code);
}

/* 계약 체결 후 고객이 확인할 수 있는 건 서명·서류·수수료 결제 상태뿐이라, 실제
 * 시공이 지금 어느 단계인지는 전혀 알 방법이 없었다 — 파트너가 진행 표시하는
 * 단계(advanceOrderProgressStage, partner_panel.js)를 읽기 전용 스테퍼로 보여준다. */
function buildProgressStagesHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const stages = getOrInitProgressStages(order);
    const doneStages = stages.filter(s => s.done);
    const doneListHtml = doneStages.length === 0 ? '' : `<div class="space-y-1 pt-1">${doneStages.map(s => {
        const idx = stages.indexOf(s);
        let statusHtml;
        if (s.disputed) {
            statusHtml = s.disputeResolution === 'rejected'
                ? `<span class="text-[9px] font-bold text-ink-400">이의제기 반려됨${s.disputeAdminResponse ? ` — ${escapeHtml(s.disputeAdminResponse)}` : ''}</span>`
                : `<span class="text-[9px] font-black text-amberCustom">이의제기 심사중</span>`;
        } else {
            statusHtml = `<button type="button" onclick="openReportReasonPrompt((reason) => disputeProgressStage('${order.code}', ${idx}, reason))" class="text-[9px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">이의제기</button>`;
        }
        return `<div class="flex items-center justify-between"><span class="text-[10px] text-ink-500 font-semibold">${escapeHtml(s.label)} 완료 (${s.date})</span>${statusHtml}</div>`;
    }).join('')}</div>`;
    return `<div class="p-3.5 surface-flat space-y-2 text-left mt-3">
        <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="hard-hat" class="w-3.5 h-3.5 text-brand-500"></i> 시공 진행 단계</span>
        ${renderPartnerContractProgressStepperHtml(stages)}
        ${doneListHtml}
    </div>`;
}

/* 마일스톤 청구(openMilestoneDisputeModal)와 하자보수 완료 처리(disputeCompletedRepairClaim)는
 * 둘 다 고객이 이의제기할 수 있는데, 정작 고객이 가장 신경쓰는 "시공 진행 단계
 * 완료 표시"는 파트너가 완전히 단독으로 결정하고 고객은 읽기 전용으로만 볼 수
 * 있었다 — "철거 완료라고 했는데 실제로 안 됐어요" 같은 상황에 대응할 방법이
 * 없던 비대칭을 해소한다. */
function disputeProgressStage(orderCode, stageIndex, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const stages = order && getOrInitProgressStages(order);
    const stage = stages && stages[stageIndex];
    if (!stage || !stage.done || stage.disputed) return;

    stage.disputed = true;
    stage.disputeReason = reason;
    stage.disputeResolution = null;
    stage.disputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PROGRESS_STAGE_DISPUTE', `[${order.clientName}] 고객님이 계약(${order.code}) 시공 단계("${stage.label}") 완료 표시에 이의를 제기했습니다: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 "${stage.label}" 단계 완료 표시에 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('매니저 센터에 이의제기를 접수했습니다.', 'success');

    selectMyPageEstimate(order.code);
}

/* 계약 체결 후 착공 전까지, 실제 인테리어 시공에서는 항상 있는 실측 일정 조율
 * 단계가 전혀 없었다 — 파트너가 제안한 실측 방문 일정(openSiteVisitModal,
 * partner_panel.js)에 고객이 확정 또는 거절로 응답할 수 있게 한다. */
function confirmSiteVisit(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.siteVisit || order.siteVisit.status !== 'proposed') return;
    order.siteVisit.status = 'confirmed';
    order.siteVisit.confirmedDate = order.siteVisit.proposedDate;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SITE_VISIT_CONFIRM', `[${order.clientName}] 고객님이 계약(${order.code}) 실측 방문 일정을 확정했습니다: ${order.siteVisit.confirmedDate}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 실측 방문 일정을 확정했어요: ${order.siteVisit.confirmedDate}`);
    showToast('실측 방문 일정을 확정했습니다.', 'success');
    selectMyPageEstimate(order.code);
}

function declineSiteVisit(orderCode, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.siteVisit || order.siteVisit.status !== 'proposed') return;
    order.siteVisit.status = 'declined';
    order.siteVisit.declineReason = reason;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SITE_VISIT_DECLINE', `[${order.clientName}] 고객님이 계약(${order.code}) 실측 방문 일정을 거절했습니다. 사유: ${reason}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 제안하신 실측 방문 일정을 거절했어요. 사유: ${reason}`);
    showToast('실측 방문 일정을 거절했습니다.', 'info');
    selectMyPageEstimate(order.code);
}

function buildClientSiteVisitHtml(order) {
    if (order.status !== 'contracted') return '';
    const visit = order.siteVisit;
    let bodyHtml = `<p class="text-[10px] text-ink-400 font-semibold">계약 파트너사가 실측 방문 일정을 제안하면 여기서 확인할 수 있어요.</p>`;
    if (visit && visit.status === 'proposed') {
        bodyHtml = `<p class="text-[10px] text-ink-600 font-semibold leading-relaxed">파트너사가 실측 방문 일정을 제안했어요: <span class="font-black text-ink-950">${visit.proposedDate}</span>${visit.note ? ` (${escapeHtml(visit.note)})` : ''}</p>
            <div class="flex gap-1.5 mt-1.5"><button type="button" onclick="confirmSiteVisit('${order.code}')" class="btn btn-dark btn-sm flex-1">일정 확정</button><button type="button" onclick="openReportReasonPrompt((reason) => declineSiteVisit('${order.code}', reason))" class="btn btn-secondary btn-sm flex-1">거절</button></div>`;
    } else if (visit && visit.status === 'confirmed') {
        bodyHtml = `<p class="text-[10px] font-black text-emeraldCustom">실측 방문 일정 확정됨: ${visit.confirmedDate}</p>
            <button type="button" onclick="downloadVisitCalendarFile('${escapeHtml(order.acceptedPartner || '')} 실측 방문 (${order.code})', '${escapeHtml(order.clientAddress)}', '${visit.confirmedDate}')" class="text-[9px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1"><i data-lucide="calendar-plus" class="w-3 h-3 inline"></i> 캘린더에 추가</button>`;
    } else if (visit && visit.status === 'completed') {
        if (visit.disputed) {
            bodyHtml = visit.disputeResolution === 'rejected'
                ? `<p class="text-[10px] font-black text-ink-500">실측 방문이 완료되었어요: ${visit.completedDate}</p><p class="text-[9px] text-ink-400 font-semibold mt-0.5">이의제기 반려됨${visit.disputeAdminResponse ? ` — ${escapeHtml(visit.disputeAdminResponse)}` : ''}</p>`
                : `<p class="text-[10px] font-black text-ink-500">실측 방문이 완료되었어요: ${visit.completedDate}</p><p class="text-[9px] font-black text-amberCustom mt-0.5">이의제기 심사중</p>`;
        } else {
            bodyHtml = `<p class="text-[10px] font-black text-ink-500">실측 방문이 완료되었어요: ${visit.completedDate}</p>
            <button type="button" onclick="openReportReasonPrompt((reason) => disputeSiteVisitCompletion('${order.code}', reason))" class="text-[9px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 mt-1">완료 처리에 이의있어요</button>`;
        }
    } else if (visit && visit.status === 'declined') {
        bodyHtml = `<p class="text-[10px] text-ink-400 font-semibold">제안된 일정을 거절했어요. 파트너사의 새 제안을 기다려주세요.</p>`;
    }
    return `<div class="p-3.5 surface-flat space-y-1.5 text-left mt-3">
        <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="ruler" class="w-3.5 h-3.5 text-brand-500"></i> 실측 방문 일정</span>
        ${bodyHtml}
    </div>`;
}

/* 시공 진행 단계 완료 표시(disputeProgressStage)와 하자보수 완료 처리
 * (disputeCompletedRepairClaim)는 둘 다 고객이 이의제기할 수 있게 됐는데, 동일한
 * "파트너 단독 완료 처리" 성격의 실측 방문 완료(completeSiteVisit)에만 이 경로가
 * 빠져 있던 비대칭을 해소한다. */
function disputeSiteVisitCompletion(orderCode, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const visit = order && order.siteVisit;
    if (!visit || visit.status !== 'completed' || visit.disputed) return;

    visit.disputed = true;
    visit.disputeReason = reason;
    visit.disputeResolution = null;
    visit.disputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SITE_VISIT_COMPLETION_DISPUTE', `[${order.clientName}] 고객님이 계약(${order.code}) 실측 방문 완료 처리에 이의를 제기했습니다: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 실측 방문 완료 처리에 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('매니저 센터에 이의제기를 접수했습니다.', 'success');

    selectMyPageEstimate(order.code);
}

/* commissionPaid는 플랫폼 중개 수수료 완납 여부만 표시할 뿐, 정작 고객이 파트너에게
 * 지불하는 공사대금 자체는 finalPrice 총액 하나로만 다뤄졌다 — 계약금/중도금/잔금
 * 단계별 청구(requestPaymentMilestone, partner_panel.js)에 고객이 납부 완료로
 * 응답할 수 있게 한다. */
function buildPaymentMilestonesHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const milestones = typeof sweepOverduePaymentMilestones === 'function' ? sweepOverduePaymentMilestones(order) : getOrInitPaymentMilestones(order);
    const price = order.finalPrice || 0;
    return `<div class="p-3.5 surface-flat space-y-2 text-left mt-3">
        <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="wallet" class="w-3.5 h-3.5 text-brand-500"></i> 단계별 공사대금</span>
        <div class="space-y-1.5">${milestones.map(m => {
            const amount = typeof getMilestoneAmount === 'function' ? getMilestoneAmount(m, price) : Math.floor(price * m.percent / 100);
            const overdue = typeof isMilestoneOverdue === 'function' && isMilestoneOverdue(m);
            const statusBadge = m.status === 'payment_disputed' ? `<span class="badge badge-rose">미입금 이의제기중</span>` : m.status === 'paid' ? `<span class="badge badge-emerald">납부완료</span>` : m.status === 'disputed' ? `<span class="badge badge-rose">이의제기중</span>` : overdue ? `<span class="badge badge-rose">연체</span>` : m.status === 'requested' ? `<span class="badge badge-amber">청구됨</span>` : `<span class="badge badge-neutral">청구 전</span>`;
            return `<div class="p-2.5 bg-ink-50 rounded-lg flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-[11px] font-black text-ink-900">${m.label} ${typeof m.fixedAmount === 'number' ? '' : `(${m.percent}%) `}· ₩${amount.toLocaleString()}만원</p>
                    ${m.status === 'requested' && m.dueDate ? `<p class="text-[10px] ${overdue ? 'text-roseCustom font-bold' : 'text-ink-400 font-semibold'}">납부기한 ${m.dueDate}${overdue ? ' (기한 초과)' : ''}</p>` : ''}
                    ${m.status === 'disputed' ? `<p class="text-[10px] text-roseCustom font-bold">이의제기: ${escapeHtml(m.disputeReason || '')}</p>` : ''}
                    ${m.disputeResolution === 'rejected' ? `<p class="text-[10px] text-ink-400 font-semibold">이의제기 반려됨 — ${escapeHtml(m.disputeAdminResponse || '')}</p>` : ''}
                    ${m.status === 'payment_disputed' ? `<p class="text-[10px] text-roseCustom font-bold">파트너의 미입금 이의제기: ${escapeHtml(m.paymentDisputeReason || '')}</p>` : ''}
                    ${m.paymentDisputeResolution === 'rejected' ? `<p class="text-[10px] text-ink-400 font-semibold">미입금 이의제기 반려됨(납부완료 유지) — ${escapeHtml(m.paymentDisputeAdminResponse || '')}</p>` : ''}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${statusBadge}
                    ${m.status === 'requested' ? `<button type="button" onclick="openMilestoneDisputeModal('${order.code}', '${m.key}')" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">이의제기</button>` : ''}
                    ${m.status === 'requested' ? `<button type="button" onclick="confirmPaymentMilestone('${order.code}', '${m.key}')" class="btn btn-dark btn-sm">납부 완료</button>` : ''}
                </div>
            </div>`;
        }).join('')}</div>
    </div>`;
}

function confirmPaymentMilestone(orderCode, key) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    const milestones = getOrInitPaymentMilestones(order);
    const m = milestones.find(x => x.key === key);
    if (!m || m.status !== 'requested') return;
    m.status = 'paid';
    m.paidDate = getLocalDateString();
    const amount = typeof getMilestoneAmount === 'function' ? getMilestoneAmount(m, order.finalPrice) : Math.floor((order.finalPrice || 0) * m.percent / 100);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PAYMENT_MILESTONE_CONFIRM', `[${order.clientName}] 고객님이 계약(${order.code}) ${m.label} 납부를 완료 처리했습니다. (₩${amount.toLocaleString()}만원)`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 ${m.label} 납부를 완료했어요: ₩${amount.toLocaleString()}만원`);
    showToast(`${m.label} 납부를 완료 처리했습니다.`, 'success');
    selectMyPageEstimate(order.code);
}

/* 파트너의 추가공사 변경계약 제안(openChangeOrderModal, partner_panel.js)에 고객이
 * 동의/거절할 수 있게 한다. 수락 시 계약금액을 올리고, 기존 계약금/중도금/잔금과
 * 동일한 방식(getMilestoneAmount의 fixedAmount)으로 새 청구 항목을 자동 생성한다. */
function respondChangeOrder(orderCode, id, accept) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const entry = order && order.changeOrders && order.changeOrders.find(e => e.id === id);
    if (!entry || entry.status !== 'pending') return;
    entry.status = accept ? 'accepted' : 'rejected';
    entry.resolvedDate = getLocalDateString();

    if (accept) {
        order.finalPrice = (order.finalPrice || 0) + entry.extraAmount;
        const milestones = getOrInitPaymentMilestones(order);
        milestones.push({ key: `change-${entry.id}`, label: `추가공사비 (${entry.description})`, fixedAmount: entry.extraAmount, status: 'pending', requestedDate: null, paidDate: null, dueDate: null });
    }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CHANGE_ORDER_RESPOND', `[${order.clientName}] 고객님이 추가공사 변경계약을 ${accept ? '수락' : '거절'}했습니다: ${entry.description}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 추가공사 제안("${entry.description}")을 ${accept ? '수락했어요. 새 청구 항목이 추가됐어요' : '거절했어요'}.`);
    showToast(accept ? '추가공사를 수락했습니다.' : '추가공사를 거절했습니다.', accept ? 'success' : 'info');
    selectMyPageEstimate(orderCode);
}

function buildClientChangeOrdersHtml(order) {
    if (order.status !== 'contracted') return '';
    const entries = order.changeOrders || [];
    if (entries.length === 0) return '';
    const statusMeta = { pending: { label: '응답 대기중', cls: 'badge-amber' }, accepted: { label: '수락함', cls: 'badge-emerald' }, rejected: { label: '거절함', cls: 'badge-neutral' } };
    return `<div class="p-3.5 surface-flat space-y-2 text-left mt-3">
        <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="file-plus-2" class="w-3.5 h-3.5 text-brand-500"></i> 추가공사 변경계약 제안</span>
        <div class="space-y-1.5">${entries.map(e => {
            const meta = statusMeta[e.status] || statusMeta.pending;
            return `<div class="p-2.5 bg-ink-50 rounded-lg space-y-1">
                <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-900">${escapeHtml(e.description)}</span><span class="badge ${meta.cls}">${meta.label}</span></div>
                <p class="text-[10px] text-ink-500 font-semibold">추가 금액 +₩${e.extraAmount.toLocaleString()}만원 · 제안일 ${e.proposedDate}</p>
                ${e.status === 'pending' ? `<div class="flex gap-1.5 mt-1"><button type="button" onclick="respondChangeOrder('${order.code}', '${e.id}', true)" class="btn btn-dark btn-sm flex-1">수락</button><button type="button" onclick="respondChangeOrder('${order.code}', '${e.id}', false)" class="btn btn-secondary btn-sm flex-1">거절</button></div>` : ''}
            </div>`;
        }).join('')}</div>
    </div>`;
}

/* 청구(requested)된 마일스톤에 고객이 취할 수 있는 행동이 "납부 완료" 하나뿐이라,
 * 착공도 안 됐는데 중도금을 청구하는 등 부당한 청구를 받아도 이의를 제기할 방법이
 * 없었다 — 하자보수 신청의 관리자 재검토 요청(escalateRepairClaimToAdmin)과 동일한
 * 제출→관리자 심사 패턴을 마일스톤 청구에도 적용한다. */
let milestoneDisputeTarget = null;

function openMilestoneDisputeModal(orderCode, key) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'requested') return;
    milestoneDisputeTarget = { orderCode, key };
    safeUpdateValue('milestone-dispute-reason-input', '');
    openModal('milestone-dispute-modal', 'milestone-dispute-modal-card');
}

function closeMilestoneDisputeModal() {
    milestoneDisputeTarget = null;
    closeModal('milestone-dispute-modal', 'milestone-dispute-modal-card');
}

function submitMilestoneDispute() {
    if (!milestoneDisputeTarget) { closeMilestoneDisputeModal(); return; }
    const order = window.AppState.orders.find(o => o.code === milestoneDisputeTarget.orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === milestoneDisputeTarget.key);
    if (!m || m.status !== 'requested') { closeMilestoneDisputeModal(); return; }
    const reason = document.getElementById('milestone-dispute-reason-input')?.value.trim();
    if (!reason) { showToast('이의제기 사유를 입력해주세요.', 'warning'); return; }

    m.status = 'disputed';
    m.disputeReason = reason;
    m.disputeDate = getLocalDateString();
    m.disputeResolution = null;
    m.disputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PAYMENT_MILESTONE_DISPUTE', `[${order.clientName}] 고객님이 계약(${order.code}) ${m.label} 청구에 이의를 제기했습니다: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 ${m.label} 청구에 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('이의제기가 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeMilestoneDisputeModal();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildRepairClaimsHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const statusMeta = {
        submitted: { label: '접수됨', cls: 'badge-amber' },
        in_progress: { label: '처리중', cls: 'badge-brand' },
        completed: { label: '처리완료', cls: 'badge-emerald' },
        rejected: { label: '반려됨', cls: 'badge-neutral' }
    };
    const claims = order.repairClaims || [];
    const listHtml = claims.length === 0 ? '' : `<div class="space-y-2 mt-2">${claims.map(c => {
        const meta = statusMeta[c.status] || statusMeta.submitted;
        return `<div class="p-3 bg-ink-50 rounded-xl space-y-1 text-left">
            <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${escapeHtml(c.title)}</span><span class="badge ${meta.cls}">${meta.label}</span></div>
            <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">${escapeHtml(c.description)}</p>
            <p class="text-[9px] text-ink-400 font-semibold">신청일: ${c.createdDate}</p>
            ${c.partnerResponse ? `<p class="text-[10px] text-brand-600 font-bold leading-relaxed mt-1">파트너 안내: ${escapeHtml(c.partnerResponse)}</p>` : ''}
            ${c.resolvedDate ? `<p class="text-[9px] text-ink-400 font-semibold">처리 완료일: ${c.resolvedDate}</p>` : ''}
            ${c.visitStatus === 'proposed' ? `<div class="p-2 bg-amber-50 rounded-lg space-y-1 mt-1">
                <p class="text-[10px] font-black text-amberCustom">파트너가 방문 일정을 제안했어요: ${c.visitDate}</p>
                <div class="flex gap-1.5"><button type="button" onclick="confirmRepairVisitDate('${order.code}', '${c.id}')" class="btn btn-dark btn-sm flex-1">일정 확정</button><button type="button" onclick="openReportReasonPrompt((reason) => declineRepairVisitDate('${order.code}', '${c.id}', reason))" class="btn btn-secondary btn-sm flex-1">거절</button></div>
            </div>` : c.visitStatus === 'confirmed' ? `<p class="text-[10px] font-black text-emeraldCustom mt-1">방문 일정 확정됨: ${c.visitDate}</p><button type="button" onclick="downloadVisitCalendarFile('하자보수 방문: ${escapeHtml(c.title)} (${order.code})', '${escapeHtml(c.description)}', '${c.visitDate}')" class="text-[9px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-0.5"><i data-lucide="calendar-plus" class="w-3 h-3 inline"></i> 캘린더에 추가</button>`
                : c.visitStatus === 'completed' ? (c.visitCompletionDisputed
                    ? (c.visitCompletionDisputeResolution === 'rejected'
                        ? `<p class="text-[10px] font-black text-ink-500 mt-1">방문 완료됨: ${c.visitCompletedDate}</p><p class="text-[9px] text-ink-400 font-semibold mt-0.5">이의제기 반려됨${c.visitCompletionDisputeAdminResponse ? ` — ${escapeHtml(c.visitCompletionDisputeAdminResponse)}` : ''}</p>`
                        : `<p class="text-[10px] font-black text-ink-500 mt-1">방문 완료됨: ${c.visitCompletedDate}</p><p class="text-[9px] font-black text-amberCustom mt-0.5">이의제기 심사중</p>`)
                    : `<p class="text-[10px] font-black text-ink-500 mt-1">방문 완료됨: ${c.visitCompletedDate}</p><button type="button" onclick="openReportReasonPrompt((reason) => disputeRepairVisitCompletion('${order.code}', '${c.id}', reason))" class="text-[9px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 mt-0.5">완료 처리에 이의있어요</button>`)
                : c.visitStatus === 'declined' ? `<p class="text-[10px] text-ink-400 font-semibold mt-1">제안된 방문 일정을 거절했어요. 파트너사의 새 제안을 기다려주세요.</p>` : ''}
            ${c.status === 'submitted' ? `<button type="button" onclick="retractRepairClaim('${order.code}', '${c.id}')" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 mt-1">신청 철회</button>` : ''}
            ${c.status === 'rejected' ? (c.escalated
                ? `<p class="text-[10px] font-bold text-brand-600 mt-1">매니저 재검토 요청됨</p>`
                : `<button type="button" onclick="openReportReasonPrompt((note) => escalateRepairClaimToAdmin('${order.code}', '${c.id}', note))" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">매니저에게 재검토 요청</button>`) : ''}
            ${c.status === 'completed' ? (c.completionDisputed
                ? (c.completionDisputeResolution === 'rejected'
                    ? `<p class="text-[10px] font-bold text-ink-400 mt-1">이의제기 반려됨${c.completionDisputeAdminResponse ? ` — ${escapeHtml(c.completionDisputeAdminResponse)}` : ''}</p>`
                    : `<p class="text-[10px] font-bold text-amberCustom mt-1">완료 처리 이의제기 심사 대기중</p>`)
                : `<button type="button" onclick="openReportReasonPrompt((note) => disputeCompletedRepairClaim('${order.code}', '${c.id}', note))" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 mt-1">완료 처리에 이의있어요</button>`) : ''}
        </div>`;
    }).join('')}</div>`;
    const warrantyEnd = typeof getWarrantyEndDate === 'function' ? getWarrantyEndDate(order) : null;
    const warrantyExpired = typeof isWarrantyExpired === 'function' && isWarrantyExpired(order);
    let warrantyBadgeHtml = '';
    if (warrantyEnd) {
        if (warrantyExpired) warrantyBadgeHtml = `<span class="badge badge-neutral">보증 만료 (${warrantyEnd.toISOString().slice(0, 10)})</span>`;
        else {
            const daysLeft = Math.max(0, Math.ceil((warrantyEnd - new Date()) / (1000 * 60 * 60 * 24)));
            warrantyBadgeHtml = `<span class="badge badge-emerald">보증 만료까지 D-${daysLeft}</span>`;
        }
    }
    return `<div class="p-3.5 surface-flat space-y-2 text-left mt-3">
        <div class="flex items-center justify-between">
            <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="wrench" class="w-3.5 h-3.5 text-brand-500"></i> 하자보수 신청 (3년 무상 보증) ${warrantyBadgeHtml}</span>
            <button type="button" onclick="openRepairClaimModal('${order.code}')" ${warrantyExpired ? 'disabled title="보증기간이 만료되었습니다"' : ''} class="btn btn-secondary btn-sm">신청하기</button>
        </div>
        ${listHtml}
    </div>`;
}

/* 계약 전 실측 방문은 propose/confirm/decline 전 과정이 있는데(openSiteVisitModal),
 * 계약 후 하자보수(AS) 방문은 파트너가 "처리중"이라고만 표시할 뿐 실제로 언제
 * 방문할지 조율할 방법이 없었다 — 동일한 패턴을 하자보수 신청 건에도 적용한다. */
/* disputeSiteVisitCompletion과 동일하게, 파트너 단독 완료 처리인 하자보수
 * 방문 완료(completeRepairVisit, partner_panel.js)에도 고객 이의제기 경로를
 * 둔다 — 하자보수 신청 자체의 완료 이의제기(disputeCompletedRepairClaim)와는
 * 별개로, 방문 그 자체가 실제로 있었는지를 다투는 경로다. */
function disputeRepairVisitCompletion(orderCode, claimId, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.visitStatus !== 'completed' || claim.visitCompletionDisputed) return;

    claim.visitCompletionDisputed = true;
    claim.visitCompletionDisputeReason = reason;
    claim.visitCompletionDisputeResolution = null;
    claim.visitCompletionDisputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_VISIT_COMPLETION_DISPUTE', `[${order.clientName}] 고객님이 하자보수("${claim.title}") 방문 완료 처리에 이의를 제기했습니다: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 하자보수("${claim.title}") 방문 완료 처리에 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('매니저 센터에 이의제기를 접수했습니다.', 'success');

    selectMyPageEstimate(orderCode);
}

function confirmRepairVisitDate(orderCode, claimId) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.visitStatus !== 'proposed') return;
    claim.visitStatus = 'confirmed';

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_VISIT_CONFIRM', `[${order.clientName}] 고객님이 하자보수("${claim.title}") 방문 일정을 확정했습니다: ${claim.visitDate}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 하자보수("${claim.title}") 방문 일정을 확정했어요: ${claim.visitDate}`);
    showToast('방문 일정을 확정했습니다.', 'success');
    selectMyPageEstimate(orderCode);
}

function declineRepairVisitDate(orderCode, claimId, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.visitStatus !== 'proposed') return;
    claim.visitStatus = 'declined';
    claim.visitDeclineReason = reason;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REPAIR_VISIT_DECLINE', `[${order.clientName}] 고객님이 하자보수("${claim.title}") 방문 일정을 거절했습니다. 사유: ${reason}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 하자보수("${claim.title}") 방문 일정을 거절했어요. 사유: ${reason}`);
    showToast('방문 일정을 거절했습니다.', 'info');
    selectMyPageEstimate(orderCode);
}

/* 계약 체결 후 실측 일정·착공일 변경·금액 변경·마일스톤 청구는 모두 각자 전용
 * 모달로 조율할 수 있는데, 정작 "자재 언제 배송되나요?" 같은 일상적인 소통을
 * 나눌 방법이 전혀 없었다 — 매니저-당사자 간 1:1 쪽지(directMessageThreads)는
 * 있지만 고객-파트너가 서로 직접 대화하는 경로는 없었던 공백. 사진/읽음표시 없는
 * 최소 범위의 메시지 스레드를 계약 상세 화면에 둔다. */
function sendClientOrderMessage(orderCode) {
    const input = document.getElementById(`order-message-input-${orderCode}`);
    const text = input ? input.value : '';
    if (!text.trim()) { showToast('메시지를 입력해주세요.', 'warning'); return; }
    if (typeof sendOrderMessage === 'function') sendOrderMessage(orderCode, 'client', text);
    if (input) input.value = '';
    selectMyPageEstimate(orderCode);
}

/* 계약 전(입찰 진행 중)에는 openEditOrderBudgetModal로 착공일을 자유롭게 고칠 수 있지만,
 * 계약 체결 후에는 이미 파트너 일정이 확정되어 있어 고객이 일방적으로 날짜를 바꾸면
 * 시공 일정이 충돌할 수 있다 — 상대방(계약 파트너사) 동의를 받아야 하는 별도
 * 요청/수락/거절 절차를 둔다. */
let scheduleChangeTargetCode = null;

function openScheduleChangeModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    const req = order.scheduleChangeRequest;
    if (req && req.status === 'pending' && req.requestedBy === 'client') { showToast('이미 처리 대기 중인 일정 변경 요청이 있어요.', 'warning'); return; }
    scheduleChangeTargetCode = orderCode;
    safeUpdateValue('schedule-change-date-input', (req && req.status === 'pending') ? req.newDate : order.preferredDate);
    safeUpdateValue('schedule-change-reason-input', '');
    openModal('schedule-change-modal', 'schedule-change-modal-card');
}

function closeScheduleChangeModal() {
    scheduleChangeTargetCode = null;
    closeModal('schedule-change-modal', 'schedule-change-modal-card');
}

function submitScheduleChangeRequest() {
    const order = window.AppState.orders.find(o => o.code === scheduleChangeTargetCode);
    if (!order) { closeScheduleChangeModal(); return; }
    const newDate = document.getElementById('schedule-change-date-input')?.value;
    const reason = document.getElementById('schedule-change-reason-input')?.value.trim();
    if (!newDate) { showToast('변경할 착공일을 선택해주세요.', 'warning'); return; }
    if (!reason) { showToast('변경 사유를 입력해주세요.', 'warning'); return; }
    if (newDate === order.preferredDate) { showToast('현재 착공일과 동일해요.', 'warning'); return; }

    const isCounter = order.scheduleChangeRequest && order.scheduleChangeRequest.status === 'pending' && order.scheduleChangeRequest.requestedBy === 'partner';
    order.scheduleChangeRequest = { requestedBy: 'client', newDate, reason, status: 'pending', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('CLIENT', isCounter ? 'SCHEDULE_CHANGE_COUNTER' : 'SCHEDULE_CHANGE_REQUEST', `[${order.clientName}] 고객님이 계약(${order.code}) 착공일 변경을 ${isCounter ? '역제안했습니다' : '요청했습니다'}: ${order.preferredDate} → ${newDate}`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, isCounter ? `고객님이 착공일을 ${newDate}로 역제안했어요.` : `고객님이 착공일 변경을 요청했어요: ${order.preferredDate} → ${newDate}`);
    showToast(isCounter ? '역제안을 보냈습니다. 파트너사 확인을 기다려주세요.' : '착공일 변경 요청을 보냈습니다. 파트너사 확인을 기다려주세요.', 'success');

    closeScheduleChangeModal();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function retractScheduleChangeRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.scheduleChangeRequest || order.scheduleChangeRequest.status !== 'pending') return;
    if (order.scheduleChangeRequest.requestedBy !== 'client') { showToast('파트너사가 요청한 일정 변경은 고객이 직접 철회할 수 없어요.', 'warning'); return; }
    order.scheduleChangeRequest = null;
    if (typeof pushLog === 'function') pushLog('CLIENT', 'SCHEDULE_CHANGE_RETRACT', `[${order.clientName}] 고객님이 계약(${order.code}) 착공일 변경 요청을 철회했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 착공일 변경 요청을 철회했어요.`);
    showToast('일정 변경 요청을 철회했습니다.', 'info');
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function respondToPartnerScheduleChangeRequest(orderCode, accept) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.scheduleChangeRequest || order.scheduleChangeRequest.status !== 'pending') return;
    if (order.scheduleChangeRequest.requestedBy !== 'partner') return;
    const { newDate } = order.scheduleChangeRequest;
    if (accept) {
        const oldDate = order.preferredDate;
        order.preferredDate = newDate;
        order.scheduleChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('CLIENT', 'SCHEDULE_CHANGE_ACCEPT', `[${order.clientName}] 고객님이 계약(${order.code}) 착공일 변경 요청을 수락했습니다: ${oldDate} → ${newDate}`, 'INFO');
        if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 착공일 변경을 수락했어요. 착공일이 ${newDate}로 변경되었습니다.`);
        showToast('착공일 변경을 수락했습니다.', 'success');
    } else {
        order.scheduleChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('CLIENT', 'SCHEDULE_CHANGE_REJECT', `[${order.clientName}] 고객님이 계약(${order.code}) 착공일 변경 요청을 거절했습니다.`, 'INFO');
        if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 착공일 변경 요청을 거절했어요. 기존 일정(${order.preferredDate})이 유지됩니다.`);
        showToast('착공일 변경 요청을 거절했습니다.', 'info');
    }
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildScheduleChangeHtml(order) {
    const req = order.scheduleChangeRequest;
    let statusHtml = '';
    if (req && req.status === 'pending') {
        statusHtml = req.requestedBy === 'client'
            ? `<div class="p-2.5 bg-amber-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-amberCustom">파트너사 확인 대기중: ${req.newDate}로 변경 요청</p>
                <button type="button" onclick="retractScheduleChangeRequest('${order.code}')" class="btn btn-secondary btn-sm">요청 철회</button>
            </div>`
            : `<div class="p-2.5 bg-brand-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-brand-700">파트너사가 착공일 변경을 요청했어요: ${req.newDate} (사유: ${escapeHtml(req.reason)})</p>
                <div class="flex gap-1.5"><button type="button" onclick="respondToPartnerScheduleChangeRequest('${order.code}', true)" class="btn btn-dark btn-sm flex-1">수락</button><button type="button" onclick="respondToPartnerScheduleChangeRequest('${order.code}', false)" class="btn btn-secondary btn-sm flex-1">거절</button><button type="button" onclick="openScheduleChangeModal('${order.code}')" class="btn btn-ghost btn-sm flex-1">역제안</button></div>
            </div>`;
    }
    return `<div class="p-3 bg-ink-50 rounded-xl flex items-center justify-between mt-2">
        <span class="text-[11px] font-bold text-ink-600 flex items-center gap-1.5"><i data-lucide="calendar-clock" class="w-3.5 h-3.5 text-ink-500"></i> 착공일</span>
        <div class="flex items-center gap-2">
            <span class="text-[11px] font-black text-ink-900">${order.preferredDate}</span>
            ${!req || req.status !== 'pending' ? `<button type="button" onclick="openScheduleChangeModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">변경 요청</button>` : ''}
        </div>
    </div>${statusHtml}`;
}

/* 계약 후 착공일은 조율할 수 있게 됐지만(scheduleChangeRequest), 추가 공사나 자재
 * 변경으로 계약 금액 자체가 바뀌어야 하는 경우는 여전히 대응할 방법이 없었다 —
 * 동일한 요청/수락/거절/철회 패턴을 계약 금액에도 그대로 적용한다. */
let priceChangeTargetCode = null;

function openPriceChangeModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    const req = order.priceChangeRequest;
    if (req && req.status === 'pending' && req.requestedBy === 'client') { showToast('이미 처리 대기 중인 금액 변경 요청이 있어요.', 'warning'); return; }
    priceChangeTargetCode = orderCode;
    safeUpdateValue('price-change-amount-input', (req && req.status === 'pending') ? req.newPrice : (order.finalPrice || order.budget));
    safeUpdateValue('price-change-reason-input', '');
    openModal('price-change-modal', 'price-change-modal-card');
}

function closePriceChangeModal() {
    priceChangeTargetCode = null;
    closeModal('price-change-modal', 'price-change-modal-card');
}

function submitPriceChangeRequest() {
    const order = window.AppState.orders.find(o => o.code === priceChangeTargetCode);
    if (!order) { closePriceChangeModal(); return; }
    const newPrice = parseInt(document.getElementById('price-change-amount-input')?.value, 10);
    const reason = document.getElementById('price-change-reason-input')?.value.trim();
    if (!newPrice || newPrice <= 0) { showToast('변경할 계약 금액을 올바르게 입력해주세요.', 'warning'); return; }
    if (!reason) { showToast('변경 사유를 입력해주세요.', 'warning'); return; }
    if (newPrice === order.finalPrice) { showToast('현재 계약 금액과 동일해요.', 'warning'); return; }

    const isCounter = order.priceChangeRequest && order.priceChangeRequest.status === 'pending' && order.priceChangeRequest.requestedBy === 'partner';
    order.priceChangeRequest = { requestedBy: 'client', newPrice, reason, status: 'pending', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('CLIENT', isCounter ? 'PRICE_CHANGE_COUNTER' : 'PRICE_CHANGE_REQUEST', `[${order.clientName}] 고객님이 계약(${order.code}) 금액 변경을 ${isCounter ? '역제안했습니다' : '요청했습니다'}: ₩${(order.finalPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, isCounter ? `고객님이 계약 금액을 ₩${newPrice.toLocaleString()}만원으로 역제안했어요.` : `고객님이 계약 금액 변경을 요청했어요: ₩${(order.finalPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`);
    showToast(isCounter ? '역제안을 보냈습니다. 파트너사 확인을 기다려주세요.' : '계약 금액 변경 요청을 보냈습니다. 파트너사 확인을 기다려주세요.', 'success');

    closePriceChangeModal();
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function retractPriceChangeRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.priceChangeRequest || order.priceChangeRequest.status !== 'pending') return;
    if (order.priceChangeRequest.requestedBy !== 'client') { showToast('파트너사가 요청한 금액 변경은 고객이 직접 철회할 수 없어요.', 'warning'); return; }
    order.priceChangeRequest = null;
    if (typeof pushLog === 'function') pushLog('CLIENT', 'PRICE_CHANGE_RETRACT', `[${order.clientName}] 고객님이 계약(${order.code}) 금액 변경 요청을 철회했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약 금액 변경 요청을 철회했어요.`);
    showToast('금액 변경 요청을 철회했습니다.', 'info');
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function respondToPartnerPriceChangeRequest(orderCode, accept) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.priceChangeRequest || order.priceChangeRequest.status !== 'pending') return;
    if (order.priceChangeRequest.requestedBy !== 'partner') return;
    const { newPrice } = order.priceChangeRequest;
    if (accept) {
        const oldPrice = order.finalPrice;
        order.finalPrice = newPrice;
        order.priceChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('CLIENT', 'PRICE_CHANGE_ACCEPT', `[${order.clientName}] 고객님이 계약(${order.code}) 금액 변경 요청을 수락했습니다: ₩${(oldPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`, 'INFO');
        if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약 금액 변경을 수락했어요. 계약 금액이 ₩${newPrice.toLocaleString()}만원으로 변경되었습니다.`);
        showToast('계약 금액 변경을 수락했습니다.', 'success');
    } else {
        order.priceChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('CLIENT', 'PRICE_CHANGE_REJECT', `[${order.clientName}] 고객님이 계약(${order.code}) 금액 변경 요청을 거절했습니다.`, 'INFO');
        if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약 금액 변경 요청을 거절했어요. 기존 금액(₩${(order.finalPrice || 0).toLocaleString()}만원)이 유지됩니다.`);
        showToast('계약 금액 변경 요청을 거절했습니다.', 'info');
    }
    selectMyPageEstimate(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildPriceChangeHtml(order) {
    const req = order.priceChangeRequest;
    let statusHtml = '';
    if (req && req.status === 'pending') {
        statusHtml = req.requestedBy === 'client'
            ? `<div class="p-2.5 bg-amber-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-amberCustom">파트너사 확인 대기중: ₩${req.newPrice.toLocaleString()}만원으로 변경 요청</p>
                <button type="button" onclick="retractPriceChangeRequest('${order.code}')" class="btn btn-secondary btn-sm">요청 철회</button>
            </div>`
            : `<div class="p-2.5 bg-brand-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-brand-700">파트너사가 계약 금액 변경을 요청했어요: ₩${req.newPrice.toLocaleString()}만원 (사유: ${escapeHtml(req.reason)})</p>
                <div class="flex gap-1.5"><button type="button" onclick="respondToPartnerPriceChangeRequest('${order.code}', true)" class="btn btn-dark btn-sm flex-1">수락</button><button type="button" onclick="respondToPartnerPriceChangeRequest('${order.code}', false)" class="btn btn-secondary btn-sm flex-1">거절</button><button type="button" onclick="openPriceChangeModal('${order.code}')" class="btn btn-ghost btn-sm flex-1">역제안</button></div>
            </div>`;
    }
    return `<div class="p-3 bg-ink-50 rounded-xl flex items-center justify-between mt-2">
        <span class="text-[11px] font-bold text-ink-600 flex items-center gap-1.5"><i data-lucide="banknote" class="w-3.5 h-3.5 text-ink-500"></i> 계약 금액</span>
        <div class="flex items-center gap-2">
            <span class="text-[11px] font-black text-ink-900">₩ ${(order.finalPrice || 0).toLocaleString()}만원</span>
            ${!req || req.status !== 'pending' ? `<button type="button" onclick="openPriceChangeModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">변경 요청</button>` : ''}
        </div>
    </div>${statusHtml}`;
}

/* 파트너는 노쇼·상습 갑질 고객을 신고할 수 있게 됐는데(openReportClientModal,
 * partner_panel.js) 정작 반대 방향(고객이 부실 시공·계약 불이행 파트너를 신고)은
 * 방법이 없었다 — 동일한 window.AppState.clientReports 패턴을 대칭으로 두되,
 * 파트너 대상이므로 별도 partnerReports 배열에 쌓아 관리자 파트너 모니터링에서 확인한다. */
let reportPartnerTargetCode = null;

function isPartnerReportedByMeForOrder(orderCode) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    return (window.AppState.partnerReports || []).some(r => r.orderCode === orderCode && r.reportedByClient === auth.id);
}

function openReportPartnerModal(orderCode) {
    const auth = window.AppState.clientAuth;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!auth || !auth.loggedIn || !order || order.status !== 'contracted') return;
    if (isPartnerReportedByMeForOrder(orderCode)) { showToast('이미 신고를 접수한 계약입니다.', 'info'); return; }
    reportPartnerTargetCode = orderCode;
    safeUpdateValue('report-partner-reason', '');
    openModal('report-partner-modal', 'report-partner-modal-card');
}

function closeReportPartnerModal() {
    reportPartnerTargetCode = null;
    closeModal('report-partner-modal', 'report-partner-modal-card');
}

function submitPartnerReport() {
    const auth = window.AppState.clientAuth;
    const order = window.AppState.orders.find(o => o.code === reportPartnerTargetCode);
    if (!order) { closeReportPartnerModal(); return; }
    if (isPartnerReportedByMeForOrder(order.code)) { showToast('이미 신고를 접수한 계약입니다.', 'info'); closeReportPartnerModal(); return; }

    const reason = document.getElementById('report-partner-reason')?.value.trim();
    if (!reason) { showToast('신고 사유를 입력해 주세요.', 'warning'); return; }

    if (!window.AppState.partnerReports) window.AppState.partnerReports = [];
    window.AppState.partnerReports.unshift({
        id: `prpt-${Date.now()}`, orderCode: order.code, partnerName: order.acceptedPartner,
        reportedByClient: auth.id, clientName: auth.name, reason, date: getLocalDateString()
    });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PARTNER_REPORT', `[${auth.name}] 고객님이 오더 ${order.code}의 계약 파트너사(${order.acceptedPartner})를 신고했습니다.`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객으로부터 신고가 접수되어 매니저 센터가 검토 중입니다. 부당하다고 생각되시면 마이페이지 계정 정보에서 소명하실 수 있어요.`);
    showToast('신고가 접수되었습니다. 매니저 센터에서 검토할게요.', 'success');
    closeReportPartnerModal();
    renderClientMyPage();
    selectMyPageEstimate(order.code);
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

/* 계약 취소·일정/금액 변경 요청은 물론 하자보수 신청까지 전부 신청자 본인이 철회할
 * 수 있는데, 파트너 신고만 유일하게 "잘못 신고했다"거나 "오해가 풀렸다"는 이유로도
 * 철회할 방법이 없었다 — 관리자가 검토하기 전까지는 신고 접수 취소도 신고자의
 * 권리로 열어준다. */
function retractPartnerReport(orderCode) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return;
    const report = (window.AppState.partnerReports || []).find(r => r.orderCode === orderCode && r.reportedByClient === auth.id);
    if (!report) return;

    window.AppState.partnerReports = window.AppState.partnerReports.filter(r => r.id !== report.id);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PARTNER_REPORT_RETRACT', `[${auth.name}] 고객님이 오더 ${orderCode}의 파트너 신고를 철회했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && report.partnerName) pushPartnerNotification(report.partnerName, `고객님이 신고를 철회했어요.`);
    showToast('신고를 철회했습니다.', 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function clientFinalizeContract(orderCode, partnerName, finalPrice) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    const partnerInfo = window.AppState.partners.find(p => p.name === partnerName);
    if (partnerInfo && partnerInfo.status === 'banned') {
        showToast(`[${partnerName}] 파트너사는 삼진아웃으로 영구 제명되어 계약을 체결할 수 없어요. 매칭취소 후 다른 파트너사를 이용해 주세요.`, 'warning');
        return;
    }
    order.status = 'contracted';
    order.acceptedPartner = partnerName;
    order.finalPrice = finalPrice;

    const badgeContainer = document.getElementById('report-contract-badge-container');
    const partnerNameEl = document.getElementById('report-contract-partner');
    const uploadStatusEl = document.getElementById('report-contract-upload-status');
    const reviewActionContainer = document.getElementById('review-action-container');

    if (badgeContainer) badgeContainer.classList.remove('hidden');
    if (partnerNameEl) partnerNameEl.innerText = `${partnerName}와 계약체결`;
    if (uploadStatusEl) uploadStatusEl.innerText = `계약서 미제출 (업로드 대기)`;
    if (reviewActionContainer) {
        reviewActionContainer.innerHTML = `<p class="text-[10px] text-ink-500 font-bold text-center">시공사 정합 계약서 등록 및 서명 진행 후 별점 쓰기가 정식 가동됩니다.</p>`;
    }

    if (typeof recalculateKPIs === 'function') recalculateKPIs();
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (window.AppState.selectedOrderCode === orderCode && typeof selectOrderForAudit === 'function') selectOrderForAudit(orderCode);

    if (window.AppState.clientAuth.loggedIn) { renderClientMyPage(); selectMyPageEstimate(orderCode); }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONTRACT', `${maskName(order.clientName)} 고객님이 [${partnerName}]와 계약 합의서에 서명함.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}와 계약이 체결됐어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') {
        pushPartnerNotification(partnerName, `고객님과 계약이 체결됐어요! (의뢰 코드: ${orderCode}, 계약금액 ₩ ${finalPrice.toLocaleString()}만원)`);
        // 낙찰되지 않은 다른 입찰 참여사는 지금까지 아무 알림도 못 받고, 오더 상세를
        // 다시 열어봐야만 "다른 파트너사와 계약 체결됨"을 우연히 확인할 수 있었다.
        (order.bids || []).filter(b => b.partner !== partnerName).forEach(b => pushPartnerNotification(b.partner, `오더(${orderCode})가 다른 파트너사와 계약 체결되어 매칭이 마감됐어요.`));
    }
    showToast(`${partnerName}와 시공 계약 합의 체결 완료!`, 'success');
}

function sendClientAuthCode() {
    const nameInput = document.getElementById('form-client-name');
    const phoneInput = document.getElementById('form-client-phone');
    const wrapper = document.getElementById('form-auth-code-wrapper');

    if (!nameInput || !nameInput.value.trim() || !phoneInput || !phoneInput.value.trim()) {
        showToast("의뢰인의 성함과 휴대폰 연락처를 올바르게 작성한 뒤\n인증을 시도해 주세요.", "warning");
        return;
    }

    const mockCode = String(Math.floor(1000 + Math.random() * 9000));
    window.AppState.clientAuth.sentCode = mockCode;
    if (wrapper) wrapper.classList.remove('hidden');

    if (typeof pushLog === 'function') pushLog('CLIENT', 'AUTH_SMS', `[${nameInput.value.trim()}] 고객님의 보안인증: 가상 SMS [${mockCode}] 전송 성공.`, 'INFO');
    showToast(`가상 SMS 인증코드 [${mockCode}]가 발송되었습니다.`, 'info');
}

function switchClientAuthTab(tab) {
    const loginTabBtn = document.getElementById('form-tab-login');
    const signupTabBtn = document.getElementById('form-tab-signup');
    const loginPane = document.getElementById('form-login-pane');
    const signupPane = document.getElementById('form-signup-pane');
    if (!loginTabBtn || !signupTabBtn || !loginPane || !signupPane) return;

    if (tab === 'signup') {
        signupTabBtn.classList.add('active'); loginTabBtn.classList.remove('active');
        signupPane.classList.remove('hidden'); loginPane.classList.add('hidden');
    } else {
        loginTabBtn.classList.add('active'); signupTabBtn.classList.remove('active');
        loginPane.classList.remove('hidden'); signupPane.classList.add('hidden');
    }
}

function verifyClientSignupPhone() {
    const nameEl = document.getElementById('form-client-name');
    const phoneEl = document.getElementById('form-client-phone');
    const codeEl = document.getElementById('form-client-code');
    const fieldsWrapper = document.getElementById('form-signup-account-fields');
    if (!nameEl || !phoneEl || !codeEl) return;

    const nameVal = nameEl.value.trim();
    const phoneVal = phoneEl.value.trim();
    const codeVal = codeEl.value.trim();

    if (!nameVal || !phoneVal) { showToast("성함과 연락처를 입력해주세요.", "warning"); return; }
    if (!window.AppState.clientAuth.sentCode || codeVal !== window.AppState.clientAuth.sentCode) {
        showToast("인증코드가 일치하지 않습니다. 다시 확인해 주세요.", "warning");
        return;
    }

    window.AppState.clientAuth.phoneVerified = true;
    if (fieldsWrapper) fieldsWrapper.classList.remove('hidden');
    if (typeof pushLog === 'function') pushLog('CLIENT', 'PHONE_VERIFIED', `'${nameVal}' 고객님 휴대폰 본인인증 완료.`, 'SUCCESS');
    showToast("본인인증이 완료되었습니다! 사용하실 아이디와 비밀번호를 설정해 주세요.", "success");
}

function submitClientSignup() {
    const auth = window.AppState.clientAuth;
    if (!auth.phoneVerified) { showToast("먼저 휴대폰 본인인증을 완료해 주세요.", "warning"); return; }

    const nameVal = document.getElementById('form-client-name')?.value.trim();
    const phoneVal = document.getElementById('form-client-phone')?.value.trim();
    const idVal = document.getElementById('form-signup-id')?.value.trim();
    const pwVal = document.getElementById('form-signup-pw')?.value;
    const pw2Val = document.getElementById('form-signup-pw2')?.value;

    if (!nameVal || !idVal || !pwVal || !pw2Val) { showToast("아이디와 비밀번호를 모두 입력해 주세요.", "warning"); return; }
    // 아이디는 영문/숫자/밑줄/하이픈만 허용한다. 이 아이디는 이후 여러 화면에서 onclick="fn('${id}')"
    // 형태로 그대로 삽입되므로, 따옴표 등을 허용하면 저장형 XSS/JS 인젝션으로 이어질 수 있다.
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(idVal)) { showToast("아이디는 영문, 숫자, _, - 조합으로 3~20자로 입력해 주세요.", "warning"); return; }
    // 이름은 파트너 콘솔·관제 로그 등 여러 화면에서 이스케이프 없이 그대로 노출되는
    // 곳이 있어, 따옴표/꺾쇠 등을 허용하면 저장형 XSS로 이어질 수 있다.
    if (/['"`<>\\]/.test(nameVal)) { showToast("성함에는 따옴표, 백틱, 꺾쇠, 백슬래시를 사용할 수 없습니다.", "warning"); return; }
    if (pwVal !== pw2Val) { showToast("비밀번호가 일치하지 않습니다.", "warning"); return; }
    if (window.AppState.clientAccounts.some(acc => acc.id === idVal)) { showToast("이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.", "warning"); return; }
    if (window.AppState.clientAccounts.some(acc => acc.phone === phoneVal)) { showToast("이미 가입된 휴대폰 번호입니다. 아이디를 잊으셨다면 고객센터에 문의해 주세요.", "warning"); return; }

    // 추천인 아이디는 선택 입력이라, 존재하지 않거나 자기 자신을 적어도 가입 자체를
    // 막지는 않는다 — 조용히 무시하고 정상 가입만 진행한다.
    const referralIdVal = document.getElementById('form-signup-referral')?.value.trim();
    const referrer = referralIdVal ? window.AppState.clientAccounts.find(acc => acc.id === referralIdVal) : null;
    if (referralIdVal && !referrer) { showToast("추천인 아이디를 찾을 수 없어 추천 없이 가입을 진행합니다.", "info"); }

    const newAccount = { id: idVal, pw: pwVal, name: nameVal, phone: phoneVal };
    if (referrer) newAccount.referredBy = referrer.id;
    window.AppState.clientAccounts.push(newAccount);
    auth.loggedIn = true; auth.id = idVal; auth.name = nameVal; auth.phone = phoneVal;
    window.AppState.formData.clientName = nameVal;
    window.AppState.formData.clientPhone = phoneVal;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SIGNUP_SUCCESS', `'${nameVal}'(${idVal}) 고객님 회원가입 및 로그인 완료.${referrer ? ` (추천인: ${referrer.id})` : ''}`, 'SUCCESS');
    showToast(`회원가입이 완료되었습니다!\n반갑습니다, ${nameVal} 고객님.`, 'success');

    toggleClientAuthUI(); syncFormStateUI();
    completePostLoginRedirect();
}

function loginClientWithId() {
    const idEl = document.getElementById('form-login-id');
    const pwEl = document.getElementById('form-login-pw');
    if (!idEl || !pwEl) return;

    const idVal = idEl.value.trim();
    const pwVal = pwEl.value;
    if (!idVal || !pwVal) { showToast("아이디와 비밀번호를 입력해 주세요.", "warning"); return; }

    const account = window.AppState.clientAccounts.find(acc => acc.id === idVal && acc.pw === pwVal);
    if (!account) { showToast("아이디 또는 비밀번호가 일치하지 않습니다.", "warning"); return; }
    if (account.status === 'banned') { showToast("삼진아웃 누적 초과(경고 3회 이상)로 영구 제명 처리된 계정입니다.", "warning"); return; }
    if (account.isSuspended) { openSuspensionAppealModal(account.id); return; }
    if (account.status === 'withdrawn') { showToast("탈퇴한 계정입니다. 새로 가입 후 이용해 주세요.", "warning"); return; }

    const auth = window.AppState.clientAuth;
    auth.loggedIn = true; auth.id = account.id; auth.name = account.name; auth.phone = account.phone;
    window.AppState.formData.clientName = account.name;
    window.AppState.formData.clientPhone = account.phone;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'LOGIN_SUCCESS', `'${account.name}'(${account.id}) 고객님 로그인 완료.`, 'SUCCESS');
    showToast(`반갑습니다, ${account.name} 고객님.`, 'success');

    toggleClientAuthUI(); syncFormStateUI();
    completePostLoginRedirect();
}

/* 이용 정지된 계정은 로그인 자체가 막혀 마이페이지에 전혀 접근할 수 없으므로,
 * 파트너의 옐로카드 이의신청(strikeAppeal)과 동일한 절차를 로그인 화면에서
 * 바로 제출할 수 있게 한다 — 정지 사유가 부당하다고 여겨도 지금까지는 "고객센터로
 * 문의해 주세요" 안내만 있었고 실제로 소명할 방법은 전혀 없었다. */
let suspensionAppealTargetId = null;

function openSuspensionAppealModal(accountId) {
    const account = window.AppState.clientAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    if (account.suspensionAppeal && account.suspensionAppeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요. 매니저 센터 심사 결과를 기다려주세요.', 'warning'); return; }
    suspensionAppealTargetId = accountId;
    safeUpdateValue('suspension-appeal-reason-input', '');
    openModal('suspension-appeal-modal', 'suspension-appeal-modal-card');
}

function closeSuspensionAppealModal() {
    suspensionAppealTargetId = null;
    closeModal('suspension-appeal-modal', 'suspension-appeal-modal-card');
}

function submitSuspensionAppeal() {
    const account = window.AppState.clientAccounts.find(acc => acc.id === suspensionAppealTargetId);
    if (!account) { closeSuspensionAppealModal(); return; }
    const reason = document.getElementById('suspension-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    account.suspensionAppeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CLIENT_SUSPENSION_APPEAL', `'${account.name}'(${account.id}) 고객님이 계정 정지에 대해 이의신청을 제출했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `계정 정지 이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.`);
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeSuspensionAppealModal();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
}

/* 파트너 쪽 옐로카드 이의신청(openStrikeAppealModal, cms.js)과 동일한 구조를
 * 고객 경고(issueClientStrike, partner_panel.js)에도 적용한다 — 영구 제명(status
 * === 'banned')된 계정은 파트너 제명과 동일하게 로그인 자체가 막히므로(위
 * loginClientWithId의 하드 블록), 이 모달은 아직 경고만 쌓인 상태에서 로그인 중인
 * 고객이 마이페이지에서 소명할 때만 실제로 열린다. */
let clientStrikeAppealTargetId = null;

function openClientStrikeAppealModal() {
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if ((account.clientStrikeCount || 0) <= 0 && account.status !== 'banned') { showToast('이의신청할 경고 기록이 없어요.', 'info'); return; }
    if (account.clientStrikeAppeal && account.clientStrikeAppeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    clientStrikeAppealTargetId = account.id;
    safeUpdateValue('client-strike-appeal-reason-input', '');
    openModal('client-strike-appeal-modal', 'client-strike-appeal-modal-card');
}

function closeClientStrikeAppealModal() {
    clientStrikeAppealTargetId = null;
    closeModal('client-strike-appeal-modal', 'client-strike-appeal-modal-card');
}

function submitClientStrikeAppeal() {
    const account = window.AppState.clientAccounts.find(acc => acc.id === clientStrikeAppealTargetId);
    if (!account) { closeClientStrikeAppealModal(); return; }
    const reason = document.getElementById('client-strike-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    account.clientStrikeAppeal = { reason, strikeCountAtAppeal: account.clientStrikeCount || 0, wasBanned: account.status === 'banned', status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CLIENT_STRIKE_APPEAL', `[${account.name}] 고객님이 경고/제명 조치에 대해 이의신청을 제출했습니다. (당시 누적 ${account.clientStrikeCount || 0}회)`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeClientStrikeAppealModal();
    renderClientStrikeAppealStatus();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
}

function renderClientStrikeAppealStatus() {
    const container = document.getElementById('client-strike-appeal-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;

    const isBanned = account.status === 'banned';
    const hasStrikes = (account.clientStrikeCount || 0) > 0 || isBanned;
    const appeal = account.clientStrikeAppeal;

    if (!hasStrikes && !appeal) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">현재 경고 기록이 없습니다.</p>`;
        return;
    }
    if (appeal && appeal.status === 'pending') {
        container.innerHTML = `<div class="p-2.5 bg-amber-50 rounded-xl space-y-1"><p class="text-[10px] font-black text-amberCustom">이의신청 심사 대기중</p><p class="text-[10px] text-ink-500 font-semibold leading-relaxed">${escapeHtml(appeal.reason)}</p></div>`;
        return;
    }
    let resolvedHtml = '';
    if (appeal && appeal.status !== 'pending') {
        resolvedHtml = `<div class="p-2.5 ${appeal.status === 'approved' ? 'bg-emerald-50' : 'bg-ink-50'} rounded-xl space-y-1 mb-2">
            <p class="text-[10px] font-black ${appeal.status === 'approved' ? 'text-emeraldCustom' : 'text-ink-500'}">이의신청 ${appeal.status === 'approved' ? '승인됨' : '반려됨'} (${appeal.resolvedDate || ''})</p>
            ${appeal.adminResponse ? `<p class="text-[10px] text-ink-500 font-semibold leading-relaxed">매니저 답변: ${escapeHtml(appeal.adminResponse)}</p>` : ''}
        </div>`;
    }
    container.innerHTML = hasStrikes
        ? `${resolvedHtml}<p class="text-[10px] font-black text-ink-500">누적 경고: ${account.clientStrikeCount || 0}/3회${isBanned ? ' (영구 제명)' : ''}</p><button type="button" onclick="openClientStrikeAppealModal()" class="btn btn-secondary btn-sm mt-1">${isBanned ? '영구 제명' : '경고'} 이의신청하기</button>`
        : resolvedHtml;
}

function performClientLogout() {
    const auth = window.AppState.clientAuth;
    auth.loggedIn = false; auth.id = ''; auth.name = ''; auth.phone = ''; auth.sentCode = null; auth.phoneVerified = false;

    ['form-client-name','form-client-phone','form-client-code','form-signup-id','form-signup-pw','form-signup-pw2','form-login-id','form-login-pw'].forEach(id => safeUpdateValue(id, ''));
    document.getElementById('form-auth-code-wrapper')?.classList.add('hidden');
    document.getElementById('form-signup-account-fields')?.classList.add('hidden');
    switchClientAuthTab('login');

    toggleClientAuthUI(); syncFormStateUI();
    showToast("로그아웃 되었습니다.", "info");

    // 로그인 필요 화면(견적신청/마이페이지)에 남아있으면 다음 렌더에서 어색하게
    // 비어보이므로, 로그아웃 시 홈으로 돌려보낸다.
    const gatedPanels = ['client-panel', 'client-mypage-panel'];
    if (gatedPanels.includes(window.AppState.currentPanel)) switchPanel('home-panel');
}

/* 상단 내비게이션의 '고객 로그인' 버튼 — 파트너/매니저 로그인 버튼 옆에서
 * 견적 신청 흐름과 별개로 언제든 고객 로그인 페이지에 바로 진입할 수 있게 한다. */
function handleClientLoginNavClick() {
    if (window.AppState.clientAuth && window.AppState.clientAuth.loggedIn) {
        performClientLogout();
    } else {
        goToLoginPanel(null);
    }
}

/* 로그인이 필요한 동작(견적 신청, 마이페이지, 커뮤니티 글쓰기 등)에서 공통으로 쓰는
 * 진입점. targetPanel을 기억해뒀다가 로그인/회원가입 성공 시 그 화면으로 이어서
 * 보낸다(completePostLoginRedirect 참고). */
let postLoginRedirectPanel = null;
function setPostLoginRedirect(panelId) { postLoginRedirectPanel = panelId; }
function goToLoginPanel(targetPanel) {
    postLoginRedirectPanel = targetPanel || null;
    switchPanel('client-login-panel');
}
function completePostLoginRedirect() {
    const target = postLoginRedirectPanel || 'home-panel';
    postLoginRedirectPanel = null;
    switchPanel(target);
}

function toggleClientAuthUI() {
    const auth = window.AppState.clientAuth;
    const unverifiedCard = document.getElementById('form-auth-unverified');
    const verifiedCard = document.getElementById('form-auth-verified');
    const verifiedUserInfo = document.getElementById('form-verified-user-info');

    const navLabel = document.getElementById('nav-client-login-label');
    const navLabelM = document.getElementById('nav-client-login-label-m');
    if (navLabel) navLabel.innerText = auth.loggedIn ? `${auth.name}님 로그아웃` : '고객 로그인';
    if (navLabelM) navLabelM.innerText = auth.loggedIn ? '로그아웃' : '로그인';

    if (auth.loggedIn) {
        unverifiedCard?.classList.add('hidden');
        if (verifiedCard) { verifiedCard.classList.remove('hidden'); if (verifiedUserInfo) verifiedUserInfo.innerText = `로그인 완료: ${auth.name} (${auth.id})`; }
    } else {
        unverifiedCard?.classList.remove('hidden');
        verifiedCard?.classList.add('hidden');
    }
}

/* 의뢰이력 필터 — '1:1 지정 매칭'은 자동매칭 견적과 성격이 달라 따로 걸러볼 수 있게 한다. */
let clientMyPageHistoryFilter = 'all';
/* 의뢰가 쌓일수록 "지금 진행 중인 것만", "철회된 건 제외하고" 같은 걸 찾기
 * 어려워진다 — 매칭 방식(자동/1:1) 필터와 별개로 상태(입찰중/계약체결/철회)
 * 필터를 추가한다. */
let clientMyPageHistoryStatusFilter = 'all';

function setClientMyPageHistoryFilter(filterKey) {
    clientMyPageHistoryFilter = filterKey;
    window.AppState.selectedMyPageOrderCode = null;
    renderClientMyPage();
}

function setClientMyPageHistoryStatusFilter(statusKey) {
    clientMyPageHistoryStatusFilter = statusKey;
    window.AppState.selectedMyPageOrderCode = null;
    renderClientMyPage();
}

/* 마이페이지 상단 메인 탭 — '의뢰이력'과 '내가 쓴 글'을 완전히 분리된 화면으로 전환한다. */
let clientMyPageActiveSubtab = 'history';

function switchClientMyPageSubtab(tab) {
    clientMyPageActiveSubtab = tab;
    renderClientMyPage();
}

/* 파트너 쪽엔 누적 계약 실적 기반 등급 배지(computePartnerTier, partner_panel.js)가
 * 있는데 고객 쪽엔 대칭되는 개념이 전혀 없었다 — 재의뢰가 잦은 단골 고객이라도
 * 신규 고객과 똑같이 보였다. 새 결제/포인트 체계를 만들지 않고, 순수 누적 계약
 * 건수로만 산정해 마이페이지 헤더와 파트너가 보는 화면에 노출한다. */
const CLIENT_TIER_DEFS = [
    { key: 'vip', label: 'VIP 고객', minContracts: 5, cls: 'badge-gold' },
    { key: 'preferred', label: '우수 고객', minContracts: 2, cls: 'badge-brand' }
];

function computeClientTier(clientPhone) {
    if (!clientPhone) return null;
    const contractedCount = (window.AppState.orders || []).filter(o => o.status === 'contracted' && o.clientPhone === clientPhone).length;
    return CLIENT_TIER_DEFS.find(t => contractedCount >= t.minContracts) || null;
}

function buildClientTierBadgeHtml(clientPhone) {
    const tier = computeClientTier(clientPhone);
    return tier ? `<span class="badge ${tier.cls}">${tier.label}</span>` : '';
}

function renderClientMyPage() {
    const listContainer = document.getElementById('client-mypage-estimates-container');
    const detailEmpty = document.getElementById('client-mypage-detail-empty');
    const detailBoard = document.getElementById('client-mypage-detail-board');
    if (!listContainer) return;

    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;

    const tierBadgeEl = document.getElementById('client-mypage-tier-badge');
    if (tierBadgeEl) tierBadgeEl.innerHTML = buildClientTierBadgeHtml(auth.phone);

    const myPostsCount = (window.AppState.communityPosts || []).filter(p => p.authorId === auth.id).length;
    const myNotifications = (window.AppState.clientNotifications || []).filter(n => n.clientPhone === auth.phone);
    const unreadCount = myNotifications.filter(n => !n.read).length;
    const mainTabsEl = document.getElementById('client-mypage-main-tabs');
    if (mainTabsEl) {
        const myFavoritesCount = (window.AppState.clientAccounts.find(acc => acc.id === auth.id)?.favoritePartners || []).length;
        const mainTabs = [
            ['history', '의뢰이력'],
            ['posts', `내가 쓴 글 (${myPostsCount})`],
            ['favorites', `관심 파트너 (${myFavoritesCount})`],
            ['notifications', unreadCount > 0 ? `알림 (${unreadCount})` : '알림'],
            ['account', '계정 정보']
        ];
        mainTabsEl.innerHTML = mainTabs.map(([key, label]) =>
            `<button type="button" data-tab="${key}" onclick="switchClientMyPageSubtab('${key}')" class="gnb-tab ${clientMyPageActiveSubtab === key ? 'active' : ''}">${label}</button>`
        ).join('');
    }
    document.getElementById('client-mypage-subtab-history-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'history');
    document.getElementById('client-mypage-subtab-posts-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'posts');
    document.getElementById('client-mypage-subtab-favorites-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'favorites');
    document.getElementById('client-mypage-subtab-notifications-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'notifications');
    document.getElementById('client-mypage-subtab-account-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'account');
    if (clientMyPageActiveSubtab === 'posts') { renderClientMyPagePosts(); renderClientMyPageSavedPosts(); }
    if (clientMyPageActiveSubtab === 'favorites') { renderClientFavoritePartners(); if (typeof renderClientSavedPortfolios === 'function') renderClientSavedPortfolios(); renderClientRegularOfPartners(); }
    if (clientMyPageActiveSubtab === 'notifications') renderClientMyPageNotifications(myNotifications);
    if (clientMyPageActiveSubtab === 'account') renderClientAccountSettings();

    const allMyOrders = window.AppState.orders.filter(o => o.clientPhone === auth.phone);

    const tabsEl = document.getElementById('client-mypage-history-tabs');
    if (tabsEl) {
        const tabs = [
            ['all', '전체', allMyOrders.length],
            ['auto', '자동매칭', allMyOrders.filter(o => !o.is1on1).length],
            ['1on1', '1:1 지정 매칭', allMyOrders.filter(o => o.is1on1).length]
        ];
        tabsEl.innerHTML = tabs.map(([key, label, count]) =>
            `<button type="button" onclick="setClientMyPageHistoryFilter('${key}')" class="gnb-tab ${clientMyPageHistoryFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    const myOrdersByType = clientMyPageHistoryFilter === 'all' ? allMyOrders
        : clientMyPageHistoryFilter === '1on1' ? allMyOrders.filter(o => o.is1on1)
        : allMyOrders.filter(o => !o.is1on1);
    const myOrders = clientMyPageHistoryStatusFilter === 'all' ? myOrdersByType
        : myOrdersByType.filter(o => o.status === clientMyPageHistoryStatusFilter);

    if (myOrders.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state !py-16">
                <span class="icon-wrap"><i data-lucide="clipboard-x" class="w-5 h-5"></i></span>
                <h5 class="text-xs font-bold text-ink-700">신청 완료된 견적이 없습니다</h5>
                <p class="text-[10px] text-ink-500 font-medium leading-relaxed mt-1">간편 견적 신청 탭에서 본인인증 후<br>첫 인테리어 의뢰서를 발행해 주세요.</p>
            </div>`;
        detailEmpty?.classList.remove('hidden');
        detailBoard?.classList.add('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    listContainer.innerHTML = '';
    myOrders.forEach((order) => {
        const isSelected = order.code === window.AppState.selectedMyPageOrderCode;
        const div = document.createElement('div');
        div.className = isSelected
            ? "p-4 rounded-2xl border-2 border-ink-950 bg-ink-50 transition-all cursor-pointer space-y-2 text-left"
            : "p-4 rounded-2xl border border-ink-100 bg-white hover:border-ink-300 transition-all cursor-pointer space-y-2 text-left";
        div.style.boxShadow = 'var(--shadow-1)';
        div.onclick = () => selectMyPageEstimate(order.code);

        let statusBadge = '';
        if (order.status === 'withdrawn') statusBadge = `<span class="badge badge-neutral"><span class="badge-dot bg-ink-300"></span> 철회됨</span>`;
        else if (order.status === 'cancel_requested') statusBadge = `<span class="badge badge-amber"><span class="badge-dot bg-amberCustom"></span> 계약 취소 심사중</span>`;
        else if (order.status === 'cancelled') statusBadge = `<span class="badge badge-rose"><span class="badge-dot bg-roseCustom"></span> 계약 취소됨</span>`;
        else if (order.is1on1) statusBadge = `<span class="badge badge-neutral"><span class="badge-dot bg-ink-950"></span> 1:1 지정 [${order.targetPartner}]</span>`;
        else if (order.status === 'bidding') {
            statusBadge = order.isHighBudgetAdminPending
                ? `<span class="badge badge-gold"><span class="badge-dot bg-gold-500"></span> 7천만+ 본사 배정 대기</span>`
                : `<span class="badge badge-amber"><span class="badge-dot bg-amberCustom"></span> 입찰 심사 중 (${order.bids.length}개사)</span>`;
        } else if (order.status === 'contracted') {
            statusBadge = (order.contractUploaded && order.clientSigned)
                ? `<span class="badge badge-emerald"><span class="badge-dot bg-emeraldCustom"></span> 안심 보증 활성 완료</span>`
                : `<span class="badge badge-amber"><span class="badge-dot bg-amberCustom"></span> 안심 서류 대기중</span>`;
        }

        const displayAddressTitle = order.is1on1 ? `1:1 지정 상담 (${order.targetPartner})` : `${order.clientAddress.split(' ').slice(0, 3).join(' ')} (${order.pyung}평형)`;
        const unreadCount = typeof getUnreadOrderMessageCount === 'function' ? getUnreadOrderMessageCount(order, 'client') : 0;

        div.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold">
                <span class="${isSelected ? 'text-ink-950 font-black' : 'text-ink-500'} font-mono">${order.code}</span>
                <div class="flex items-center gap-1.5">
                    ${unreadCount > 0 ? `<span class="badge badge-rose"><i data-lucide="message-circle" class="w-2.5 h-2.5"></i> ${unreadCount}</span>` : ''}
                    ${statusBadge}
                </div>
            </div>
            <h5 class="text-xs font-black ${isSelected ? 'text-ink-950' : 'text-ink-800'}">${displayAddressTitle}</h5>
            <div class="flex justify-between items-center text-[9px] font-extrabold text-ink-500">
                <span>희망 착공일: ${order.preferredDate}</span>
                <span class="text-ink-950 font-black">₩ ${(order.budget).toLocaleString()}만</span>
            </div>`;
        listContainer.appendChild(div);
    });

    if (!window.AppState.selectedMyPageOrderCode && myOrders.length > 0) {
        selectMyPageEstimate(myOrders[0].code);
    } else if (window.AppState.selectedMyPageOrderCode) {
        const currentSelectedOrder = myOrders.find(o => o.code === window.AppState.selectedMyPageOrderCode);
        if (currentSelectedOrder) renderMyPageEstimateDetails(currentSelectedOrder);
        else if (myOrders.length > 0) selectMyPageEstimate(myOrders[0].code);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 마이페이지 > 내가 쓴 커뮤니티 글. 카드를 클릭하면 해당 게시글 상세로 바로 이동한다. */
function renderClientMyPagePosts() {
    const container = document.getElementById('client-mypage-my-posts-container');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;

    const myPosts = (window.AppState.communityPosts || []).filter(p => p.authorId === auth.id);
    if (myPosts.length === 0) {
        container.innerHTML = buildEmptyStateHtml('message-circle', '아직 작성한 커뮤니티 글이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = myPosts.map(p => `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl cursor-pointer hover:bg-ink-100 transition-colors" onclick="jumpToMyCommunityPost('${p.id}')">
            <div class="space-y-0.5 min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="badge badge-brand">${COMMUNITY_CATEGORIES[p.category] || '자유 이야기'}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${p.date}</span>
                </div>
                <h5 class="text-xs font-black text-ink-950 truncate">${escapeHtml(p.title)}</h5>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-ink-400 font-bold shrink-0 ml-2">
                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${(p.likedBy || []).length}</span>
                <span class="flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3"></i> ${(p.comments || []).length}</span>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function jumpToMyCommunityPost(postId) {
    switchPanel('community-panel');
    openCommunityDetail(postId);
}

/* 커뮤니티 글을 좋아요·댓글·신고는 할 수 있지만, 지금 당장 답할 시간이 없어 나중에
 * 다시 보고 싶은 글을 저장해둘 방법이 없었다 — "내가 쓴 글"은 본인 작성 글만 보여줘서
 * 대체할 수 없다. 관심 파트너(favoritePartners)와 동일한 clientAccounts 저장 패턴을
 * 적용한다. */
const MAX_SAVED_POSTS = 30;

function isCommunityPostSaved(postId) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    return !!(account && account.savedPosts && account.savedPosts.includes(postId));
}

function toggleSaveCommunityPost(postId) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if (!account.savedPosts) account.savedPosts = [];
    const idx = account.savedPosts.indexOf(postId);
    if (idx >= 0) { account.savedPosts.splice(idx, 1); showToast('저장한 글에서 제거했습니다.', 'info'); }
    else {
        if (account.savedPosts.length >= MAX_SAVED_POSTS) { showToast(`저장한 글은 최대 ${MAX_SAVED_POSTS}건까지 보관할 수 있어요. 기존 항목을 해제한 후 다시 시도해주세요.`, 'warning'); return; }
        account.savedPosts.push(postId); showToast('글을 저장했습니다!', 'success');
    }
    openCommunityDetail(postId);
    if (typeof renderClientMyPageSavedPosts === 'function') renderClientMyPageSavedPosts();
}

function renderClientMyPageSavedPosts() {
    const container = document.getElementById('client-mypage-saved-posts-container');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const savedIds = (account && account.savedPosts) || [];
    const savedPosts = savedIds.map(id => (window.AppState.communityPosts || []).find(p => p.id === id)).filter(Boolean);

    if (savedPosts.length === 0) {
        container.innerHTML = buildEmptyStateHtml('bookmark', '아직 저장한 커뮤니티 글이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = savedPosts.map(p => `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl cursor-pointer hover:bg-ink-100 transition-colors" onclick="jumpToMyCommunityPost('${p.id}')">
            <div class="space-y-0.5 min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="badge badge-brand">${COMMUNITY_CATEGORIES[p.category] || '자유 이야기'}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${escapeHtml(p.authorName)} · ${p.date}</span>
                </div>
                <h5 class="text-xs font-black text-ink-950 truncate">${escapeHtml(p.title)}</h5>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-ink-400 font-bold shrink-0 ml-2">
                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${(p.likedBy || []).length}</span>
                <span class="flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3"></i> ${(p.comments || []).length}</span>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 관심 파트너(찜) — 지금까지는 파트너 탐색 화면을 매번 다시 훑거나 1:1 지정 상담을
 * 넣어야만 파트너를 "저장"할 수 있었다(1:1은 오더가 생성되는 무거운 행동). 가벼운
 * 찜하기는 로그인한 고객 계정(clientAccounts[].favoritePartners)에 저장한다. */
function isFavoritePartner(partnerName) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    return !!(account && account.favoritePartners && account.favoritePartners.includes(partnerName));
}

const MAX_FAVORITE_PARTNERS = 20;

function toggleFavoritePartner(partnerName) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if (!account.favoritePartners) account.favoritePartners = [];
    const idx = account.favoritePartners.indexOf(partnerName);
    if (idx >= 0) { account.favoritePartners.splice(idx, 1); showToast(`[${partnerName}] 관심 파트너에서 제거했습니다.`, 'info'); }
    else {
        // 관심 파트너 저장에 개수 제한이 전혀 없어서, 이론상 등록된 모든 파트너를
        // 다 찜해둘 수 있었다 — '관심'이라는 기능 취지에 맞게 상한을 둔다.
        if (account.favoritePartners.length >= MAX_FAVORITE_PARTNERS) { showToast(`관심 파트너는 최대 ${MAX_FAVORITE_PARTNERS}곳까지 저장할 수 있어요. 기존 항목을 해제한 후 다시 시도해주세요.`, 'warning'); return; }
        account.favoritePartners.push(partnerName); showToast(`[${partnerName}] 관심 파트너로 저장했습니다!`, 'success');
        // 반대 방향(파트너 신규 시공사례 등록 시 찜한 고객에게 알림, e671344)은 있는데
        // 정작 고객이 파트너를 찜했다는 사실은 파트너에게 전혀 전달되지 않았다 —
        // 찜 해제는 굳이 알릴 필요가 없어 등록 시에만 보낸다.
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `${maskName(auth.name)}님이 관심 파트너로 등록했어요.`);
    }

    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
    if (typeof renderClientFavoritePartners === 'function') renderClientFavoritePartners();
    const profileBtn = document.getElementById('client-partner-profile-favorite-btn');
    if (profileBtn) syncFavoriteButtonIcon(profileBtn, partnerName);
}

function syncFavoriteButtonIcon(btn, partnerName) {
    const icon = btn.querySelector('[data-lucide]');
    const favorited = isFavoritePartner(partnerName);
    if (icon) { icon.classList.toggle('text-roseCustom', favorited); icon.classList.toggle('text-ink-300', !favorited); if (favorited) icon.setAttribute('fill', 'currentColor'); else icon.removeAttribute('fill'); }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 커뮤니티엔 사용자 차단(toggleBlockCommunityUser, account.blockedUsers)이 있는데
 * 파트너 쪽엔 대칭 기능이 없었다 — excludedPartners는 오더 단위 임시 제외일 뿐,
 * "이 파트너는 다시는 매칭받고 싶지 않다"는 지속적인 고객 선호를 저장할 방법이
 * 없었다(블랙리스트에 오르지 않은 파트너라도 특정 고객과는 안 맞을 수 있다).
 * 차단하면 이후 모든 자동/재매칭 후보군과 관심 파트너 목록에서 제외된다. */
function isPartnerBlockedByClient(partnerName) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    return !!(account && account.blockedPartners && account.blockedPartners.includes(partnerName));
}

function togglePartnerBlock(partnerName) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if (!account.blockedPartners) account.blockedPartners = [];
    const idx = account.blockedPartners.indexOf(partnerName);
    if (idx >= 0) { account.blockedPartners.splice(idx, 1); showToast(`[${partnerName}] 차단을 해제했습니다.`, 'info'); }
    else {
        account.blockedPartners.push(partnerName);
        // 관심 파트너와 차단은 동시에 의미가 없으므로, 차단하면 관심 목록에서도 뺀다.
        if (account.favoritePartners) {
            const favIdx = account.favoritePartners.indexOf(partnerName);
            if (favIdx >= 0) account.favoritePartners.splice(favIdx, 1);
        }
        if (typeof pushLog === 'function') pushLog('CLIENT', 'PARTNER_BLOCK', `'${auth.name}' 고객님이 '${partnerName}' 파트너를 차단했습니다.`, 'INFO');
        showToast(`[${partnerName}]를 차단했습니다. 앞으로 이 파트너와는 매칭되지 않아요.`, 'success');
    }

    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
    if (typeof renderClientFavoritePartners === 'function') renderClientFavoritePartners();
    if (typeof renderBlockedPartnersList === 'function') renderBlockedPartnersList();
    const profileBtn = document.getElementById('client-partner-profile-favorite-btn');
    if (profileBtn) syncFavoriteButtonIcon(profileBtn, partnerName);
    const blockBtn = document.getElementById('client-partner-profile-block-btn');
    if (blockBtn) {
        const blocked = isPartnerBlockedByClient(partnerName);
        const blockIcon = blockBtn.querySelector('[data-lucide]');
        if (blockIcon) { blockIcon.classList.toggle('text-roseCustom', blocked); blockIcon.classList.toggle('text-ink-300', !blocked); }
        blockBtn.title = blocked ? '차단 해제' : '파트너 차단';
    }
}

function renderBlockedPartnersList() {
    const container = document.getElementById('blocked-partners-list');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const blockedNames = (account && account.blockedPartners) || [];

    if (blockedNames.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-bold text-center py-3">차단한 파트너가 없습니다.</p>`;
        return;
    }
    container.innerHTML = blockedNames.map(name => `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <span class="text-xs font-bold text-ink-800">${escapeHtml(name)}</span>
            <button type="button" onclick="togglePartnerBlock('${escapeHtml(name)}')" class="text-[11px] font-bold text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0">차단 해제</button>
        </div>`).join('');
}

function renderClientFavoritePartners() {
    const container = document.getElementById('client-mypage-favorites-container');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const favoriteNames = (account && account.favoritePartners) || [];
    const favoritePartners = favoriteNames.map(name => window.AppState.partners.find(p => p.name === name)).filter(Boolean);

    if (favoritePartners.length === 0) {
        container.innerHTML = buildEmptyStateHtml('heart', '아직 관심 파트너로 저장한 업체가 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // 즐겨찾기한 파트너가 나중에 삼진아웃으로 영구 제명되거나 일시중단되어도 지금까지는
    // 아무 표시 없이 그대로 노출됐다 — '안심' 중개 플랫폼인데 고객이 이미 제명된 업체를
    // 계속 찜해두고 있다는 사실조차 모를 수 있어서, 입찰 목록의 isBannedBid 배지와
    // 동일한 패턴으로 상태를 표시한다.
    container.innerHTML = favoritePartners.map(p => {
        const isBanned = p.status === 'banned';
        const isPaused = !!p.isPaused;
        const statusBadge = isBanned ? `<span class="badge badge-rose">영구 제명</span>` : isPaused ? `<span class="badge badge-amber">일시중단</span>` : '';
        return `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl gap-3">
            <div class="min-w-0 flex-1 cursor-pointer" onclick="window.openClientPartnerProfile('${p.name}')">
                <div class="flex items-center gap-2">
                    <h5 class="text-xs font-black text-ink-950 truncate">${escapeHtml(p.name)}</h5>
                    <span class="text-gold-500 font-extrabold text-[11px]">★ ${p.rating.toFixed(1)}</span>
                    ${statusBadge}
                </div>
                <p class="text-[10px] text-ink-400 font-bold">${p.region ? `부산 ${escapeHtml(p.region)} · ` : ''}완공사례 ${p.portfolios ? p.portfolios.length : 0}건</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                ${!isBanned ? `<button type="button" onclick="requestDirectQuoteFromPortfolio('${p.name}')" class="btn btn-secondary btn-sm">재의뢰하기</button>` : ''}
                <button type="button" onclick="toggleFavoritePartner('${p.name}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">찜 해제</button>
            </div>
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 파트너는 계약한 고객을 "단골"로 저장할 수 있고 저장 시 고객에게 알림도 가지만
 * (toggleFavoriteClient, partner_panel.js), 정작 고객 쪽에는 그 사실을 나중에 다시
 * 확인할 방법이 전혀 없었다 — 알림은 한 번 스쳐가면 끝. 읽기 전용으로, 나를 단골로
 * 등록해둔 파트너 목록을 관심 파트너 탭에 함께 보여준다. */
function renderClientRegularOfPartners() {
    const container = document.getElementById('client-mypage-regular-of-container');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const myPhone = account ? account.phone : auth.phone;
    const partners = (window.AppState.partners || []).filter(p => (p.favoriteClients || []).some(c => c.phone === myPhone));

    if (partners.length === 0) {
        container.innerHTML = buildEmptyStateHtml('star', '아직 나를 단골로 등록한 파트너가 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    container.innerHTML = partners.map(p => `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl gap-3">
            <div class="min-w-0 flex-1 cursor-pointer" onclick="window.openClientPartnerProfile('${p.name}')">
                <div class="flex items-center gap-2">
                    <h5 class="text-xs font-black text-ink-950 truncate">${escapeHtml(p.name)}</h5>
                    <span class="text-gold-500 font-extrabold text-[11px]">★ ${p.rating.toFixed(1)}</span>
                </div>
                <p class="text-[10px] text-ink-400 font-bold">${p.region ? `부산 ${escapeHtml(p.region)}` : ''}</p>
            </div>
            <span class="badge badge-amber shrink-0"><i data-lucide="star" class="w-2.5 h-2.5"></i> 단골 등록</span>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 마이페이지 > 알림 탭 — 매칭 완료/파트너 배정/계약 체결 시 pushClientNotification()으로 쌓인
 * 개인 알림을 그대로 나열한다. 토스트와 달리 재방문해도 남아있어 놓친 소식을 확인할 수 있다. */
function renderClientMyPageNotifications(myNotifications) {
    const container = document.getElementById('client-mypage-notifications-container');
    if (!container) return;

    if (!myNotifications || myNotifications.length === 0) {
        container.innerHTML = buildEmptyStateHtml('bell', '아직 도착한 알림이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    /* 견적신청 안내 단계(qstep-1)의 세로 연결선 + 원형 마커와 같은 문법을 재사용해서
     * "시간이 흐른다"는 느낌을 주는 타임라인으로 구성한다. */
    container.innerHTML = `<div class="notif-timeline">` + myNotifications.map((n, idx) => {
        const d = new Date(n.date);
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const isLast = idx === myNotifications.length - 1;
        return `
        <div class="notif-tl-item">
            <div class="notif-tl-marker">
                <span class="notif-tl-dot ${n.read ? 'read' : ''}"><i data-lucide="bell" class="w-3 h-3"></i></span>
                ${isLast ? '' : '<span class="notif-tl-line"></span>'}
            </div>
            <div class="notif-tl-body ${isLast ? '' : 'has-line'}">
                <div class="flex justify-between items-start gap-2">
                    <p class="text-xs font-bold text-ink-800 leading-relaxed ${n.read ? '' : 'cursor-pointer'}" ${n.read ? '' : `onclick="markClientNotificationRead('${n.id}')"`}>${escapeHtml(n.message)}</p>
                    <button type="button" onclick="deleteClientNotification('${n.id}')" class="text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0" aria-label="알림 삭제"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                </div>
                <p class="text-[10px] text-ink-400 font-bold mt-0.5">${dateLabel}${n.read ? '' : ' · <span class="text-brand-600">탭하여 읽음 처리</span>'}</p>
                ${n.dmThreadId ? `<div class="flex gap-1.5 mt-1.5"><input type="text" id="dm-reply-input-${n.id}" placeholder="매니저에게 답장하기" class="input flex-1 text-xs"><button type="button" onclick="replyToManagerDirectMessage('${n.id}')" class="btn btn-dark btn-sm shrink-0">답장</button></div>` : ''}
                ${n.invitingPartner ? `<button type="button" onclick="requestDirectQuoteFromPortfolio('${escapeHtml(n.invitingPartner)}')" class="btn btn-dark btn-sm mt-1.5">견적 요청 보내기</button>` : ''}
            </div>
        </div>`;
    }).join('') + `</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 관리자 1:1 쪽지(submitAdminDirectMessage, partner_panel.js)는 알림만 보낼 뿐
 * 답장 방법이 없었다 — 문의성 쪽지를 받아도 새로 고객센터 문의를 넣는 것 말고는
 * 대응할 방법이 없던 공백. 알림에 매달린 dmThreadId로 같은 스레드에 답장을
 * 이어붙인다. */
function replyToManagerDirectMessage(notifId) {
    const auth = window.AppState.clientAuth;
    const notif = (window.AppState.clientNotifications || []).find(n => n.id === notifId);
    if (!notif || !notif.dmThreadId) return;
    const input = document.getElementById(`dm-reply-input-${notifId}`);
    const text = input?.value.trim();
    if (!text) { showToast('답장 내용을 입력해주세요.', 'warning'); return; }

    const thread = (window.AppState.directMessageThreads || []).find(t => t.id === notif.dmThreadId);
    if (!thread) return;
    thread.messages.push({ from: 'recipient', text, date: getLocalDateString() });
    thread.hasUnreadReply = true;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'DM_REPLY', `[${auth.name}] 고객님이 매니저 쪽지에 답장했습니다: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`, 'INFO');
    showToast('답장을 보냈습니다.', 'success');
    renderClientMyPage();
}

/* 지금까지는 알림 전체를 한 번에 읽음 처리하는 방법만 있어서, 여러 알림 중
 * 특정 하나만 확인했는지 구분할 수 없었다 — 항목별로 개별 읽음 처리를 추가한다. */
function markClientNotificationRead(notifId) {
    const notif = (window.AppState.clientNotifications || []).find(n => n.id === notifId);
    if (!notif || notif.read) return;
    notif.read = true;
    renderClientMyPage();
}

function markAllClientNotificationsRead() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    (window.AppState.clientNotifications || []).forEach(n => { if (n.clientPhone === auth.phone) n.read = true; });
    renderClientMyPage();
}

/* 읽음 처리(markClientNotificationRead)는 있었지만 삭제는 불가능해서, 알림이
 * 계속 쌓이기만 했다 — 개별 삭제와 전체 삭제 둘 다 추가한다. */
function deleteClientNotification(notifId) {
    const idx = (window.AppState.clientNotifications || []).findIndex(n => n.id === notifId);
    if (idx === -1) return;
    window.AppState.clientNotifications.splice(idx, 1);
    renderClientMyPage();
}

function clearAllClientNotifications() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    window.AppState.clientNotifications = (window.AppState.clientNotifications || []).filter(n => n.clientPhone !== auth.phone);
    showToast('알림을 모두 삭제했습니다.', 'info');
    renderClientMyPage();
}

/* 마이페이지 > 계정 정보 탭 — 회원가입 후에는 이름/전화번호/비밀번호를 바꿀 방법이
 * 전혀 없던 기능 공백을 메운다. 이미 생성된 과거 오더의 clientName/clientPhone
 * 스냅샷까지 거슬러 바꾸지는 않는다(주문 시점의 정보를 그대로 유지하는 게 맞다). */
function renderClientAccountSettings() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    safeUpdateValue('account-edit-name', auth.name);
    safeUpdateValue('account-edit-phone', auth.phone);
    safeUpdateValue('account-edit-current-pw', '');
    safeUpdateValue('account-edit-new-pw', '');
    safeUpdateValue('account-edit-new-pw2', '');
    renderBlockedUsersList();
    renderBlockedPartnersList();
    renderClientNotificationPrefToggle();
    renderClientReportedStatus();
    renderClientReviewDeletionStatus();
    renderClientCommunityDeletionStatus();
    renderClientBenefitsStatus();
    renderClientRatingStatus();
    renderClientStrikeAppealStatus();
}

/* 홈 화면 이벤트 배너가 광고하는 견적신청/후기작성/계약 혜택(grantClientBenefit,
 * utils_ui.js)을 고객이 마이페이지에서 직접 확인하고 수령 신청할 수 있게 한다. */
function renderClientBenefitsStatus() {
    const container = document.getElementById('client-benefits-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const benefits = (account && account.benefits) || [];

    if (benefits.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">아직 적립된 혜택이 없습니다.</p>`;
        return;
    }
    container.innerHTML = benefits.map(b => `
        <div class="p-2.5 bg-amber-50 rounded-xl flex items-center justify-between gap-2">
            <div class="min-w-0">
                <p class="text-[11px] font-black text-ink-900">${escapeHtml(b.label)}</p>
                <p class="text-[10px] text-ink-500 font-semibold">${escapeHtml(b.amount)} · 적립일 ${b.earnedDate}${b.claimedDate ? ` · 수령일 ${b.claimedDate}` : ''}</p>
            </div>
            ${b.status === 'claimed'
                ? `<span class="badge badge-emerald shrink-0">수령완료</span>`
                : `<button type="button" onclick="claimClientBenefit('${b.id}')" class="btn btn-dark btn-sm shrink-0">수령 신청</button>`}
        </div>`).join('');
}

function claimClientBenefit(benefitId) {
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const benefit = account && account.benefits && account.benefits.find(b => b.id === benefitId);
    if (!benefit || benefit.status === 'claimed') return;

    benefit.status = 'claimed';
    benefit.claimedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('CLIENT', 'BENEFIT_CLAIM', `[${auth.name}] 고객님이 혜택 "${benefit.label}" 수령을 신청했습니다.`, 'INFO');
    showToast(`"${benefit.label}" 수령 신청이 접수되었습니다.`, 'success');
    renderClientBenefitsStatus();
}

/* 후기가 삭제되면 신고자에게는 알림이 가지만(notifyReportResolved, partner_panel.js)
 * 정작 작성자 본인은 삭제 사실조차 알 방법이 없었고 소명할 방법도 없었다 —
 * 계약 강제 취소 이의신청과 동일한 비대칭이다. 삭제 시 남긴 스냅샷 로그
 * (window.AppState.reviewDeletionLog)에서 본인 소유 건만 골라 보여준다. */
let reviewDeletionAppealTarget = null;

function openReviewDeletionAppealModal(logId) {
    const auth = window.AppState.clientAuth;
    const entry = (window.AppState.reviewDeletionLog || []).find(e => e.id === logId && e.clientPhone === auth.phone);
    if (!entry) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    reviewDeletionAppealTarget = logId;
    safeUpdateValue('review-deletion-appeal-reason-input', '');
    openModal('review-deletion-appeal-modal', 'review-deletion-appeal-modal-card');
}

function closeReviewDeletionAppealModal() {
    reviewDeletionAppealTarget = null;
    closeModal('review-deletion-appeal-modal', 'review-deletion-appeal-modal-card');
}

function submitReviewDeletionAppeal() {
    const entry = (window.AppState.reviewDeletionLog || []).find(e => e.id === reviewDeletionAppealTarget);
    if (!entry) { closeReviewDeletionAppealModal(); return; }
    const reason = document.getElementById('review-deletion-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    const auth = window.AppState.clientAuth;
    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW_DELETION_APPEAL', `[${auth.name}] 고객님이 삭제된 [${entry.partnerName}] 후기에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeReviewDeletionAppealModal();
    renderClientReviewDeletionStatus();
}

function renderClientReviewDeletionStatus() {
    const container = document.getElementById('client-review-deletion-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const myEntries = (window.AppState.reviewDeletionLog || []).filter(e => e.clientPhone === auth.phone);

    if (myEntries.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">삭제된 후기가 없습니다.</p>`;
        return;
    }
    container.innerHTML = myEntries.map(e => {
        let statusHtml;
        if (e.appeal && e.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (e.appeal && e.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${e.appeal.adminResponse ? ` — ${escapeHtml(e.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openReviewDeletionAppealModal('${e.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">[${escapeHtml(e.partnerName)}]에 남긴 후기가 삭제되었습니다: "${escapeHtml(e.reviewSnapshot.text)}" (${e.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

let communityDeletionAppealTarget = null;

function openCommunityDeletionAppealModal(logId) {
    const auth = window.AppState.clientAuth;
    const entry = (window.AppState.communityDeletionLog || []).find(e => e.id === logId && e.authorId === auth.id);
    if (!entry) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    communityDeletionAppealTarget = logId;
    safeUpdateValue('community-deletion-appeal-reason-input', '');
    openModal('community-deletion-appeal-modal', 'community-deletion-appeal-modal-card');
}

function closeCommunityDeletionAppealModal() {
    communityDeletionAppealTarget = null;
    closeModal('community-deletion-appeal-modal', 'community-deletion-appeal-modal-card');
}

function submitCommunityDeletionAppeal() {
    const entry = (window.AppState.communityDeletionLog || []).find(e => e.id === communityDeletionAppealTarget);
    if (!entry) { closeCommunityDeletionAppealModal(); return; }
    const reason = document.getElementById('community-deletion-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    const auth = window.AppState.clientAuth;
    if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_DELETION_APPEAL', `[${auth.name}] 고객님이 삭제된 ${entry.typeLabelKo} "${entry.contentPreview}"에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeCommunityDeletionAppealModal();
    renderClientCommunityDeletionStatus();
}

function renderClientCommunityDeletionStatus() {
    const container = document.getElementById('client-community-deletion-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const myEntries = (window.AppState.communityDeletionLog || []).filter(e => e.authorId === auth.id);

    if (myEntries.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">삭제된 게시글/댓글이 없습니다.</p>`;
        return;
    }
    container.innerHTML = myEntries.map(e => {
        let statusHtml;
        if (e.appeal && e.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (e.appeal && e.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${e.appeal.adminResponse ? ` — ${escapeHtml(e.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openCommunityDeletionAppealModal('${e.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">작성하신 ${e.typeLabelKo}이 삭제되었습니다: "${escapeHtml(e.contentPreview)}" (${e.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

/* 파트너는 노쇼·상습 갑질 고객을 신고할 수 있지만(submitClientReport, partner_panel.js)
 * 고객은 자신이 신고당한 사실조차 알 방법이 없고 소명할 방법도 없었다 — 파트너의
 * 옐로카드 이의신청(strikeAppeal)과 동일한 제출→심사 패턴을 반대 방향에도 적용한다. */
let clientReportAppealTargetId = null;

function openClientReportAppealModal(reportId) {
    const auth = window.AppState.clientAuth;
    const report = (window.AppState.clientReports || []).find(r => r.id === reportId && r.clientPhone === auth.phone);
    if (!report) return;
    if (report.appeal && report.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    clientReportAppealTargetId = reportId;
    safeUpdateValue('client-report-appeal-reason-input', '');
    openModal('client-report-appeal-modal', 'client-report-appeal-modal-card');
}

function closeClientReportAppealModal() {
    clientReportAppealTargetId = null;
    closeModal('client-report-appeal-modal', 'client-report-appeal-modal-card');
}

function submitClientReportAppeal() {
    const auth = window.AppState.clientAuth;
    const report = (window.AppState.clientReports || []).find(r => r.id === clientReportAppealTargetId && r.clientPhone === auth.phone);
    if (!report) { closeClientReportAppealModal(); return; }
    const reason = document.getElementById('client-report-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    report.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CLIENT_REPORT_APPEAL', `[${report.clientName}] 고객님이 파트너 신고(${report.orderCode})에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeClientReportAppealModal();
    renderClientReportedStatus();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
}

function renderClientReportedStatus() {
    const container = document.getElementById('client-reported-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const myReports = (window.AppState.clientReports || []).filter(r => r.clientPhone === auth.phone);

    if (myReports.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">접수된 신고가 없습니다.</p>`;
        return;
    }
    container.innerHTML = myReports.map(r => {
        let statusHtml;
        if (r.appeal && r.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (r.appeal && r.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${r.appeal.adminResponse ? ` — ${escapeHtml(r.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openClientReportAppealModal('${r.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">계약 파트너사가 오더(${r.orderCode})와 관련해 신고를 접수했습니다. (${r.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

/* 파트너의 고객 평가(submitClientRating, partner_panel.js)는 다른 파트너·관리자에게는
 * 노출되지만 정작 평가 대상인 고객 본인은 남았는지조차 알 방법이 없었고, 다른 모든
 * 제재/신고 기능(계정 정지, 파트너 신고)과 달리 소명할 방법도 없었다 — 동일한
 * 제출→심사 패턴을 적용한다. */
let clientRatingAppealTargetOrderCode = null;

function openClientRatingAppealModal(orderCode) {
    const auth = window.AppState.clientAuth;
    const rating = (window.AppState.clientRatings || []).find(r => r.orderCode === orderCode && r.clientPhone === auth.phone);
    if (!rating) return;
    if (rating.appeal && rating.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    clientRatingAppealTargetOrderCode = orderCode;
    safeUpdateValue('client-rating-appeal-reason-input', '');
    openModal('client-rating-appeal-modal', 'client-rating-appeal-modal-card');
}

function closeClientRatingAppealModal() {
    clientRatingAppealTargetOrderCode = null;
    closeModal('client-rating-appeal-modal', 'client-rating-appeal-modal-card');
}

function submitClientRatingAppeal() {
    const auth = window.AppState.clientAuth;
    const rating = (window.AppState.clientRatings || []).find(r => r.orderCode === clientRatingAppealTargetOrderCode && r.clientPhone === auth.phone);
    if (!rating) { closeClientRatingAppealModal(); return; }
    const reason = document.getElementById('client-rating-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    rating.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CLIENT_RATING_APPEAL', `[${rating.clientName}] 고객님이 [${rating.partnerName}]의 평가(${rating.orderCode})에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeClientRatingAppealModal();
    renderClientRatingStatus();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
}

function renderClientRatingStatus() {
    const container = document.getElementById('client-rating-status');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const myRatings = (window.AppState.clientRatings || []).filter(r => r.clientPhone === auth.phone);

    if (myRatings.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">등록된 파트너 평가가 없습니다.</p>`;
        return;
    }
    container.innerHTML = myRatings.map(r => {
        let statusHtml;
        if (r.appeal && r.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (r.appeal && r.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${r.appeal.adminResponse ? ` — ${escapeHtml(r.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openClientRatingAppealModal('${r.orderCode}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-ink-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">[${escapeHtml(r.partnerName)}]가 오더(${r.orderCode})에 대해 평가를 남겼습니다. <span class="text-gold-500 font-black">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> (${r.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

/* 지금까지 알림을 끌 방법이 전혀 없어서, 원치 않는 사람도 매칭·계약·후기 등
 * 모든 알림을 계속 받아야 했다 — 계정별 on/off 하나로 pushClientNotification
 * 자체에서 걸러낸다(카테고리별 세분화는 지금은 과한 범위라 전체 on/off로 시작). */
function renderClientNotificationPrefToggle() {
    const btn = document.getElementById('client-notif-pref-toggle');
    if (!btn) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const enabled = !account || account.notificationsEnabled !== false;
    btn.textContent = enabled ? '켜짐' : '꺼짐';
    btn.classList.toggle('btn-dark', enabled);
    btn.classList.toggle('btn-secondary', !enabled);
}

function toggleClientNotificationPref() {
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    const currentlyEnabled = account.notificationsEnabled !== false;
    account.notificationsEnabled = !currentlyEnabled;
    showToast(account.notificationsEnabled ? '알림을 다시 받아요.' : '알림 수신을 꺼두었어요.', account.notificationsEnabled ? 'success' : 'info');
    renderClientNotificationPrefToggle();
}

/* 게시글 화면에서 차단해도 그 뒤로는 누굴 차단했는지 확인/해제할 방법이 없었다 —
 * 관심 파트너 목록과 동일하게 계정 설정에서 차단 목록을 관리할 수 있게 한다. */
function renderBlockedUsersList() {
    const container = document.getElementById('blocked-users-list');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const blockedIds = (account && account.blockedUsers) || [];

    if (blockedIds.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-bold text-center py-3">차단한 사용자가 없습니다.</p>`;
        return;
    }
    container.innerHTML = blockedIds.map(id => {
        const blockedAccount = window.AppState.clientAccounts.find(acc => acc.id === id);
        const post = (window.AppState.communityPosts || []).find(p => p.authorId === id);
        const displayName = (blockedAccount && blockedAccount.name) || (post && post.authorName) || id;
        return `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <span class="text-xs font-bold text-ink-800">${escapeHtml(displayName)}</span>
            <button type="button" onclick="toggleBlockCommunityUser('${escapeHtml(id)}', '${escapeHtml(displayName)}')" class="text-[11px] font-bold text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0">차단 해제</button>
        </div>`;
    }).join('');
}

function updateClientProfileInfo() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const nameVal = document.getElementById('account-edit-name')?.value.trim();
    const phoneVal = document.getElementById('account-edit-phone')?.value.trim();
    if (!nameVal || !phoneVal) { showToast('이름과 휴대폰 연락처를 모두 입력해 주세요.', 'warning'); return; }
    if (/['"`<>\\]/.test(nameVal)) { showToast('이름에는 따옴표, 백틱, 꺾쇠, 백슬래시를 사용할 수 없습니다.', 'warning'); return; }
    if (!/^0\d{1,2}-\d{3,4}-\d{4}$/.test(phoneVal)) { showToast('휴대폰 연락처를 올바른 형식으로 입력해 주세요. (예: 010-0000-0000)', 'warning'); return; }
    if (window.AppState.clientAccounts.some(acc => acc.id !== auth.id && acc.phone === phoneVal)) { showToast('이미 다른 계정에서 사용 중인 휴대폰 번호입니다.', 'warning'); return; }

    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (account) { account.name = nameVal; account.phone = phoneVal; }
    auth.name = nameVal; auth.phone = phoneVal;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PROFILE_UPDATE', `'${auth.id}' 고객님이 회원 정보를 수정했습니다.`, 'INFO');
    showToast('회원 정보가 저장되었습니다.', 'success');
    toggleClientAuthUI();
    renderClientMyPage();
}

function updateClientPassword() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;

    const currentPw = document.getElementById('account-edit-current-pw')?.value || '';
    const newPw = document.getElementById('account-edit-new-pw')?.value || '';
    const newPw2 = document.getElementById('account-edit-new-pw2')?.value || '';
    if (!currentPw || !newPw || !newPw2) { showToast('비밀번호 항목을 모두 입력해 주세요.', 'warning'); return; }
    if (account.pw !== currentPw) { showToast('현재 비밀번호가 일치하지 않습니다.', 'warning'); return; }
    if (newPw !== newPw2) { showToast('새 비밀번호가 일치하지 않습니다.', 'warning'); return; }

    account.pw = newPw;
    if (typeof pushLog === 'function') pushLog('CLIENT', 'PASSWORD_CHANGE', `'${auth.id}' 고객님이 비밀번호를 변경했습니다.`, 'INFO');
    showToast('비밀번호가 변경되었습니다.', 'success');
    renderClientAccountSettings();
}

/* 계정 정보 수정/비밀번호 변경은 있는데 탈퇴할 방법이 전혀 없었던 공백 — 파트너의
 * status: 'banned'/isSuspended와 동일하게 배열에서 지우지 않고 status 플래그만
 * 남기는 소프트 삭제로 처리한다(과거 의뢰·후기 기록은 그대로 보존). */
function openAccountDeleteModal() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    safeUpdateValue('account-delete-confirm-pw', '');
    openModal('client-account-delete-modal', 'client-account-delete-modal-card');
}

function closeAccountDeleteModal() {
    closeModal('client-account-delete-modal', 'client-account-delete-modal-card');
}

function confirmAccountDeletion() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;

    const pw = document.getElementById('account-delete-confirm-pw')?.value || '';
    if (!pw) { showToast('비밀번호를 입력해 주세요.', 'warning'); return; }
    if (account.pw !== pw) { showToast('비밀번호가 일치하지 않습니다.', 'warning'); return; }

    account.status = 'withdrawn';
    if (typeof pushLog === 'function') pushLog('CLIENT', 'ACCOUNT_WITHDRAW', `'${account.name}'(${account.id}) 고객님이 회원 탈퇴했습니다.`, 'WARNING');
    showToast('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.', 'info');
    closeAccountDeleteModal();
    performClientLogout();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
}

/* 고객센터 1:1 문의 — 지금까지 "고객센터" 링크는 showComingSoon()만 띄우는 죽은
 * 링크였다. 실제 문의를 등록하고 관리자 답변을 받아볼 수 있는 티켓 시스템으로
 * 교체한다(clientId로 소유자를 구분, 관리자 답변 시 알림 발송). */
function openSupportInquiryModal() {
    if (!requireClientLoginForCommunity()) return;
    safeUpdateValue('support-inquiry-subject', '');
    safeUpdateValue('support-inquiry-message', '');
    renderMySupportTickets();
    openModal('support-inquiry-modal', 'support-inquiry-modal-card');
}

function closeSupportInquiryModal() { closeModal('support-inquiry-modal', 'support-inquiry-modal-card'); }

function submitSupportInquiry() {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return;
    const subject = document.getElementById('support-inquiry-subject')?.value.trim();
    const message = document.getElementById('support-inquiry-message')?.value.trim();
    if (!subject || !message) { showToast('제목과 문의 내용을 모두 입력해 주세요.', 'warning'); return; }

    const ticket = {
        id: `tk-${Date.now()}`, clientId: auth.id, clientName: auth.name, clientPhone: auth.phone,
        subject, message, date: getLocalDateString(), status: 'open', adminReply: null, adminReplyDate: null,
        followUps: []
    };
    if (!window.AppState.supportTickets) window.AppState.supportTickets = [];
    window.AppState.supportTickets.unshift(ticket);
    if (typeof pushLog === 'function') pushLog('CLIENT', 'SUPPORT_INQUIRY', `'${auth.name}' 고객님이 1:1 문의를 등록했습니다. (${subject})`, 'INFO');
    showToast('문의가 등록되었습니다. 빠르게 답변드릴게요!', 'success');
    safeUpdateValue('support-inquiry-subject', '');
    safeUpdateValue('support-inquiry-message', '');
    renderMySupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

function renderMySupportTickets() {
    const container = document.getElementById('support-inquiry-my-tickets');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    const myTickets = (window.AppState.supportTickets || []).filter(t => t.clientId === auth.id);

    if (myTickets.length === 0) {
        container.innerHTML = `<p class="text-xs text-ink-400 font-bold text-center py-4">아직 등록한 문의가 없습니다.</p>`;
        return;
    }
    container.innerHTML = myTickets.map(t => {
        const followUps = t.followUps || [];
        const followUpsHtml = followUps.map(f => `
            <div class="mt-1.5 pl-2.5 border-l-2 border-ink-200 space-y-1">
                <p class="text-[11px] text-ink-700 font-semibold leading-relaxed">${escapeHtml(f.clientMessage)} <span class="text-[9px] text-ink-400 font-bold">(${f.clientDate})</span></p>
                ${f.adminReply ? `<div class="p-2.5 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">고객센터 답변</p><p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(f.adminReply)}</p></div>` : `<p class="text-[10px] text-amberCustom font-bold">답변 대기중</p>`}
            </div>`).join('');
        const hasPendingFollowUp = followUps.length > 0 && !followUps[followUps.length - 1].adminReply;
        const canFollowUp = t.status === 'answered' && !hasPendingFollowUp;

        return `
        <div class="p-3.5 bg-ink-50 rounded-xl space-y-1.5 text-left">
            <div class="flex justify-between items-center">
                <h6 class="text-xs font-black text-ink-950">${escapeHtml(t.subject)}</h6>
                <div class="flex items-center gap-2">
                    <span class="badge ${t.status === 'answered' ? 'badge-emerald' : 'badge-amber'}">${t.status === 'answered' ? '답변 완료' : '답변 대기'}</span>
                    ${(t.status === 'open' && followUps.length === 0) ? `<button type="button" onclick="cancelSupportTicket('${t.id}')" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">취소</button>` : ''}
                </div>
            </div>
            <p class="text-[11px] text-ink-600 font-medium leading-relaxed">${escapeHtml(t.message)}</p>
            <p class="text-[10px] text-ink-400 font-bold">${t.date}</p>
            ${t.adminReply ? `<div class="mt-1.5 p-2.5 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">고객센터 답변</p><p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(t.adminReply)}</p></div>` : ''}
            ${followUpsHtml}
            ${canFollowUp ? `
                <div class="flex gap-1.5 pt-1.5">
                    <input type="text" id="ticket-followup-input-${t.id}" placeholder="추가로 궁금한 점을 남겨주세요" class="input flex-1 text-xs">
                    <button type="button" onclick="submitSupportFollowUp('${t.id}')" class="btn btn-dark btn-sm shrink-0">추가 문의</button>
                </div>` : ''}
        </div>`;
    }).join('');
}

/* 답변이 완료되면 그 뒤로는 추가 질문을 할 방법이 전혀 없어서, 후속 질문이 있으면
 * 전혀 무관한 새 문의를 다시 등록해야 했던 데드엔드를 해소한다. 기존 message/
 * adminReply 필드는 그대로 두고(하위 호환), 후속 대화는 followUps 배열에 라운드별로
 * 쌓아서 여러 번 주고받을 수 있게 한다. */
function submitSupportFollowUp(ticketId) {
    const auth = window.AppState.clientAuth;
    const ticket = (window.AppState.supportTickets || []).find(t => t.id === ticketId);
    if (!ticket || ticket.clientId !== auth.id || ticket.status !== 'answered') return;

    const input = document.getElementById(`ticket-followup-input-${ticketId}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('추가 문의 내용을 입력해 주세요.', 'warning'); return; }

    if (!ticket.followUps) ticket.followUps = [];
    ticket.followUps.push({ clientMessage: text, clientDate: getLocalDateString(), adminReply: null, adminReplyDate: null });
    ticket.status = 'open';

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SUPPORT_FOLLOWUP', `'${auth.name}' 고객님이 문의(${ticket.subject})에 추가 질문을 남겼습니다.`, 'INFO');
    showToast('추가 문의가 등록되었습니다.', 'success');
    renderMySupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

/* 문의를 잘못 등록했거나 중복 등록한 경우를 위해, 아직 답변받지 않은(open) 본인
 * 문의는 취소할 수 있게 한다. 이미 답변이 달린 문의는 관리자가 이미 시간을
 * 들여 답변한 것이므로 취소를 막는다(기록으로 남겨야 함). */
function cancelSupportTicket(ticketId) {
    const auth = window.AppState.clientAuth;
    const idx = (window.AppState.supportTickets || []).findIndex(t => t.id === ticketId);
    if (idx === -1) return;
    const ticket = window.AppState.supportTickets[idx];
    if (ticket.clientId !== auth.id) return;
    if (ticket.status !== 'open' || (ticket.followUps && ticket.followUps.length > 0)) { showToast('이미 답변이 등록된 문의는 취소할 수 없어요.', 'warning'); return; }
    window.AppState.supportTickets.splice(idx, 1);
    showToast('문의가 취소되었습니다.', 'info');
    renderMySupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

/* 받은 입찰서가 여러 건이면 지금까지 도착한 순서로만 보여서, 가장 저렴하거나
 * 평점이 높은 파트너를 찾으려면 전부 눈으로 훑어야 했다 — 정렬 옵션을 추가한다.
 * 실제 배열(order.bids) 순서는 그대로 두고 화면 표시용으로만 재정렬한다(매칭취소 등
 * 다른 기능이 bid.partner 이름으로 동작해 배열 순서에 의존하지 않으므로 안전하다). */
let clientBidSortMode = 'default';

function setClientBidSortMode(orderCode, mode) {
    clientBidSortMode = mode;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (order) renderMyPageEstimateDetails(order);
}

function getSortedBidsForDisplay(bids) {
    if (clientBidSortMode === 'price_asc') return [...bids].sort((a, b) => a.price - b.price);
    if (clientBidSortMode === 'rating_desc') return [...bids].sort((a, b) => {
        const ra = (window.AppState.partners.find(p => p.name === a.partner) || {}).rating || 5.0;
        const rb = (window.AppState.partners.find(p => p.name === b.partner) || {}).rating || 5.0;
        return rb - ra;
    });
    return bids;
}

/* 정렬(sort)로는 "훑어보는" 문제만 풀리고, 2~3곳을 나란히 놓고 견적금액·평점·인증
 * 여부·제안 내용을 한눈에 대조하는 진짜 "비교"는 여전히 카드를 오가며 눈으로 해야
 * 했다 — 체크박스로 고른 입찰서를 표로 모아 보여준다. */
let bidCompareSelection = [];

function toggleBidCompareSelection(orderCode, partnerName) {
    const idx = bidCompareSelection.indexOf(partnerName);
    if (idx >= 0) {
        bidCompareSelection.splice(idx, 1);
    } else {
        if (bidCompareSelection.length >= 3) { showToast('최대 3곳까지 비교할 수 있어요.', 'warning'); return; }
        bidCompareSelection.push(partnerName);
    }
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (order) renderMyPageEstimateDetails(order);
}

function openBidCompareModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    const selectedBids = (order.bids || []).filter(b => bidCompareSelection.includes(b.partner));
    if (selectedBids.length < 2) { showToast('비교할 입찰서를 2곳 이상 선택해주세요.', 'warning'); return; }

    const container = document.getElementById('bid-compare-modal-body');
    if (container) {
        const rowsDef = [
            { label: '견적 금액', render: b => `<span class="font-black text-ink-950">₩ ${b.price.toLocaleString()}만원</span>` },
            { label: '비용 세부내역', render: b => (b.costBreakdown || []).length === 0 ? `<span class="text-ink-400">미제공</span>` : `<div class="space-y-0.5">${b.costBreakdown.map(item => `<div>${escapeHtml(item.label)} ₩${item.amount.toLocaleString()}만원</div>`).join('')}</div>`, alignTop: true },
            { label: '평점', render: b => { const p = window.AppState.partners.find(x => x.name === b.partner); return `<span class="font-bold text-gold-600">★ ${p ? p.rating.toFixed(1) : '5.0'}</span>`; } },
            { label: '안심 인증', render: b => { const p = window.AppState.partners.find(x => x.name === b.partner); return p && p.isCertified ? `<span class="badge badge-brand">인증</span>` : '-'; } },
            { label: '제안 내용', render: b => `<span class="text-ink-600">${escapeHtml(b.desc)}</span>`, alignTop: true }
        ];
        container.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-xs text-left border-collapse">
            <thead><tr class="border-b border-ink-200">
                <th class="py-2 pr-3 font-black text-ink-400 whitespace-nowrap">항목</th>
                ${selectedBids.map(b => `<th class="py-2 px-3 font-black text-ink-950 whitespace-nowrap">${escapeHtml(b.partner)}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${rowsDef.map(row => `<tr class="border-b border-ink-100">
                    <td class="py-2 pr-3 font-bold text-ink-500 whitespace-nowrap ${row.alignTop ? 'align-top' : ''}">${row.label}</td>
                    ${selectedBids.map(b => `<td class="py-2 px-3 ${row.alignTop ? 'align-top' : ''}">${row.render(b)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    }
    openModal('bid-compare-modal', 'bid-compare-modal-card');
}

function closeBidCompareModal() {
    closeModal('bid-compare-modal', 'bid-compare-modal-card');
}

function selectMyPageEstimate(orderCode) {
    window.AppState.selectedMyPageOrderCode = orderCode;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    renderClientMyPage();
    if (order) renderMyPageEstimateDetails(order);
}

function renderMyPageEstimateDetails(order) {
    const detailEmpty = document.getElementById('client-mypage-detail-empty');
    const detailBoard = document.getElementById('client-mypage-detail-board');
    if (!detailBoard) return;

    detailEmpty?.classList.add('hidden');
    detailBoard.classList.remove('hidden');

    // 철회된 의뢰는 더 이상 어떤 조작(매칭취소/계약체결/재매칭/1:1지정)도 의미가 없으므로,
    // 기존 입찰 목록은 참고용으로만 읽기 전용으로 보여주고 별도의 단순한 화면으로 분리한다.
    if (order.status === 'withdrawn') {
        const withdrawnBidsHtml = (order.bids && order.bids.length > 0)
            ? order.bids.map(bid => `
                <div class="p-3.5 rounded-xl border border-ink-100 bg-ink-50/70 text-left space-y-1 opacity-70">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-black text-ink-950">${escapeHtml(bid.partner)}</span>
                        <span class="font-black text-ink-950 text-sm">₩ ${bid.price.toLocaleString()} 만원</span>
                    </div>
                    <p class="text-xs text-ink-500 font-semibold leading-relaxed">${escapeHtml(bid.desc)}</p>
                </div>`).join('')
            : `<p class="text-xs text-ink-400 font-bold text-center py-6">참여했던 입찰서가 없습니다.</p>`;

        detailBoard.innerHTML = `
            <div class="space-y-6 text-left">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                    <div class="space-y-1">
                        <span class="px-2 py-0.5 text-[9px] font-mono font-black bg-ink-100 text-ink-700 rounded border border-ink-200">${order.code}</span>
                        <h3 class="text-base sm:text-lg font-black text-ink-950">${escapeHtml(order.clientAddress)}</h3>
                    </div>
                    <span class="badge badge-neutral"><span class="badge-dot bg-ink-300"></span> 철회된 의뢰</span>
                </div>
                <div class="p-4 rounded-2xl text-xs font-bold text-ink-500 bg-ink-50 text-center">이 의뢰는 철회되어 더 이상 진행되지 않습니다.</div>
                <div class="space-y-3 pt-2">
                    <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="building" class="w-4 h-4 text-ink-400"></i> 철회 시점의 파트너 제안서 (${order.bids ? order.bids.length : 0})</h4>
                    <div class="space-y-2.5">${withdrawnBidsHtml}</div>
                </div>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // 계약이 체결된 이후에는 지금까지 되돌릴 방법이 전혀 없었다(오탈자 하나, 파트너와의
    // 분쟁 등 어떤 사유든 영구 확정) — 고객이 취소를 요청하면 매니저 센터 심사를 거쳐
    // 승인/반려되는 별도 상태(cancel_requested → cancelled 또는 contracted 복귀)를 둔다.
    if (order.status === 'cancel_requested' || order.status === 'cancelled') {
        const isRequested = order.status === 'cancel_requested';
        detailBoard.innerHTML = `
            <div class="space-y-6 text-left">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                    <div class="space-y-1">
                        <span class="px-2 py-0.5 text-[9px] font-mono font-black bg-ink-100 text-ink-700 rounded border border-ink-200">${order.code}</span>
                        <h3 class="text-base sm:text-lg font-black text-ink-950">${escapeHtml(order.clientAddress)}</h3>
                    </div>
                    ${isRequested ? `<span class="badge badge-amber"><span class="badge-dot bg-amberCustom"></span> 계약 취소 심사중</span>` : `<span class="badge badge-rose"><span class="badge-dot bg-roseCustom"></span> 계약 취소됨</span>`}
                </div>
                <div class="p-4 rounded-2xl text-xs font-bold text-ink-600 bg-ink-50 space-y-1.5">
                    <p>${isRequested ? (order.cancelRequest && order.cancelRequest.requestedBy === 'partner' ? '계약 파트너사가 계약 취소를 요청하여 매니저 센터에서 심사 중입니다.' : '계약 취소 요청이 매니저 센터에서 심사 중입니다.') + ' 승인되면 계약이 취소되고, 반려되면 계약이 그대로 유지됩니다.' : '이 계약은 취소 승인되어 더 이상 유효하지 않습니다.'}</p>
                    ${order.cancelRequest ? `<p class="text-[11px] text-ink-500 font-semibold">요청 사유: ${escapeHtml(order.cancelRequest.reason)}</p>` : ''}
                </div>
                <div class="p-4 rounded-2xl border border-ink-100 bg-white text-left space-y-1">
                    <p class="text-xs font-black text-ink-950">계약 파트너사: ${escapeHtml(order.acceptedPartner || '-')}</p>
                    <p class="text-xs text-ink-500 font-semibold">최종 계약금액: ₩ ${(order.finalPrice || 0).toLocaleString()} 만원</p>
                </div>
                ${(isRequested && order.cancelRequest && order.cancelRequest.requestedBy === 'client') ? `<button type="button" onclick="retractContractCancellationRequest('${order.code}')" class="btn btn-secondary btn-block">취소 요청 철회하기</button>` : ''}
                ${(!isRequested && order.cancelRequest && order.cancelRequest.requestedBy === 'admin') ? (
                    order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending'
                        ? `<div class="p-3 bg-amber-50 rounded-xl text-center"><span class="text-[11px] font-black text-amberCustom">이의신청 심사 대기중</span></div>`
                        : order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'rejected'
                            ? `<div class="p-3 bg-ink-50 rounded-xl text-center"><span class="text-[11px] font-bold text-ink-400">이의신청 반려됨${order.cancelRequest.appeal.adminResponse ? ` — ${escapeHtml(order.cancelRequest.appeal.adminResponse)}` : ''}</span></div>`
                            : `<button type="button" onclick="openForceCancelAppealModal('${order.code}')" class="btn btn-secondary btn-block">강제 취소에 이의신청하기</button>`
                ) : ''}
                ${!isRequested && !(order.cancelRequest && order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending')
                    ? `<button type="button" onclick="reopenCancelledOrder('${order.code}')" class="btn btn-dark btn-block"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> 새 파트너사로 재매칭 받기</button>`
                    : ''}
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let bidsHtml = '';
    if (order.bids && order.bids.length > 0) {
        getSortedBidsForDisplay(order.bids).forEach(bid => {
            const isContracted = order.status === 'contracted' && order.acceptedPartner === bid.partner;
            const partnerInfo = window.AppState.partners.find(p => p.name === bid.partner);
            const ratingVal = partnerInfo ? partnerInfo.rating.toFixed(1) : "5.0";
            // 입찰 당시엔 정상이었더라도 그 이후 삼진아웃으로 영구 제명될 수 있다 — '안심'
            // 중개 플랫폼인데 제명된 파트너와 계약을 체결할 수 있으면 블랙리스트 정책이
            // 무의미해지므로, 제명된 파트너의 입찰은 계약 체결을 막고 매칭취소만 유도한다.
            const isBannedBid = partnerInfo && partnerInfo.status === 'banned';

            const showCompareCheckbox = order.status === 'bidding' && !isBannedBid;
            bidsHtml += `
                <div class="p-4 rounded-2xl border ${isContracted ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/40' : (isBannedBid ? 'border-rose-200 bg-rose-50/40' : 'border-ink-100 bg-ink-50/70')} text-left space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center gap-2">
                            ${showCompareCheckbox ? `<input type="checkbox" onchange="toggleBidCompareSelection('${order.code}', '${bid.partner}')" ${bidCompareSelection.includes(bid.partner) ? 'checked' : ''} class="w-3.5 h-3.5 shrink-0" aria-label="비교 대상으로 선택">` : ''}
                            <span class="font-black text-ink-950 cursor-pointer hover:underline" onclick="openPartnerPortfolioModal('${bid.partner}')">${escapeHtml(bid.partner)}</span>
                            <span class="text-gold-500 font-extrabold text-xs">★ ${ratingVal}</span>
                            ${isBannedBid ? `<span class="badge badge-rose">영구 제명</span>` : ''}
                        </div>
                        <span class="font-black text-ink-950 text-sm">₩ ${bid.price.toLocaleString()} 만원</span>
                    </div>
                    <p class="text-xs text-ink-600 font-semibold leading-relaxed">${escapeHtml(bid.desc)}</p>
                    ${(bid.costBreakdown || []).length > 0 ? `<div class="flex flex-wrap gap-1.5">${bid.costBreakdown.map(item => `<span class="badge badge-neutral">${escapeHtml(item.label)} ₩${item.amount.toLocaleString()}만원</span>`).join('')}</div>` : ''}
                    ${(bid.questions || []).length > 0 ? `<div class="space-y-1.5 pt-1">${bid.questions.map(q => `
                        <div class="p-2.5 bg-white rounded-xl border border-ink-100 space-y-1">
                            <p class="text-[11px] text-ink-700 font-semibold leading-relaxed"><i data-lucide="help-circle" class="w-3 h-3 inline text-ink-400"></i> ${escapeHtml(q.text)}</p>
                            ${q.reply ? `<p class="text-[11px] text-brand-700 font-semibold leading-relaxed pl-4"><i data-lucide="reply" class="w-3 h-3 inline"></i> ${escapeHtml(q.reply)}</p>` : `<p class="text-[10px] text-ink-400 font-bold pl-4">답변 대기중</p>`}
                        </div>`).join('')}</div>` : ''}
                    <div class="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-ink-100">
                        <button type="button" onclick="openPartnerPortfolioModal('${bid.partner}')" class="btn btn-ghost btn-sm px-0"><i data-lucide="palette" class="w-3.5 h-3.5"></i> 시공 포트폴리오 및 후기</button>
                        ${order.status === 'contracted' ? (isContracted ? `
                            <span class="badge badge-emerald">✓ 안심 계약 체결사</span>
                        ` : `<span class="text-[10px] font-bold text-ink-400">계약 마감</span>`) : (isBannedBid ? `
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] font-bold text-roseCustom">삼진아웃으로 제명되어 계약할 수 없어요</span>
                                <button type="button" onclick="cancelPartnerBid('${order.code}', '${bid.partner}', '파트너 영구 제명으로 인한 자동 취소')" class="btn btn-secondary btn-sm">매칭취소</button>
                            </div>
                        ` : `
                            <div class="flex items-center gap-1.5 flex-wrap justify-end">
                                <button type="button" onclick="openBidQuestionModal('${order.code}', '${bid.partner}')" class="btn btn-ghost btn-sm px-1.5" title="계약 전 궁금한 점 문의하기"><i data-lucide="message-circle-question" class="w-3.5 h-3.5"></i></button>
                                <button type="button" onclick="openReportReasonPrompt((reason) => cancelPartnerBid('${order.code}', '${bid.partner}', reason))" class="btn btn-secondary btn-sm">매칭취소</button>
                                <button type="button" onclick="clientFinalizeContract('${order.code}', '${bid.partner}', ${bid.price})" class="btn btn-dark btn-sm">이 파트너와 계약 체결하기</button>
                            </div>
                        `)}
                    </div>
                </div>`;
        });
    } else if (order.is1on1) {
        bidsHtml = `<div class="empty-state !py-8 surface-flat space-y-2">
            <p class="text-xs text-ink-500 font-bold">지정하신 파트너사와의 매칭이 취소되었습니다.</p>
            <p class="text-[10px] text-ink-400 font-medium">아래에서 다른 우수 파트너사를 다시 1:1로 지정하거나, 오픈 매칭으로 전환해 여러 파트너사의 제안을 받아보세요.</p>
            <button type="button" onclick="convertOrderToOpenMatching('${order.code}')" class="btn btn-secondary btn-sm"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> 오픈 매칭으로 전환하기</button>
        </div>`;
    } else {
        bidsHtml = `<div class="empty-state !py-8 surface-flat"><p class="text-xs text-ink-500 font-bold">아직 참여한 매칭 입찰서가 없습니다.</p><p class="text-[10px] text-ink-400 font-medium mt-1">검증된 파트너사가 제안서를 준비하고 있습니다.</p></div>`;
    }

    let reviewBtnHtml = '';
    if (order.status === 'contracted' && !order.reviewWritten) {
        reviewBtnHtml = `
            <div class="p-4 rounded-2xl flex flex-wrap gap-3 justify-between items-center text-xs" style="background:var(--brand-50)">
                <span class="font-bold text-brand-700">시공이 완료되셨나요? 솔직한 안심 후기를 남겨주세요!</span>
                <button type="button" onclick="openReviewWriteModal('${order.code}')" class="btn btn-primary">후기 작성하기</button>
            </div>`;
    } else if (order.reviewWritten) {
        reviewBtnHtml = `<div class="p-3 bg-ink-100 rounded-xl flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-ink-600">
            <span class="flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> 솔직 안심 리뷰 생성이 성공적으로 등록 완료되었습니다.</span>
            <button type="button" onclick="openReviewWriteModal('${order.code}')" class="text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0 font-black">수정하기</button>
            <button type="button" onclick="deleteMyClientReview('${order.code}')" class="text-roseCustom hover:underline bg-transparent border-0 cursor-pointer p-0 font-black">삭제하기</button>
        </div>`;
    }

    const designationBannerHtml = `
        <div class="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style="background:var(--brand-50)">
            <div class="space-y-0.5">
                <span class="flex items-center gap-1.5 text-[10px] font-black text-brand-700 uppercase tracking-wider"><span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span> 1:1 전속 지정 상담</span>
                <p class="text-xs font-bold text-ink-800">원하는 우수 파트너사를 1:1 지정하여 단독 견적을 추가로 받아보세요!</p>
            </div>
            <button type="button" onclick="switchPanel('partner-search-panel')" class="btn btn-primary whitespace-nowrap">우수 파트너 1:1 지정하기 →</button>
        </div>`;

    // 계약 체결 후 파트너사가 업로드한 계약서/견적서를 고객도 확인·다운로드할 수 있어야 하는데,
    // 지금까지는 파트너 콘솔에만 노출되고 고객 마이페이지에는 전혀 표시되지 않았던 공백이었다.
    const contractDocsHtml = order.status === 'contracted' ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${['contract', 'estimate'].map(docType => {
                const doc = docType === 'contract' ? order.contractDoc : order.estimateDoc;
                const label = docType === 'contract' ? '계약서' : '견적서';
                return doc
                    ? `<div class="p-3.5 surface-flat space-y-2 text-left">
                        <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${label}</span><span class="badge badge-emerald">업로드됨</span></div>
                        <p class="text-[10px] text-ink-500 font-bold truncate">${escapeHtml(doc.name)}</p>
                        <p class="text-[9px] text-ink-400 font-semibold">${escapeHtml(doc.uploadedAt)}</p>
                        <button type="button" onclick="openUploadedPartnerDoc('${order.code}', '${docType}')" class="btn btn-outline btn-sm btn-block">보기/다운로드</button>
                    </div>`
                    : `<div class="p-3.5 surface-flat space-y-2 text-left">
                        <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${label}</span><span class="badge badge-amber">업로드 대기중</span></div>
                        <p class="text-[10px] text-ink-400 font-semibold leading-relaxed">계약 파트너사가 아직 ${label}를 업로드하지 않았습니다.</p>
                    </div>`;
            }).join('')}
        </div>
        ${buildScheduleChangeHtml(order)}
        ${buildPriceChangeHtml(order)}
        ${order.clientSigned
            ? `<div class="p-3.5 surface-flat flex items-center justify-between mt-3"><span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="pen-tool" class="w-3.5 h-3.5 text-emeraldCustom"></i> 고객 서명 완료</span><span class="text-[10px] text-ink-400 font-bold">${order.signedDate}</span></div>`
            : `<div class="p-3.5 surface-flat space-y-2 text-left mt-3">
                <span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="pen-tool" class="w-3.5 h-3.5 text-brand-500"></i> 시공 계약 합의서 서명</span>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">아래 서명란에 손가락이나 마우스로 서명해 주세요.</p>
                <canvas id="signature-canvas-${order.code}" width="400" height="140" class="w-full rounded-xl border border-dashed border-ink-200 bg-white" style="touch-action:none; cursor:crosshair;"></canvas>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="clearSignatureCanvas('${order.code}')" class="btn btn-secondary btn-sm flex-1">지우기</button>
                    <button type="button" onclick="submitSignatureCanvas('${order.code}')" class="btn btn-dark btn-sm flex-1">서명 완료</button>
                </div>
            </div>`}
        <div class="p-3 bg-ink-50 rounded-xl flex items-center justify-between mt-2">
            <span class="text-[11px] font-bold text-ink-600 flex items-center gap-1.5"><i data-lucide="pen-tool" class="w-3.5 h-3.5 ${order.partnerSigned ? 'text-emeraldCustom' : 'text-ink-300'}"></i> 파트너사 서명</span>
            <span class="badge ${order.partnerSigned ? 'badge-emerald' : 'badge-amber'}">${order.partnerSigned ? '완료' : '대기중'}</span>
        </div>
        ${order.clientSigned && order.partnerSigned ? `<div class="p-2.5 text-center"><span class="badge badge-brand"><i data-lucide="shield-check" class="w-3 h-3"></i> 양측 서명 완료 — 계약 합의서 최종 확정</span></div>` : ''}
        ${buildClientSiteVisitHtml(order)}
        ${buildProgressStagesHtml(order)}
        ${buildPaymentMilestonesHtml(order)}
        ${buildClientChangeOrdersHtml(order)}
        ${buildRepairClaimsHtml(order)}
        ${typeof buildOrderMessageThreadHtml === 'function' ? buildOrderMessageThreadHtml(order, 'client') : ''}
        <button type="button" onclick="downloadTransactionReceipt('${order.code}')" class="btn btn-secondary btn-sm btn-block mt-3"><i data-lucide="receipt" class="w-3.5 h-3.5"></i> 거래 확인서 다운로드</button>
        ${isPartnerReportedByMeForOrder(order.code)
            ? `<div class="flex items-center justify-center gap-2 mt-2"><span class="badge badge-neutral">계약 파트너사 신고 접수됨</span><button type="button" onclick="retractPartnerReport('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">철회</button></div>`
            : `<button type="button" onclick="openReportPartnerModal('${order.code}')" class="btn btn-ghost btn-sm btn-block mt-2 text-roseCustom"><i data-lucide="flag" class="w-3.5 h-3.5"></i> 계약 파트너사 신고하기</button>`}` : '';

    detailBoard.innerHTML = `
        <div class="space-y-6 text-left">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                <div class="space-y-1">
                    <span class="px-2 py-0.5 text-[9px] font-mono font-black bg-ink-100 text-ink-700 rounded border border-ink-200">${order.code}</span>
                    <h3 class="text-base sm:text-lg font-black text-ink-950">${escapeHtml(order.clientAddress)}</h3>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <span class="text-[10px] text-ink-400 block font-bold">희망 예산</span>
                        <span class="text-sm font-black text-brand-600">₩ ${order.budget.toLocaleString()} 만원</span>
                        ${order.status === 'bidding' ? `<button type="button" onclick="openEditOrderBudgetModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 block mt-0.5">수정</button>` : ''}
                    </div>
                    ${order.status === 'bidding' ? `<button type="button" onclick="withdrawOrder('${order.code}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 whitespace-nowrap">의뢰 철회</button>` : ''}
                    ${order.status === 'contracted' ? `<button type="button" onclick="openContractCancelRequestModal('${order.code}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 whitespace-nowrap">계약 취소 요청</button>` : ''}
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div class="article-spec-chip"><span>공간 구분</span><span class="val">${order.spaceType === 'residential' ? '주거 공간' : '상업 공간'}</span></div>
                <div class="article-spec-chip"><span>시공 범위</span><span class="val">${order.workType === 'all' ? '전체 시공' : '부분 시공'}</span></div>
                <div class="article-spec-chip"><span>면적 (평수)</span><span class="val">${order.pyung}평형</span></div>
                <div class="article-spec-chip"><span>희망 착공일</span><span class="val">${order.preferredDate}</span></div>
            </div>

            ${contractDocsHtml}
            ${designationBannerHtml}
            ${reviewBtnHtml}
            ${buildClientPreBidQnaHtml(order)}

            <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="building" class="w-4 h-4 text-brand-500"></i> 연결된 안심 파트너 제안서 목록 (${order.bids ? order.bids.length : 0})</h4>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${(order.status === 'bidding' && order.bids && order.bids.length > 1) ? `
                        <select onchange="setClientBidSortMode('${order.code}', this.value)" class="input text-[10px] py-1.5 px-2 w-auto">
                            <option value="default" ${clientBidSortMode === 'default' ? 'selected' : ''}>도착순</option>
                            <option value="price_asc" ${clientBidSortMode === 'price_asc' ? 'selected' : ''}>가격 낮은순</option>
                            <option value="rating_desc" ${clientBidSortMode === 'rating_desc' ? 'selected' : ''}>평점 높은순</option>
                        </select>
                        <button type="button" onclick="openBidCompareModal('${order.code}')" ${bidCompareSelection.length < 2 ? 'disabled' : ''} class="btn btn-secondary btn-sm shrink-0"><i data-lucide="columns-3" class="w-3.5 h-3.5"></i> 비교하기${bidCompareSelection.length > 0 ? ` (${bidCompareSelection.length})` : ''}</button>` : ''}
                        ${(order.status !== 'contracted' && !order.is1on1) ? `<button type="button" onclick="triggerRebidding('${order.code}')" class="btn btn-secondary btn-sm shrink-0"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> 새 파트너 재매칭 받기</button>` : ''}
                    </div>
                </div>
                <div class="space-y-3">${bidsHtml}</div>
            </div>
        </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (order.status === 'contracted' && !order.clientSigned) initSignatureCanvas(order.code);
}

/* "매칭취소"로 뺀 자리를 새 파트너사로 다시 채운다 — 예전엔 토스트만 띄우고 실제로는
 * order.bids를 전혀 건드리지 않던 자리채우기용 스텁이었음. 취소/이미 입찰한 파트너는
 * 제외하고, 남은 슬롯만큼 새 파트너를 뽑아 입찰서를 만들어준다(자동매칭 로직과 동일한 방식). */
function triggerRebidding(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status === 'contracted') return;
    if (order.is1on1) { showToast('1:1 지정 상담은 파트너사를 직접 다시 지정해주셔야 해요.', 'info'); return; }

    const slotsNeeded = (order.partnerCountLimit || 3) - (order.bids ? order.bids.length : 0);
    if (slotsNeeded <= 0) { showToast('이미 배정 인원이 모두 채워져 있어요.', 'info'); return; }

    const excluded = new Set([...(order.excludedPartners || []), ...(order.bids || []).map(b => b.partner)]);
    const candidates = (window.AppState.partners || []).filter(p => p.status === 'active' && !p.isPaused && !excluded.has(p.name) && !isPartnerBlockedByClient(p.name));
    if (candidates.length === 0) { showToast('현재 매칭 가능한 새로운 파트너사가 없어요.', 'warning'); return; }

    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, slotsNeeded);
    selected.forEach(partner => {
        order.bids.push({
            partner: partner.name,
            price: Math.floor(order.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        });
    });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REBID', `[${order.clientName}] 고객님 요청으로 오더 ${orderCode}에 파트너사 ${selected.length}곳 재매칭.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `새로운 파트너사 ${selected.length}곳이 매칭되어 견적서를 보냈어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') {
        selected.forEach(partner => pushPartnerNotification(partner.name, `재매칭으로 새 오더(${orderCode})에 매칭되었어요. 고객: ${maskName(order.clientName)}님.`));
    }
    showToast(`새로운 파트너사 ${selected.length}곳이 매칭되었습니다!`, 'success');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

/* 계약이 취소(강제 취소·양측 합의 취소 승인 등 어떤 사유든)되면 detail 화면이
 * "더 이상 유효하지 않습니다"로 영구 종료되고, 고객이 같은 의뢰를 이어가려면
 * 완전히 새 견적신청서를 처음부터 다시 써야 했다 — 계약 파트너 정보만 제외하고
 * 나머지 의뢰 스펙(면적·주소·예산 등)은 그대로 살려서 오픈 매칭으로 재개할 수
 * 있게 한다(triggerRebidding과 동일한 후보 선정 로직 재사용). */
function reopenCancelledOrder(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'cancelled') return;
    if (order.cancelRequest && order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending') { showToast('이의신청 심사가 끝난 후 다시 매칭할 수 있어요.', 'warning'); return; }

    const previousPartner = order.acceptedPartner;
    if (previousPartner) {
        if (!order.excludedPartners) order.excludedPartners = [];
        if (!order.excludedPartners.includes(previousPartner)) order.excludedPartners.push(previousPartner);
    }

    order.status = 'bidding';
    order.acceptedPartner = null;
    order.finalPrice = 0;
    order.contractUploaded = false;
    order.commissionPaid = false;
    order.contractDoc = null;
    order.estimateDoc = null;
    order.clientSigned = false;
    order.partnerSigned = false;
    order.cancelRequest = null;
    order.bids = [];

    const slotsNeeded = order.partnerCountLimit || 3;
    const excluded = new Set(order.excludedPartners || []);
    const candidates = (window.AppState.partners || []).filter(p => p.status === 'active' && !p.isPaused && !excluded.has(p.name) && !isPartnerBlockedByClient(p.name));
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, slotsNeeded);
    selected.forEach(partner => {
        order.bids.push({
            partner: partner.name,
            price: Math.floor(order.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        });
    });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REOPEN_CANCELLED_ORDER', `[${order.clientName}] 고객님이 취소된 계약(${orderCode})을 새 파트너사로 재매칭했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, selected.length > 0 ? `새로운 파트너사 ${selected.length}곳이 매칭되어 견적서를 보냈어요. (의뢰 코드: ${orderCode})` : `재매칭 가능한 파트너사가 아직 없어요. 잠시 후 다시 시도해주세요.`);
    if (typeof pushPartnerNotification === 'function') { selected.forEach(partner => pushPartnerNotification(partner.name, `재매칭으로 새 오더(${orderCode})에 매칭되었어요. 고객: ${maskName(order.clientName)}님.`)); }
    showToast(selected.length > 0 ? `새로운 파트너사 ${selected.length}곳이 매칭되었습니다!` : '재매칭 가능한 파트너사를 찾지 못했어요. 잠시 후 다시 시도해주세요.', selected.length > 0 ? 'success' : 'warning');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

/* 1:1 지정 상담은 지정한 파트너가 입찰을 안 하거나 매칭취소되면(bids가 0건) 그 뒤로는
 * "다시 1:1로 지정해보세요"라는 안내뿐, 일반 오픈 매칭(자동매칭)으로 전환할 방법이
 * 전혀 없어서 영구 데드엔드였다 — triggerRebidding과 동일한 자동배정 로직을 재사용해
 * is1on1을 해제하고 여러 파트너사에 오픈 매칭한다. */
function convertOrderToOpenMatching(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding' || !order.is1on1) return;
    if (order.bids && order.bids.length > 0) { showToast('이미 입찰서가 있는 의뢰입니다.', 'info'); return; }

    const formerTarget = order.targetPartner;
    order.is1on1 = false;
    order.targetPartner = null;
    if (formerTarget) {
        if (!order.excludedPartners) order.excludedPartners = [];
        if (!order.excludedPartners.includes(formerTarget)) order.excludedPartners.push(formerTarget);
    }

    const slotsNeeded = order.partnerCountLimit || 3;
    const excluded = new Set(order.excludedPartners || []);
    const candidates = (window.AppState.partners || []).filter(p => p.status === 'active' && !p.isPaused && !excluded.has(p.name) && !isPartnerBlockedByClient(p.name));
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, slotsNeeded);
    if (!order.bids) order.bids = [];
    selected.forEach(partner => {
        order.bids.push({
            partner: partner.name,
            price: Math.floor(order.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        });
    });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONVERT_TO_OPEN', `[${order.clientName}] 고객님이 의뢰(${orderCode})를 1:1 지정에서 오픈 매칭으로 전환했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') {
        selected.forEach(partner => pushPartnerNotification(partner.name, `오픈 매칭으로 전환된 오더(${orderCode})에 매칭되었어요. 고객: ${maskName(order.clientName)}님.`));
    }
    showToast(selected.length > 0 ? `오픈 매칭으로 전환되어 파트너사 ${selected.length}곳이 매칭되었습니다!` : '오픈 매칭으로 전환되었습니다. 현재 매칭 가능한 파트너사가 없어 추후 재매칭을 시도해 주세요.', 'success');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

function handleHome1on1Click() {
    const auth = window.AppState.clientAuth;
    const userOrders = window.AppState.orders.filter(o => auth.loggedIn && o.clientPhone === auth.phone);

    if (!auth.loggedIn || userOrders.length === 0) {
        showToast("1:1 지정 매칭은 먼저 간편 견적 신청(자동 매칭)을 완료하신 후 가능합니다.\n견적 신청 페이지로 이동합니다.", "warning");
        if (typeof switchPanel === 'function') switchPanel('client-panel');
        return;
    }
    showToast("작성하신 견적서를 바탕으로 1:1 지정 상담을 신청할\n우수 파트너사를 선택해 주세요.", "info");
    if (typeof switchPanel === 'function') switchPanel('partner-search-panel');
}

/* ----------------------------------------------------------------
 * 리뷰 작성 모달
 * ---------------------------------------------------------------- */
function openReviewWriteModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    window.AppState.reviewOrderTarget = orderCode;

    // 이미 후기를 작성한 오더면 기존 내용을 불러와 채운다(수정 모드) — 지금까지는
    // 한 번 등록하면 오타나 별점을 다시 고칠 방법이 전혀 없었다.
    const partner = window.AppState.partners.find(p => p.name === order.acceptedPartner);
    const existingReview = order.reviewWritten && partner ? (partner.reviews || []).find(r => r.orderCode === orderCode) : null;

    window.AppState.reviewPhotoDrafts = existingReview ? (existingReview.photos || []).slice() : [];
    window.AppState.activeReviewRating = existingReview ? existingReview.rating : 5;

    safeUpdateText('write-review-project-name', `프로젝트 번호: ${order.code} · ${order.acceptedPartner || ''}`);
    safeUpdateValue('input-review-text', existingReview ? existingReview.text : '');
    safeUpdateText('write-review-submit-btn-label', existingReview ? '후기 수정하기' : '후기 등록하기');
    renderReviewPhotoPreview();
    renderReviewRatingStars();

    const modal = document.getElementById('write-review-modal');
    const card = document.getElementById('write-review-modal-card');
    if (!modal || !card) return;
    modal.classList.remove('hidden');
    setTimeout(() => card.classList.add('modal-open'), 30);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeReviewWriteModal() {
    const modal = document.getElementById('write-review-modal');
    const card = document.getElementById('write-review-modal-card');
    if (!modal || !card) return;
    card.classList.remove('modal-open');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

/* 후기 작성 모달의 별점 입력 — 클릭한 별까지 채워서 보여주고 activeReviewRating에 반영한다.
 * (이전엔 입력 UI가 없어 모든 후기가 기본값 5점으로만 저장되던 문제를 고침) */
function renderReviewRatingStars() {
    const el = document.getElementById('review-rating-stars');
    if (!el) return;
    const rating = window.AppState.activeReviewRating || 5;
    el.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" onclick="setReviewRating(${n})" class="bg-transparent border-0 cursor-pointer p-0.5 leading-none ${n <= rating ? 'text-gold-500' : 'text-ink-200'}" aria-label="${n}점">★</button>`).join('');
}

function setReviewRating(n) {
    window.AppState.activeReviewRating = n;
    renderReviewRatingStars();
}

function renderReviewPhotoPreview() {
    const grid = document.getElementById('review-photo-preview-grid');
    if (!grid) return;
    const drafts = window.AppState.reviewPhotoDrafts || [];
    grid.innerHTML = drafts.map((src, idx) => `
        <div class="relative aspect-square rounded-xl overflow-hidden border border-ink-100 bg-ink-50">
            <img src="${src}" class="w-full h-full object-cover">
            <button type="button" onclick="removeReviewPhotoDraft(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-ink-950/70 text-white flex items-center justify-center" aria-label="사진 삭제"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removeReviewPhotoDraft(idx) {
    window.AppState.reviewPhotoDrafts.splice(idx, 1);
    renderReviewPhotoPreview();
}

function handleReviewPhotoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const remaining = 6 - window.AppState.reviewPhotoDrafts.length;
    if (input.files.length > remaining) showToast(`사진은 최대 6장까지 첨부할 수 있어요. (${input.files.length - remaining}장은 담기지 않았어요)`, 'warning');
    Array.from(input.files).slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            window.AppState.reviewPhotoDrafts.push(e.target.result);
            renderReviewPhotoPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function submitClientReview() {
    const orderCode = window.AppState.reviewOrderTarget;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    const textEl = document.getElementById('input-review-text');
    const text = textEl ? textEl.value.trim() : '';
    if (text.length < 10) { showToast("후기는 최소 10자 이상 작성해 주세요.", "warning"); return; }

    const partner = window.AppState.partners.find(p => p.name === order.acceptedPartner);
    const isEditing = order.reviewWritten;
    if (partner) {
        if (!partner.reviews) partner.reviews = [];
        const existingReview = isEditing ? partner.reviews.find(r => r.orderCode === orderCode) : null;
        if (existingReview) {
            existingReview.rating = window.AppState.activeReviewRating || 5;
            existingReview.text = text;
            existingReview.photos = window.AppState.reviewPhotoDrafts.slice();
            existingReview.editedDate = getLocalDateString();
        } else {
            partner.reviews.unshift({
                orderCode,
                client: (typeof maskName === 'function') ? maskName(order.clientName) : order.clientName,
                rating: window.AppState.activeReviewRating || 5,
                text: text,
                date: getLocalDateString(),
                photos: window.AppState.reviewPhotoDrafts.slice()
            });
        }
        const total = partner.reviews.reduce((acc, r) => acc + r.rating, 0);
        partner.rating = Math.round((total / partner.reviews.length) * 10) / 10;
    }

    const qualifiesForVoucher = !isEditing && text.length >= 50 && window.AppState.reviewPhotoDrafts.length >= 3;
    order.reviewWritten = true;
    window.AppState.reviewPhotoDrafts = [];

    if (qualifiesForVoucher && typeof grantClientBenefit === 'function') {
        grantClientBenefit(order.clientPhone, 'review_voucher', '완공 포토 후기 상품권', '10만원', orderCode);
    }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW', `${maskName(order.clientName)} 고객님이 [${order.acceptedPartner}]에 대한 안심 후기를 ${isEditing ? '수정' : '등록'}함.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 후기를 ${isEditing ? '수정했어요' : '남겼어요'}! (★ ${window.AppState.activeReviewRating || 5}.0)`);
    showToast(isEditing ? "후기가 수정되었습니다." : "소중한 안심 후기가 정상적으로 등록되었습니다. 감사합니다!", "success");

    closeReviewWriteModal();
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 커뮤니티 글/댓글은 본인이 직접 삭제할 수 있는데(deleteCommunityPost 등) 후기는
 * 관리자 모더레이션 삭제(adminDeleteReview)만 있고 고객 본인이 삭제할 방법이
 * 없었다 — 수정만 가능하고 철회는 불가능했던 비대칭을 해소한다. */
function deleteMyClientReview(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || !order.reviewWritten) return;
    const partner = window.AppState.partners.find(p => p.name === order.acceptedPartner);
    if (!partner || !partner.reviews) return;
    const idx = partner.reviews.findIndex(r => r.orderCode === orderCode);
    if (idx === -1) return;

    partner.reviews.splice(idx, 1);
    partner.rating = partner.reviews.length > 0
        ? Math.round((partner.reviews.reduce((acc, r) => acc + r.rating, 0) / partner.reviews.length) * 10) / 10
        : 5.0;
    order.reviewWritten = false;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW_DELETE', `${maskName(order.clientName)} 고객님이 [${order.acceptedPartner}]에 대한 안심 후기를 삭제함.`, 'INFO');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 남기셨던 후기를 삭제했어요.`);
    showToast('후기를 삭제했습니다.', 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* "안심 계약" 문구가 계약서 등록·서명을 계속 언급하지만(renderMyPageEstimateDetails의
 * contractDocsHtml 문구, clientFinalizeContract의 안내문 등), 실제 서명 기능은
 * clearSignatureCanvas/submitSignatureCanvas가 빈 스텁이고 서명판 UI 자체가 없어서
 * "서명"을 눌러도 아무 일도 일어나지 않았다 — 캔버스에 실제로 그림을 그려 저장하는
 * 최소한의 전자서명을 구현한다. */
const _signaturePads = {};

function initSignatureCanvas(orderCode) {
    const canvas = document.getElementById(`signature-canvas-${orderCode}`);
    if (!canvas || canvas.dataset.initialized) return;
    canvas.dataset.initialized = 'true';
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    _signaturePads[orderCode] = { hasInk: false };

    let drawing = false;
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const point = e.touches ? e.touches[0] : e;
        return {
            x: (point.clientX - rect.left) * (canvas.width / rect.width),
            y: (point.clientY - rect.top) * (canvas.height / rect.height)
        };
    };
    const start = (e) => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        _signaturePads[orderCode].hasInk = true;
    };
    const end = (e) => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', move);
    canvas.addEventListener('touchend', end);
}

function clearSignatureCanvas(orderCode) {
    const canvas = document.getElementById(`signature-canvas-${orderCode}`);
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (_signaturePads[orderCode]) _signaturePads[orderCode].hasInk = false;
}

function submitSignatureCanvas(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    const canvas = document.getElementById(`signature-canvas-${orderCode}`);
    if (!canvas || !_signaturePads[orderCode] || !_signaturePads[orderCode].hasInk) {
        showToast('서명란에 서명을 먼저 입력해 주세요.', 'warning');
        return;
    }

    order.clientSigned = true;
    order.signedDate = getLocalDateString();
    order.signatureImage = canvas.toDataURL('image/png');

    if (order.clientSigned && order.partnerSigned && typeof grantClientBenefit === 'function') {
        grantClientBenefit(order.clientPhone, 'warranty_coupon', '3년 하자이행보증 무상 쿠폰', '하자보수 무상 보증', order.code);
    }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONTRACT_SIGN', `${maskName(order.clientName)} 고객님이 계약(${order.code}) 합의서에 전자서명을 완료했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 계약(${order.code}) 합의서에 서명을 완료했어요.`);
    showToast('서명이 완료되었습니다.', 'success');
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
}

/* ----------------------------------------------------------------
 * 커뮤니티 — 인테리어 팁 공유 / 자유 이야기 / Q&A 게시판
 * 글쓰기·좋아요·댓글은 고객 로그인이 필요하고, 목록·상세 열람은 누구나 가능하다.
 * ---------------------------------------------------------------- */
const COMMUNITY_CATEGORIES = { tip: '인테리어 팁', talk: '자유 이야기', qna: 'Q&A', housewarming: '집들이' };
let communityActiveCategory = 'all';
let communityPhotoDrafts = [];
/* 글쓰기 폼을 새 글 작성과 수정에 동시에 재사용하기 위한 대상 id — null이면 새 글,
 * 값이 있으면 해당 글을 수정하는 중임을 뜻한다 (openCommunityEdit/submitCommunityPost 참고). */
let communityEditTargetId = null;

/* "완공 포토 후기 페스티벌" 등 이벤트 문구에서 '베스트'가 반복 언급되지만
 * (config_state.js), 실제로는 좋아요 수 하나만 보는 인기순 정렬 외에 그 어떤
 * 순위/배지 개념도 없었다 — 조회수를 새로 추적하고, 최근 7일간 참여도
 * (좋아요·댓글·조회 가중합)가 높은 상위 글에 베스트 배지를 부여한다. */
function getWeeklyBestPostIds() {
    const posts = window.AppState.communityPosts || [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return posts
        .filter(p => new Date(p.date) >= weekAgo)
        .map(p => ({ id: p.id, score: (p.likedBy || []).length * 3 + (p.comments || []).length * 2 + (p.views || 0) }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(p => p.id);
}

function renderCommunityList() {
    const tabsEl = document.getElementById('community-category-tabs');
    if (tabsEl) {
        const cats = [['all', '전체'], ...Object.entries(COMMUNITY_CATEGORIES)];
        tabsEl.innerHTML = cats.map(([id, label]) =>
            `<button type="button" onclick="setCommunityCategory('${id}')" class="gnb-tab ${communityActiveCategory === id ? 'active' : ''}">${label}</button>`
        ).join('');
    }

    document.getElementById('community-list-subview')?.classList.remove('hidden');
    document.getElementById('community-detail-subview')?.classList.add('hidden');
    document.getElementById('community-write-subview')?.classList.add('hidden');

    const listEl = document.getElementById('community-post-list');
    if (!listEl) return;

    const searchInput = document.getElementById('community-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const sortSelect = document.getElementById('community-sort-select');
    const sortMode = sortSelect ? sortSelect.value : 'latest';

    const posts = (window.AppState.communityPosts || [])
        .filter(p => communityActiveCategory === 'all' || p.category === communityActiveCategory)
        .filter(p => !query || p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query))
        .filter(p => !isCommunityUserBlockedByMe(p.authorId))
        .slice()
        .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || (sortMode === 'popular'
            ? (b.likedBy || []).length - (a.likedBy || []).length || new Date(b.date) - new Date(a.date)
            : new Date(b.date) - new Date(a.date)));

    if (posts.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-ink-400 font-bold py-12 text-center">${query ? '검색 결과가 없습니다.' : '등록된 글이 없습니다. 첫 번째 글을 남겨보세요!'}</p>`;
        return;
    }

    const bestIds = new Set(getWeeklyBestPostIds());
    listEl.innerHTML = posts.map(p => `
        <div class="surface-flat p-5 flex items-start justify-between gap-4 hover:border-ink-300 transition-all cursor-pointer text-left ${p.isPinned ? 'border border-gold-300' : ''}" onclick="openCommunityDetail('${p.id}')">
            ${p.images && p.images.length > 0 ? `<img src="${p.images[0]}" class="w-16 h-16 rounded-xl object-cover shrink-0 border border-ink-100">` : ''}
            <div class="space-y-1.5 flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    ${p.isPinned ? `<span class="badge badge-gold"><i data-lucide="pin" class="w-2.5 h-2.5"></i> 공지</span>` : ''}
                    ${bestIds.has(p.id) ? `<span class="badge badge-gold"><i data-lucide="award" class="w-2.5 h-2.5"></i> 이번 주 베스트</span>` : ''}
                    <span class="badge badge-brand">${COMMUNITY_CATEGORIES[p.category] || '자유 이야기'}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${p.date}</span>
                </div>
                <h4 class="text-sm font-black text-ink-950 truncate">${escapeHtml(p.title)}</h4>
                <p class="text-xs text-ink-500 font-medium truncate">${escapeHtml(p.authorName)}</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 text-[11px] text-ink-400 font-bold shrink-0">
                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${(p.likedBy || []).length}</span>
                <span class="flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3"></i> ${(p.comments || []).length}</span>
                <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> ${p.views || 0}</span>
            </div>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setCommunityCategory(cat) {
    communityActiveCategory = cat;
    renderCommunityList();
}

/* 열려 있는 대댓글 입력창들을 '${postId}-${commentIndex}' 키 집합으로 추적한다.
 * (예전엔 변수 하나였어서 답글창이 한 번에 하나만 열렸음 — 여러 댓글에 동시에 답글을 달 수 있도록 Set으로 변경) */
let openReplyBoxKeys = new Set();

/* 게시글 본문은 수정이 가능한데(openCommunityEdit) 댓글/대댓글은 삭제만 가능해서
 * 오타 하나로도 지우고 새로 달아야 했던 비대칭을 해소 — 답글창과 동일한 Set 패턴으로
 * 인라인 수정 입력창의 열림 상태를 추적한다. */
let openCommentEditKeys = new Set();
let openReplyEditKeys = new Set();

function toggleReplyBox(postId, commentIndex) {
    const isPartnerViewer = window.AppState.partnerLoggedIn && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn);
    if (!isPartnerViewer && !requireClientLoginForCommunity()) return;
    const key = `${postId}-${commentIndex}`;
    if (openReplyBoxKeys.has(key)) openReplyBoxKeys.delete(key);
    else openReplyBoxKeys.add(key);
    openCommunityDetail(postId);
}

/* 댓글 CRUD 대칭(ed8080b)을 대댓글에도 마저 적용한다 — 파트너가 자신의 전문가
 * 답변 아래 달린 후속 질문에 직접 답하거나(대댓글 작성), 자기 대댓글을
 * 수정/삭제할 방법이 전혀 없었다. */
function submitCommunityReply(postId, commentIndex) {
    const isPartnerReply = window.AppState.partnerLoggedIn && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn);
    if (!isPartnerReply && !requireClientLoginForCommunity()) return;
    const input = document.getElementById(`community-reply-input-${commentIndex}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('답글 내용을 입력해 주세요.', 'warning'); return; }

    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    const comment = post.comments[commentIndex];
    if (!comment.replies) comment.replies = [];

    if (isPartnerReply) {
        const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
        comment.replies.push({ authorName: partnerName, authorId: `partner:${partnerName}`, authorType: 'partner', text, date: getLocalDateString() });
        if (typeof pushLog === 'function') pushLog('PARTNER', 'COMMUNITY_REPLY', `[${partnerName}]가 대댓글을 남겼습니다.`, 'INFO');
    } else {
        const auth = window.AppState.clientAuth;
        comment.replies.push({ authorName: auth.name, authorId: auth.id, text, date: getLocalDateString() });
        if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_REPLY', `'${auth.name}' 고객님이 대댓글을 남겼습니다.`, 'INFO');
    }

    openReplyBoxKeys.delete(`${postId}-${commentIndex}`);
    openCommunityDetail(postId);
}

/* 본인이 쓴 댓글/답글만 삭제할 수 있다 — 목록에서도 authorId가 내 아이디일 때만
 * 삭제 버튼을 그려서, 서버 검증이 없는 프로토타입이라도 실수로 남의 글을 지울 방법이 없게 한다. */
function deleteCommunityComment(postId, commentIndex) {
    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    const myPartnerCommentId = window.AppState.partnerLoggedIn ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : null;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    const authorId = post.comments[commentIndex].authorId;
    if (authorId !== myId && authorId !== myPartnerCommentId) return;
    post.comments.splice(commentIndex, 1);
    // openReplyBoxKeys는 '게시글id-댓글인덱스'로 답글창 열림 상태를 기억하는데, 댓글이 하나
    // 지워지면 뒤에 있던 댓글들의 인덱스가 한 칸씩 앞으로 밀린다. 이 상태를 그대로 두면
    // 엉뚱한(밀려난) 댓글에 답글창이 열려있는 것처럼 보일 수 있어, 이 글의 답글창 열림
    // 상태를 전부 초기화한다.
    Array.from(openReplyBoxKeys).forEach(key => { if (key.startsWith(`${postId}-`)) openReplyBoxKeys.delete(key); });
    showToast('댓글을 삭제했습니다.', 'info');
    openCommunityDetail(postId);
}

/* Q&A 게시판(post.category === 'qna')에 댓글 작성/수정/삭제/신고는 다 있는데,
 * 질문 작성자가 어떤 답변이 도움이 됐는지 표시할 방법이 없었다 — 게시글 작성자만,
 * qna 카테고리 글에서만, 한 번에 하나의 댓글만 채택할 수 있게 한다(다시 누르면
 * 채택 취소). */
function toggleCommunityAcceptedAnswer(postId, commentIndex) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!post || !comment || post.category !== 'qna' || post.authorId !== auth.id) return;

    const wasAccepted = !!comment.accepted;
    post.comments.forEach(c => { c.accepted = false; });
    if (!wasAccepted) {
        comment.accepted = true;
        if (comment.authorType === 'partner') {
            if (typeof pushPartnerNotification === 'function') pushPartnerNotification(comment.authorName, `작성하신 전문가 답변이 "${post.title}" 글의 채택 답변으로 선정되었어요!`);
        } else if (comment.authorId && comment.authorId !== auth.id) {
            const authorAccount = (window.AppState.clientAccounts || []).find(a => a.id === comment.authorId);
            if (authorAccount && authorAccount.phone && typeof pushClientNotification === 'function') {
                pushClientNotification(authorAccount.phone, `작성하신 댓글이 "${post.title}" 글의 채택 답변으로 선정되었어요!`);
            }
        }
        showToast('답변을 채택했습니다.', 'success');
    } else {
        showToast('채택을 취소했습니다.', 'info');
    }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'QNA_ACCEPT_ANSWER', `[${auth.name}] 고객님이 Q&A 글("${post.title}")의 답변을 ${wasAccepted ? '채택 취소' : '채택'}했습니다.`, 'INFO');
    openCommunityDetail(postId);
}

function deleteCommunityReply(postId, commentIndex, replyIndex) {
    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    const myPartnerCommentId = window.AppState.partnerLoggedIn ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : null;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment || !comment.replies || !comment.replies[replyIndex]) return;
    const authorId = comment.replies[replyIndex].authorId;
    if (authorId !== myId && authorId !== myPartnerCommentId) return;
    comment.replies.splice(replyIndex, 1);
    showToast('답글을 삭제했습니다.', 'info');
    openCommunityDetail(postId);
}

function toggleCommentEdit(postId, commentIndex) {
    const key = `${postId}-${commentIndex}`;
    if (openCommentEditKeys.has(key)) openCommentEditKeys.delete(key);
    else openCommentEditKeys.add(key);
    openCommunityDetail(postId);
}

function saveCommunityCommentEdit(postId, commentIndex) {
    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    const myPartnerCommentId = window.AppState.partnerLoggedIn ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : null;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment || (comment.authorId !== myId && comment.authorId !== myPartnerCommentId)) return;

    const input = document.getElementById(`community-comment-edit-input-${commentIndex}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('댓글 내용을 입력해 주세요.', 'warning'); return; }

    comment.text = text;
    comment.edited = true;
    openCommentEditKeys.delete(`${postId}-${commentIndex}`);
    showToast('댓글을 수정했습니다.', 'success');
    openCommunityDetail(postId);
}

function toggleReplyEdit(postId, commentIndex, replyIndex) {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    if (openReplyEditKeys.has(key)) openReplyEditKeys.delete(key);
    else openReplyEditKeys.add(key);
    openCommunityDetail(postId);
}

function saveCommunityReplyEdit(postId, commentIndex, replyIndex) {
    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    const myPartnerCommentId = window.AppState.partnerLoggedIn ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : null;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    const reply = comment && comment.replies && comment.replies[replyIndex];
    if (!reply || (reply.authorId !== myId && reply.authorId !== myPartnerCommentId)) return;

    const input = document.getElementById(`community-reply-edit-input-${commentIndex}-${replyIndex}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('답글 내용을 입력해 주세요.', 'warning'); return; }

    reply.text = text;
    reply.edited = true;
    openReplyEditKeys.delete(`${postId}-${commentIndex}-${replyIndex}`);
    showToast('답글을 수정했습니다.', 'success');
    openCommunityDetail(postId);
}

/* 매니저 콘솔 > 커뮤니티 관리 — 지금까지는 글쓴이 본인만 자기 글/댓글/답글을 지울 수
 * 있어서, 부적절하거나 신고 대상인 게시물이 올라와도 관리자가 대응할 방법이 전혀
 * 없었다. 소유권 검증 없이(관리자 권한이므로) 어떤 게시물/댓글/답글이든 삭제한다. */
function renderAdminCommunityModeration() {
    const container = document.getElementById('admin-community-post-list');
    if (!container) return;
    const query = (document.getElementById('admin-community-search-input')?.value || '').trim().toLowerCase();

    const posts = (window.AppState.communityPosts || [])
        .filter(p => !query || p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query) || p.authorName.toLowerCase().includes(query))
        .slice().sort((a, b) => ((b.reportedBy || []).length - (a.reportedBy || []).length) || (new Date(b.date) - new Date(a.date)));

    if (posts.length === 0) {
        container.innerHTML = buildEmptyStateHtml('message-square', query ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = posts.map(post => {
        const commentsHtml = (post.comments || []).length > 0
            ? post.comments.slice().map((c, cIdx) => ({ c, cIdx })).sort((a, b) => ((b.c.reportedBy || []).length - (a.c.reportedBy || []).length)).map(({ c, cIdx }) => {
                const repliesHtml = (c.replies || []).length > 0
                    ? `<div class="ml-5 pl-3 border-l-2 border-ink-200 space-y-1.5 mt-1.5">${c.replies.map((r, rIdx) => {
                        const rReportCount = (r.reportedBy || []).length;
                        return `
                        <div class="flex justify-between items-start gap-2 text-[11px]">
                            <p class="text-ink-600 font-medium leading-relaxed"><b class="text-ink-800">${escapeHtml(r.authorName)}</b> ${escapeHtml(r.text)} ${rReportCount > 0 ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${rReportCount}건</span>` : ''}</p>
                            <div class="flex items-center gap-2 shrink-0">
                                ${rReportCount > 0 ? `<button type="button" onclick="dismissCommunityReplyReport('${post.id}', ${cIdx}, ${rIdx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>` : ''}
                                <button type="button" onclick="adminDeleteCommunityReply('${post.id}', ${cIdx}, ${rIdx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                            </div>
                        </div>
                        ${buildReportReasonsHtml(r.reportReasons)}`;
                    }).join('')}</div>` : '';
                const cReportCount = (c.reportedBy || []).length;
                return `
                    <div class="p-2.5 bg-ink-50 rounded-lg ${cReportCount > 0 ? 'border border-rose-200' : ''}">
                        <div class="flex justify-between items-start gap-2 text-[11px]">
                            <p class="text-ink-700 font-medium leading-relaxed"><b class="text-ink-900">${escapeHtml(c.authorName)}</b> ${escapeHtml(c.text)} ${cReportCount > 0 ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${cReportCount}건</span>` : ''}</p>
                            <div class="flex items-center gap-2 shrink-0">
                                ${cReportCount > 0 ? `<button type="button" onclick="dismissCommunityCommentReport('${post.id}', ${cIdx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>` : ''}
                                <button type="button" onclick="adminDeleteCommunityComment('${post.id}', ${cIdx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                            </div>
                        </div>
                        ${buildReportReasonsHtml(c.reportReasons)}
                        ${repliesHtml}
                    </div>`;
            }).join('')
            : '';

        const reportCount = (post.reportedBy || []).length;
        return `
        <div class="surface p-4 space-y-2.5 text-left ${reportCount > 0 ? 'border border-rose-200' : ''}">
            <div class="flex justify-between items-start gap-3">
                <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2 text-[10px] font-bold text-ink-400">
                        <span class="badge badge-brand">${COMMUNITY_CATEGORIES[post.category] || '자유 이야기'}</span>
                        <span>${post.date} · ${escapeHtml(post.authorName)}</span>
                        ${post.isPinned ? `<span class="badge badge-gold"><i data-lucide="pin" class="w-2.5 h-2.5"></i> 공지 고정</span>` : ''}
                        ${reportCount > 0 ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${reportCount}건</span>` : ''}
                    </div>
                    <h5 class="text-sm font-black text-ink-950">${escapeHtml(post.title)}</h5>
                    <p class="text-xs text-ink-600 font-medium leading-relaxed line-clamp-2">${escapeHtml(post.content)}</p>
                    ${buildReportReasonsHtml(post.reportReasons)}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="toggleCommunityPostPin('${post.id}')" class="btn btn-secondary btn-sm">${post.isPinned ? '고정 해제' : '상단 고정'}</button>
                    ${reportCount > 0 ? `<button type="button" onclick="dismissCommunityPostReport('${post.id}')" class="btn btn-secondary btn-sm">신고 반려</button>` : ''}
                    <button type="button" onclick="adminDeleteCommunityPost('${post.id}')" class="btn btn-secondary btn-sm text-roseCustom">글 삭제</button>
                </div>
            </div>
            ${commentsHtml ? `<div class="space-y-1.5 pt-2 border-t border-ink-100">${commentsHtml}</div>` : ''}
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 커뮤니티에 공지/안내 글을 올려도 다른 글들 사이에 묻혀 며칠 지나면 목록 아래로
 * 밀려났다 — 네이버 카페/밴드의 "공지 고정"과 동일하게, 관리자가 특정 글을 상단에
 * 고정해 계속 눈에 띄게 할 방법이 전혀 없던 공백을 해소한다. */
function toggleCommunityPostPin(postId) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    post.isPinned = !post.isPinned;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_MODERATE', `[커뮤니티 관리] 게시글 "${post.title}"을 ${post.isPinned ? '상단 고정' : '고정 해제'}함.`, 'INFO');
    showToast(post.isPinned ? '게시글을 상단에 고정했습니다.' : '고정을 해제했습니다.', 'success');
    renderAdminCommunityModeration();
}

/* 후기·시공사례 삭제 이의신청과 동일한 비대칭이 커뮤니티 게시글에도 있었다 —
 * 삭제되면 신고자에게는 알림이 가지만(notifyReportResolved) 작성자 본인은 자기
 * 글이 지워진 사실조차 알 방법이 없었고 소명할 방법도 없었다. 삭제 시 스냅샷을
 * communityDeletionLog에 남겨 작성자가 이의신청을 제출하면 관리자가 승인(복원)
 * 또는 반려할 수 있게 한다. */
function adminDeleteCommunityPost(postId) {
    const idx = (window.AppState.communityPosts || []).findIndex(p => p.id === postId);
    if (idx === -1) return;
    const post = window.AppState.communityPosts[idx];
    const reportedBy = post.reportedBy;
    window.AppState.communityPosts.splice(idx, 1);

    logCommunityDeletionAppealable('post', '게시글', post.title, post.authorId, post.authorName, { postSnapshot: post });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_MODERATE', `[커뮤니티 관리] 게시글(${postId})을 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 게시글이 검토 후 삭제 처리되었습니다.`);
    showToast('게시글을 삭제했습니다.', 'info');
    renderAdminCommunityModeration();
}

/* 후기 삭제 이의신청 승인(adminApproveReviewDeletionAppeal, partner_panel.js)과
 * 동일하게, 스냅샷을 그대로 되돌려 복원한다 — type에 따라 복원 대상 컨테이너만
 * 다르다(게시글→communityPosts, 댓글→해당 게시글의 comments, 답글→해당 댓글의
 * replies). 원래 배열 위치는 의미가 없으므로 맨 위/끝에 다시 올린다. */
function adminApproveCommunityDeletionAppeal(logId) {
    const entry = (window.AppState.communityDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;

    if (entry.type === 'reply') {
        /* 답글의 부모 댓글이 그 사이 함께 삭제됐다면(commentRef가 postRef.comments에서
         * 이미 떨어져 나간 상태) 답글을 되돌릴 자리가 없다 — 내용을 잃지 않도록
         * 게시글의 일반 댓글로 대신 복원한다. */
        const parentStillAttached = (entry.postRef.comments || []).includes(entry.commentRef);
        if (parentStillAttached) {
            if (!entry.commentRef.replies) entry.commentRef.replies = [];
            entry.commentRef.replies.push(entry.replySnapshot);
        } else {
            if (!entry.postRef.comments) entry.postRef.comments = [];
            entry.postRef.comments.push(entry.replySnapshot);
        }
    } else if (entry.type === 'comment') {
        if (!entry.postRef.comments) entry.postRef.comments = [];
        entry.postRef.comments.push(entry.commentSnapshot);
    } else {
        if (!window.AppState.communityPosts) window.AppState.communityPosts = [];
        window.AppState.communityPosts.unshift(entry.postSnapshot);
    }
    window.AppState.communityDeletionLog = window.AppState.communityDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_DELETION_APPEAL_APPROVE', `[이의신청 승인] ${entry.typeLabelKo} "${entry.contentPreview}"을 재검토하여 복원했습니다.`, 'SUCCESS');
    const authorAccount = (window.AppState.clientAccounts || []).find(a => a.id === entry.authorId);
    if (authorAccount && authorAccount.phone && typeof pushClientNotification === 'function') pushClientNotification(authorAccount.phone, `제출하신 이의신청이 승인되어 삭제됐던 ${entry.typeLabelKo}이 복원되었습니다.`);
    showToast(`${entry.typeLabelKo}을 복원했습니다.`, 'success');
    if (typeof renderAdminCommunityModeration === 'function') renderAdminCommunityModeration();
    if (typeof renderAdminAppealInbox === 'function') renderAdminAppealInbox();
}

function adminRejectCommunityDeletionAppeal(logId, reason) {
    const entry = (window.AppState.communityDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_DELETION_APPEAL_REJECT', `[이의신청 반려] ${entry.typeLabelKo} "${entry.contentPreview}" 삭제 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    const authorAccount = (window.AppState.clientAccounts || []).find(a => a.id === entry.authorId);
    if (authorAccount && authorAccount.phone && typeof pushClientNotification === 'function') pushClientNotification(authorAccount.phone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
    if (typeof renderAdminAppealInbox === 'function') renderAdminAppealInbox();
}

/* 게시글 삭제 이의신청과 동일한 비대칭이 댓글·답글에도 그대로 있다 — 작성자가
 * 파트너(authorId가 'partner:'로 시작)인 경우는 client_panel의 이의신청 체계
 * 대상이 아니므로 로그를 남기지 않는다(향후 파트너용 소명 기능은 별도 과제). */
function logCommunityDeletionAppealable(type, typeLabelKo, contentPreview, authorId, authorName, extra) {
    if (!authorId || String(authorId).startsWith('partner:')) return;
    if (!window.AppState.communityDeletionLog) window.AppState.communityDeletionLog = [];
    const logEntry = Object.assign({ id: `cdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type, typeLabelKo, contentPreview, authorId, authorName, date: getLocalDateString(), appeal: null }, extra);
    window.AppState.communityDeletionLog.unshift(logEntry);
    const authorAccount = (window.AppState.clientAccounts || []).find(a => a.id === authorId);
    if (authorAccount && authorAccount.phone && typeof pushClientNotification === 'function') pushClientNotification(authorAccount.phone, `작성하신 ${typeLabelKo}이 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 마이페이지에서 소명하실 수 있어요.`);
}

function adminDeleteCommunityComment(postId, commentIndex) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    const comment = post.comments[commentIndex];
    const reportedBy = comment.reportedBy;
    post.comments.splice(commentIndex, 1);
    logCommunityDeletionAppealable('comment', '댓글', comment.text, comment.authorId, comment.authorName, { postRef: post, commentSnapshot: comment });
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_MODERATE', `[커뮤니티 관리] 게시글(${postId})의 댓글을 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 댓글이 검토 후 삭제 처리되었습니다.`);
    showToast('댓글을 삭제했습니다.', 'info');
    renderAdminCommunityModeration();
}

function adminDeleteCommunityReply(postId, commentIndex, replyIndex) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment || !comment.replies || !comment.replies[replyIndex]) return;
    const reply = comment.replies[replyIndex];
    const reportedBy = reply.reportedBy;
    comment.replies.splice(replyIndex, 1);
    logCommunityDeletionAppealable('reply', '답글', reply.text, reply.authorId, reply.authorName, { postRef: post, commentRef: comment, replySnapshot: reply });
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_MODERATE', `[커뮤니티 관리] 게시글(${postId})의 답글을 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 답글이 검토 후 삭제 처리되었습니다.`);
    showToast('답글을 삭제했습니다.', 'info');
    renderAdminCommunityModeration();
}

/* 신고를 검토한 뒤 실제 위반이 아니라고 판단하면 콘텐츠를 지우지 않고 신고만
 * 종료할 방법이 지금까지 없었다 — 계약 취소 심사(approve/reject)와 동일한 승인/반려
 * 대칭 구조를 게시글/댓글/답글 신고 처리에도 적용한다. */
function dismissCommunityPostReport(postId) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.reportedBy || post.reportedBy.length === 0) return;
    const reportedBy = post.reportedBy;
    post.reportedBy = [];
    post.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_REPORT_DISMISS', `[커뮤니티 관리] 게시글(${postId}) 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 게시글을 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 게시글은 그대로 유지됩니다.', 'info');
    renderAdminCommunityModeration();
}

function dismissCommunityCommentReport(postId, commentIndex) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment || !comment.reportedBy || comment.reportedBy.length === 0) return;
    const reportedBy = comment.reportedBy;
    comment.reportedBy = [];
    comment.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_REPORT_DISMISS', `[커뮤니티 관리] 게시글(${postId})의 댓글 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 댓글을 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 댓글은 그대로 유지됩니다.', 'info');
    renderAdminCommunityModeration();
}

function dismissCommunityReplyReport(postId, commentIndex, replyIndex) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    const reply = comment && comment.replies && comment.replies[replyIndex];
    if (!reply || !reply.reportedBy || reply.reportedBy.length === 0) return;
    const reportedBy = reply.reportedBy;
    reply.reportedBy = [];
    reply.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMUNITY_REPORT_DISMISS', `[커뮤니티 관리] 게시글(${postId})의 답글 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 커뮤니티 답글을 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 답글은 그대로 유지됩니다.', 'info');
    renderAdminCommunityModeration();
}

/* 댓글/답글 삭제는 있었지만 정작 글 작성자 본인이 자기 글(게시물)은 지울 방법이
 * 없었던 기능 공백을 메운다 — 댓글/답글과 동일하게 authorId 소유권 검증 후 목록에서
 * 제거한다. */
function deleteCommunityPost(postId) {
    const auth = window.AppState.clientAuth;
    const idx = (window.AppState.communityPosts || []).findIndex(p => p.id === postId);
    if (idx === -1) return;
    if (window.AppState.communityPosts[idx].authorId !== auth.id) return;
    window.AppState.communityPosts.splice(idx, 1);
    showToast('게시글을 삭제했습니다.', 'info');
    closeCommunityDetail();
}

/* 부적절한 게시글을 발견해도 신고할 방법이 없어서, 관리자가 커뮤니티 관리 탭
 * (renderAdminCommunityModeration)에서 모든 글을 처음부터 끝까지 훑어야만
 * 문제 게시물을 찾을 수 있었다. 신고하면 관리자 목록에서 신고 배지가 뜨고
 * 신고 많은 순으로 정렬되어 우선 검토할 수 있게 된다. 같은 사용자의 중복
 * 신고는 막는다(reportedBy로 추적). */
function reportCommunityPost(postId, reason) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    if (!post.reportedBy) post.reportedBy = [];
    if (post.reportedBy.includes(auth.id)) { showToast('이미 신고한 게시글입니다.', 'info'); return; }
    post.reportedBy.push(auth.id);
    if (reason) { if (!post.reportReasons) post.reportReasons = []; post.reportReasons.push({ id: auth.id, reason }); }
    if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_REPORT', `'${auth.name}' 고객님이 게시글(${postId})을 신고했습니다. (누적 신고 ${post.reportedBy.length}건)${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    openCommunityDetail(postId);
}

/* 특정 게시글 신고(reportCommunityPost)는 있는데, 특정 사용자가 반복적으로 불편한
 * 글을 올려도 그 사람 글 전체를 안 보이게 할 방법이 전혀 없었다 — 즐겨찾기
 * 파트너와 동일하게 내 계정에 blockedUsers 배열을 두고, 커뮤니티 목록 렌더링에서
 * 차단한 작성자의 글을 걸러낸다(삭제가 아니라 내 화면에서만 숨김).*/
function isCommunityUserBlockedByMe(authorId) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn || !authorId) return false;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    return !!(account && account.blockedUsers && account.blockedUsers.includes(authorId));
}

/* 게시글은 신고할 수 있는데(reportCommunityPost) 댓글/답글은 본인 것만 수정·삭제할
 * 수 있고 타인의 악성 댓글·답글을 신고할 방법이 없었다 — 동일한 1인 1회 reportedBy
 * 배열 패턴을 댓글/답글 각각에 적용한다. */
function isCommunityCommentReportedByMe(comment) {
    if (window.AppState.partnerLoggedIn) {
        const partnerId = `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}`;
        return !!(comment.reportedBy && comment.reportedBy.includes(partnerId));
    }
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    return !!(comment.reportedBy && comment.reportedBy.includes(auth.id));
}

function reportCommunityComment(postId, commentIndex, reason) {
    const isPartnerReporter = window.AppState.partnerLoggedIn && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn);
    if (!isPartnerReporter && !requireClientLoginForCommunity()) return;
    const reporterId = isPartnerReporter ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : window.AppState.clientAuth.id;
    const reporterName = isPartnerReporter ? (window.AppState.partnerName || '오륙도 디자인 실내건축') : window.AppState.clientAuth.name;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment) return;
    if (!comment.reportedBy) comment.reportedBy = [];
    if (comment.reportedBy.includes(reporterId)) { showToast('이미 신고한 댓글입니다.', 'info'); return; }
    comment.reportedBy.push(reporterId);
    if (reason) { if (!comment.reportReasons) comment.reportReasons = []; comment.reportReasons.push({ id: reporterId, reason }); }
    if (typeof pushLog === 'function') pushLog(isPartnerReporter ? 'PARTNER' : 'CLIENT', 'COMMUNITY_COMMENT_REPORT', `'${reporterName}'가 댓글(작성자: ${comment.authorName})을 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    openCommunityDetail(postId);
}

function reportCommunityReply(postId, commentIndex, replyIndex, reason) {
    const isPartnerReporter = window.AppState.partnerLoggedIn && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn);
    if (!isPartnerReporter && !requireClientLoginForCommunity()) return;
    const reporterId = isPartnerReporter ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : window.AppState.clientAuth.id;
    const reporterName = isPartnerReporter ? (window.AppState.partnerName || '오륙도 디자인 실내건축') : window.AppState.clientAuth.name;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    const reply = comment && comment.replies && comment.replies[replyIndex];
    if (!reply) return;
    if (!reply.reportedBy) reply.reportedBy = [];
    if (reply.reportedBy.includes(reporterId)) { showToast('이미 신고한 답글입니다.', 'info'); return; }
    reply.reportedBy.push(reporterId);
    if (reason) { if (!reply.reportReasons) reply.reportReasons = []; reply.reportReasons.push({ id: reporterId, reason }); }
    if (typeof pushLog === 'function') pushLog(isPartnerReporter ? 'PARTNER' : 'CLIENT', 'COMMUNITY_REPLY_REPORT', `'${reporterName}'가 답글(작성자: ${reply.authorName})을 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    openCommunityDetail(postId);
}

function toggleBlockCommunityUser(authorId, authorName, postId) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    if (authorId === auth.id) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if (!account.blockedUsers) account.blockedUsers = [];
    const idx = account.blockedUsers.indexOf(authorId);
    if (idx >= 0) { account.blockedUsers.splice(idx, 1); showToast(`[${authorName}]님을 차단 해제했습니다.`, 'info'); }
    else {
        account.blockedUsers.push(authorId);
        if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_BLOCK', `'${auth.name}' 고객님이 '${authorName}'님을 커뮤니티에서 차단했습니다.`, 'INFO');
        showToast(`[${authorName}]님을 차단했습니다. 이 사용자의 글이 더 이상 보이지 않아요.`, 'success');
    }
    if (postId) openCommunityDetail(postId); else renderCommunityList();
    renderBlockedUsersList();
}

function openCommunityDetail(postId) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    post.views = (post.views || 0) + 1;

    document.getElementById('community-list-subview')?.classList.add('hidden');
    document.getElementById('community-write-subview')?.classList.add('hidden');
    document.getElementById('community-detail-subview')?.classList.remove('hidden');

    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    /* Q&A 전문가 답변(submitCommunityComment의 isPartnerAnswer)을 "수정/삭제/신고
     * 대상은 되지 않는 최소 범위"로 남겨뒀던 것을 마저 채운다 — 파트너 자신의 답변도
     * 고객 댓글과 동일하게 수정/삭제할 수 있고, 남의 댓글엔 신고도 할 수 있게 한다. */
    const myPartnerCommentId = window.AppState.partnerLoggedIn ? `partner:${window.AppState.partnerName || '오륙도 디자인 실내건축'}` : null;
    const viewerCommentId = myId || myPartnerCommentId;
    const liked = !!(myId && (post.likedBy || []).includes(myId));

    const commentsHtml = (post.comments || []).length > 0
        ? post.comments.map((c, idx) => {
            const repliesHtml = (c.replies || []).length > 0
                ? `<div class="mt-2 ml-5 pl-3 border-l-2 border-ink-200 space-y-2">${c.replies.map((r, rIdx) => {
                    const isReplyEditing = openReplyEditKeys.has(`${post.id}-${idx}-${rIdx}`);
                    return `
                    <div class="space-y-0.5">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-black text-ink-800 flex items-center gap-1">${escapeHtml(r.authorName)}${r.authorType === 'partner' ? `<span class="badge badge-brand"><i data-lucide="badge-check" class="w-2.5 h-2.5"></i> 전문가</span>` : ''}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] text-ink-400 font-bold">${r.date}${r.edited ? ' (수정됨)' : ''}</span>
                                ${viewerCommentId && r.authorId === viewerCommentId ? `
                                <button type="button" onclick="toggleReplyEdit('${post.id}', ${idx}, ${rIdx})" class="text-[10px] font-bold text-ink-300 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">${isReplyEditing ? '취소' : '수정'}</button>
                                <button type="button" onclick="deleteCommunityReply('${post.id}', ${idx}, ${rIdx})" class="text-[10px] font-bold text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>` : (viewerCommentId && r.authorId !== viewerCommentId ? `
                                <button type="button" onclick="${isCommunityCommentReportedByMe(r) ? `showToast('이미 신고한 답글입니다.', 'info')` : `openReportReasonPrompt((reason) => reportCommunityReply('${post.id}', ${idx}, ${rIdx}, reason))`}" class="text-[10px] font-bold text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">${isCommunityCommentReportedByMe(r) ? '신고됨' : '신고'}</button>` : '')}
                            </div>
                        </div>
                        ${isReplyEditing
                            ? `<div class="flex gap-1.5 pt-0.5">
                                <input type="text" id="community-reply-edit-input-${idx}-${rIdx}" value="${escapeHtml(r.text)}" class="input flex-1 text-xs">
                                <button type="button" onclick="saveCommunityReplyEdit('${post.id}', ${idx}, ${rIdx})" class="btn btn-dark btn-sm shrink-0">저장</button>
                               </div>`
                            : `<p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(r.text)}</p>`}
                    </div>`;
                }).join('')}</div>`
                : '';
            const replyBoxHtml = openReplyBoxKeys.has(`${post.id}-${idx}`)
                ? `<div class="mt-2 ml-5 flex gap-2">
                        <input type="text" id="community-reply-input-${idx}" placeholder="대댓글을 입력하세요" class="input flex-1 text-xs">
                        <button type="button" onclick="submitCommunityReply('${post.id}', ${idx})" class="btn btn-dark btn-sm shrink-0">등록</button>
                   </div>`
                : '';
            const isCommentEditing = openCommentEditKeys.has(`${post.id}-${idx}`);
            const isQnaPost = post.category === 'qna';
            const isPostAuthor = myId && post.authorId === myId;
            return `
            <div class="p-3.5 ${c.accepted ? 'bg-emerald-50 border border-emerald-200' : 'bg-ink-50'} rounded-xl space-y-1">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-black text-ink-800 flex items-center gap-1.5">${escapeHtml(c.authorName)}${c.authorType === 'partner' ? `<span class="badge badge-brand"><i data-lucide="badge-check" class="w-2.5 h-2.5"></i> 전문가 답변</span>` : ''}${c.accepted ? `<span class="badge badge-emerald"><i data-lucide="check" class="w-2.5 h-2.5"></i> 채택된 답변</span>` : ''}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${c.date}${c.edited ? ' (수정됨)' : ''}</span>
                </div>
                ${isCommentEditing
                    ? `<div class="flex gap-1.5">
                        <input type="text" id="community-comment-edit-input-${idx}" value="${escapeHtml(c.text)}" class="input flex-1 text-xs">
                        <button type="button" onclick="saveCommunityCommentEdit('${post.id}', ${idx})" class="btn btn-dark btn-sm shrink-0">저장</button>
                       </div>`
                    : `<p class="text-xs text-ink-700 font-medium leading-relaxed">${escapeHtml(c.text)}</p>`}
                <div class="flex items-center gap-3">
                    <button type="button" onclick="toggleReplyBox('${post.id}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-ink-700 bg-transparent border-0 cursor-pointer p-0">답글 달기</button>
                    ${isQnaPost && isPostAuthor ? `
                    <button type="button" onclick="toggleCommunityAcceptedAnswer('${post.id}', ${idx})" class="text-[10px] font-bold ${c.accepted ? 'text-emeraldCustom' : 'text-ink-400 hover:text-emeraldCustom'} bg-transparent border-0 cursor-pointer p-0">${c.accepted ? '채택 취소' : '채택하기'}</button>` : ''}
                    ${viewerCommentId && c.authorId === viewerCommentId ? `
                    <button type="button" onclick="toggleCommentEdit('${post.id}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">${isCommentEditing ? '취소' : '수정'}</button>
                    <button type="button" onclick="deleteCommunityComment('${post.id}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>` : (viewerCommentId && c.authorId !== viewerCommentId ? `
                    <button type="button" onclick="${isCommunityCommentReportedByMe(c) ? `showToast('이미 신고한 댓글입니다.', 'info')` : `openReportReasonPrompt((reason) => reportCommunityComment('${post.id}', ${idx}, reason))`}" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">${isCommunityCommentReportedByMe(c) ? '신고됨' : '신고'}</button>` : '')}
                </div>
                ${repliesHtml}
                ${replyBoxHtml}
            </div>`;
        }).join('')
        : `<p class="text-xs text-ink-400 font-bold text-center py-6">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>`;

    const contentEl = document.getElementById('community-detail-content');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="space-y-3 border-b border-ink-100 pb-5">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="badge badge-brand">${COMMUNITY_CATEGORIES[post.category] || '자유 이야기'}</span>
                        <span class="text-[11px] text-ink-400 font-bold">${post.date} · ${escapeHtml(post.authorName)} · 조회 ${post.views || 0}</span>
                    </div>
                    ${myId && post.authorId === myId ? `
                        <div class="flex items-center gap-2.5 shrink-0">
                            <button type="button" onclick="openCommunityEdit('${post.id}')" class="text-[11px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">수정</button>
                            <button type="button" onclick="deleteCommunityPost('${post.id}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                        </div>` : (myId ? `
                        <div class="flex items-center gap-2.5 shrink-0">
                            <button type="button" onclick="toggleBlockCommunityUser('${escapeHtml(post.authorId)}', '${escapeHtml(post.authorName)}', '${post.id}')" class="text-[11px] font-bold text-ink-400 hover:text-ink-700 bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"><i data-lucide="user-x" class="w-3 h-3"></i> ${isCommunityUserBlockedByMe(post.authorId) ? '차단 해제' : '작성자 차단'}</button>
                            <button type="button" onclick="${(post.reportedBy || []).includes(myId) ? `showToast('이미 신고한 게시글입니다.', 'info')` : `openReportReasonPrompt((reason) => reportCommunityPost('${post.id}', reason))`}" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"><i data-lucide="flag" class="w-3 h-3"></i> ${(post.reportedBy || []).includes(myId) ? '신고 완료' : '신고'}</button>
                        </div>` : '')}
                </div>
                <h3 class="text-lg font-black text-ink-950">${escapeHtml(post.title)}</h3>
            </div>
            <p class="text-sm text-ink-700 font-medium leading-relaxed whitespace-pre-line py-2">${escapeHtml(post.content)}</p>
            ${post.images && post.images.length > 0 ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2" id="community-detail-images">${post.images.map(src => `<img src="${src}" class="w-full aspect-square rounded-xl object-cover border border-ink-100 cursor-pointer">`).join('')}</div>` : ''}
            <div class="flex items-center gap-2 pt-2">
                <button type="button" onclick="toggleCommunityLike('${post.id}')" class="btn btn-secondary btn-sm like-btn ${liked ? 'liked' : ''}"><i data-lucide="heart" class="w-3.5 h-3.5"></i> 좋아요 ${(post.likedBy || []).length}</button>
                ${myId ? `<button type="button" onclick="toggleSaveCommunityPost('${post.id}')" class="btn btn-secondary btn-sm ${isCommunityPostSaved(post.id) ? 'liked' : ''}"><i data-lucide="bookmark" class="w-3.5 h-3.5"></i> ${isCommunityPostSaved(post.id) ? '저장됨' : '저장'}</button>` : ''}
            </div>
            <div class="pt-5 border-t border-ink-100 space-y-3">
                <h5 class="text-xs font-black text-ink-800">댓글 ${(post.comments || []).length}개</h5>
                <div class="space-y-2">${commentsHtml}</div>
                <div class="flex gap-2 pt-1">
                    <input type="text" id="community-comment-input" placeholder="따뜻한 댓글을 남겨주세요" class="input flex-1">
                    <button type="button" onclick="submitCommunityComment('${post.id}')" class="btn btn-dark btn-sm shrink-0">등록</button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (post.images && post.images.length > 0 && typeof openLightbox === 'function') {
            contentEl.querySelectorAll('#community-detail-images img').forEach((img, idx) => {
                img.onclick = () => openLightbox(post.images[idx], post.title, post.images, idx);
            });
        }
    }
}

function closeCommunityDetail() {
    renderCommunityList();
}

function requireClientLoginForCommunity() {
    if (window.AppState.clientAuth && window.AppState.clientAuth.loggedIn) return true;
    showToast('로그인 후 이용할 수 있어요. 로그인 페이지로 이동합니다.', 'warning');
    goToLoginPanel('community-panel');
    return false;
}

function openCommunityWrite() {
    if (!requireClientLoginForCommunity()) return;
    communityEditTargetId = null;
    document.getElementById('community-list-subview')?.classList.add('hidden');
    document.getElementById('community-detail-subview')?.classList.add('hidden');
    document.getElementById('community-write-subview')?.classList.remove('hidden');
    safeUpdateText('community-write-heading', '새 글 작성');
    safeUpdateText('community-write-submit-btn', '등록하기');
    safeUpdateValue('community-write-category', 'talk');
    safeUpdateValue('community-write-title', '');
    safeUpdateValue('community-write-content', '');
    communityPhotoDrafts = [];
    renderCommunityPhotoPreview();
}

/* 지금까지는 글 삭제만 가능하고 수정은 불가능해서 오타 하나만 고치려 해도 삭제 후
 * 재작성해야 했다 — 기존 글쓰기 폼을 재사용해 그대로 수정할 수 있게 한다. */
function openCommunityEdit(postId) {
    if (!requireClientLoginForCommunity()) return;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || post.authorId !== window.AppState.clientAuth.id) return;

    communityEditTargetId = postId;
    document.getElementById('community-list-subview')?.classList.add('hidden');
    document.getElementById('community-detail-subview')?.classList.add('hidden');
    document.getElementById('community-write-subview')?.classList.remove('hidden');
    safeUpdateText('community-write-heading', '글 수정');
    safeUpdateText('community-write-submit-btn', '수정 완료');
    safeUpdateValue('community-write-category', post.category);
    safeUpdateValue('community-write-title', post.title);
    safeUpdateValue('community-write-content', post.content);
    communityPhotoDrafts = (post.images || []).slice();
    renderCommunityPhotoPreview();
}

function closeCommunityWrite() {
    communityEditTargetId = null;
    renderCommunityList();
}

function renderCommunityPhotoPreview() {
    const grid = document.getElementById('community-photo-preview-grid');
    if (!grid) return;
    grid.innerHTML = communityPhotoDrafts.map((src, idx) => `
        <div class="relative aspect-square rounded-xl overflow-hidden border border-ink-100 bg-ink-50">
            <img src="${src}" class="w-full h-full object-cover">
            <button type="button" onclick="removeCommunityPhotoDraft(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-ink-950/70 text-white flex items-center justify-center" aria-label="사진 삭제"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removeCommunityPhotoDraft(idx) {
    communityPhotoDrafts.splice(idx, 1);
    renderCommunityPhotoPreview();
}

function handleCommunityPhotoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const remaining = 6 - communityPhotoDrafts.length;
    if (input.files.length > remaining) showToast(`사진은 최대 6장까지 첨부할 수 있어요. (${input.files.length - remaining}장은 담기지 않았어요)`, 'warning');
    Array.from(input.files).slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            communityPhotoDrafts.push(e.target.result);
            renderCommunityPhotoPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function submitCommunityPost() {
    if (!requireClientLoginForCommunity()) return;
    const category = document.getElementById('community-write-category')?.value || 'talk';
    const title = document.getElementById('community-write-title')?.value.trim();
    const content = document.getElementById('community-write-content')?.value.trim();
    if (!title || !content) { showToast('제목과 내용을 모두 입력해 주세요.', 'warning'); return; }

    const auth = window.AppState.clientAuth;

    if (communityEditTargetId) {
        const post = (window.AppState.communityPosts || []).find(p => p.id === communityEditTargetId);
        if (!post || post.authorId !== auth.id) { communityEditTargetId = null; return; }
        post.category = category; post.title = title; post.content = content;
        post.images = communityPhotoDrafts.slice();
        if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_EDIT', `'${auth.name}' 고객님이 커뮤니티 글을 수정했습니다. (${title})`, 'INFO');
        showToast('글이 수정되었습니다!', 'success');
        const editedId = communityEditTargetId;
        communityEditTargetId = null;
        communityPhotoDrafts = [];
        openCommunityDetail(editedId);
        return;
    }

    const post = {
        id: 'cm-' + Date.now(), category, title, authorName: auth.name, authorId: auth.id,
        content, date: getLocalDateString(), likedBy: [], comments: [],
        images: communityPhotoDrafts.slice()
    };
    if (!window.AppState.communityPosts) window.AppState.communityPosts = [];
    window.AppState.communityPosts.unshift(post);
    if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_POST', `'${auth.name}' 고객님이 커뮤니티에 새 글을 등록했습니다. (${title})`, 'SUCCESS');
    showToast('글이 등록되었습니다!', 'success');
    communityActiveCategory = 'all';
    communityPhotoDrafts = [];
    openCommunityDetail(post.id);
}

/* 커뮤니티 글에 좋아요/댓글이 달려도 글쓴이에게 알림이 전혀 가지 않아서, 우연히
 * 재방문하지 않으면 반응이 왔는지 알 방법이 없었다 — 다른 이벤트들(리뷰 답글 등)과
 * 동일하게 pushClientNotification으로 알려준다. post에는 authorId만 있어서
 * clientAccounts에서 phone을 역조회한다. 본인 글에 본인이 반응한 경우는 알리지 않는다. */
function notifyCommunityPostAuthor(post, message) {
    const auth = window.AppState.clientAuth;
    if (!post || !post.authorId || post.authorId === auth.id) return;
    const authorAccount = (window.AppState.clientAccounts || []).find(a => a.id === post.authorId);
    if (authorAccount && authorAccount.phone && typeof pushClientNotification === 'function') {
        pushClientNotification(authorAccount.phone, message);
    }
}

function toggleCommunityLike(postId) {
    if (!requireClientLoginForCommunity()) return;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    if (!post.likedBy) post.likedBy = [];
    const myId = window.AppState.clientAuth.id;
    const idx = post.likedBy.indexOf(myId);
    if (idx >= 0) { post.likedBy.splice(idx, 1); }
    else {
        post.likedBy.push(myId);
        notifyCommunityPostAuthor(post, `내가 쓴 글 "${post.title}"에 좋아요가 달렸어요.`);
    }
    openCommunityDetail(postId);
}

/* Q&A 게시판은 채택 답변 기능까지 있는데 정작 실제 전문가인 파트너는 댓글을 남길
 * 방법이 전혀 없었다 — 커뮤니티 패널 자체는 역할 구분 없이 누구나 들어올 수 있는
 * 전역 패널(CLIENT_AUTH_REQUIRED_PANELS에 community-panel이 없음)인데, 댓글
 * 작성만 클라이언트 로그인으로 막혀 있던 비대칭. Q&A 글에 한해 로그인한 파트너의
 * "전문가 답변"을 허용한다. 수정/삭제/신고는 openCommunityDetail의
 * myPartnerCommentId 분기(deleteCommunityComment/saveCommunityCommentEdit/
 * reportCommunityComment)에서 고객 댓글과 동일하게 처리한다. */
function submitCommunityComment(postId) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    const isPartnerAnswer = post.category === 'qna' && window.AppState.partnerLoggedIn && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn);
    if (!isPartnerAnswer && !requireClientLoginForCommunity()) return;

    const input = document.getElementById('community-comment-input');
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('댓글 내용을 입력해 주세요.', 'warning'); return; }
    if (!post.comments) post.comments = [];

    if (isPartnerAnswer) {
        const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
        post.comments.push({ authorName: partnerName, authorId: `partner:${partnerName}`, authorType: 'partner', text, date: getLocalDateString() });
        if (typeof pushLog === 'function') pushLog('PARTNER', 'COMMUNITY_ANSWER', `[${partnerName}]가 Q&A 글("${post.title}")에 전문가 답변을 남겼습니다.`, 'INFO');
        notifyCommunityPostAuthor(post, `내가 쓴 글 "${post.title}"에 전문가 답변이 달렸어요.`);
    } else {
        const auth = window.AppState.clientAuth;
        post.comments.push({ authorName: auth.name, authorId: auth.id, text, date: getLocalDateString() });
        if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_COMMENT', `'${auth.name}' 고객님이 댓글을 남겼습니다.`, 'INFO');
        notifyCommunityPostAuthor(post, `내가 쓴 글 "${post.title}"에 댓글이 달렸어요.`);
    }
    openCommunityDetail(postId);
}

window.changeMonth = changeMonth;
window.renderCalendar = renderCalendar;
window.updateFormState = updateFormState;
window.handlePhoneInput = handlePhoneInput;
window.handlePyungChange = handlePyungChange;
window.restoreQuoteDraftFromStorage = restoreQuoteDraftFromStorage;
window.saveQuoteDraftToStorage = saveQuoteDraftToStorage;
window.clearQuoteDraftFromStorage = clearQuoteDraftFromStorage;
window.handleBudgetChange = handleBudgetChange;
window.formatBudget = formatBudget;
window.syncFormStateUI = syncFormStateUI;
window.goToClientStep = goToClientStep;
window.triggerMatchingSim = triggerMatchingSim;
window.clientFinalizeContract = clientFinalizeContract;
window.cancelPartnerBid = cancelPartnerBid;
window.openBidQuestionModal = openBidQuestionModal;
window.buildClientPreBidQnaHtml = buildClientPreBidQnaHtml;
window.replyToPreBidQuestion = replyToPreBidQuestion;
window.closeBidQuestionModal = closeBidQuestionModal;
window.submitBidQuestion = submitBidQuestion;
window.withdrawOrder = withdrawOrder;
window.openEditOrderBudgetModal = openEditOrderBudgetModal;
window.closeEditOrderBudgetModal = closeEditOrderBudgetModal;
window.saveOrderBudgetEdit = saveOrderBudgetEdit;
window.downloadTransactionReceipt = downloadTransactionReceipt;
window.openContractCancelRequestModal = openContractCancelRequestModal;
window.isPartnerReportedByMeForOrder = isPartnerReportedByMeForOrder;
window.retractPartnerReport = retractPartnerReport;
window.openReportPartnerModal = openReportPartnerModal;
window.closeReportPartnerModal = closeReportPartnerModal;
window.submitPartnerReport = submitPartnerReport;
window.closeContractCancelRequestModal = closeContractCancelRequestModal;
window.submitContractCancellationRequest = submitContractCancellationRequest;
window.retractContractCancellationRequest = retractContractCancellationRequest;
window.openForceCancelAppealModal = openForceCancelAppealModal;
window.closeForceCancelAppealModal = closeForceCancelAppealModal;
window.submitForceCancelAppeal = submitForceCancelAppeal;
window.openRepairClaimModal = openRepairClaimModal;
window.closeRepairClaimModal = closeRepairClaimModal;
window.submitRepairClaim = submitRepairClaim;
window.buildRepairClaimsHtml = buildRepairClaimsHtml;
window.buildProgressStagesHtml = buildProgressStagesHtml;
window.buildPaymentMilestonesHtml = buildPaymentMilestonesHtml;
window.confirmPaymentMilestone = confirmPaymentMilestone;
window.openMilestoneDisputeModal = openMilestoneDisputeModal;
window.closeMilestoneDisputeModal = closeMilestoneDisputeModal;
window.submitMilestoneDispute = submitMilestoneDispute;
window.confirmSiteVisit = confirmSiteVisit;
window.declineSiteVisit = declineSiteVisit;
window.buildClientSiteVisitHtml = buildClientSiteVisitHtml;
window.retractRepairClaim = retractRepairClaim;
window.escalateRepairClaimToAdmin = escalateRepairClaimToAdmin;
window.openScheduleChangeModal = openScheduleChangeModal;
window.closeScheduleChangeModal = closeScheduleChangeModal;
window.submitScheduleChangeRequest = submitScheduleChangeRequest;
window.retractScheduleChangeRequest = retractScheduleChangeRequest;
window.respondToPartnerScheduleChangeRequest = respondToPartnerScheduleChangeRequest;
window.buildScheduleChangeHtml = buildScheduleChangeHtml;
window.openPriceChangeModal = openPriceChangeModal;
window.closePriceChangeModal = closePriceChangeModal;
window.submitPriceChangeRequest = submitPriceChangeRequest;
window.retractPriceChangeRequest = retractPriceChangeRequest;
window.respondToPartnerPriceChangeRequest = respondToPartnerPriceChangeRequest;
window.buildPriceChangeHtml = buildPriceChangeHtml;
window.openClientReportAppealModal = openClientReportAppealModal;
window.closeClientReportAppealModal = closeClientReportAppealModal;
window.submitClientReportAppeal = submitClientReportAppeal;
window.renderClientReportedStatus = renderClientReportedStatus;
window.openClientRatingAppealModal = openClientRatingAppealModal;
window.closeClientRatingAppealModal = closeClientRatingAppealModal;
window.submitClientRatingAppeal = submitClientRatingAppeal;
window.renderClientRatingStatus = renderClientRatingStatus;
window.openReviewDeletionAppealModal = openReviewDeletionAppealModal;
window.closeReviewDeletionAppealModal = closeReviewDeletionAppealModal;
window.submitReviewDeletionAppeal = submitReviewDeletionAppeal;
window.renderClientReviewDeletionStatus = renderClientReviewDeletionStatus;
window.openCommunityDeletionAppealModal = openCommunityDeletionAppealModal;
window.closeCommunityDeletionAppealModal = closeCommunityDeletionAppealModal;
window.submitCommunityDeletionAppeal = submitCommunityDeletionAppeal;
window.renderClientCommunityDeletionStatus = renderClientCommunityDeletionStatus;
window.adminApproveCommunityDeletionAppeal = adminApproveCommunityDeletionAppeal;
window.adminRejectCommunityDeletionAppeal = adminRejectCommunityDeletionAppeal;
window.renderClientBenefitsStatus = renderClientBenefitsStatus;
window.claimClientBenefit = claimClientBenefit;

window.sendClientAuthCode = sendClientAuthCode;
window.switchClientAuthTab = switchClientAuthTab;
window.verifyClientSignupPhone = verifyClientSignupPhone;
window.submitClientSignup = submitClientSignup;
window.loginClientWithId = loginClientWithId;
window.performClientLogout = performClientLogout;
window.toggleClientAuthUI = toggleClientAuthUI;
window.handleClientLoginNavClick = handleClientLoginNavClick;
window.goToLoginPanel = goToLoginPanel;
window.setPostLoginRedirect = setPostLoginRedirect;
window.completePostLoginRedirect = completePostLoginRedirect;
window.renderClientMyPage = renderClientMyPage;
window.setClientMyPageHistoryFilter = setClientMyPageHistoryFilter;
window.setClientMyPageHistoryStatusFilter = setClientMyPageHistoryStatusFilter;
window.switchClientMyPageSubtab = switchClientMyPageSubtab;
window.renderClientMyPagePosts = renderClientMyPagePosts;
window.jumpToMyCommunityPost = jumpToMyCommunityPost;
window.isFavoritePartner = isFavoritePartner;
window.toggleFavoritePartner = toggleFavoritePartner;
window.renderClientFavoritePartners = renderClientFavoritePartners;
window.renderClientRegularOfPartners = renderClientRegularOfPartners;
window.openSuspensionAppealModal = openSuspensionAppealModal;
window.openClientStrikeAppealModal = openClientStrikeAppealModal;
window.closeClientStrikeAppealModal = closeClientStrikeAppealModal;
window.submitClientStrikeAppeal = submitClientStrikeAppeal;
window.renderClientStrikeAppealStatus = renderClientStrikeAppealStatus;
window.closeSuspensionAppealModal = closeSuspensionAppealModal;
window.submitSuspensionAppeal = submitSuspensionAppeal;
window.renderClientMyPageNotifications = renderClientMyPageNotifications;
window.replyToManagerDirectMessage = replyToManagerDirectMessage;
window.markAllClientNotificationsRead = markAllClientNotificationsRead;
window.markClientNotificationRead = markClientNotificationRead;
window.deleteClientNotification = deleteClientNotification;
window.clearAllClientNotifications = clearAllClientNotifications;
window.renderClientAccountSettings = renderClientAccountSettings;
window.renderClientNotificationPrefToggle = renderClientNotificationPrefToggle;
window.toggleClientNotificationPref = toggleClientNotificationPref;
window.updateClientProfileInfo = updateClientProfileInfo;
window.updateClientPassword = updateClientPassword;
window.openAccountDeleteModal = openAccountDeleteModal;
window.closeAccountDeleteModal = closeAccountDeleteModal;
window.confirmAccountDeletion = confirmAccountDeletion;
window.openSupportInquiryModal = openSupportInquiryModal;
window.closeSupportInquiryModal = closeSupportInquiryModal;
window.submitSupportInquiry = submitSupportInquiry;
window.renderMySupportTickets = renderMySupportTickets;
window.cancelSupportTicket = cancelSupportTicket;
window.submitSupportFollowUp = submitSupportFollowUp;
window.selectMyPageEstimate = selectMyPageEstimate;
window.setClientBidSortMode = setClientBidSortMode;
window.toggleBidCompareSelection = toggleBidCompareSelection;
window.openBidCompareModal = openBidCompareModal;
window.sendClientOrderMessage = sendClientOrderMessage;
window.confirmRepairVisitDate = confirmRepairVisitDate;
window.disputeRepairVisitCompletion = disputeRepairVisitCompletion;
window.respondChangeOrder = respondChangeOrder;
window.disputeCompletedRepairClaim = disputeCompletedRepairClaim;
window.toggleCommunityAcceptedAnswer = toggleCommunityAcceptedAnswer;
window.reopenCancelledOrder = reopenCancelledOrder;
window.isPartnerBlockedByClient = isPartnerBlockedByClient;
window.togglePartnerBlock = togglePartnerBlock;
window.renderBlockedPartnersList = renderBlockedPartnersList;
window.disputeProgressStage = disputeProgressStage;
window.disputeSiteVisitCompletion = disputeSiteVisitCompletion;
window.computeClientTier = computeClientTier;
window.buildClientTierBadgeHtml = buildClientTierBadgeHtml;
window.declineRepairVisitDate = declineRepairVisitDate;
window.closeBidCompareModal = closeBidCompareModal;
window.renderMyPageEstimateDetails = renderMyPageEstimateDetails;
window.triggerRebidding = triggerRebidding;
window.convertOrderToOpenMatching = convertOrderToOpenMatching;
window.handleHome1on1Click = handleHome1on1Click;
window.showToast = showToast;

window.openReviewWriteModal = openReviewWriteModal;
window.closeReviewWriteModal = closeReviewWriteModal;
window.handleReviewPhotoUpload = handleReviewPhotoUpload;
window.removeReviewPhotoDraft = removeReviewPhotoDraft;
window.setReviewRating = setReviewRating;
window.submitClientReview = submitClientReview;
window.deleteMyClientReview = deleteMyClientReview;

window.clearSignatureCanvas = clearSignatureCanvas;
window.submitSignatureCanvas = submitSignatureCanvas;

window.renderCommunityList = renderCommunityList;
window.getWeeklyBestPostIds = getWeeklyBestPostIds;
window.setCommunityCategory = setCommunityCategory;
window.openCommunityDetail = openCommunityDetail;
window.closeCommunityDetail = closeCommunityDetail;
window.openCommunityWrite = openCommunityWrite;
window.closeCommunityWrite = closeCommunityWrite;
window.submitCommunityPost = submitCommunityPost;
window.handleCommunityPhotoUpload = handleCommunityPhotoUpload;
window.removeCommunityPhotoDraft = removeCommunityPhotoDraft;
window.toggleCommunityLike = toggleCommunityLike;
window.submitCommunityComment = submitCommunityComment;
window.toggleReplyBox = toggleReplyBox;
window.submitCommunityReply = submitCommunityReply;
window.deleteCommunityComment = deleteCommunityComment;
window.deleteCommunityReply = deleteCommunityReply;
window.toggleCommentEdit = toggleCommentEdit;
window.saveCommunityCommentEdit = saveCommunityCommentEdit;
window.toggleReplyEdit = toggleReplyEdit;
window.saveCommunityReplyEdit = saveCommunityReplyEdit;
window.renderAdminCommunityModeration = renderAdminCommunityModeration;
window.adminDeleteCommunityPost = adminDeleteCommunityPost;
window.toggleCommunityPostPin = toggleCommunityPostPin;
window.isCommunityPostSaved = isCommunityPostSaved;
window.toggleSaveCommunityPost = toggleSaveCommunityPost;
window.renderClientMyPageSavedPosts = renderClientMyPageSavedPosts;
window.reportCommunityPost = reportCommunityPost;
window.isCommunityCommentReportedByMe = isCommunityCommentReportedByMe;
window.reportCommunityComment = reportCommunityComment;
window.reportCommunityReply = reportCommunityReply;
window.toggleBlockCommunityUser = toggleBlockCommunityUser;
window.isCommunityUserBlockedByMe = isCommunityUserBlockedByMe;
window.renderBlockedUsersList = renderBlockedUsersList;
window.adminDeleteCommunityComment = adminDeleteCommunityComment;
window.adminDeleteCommunityReply = adminDeleteCommunityReply;
window.dismissCommunityPostReport = dismissCommunityPostReport;
window.dismissCommunityCommentReport = dismissCommunityCommentReport;
window.dismissCommunityReplyReport = dismissCommunityReplyReport;
window.deleteCommunityPost = deleteCommunityPost;
window.openCommunityEdit = openCommunityEdit;
