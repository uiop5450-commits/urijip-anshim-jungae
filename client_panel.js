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

    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) calDaysGrid.appendChild(document.createElement('div'));

    for (let d = 1; d <= totalDays; d++) {
        const dayCell = document.createElement('button');
        dayCell.type = 'button';
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dayCell.onclick = () => {
            window.AppState.formData.preferredDate = dateString;
            renderCalendar();
            syncFormStateUI();
        };

        const isSelected = window.AppState.formData.preferredDate === dateString;
        const isToday = dateString === todayStr;
        const holiday = (typeof getHolidayName === 'function') ? getHolidayName(year, month, d) : null;

        dayCell.innerText = d;
        dayCell.title = holiday || '';
        let cls = 'h-10 text-xs font-semibold rounded-lg transition-all flex flex-col items-center justify-center relative border-0 cursor-pointer ';
        if (isSelected) {
            cls += 'bg-brand-500 text-white font-bold';
            dayCell.style.boxShadow = 'var(--shadow-brand)';
        } else if (holiday) {
            cls += 'text-roseCustom hover:bg-ink-100 font-bold';
        } else if (isToday) {
            cls += 'text-brand-600 bg-brand-50 font-bold ring-1 ring-inset ring-brand-200';
        } else {
            cls += 'text-ink-700 hover:bg-ink-100';
        }
        dayCell.className = cls;
        calDaysGrid.appendChild(dayCell);
    }
}

function updateFormState(key, value) {
    window.AppState.formData[key] = value;
    syncFormStateUI();
}

function handlePhoneInput(target) {
    let val = target.value.replace(/[^0-9]/g, "");
    if (val.length > 3 && val.length <= 7) val = val.substring(0, 3) + "-" + val.substring(3);
    else if (val.length > 7) val = val.substring(0, 3) + "-" + val.substring(3, 7) + "-" + val.substring(7, 11);
    target.value = val;
    updateFormState('clientPhone', val);
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
        const activeCls = "py-3 text-xs font-bold rounded-xl transition-all bg-white text-ink-950 border-0 cursor-pointer flex flex-col items-center justify-center gap-0.5";
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

    const detailSection = document.getElementById('form-details-section');
    if (detailSection) {
        if (auth.loggedIn) {
            detailSection.classList.remove('opacity-40', 'pointer-events-none');
        } else {
            detailSection.classList.add('opacity-40', 'pointer-events-none');
            goToClientStep(1);
        }
    }
}

/**
 * 견적 신청 3단계 폼(본인인증 → 공간정보 → 일정예산) 스텝 이동 제어
 */
function goToClientStep(step) {
    const auth = window.AppState.clientAuth;
    if (step > 1 && !auth.loggedIn) {
        showToast('먼저 1단계 본인인증을 완료해 주세요.', 'warning');
        step = 1;
    }

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
        showToast('먼저 상단 1단계에서 휴대폰 안심 본인인증을 통과해 주셔야\n의뢰서 접수가 활성화됩니다!', 'warning');
        return;
    }
    if (!fd.clientAddress || fd.pyung <= 0 || !fd.preferredDate) {
        showToast('시공 상세 주소, 면적(평수), 희망 착공일과 예산을 선택해 주세요!', 'warning');
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
    } else {
        const availablePartners = window.AppState.partners;
        const count = Math.min(newOrder.partnerCountLimit, availablePartners.length);
        const shuffled = [...availablePartners].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        newOrder.bids = selected.map(partner => ({
            partner: partner.name,
            price: Math.floor(newOrder.budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding'
        }));
    }

    window.AppState.orders.unshift(newOrder);
    window.AppState.lastCreatedOrderCode = code;

    renderClientBids(newOrder.code);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();

    if (auth.loggedIn) {
        renderClientMyPage();
        if (isHighBudget) {
            showToast(`💰 7,000만원 이상 고액 오더로 지정되어,\n본사 최고 관리자가 최상위 '우리집 인증 파트너사'를 직접 전속 심사 후 나눠 배정합니다!\n(의뢰 코드: ${code})`, 'info');
        } else {
            showToast(`안심 견적이 성실히 접수되었습니다!\n(의뢰 코드: ${code})`, 'success');
        }
        setTimeout(() => {
            if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
            selectMyPageEstimate(code);
        }, 1200);
    }
}

function renderClientBids(targetCode) {
    const bidListEl = document.getElementById('client-bid-list');
    const badgeEl = document.getElementById('partner-count-badge');
    const slotsContainer = document.getElementById('client-bidding-slots-container');
    const reportDateEl = document.getElementById('report-date');
    const reportVacancyEl = document.getElementById('report-vacancy');

    const order = window.AppState.orders.find(o => o.code === targetCode);
    if (!order) return;

    if (reportDateEl) reportDateEl.innerText = order.preferredDate || '선택 대기중';
    if (reportVacancyEl) reportVacancyEl.innerText = order.vacancy === 'empty' ? '공실' : '거주 중';

    if (!bidListEl) return;

    const currentBidCount = order.bids.length;
    const limit = order.partnerCountLimit;
    if (badgeEl) badgeEl.innerText = `${currentBidCount}/${limit} 슬롯 선점됨`;

    if (slotsContainer) {
        slotsContainer.innerHTML = '';
        for (let i = 0; i < limit; i++) {
            const dot = document.createElement('span');
            dot.className = i < currentBidCount ? "w-2.5 h-2.5 rounded-full bg-ink-950 ring-2 ring-ink-200" : "w-2.5 h-2.5 rounded-full bg-ink-200";
            slotsContainer.appendChild(dot);
        }
    }

    bidListEl.innerHTML = '';
    if (order.bids.length === 0) {
        if (order.isHighBudgetAdminPending) {
            bidListEl.innerHTML = `
                <div class="empty-state surface-flat">
                    <span class="badge badge-gold mb-2">7천만원 이상 고액 오더</span>
                    <p class="text-xs text-ink-700 font-bold leading-relaxed">본사 최고 관리자가 검증된 <b>'우리집 인증 파트너사'</b>를 직접 심사하고 전속 배정 중입니다.</p>
                </div>`;
        } else {
            bidListEl.innerHTML = `
                <div class="empty-state">
                    <p class="text-xs text-ink-500 font-bold mb-3">현재 연결된 매칭 파트너가 없습니다.</p>
                    <button type="button" onclick="triggerRebidding('${order.code}')" class="btn btn-dark btn-sm mx-auto">⚡ 새로운 파트너 재매칭 받아보기</button>
                </div>`;
        }
    } else {
        order.bids.forEach((bid) => {
            const partnerInfo = window.AppState.partners.find(p => p.name === bid.partner);
            const ratingVal = partnerInfo ? partnerInfo.rating.toFixed(1) : "5.0";
            const reviewCount = partnerInfo ? partnerInfo.reviews.length : 0;

            const div = document.createElement('div');
            div.className = "p-4 surface-flat space-y-2 relative text-left";
            div.innerHTML = `
                <div class="flex justify-between items-center text-xs">
                    <span class="font-extrabold text-ink-950 cursor-pointer hover:text-ink-600 hover:underline flex items-center gap-1.5" onclick="openPartnerPortfolioModal('${bid.partner}')">
                        <i data-lucide="building" class="w-3.5 h-3.5 text-ink-400"></i>
                        <span>${bid.partner}</span>
                        ${partnerInfo && partnerInfo.isCertified ? `<span class="chip-cert"><span class="w-1.5 h-1.5 rounded-full bg-gold-500"></span> 인증</span>` : ''}
                        <span class="inline-flex items-center gap-1 text-[11px] font-extrabold text-ink-800 ml-1"><span class="text-gold-500">★</span><span>${ratingVal}</span><span class="text-ink-400 font-normal ml-0.5">(리뷰 ${reviewCount})</span></span>
                    </span>
                </div>
                <p class="text-[11px] text-ink-600 leading-relaxed font-semibold">${bid.desc}</p>
                <div class="flex justify-between items-center pt-2 border-t border-ink-100 mt-2">
                    <button type="button" onclick="openPartnerPortfolioModal('${bid.partner}')" class="btn btn-ghost btn-sm px-0">🎨 포트폴리오 및 후기</button>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="cancelPartnerBid('${order.code}', '${bid.partner}')" class="btn btn-secondary btn-sm">매칭취소</button>
                        <button type="button" onclick="clientFinalizeContract('${order.code}', '${bid.partner}', ${bid.price})" class="btn btn-dark btn-sm">계약 체결</button>
                    </div>
                </div>`;
            bidListEl.appendChild(div);
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cancelPartnerBid(orderCode, partnerName) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    order.bids = order.bids.filter(b => b.partner !== partnerName);
    if (!order.excludedPartners) order.excludedPartners = [];
    if (!order.excludedPartners.includes(partnerName)) order.excludedPartners.push(partnerName);

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CANCEL_BID', `[${order.clientName}] 고객님이 [${partnerName}] 파트너의 매칭을 취소하였습니다.`, 'INFO');
    showToast(`[${partnerName}] 매칭을 취소했습니다.`, 'info');

    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    renderClientBids(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
}

function clientFinalizeContract(orderCode, partnerName, finalPrice) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
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
    renderClientBids(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (window.AppState.selectedOrderCode === orderCode && typeof selectOrderForAudit === 'function') selectOrderForAudit(orderCode);

    if (window.AppState.clientAuth.loggedIn) { renderClientMyPage(); selectMyPageEstimate(orderCode); }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'CONTRACT', `${maskName(order.clientName)} 고객님이 [${partnerName}]와 계약 합의서에 서명함.`, 'SUCCESS');
    showToast(`🎉 ${partnerName}와 시공 계약 합의 체결 완료!`, 'success');
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

    if (!idVal || !pwVal || !pw2Val) { showToast("아이디와 비밀번호를 모두 입력해 주세요.", "warning"); return; }
    if (pwVal !== pw2Val) { showToast("비밀번호가 일치하지 않습니다.", "warning"); return; }
    if (window.AppState.clientAccounts.some(acc => acc.id === idVal)) { showToast("이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.", "warning"); return; }

    window.AppState.clientAccounts.push({ id: idVal, pw: pwVal, name: nameVal, phone: phoneVal });
    auth.loggedIn = true; auth.id = idVal; auth.name = nameVal; auth.phone = phoneVal;
    window.AppState.formData.clientName = nameVal;
    window.AppState.formData.clientPhone = phoneVal;

    if (typeof pushLog === 'function') pushLog('CLIENT', 'SIGNUP_SUCCESS', `'${nameVal}'(${idVal}) 고객님 회원가입 및 로그인 완료.`, 'SUCCESS');
    showToast(`회원가입이 완료되었습니다!\n반갑습니다, ${nameVal} 고객님.`, 'success');

    toggleClientAuthUI(); renderClientMyPage(); syncFormStateUI(); goToClientStep(2);
}

function loginClientWithId(isFromForm = false) {
    const idEl = document.getElementById(isFromForm ? 'form-login-id' : 'login-id');
    const pwEl = document.getElementById(isFromForm ? 'form-login-pw' : 'login-pw');
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

    toggleClientAuthUI(); renderClientMyPage(); syncFormStateUI();
    if (isFromForm) goToClientStep(2);
}

function performClientLogout() {
    const auth = window.AppState.clientAuth;
    auth.loggedIn = false; auth.id = ''; auth.name = ''; auth.phone = ''; auth.sentCode = null; auth.phoneVerified = false;

    ['form-client-name','form-client-phone','form-client-code','form-signup-id','form-signup-pw','form-signup-pw2','form-login-id','form-login-pw','login-id','login-pw'].forEach(id => safeUpdateValue(id, ''));
    document.getElementById('form-auth-code-wrapper')?.classList.add('hidden');
    document.getElementById('form-signup-account-fields')?.classList.add('hidden');
    switchClientAuthTab('login');

    toggleClientAuthUI(); syncFormStateUI();
    showToast("로그아웃 되었습니다.", "info");
}

function toggleClientAuthUI() {
    const auth = window.AppState.clientAuth;
    const gateway = document.getElementById('client-mypage-gateway');
    const dashboard = document.getElementById('client-mypage-dashboard');
    const unverifiedCard = document.getElementById('form-auth-unverified');
    const verifiedCard = document.getElementById('form-auth-verified');
    const verifiedUserInfo = document.getElementById('form-verified-user-info');

    if (auth.loggedIn) {
        unverifiedCard?.classList.add('hidden');
        if (verifiedCard) { verifiedCard.classList.remove('hidden'); if (verifiedUserInfo) verifiedUserInfo.innerText = `로그인 완료: ${auth.name} (${auth.id})`; }
    } else {
        unverifiedCard?.classList.remove('hidden');
        verifiedCard?.classList.add('hidden');
    }

    if (auth.loggedIn) { gateway?.classList.add('hidden'); if (dashboard) { dashboard.classList.remove('hidden'); renderClientMyPage(); } }
    else { gateway?.classList.remove('hidden'); dashboard?.classList.add('hidden'); }
}

function renderClientMyPage() {
    const listContainer = document.getElementById('client-mypage-estimates-container');
    const detailEmpty = document.getElementById('client-mypage-detail-empty');
    const detailBoard = document.getElementById('client-mypage-detail-board');
    if (!listContainer) return;

    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;

    const myOrders = window.AppState.orders.filter(o => o.clientPhone === auth.phone);

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
        if (order.is1on1) statusBadge = `<span class="badge badge-neutral"><span class="badge-dot bg-ink-950"></span> ⚡ 1:1 지정 [${order.targetPartner}]</span>`;
        else if (order.status === 'bidding') {
            statusBadge = order.isHighBudgetAdminPending
                ? `<span class="badge badge-gold"><span class="badge-dot bg-gold-500"></span> 💰 7천만+ 본사 배정 대기</span>`
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

            bidsHtml += `
                <div class="p-4 rounded-2xl border ${isContracted ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/40' : 'border-ink-100 bg-ink-50/70'} text-left space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-ink-950 cursor-pointer hover:underline" onclick="openPartnerPortfolioModal('${bid.partner}')">${bid.partner}</span>
                            <span class="text-gold-500 font-extrabold text-xs">★ ${ratingVal}</span>
                        </div>
                        <span class="font-black text-ink-950 text-sm">₩ ${bid.price.toLocaleString()} 만원</span>
                    </div>
                    <p class="text-xs text-ink-600 font-semibold leading-relaxed">${bid.desc}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-ink-100">
                        <button type="button" onclick="openPartnerPortfolioModal('${bid.partner}')" class="btn btn-ghost btn-sm px-0">🎨 시공 포트폴리오 및 후기</button>
                        ${order.status === 'contracted' ? (isContracted ? `
                            <span class="badge badge-emerald">✓ 안심 계약 체결사</span>
                        ` : `<span class="text-[10px] font-bold text-ink-400">계약 마감</span>`) : `
                            <button type="button" onclick="clientFinalizeContract('${order.code}', '${bid.partner}', ${bid.price})" class="btn btn-dark btn-sm">이 파트너와 계약 체결하기</button>
                        `}
                    </div>
                </div>`;
        });
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
        reviewBtnHtml = `<div class="p-3 bg-ink-100 rounded-xl text-center text-xs font-bold text-ink-600">✅ 솔직 안심 리뷰 생성이 성공적으로 등록 완료되었습니다.</div>`;
    }

    const designationBannerHtml = `
        <div class="wj-dark-card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative">
            <div class="space-y-0.5 relative z-10">
                <span class="text-[10px] text-gold-500 font-extrabold uppercase tracking-wider">⚡ 1:1 전속 지정 상담 혜택</span>
                <p class="text-xs font-black">원하는 우수 파트너사를 1:1 지정하여 단독 견적을 추가로 받아보세요!</p>
            </div>
            <button type="button" onclick="switchPanel('partner-search-panel')" class="btn btn-lg relative z-10 whitespace-nowrap" style="background:#e7b346;color:var(--ink-950)">우수 파트너 1:1 지정하기 →</button>
        </div>`;

    detailBoard.innerHTML = `
        <div class="space-y-6 text-left">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                <div class="space-y-1">
                    <span class="px-2 py-0.5 text-[9px] font-mono font-black bg-ink-100 text-ink-700 rounded border border-ink-200">${order.code}</span>
                    <h3 class="text-base sm:text-lg font-black text-ink-950">${order.clientAddress}</h3>
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
                <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="building" class="w-4 h-4 text-brand-500"></i> 연결된 안심 파트너 제안서 목록 (${order.bids ? order.bids.length : 0})</h4>
                <div class="space-y-3">${bidsHtml}</div>
            </div>
        </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function triggerRebidding(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    showToast("⚡ 새로운 파트너사에 입찰 매칭을 재요청했습니다.", "info");
}

function handleHome1on1Click() {
    const auth = window.AppState.clientAuth;
    const userOrders = window.AppState.orders.filter(o => auth.loggedIn && o.clientPhone === auth.phone);

    if (!auth.loggedIn || userOrders.length === 0) {
        showToast("⚡ 1:1 지정 매칭은 먼저 간편 견적 신청(자동 매칭)을 완료하신 후 가능합니다.\n견적 신청 페이지로 이동합니다.", "warning");
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

    safeUpdateText('write-review-project-name', `프로젝트 번호: ${order.code} · ${order.acceptedPartner || ''}`);
    safeUpdateValue('input-review-text', '');
    const grid = document.getElementById('review-photo-preview-grid');
    if (grid) grid.innerHTML = '';

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

function handleReviewPhotoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const grid = document.getElementById('review-photo-preview-grid');
    Array.from(input.files).slice(0, 6 - window.AppState.reviewPhotoDrafts.length).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            window.AppState.reviewPhotoDrafts.push(e.target.result);
            if (grid) {
                const wrap = document.createElement('div');
                wrap.className = 'relative aspect-square rounded-xl overflow-hidden border border-ink-100 bg-ink-50';
                wrap.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
                grid.appendChild(wrap);
            }
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
            date: new Date().toISOString().split('T')[0],
            photos: window.AppState.reviewPhotoDrafts.slice()
        });
        const total = partner.reviews.reduce((acc, r) => acc + r.rating, 0);
        partner.rating = Math.round((total / partner.reviews.length) * 10) / 10;
    }

    order.reviewWritten = true;
    window.AppState.reviewPhotoDrafts = [];

    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW', `${maskName(order.clientName)} 고객님이 [${order.acceptedPartner}]에 대한 안심 후기를 등록함.`, 'SUCCESS');
    showToast("💚 소중한 안심 후기가 정상적으로 등록되었습니다. 감사합니다!", "success");

    closeReviewWriteModal();
    renderClientMyPage();
    selectMyPageEstimate(orderCode);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function clearSignatureCanvas() {}
function submitSignatureCanvas() {}

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
window.renderClientBids = renderClientBids;

window.sendClientAuthCode = sendClientAuthCode;
window.switchClientAuthTab = switchClientAuthTab;
window.verifyClientSignupPhone = verifyClientSignupPhone;
window.submitClientSignup = submitClientSignup;
window.loginClientWithId = loginClientWithId;
window.performClientLogout = performClientLogout;
window.toggleClientAuthUI = toggleClientAuthUI;
window.renderClientMyPage = renderClientMyPage;
window.selectMyPageEstimate = selectMyPageEstimate;
window.renderMyPageEstimateDetails = renderMyPageEstimateDetails;
window.triggerRebidding = triggerRebidding;
window.handleHome1on1Click = handleHome1on1Click;
window.showToast = showToast;

window.openReviewWriteModal = openReviewWriteModal;
window.closeReviewWriteModal = closeReviewWriteModal;
window.handleReviewPhotoUpload = handleReviewPhotoUpload;
window.submitClientReview = submitClientReview;

window.clearSignatureCanvas = clearSignatureCanvas;
window.submitSignatureCanvas = submitSignatureCanvas;
