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

function updateFormState(key, value) {
    window.AppState.formData[key] = value;
    syncFormStateUI();
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
}

function handleBudgetChange(val) {
    window.AppState.formData.budget = parseInt(val, 10);
    syncFormStateUI();
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
        const availablePartners = window.AppState.partners.filter(p => p.status === 'active');
        const count = Math.min(newOrder.partnerCountLimit, availablePartners.length);
        const shuffled = [...availablePartners].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        newOrder.bids = selected.map(partner => ({
            partner: partner.name,
            price: Math.floor(newOrder.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        }));
        if (typeof pushClientNotification === 'function') {
            pushClientNotification(auth.phone, `안심 견적(${code})에 파트너사 ${newOrder.bids.length}곳이 자동 매칭되어 견적서를 보냈어요.`);
        }
        if (typeof pushPartnerNotification === 'function') {
            selected.forEach(partner => pushPartnerNotification(partner.name, `새 오더(${code})에 매칭되었어요. 고객: ${maskName(newOrder.clientName)}님, ${newOrder.pyung}평형.`));
        }
    }

    window.AppState.orders.unshift(newOrder);
    window.AppState.lastCreatedOrderCode = code;

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

function cancelPartnerBid(orderCode, partnerName) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    order.bids = order.bids.filter(b => b.partner !== partnerName);
    if (!order.excludedPartners) order.excludedPartners = [];
    if (!order.excludedPartners.includes(partnerName)) order.excludedPartners.push(partnerName);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CANCEL_BID', `[${order.clientName}] 고객님이 [${partnerName}] 파트너의 매칭을 취소하였습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `고객님이 오더(${orderCode}) 매칭을 취소했어요.`);
    showToast(`[${partnerName}] 매칭을 취소했습니다.`, 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
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
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `고객님과 계약이 체결됐어요! (의뢰 코드: ${orderCode}, 계약금액 ₩ ${finalPrice.toLocaleString()}만원)`);
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

    window.AppState.clientAccounts.push({ id: idVal, pw: pwVal, name: nameVal, phone: phoneVal });
    auth.loggedIn = true; auth.id = idVal; auth.name = nameVal; auth.phone = phoneVal;
    window.AppState.formData.clientName = nameVal;
    window.AppState.formData.clientPhone = phoneVal;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SIGNUP_SUCCESS', `'${nameVal}'(${idVal}) 고객님 회원가입 및 로그인 완료.`, 'SUCCESS');
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

    const auth = window.AppState.clientAuth;
    auth.loggedIn = true; auth.id = account.id; auth.name = account.name; auth.phone = account.phone;
    window.AppState.formData.clientName = account.name;
    window.AppState.formData.clientPhone = account.phone;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'LOGIN_SUCCESS', `'${account.name}'(${account.id}) 고객님 로그인 완료.`, 'SUCCESS');
    showToast(`반갑습니다, ${account.name} 고객님.`, 'success');

    toggleClientAuthUI(); syncFormStateUI();
    completePostLoginRedirect();
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

function setClientMyPageHistoryFilter(filterKey) {
    clientMyPageHistoryFilter = filterKey;
    window.AppState.selectedMyPageOrderCode = null;
    renderClientMyPage();
}

/* 마이페이지 상단 메인 탭 — '의뢰이력'과 '내가 쓴 글'을 완전히 분리된 화면으로 전환한다. */
let clientMyPageActiveSubtab = 'history';

function switchClientMyPageSubtab(tab) {
    clientMyPageActiveSubtab = tab;
    renderClientMyPage();
}

function renderClientMyPage() {
    const listContainer = document.getElementById('client-mypage-estimates-container');
    const detailEmpty = document.getElementById('client-mypage-detail-empty');
    const detailBoard = document.getElementById('client-mypage-detail-board');
    if (!listContainer) return;

    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;

    const myPostsCount = (window.AppState.communityPosts || []).filter(p => p.authorId === auth.id).length;
    const myNotifications = (window.AppState.clientNotifications || []).filter(n => n.clientPhone === auth.phone);
    const unreadCount = myNotifications.filter(n => !n.read).length;
    const mainTabsEl = document.getElementById('client-mypage-main-tabs');
    if (mainTabsEl) {
        const mainTabs = [
            ['history', '의뢰이력'],
            ['posts', `내가 쓴 글 (${myPostsCount})`],
            ['notifications', unreadCount > 0 ? `알림 (${unreadCount})` : '알림']
        ];
        mainTabsEl.innerHTML = mainTabs.map(([key, label]) =>
            `<button type="button" data-tab="${key}" onclick="switchClientMyPageSubtab('${key}')" class="gnb-tab ${clientMyPageActiveSubtab === key ? 'active' : ''}">${label}</button>`
        ).join('');
    }
    document.getElementById('client-mypage-subtab-history-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'history');
    document.getElementById('client-mypage-subtab-posts-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'posts');
    document.getElementById('client-mypage-subtab-notifications-view')?.classList.toggle('hidden', clientMyPageActiveSubtab !== 'notifications');
    if (clientMyPageActiveSubtab === 'posts') renderClientMyPagePosts();
    if (clientMyPageActiveSubtab === 'notifications') renderClientMyPageNotifications(myNotifications);

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

    const myOrders = clientMyPageHistoryFilter === 'all' ? allMyOrders
        : clientMyPageHistoryFilter === '1on1' ? allMyOrders.filter(o => o.is1on1)
        : allMyOrders.filter(o => !o.is1on1);

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
        if (order.is1on1) statusBadge = `<span class="badge badge-neutral"><span class="badge-dot bg-ink-950"></span> 1:1 지정 [${order.targetPartner}]</span>`;
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

        div.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold">
                <span class="${isSelected ? 'text-ink-950 font-black' : 'text-ink-500'} font-mono">${order.code}</span>
                ${statusBadge}
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
                <p class="text-xs font-bold text-ink-800 leading-relaxed">${escapeHtml(n.message)}</p>
                <p class="text-[10px] text-ink-400 font-bold mt-0.5">${dateLabel}</p>
            </div>
        </div>`;
    }).join('') + `</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function markAllClientNotificationsRead() {
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    (window.AppState.clientNotifications || []).forEach(n => { if (n.clientPhone === auth.phone) n.read = true; });
    renderClientMyPage();
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

    let bidsHtml = '';
    if (order.bids && order.bids.length > 0) {
        order.bids.forEach(bid => {
            const isContracted = order.status === 'contracted' && order.acceptedPartner === bid.partner;
            const partnerInfo = window.AppState.partners.find(p => p.name === bid.partner);
            const ratingVal = partnerInfo ? partnerInfo.rating.toFixed(1) : "5.0";
            // 입찰 당시엔 정상이었더라도 그 이후 삼진아웃으로 영구 제명될 수 있다 — '안심'
            // 중개 플랫폼인데 제명된 파트너와 계약을 체결할 수 있으면 블랙리스트 정책이
            // 무의미해지므로, 제명된 파트너의 입찰은 계약 체결을 막고 매칭취소만 유도한다.
            const isBannedBid = partnerInfo && partnerInfo.status === 'banned';

            bidsHtml += `
                <div class="p-4 rounded-2xl border ${isContracted ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/40' : (isBannedBid ? 'border-rose-200 bg-rose-50/40' : 'border-ink-100 bg-ink-50/70')} text-left space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-ink-950 cursor-pointer hover:underline" onclick="openPartnerPortfolioModal('${bid.partner}')">${escapeHtml(bid.partner)}</span>
                            <span class="text-gold-500 font-extrabold text-xs">★ ${ratingVal}</span>
                            ${isBannedBid ? `<span class="badge badge-rose">영구 제명</span>` : ''}
                        </div>
                        <span class="font-black text-ink-950 text-sm">₩ ${bid.price.toLocaleString()} 만원</span>
                    </div>
                    <p class="text-xs text-ink-600 font-semibold leading-relaxed">${escapeHtml(bid.desc)}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-ink-100">
                        <button type="button" onclick="openPartnerPortfolioModal('${bid.partner}')" class="btn btn-ghost btn-sm px-0"><i data-lucide="palette" class="w-3.5 h-3.5"></i> 시공 포트폴리오 및 후기</button>
                        ${order.status === 'contracted' ? (isContracted ? `
                            <span class="badge badge-emerald">✓ 안심 계약 체결사</span>
                        ` : `<span class="text-[10px] font-bold text-ink-400">계약 마감</span>`) : (isBannedBid ? `
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] font-bold text-roseCustom">삼진아웃으로 제명되어 계약할 수 없어요</span>
                                <button type="button" onclick="cancelPartnerBid('${order.code}', '${bid.partner}')" class="btn btn-secondary btn-sm">매칭취소</button>
                            </div>
                        ` : `
                            <div class="flex items-center gap-1.5">
                                <button type="button" onclick="cancelPartnerBid('${order.code}', '${bid.partner}')" class="btn btn-secondary btn-sm">매칭취소</button>
                                <button type="button" onclick="clientFinalizeContract('${order.code}', '${bid.partner}', ${bid.price})" class="btn btn-dark btn-sm">이 파트너와 계약 체결하기</button>
                            </div>
                        `)}
                    </div>
                </div>`;
        });
    } else if (order.is1on1) {
        bidsHtml = `<div class="empty-state !py-8 surface-flat"><p class="text-xs text-ink-500 font-bold">지정하신 파트너사와의 매칭이 취소되었습니다.</p><p class="text-[10px] text-ink-400 font-medium mt-1">아래에서 다른 우수 파트너사를 다시 1:1로 지정해보세요.</p></div>`;
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
        reviewBtnHtml = `<div class="p-3 bg-ink-100 rounded-xl text-center text-xs font-bold text-ink-600 flex items-center justify-center gap-1.5"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> 솔직 안심 리뷰 생성이 성공적으로 등록 완료되었습니다.</div>`;
    }

    const designationBannerHtml = `
        <div class="p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style="background:var(--brand-50)">
            <div class="space-y-0.5">
                <span class="flex items-center gap-1.5 text-[10px] font-black text-brand-700 uppercase tracking-wider"><span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span> 1:1 전속 지정 상담</span>
                <p class="text-xs font-bold text-ink-800">원하는 우수 파트너사를 1:1 지정하여 단독 견적을 추가로 받아보세요!</p>
            </div>
            <button type="button" onclick="switchPanel('partner-search-panel')" class="btn btn-primary whitespace-nowrap">우수 파트너 1:1 지정하기 →</button>
        </div>`;

    detailBoard.innerHTML = `
        <div class="space-y-6 text-left">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                <div class="space-y-1">
                    <span class="px-2 py-0.5 text-[9px] font-mono font-black bg-ink-100 text-ink-700 rounded border border-ink-200">${order.code}</span>
                    <h3 class="text-base sm:text-lg font-black text-ink-950">${escapeHtml(order.clientAddress)}</h3>
                </div>
                <div class="text-right"><span class="text-[10px] text-ink-400 block font-bold">희망 예산</span><span class="text-sm font-black text-brand-600">₩ ${order.budget.toLocaleString()} 만원</span></div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div class="article-spec-chip"><span>공간 구분</span><span class="val">${order.spaceType === 'residential' ? '주거 공간' : '상업 공간'}</span></div>
                <div class="article-spec-chip"><span>시공 범위</span><span class="val">${order.workType === 'all' ? '전체 시공' : '부분 시공'}</span></div>
                <div class="article-spec-chip"><span>면적 (평수)</span><span class="val">${order.pyung}평형</span></div>
                <div class="article-spec-chip"><span>희망 착공일</span><span class="val">${order.preferredDate}</span></div>
            </div>

            ${designationBannerHtml}
            ${reviewBtnHtml}

            <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="building" class="w-4 h-4 text-brand-500"></i> 연결된 안심 파트너 제안서 목록 (${order.bids ? order.bids.length : 0})</h4>
                    ${(order.status !== 'contracted' && !order.is1on1) ? `<button type="button" onclick="triggerRebidding('${order.code}')" class="btn btn-secondary btn-sm shrink-0"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> 새 파트너 재매칭 받기</button>` : ''}
                </div>
                <div class="space-y-3">${bidsHtml}</div>
            </div>
        </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    const candidates = (window.AppState.partners || []).filter(p => p.status === 'active' && !excluded.has(p.name));
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
    window.AppState.reviewPhotoDrafts = [];
    window.AppState.activeReviewRating = 5;

    safeUpdateText('write-review-project-name', `프로젝트 번호: ${order.code} · ${order.acceptedPartner || ''}`);
    safeUpdateValue('input-review-text', '');
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
    if (partner) {
        if (!partner.reviews) partner.reviews = [];
        partner.reviews.unshift({
            client: (typeof maskName === 'function') ? maskName(order.clientName) : order.clientName,
            rating: window.AppState.activeReviewRating || 5,
            text: text,
            date: getLocalDateString(),
            photos: window.AppState.reviewPhotoDrafts.slice()
        });
        const total = partner.reviews.reduce((acc, r) => acc + r.rating, 0);
        partner.rating = Math.round((total / partner.reviews.length) * 10) / 10;
    }

    order.reviewWritten = true;
    window.AppState.reviewPhotoDrafts = [];

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW', `${maskName(order.clientName)} 고객님이 [${order.acceptedPartner}]에 대한 안심 후기를 등록함.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `고객님이 새 후기를 남겼어요! (★ ${window.AppState.activeReviewRating || 5}.0)`);
    showToast("소중한 안심 후기가 정상적으로 등록되었습니다. 감사합니다!", "success");

    closeReviewWriteModal();
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function clearSignatureCanvas() {}
function submitSignatureCanvas() {}

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
        .slice()
        .sort((a, b) => sortMode === 'popular'
            ? (b.likedBy || []).length - (a.likedBy || []).length || new Date(b.date) - new Date(a.date)
            : new Date(b.date) - new Date(a.date));

    if (posts.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-ink-400 font-bold py-12 text-center">${query ? '검색 결과가 없습니다.' : '등록된 글이 없습니다. 첫 번째 글을 남겨보세요!'}</p>`;
        return;
    }

    listEl.innerHTML = posts.map(p => `
        <div class="surface-flat p-5 flex items-start justify-between gap-4 hover:border-ink-300 transition-all cursor-pointer text-left" onclick="openCommunityDetail('${p.id}')">
            ${p.images && p.images.length > 0 ? `<img src="${p.images[0]}" class="w-16 h-16 rounded-xl object-cover shrink-0 border border-ink-100">` : ''}
            <div class="space-y-1.5 flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="badge badge-brand">${COMMUNITY_CATEGORIES[p.category] || '자유 이야기'}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${p.date}</span>
                </div>
                <h4 class="text-sm font-black text-ink-950 truncate">${escapeHtml(p.title)}</h4>
                <p class="text-xs text-ink-500 font-medium truncate">${escapeHtml(p.authorName)}</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 text-[11px] text-ink-400 font-bold shrink-0">
                <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${(p.likedBy || []).length}</span>
                <span class="flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3"></i> ${(p.comments || []).length}</span>
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

function toggleReplyBox(postId, commentIndex) {
    if (!requireClientLoginForCommunity()) return;
    const key = `${postId}-${commentIndex}`;
    if (openReplyBoxKeys.has(key)) openReplyBoxKeys.delete(key);
    else openReplyBoxKeys.add(key);
    openCommunityDetail(postId);
}

function submitCommunityReply(postId, commentIndex) {
    if (!requireClientLoginForCommunity()) return;
    const input = document.getElementById(`community-reply-input-${commentIndex}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('답글 내용을 입력해 주세요.', 'warning'); return; }

    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    const comment = post.comments[commentIndex];
    if (!comment.replies) comment.replies = [];

    const auth = window.AppState.clientAuth;
    comment.replies.push({ authorName: auth.name, authorId: auth.id, text, date: getLocalDateString() });
    if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_REPLY', `'${auth.name}' 고객님이 대댓글을 남겼습니다.`, 'INFO');

    openReplyBoxKeys.delete(`${postId}-${commentIndex}`);
    openCommunityDetail(postId);
}

/* 본인이 쓴 댓글/답글만 삭제할 수 있다 — 목록에서도 authorId가 내 아이디일 때만
 * 삭제 버튼을 그려서, 서버 검증이 없는 프로토타입이라도 실수로 남의 글을 지울 방법이 없게 한다. */
function deleteCommunityComment(postId, commentIndex) {
    const auth = window.AppState.clientAuth;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    if (post.comments[commentIndex].authorId !== auth.id) return;
    post.comments.splice(commentIndex, 1);
    // openReplyBoxKeys는 '게시글id-댓글인덱스'로 답글창 열림 상태를 기억하는데, 댓글이 하나
    // 지워지면 뒤에 있던 댓글들의 인덱스가 한 칸씩 앞으로 밀린다. 이 상태를 그대로 두면
    // 엉뚱한(밀려난) 댓글에 답글창이 열려있는 것처럼 보일 수 있어, 이 글의 답글창 열림
    // 상태를 전부 초기화한다.
    Array.from(openReplyBoxKeys).forEach(key => { if (key.startsWith(`${postId}-`)) openReplyBoxKeys.delete(key); });
    showToast('댓글을 삭제했습니다.', 'info');
    openCommunityDetail(postId);
}

function deleteCommunityReply(postId, commentIndex, replyIndex) {
    const auth = window.AppState.clientAuth;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    const comment = post && post.comments && post.comments[commentIndex];
    if (!comment || !comment.replies || !comment.replies[replyIndex]) return;
    if (comment.replies[replyIndex].authorId !== auth.id) return;
    comment.replies.splice(replyIndex, 1);
    showToast('답글을 삭제했습니다.', 'info');
    openCommunityDetail(postId);
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

function openCommunityDetail(postId) {
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;

    document.getElementById('community-list-subview')?.classList.add('hidden');
    document.getElementById('community-write-subview')?.classList.add('hidden');
    document.getElementById('community-detail-subview')?.classList.remove('hidden');

    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;
    const liked = !!(myId && (post.likedBy || []).includes(myId));

    const commentsHtml = (post.comments || []).length > 0
        ? post.comments.map((c, idx) => {
            const repliesHtml = (c.replies || []).length > 0
                ? `<div class="mt-2 ml-5 pl-3 border-l-2 border-ink-200 space-y-2">${c.replies.map((r, rIdx) => `
                    <div class="space-y-0.5">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-black text-ink-800">${escapeHtml(r.authorName)}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] text-ink-400 font-bold">${r.date}</span>
                                ${myId && r.authorId === myId ? `<button type="button" onclick="deleteCommunityReply('${post.id}', ${idx}, ${rIdx})" class="text-[10px] font-bold text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>` : ''}
                            </div>
                        </div>
                        <p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(r.text)}</p>
                    </div>`).join('')}</div>`
                : '';
            const replyBoxHtml = openReplyBoxKeys.has(`${post.id}-${idx}`)
                ? `<div class="mt-2 ml-5 flex gap-2">
                        <input type="text" id="community-reply-input-${idx}" placeholder="대댓글을 입력하세요" class="input flex-1 text-xs">
                        <button type="button" onclick="submitCommunityReply('${post.id}', ${idx})" class="btn btn-dark btn-sm shrink-0">등록</button>
                   </div>`
                : '';
            return `
            <div class="p-3.5 bg-ink-50 rounded-xl space-y-1">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-black text-ink-800">${escapeHtml(c.authorName)}</span>
                    <span class="text-[10px] text-ink-400 font-bold">${c.date}</span>
                </div>
                <p class="text-xs text-ink-700 font-medium leading-relaxed">${escapeHtml(c.text)}</p>
                <div class="flex items-center gap-3">
                    <button type="button" onclick="toggleReplyBox('${post.id}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-ink-700 bg-transparent border-0 cursor-pointer p-0">답글 달기</button>
                    ${myId && c.authorId === myId ? `<button type="button" onclick="deleteCommunityComment('${post.id}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>` : ''}
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
                        <span class="text-[11px] text-ink-400 font-bold">${post.date} · ${escapeHtml(post.authorName)}</span>
                    </div>
                    ${myId && post.authorId === myId ? `
                        <div class="flex items-center gap-2.5 shrink-0">
                            <button type="button" onclick="openCommunityEdit('${post.id}')" class="text-[11px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">수정</button>
                            <button type="button" onclick="deleteCommunityPost('${post.id}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                        </div>` : ''}
                </div>
                <h3 class="text-lg font-black text-ink-950">${escapeHtml(post.title)}</h3>
            </div>
            <p class="text-sm text-ink-700 font-medium leading-relaxed whitespace-pre-line py-2">${escapeHtml(post.content)}</p>
            ${post.images && post.images.length > 0 ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2" id="community-detail-images">${post.images.map(src => `<img src="${src}" class="w-full aspect-square rounded-xl object-cover border border-ink-100 cursor-pointer">`).join('')}</div>` : ''}
            <div class="flex items-center gap-2 pt-2">
                <button type="button" onclick="toggleCommunityLike('${post.id}')" class="btn btn-secondary btn-sm like-btn ${liked ? 'liked' : ''}"><i data-lucide="heart" class="w-3.5 h-3.5"></i> 좋아요 ${(post.likedBy || []).length}</button>
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

function toggleCommunityLike(postId) {
    if (!requireClientLoginForCommunity()) return;
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    if (!post.likedBy) post.likedBy = [];
    const myId = window.AppState.clientAuth.id;
    const idx = post.likedBy.indexOf(myId);
    if (idx >= 0) post.likedBy.splice(idx, 1); else post.likedBy.push(myId);
    openCommunityDetail(postId);
}

function submitCommunityComment(postId) {
    if (!requireClientLoginForCommunity()) return;
    const input = document.getElementById('community-comment-input');
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('댓글 내용을 입력해 주세요.', 'warning'); return; }
    const post = (window.AppState.communityPosts || []).find(p => p.id === postId);
    if (!post) return;
    if (!post.comments) post.comments = [];
    const auth = window.AppState.clientAuth;
    post.comments.push({ authorName: auth.name, authorId: auth.id, text, date: getLocalDateString() });
    if (typeof pushLog === 'function') pushLog('CLIENT', 'COMMUNITY_COMMENT', `'${auth.name}' 고객님이 댓글을 남겼습니다.`, 'INFO');
    openCommunityDetail(postId);
}

window.changeMonth = changeMonth;
window.renderCalendar = renderCalendar;
window.updateFormState = updateFormState;
window.handlePhoneInput = handlePhoneInput;
window.handlePyungChange = handlePyungChange;
window.handleBudgetChange = handleBudgetChange;
window.formatBudget = formatBudget;
window.syncFormStateUI = syncFormStateUI;
window.goToClientStep = goToClientStep;
window.triggerMatchingSim = triggerMatchingSim;
window.clientFinalizeContract = clientFinalizeContract;
window.cancelPartnerBid = cancelPartnerBid;

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
window.switchClientMyPageSubtab = switchClientMyPageSubtab;
window.renderClientMyPagePosts = renderClientMyPagePosts;
window.jumpToMyCommunityPost = jumpToMyCommunityPost;
window.renderClientMyPageNotifications = renderClientMyPageNotifications;
window.markAllClientNotificationsRead = markAllClientNotificationsRead;
window.selectMyPageEstimate = selectMyPageEstimate;
window.renderMyPageEstimateDetails = renderMyPageEstimateDetails;
window.triggerRebidding = triggerRebidding;
window.handleHome1on1Click = handleHome1on1Click;
window.showToast = showToast;

window.openReviewWriteModal = openReviewWriteModal;
window.closeReviewWriteModal = closeReviewWriteModal;
window.handleReviewPhotoUpload = handleReviewPhotoUpload;
window.removeReviewPhotoDraft = removeReviewPhotoDraft;
window.setReviewRating = setReviewRating;
window.submitClientReview = submitClientReview;

window.clearSignatureCanvas = clearSignatureCanvas;
window.submitSignatureCanvas = submitSignatureCanvas;

window.renderCommunityList = renderCommunityList;
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
window.deleteCommunityPost = deleteCommunityPost;
window.openCommunityEdit = openCommunityEdit;
