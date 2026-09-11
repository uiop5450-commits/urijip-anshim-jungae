/**
 * ====================================================================
 * [partner_panel.js] 전역 패널 전환, 홈 이벤트 슬라이더, 파트너 탐색,
 * 파트너 콘솔(수급오더), 매니저 콘솔(고액배정/모니터링/블랙리스트/로그)
 * ====================================================================
 */

var safeUpdateValue = window.safeUpdateValue || function(id, val) { const el = document.getElementById(id); if (el) el.value = val; };
var safeUpdateText = window.safeUpdateText || function(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; };
var showToast = window.showToast || function(msg, type) { console.log(`[Toast] ${type || 'info'}: ${msg}`); };
var maskName = window.maskName || function(name) { if (!name) return ''; if (name.length <= 2) return name.charAt(0) + '*'; return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1); };
var maskPhone = window.maskPhone || function(phone) { if (!phone) return ''; return phone.replace(/(\d{3})-(\d{4})-\d{4}/, '$1-$2-****'); };
var escapeHtml = window.escapeHtml || function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

function maskAddress(addr) {
    if (!addr) return '';
    const parts = addr.split(' ');
    if (parts.length <= 3) return parts.join(' ') + ' ***';
    return parts.slice(0, 3).join(' ') + ' ****';
}

/* 플랫폼 중개 수수료율 — 관리자 KPI 집계(recalculateKPIs)와 파트너 성과 모달, 그리고
 * 파트너의 오더 상세 모달(수수료 결제)이 모두 이 값을 공유한다. */
const PLATFORM_COMMISSION_RATE = 0.03;

function openB2BAccessModal() { openModal('b2b-access-modal', 'b2b-access-modal-card'); }
function closeB2BAccessModal() { closeModal('b2b-access-modal', 'b2b-access-modal-card'); }
function accessB2BPanel(panelId) { closeB2BAccessModal(); switchPanel(panelId); }

/* 상단 '파트너 / 매니저 로그인' 버튼 — 파트너 또는 매니저로 로그인 중이면 로그아웃 버튼으로
 * 동작하고, 아니면 기존처럼 B2B 선택 모달을 연다. */
function handleB2BNavClick() {
    if (window.AppState.partnerLoggedIn) partnerLogout();
    else if (window.AppState.managerLoggedIn) managerLogout();
    else openB2BAccessModal();
}

function updateB2BNavButton() {
    const label = document.getElementById('nav-b2b-label');
    const labelM = document.getElementById('nav-b2b-label-m');
    if (!label || !labelM) return;
    if (window.AppState.partnerLoggedIn) {
        label.innerText = `${window.AppState.partnerName} 로그아웃`;
        labelM.innerText = '로그아웃';
    } else if (window.AppState.managerLoggedIn) {
        label.innerText = `${window.AppState.managerName} 로그아웃`;
        labelM.innerText = '로그아웃';
    } else {
        label.innerText = '파트너 / 매니저 로그인';
        labelM.innerText = 'B2B';
    }
}

/* 로그인이 필요한 패널(견적 신청/마이페이지)로 이동하려는데 아직 고객 로그인 전이면,
 * 전용 로그인 페이지(client-login-panel)로 대신 보내고 원래 가려던 패널을 기억해둔다.
 * 로그인/회원가입 성공 시 client_panel.js의 completePostLoginRedirect가 이어서 그
 * 패널로 보내준다. */
const CLIENT_AUTH_REQUIRED_PANELS = ['client-panel', 'client-mypage-panel'];

function switchPanel(panelId) {
    if (CLIENT_AUTH_REQUIRED_PANELS.includes(panelId) && !(window.AppState.clientAuth && window.AppState.clientAuth.loggedIn)) {
        if (typeof setPostLoginRedirect === 'function') setPostLoginRedirect(panelId);
        panelId = 'client-login-panel';
    }
    window.AppState.currentPanel = panelId;
    const panels = ['home-panel', 'client-panel', 'partner-search-panel', 'community-panel', 'client-login-panel', 'client-mypage-panel', 'partner-panel', 'admin-panel'];

    panels.forEach(p => {
        const el = document.getElementById(p);
        if (el) {
            if (p === panelId) {
                el.classList.remove('hidden');
                el.style.opacity = '0'; el.style.transform = 'translateY(10px)';
                setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0px)'; }, 20);
            } else { el.classList.add('hidden'); }
        }
        document.querySelectorAll(`[id^="tab-${p}"]`).forEach(tabEl => tabEl.classList.toggle('active', p === panelId));
    });

    if (panelId === 'home-panel') { renderHeroPortfolioSlider(); renderHomeEventSlider(); renderHeroTrustStats(); startHomeAutoplay(); }
    else { stopHomeAutoplay(); }
    if (panelId === 'partner-search-panel') renderPartnerSearchGrid();
    if (panelId === 'community-panel' && typeof renderCommunityList === 'function') renderCommunityList();
    if (panelId === 'client-mypage-panel') {
        if (typeof toggleClientAuthUI === 'function') toggleClientAuthUI();
        if (window.AppState.clientAuth && window.AppState.clientAuth.loggedIn && typeof renderClientMyPage === 'function') renderClientMyPage();
    }
    if (panelId === 'partner-panel') { togglePartnerConsoleVisibility(); if (typeof switchPartnerMode === 'function') switchPartnerMode('orders'); }
    if (panelId === 'admin-panel') {
        toggleManagerConsoleVisibility();
        window.AppState.selectedAdminPartner = null;
        if (window.AppState.managerLoggedIn) switchAdminMode(window.AppState.adminConsoleMode || 'allocation');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------------
 * 홈 이벤트 광고판(팜플렛) 슬라이더 — 데이터는 window.AppState.pamphlets, 매니저 콘솔 > 노출 관리에서 편집.
 * 팜플렛은 외부 디자인 툴(미리캔버스 등)에서 문구까지 완성한 이미지를 그대로 업로드하는 방식이라
 * 카드에는 별도 텍스트 오버레이 없이 이미지 원본만 노출하고, 클릭 시 큰 상세 페이지로 이동한다.
 * ---------------------------------------------------------------- */
/* evt(팜플렛 데이터)를 실제 카드 마크업으로 변환 — 실 슬라이더와 관리자 편집 미리보기가 동일 함수를 공유하여
 * "미리보기 = 실제 노출 화면" 을 보장한다. idx/total은 카운터 뱃지 표시용(옵션, 기본 1/1).
 * 광고판(카드)용 이미지(img)는 관리자가 광고판 권장 크기에 맞춰 미리 만들어 올린 것을 그대로 노출한다
 * (앱 안에서 별도로 확대/위치를 조정하지 않음 — 상세 페이지는 별도의 detailImg를 쓴다). */
function buildPamphletCardHtml(evt, idx = 0, total = 1) {
    const hasImg = !!(evt && evt.img);
    const title = escapeHtml((evt && evt.title) || '');
    return `
        <span class="event-tag">이벤트</span>
        ${hasImg
            ? `<img src="${evt.img}" alt="${title}" class="event-banner-img">`
            : `<div class="w-full h-full flex flex-col items-center justify-center gap-2 bg-ink-100 text-ink-400"><i data-lucide="image-plus" class="w-6 h-6"></i><p class="text-xs font-bold px-6 text-center">등록된 포스터 이미지가 없습니다</p></div>`}
        <span class="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-10 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-md text-white border border-white/20">${idx + 1} / ${total}</span>`;
}

function renderHomeEventSlider(direction) {
    const container = document.getElementById('home-event-slider-container');
    if (!container) return;
    const pamphlets = window.AppState.pamphlets || [];
    if (typeof window.AppState.currentHomeEventIndex !== 'number' || window.AppState.currentHomeEventIndex >= pamphlets.length) {
        window.AppState.currentHomeEventIndex = 0;
    }
    if (pamphlets.length === 0) {
        container.innerHTML = `<div class="h-full flex items-center justify-center"><p class="text-ink-400 text-xs font-bold">등록된 이벤트 팜플렛이 없습니다.</p></div>`;
        return;
    }

    const total = pamphlets.length;
    const currentIdx = window.AppState.currentHomeEventIndex;
    const evt = pamphlets[currentIdx];

    const frameHtml = `<div onclick="openPamphletDetail('${evt.id}')" class="event-banner h-full group transition-all duration-300">${buildPamphletCardHtml(evt, currentIdx, total)}</div>`;
    swapSlideFrame(container, frameHtml, direction);

    if (!container.querySelector('.hero-nav-btn.left')) {
        const navHtml = `
            <button type="button" onclick="prevHomeEvent(event)" class="hero-nav-btn left" aria-label="이전 이벤트"><i data-lucide="chevron-left" class="w-5 h-5 sm:w-6 sm:h-6"></i></button>
            <button type="button" onclick="nextHomeEvent(event)" class="hero-nav-btn right" aria-label="다음 이벤트"><i data-lucide="chevron-right" class="w-5 h-5 sm:w-6 sm:h-6"></i></button>`;
        container.insertAdjacentHTML('beforeend', navHtml);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 광고/이벤트 상세 페이지 — 파트너 시공사례 상세(portfolio-blog-modal)와 동일한 전체화면 크기로 열린다.
 * 상세페이지 이미지(detailImg)가 따로 등록되어 있으면 그것을, 없으면 광고판 이미지(img)를 대신 노출한다. */
function openPamphletDetail(pamphletId) {
    const pamphlets = window.AppState.pamphlets || [];
    const evt = pamphlets.find(e => e.id === pamphletId) || pamphlets[0];
    if (!evt) return;

    safeUpdateText('pamphlet-detail-title', evt.title || '');
    safeUpdateText('pamphlet-detail-body', evt.detail || evt.sub || '');

    const imgEl = document.getElementById('pamphlet-detail-img');
    const heroImg = evt.detailImg || evt.img;
    if (imgEl) {
        if (heroImg) {
            imgEl.src = heroImg;
            imgEl.alt = evt.title || '';
            imgEl.classList.remove('hidden');
        } else {
            imgEl.removeAttribute('src');
            imgEl.classList.add('hidden');
        }
    }

    openModal('pamphlet-detail-modal', 'pamphlet-detail-modal-card');
}
function closePamphletDetail() { closeModal('pamphlet-detail-modal', 'pamphlet-detail-modal-card'); }
function nextHomeEvent(e) { if (e) e.stopPropagation(); const total = (window.AppState.pamphlets || []).length || 1; const current = window.AppState.currentHomeEventIndex || 0; window.AppState.currentHomeEventIndex = (current + 1) % total; renderHomeEventSlider('next'); }
function prevHomeEvent(e) { if (e) e.stopPropagation(); const total = (window.AppState.pamphlets || []).length || 1; const current = window.AppState.currentHomeEventIndex || 0; window.AppState.currentHomeEventIndex = (current - 1 + total) % total; renderHomeEventSlider('prev'); }

/* ----------------------------------------------------------------
 * 홈 히어로 슬라이더 / 이벤트 배너 자동 전환
 * 두 슬라이더를 서로 다른 주기로 자동 넘김. 마우스를 올리면 일시정지,
 * 벗어나면 재개. 홈 패널을 벗어날 때는 타이머를 정리해 백그라운드에서
 * 계속 돌지 않도록 한다(switchPanel 참고).
 * ---------------------------------------------------------------- */
const HERO_AUTOPLAY_INTERVAL_MS = 5000;
const HOME_EVENT_AUTOPLAY_INTERVAL_MS = 5000;
// 히어로와 이벤트 배너가 동시에 넘어가면 두 슬라이드가 한번에 바뀌어 정신없어 보이므로,
// 이벤트 배너는 주기의 절반만큼 늦게 시작해 항상 서로 다른 시점에 넘어가게 한다.
const HOME_EVENT_AUTOPLAY_STAGGER_MS = HOME_EVENT_AUTOPLAY_INTERVAL_MS / 2;
let _heroAutoplayTimer = null;
let _homeEventAutoplayTimer = null;
let _homeEventAutoplayStartTimer = null;

function startHomeAutoplay() {
    stopHomeAutoplay();
    _heroAutoplayTimer = setInterval(() => nextHeroSlide(), HERO_AUTOPLAY_INTERVAL_MS);
    _homeEventAutoplayStartTimer = setTimeout(() => {
        _homeEventAutoplayStartTimer = null;
        _homeEventAutoplayTimer = setInterval(() => nextHomeEvent(), HOME_EVENT_AUTOPLAY_INTERVAL_MS);
    }, HOME_EVENT_AUTOPLAY_STAGGER_MS);
}

function stopHomeAutoplay() {
    if (_heroAutoplayTimer) { clearInterval(_heroAutoplayTimer); _heroAutoplayTimer = null; }
    if (_homeEventAutoplayTimer) { clearInterval(_homeEventAutoplayTimer); _homeEventAutoplayTimer = null; }
    if (_homeEventAutoplayStartTimer) { clearTimeout(_homeEventAutoplayStartTimer); _homeEventAutoplayStartTimer = null; }
}

function pauseHeroAutoplay() { if (_heroAutoplayTimer) { clearInterval(_heroAutoplayTimer); _heroAutoplayTimer = null; } }
function resumeHeroAutoplay() { if (!_heroAutoplayTimer && window.AppState.currentPanel === 'home-panel') _heroAutoplayTimer = setInterval(() => nextHeroSlide(), HERO_AUTOPLAY_INTERVAL_MS); }
function pauseHomeEventAutoplay() {
    if (_homeEventAutoplayTimer) { clearInterval(_homeEventAutoplayTimer); _homeEventAutoplayTimer = null; }
    if (_homeEventAutoplayStartTimer) { clearTimeout(_homeEventAutoplayStartTimer); _homeEventAutoplayStartTimer = null; }
}
function resumeHomeEventAutoplay() { if (!_homeEventAutoplayTimer && window.AppState.currentPanel === 'home-panel') _homeEventAutoplayTimer = setInterval(() => nextHomeEvent(), HOME_EVENT_AUTOPLAY_INTERVAL_MS); }

/* ----------------------------------------------------------------
 * 히어로 시공사례+업체 슬라이더 (최대 5개) / 파트너 탐색
 * ---------------------------------------------------------------- */
function getFeaturedHeroSlides(limit = 5) {
    // 매니저 콘솔 > 노출 관리에서 수동으로 지정한 업체가 있으면 그 순서 그대로 노출.
    // 지정해둔 이후 그 업체가 삼진아웃 등으로 제명될 수 있으므로, 여기서도 상태를
    // 다시 확인한다 — '안심' 플랫폼 첫 화면에 제명된 업체가 뜨면 신뢰도에 직결된다.
    const manual = window.AppState.featuredPartners || [];
    if (manual.length > 0) {
        return manual.slice(0, limit).map(item => {
            const p = (window.AppState.partners || []).find(pp => pp.name === item.partnerName);
            if (!p || p.status !== 'active' || !p.portfolios || !p.portfolios[item.portIdx]) return null;
            return {
                partnerName: p.name, portIdx: item.portIdx, rating: p.rating || 0,
                isCertified: !!p.isCertified, reviewsCount: p.reviews ? p.reviews.length : 0,
                ...p.portfolios[item.portIdx]
            };
        }).filter(Boolean);
    }
    // 수동 지정이 없으면 평점(rating) 높은 순으로 자동 선정 (폴백).
    const partners = (window.AppState.partners || []).filter(p => p.status === 'active' && p.portfolios && p.portfolios.length > 0);
    const sorted = [...partners].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return sorted.slice(0, limit).map(p => ({
        partnerName: p.name, portIdx: 0, rating: p.rating || 0,
        isCertified: !!p.isCertified, reviewsCount: p.reviews ? p.reviews.length : 0,
        ...p.portfolios[0]
    }));
}

// 히어로 카드용 고화질 이미지 URL 생성 (Unsplash 소스 URL의 w/q 파라미터를 카드 크기에 맞게 상향)
function heroHiResSrc(url, targetWidth) {
    if (!url) return url;
    const w = targetWidth || 1400;
    let out = /[?&]w=\d+/.test(url) ? url.replace(/([?&])w=\d+/, `$1w=${w}`) : url + (url.includes('?') ? '&' : '?') + `w=${w}`;
    out = /[?&]q=\d+/.test(out) ? out.replace(/([?&])q=\d+/, `$1q=85`) : out + `&q=85`;
    return out;
}

const SLIDE_TRANSITION_MS = 380;

/* 슬라이드 프레임(이미지+오버레이)만 좌우로 밀어내며 교체하는 공용 헬퍼.
 * 내비게이션 버튼·카운터처럼 매번 동일한 정적 요소는 그대로 두고, 콘텐츠 프레임만
 * translateX + opacity로 애니메이션한다. direction이 없으면(최초 렌더 등) 애니메이션 없이 즉시 교체. */
function swapSlideFrame(container, frameHtml, direction) {
    const oldFrame = container.querySelector(':scope > .hero-slide-frame');
    const newFrame = document.createElement('div');
    newFrame.className = 'hero-slide-frame';
    newFrame.style.position = 'absolute';
    newFrame.style.inset = '0';
    newFrame.innerHTML = frameHtml;

    if (!direction || !oldFrame) {
        if (oldFrame) oldFrame.remove();
        container.insertBefore(newFrame, container.firstChild);
        return;
    }

    const exitX = direction === 'next' ? '-100%' : '100%';
    const enterX = direction === 'next' ? '100%' : '-100%';
    oldFrame.style.transition = `transform ${SLIDE_TRANSITION_MS}ms ease, opacity ${SLIDE_TRANSITION_MS}ms ease`;
    oldFrame.style.transform = `translateX(${exitX})`;
    oldFrame.style.opacity = '0';

    newFrame.style.transform = `translateX(${enterX})`;
    newFrame.style.opacity = '0';
    container.insertBefore(newFrame, container.firstChild);

    // 강제 리플로우로 위 시작 위치를 브라우저가 먼저 반영하게 만든 뒤 전환을 건다.
    // requestAnimationFrame은 탭이 백그라운드일 때 지연/생략될 수 있어 대신 이 방식을 쓴다.
    void newFrame.offsetWidth;
    newFrame.style.transition = `transform ${SLIDE_TRANSITION_MS}ms ease, opacity ${SLIDE_TRANSITION_MS}ms ease`;
    newFrame.style.transform = 'translateX(0)';
    newFrame.style.opacity = '1';

    setTimeout(() => oldFrame.remove(), SLIDE_TRANSITION_MS + 40);
}

function renderHeroPortfolioSlider(direction) {
    const container = document.getElementById('hero-portfolio-slider-container');
    if (!container) return;

    const slides = getFeaturedHeroSlides(5);
    if (slides.length === 0) {
        container.innerHTML = `<div class="hero-a-empty"><p class="text-ink-400 text-xs font-bold">등록된 시공사례가 아직 없습니다.</p></div>`;
        return;
    }
    if (typeof window.AppState.currentHeroSlideIndex !== 'number' || window.AppState.currentHeroSlideIndex >= slides.length) {
        window.AppState.currentHeroSlideIndex = 0;
    }
    const idx = window.AppState.currentHeroSlideIndex;
    const total = slides.length;
    const slide = slides[idx];
    const safeName = slide.partnerName.replace(/'/g, "\\'");
    const safeTitle = escapeHtml(slide.title);
    const safePartnerName = escapeHtml(slide.partnerName);

    const frameHtml = `
        <img src="${heroHiResSrc(slide.img, 1400)}" alt="${safeTitle}">
        <div class="hero-a-plate" onclick="openPortfolioBlogDetail('${safeName}', ${slide.portIdx})" role="button" tabindex="0">
            <div class="min-w-0">
                <p class="hero-a-plate-title truncate">${safeTitle}</p>
                <p class="hero-a-plate-sub truncate">${safePartnerName}</p>
            </div>
            <span class="hero-a-plate-rate">★ ${slide.rating.toFixed(1)}</span>
        </div>`;
    swapSlideFrame(container, frameHtml, direction);

    if (!container.querySelector('.hero-nav-btn.left')) {
        const navHtml = `
            <button type="button" onclick="prevHeroSlide(event)" class="hero-nav-btn left" aria-label="이전 시공사례"><i data-lucide="chevron-left" class="w-5 h-5 sm:w-6 sm:h-6"></i></button>
            <button type="button" onclick="nextHeroSlide(event)" class="hero-nav-btn right" aria-label="다음 시공사례"><i data-lucide="chevron-right" class="w-5 h-5 sm:w-6 sm:h-6"></i></button>
            <span id="hero-slide-counter" class="absolute top-3 right-3 sm:top-4 sm:right-4 z-[2] text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-md text-white border border-white/20"></span>`;
        container.insertAdjacentHTML('beforeend', navHtml);
    }
    safeUpdateText('hero-slide-counter', `${idx + 1} / ${total}`);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 히어로 좌측 패널의 신뢰지표(누적 매칭/인증 파트너/평균 평점) — AppState에서 직접 계산해서
 * 항상 실제 데이터와 일치시킨다(하드코딩된 숫자로 고정 노출하지 않음). */
function renderHeroTrustStats() {
    const orders = window.AppState.orders || [];
    const partners = window.AppState.partners || [];
    const certifiedPartners = partners.filter(p => p.isCertified && p.status === 'active');
    const rated = certifiedPartners.filter(p => p.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((sum, p) => sum + p.rating, 0) / rated.length).toFixed(1) : '-';

    safeUpdateText('hero-a-stat-orders', String(orders.length));
    safeUpdateText('hero-a-stat-partners', String(certifiedPartners.length));
    safeUpdateText('hero-a-stat-rating', avgRating);
}

function nextHeroSlide(e) {
    if (e) e.stopPropagation();
    const total = getFeaturedHeroSlides(5).length || 1;
    window.AppState.currentHeroSlideIndex = ((window.AppState.currentHeroSlideIndex || 0) + 1) % total;
    renderHeroPortfolioSlider('next');
}
function prevHeroSlide(e) {
    if (e) e.stopPropagation();
    const total = getFeaturedHeroSlides(5).length || 1;
    window.AppState.currentHeroSlideIndex = ((window.AppState.currentHeroSlideIndex || 0) - 1 + total) % total;
    renderHeroPortfolioSlider('prev');
}

let partnerSearchRegionFilter = 'all';
function setPartnerSearchRegion(region) {
    partnerSearchRegionFilter = region;
    renderPartnerSearchGrid();
}

function renderPartnerSearchGrid() {
    const container = document.getElementById('partner-search-grid');
    if (!container) return;
    const input = document.getElementById('partner-search-input');
    const query = input ? input.value.trim().toLowerCase() : '';
    const sortSelect = document.getElementById('partner-search-sort');
    const sortMode = sortSelect ? sortSelect.value : 'rating';

    // 입점 심사 대기(pending)·제명(banned) 파트너는 고객 대상 공개 탐색 페이지에 노출하지 않는다.
    const allPartners = (window.AppState.partners || []).filter(p => p.status !== 'pending' && p.status !== 'banned');

    // 지역 필터 칩 — 실제 등록된 파트너들의 지역만 모아 중복 없이 노출한다.
    const regionChipsEl = document.getElementById('partner-search-region-chips');
    if (regionChipsEl) {
        const regions = [...new Set(allPartners.map(p => p.region).filter(Boolean))].sort();
        const chips = [['all', '전체 지역'], ...regions.map(r => [r, r])];
        regionChipsEl.innerHTML = chips.map(([key, label]) =>
            `<button type="button" onclick="setPartnerSearchRegion('${key}')" class="region-chip ${partnerSearchRegionFilter === key ? 'active' : ''}"><i data-lucide="map-pin" class="w-3 h-3"></i>${label}</button>`
        ).join('');
    }

    const filtered = allPartners
        .filter(p => partnerSearchRegionFilter === 'all' || p.region === partnerSearchRegionFilter)
        .filter(p => !query || p.name.toLowerCase().includes(query) || (p.region && p.region.toLowerCase().includes(query)) || (p.promoSlogan && p.promoSlogan.toLowerCase().includes(query)))
        .sort((a, b) => sortMode === 'reviews'
            ? (b.reviews ? b.reviews.length : 0) - (a.reviews ? a.reviews.length : 0)
            : b.rating - a.rating);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-ink-400 font-bold py-12 text-center col-span-full">검색된 파트너사가 없습니다.</p>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(p => {
        const samplePort = p.portfolios && p.portfolios.length > 0 ? p.portfolios[0] : null;
        const repImg = (p.heroImages && p.heroImages.length > 0) ? p.heroImages[0] : (samplePort ? samplePort.img : 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=60');
        const safePName = escapeHtml(p.name);
        const slogan = p.promoSlogan ? escapeHtml(p.promoSlogan) : `${safePName} - 부산 지역 대표 인테리어`;
        const promo = p.promoText ? escapeHtml(p.promoText) : (p.desc ? escapeHtml(p.desc) : '검증된 1군 실내건축 종합면허 보유사입니다.');
        const certifiedBadge = p.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 인증</span>` : '';
        const portfolioCount = p.portfolios ? p.portfolios.length : 0;
        const metaParts = [];
        if (p.region) metaParts.push(`<span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>부산 ${escapeHtml(p.region)}</span>`);
        metaParts.push(`<span>완공사례 ${portfolioCount}건</span>`);

        const isFavorited = typeof window.isFavoritePartner === 'function' && window.isFavoritePartner(p.name);

        const card = document.createElement('div');
        card.className = "portfolio-card flex flex-col justify-between group";
        card.onclick = (e) => { e.preventDefault(); if (typeof window.openClientPartnerProfile === 'function') window.openClientPartnerProfile(p.name); };
        card.innerHTML = `
            <div>
                <div class="portfolio-img relative">
                    <img src="${repImg}" alt="${safePName}">
                    <button type="button" onclick="event.stopPropagation(); toggleFavoritePartner('${p.name}')" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center border-0 cursor-pointer shadow-sm" aria-label="관심 파트너로 저장"><i data-lucide="heart" class="w-4 h-4 ${isFavorited ? 'text-roseCustom' : 'text-ink-300'}" ${isFavorited ? 'fill="currentColor"' : ''}></i></button>
                </div>
                <div class="p-5 space-y-2">
                    <div class="flex justify-between items-center gap-2">
                        <h4 class="text-sm font-black text-ink-950 truncate flex items-center gap-1.5"><span>${safePName}</span>${certifiedBadge}</h4>
                        <div class="flex items-center gap-1 text-xs font-extrabold text-ink-800 shrink-0"><span class="text-gold-500">★</span><span>${p.rating.toFixed(1)}</span></div>
                    </div>
                    <p class="text-[10.5px] text-ink-400 font-bold flex items-center gap-1.5">${metaParts.join('<span class="text-ink-200">·</span>')}</p>
                    <p class="text-xs text-ink-800 font-bold leading-relaxed line-clamp-1">${slogan}</p>
                    <p class="text-[11px] text-ink-500 font-medium leading-relaxed line-clamp-2">${promo}</p>
                </div>
            </div>
            <div class="px-5 pb-4 pt-2 flex items-center justify-between border-t border-ink-100 text-xs font-bold text-ink-500 group-hover:text-ink-950 transition-colors">
                <span>포트폴리오 및 1:1 상담</span><span>→</span>
            </div>`;
        container.appendChild(card);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------------
 * 매니저(관리자) 콘솔 — 역할별 접근 권한(관리자모드 / 파트너 매니저 권한)
 * ---------------------------------------------------------------- */
const ALL_ADMIN_TABS = [
    ['allocation', 'wallet', '수동 오더 배정관'], ['monitor', 'building-2', '파트너 모니터링'],
    ['applications', 'clipboard-check', '파트너 가입 심사'],
    ['blacklist', 'shield-alert', '삼진아웃 블랙리스트 DB'], ['logs', 'list', '플랫폼 관제 로그'],
    ['display', 'image', '노출 관리'], ['staff', 'users', '직원 권한 관리'],
    ['community', 'flag', '커뮤니티 관리'], ['support', 'inbox', '고객 문의'],
    ['broadcast', 'megaphone', '전체 공지 발송'], ['clients', 'users-round', '고객 관리'],
    ['cancellations', 'ban', '계약 취소 심사']
];

// 'super_admin'은 전체 탭에 접근 가능. 'partner_manager'는 고액 오더 배정(재무),
// 시스템 로그, 마케팅 노출 관리, 직원 권한 부여처럼 상위 권한이 필요한 영역은
// 제외하고 파트너 관리 업무(모니터링/가입 심사/블랙리스트)만 접근할 수 있다.
const ROLE_TAB_ACCESS = {
    super_admin: ['allocation', 'monitor', 'applications', 'blacklist', 'logs', 'display', 'staff', 'community', 'support', 'broadcast', 'clients', 'cancellations'],
    partner_manager: ['monitor', 'applications', 'blacklist']
};

function getAdminAllowedTabs() {
    const role = window.AppState.managerRole || 'super_admin';
    return ROLE_TAB_ACCESS[role] || ROLE_TAB_ACCESS.super_admin;
}

function switchAdminMode(mode) {
    const allowedTabs = getAdminAllowedTabs();
    if (!allowedTabs.includes(mode)) {
        showToast('이 메뉴는 최고관리자만 접근할 수 있어요.', 'warning');
        mode = allowedTabs[0];
    }
    window.AppState.adminConsoleMode = mode;
    const tabBar = document.getElementById('admin-console-tab-bar');
    if (tabBar) {
        const pendingCount = (window.AppState.partners || []).filter(p => p.status === 'pending').length;
        const openTicketCount = (window.AppState.supportTickets || []).filter(t => t.status === 'open').length;
        const cancelRequestCount = (window.AppState.orders || []).filter(o => o.status === 'cancel_requested').length;
        const tabs = ALL_ADMIN_TABS.filter(([id]) => allowedTabs.includes(id)).map(([id, icon, label]) => {
            let finalLabel = label;
            if (id === 'applications' && pendingCount > 0) finalLabel = `${label} (${pendingCount})`;
            else if (id === 'support' && openTicketCount > 0) finalLabel = `${label} (${openTicketCount})`;
            else if (id === 'cancellations' && cancelRequestCount > 0) finalLabel = `${label} (${cancelRequestCount})`;
            return [id, icon, finalLabel];
        });
        tabBar.innerHTML = tabs.map(([id, icon, label]) => `<button type="button" id="btn-admin-view-${id}" onclick="switchAdminMode('${id}')" class="gnb-tab ${mode === id ? 'active' : ''}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${label}</button>`).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    ['allocation', 'monitor', 'applications', 'blacklist', 'logs', 'display', 'staff', 'community', 'support', 'broadcast', 'clients', 'cancellations'].forEach(m => document.getElementById(`admin-mode-${m}-view`)?.classList.add('hidden'));
    document.getElementById(`admin-mode-${mode}-view`)?.classList.remove('hidden');

    const kpiGrid = document.getElementById('admin-kpi-grid');
    if (kpiGrid) kpiGrid.classList.toggle('hidden', window.AppState.managerRole === 'partner_manager');

    if (mode === 'allocation') renderAdminOrderAllocation();
    else if (mode === 'monitor') renderAdminPartnerMonitor();
    else if (mode === 'applications') renderAdminPartnerApplications();
    else if (mode === 'blacklist') renderBlacklistDb();
    else if (mode === 'logs') syncAuditLogs();
    else if (mode === 'display') renderAdminDisplayManager();
    else if (mode === 'staff') renderAdminStaffManager();
    else if (mode === 'community' && typeof renderAdminCommunityModeration === 'function') renderAdminCommunityModeration();
    else if (mode === 'support' && typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
    else if (mode === 'clients') renderAdminClientManager();
    else if (mode === 'cancellations') renderAdminContractCancellations();

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function validateManagerLogin() {
    const idInput = document.getElementById('admin-login-id');
    const pwInput = document.getElementById('admin-login-pw');
    const errorMsg = document.getElementById('admin-login-error-msg');
    if (!idInput || !pwInput) return;

    const idVal = idInput.value.trim();
    const pwVal = pwInput.value.trim();

    if (!idVal || !pwVal) {
        showInlineLoginError(errorMsg, "매니저 아이디와 비밀번호를 모두 입력해주세요.");
        return;
    }

    const account = (window.AppState.clientAccounts || []).find(a => a.id === idVal && a.pw === pwVal);
    if (!account || !account.managerRole) {
        showInlineLoginError(errorMsg, "매니저 권한이 없는 계정이거나 아이디·비밀번호가 일치하지 않습니다.");
        return;
    }

    window.AppState.managerLoggedIn = true;
    window.AppState.managerName = account.name;
    window.AppState.managerRole = account.managerRole;
    errorMsg?.classList.add('hidden');
    toggleManagerConsoleVisibility();
    updateB2BNavButton();
    const roleLabel = account.managerRole === 'super_admin' ? '최고관리자' : '파트너 매니저';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'AUTH', `'${account.name}'(${roleLabel}) 매니저 계정 접속 승인.`, 'SUCCESS');
    showToast(`${roleLabel} '${account.name}'님, 매니저 센터 대시보드에 진입했습니다.`, "success");
}

function managerLogout() {
    window.AppState.managerLoggedIn = false;
    window.AppState.managerName = '';
    window.AppState.managerRole = null;
    toggleManagerConsoleVisibility();
    updateB2BNavButton();
    showToast('매니저 센터에서 안전하게 로그아웃 되었습니다.', 'info');
}

function toggleManagerConsoleVisibility() {
    const gatewayBox = document.getElementById('admin-gateway-container');
    const consoleBox = document.getElementById('admin-console');
    if (!gatewayBox || !consoleBox) return;

    if (window.AppState.managerLoggedIn) {
        gatewayBox.classList.add('hidden'); consoleBox.classList.remove('hidden');
        recalculateKPIs();

        const badge = document.getElementById('admin-manager-badge');
        if (badge) {
            const isSuperAdmin = window.AppState.managerRole === 'super_admin';
            badge.innerHTML = `<span class="badge ${isSuperAdmin ? 'badge-brand' : 'badge-neutral'} flex items-center gap-1"><i data-lucide="${isSuperAdmin ? 'crown' : 'user-cog'}" class="w-3 h-3"></i>${isSuperAdmin ? '최고관리자' : '파트너 매니저'} · ${escapeHtml(window.AppState.managerName)}</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        const allowedTabs = getAdminAllowedTabs();
        const desiredMode = window.AppState.adminConsoleMode || 'allocation';
        switchAdminMode(allowedTabs.includes(desiredMode) ? desiredMode : allowedTabs[0]);
    } else { consoleBox.classList.add('hidden'); gatewayBox.classList.remove('hidden'); }
}

function togglePartnerConsoleVisibility() {
    const gatewayBox = document.getElementById('partner-gateway-container');
    const consoleBox = document.getElementById('partner-console');
    const tabBar = document.getElementById('partner-console-tab-bar');
    if (!gatewayBox || !consoleBox) return;

    if (window.AppState.partnerLoggedIn) {
        gatewayBox.classList.add('hidden'); consoleBox.classList.remove('hidden');
        const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
        const partner = window.AppState.partners.find(p => p.name === partnerName);
        if (partner) {
            const strikeText = partner.strikeCount > 0 ? `${partner.strikeCount}진 아웃` : '정상';
            const strikeDotColor = partner.strikeCount > 0 ? 'bg-amberCustom' : 'bg-emeraldCustom';
            const certifiedBadge = partner.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 우리집 인증 파트너</span>` : '';

            const titleEl = document.getElementById('partner-header-title');
            if (titleEl) {
                titleEl.innerHTML = `
                    <div class="flex flex-wrap items-center gap-2.5">
                        <span class="font-black text-ink-950 text-sm md:text-base leading-none">${partner.name} 콘솔</span>
                        ${certifiedBadge}
                        <span onclick="window.openClientPartnerProfile('${partner.name}')" class="cursor-pointer inline-flex items-center gap-1 text-xs hover:opacity-80 transition-all" title="클릭 시 안심 리뷰 및 프로필 확인">
                            <span class="text-gold-500 font-extrabold text-xs leading-none">★</span>
                            <span class="text-ink-800 font-bold leading-none">${partner.rating.toFixed(1)}</span>
                            <span class="text-ink-300 mx-0.5">|</span>
                            <span class="text-ink-500 font-bold leading-none">리뷰 ${partner.reviews ? partner.reviews.length : 0}</span>
                        </span>
                        <span class="badge badge-neutral"><span class="badge-dot ${strikeDotColor}"></span>${strikeText}</span>
                    </div>`;
            }
            if (tabBar) {
                tabBar.innerHTML = `
                    <button type="button" id="btn-partner-view-orders" onclick="switchPartnerMode('orders')" class="gnb-tab active">수급 오더 관리</button>
                    <button type="button" id="btn-partner-view-contracts" onclick="switchPartnerMode('contracts')" class="gnb-tab">안심 계약·입찰 내역</button>
                    <button type="button" id="btn-partner-view-performance" onclick="switchPartnerMode('performance')" class="gnb-tab">내 실적</button>
                    <button type="button" id="btn-partner-view-portfolio" onclick="switchPartnerMode('portfolio')" class="gnb-tab">포트폴리오 관리</button>
                    <button type="button" id="btn-partner-view-myinfo" onclick="switchPartnerMode('myinfo')" class="gnb-tab">내정보 관리</button>
                    <button type="button" id="btn-partner-view-notifications" onclick="switchPartnerMode('notifications')" class="gnb-tab">알림<span id="partner-notif-badge-count"></span></button>
                    <button type="button" onclick="partnerLogout()" class="btn btn-ghost btn-sm"><i data-lucide="log-out" class="w-3.5 h-3.5"></i> 퇴근</button>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                if (typeof updatePartnerNotificationBadge === 'function') updatePartnerNotificationBadge();
            }
        }
    } else { consoleBox.classList.add('hidden'); gatewayBox.classList.remove('hidden'); }
}

/* 파트너 콘솔 > 알림 탭 — 새 오더 매칭/계약 체결/후기 등록/경고·제명 시
 * pushPartnerNotification()으로 쌓인 개인 알림을 나열한다. 고객 마이페이지의
 * 알림 탭(renderClientMyPageNotifications)과 동일한 타임라인 형식을 그대로 쓴다. */
function renderPartnerNotifications() {
    const container = document.getElementById('partner-notifications-container');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const myNotifications = (window.AppState.partnerNotifications || []).filter(n => n.partnerName === partnerName);

    if (myNotifications.length === 0) {
        container.innerHTML = buildEmptyStateHtml('bell', '아직 도착한 알림이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = `<div class="notif-timeline">` + myNotifications.map((n, idx) => {
        const d = new Date(n.date);
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const isLast = idx === myNotifications.length - 1;
        return `
        <div class="notif-tl-item ${n.read ? '' : 'cursor-pointer'}" ${n.read ? '' : `onclick="markPartnerNotificationRead('${n.id}')"`}>
            <div class="notif-tl-marker">
                <span class="notif-tl-dot ${n.read ? 'read' : ''}"><i data-lucide="bell" class="w-3 h-3"></i></span>
                ${isLast ? '' : '<span class="notif-tl-line"></span>'}
            </div>
            <div class="notif-tl-body ${isLast ? '' : 'has-line'}">
                <p class="text-xs font-bold text-ink-800 leading-relaxed">${escapeHtml(n.message)}</p>
                <p class="text-[10px] text-ink-400 font-bold mt-0.5">${dateLabel}${n.read ? '' : ' · <span class="text-brand-600">탭하여 읽음 처리</span>'}</p>
            </div>
        </div>`;
    }).join('') + `</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function markAllPartnerNotificationsRead() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    (window.AppState.partnerNotifications || []).forEach(n => { if (n.partnerName === partnerName) n.read = true; });
    renderPartnerNotifications();
    updatePartnerNotificationBadge();
}

/* 고객측(markClientNotificationRead)과 동일하게, 알림 하나만 확인했는지 구분할
 * 방법이 없어서 전체 읽음 처리만 가능했던 공백을 해소한다. */
function markPartnerNotificationRead(notifId) {
    const notif = (window.AppState.partnerNotifications || []).find(n => n.id === notifId);
    if (!notif || notif.read) return;
    notif.read = true;
    renderPartnerNotifications();
    updatePartnerNotificationBadge();
}

/* 콘솔 탭 버튼에 안 읽은 알림 개수를 표시한다. 탭 전체 재생성 없이 배지 텍스트만
 * 갱신하므로 pushPartnerNotification 등에서 가볍게 호출할 수 있다. */
function updatePartnerNotificationBadge() {
    const badge = document.getElementById('partner-notif-badge-count');
    if (!badge) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const unreadCount = (window.AppState.partnerNotifications || []).filter(n => n.partnerName === partnerName && !n.read).length;
    badge.textContent = unreadCount > 0 ? ` (${unreadCount})` : '';
}

/* 로그인 폼 인라인 에러 — 이전엔 메시지 문구에 ⚠️/❌/⏳ 이모지를 박아 넣었는데,
 * 앱 전체가 lucide 아이콘 체계로 정리된 뒤 이 자리만 남아있던 것을 통일한다. */
let reapplyTargetPartnerId = null;

function openPartnerReapplyModal() {
    const partner = (window.AppState.partners || []).find(p => p.id === reapplyTargetPartnerId);
    if (!partner || partner.status !== 'rejected') { showToast('재신청 대상 계정을 찾을 수 없습니다.', 'warning'); return; }
    safeUpdateText('partner-reapply-reason-text', partner.rejectReason || '매니저 센터 검토 결과 반려');
    const fileInput = document.getElementById('partner-reapply-bizcert-input');
    if (fileInput) fileInput.value = '';
    safeUpdateValue('partner-reapply-memo', '');
    openModal('partner-reapply-modal', 'partner-reapply-modal-card');
}

function closePartnerReapplyModal() {
    closeModal('partner-reapply-modal', 'partner-reapply-modal-card');
}

function submitPartnerReapplication() {
    const partner = (window.AppState.partners || []).find(p => p.id === reapplyTargetPartnerId);
    if (!partner || partner.status !== 'rejected') { closePartnerReapplyModal(); return; }

    const finalize = () => {
        partner.status = 'pending';
        partner.appliedAt = new Date().toLocaleString('ko-KR');
        const memo = document.getElementById('partner-reapply-memo')?.value.trim();
        const prevReason = partner.rejectReason;
        partner.rejectReason = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'REAPPLY', `[${partner.name}](${partner.id})가 입점 재신청했습니다. (이전 반려 사유: ${prevReason || '-'}${memo ? ' | 보완 메모: ' + memo : ''})`, 'INFO');
        showToast('재신청이 접수되었습니다. 매니저 센터의 재심사 후 결과를 안내드릴게요.', 'success');
        closePartnerReapplyModal();
        document.getElementById('partner-reapply-btn')?.classList.add('hidden');
        document.getElementById('login-error-msg')?.classList.add('hidden');
        reapplyTargetPartnerId = null;
        if (typeof renderAdminPartnerApplications === 'function') renderAdminPartnerApplications();
    };

    const file = document.getElementById('partner-reapply-bizcert-input')?.files[0];
    if (!file) { finalize(); return; }
    if (file.size > 15 * 1024 * 1024) { showToast('파일 용량은 15MB 이하로 올려주세요.', 'warning'); return; }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { showToast('이미지 또는 PDF 파일만 업로드할 수 있어요.', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        partner.bizCertDoc = { name: file.name, uploadedAt: new Date().toLocaleString('ko-KR'), dataUrl: e.target.result };
        finalize();
    };
    reader.onerror = () => showToast('파일을 읽는 중 문제가 발생했습니다. 다시 시도해주세요.', 'error');
    reader.readAsDataURL(file);
}

function showInlineLoginError(errorMsg, message, icon = 'alert-triangle') {
    if (!errorMsg) return;
    const iconEl = errorMsg.querySelector('[data-lucide]');
    const textEl = errorMsg.querySelector('span');
    if (iconEl) iconEl.setAttribute('data-lucide', icon);
    if (textEl) textEl.innerText = message;
    errorMsg.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function validatePartnerLogin() {
    const idInput = document.getElementById('partner-login-id');
    const pwInput = document.getElementById('partner-pw');
    const errorMsg = document.getElementById('login-error-msg');
    if (!idInput || !pwInput) return;

    document.getElementById('partner-reapply-btn')?.classList.add('hidden');
    const partner = window.AppState.partners.find(p => p.id === idInput.value.trim() && p.pw === pwInput.value.trim());

    if (partner) {
        if (partner.status === 'banned') {
            showToast("귀사는 삼진아웃 누적 초과(3회 이상 적발)로 인해 영구 제명 처리되었습니다.", "warning");
            showInlineLoginError(errorMsg, "삼진아웃제 규정에 따라 영구 제명 처리된 불량 사업자망 계정입니다.", 'ban');
            return;
        }
        if (partner.status === 'pending') {
            showToast("아직 매니저 센터의 입점 심사가 진행 중인 계정입니다. 사업자등록증 확인 후 승인되면 로그인하실 수 있어요.", "info");
            showInlineLoginError(errorMsg, "입점 신청 검토 대기 중입니다. 승인 완료 후 로그인해 주세요.", 'clock');
            return;
        }
        if (partner.status === 'rejected') {
            showToast(`입점 신청이 반려되었습니다.${partner.rejectReason ? ' 사유: ' + partner.rejectReason : ''}`, "warning");
            showInlineLoginError(errorMsg, "입점 신청이 반려된 계정입니다.", 'x-circle');
            // 지금까지는 반려되면 영구히 재신청할 방법이 없어서 새 아이디로 재가입해야 했다 —
            // 로그인 폼에 재신청 버튼을 노출해 같은 계정으로 다시 심사받을 수 있게 한다.
            reapplyTargetPartnerId = partner.id;
            document.getElementById('partner-reapply-btn')?.classList.remove('hidden');
            return;
        }
        window.AppState.partnerLoggedIn = true;
        window.AppState.partnerName = partner.name;
        errorMsg?.classList.add('hidden');
        togglePartnerConsoleVisibility();
        updateB2BNavButton();
        pushLog('PARTNER', 'AUTH', `'${partner.name}' 마스터 로그인 완료.`, 'SUCCESS');
        if (typeof switchPartnerMode === 'function') switchPartnerMode('orders');
    } else if (errorMsg) {
        showInlineLoginError(errorMsg, "아이디 또는 비밀번호가 일치하지 않습니다.");
    }
}

function partnerLogout() {
    window.AppState.partnerLoggedIn = false;
    window.AppState.partnerName = '';
    togglePartnerConsoleVisibility();
    document.getElementById('partner-audit-empty')?.classList.remove('hidden');
    document.getElementById('partner-audit-details')?.classList.add('hidden');
    updateB2BNavButton();
    showToast('안전하게 로그아웃 되었습니다.', 'info');
}

/* ----------------------------------------------------------------
 * 파트너 입점 신청 (회원가입) — 사업자등록증 업로드 후 매니저 승인 대기(status: 'pending')
 * 상태로 등록되며, 매니저 콘솔 > 파트너 가입 심사 탭에서 승인/거절 처리한다.
 * ---------------------------------------------------------------- */
function switchPartnerAuthTab(tab) {
    const loginTabBtn = document.getElementById('partner-tab-login');
    const signupTabBtn = document.getElementById('partner-tab-signup');
    const loginPane = document.getElementById('partner-login-pane');
    const signupPane = document.getElementById('partner-signup-pane');
    if (!loginTabBtn || !signupTabBtn || !loginPane || !signupPane) return;

    if (tab === 'signup') {
        signupTabBtn.classList.add('active'); loginTabBtn.classList.remove('active');
        signupPane.classList.remove('hidden'); loginPane.classList.add('hidden');
    } else {
        loginTabBtn.classList.add('active'); signupTabBtn.classList.remove('active');
        loginPane.classList.remove('hidden'); signupPane.classList.add('hidden');
    }
}

let _partnerSignupBizCertDraft = null;

function triggerPartnerBizCertUpload() {
    document.getElementById('partner-signup-bizcert-input')?.click();
}

function handlePartnerBizCertUpload(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('파일 용량은 15MB 이하로 올려주세요.', 'warning'); return; }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showToast('이미지 또는 PDF 파일만 업로드할 수 있어요.', 'warning'); return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        _partnerSignupBizCertDraft = { name: file.name, uploadedAt: new Date().toLocaleString('ko-KR'), dataUrl: e.target.result };
        safeUpdateText('partner-signup-bizcert-filename', file.name);
        showToast('사업자등록증이 첨부되었습니다.', 'success');
    };
    reader.onerror = () => showToast('파일을 읽는 중 문제가 발생했습니다. 다시 시도해주세요.', 'error');
    reader.readAsDataURL(file);
}

function submitPartnerSignup() {
    const company = document.getElementById('partner-signup-company')?.value.trim();
    const phone = document.getElementById('partner-signup-phone')?.value.trim();
    const bizNum = document.getElementById('partner-signup-biznum')?.value.trim();
    const idVal = document.getElementById('partner-signup-id')?.value.trim();
    const pwVal = document.getElementById('partner-signup-pw')?.value;
    const pw2Val = document.getElementById('partner-signup-pw2')?.value;

    if (!company || !phone || !bizNum || !idVal || !pwVal || !pw2Val) {
        showToast('필수 항목을 모두 입력해 주세요.', 'warning'); return;
    }
    // 아이디는 영문/숫자/밑줄/하이픈만 허용한다. 이 아이디는 이후 매니저 콘솔 등에서
    // onclick="fn('${id}')" 형태로 그대로 삽입되므로, 따옴표 등을 허용하면 저장형 XSS/JS
    // 인젝션으로 이어질 수 있다.
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(idVal)) { showToast('아이디는 영문, 숫자, _, - 조합으로 3~20자로 입력해 주세요.', 'warning'); return; }
    // 업체명(company)도 id와 똑같은 이유로 위험하다 — partner.name은 코드 전반에서
    // onclick="fn('${partner.name}')" 형태로 그대로 삽입되므로, 따옴표를 허용하면
    // 그 자리에서 onclick 속성을 빠져나가 임의의 JS를 실행시킬 수 있다(JS 인젝션).
    // 한글/공백/일반 특수문자는 업체명에 자연스럽게 필요하므로 전체를 제한하지 않고
    // 인젝션에 쓰이는 문자(따옴표·백틱·꺾쇠·백슬래시)만 막는다.
    if (/['"`<>\\]/.test(company)) { showToast('업체명에는 따옴표(\', "), 백틱(`), 꺾쇠(<, >), 백슬래시(\\)를 사용할 수 없습니다.', 'warning'); return; }
    if (!/^0\d{1,2}-\d{3,4}-\d{4}$/.test(phone)) { showToast('담당자 연락처를 올바른 형식으로 입력해 주세요. (예: 010-0000-0000)', 'warning'); return; }
    if (bizNum.replace(/[^0-9]/g, '').length !== 10) { showToast('사업자등록번호 10자리를 올바르게 입력해 주세요. (예: 000-00-00000)', 'warning'); return; }
    if (pwVal !== pw2Val) { showToast('비밀번호가 일치하지 않습니다.', 'warning'); return; }
    if (window.AppState.partners.some(p => p.id === idVal)) { showToast('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.', 'warning'); return; }
    if (window.AppState.partners.some(p => p.bizFile === bizNum)) { showToast('이미 등록된 사업자등록번호입니다.', 'warning'); return; }
    if (!_partnerSignupBizCertDraft) { showToast('사업자등록증 파일을 첨부해 주세요.', 'warning'); return; }

    const now = new Date().toLocaleString('ko-KR');
    window.AppState.partners.push({
        name: company, id: idVal, pw: pwVal, bizFile: bizNum, phone,
        rating: 5.0, strikeCount: 0, status: 'pending', suspensionEndDate: null, isCertified: false,
        appliedAt: now, bizCertDoc: _partnerSignupBizCertDraft,
        portfolios: [], reviews: []
    });

    if (typeof pushLog === 'function') pushLog('PARTNER', 'SIGNUP_REQUEST', `'${company}'(${idVal}) 입점 신청 접수 — 매니저 승인 대기.`, 'INFO');
    showToast(`입점 신청이 접수되었습니다!\n매니저 센터 검토 후 승인되면 로그인하실 수 있어요.`, 'success');

    _partnerSignupBizCertDraft = null;
    ['partner-signup-company', 'partner-signup-phone', 'partner-signup-biznum', 'partner-signup-id', 'partner-signup-pw', 'partner-signup-pw2'].forEach(id => safeUpdateValue(id, ''));
    safeUpdateText('partner-signup-bizcert-filename', '선택된 파일 없음');
    switchPartnerAuthTab('login');
}

function renderPartnerOrderList() {
    const streamList = document.getElementById('partner-order-stream-list');
    const liveOrderBadge = document.getElementById('partner-live-order-badge');
    if (!streamList) return;

    const currentPartner = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const allOrders = window.AppState.orders;
    const filteredOrders = allOrders.filter(o => o.status === 'bidding' && o.budget < 7000 && !o.is1on1 && o.bids.length < o.partnerCountLimit && !o.bids.some(b => b.partner === currentPartner) && (!o.excludedPartners || !o.excludedPartners.includes(currentPartner)));

    if (liveOrderBadge) liveOrderBadge.innerText = `${filteredOrders.length}개 선착순 즉시입찰 참여 가능 오더`;

    if (filteredOrders.length === 0) {
        streamList.innerHTML = `<div class="empty-state !py-16 surface"><p class="text-xs text-ink-800 font-extrabold leading-relaxed">지금 참여 가능한 새로운 안심 입찰 오더가 존재하지 않습니다.<br><span class="text-[10px] text-ink-500 font-semibold mt-1 inline-block">(신청 완료한 건은 상단 '안심계약' 확인)</span></p></div>`;
        return;
    }

    streamList.innerHTML = '';
    filteredOrders.forEach(order => {
        const item = document.createElement('div');
        const isSelected = order.code === window.AppState.selectedOrderCode;
        item.className = `p-4 rounded-2xl border ${isSelected ? 'border-2 border-ink-950 bg-ink-50' : 'border-ink-100 bg-white hover:border-ink-300'} transition-all cursor-pointer space-y-2 text-left`;
        item.style.boxShadow = 'var(--shadow-1)';
        item.onclick = () => selectOrderForAudit(order.code);

        const slotsLeft = order.partnerCountLimit - order.bids.length;
        item.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold">
                <span class="font-mono text-ink-600 bg-ink-100 px-2 py-0.5 rounded-md border border-ink-200 font-extrabold">${order.code}</span>
                <span class="badge badge-neutral"><span class="badge-dot ${slotsLeft === 1 ? 'bg-amberCustom' : 'bg-ink-400'}"></span>선착순 ${slotsLeft}개사 남음</span>
            </div>
            <h5 class="text-xs font-black text-ink-950">${maskName(order.clientName)} 고객님 (${order.pyung}평형)</h5>
            <p class="text-[10px] text-ink-500 font-medium truncate">${maskAddress(order.clientAddress)}</p>
            <span class="badge badge-brand">희망예산 ₩ ${order.budget.toLocaleString()}만원</span>`;
        streamList.appendChild(item);
    });
}

function selectOrderForAudit(code) {
    window.AppState.selectedOrderCode = code;
    const order = window.AppState.orders.find(o => o.code === code);
    if (!order) return;

    document.getElementById('partner-audit-empty')?.classList.add('hidden');
    const details = document.getElementById('partner-audit-details');
    if (!details) return;
    details.classList.remove('hidden');

    const currentPartnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const isAlreadyBid = order.bids.some(b => b.partner === currentPartnerName);

    let displayClientName = `${maskName(order.clientName)} 고객님 (${maskPhone(order.clientPhone)})`;
    let displayClientAddress = "입찰 참여 즉시 실제 개인정보 자동 잠금해제";
    if (isAlreadyBid || order.status === 'contracted') { displayClientName = `${order.clientName} 고객님 (${order.clientPhone})`; displayClientAddress = order.clientAddress; }

    let competitorBidsHtml = '';
    if (order.bids && order.bids.length > 0) {
        competitorBidsHtml = `<div class="mt-4 pt-4 border-t border-ink-100 text-left"><span class="text-[11px] font-black text-ink-950 block mb-2.5 flex items-center gap-1.5"><i data-lucide="users" class="w-3.5 h-3.5 text-ink-500"></i> 현재 입찰 참여 업체 리스트 (금액 비공개)</span><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;
        order.bids.forEach(b => {
            const isMe = b.partner === currentPartnerName;
            const isContractCompletedPartner = order.status === 'contracted' && order.acceptedPartner === b.partner;
            const statusLabel = isContractCompletedPartner ? '계약 완료' : '입찰 완료';
            competitorBidsHtml += `
                <div class="flex justify-between items-center px-3.5 py-2.5 rounded-xl ${isMe ? 'bg-ink-100 border border-ink-200' : 'bg-ink-50'} text-[11px] font-bold text-ink-800">
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${isMe ? 'bg-ink-950' : 'bg-ink-400'}"></span>${b.partner} ${isMe ? '<span class="text-[9px] text-ink-600 font-extrabold">(귀사)</span>' : ''}</span>
                    <span class="text-ink-950 font-extrabold">${statusLabel}</span>
                </div>`;
        });
        competitorBidsHtml += `</div></div>`;
    }

    details.innerHTML = `
        <div class="space-y-5">
            <div class="surface p-6 text-left">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap"><span class="badge badge-neutral"><span class="badge-dot bg-ink-500"></span> 우리집 안심 중개보증</span><span id="audit-code" class="text-xs font-mono font-bold text-ink-500 tracking-wider">${order.code}</span><span class="badge badge-brand">희망예산 ₩ ${order.budget.toLocaleString()}만원</span></div>
                        <h4 class="text-base font-black text-ink-950 tracking-tight">${displayClientName}</h4>
                        <p class="text-xs text-ink-600 font-bold leading-relaxed max-w-md">${displayClientAddress}</p>
                    </div>
                </div>
            </div>

            <div class="surface p-5 space-y-4">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="compass" class="w-4 h-4 text-ink-500"></i> 시공 마스터 명세</h5>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
                    <div class="article-spec-chip"><span>공간 구분</span><span class="val">${order.spaceType === 'residential' ? '주거 공간' : '상업 공간'}</span></div>
                    <div class="article-spec-chip"><span>시공 형태</span><span class="val">${order.workType === 'all' ? '전체 시공' : '부분 시공'}</span></div>
                    <div class="article-spec-chip"><span>시공 면적</span><span class="val">${order.pyung}평</span></div>
                    <div class="article-spec-chip"><span>공실 여부</span><span class="val">${order.vacancy === 'empty' ? '공실' : '거주중'}</span></div>
                    <div class="article-spec-chip"><span>고객 희망예산</span><span class="val">₩ ${order.budget.toLocaleString()}만원</span></div>
                </div>
            </div>

            ${competitorBidsHtml}

            ${isAlreadyBid ? `
                <div class="p-4 surface-flat text-left space-y-1"><h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4 text-ink-700"></i> 선착순 즉시 입찰 선점 완료</h5><p class="text-[10px] text-ink-500 font-semibold leading-relaxed">의뢰자가 우리 시공사의 포트폴리오를 검토 중입니다.</p></div>
            ` : `
                <div class="surface-flat p-4 space-y-3 text-left">
                    <div><label class="field-label">입찰 제안 금액 (만원)</label><input type="number" id="partner-bid-price-input" value="${Math.floor(order.budget * 0.95)}" min="1" class="input"></div>
                    <div><label class="field-label">제안 메시지</label><textarea id="partner-bid-desc-input" class="textarea h-20" placeholder="고객에게 보여줄 제안 메시지를 입력하세요.">${currentPartnerName}에서 제안하는 하이엔드 시공 안심 제안입니다.</textarea></div>
                    <button type="button" onclick="submitPartnerBid()" class="btn btn-dark btn-lg btn-block"><i data-lucide="zap" class="w-4 h-4"></i> 선착순 입찰 즉시 참여하기</button>
                </div>`}
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function submitPartnerBid() {
    const code = window.AppState.selectedOrderCode;
    if (!code) return;
    const order = window.AppState.orders.find(o => o.code === code);
    if (!order) return;

    const partnerName = window.AppState.partnerName || "오륙도 디자인 실내건축";
    const priceInput = document.getElementById('partner-bid-price-input');
    const price = priceInput ? parseInt(priceInput.value, 10) : NaN;
    if (!price || price <= 0) { showToast('입찰 제안 금액을 올바르게 입력해 주세요.', 'warning'); return; }
    const descInput = document.getElementById('partner-bid-desc-input');
    const desc = (descInput && descInput.value.trim()) || `${partnerName}에서 제안하는 하이엔드 시공 안심 제안입니다.`;

    order.bids.push({ partner: partnerName, price, desc, verified: true, progress: 'bidding' });

    selectOrderForAudit(code);
    renderPartnerOrderList();
    recalculateKPIs();
    pushLog('PARTNER', 'BID', `[${partnerName}]가 오더 ${code} 입찰 선점.`, 'SUCCESS');
    showToast("선착순 입찰에 참여했습니다!", "success");
}

/* 지금까지는 고객만 파트너의 입찰을 취소(cancelPartnerBid)할 수 있었고, 파트너
 * 본인은 한 번 입찰하면 되돌릴 방법이 없었다 — 예약 초과나 사정 변경으로 시공이
 * 어려워져도 그대로 남아있어야 했다. 계약 확정 전(status === 'bidding')에만
 * 허용하고, 고객에게는 매칭취소와 동일하게 안내한다. */
function withdrawMyPartnerBid(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    if (order.status !== 'bidding') { showToast('이미 계약이 진행 중이거나 종료된 오더는 입찰을 철회할 수 없어요.', 'warning'); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const bidIdx = order.bids.findIndex(b => b.partner === partnerName);
    if (bidIdx === -1) return;

    order.bids.splice(bidIdx, 1);
    if (!order.excludedPartners) order.excludedPartners = [];
    if (!order.excludedPartners.includes(partnerName)) order.excludedPartners.push(partnerName);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'BID_WITHDRAW', `[${partnerName}]가 오더 ${orderCode} 입찰을 철회했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName} 파트너사가 입찰을 철회했어요. (의뢰 코드: ${orderCode})`);
    showToast('입찰을 철회했습니다.', 'info');

    closePartnerOrderDetailModal();
    renderPartnerOrderList();
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    recalculateKPIs();
}

let partnerCancelRequestTargetCode = null;

/* 고객은 계약 취소를 요청할 수 있는데(openContractCancelRequestModal, client_panel.js)
 * 파트너는 시공이 불가능해지거나 고객과 분쟁이 생겨도 계약을 취소할 방법이 전혀
 * 없었던 비대칭 — 동일한 cancel_requested 상태와 관리자 심사 큐를 재사용해
 * requestedBy만 'partner'로 구분한다. */
function openPartnerCancelRequestModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') return;
    partnerCancelRequestTargetCode = orderCode;
    safeUpdateValue('partner-cancel-request-reason', '');
    openModal('partner-cancel-request-modal', 'partner-cancel-request-modal-card');
}

function closePartnerCancelRequestModal() {
    partnerCancelRequestTargetCode = null;
    closeModal('partner-cancel-request-modal', 'partner-cancel-request-modal-card');
}

function submitPartnerCancelRequest() {
    const order = window.AppState.orders.find(o => o.code === partnerCancelRequestTargetCode);
    if (!order || order.status !== 'contracted') { closePartnerCancelRequestModal(); return; }

    const reason = document.getElementById('partner-cancel-request-reason')?.value.trim();
    if (!reason) { showToast('취소 요청 사유를 입력해주세요.', 'warning'); return; }

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    order.status = 'cancel_requested';
    order.cancelRequest = { reason, requestedBy: 'partner', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CONTRACT_CANCEL_REQUEST', `[${partnerName}]가 계약(${order.code})의 취소를 요청했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약 파트너사가 계약(${order.code}) 취소를 요청했어요. 매니저 센터에서 심사 중입니다.`);
    showToast('취소 요청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closePartnerCancelRequestModal();
    closePartnerOrderDetailModal();
    renderPartnerOrderList();
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof renderAdminContractCancellations === 'function') renderAdminContractCancellations();
}

/* 안심 계약·입찰 내역 상태 필터. 상태 뱃지를 클릭하면 해당 상태만 걸러서 볼 수 있다. */
let partnerContractsStatusFilter = 'all';

function getPartnerOrderStatusKey(order, partnerName) {
    if (order.status === 'withdrawn') return 'withdrawn';
    if (order.status === 'cancel_requested') return 'cancel_requested';
    if (order.status === 'cancelled') return 'cancelled';
    const isContracted = order.status === 'contracted' && order.acceptedPartner === partnerName;
    if (isContracted) return 'contracted_mine';
    if (order.status === 'contracted') return 'contracted_other';
    return 'bidding';
}

function setPartnerContractsStatusFilter(statusKey) {
    partnerContractsStatusFilter = statusKey;
    renderPartnerContractsView();
}

function renderPartnerContractsView() {
    const container = document.getElementById('partner-mode-contracts-view');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const allMyOrders = (window.AppState.orders || []).filter(o => o.bids && o.bids.some(b => b.partner === partnerName));

    if (allMyOrders.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg"><span class="icon-wrap"><i data-lucide="file-x" class="w-5 h-5"></i></span><p class="text-xs text-ink-500 font-bold">참여 이력이 있는 입찰/계약 건이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const statusTabs = [
        ['all', '전체', allMyOrders.length],
        ['bidding', '입찰 심사중', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'bidding').length],
        ['contracted_mine', '계약 체결', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'contracted_mine').length],
        ['contracted_other', '타사 계약', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'contracted_other').length],
        ['cancel_requested', '계약 취소 심사중', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'cancel_requested').length],
        ['cancelled', '계약 취소됨', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'cancelled').length],
        ['withdrawn', '고객 철회', allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === 'withdrawn').length]
    ];
    const tabsHtml = statusTabs.map(([key, label, count]) =>
        `<button type="button" onclick="setPartnerContractsStatusFilter('${key}')" class="gnb-tab ${partnerContractsStatusFilter === key ? 'active' : ''}">${label} (${count})</button>`
    ).join('');

    const myOrders = partnerContractsStatusFilter === 'all'
        ? allMyOrders
        : allMyOrders.filter(o => getPartnerOrderStatusKey(o, partnerName) === partnerContractsStatusFilter);

    const rowsHtml = myOrders.length > 0 ? myOrders.map(o => {
        const myBid = o.bids.find(b => b.partner === partnerName);
        const statusKey = getPartnerOrderStatusKey(o, partnerName);
        const statusBadge = statusKey === 'contracted_mine' ? `<span class="badge badge-emerald">계약 체결</span>`
            : statusKey === 'contracted_other' ? `<span class="badge badge-neutral">타사 계약</span>`
            : statusKey === 'withdrawn' ? `<span class="badge badge-rose">고객 철회</span>`
            : statusKey === 'cancel_requested' ? `<span class="badge badge-amber">계약 취소 심사중</span>`
            : statusKey === 'cancelled' ? `<span class="badge badge-rose">계약 취소됨</span>`
            : `<span class="badge badge-amber">입찰 심사중</span>`;
        // 이 목록에 뜨는 오더는 전부 우리가 이미 입찰에 참여한 건이므로(이미 안심 잠금해제 대상),
        // selectOrderForAudit()의 "입찰 참여 시 개인정보 잠금해제" 규칙과 동일하게 고객명을 가리지 않는다.
        return `<tr class="cursor-pointer hover:bg-ink-50 transition-colors" onclick="openPartnerOrderDetailModal('${o.code}')"><td class="font-mono">${o.code}</td><td class="font-black text-ink-950">${o.clientName}</td><td>${o.pyung}평</td><td onclick="event.stopPropagation(); setPartnerContractsStatusFilter('${statusKey}')" class="cursor-pointer" title="이 상태만 필터링">${statusBadge}</td><td class="font-black text-ink-950">₩ ${(myBid ? myBid.price : 0).toLocaleString()}만</td><td><span class="btn btn-outline btn-sm">상세보기</span></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="text-center text-ink-400 font-bold py-8">해당 상태의 오더가 없습니다.</td></tr>`;

    container.innerHTML = `
        <div class="flex items-center flex-wrap gap-1.5 bg-ink-50 p-1.5 rounded-xl border border-ink-100 mb-4">${tabsHtml}</div>
        <div class="surface surface-lg overflow-hidden"><div class="overflow-x-auto"><table class="table-clean">
        <thead><tr><th>오더 번호</th><th>고객</th><th>면적</th><th>상태</th><th>금액</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table></div></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------------
 * 파트너 오더 상세 모달 — "안심 계약·입찰 내역" 목록에서 오더를 클릭하면 뜬다.
 * 견적신청서 요약 + 매칭 현황 + 계약 진행상황(단계별) + 계약서/견적서 업로드 +
 * 플랫폼 수수료 결제까지 한 화면에서 처리한다. 여기서 쌓인 데이터는 관리자
 * "파트너 모니터링"의 파트너 성과 모달(openPartnerMetricsModal)에서도 그대로 확인된다.
 * ---------------------------------------------------------------- */
function getPartnerContractProgressSteps(order, partnerName) {
    const isContracted = order.status === 'contracted' && order.acceptedPartner === partnerName;
    return [
        { label: '입찰 참여', done: true },
        { label: '계약 매칭 확정', done: isContracted },
        { label: '계약서 업로드', done: isContracted && !!order.contractDoc },
        { label: '견적서 업로드', done: isContracted && !!order.estimateDoc },
        { label: '수수료 결제', done: isContracted && !!order.commissionPaid }
    ];
}

function renderPartnerContractProgressStepperHtml(steps) {
    const firstPendingIdx = steps.findIndex(s => !s.done);
    return `<div class="contract-stepper">${steps.map((s, i) => {
        const state = s.done ? 'done' : (i === firstPendingIdx ? 'current' : 'pending');
        return `<div class="contract-step ${state}"><span class="contract-step-dot">${s.done ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : (i + 1)}</span><span class="contract-step-label">${s.label}</span></div>`;
    }).join('')}</div>`;
}

function openPartnerOrderDetailModal(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;

    let modal = document.getElementById('partner-order-detail-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'partner-order-detail-modal'; modal.className = "hidden modal-overlay"; modal.style.zIndex = '220'; document.body.appendChild(modal); }

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const myBid = order.bids.find(b => b.partner === partnerName);
    const isContracted = order.status === 'contracted' && order.acceptedPartner === partnerName;
    const statusBadge = order.status === 'cancel_requested' ? `<span class="badge badge-amber">계약 취소 심사중</span>`
        : order.status === 'cancelled' ? `<span class="badge badge-rose">계약 취소됨</span>`
        : isContracted ? `<span class="badge badge-emerald">계약 체결</span>`
        : order.status === 'contracted' ? `<span class="badge badge-neutral">타사 계약</span>`
        : order.status === 'withdrawn' ? `<span class="badge badge-rose">고객 철회</span>`
        : `<span class="badge badge-amber">입찰 심사중</span>`;

    let bidsListHtml = '<p class="text-[11px] text-ink-400 font-bold">아직 입찰 참여 이력이 없습니다.</p>';
    if (order.bids && order.bids.length > 0) {
        bidsListHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${order.bids.map(b => {
            const isMe = b.partner === partnerName;
            const isThisPartnerContracted = order.status === 'contracted' && order.acceptedPartner === b.partner;
            const label = isThisPartnerContracted ? '계약 완료' : '입찰 완료';
            return `<div class="flex justify-between items-center px-3.5 py-2.5 rounded-xl ${isMe ? 'bg-ink-100 border border-ink-200' : 'bg-ink-50'} text-[11px] font-bold text-ink-800">
                <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${isMe ? 'bg-ink-950' : 'bg-ink-400'}"></span>${b.partner} ${isMe ? '<span class="text-[9px] text-ink-600 font-extrabold">(귀사)</span>' : ''}</span>
                <span class="text-ink-950 font-extrabold">${label}</span>
            </div>`;
        }).join('')}</div>`;
    }

    const steps = getPartnerContractProgressSteps(order, partnerName);

    let actionSectionHtml;
    if (isContracted) {
        const hasFinalAmount = !!(order.finalPrice && order.finalPrice > 0);
        const commissionAmount = Math.floor((order.finalPrice || 0) * PLATFORM_COMMISSION_RATE);
        const canPayCommission = !!order.estimateDoc && hasFinalAmount;

        let commissionBodyHtml;
        if (order.commissionPaid) {
            commissionBodyHtml = `
                <div class="p-4 surface-flat flex items-center justify-between">
                    <div class="space-y-0.5 text-left"><p class="text-[11px] font-bold text-ink-500">납부 완료 금액 (최종 계약금액 ₩ ${(order.finalPrice || 0).toLocaleString()}만원 기준)</p><p class="text-sm font-black text-ink-950">₩ ${commissionAmount.toLocaleString()} 만원</p></div>
                    <span class="badge badge-emerald">납부 완료</span>
                </div>`;
        } else if (!order.estimateDoc) {
            commissionBodyHtml = `
                <div class="p-4 surface-flat text-left space-y-1">
                    <p class="text-[11px] font-black text-ink-800">견적서를 먼저 업로드해주세요</p>
                    <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">고객과 협의한 견적서를 업로드하고 최종 계약금액을 입력하면 수수료 결제가 가능합니다.</p>
                </div>`;
        } else if (!hasFinalAmount) {
            commissionBodyHtml = `
                <div class="p-4 surface-flat text-left space-y-1">
                    <p class="text-[11px] font-black text-ink-800">최종 계약금액을 입력해주세요</p>
                    <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">위 견적서 업로드 카드에서 최종 계약금액을 입력하고 저장하면 수수료 결제가 가능합니다.</p>
                </div>`;
        } else {
            commissionBodyHtml = `
                <div class="p-4 surface-flat space-y-3 text-left">
                    <div class="flex items-center justify-between">
                        <p class="text-[11px] font-bold text-ink-500">최종 계약금액 ₩ ${(order.finalPrice || 0).toLocaleString()}만원의 ${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)}%</p>
                        <span class="text-sm font-black text-ink-950">₩ ${commissionAmount.toLocaleString()} 만원</span>
                    </div>
                    <button type="button" onclick="payPartnerCommission('${order.code}')" class="btn btn-dark btn-block"><i data-lucide="credit-card" class="w-4 h-4"></i> 수수료 결제하기</button>
                </div>`;
        }

        actionSectionHtml = `
            <div class="surface p-5 space-y-4">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-check-2" class="w-4 h-4 text-ink-600"></i> 계약서 · 견적서 업로드</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${renderPartnerDocUploadCardHtml(order, 'contract', '계약서')}
                    ${renderPartnerDocUploadCardHtml(order, 'estimate', '견적서')}
                </div>
                <div class="p-3.5 surface-flat space-y-2 text-left">
                    <span class="text-[11px] font-black text-ink-950">최종 계약금액 (견적서 기준)</span>
                    <p class="text-[10px] text-ink-400 font-semibold leading-relaxed">견적서 작성·업로드가 끝난 최종 계약금액을 입력해주세요. 이 금액의 ${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)}%가 플랫폼 중개 수수료로 계산됩니다.</p>
                    <div class="flex items-center gap-2">
                        <input type="number" min="1" step="1" id="partner-final-amount-input-${order.code}" value="${order.finalPrice || ''}" placeholder="예: 3400" class="input flex-1">
                        <span class="text-[11px] font-bold text-ink-500 shrink-0">만원</span>
                        <button type="button" onclick="savePartnerFinalContractAmount('${order.code}')" class="btn btn-secondary btn-sm shrink-0">저장</button>
                    </div>
                    ${hasFinalAmount ? `<p class="text-[9px] text-emeraldCustom font-bold">✓ 저장된 최종 계약금액: ₩ ${(order.finalPrice || 0).toLocaleString()}만원</p>` : ''}
                </div>
                <input type="file" id="partner-doc-input-contract" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="hidden" onchange="handlePartnerDocUpload(event, '${order.code}', 'contract')">
                <input type="file" id="partner-doc-input-estimate" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" class="hidden" onchange="handlePartnerDocUpload(event, '${order.code}', 'estimate')">
            </div>
            <div class="surface p-5 space-y-3">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="credit-card" class="w-4 h-4 text-ink-600"></i> 플랫폼 중개 수수료 결제</h5>
                ${commissionBodyHtml}
            </div>
            <div class="surface p-5 space-y-2">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="ban" class="w-4 h-4 text-roseCustom"></i> 계약 취소 요청</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">시공이 불가능하거나 고객과의 분쟁으로 계약을 유지할 수 없는 경우, 매니저 센터 심사를 거쳐 계약을 취소할 수 있어요.</p>
                <button type="button" onclick="openPartnerCancelRequestModal('${order.code}')" class="btn btn-secondary btn-sm text-roseCustom">계약 취소 요청하기</button>
            </div>`;
    } else {
        actionSectionHtml = `
            <div class="p-4 surface-flat text-left space-y-1">
                <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="lock" class="w-4 h-4 text-ink-500"></i> 계약서·견적서 업로드 및 수수료 결제는 계약 확정 후 가능합니다</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">${order.status === 'contracted' ? '이 오더는 다른 파트너사와 계약이 체결되었습니다.' : order.status === 'withdrawn' ? '고객이 이 의뢰를 철회하여 더 이상 진행되지 않습니다.' : order.status === 'cancel_requested' ? '고객이 계약 취소를 요청하여 매니저 센터에서 심사 중입니다. 심사가 끝날 때까지 계약 관련 절차가 일시 중단됩니다.' : order.status === 'cancelled' ? '이 계약은 취소 승인되어 더 이상 유효하지 않습니다.' : '고객이 최종 파트너사를 확정하면 이 오더의 계약서·견적서 업로드와 수수료 결제 기능이 열립니다.'}</p>
            </div>
            ${myBid && order.status === 'bidding' ? `
            <div class="p-4 surface-flat text-left space-y-2">
                <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="undo-2" class="w-4 h-4 text-roseCustom"></i> 입찰 참여 철회</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">예약이 초과되었거나 시공이 어려운 경우 입찰을 철회할 수 있어요. 고객에게 매칭 취소로 안내됩니다.</p>
                <button type="button" onclick="withdrawMyPartnerBid('${order.code}')" class="btn btn-secondary btn-sm text-roseCustom">이 오더 입찰 철회하기</button>
            </div>` : ''}`;
    }

    modal.innerHTML = `
        <div id="partner-order-detail-modal-card" class="modal-card w-full max-w-2xl p-6 sm:p-8 space-y-6 text-left">
            <div class="flex justify-between items-start border-b border-ink-100 pb-4">
                <div class="space-y-1.5">
                    <div class="flex items-center gap-2"><span class="badge badge-neutral"><span class="badge-dot bg-ink-500"></span> 우리집 안심 중개보증</span><span class="text-xs font-mono font-bold text-ink-500 tracking-wider">${order.code}</span>${statusBadge}</div>
                    <h3 class="text-base sm:text-lg font-black text-ink-950 tracking-tight">${escapeHtml(order.clientName)} 고객님 (${order.clientPhone})</h3>
                    <p class="text-xs text-ink-600 font-bold leading-relaxed max-w-md">${escapeHtml(order.clientAddress)}</p>
                </div>
                <button type="button" onclick="closePartnerOrderDetailModal()" class="btn btn-ghost btn-sm px-1.5" aria-label="닫기"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="space-y-5 max-h-[65vh] overflow-y-auto custom-scroll pr-1">
                ${renderPartnerContractProgressStepperHtml(steps)}

                <div class="surface p-5 space-y-4">
                    <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="clipboard-list" class="w-4 h-4 text-ink-500"></i> 견적신청서</h5>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
                        <div class="article-spec-chip"><span>공간 구분</span><span class="val">${order.spaceType === 'residential' ? '주거 공간' : '상업 공간'}</span></div>
                        <div class="article-spec-chip"><span>시공 형태</span><span class="val">${order.workType === 'all' ? '전체 시공' : '부분 시공'}</span></div>
                        <div class="article-spec-chip"><span>시공 면적</span><span class="val">${order.pyung}평</span></div>
                        <div class="article-spec-chip"><span>공실 여부</span><span class="val">${order.vacancy === 'empty' ? '공실' : '거주중'}</span></div>
                        <div class="article-spec-chip"><span>희망 착공일</span><span class="val">${order.preferredDate || '미정'}</span></div>
                        <div class="article-spec-chip"><span>고객 예산</span><span class="val">₩ ${(order.budget || 0).toLocaleString()}만</span></div>
                        <div class="article-spec-chip"><span>참여사 제한</span><span class="val">${order.bids.length} / ${order.partnerCountLimit}개사</span></div>
                        <div class="article-spec-chip"><span>귀사 입찰 금액</span><span class="val">₩ ${(myBid ? myBid.price : 0).toLocaleString()}만</span></div>
                    </div>
                </div>

                <div class="surface p-5 space-y-3">
                    <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="users" class="w-4 h-4 text-ink-500"></i> 매칭 현황 (경쟁사 입찰 금액은 비공개)</h5>
                    ${bidsListHtml}
                </div>

                ${actionSectionHtml}
            </div>
            <div class="pt-3 border-t border-ink-100 flex justify-end"><button type="button" onclick="closePartnerOrderDetailModal()" class="btn btn-dark">확인 및 닫기</button></div>
        </div>`;

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('partner-order-detail-modal-card')?.classList.add('modal-open'), 30);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePartnerOrderDetailModal() {
    const modal = document.getElementById('partner-order-detail-modal');
    const card = document.getElementById('partner-order-detail-modal-card');
    if (modal && card) { card.classList.remove('modal-open'); setTimeout(() => modal.classList.add('hidden'), 150); }
}

function renderPartnerDocUploadCardHtml(order, docType, label) {
    const doc = docType === 'contract' ? order.contractDoc : order.estimateDoc;
    if (doc) {
        return `
            <div class="p-3.5 surface-flat space-y-2 text-left">
                <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${label}</span><span class="badge badge-emerald">업로드됨</span></div>
                <p class="text-[10px] text-ink-500 font-bold truncate">${doc.name}</p>
                <p class="text-[9px] text-ink-400 font-semibold">${doc.uploadedAt}</p>
                <div class="flex gap-1.5 pt-1">
                    <button type="button" onclick="openUploadedPartnerDoc('${order.code}', '${docType}')" class="btn btn-outline btn-sm flex-1">보기</button>
                    <button type="button" onclick="triggerPartnerDocUpload('${docType}')" class="btn btn-secondary btn-sm flex-1">다시 업로드</button>
                </div>
            </div>`;
    }
    return `
        <div class="p-3.5 surface-flat space-y-2 text-left">
            <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${label}</span><span class="badge badge-amber">미업로드</span></div>
            <p class="text-[10px] text-ink-400 font-semibold leading-relaxed">고객과 협의한 최종 ${label}를 업로드해주세요. (PDF·이미지·문서, 15MB 이하)</p>
            <button type="button" onclick="triggerPartnerDocUpload('${docType}')" class="btn btn-dark btn-sm btn-block">${label} 업로드하기</button>
        </div>`;
}

function triggerPartnerDocUpload(docType) {
    document.getElementById(`partner-doc-input-${docType}`)?.click();
}

function handlePartnerDocUpload(event, orderCode, docType) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // 같은 파일을 다시 골라도 change 이벤트가 다시 발생하도록 초기화
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('파일 용량은 15MB 이하로 올려주세요.', 'warning'); return; }

    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const docPayload = { name: file.name, uploadedAt: new Date().toLocaleString('ko-KR'), dataUrl: e.target.result };
        if (docType === 'contract') { order.contractDoc = docPayload; order.contractUploaded = true; }
        else { order.estimateDoc = docPayload; order.estimateUploaded = true; }

        const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
        if (typeof pushLog === 'function') pushLog('PARTNER', 'DOC_UPLOAD', `[${partnerName}]가 오더 ${orderCode}에 ${docType === 'contract' ? '계약서' : '견적서'}를 업로드했습니다. (${file.name})`, 'SUCCESS');
        showToast(`${docType === 'contract' ? '계약서' : '견적서'}가 업로드되었습니다.`, 'success');

        openPartnerOrderDetailModal(orderCode);
        if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    };
    reader.onerror = () => showToast('파일을 읽는 중 문제가 발생했습니다. 다시 시도해주세요.', 'error');
    reader.readAsDataURL(file);
}

/* 견적서 작성·업로드 내용을 바탕으로 파트너가 직접 입력하는 최종 계약금액.
 * 수수료는 고객이 처음 써낸 예산(order.budget)이 아니라 이 값을 기준으로 계산된다
 * (payPartnerCommission 참고). */
function savePartnerFinalContractAmount(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;
    if (order.commissionPaid) { showToast('이미 수수료 납부가 완료된 오더는 계약금액을 수정할 수 없습니다.', 'warning'); return; }

    const input = document.getElementById(`partner-final-amount-input-${orderCode}`);
    const val = input ? parseInt(input.value, 10) : NaN;
    if (!val || val <= 0) { showToast('최종 계약금액을 올바르게 입력해주세요.', 'warning'); return; }

    order.finalPrice = val;

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (typeof pushLog === 'function') pushLog('PARTNER', 'FINAL_AMOUNT', `[${partnerName}]가 오더 ${orderCode}의 최종 계약금액을 ₩ ${val.toLocaleString()}만원으로 입력했습니다.`, 'SUCCESS');
    showToast(`최종 계약금액 ₩ ${val.toLocaleString()}만원이 저장되었습니다.`, 'success');

    openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

/* 업로드된 실제 파일을 내려받는다 — 파트너 본인의 상세 모달과, 관리자 파트너 성과 모달
 * (openPartnerMetricsModal) 양쪽에서 공유해서 쓴다. */
function openUploadedPartnerDoc(orderCode, docType) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const doc = order ? (docType === 'contract' ? order.contractDoc : order.estimateDoc) : null;
    if (!doc || !doc.dataUrl) { showToast('업로드된 파일을 찾을 수 없습니다.', 'warning'); return; }
    const a = document.createElement('a');
    a.href = doc.dataUrl; a.download = doc.name || (docType === 'contract' ? '계약서' : '견적서');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function payPartnerCommission(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;
    if (order.commissionPaid) { showToast('이미 수수료 납부가 완료된 오더입니다.', 'info'); return; }
    if (!order.estimateDoc) { showToast('견적서를 먼저 업로드해주세요.', 'warning'); return; }
    if (!(order.finalPrice && order.finalPrice > 0)) { showToast('최종 계약금액을 먼저 입력·저장해주세요.', 'warning'); return; }

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const amount = Math.floor(order.finalPrice * PLATFORM_COMMISSION_RATE);
    order.commissionPaid = true;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'COMMISSION', `[${partnerName}]가 오더 ${orderCode}의 플랫폼 중개 수수료 ₩ ${amount.toLocaleString()}만원을 결제했습니다.`, 'SUCCESS');
    showToast(`수수료 ₩ ${amount.toLocaleString()}만원 결제가 완료되었습니다!`, 'success');

    openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

/* ----------------------------------------------------------------
 * 로그 / KPI
 * ---------------------------------------------------------------- */
function syncAuditLogs() {
    const tbody = document.getElementById('admin-log-tbody');
    if (!tbody) return;
    const logs = (window.AppState && window.AppState.logs) ? window.AppState.logs : [];
    if (logs.length === 0) { tbody.innerHTML = `<tr><td class="px-6 py-8 text-center text-ink-400 font-bold" colspan="5">기록된 로그가 없습니다.</td></tr>`; return; }
    tbody.innerHTML = logs.map(log => {
        const statusBadge = log.status === 'SUCCESS' ? 'badge-emerald' : log.status === 'WARNING' ? 'badge-amber' : 'badge-neutral';
        return `<tr>
            <td class="font-mono text-[11px] text-ink-500">${log.time}</td>
            <td><span class="badge badge-neutral">${log.category}</span></td>
            <td class="font-black text-ink-950">${log.target}</td>
            <td class="leading-relaxed">${escapeHtml(log.message)}</td>
            <td><span class="badge ${statusBadge}">${log.status}</span></td>
        </tr>`;
    }).join('');
}

/* 관제 로그를 외부 보고용으로 내보낼 방법이 없어서, 감사·정산 자료가 필요할 때마다
 * 화면을 수동으로 캡처하거나 옮겨 적어야 했다. CSV로 내려받아 엑셀 등에서 바로
 * 열어볼 수 있게 한다. 한글이 엑셀에서 깨지지 않도록 UTF-8 BOM을 붙인다. */
function exportLogsToCsv() {
    const logs = (window.AppState && window.AppState.logs) ? window.AppState.logs : [];
    if (logs.length === 0) { showToast('내보낼 로그가 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const header = ['시간', '구분', '대상', '내용', '상태'].map(escapeCsvCell).join(',');
    const rows = logs.map(log => [log.time, log.category, log.target, log.message, log.status].map(escapeCsvCell).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_관제로그_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'LOG_EXPORT', `[관제 로그] 매니저가 로그 ${logs.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`로그 ${logs.length}건을 CSV로 내보냈습니다.`, 'success');
}

/* 파트너 모니터링 보드는 화면에서 검색만 가능했고, 목록 전체를 엑셀 등으로
 * 내려받아 오프라인에서 검토·보관할 방법이 없었다 — exportLogsToCsv와 동일한 패턴. */
function exportPartnerListToCsv() {
    const partners = window.AppState.partners || [];
    if (partners.length === 0) { showToast('내보낼 파트너사가 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const header = ['업체명', '사업자번호', '지역', '상태', '옐로카드', '평점'].map(escapeCsvCell).join(',');
    const rows = partners.map(p => [
        p.name, p.bizFile || '-', p.region || '-',
        getPartnerMonitorStatusKey(p) === 'banned' ? '영구 제명' : (getPartnerMonitorStatusKey(p) === 'paused' ? '일시중단' : (getPartnerMonitorStatusKey(p) === 'warning' ? '경고' : '정상')),
        p.strikeCount || 0, (p.rating || 0).toFixed(1)
    ].map(escapeCsvCell).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_파트너목록_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_EXPORT', `[파트너 모니터링] 매니저가 파트너사 ${partners.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`파트너사 ${partners.length}건을 CSV로 내보냈습니다.`, 'success');
}

/* 파트너 목록 CSV 내보내기와 동일한 패턴으로, 새로 추가된 고객 관리 탭의 목록도
 * 오프라인 검토·보관용으로 내려받을 수 있게 한다. */
function exportClientListToCsv() {
    const clients = (window.AppState.clientAccounts || []).filter(a => !a.managerRole);
    if (clients.length === 0) { showToast('내보낼 고객이 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const header = ['이름', '아이디', '연락처', '의뢰건수', '계약건수', '후기건수', '계정상태'].map(escapeCsvCell).join(',');
    const rows = clients.map(acc => {
        const myOrders = (window.AppState.orders || []).filter(o => o.clientPhone === acc.phone);
        const contractedCount = myOrders.filter(o => o.status === 'contracted').length;
        const reviewCount = myOrders.filter(o => o.reviewWritten).length;
        return [acc.name, acc.id, acc.phone || '-', myOrders.length, contractedCount, reviewCount, acc.status === 'withdrawn' ? '탈퇴함' : acc.isSuspended ? '이용 정지' : '정상'].map(escapeCsvCell).join(',');
    });
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_고객목록_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_EXPORT', `[고객 관리] 매니저가 고객 ${clients.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`고객 ${clients.length}건을 CSV로 내보냈습니다.`, 'success');
}

function recalculateKPIs() {
    let gmv = 0, escrow = 0, revenue = 0;
    const orders = window.AppState.orders || [];
    orders.forEach(o => {
        if (o.status === 'contracted') {
            gmv += o.finalPrice;
            if (o.commissionPaid) revenue += Math.floor(o.finalPrice * PLATFORM_COMMISSION_RATE);
            else escrow += Math.floor(o.finalPrice * PLATFORM_COMMISSION_RATE);
        }
    });
    window.AppState.kpis = { gmv, escrow, revenue };
    safeUpdateText('admin-kpi-gmv', `₩ ${gmv.toLocaleString()} 만원`);
    safeUpdateText('admin-kpi-escrow', `₩ ${escrow.toLocaleString()} 만원`);
    safeUpdateText('admin-kpi-revenue', `₩ ${revenue.toLocaleString()} 만원`);
    renderAdminOrderAllocation();
}

/* 지금까지는 관리자가 오더 하나를 찾으려면 그 오더의 성격(고액/파트너 참여 여부)에
 * 맞는 특정 탭으로 들어가야 했음 — 예를 들어 일반 예산 오더는 어느 관리자 탭에서도
 * 검색이 안 됐다. 고객이 전화로 "제 의뢰 어떻게 됐나요" 물어볼 때 관리자가 즉시
 * 찾을 수 있도록, 모든 탭에서 공통으로 보이는 조회창을 추가한다(전체 오더 대상,
 * 의뢰코드/고객명/연락처로 검색). */
function searchOrderLookup() {
    const input = document.getElementById('admin-order-lookup-input');
    const resultEl = document.getElementById('admin-order-lookup-result');
    if (!input || !resultEl) return;
    const query = input.value.trim().toLowerCase();
    if (!query) { resultEl.innerHTML = ''; return; }

    const matches = (window.AppState.orders || []).filter(o =>
        o.code.toLowerCase().includes(query) ||
        (o.clientName && o.clientName.toLowerCase().includes(query)) ||
        (o.clientPhone && o.clientPhone.includes(query))
    ).slice(0, 10);

    if (matches.length === 0) {
        resultEl.innerHTML = `<p class="text-xs font-bold text-ink-400 text-center py-3">조회 조건에 해당되는 의뢰를 찾을 수 없습니다.</p>`;
        return;
    }

    const statusLabel = (o) => o.status === 'withdrawn' ? '<span class="badge badge-neutral">철회됨</span>'
        : o.status === 'contracted' ? '<span class="badge badge-emerald">계약 체결</span>'
        : o.is1on1 ? '<span class="badge badge-neutral">1:1 지정</span>'
        : '<span class="badge badge-amber">입찰 심사중</span>';

    resultEl.innerHTML = matches.map(o => `
        <div class="p-3.5 bg-ink-50 rounded-xl flex flex-wrap justify-between items-center gap-2 text-xs">
            <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-2"><span class="font-mono text-[10px] font-black text-ink-500">${o.code}</span>${statusLabel(o)}</div>
                <p class="font-bold text-ink-900">${escapeHtml(o.clientName)} 고객님 (${o.clientPhone || '-'})</p>
                <p class="text-[10px] text-ink-500 font-medium truncate">${escapeHtml(o.clientAddress || '')} · ${o.pyung || '-'}평형 · 입찰 ${o.bids ? o.bids.length : 0}/${o.partnerCountLimit || '-'}개사${o.acceptedPartner ? ` · 계약: ${escapeHtml(o.acceptedPartner)}` : ''}</p>
            </div>
            <span class="font-black text-ink-950 shrink-0">₩ ${(o.finalPrice || o.budget || 0).toLocaleString()}만원</span>
        </div>`).join('');
}

/* 매니저 콘솔 > 고객 문의 — "고객센터" 링크로 접수된 1:1 문의에 답변한다.
 * 답변 대기(open) 건을 우선 노출하고, 답변하면 status가 answered로 바뀌면서
 * 고객에게 pushClientNotification으로 알림이 간다. */
let adminSupportStatusFilter = 'all';

function setAdminSupportStatusFilter(key) {
    adminSupportStatusFilter = key;
    renderAdminSupportTickets();
}

function renderAdminSupportTickets() {
    const container = document.getElementById('admin-support-ticket-list');
    if (!container) return;
    const allTickets = window.AppState.supportTickets || [];
    const query = (document.getElementById('admin-support-search-input')?.value || '').trim().toLowerCase();

    const statusTabsEl = document.getElementById('admin-support-status-tabs');
    if (statusTabsEl) {
        const statusTabs = [
            ['all', '전체', allTickets.length],
            ['open', '답변 대기', allTickets.filter(t => t.status === 'open').length],
            ['answered', '답변 완료', allTickets.filter(t => t.status === 'answered').length]
        ];
        statusTabsEl.innerHTML = statusTabs.map(([key, label, count]) =>
            `<button type="button" onclick="setAdminSupportStatusFilter('${key}')" class="gnb-tab ${adminSupportStatusFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    const tickets = allTickets
        .filter(t => adminSupportStatusFilter === 'all' || t.status === adminSupportStatusFilter)
        .filter(t => !query || t.clientName.toLowerCase().includes(query) || (t.clientPhone || '').includes(query) || t.subject.toLowerCase().includes(query))
        .slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) || (new Date(b.date) - new Date(a.date)));

    if (tickets.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap"><i data-lucide="inbox" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">${allTickets.length === 0 ? '등록된 고객 문의가 없습니다.' : '조건에 해당되는 문의가 없습니다.'}</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = tickets.map(t => `
        <div class="surface p-4 space-y-2.5 text-left ${t.status === 'open' ? 'border border-amber-200' : ''}">
            <div class="flex justify-between items-start gap-2">
                <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2 text-[10px] font-bold text-ink-400">
                        <span class="badge ${t.status === 'answered' ? 'badge-emerald' : 'badge-amber'}">${t.status === 'answered' ? '답변 완료' : '답변 대기'}</span>
                        <span>${t.date} · ${escapeHtml(t.clientName)} (${t.clientPhone || '-'})</span>
                    </div>
                    <h5 class="text-sm font-black text-ink-950">${escapeHtml(t.subject)}</h5>
                    <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(t.message)}</p>
                </div>
            </div>
            ${t.adminReply ? `
                <div class="p-3 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">답변 (${t.adminReplyDate})</p><p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(t.adminReply)}</p></div>
            ` : `
                <div class="flex gap-2 pt-1">
                    <input type="text" id="ticket-reply-input-${t.id}" placeholder="답변을 입력하세요" class="input flex-1 text-xs">
                    <button type="button" onclick="replyToSupportTicket('${t.id}')" class="btn btn-dark btn-sm shrink-0">답변 등록</button>
                </div>
            `}
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function replyToSupportTicket(ticketId) {
    const ticket = (window.AppState.supportTickets || []).find(t => t.id === ticketId);
    if (!ticket) return;
    const input = document.getElementById(`ticket-reply-input-${ticketId}`);
    const reply = input ? input.value.trim() : '';
    if (!reply) { showToast('답변 내용을 입력해 주세요.', 'warning'); return; }

    ticket.adminReply = reply;
    ticket.adminReplyDate = getLocalDateString();
    ticket.status = 'answered';

    if (typeof pushLog === 'function') pushLog('MANAGER', 'SUPPORT_REPLY', `[고객 문의 답변] '${ticket.clientName}' 고객님의 문의(${ticket.subject})에 답변 완료.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(ticket.clientPhone, `고객센터에서 문의(${ticket.subject})에 답변을 남겼어요.`);
    showToast('답변이 등록되었습니다.', 'success');
    renderAdminSupportTickets();
}

/* 관리자가 전체 고객/전체 파트너에게 한 번에 공지를 보낼 방법이 지금까지 전혀 없었다
 * (1:1 알림 시스템만 존재). 기존 pushClientNotification/pushPartnerNotification과 동일한
 * 데이터 모양으로 대량 삽입하되, 매 건마다 다시 렌더링하지 않고 발송 종료 후 한 번만 갱신한다. */
function sendAdminBroadcastNotification() {
    const targetSel = document.getElementById('admin-broadcast-target');
    const msgInput = document.getElementById('admin-broadcast-message');
    const target = targetSel ? targetSel.value : 'clients';
    const message = msgInput ? msgInput.value.trim() : '';

    if (!message) { showToast('발송할 공지 내용을 입력해주세요.', 'warning'); return; }
    if (message.length > 500) { showToast('공지 내용은 500자 이내로 입력해주세요.', 'warning'); return; }

    const nowIso = new Date().toISOString();
    const noticeText = `[공지] ${message}`;
    let recipientCount = 0;

    if (target === 'partners') {
        const partners = (window.AppState.partners || []).filter(p => p.status === 'active');
        partners.forEach(p => {
            window.AppState.partnerNotifications.unshift({ id: `pntf-${Date.now()}-${Math.floor(Math.random() * 100000)}`, partnerName: p.name, message: noticeText, date: nowIso, read: false });
            recipientCount++;
        });
        if (window.AppState.partnerNotifications.length > 200) window.AppState.partnerNotifications.length = 200;
        if (typeof renderPartnerNotifications === 'function') renderPartnerNotifications();
        if (typeof updatePartnerNotificationBadge === 'function') updatePartnerNotificationBadge();
    } else {
        const clients = window.AppState.clientAccounts || [];
        clients.forEach(acc => {
            if (!acc.phone || acc.status === 'withdrawn') return;
            window.AppState.clientNotifications.unshift({ id: `ntf-${Date.now()}-${Math.floor(Math.random() * 100000)}`, clientPhone: acc.phone, message: noticeText, date: nowIso, read: false });
            recipientCount++;
        });
        if (window.AppState.clientNotifications.length > 200) window.AppState.clientNotifications.length = 200;
        if (typeof renderClientMyPage === 'function') renderClientMyPage();
    }

    const targetLabel = target === 'partners' ? '전체 파트너사' : '전체 고객';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'BROADCAST', `${targetLabel} ${recipientCount}명에게 공지 발송: "${message.slice(0, 40)}${message.length > 40 ? '...' : ''}"`, 'SUCCESS');
    showToast(`${targetLabel} ${recipientCount}명에게 공지가 발송되었습니다.`, 'success');
    if (msgInput) msgInput.value = '';
}

/* 지금까지 관리자 콘솔은 파트너 모니터링/블랙리스트/가입심사처럼 파트너 관리 도구는
 * 풍부한데, 고객 계정 목록을 한눈에 조회할 방법이 전혀 없었다(전화로 문의가 와도
 * 오더 코드를 모르면 검색조차 불가능). 고객별 의뢰/계약/후기 통계를 모아 보여주고,
 * 이미 있는 통합 오더 조회창(searchOrderLookup)으로 바로 넘겨준다. */
function renderAdminClientManager() {
    const container = document.getElementById('admin-client-manager-list');
    if (!container) return;
    const query = (document.getElementById('admin-client-search-input')?.value || '').trim().toLowerCase();

    const clients = (window.AppState.clientAccounts || []).filter(a => !a.managerRole);
    const filtered = clients.filter(a =>
        !query || a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query) || (a.phone && a.phone.includes(query))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-xs font-bold text-ink-400 text-center py-12">검색 조건에 해당되는 고객이 없습니다.</p>`;
        return;
    }

    container.innerHTML = filtered.map(acc => {
        const myOrders = (window.AppState.orders || []).filter(o => o.clientPhone === acc.phone);
        const contractedCount = myOrders.filter(o => o.status === 'contracted').length;
        const reviewCount = myOrders.filter(o => o.reviewWritten).length;
        const favoriteCount = (acc.favoritePartners || []).length;

        return `
        <div class="surface-flat p-4 flex flex-wrap items-center justify-between gap-3 text-left">
            <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-1.5">
                    <p class="text-sm font-black text-ink-950">${escapeHtml(acc.name)} <span class="text-ink-400 font-bold text-xs">(${escapeHtml(acc.id)})</span></p>
                    ${acc.status === 'withdrawn' ? '<span class="badge badge-neutral">탈퇴함</span>' : acc.isSuspended ? '<span class="badge badge-rose">이용 정지</span>' : ''}
                </div>
                <p class="text-[11px] text-ink-500 font-bold">연락처 ${escapeHtml(acc.phone || '-')}</p>
            </div>
            <div class="flex items-center gap-3 text-[11px] font-bold text-ink-600 shrink-0">
                <span>의뢰 ${myOrders.length}건</span><span>계약 ${contractedCount}건</span><span>후기 ${reviewCount}건</span><span>관심업체 ${favoriteCount}곳</span>
                <button type="button" onclick="jumpToClientOrderLookup('${escapeHtml(acc.phone || '')}')" class="btn btn-secondary btn-sm">의뢰 조회</button>
                <button type="button" onclick="toggleClientSuspension('${acc.id}')" class="btn ${acc.isSuspended ? 'btn-dark' : 'btn-secondary'} btn-sm">${acc.isSuspended ? '정지 해제' : '계정 정지'}</button>
            </div>
        </div>`;
    }).join('');
}

/* 파트너에는 제명/일시중단/옐로카드 같은 제재 수단이 이미 있는데, 고객 계정에는
 * 어떤 제재 수단도 없었다 — 악성 후기·허위 의뢰가 반복되는 계정을 막을 방법이
 * 전혀 없던 공백. isSuspended 플래그만으로 가볍게 로그인을 막는다(파트너의
 * isPaused와 동일한 boolean 토글 패턴). */
function toggleClientSuspension(accountId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account) return;
    account.isSuspended = !account.isSuspended;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_SUSPEND', `'${account.name}'(${account.id}) 고객 계정을 ${account.isSuspended ? '이용 정지' : '정지 해제'}했습니다.`, account.isSuspended ? 'WARNING' : 'INFO');
    showToast(`[${account.name}] 고객 계정이 ${account.isSuspended ? '이용 정지되었습니다' : '정지 해제되었습니다'}.`, account.isSuspended ? 'warning' : 'success');
    renderAdminClientManager();
}

/* 계약 체결 후에는 되돌릴 방법이 전혀 없었던 공백을 해소하기 위해, 고객이 취소를
 * 요청하면(order.status='cancel_requested') 이 탭에서 매니저가 승인/반려한다.
 * 승인 시 order.status='cancelled'로 전환되면 recalculateKPIs()의 'contracted' 필터에서
 * 자동으로 빠져 GMV/에스크로/수수료 집계가 자연스럽게 되돌려진다(별도 역산 불필요). */
function renderAdminContractCancellations() {
    const container = document.getElementById('admin-cancellations-list');
    if (!container) return;
    const requests = (window.AppState.orders || []).filter(o => o.status === 'cancel_requested');

    if (requests.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">현재 심사 대기 중인 계약 취소 요청이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = requests.map(o => `
        <div class="surface p-5 space-y-3 text-left">
            <div class="flex justify-between items-start gap-2">
                <div class="space-y-1">
                    <span class="badge badge-amber">취소 심사 대기</span>
                    <h4 class="text-sm font-black text-ink-950">${o.code} · ${escapeHtml(o.clientName)} 고객님</h4>
                    <p class="text-[11px] text-ink-500 font-bold">계약 파트너사: ${escapeHtml(o.acceptedPartner || '-')} · 계약금액 ₩ ${(o.finalPrice || 0).toLocaleString()}만원</p>
                </div>
            </div>
            <div class="p-3 bg-ink-50 rounded-xl">
                <p class="text-[10px] font-black text-ink-500 uppercase tracking-wider mb-1">${o.cancelRequest && o.cancelRequest.requestedBy === 'partner' ? '파트너사' : '고객'} 요청 사유 (${o.cancelRequest ? o.cancelRequest.date : '-'})</p>
                <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(o.cancelRequest ? o.cancelRequest.reason : '-')}</p>
            </div>
            <div class="flex items-center gap-2 justify-end pt-1">
                <button type="button" onclick="rejectContractCancellation('${o.code}')" class="btn btn-secondary btn-sm">요청 반려 (계약 유지)</button>
                <button type="button" onclick="approveContractCancellation('${o.code}')" class="btn btn-dark btn-sm text-roseCustom">취소 승인</button>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function approveContractCancellation(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'cancel_requested') return;
    order.status = 'cancelled';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'CONTRACT_CANCEL_APPROVE', `[계약 취소 승인] 오더 ${order.code}의 계약 취소 요청을 승인했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `요청하신 계약(${order.code}) 취소가 승인되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `계약(${order.code}) 취소 요청이 승인되어 계약이 취소되었습니다.`);
    showToast(`오더 ${order.code}의 계약 취소를 승인했습니다.`, 'success');
    renderAdminContractCancellations();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

function rejectContractCancellation(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'cancel_requested') return;
    order.status = 'contracted';
    order.cancelRequest = null;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'CONTRACT_CANCEL_REJECT', `[계약 취소 반려] 오더 ${order.code}의 계약 취소 요청을 반려했습니다. 계약이 유지됩니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `요청하신 계약(${order.code}) 취소가 반려되어 계약이 그대로 유지됩니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `계약(${order.code}) 취소 요청이 반려되어 계약이 그대로 유지됩니다.`);
    showToast(`오더 ${order.code}의 계약 취소 요청을 반려했습니다.`, 'info');
    renderAdminContractCancellations();
}

function jumpToClientOrderLookup(phone) {
    const input = document.getElementById('admin-order-lookup-input');
    if (!input) return;
    input.value = phone;
    if (typeof searchOrderLookup === 'function') searchOrderLookup();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderAdminOrderAllocation() {
    const container = document.getElementById('admin-order-allocation-container');
    if (!container) return;

    const orders = window.AppState.orders || [];
    const certifiedPartners = (window.AppState.partners || []).filter(p => p.status !== 'banned' && p.isCertified);
    const targetOrders = orders.filter(o => o.status === 'bidding' && o.budget >= 7000 && !o.is1on1);

    if (targetOrders.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">배정 대기 중인 7천만원 이상 고액 일반 오더가 존재하지 않습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let html = `
        <div class="surface surface-lg p-6 space-y-5 text-left">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-ink-100 pb-4">
                <div><span class="badge badge-amber">High-Value Direct Allocation</span><h3 class="text-base font-black text-ink-950 tracking-tight mt-1 flex items-center gap-2"><span>7,000만원 이상 고액 오더 수동 배정관</span><span class="badge badge-brand">${targetOrders.length}건 대기 중</span></h3></div>
                <div class="text-xs font-bold text-ink-500">실시간 보증 매칭 잔여 유치액: <span class="font-black text-ink-950">₩ ${(targetOrders.reduce((acc, cur) => acc + cur.budget, 0)).toLocaleString()}만원</span></div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-ink-50 rounded-xl border border-ink-100">
                <label class="flex items-center gap-2 text-xs font-black text-ink-700 cursor-pointer">
                    <input type="checkbox" id="admin-order-select-all" onchange="toggleSelectAllOrders(this)" class="w-4 h-4">
                    전체 오더 선택
                </label>
                <button type="button" onclick="bulkAutoAllocateSelectedOrders()" class="btn btn-primary btn-sm whitespace-nowrap"><i data-lucide="zap" class="w-3.5 h-3.5"></i> 선택 오더 일괄 자동배정</button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`;

    targetOrders.forEach(o => {
        const partnerOptions = certifiedPartners.length > 0 ? certifiedPartners.map(p => `<option value="${p.name}">${p.name} (★ ${p.rating.toFixed(1)} / 인증)</option>`).join('') : `<option value="">인증 보유 파트너사가 없습니다</option>`;
        const currentMatchedCount = o.bids ? o.bids.length : 0;
        const totalSlotLimit = o.partnerCountLimit || 3;

        let assignedListHtml = `<div class="pt-2.5 border-t border-ink-100 space-y-2"><div class="flex justify-between items-center text-[10px] font-bold"><span class="text-ink-500 flex items-center gap-1"><i data-lucide="users" class="w-3.5 h-3.5 text-ink-400"></i> 현재 배정 현황:</span><span class="badge ${currentMatchedCount === totalSlotLimit ? 'badge-emerald' : 'badge-neutral'}">${currentMatchedCount} / ${totalSlotLimit} 개사 배정 완료</span></div>`;
        assignedListHtml += currentMatchedCount > 0
            ? `<div class="flex flex-wrap gap-1.5">${o.bids.map(b => `<span class="badge badge-neutral"><span class="badge-dot bg-emeraldCustom"></span> ${b.partner}</span>`).join('')}</div>`
            : `<div class="p-2.5 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center"><p class="text-[10px] text-ink-400 font-bold">아직 배정된 파트너사가 없습니다. (인증 파트너 전속 수동 배정 또는 일괄 자동 배정 가능)</p></div>`;
        assignedListHtml += `</div>`;

        html += `
            <div class="surface-flat p-5 space-y-3.5 hover:border-ink-300 transition-all text-left flex flex-col justify-between">
                <div class="space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="admin-order-select-checkbox w-4 h-4" data-order-code="${o.code}" onchange="syncSelectAllOrdersCheckbox()">
                            <span class="font-mono text-[11px] font-black text-ink-500 bg-white px-2 py-0.5 rounded border border-ink-200">${o.code}</span>
                        </label>
                        <span class="badge badge-brand">₩ ${o.budget.toLocaleString()} 만원</span>
                    </div>
                    <div class="space-y-1"><h4 class="text-sm font-black text-ink-950">${o.clientName} 고객님 (${o.pyung}평형 / ${o.spaceType === 'residential' ? '주거' : '상업'})</h4><p class="text-xs text-ink-600 font-bold leading-relaxed line-clamp-1"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline text-ink-400"></i> ${o.clientAddress}</p></div>
                    <div class="grid grid-cols-2 gap-2 text-[10px] font-bold text-ink-500 bg-white p-2.5 rounded-xl border border-ink-100"><span>착공예정: ${o.preferredDate || '미정'}</span><span>공실여부: ${o.vacancy === 'empty' ? '공실' : '거주중'}</span></div>
                    ${assignedListHtml}
                </div>
                <div class="pt-3 border-t border-ink-200 flex items-center gap-2">
                    <select id="select-partner-${o.code}" class="select flex-1">
                        <option value="">인증 파트너 수동 선택...</option>${partnerOptions}
                    </select>
                    <button type="button" onclick="allocateOrderToPartner('${o.code}')" class="btn btn-dark btn-sm whitespace-nowrap">전속 배정</button>
                    <button type="button" onclick="autoAllocateOrder('${o.code}')" class="btn btn-primary btn-sm whitespace-nowrap" title="남은 슬롯 개수만큼 우수 인증 파트너 일괄 자동 배정"><i data-lucide="zap" class="w-3.5 h-3.5"></i> 일괄 자동</button>
                </div>
            </div>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleSelectAllOrders(checkbox) {
    document.querySelectorAll('.admin-order-select-checkbox').forEach(cb => { cb.checked = checkbox.checked; });
}

function syncSelectAllOrdersCheckbox() {
    const all = Array.from(document.querySelectorAll('.admin-order-select-checkbox'));
    const selectAll = document.getElementById('admin-order-select-all');
    if (selectAll) selectAll.checked = all.length > 0 && all.every(cb => cb.checked);
}

/* 체크된 오더들을 한 번에 자동 배정한다. 각 오더는 autoAllocateOrderCore로 남은
 * 슬롯만큼 평점 우수 인증 파트너를 채우고, 결과를 모아 한 번의 토스트/로그로 요약한다. */
function bulkAutoAllocateSelectedOrders() {
    const checked = Array.from(document.querySelectorAll('.admin-order-select-checkbox:checked')).map(cb => cb.dataset.orderCode);
    if (checked.length === 0) { showToast('일괄 자동배정할 오더를 먼저 선택해 주세요.', 'warning'); return; }

    let successCount = 0, skippedCount = 0;
    checked.forEach(orderCode => {
        const result = autoAllocateOrderCore(orderCode);
        if (result && result.assignedCount > 0) successCount++; else skippedCount++;
    });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BULK_AUTO_ALLOCATE', `[일괄 자동배정] 선택한 오더 ${checked.length}건 중 ${successCount}건 배정 완료.`, 'SUCCESS');
    showToast(`선택한 오더 ${checked.length}건 중 ${successCount}건 일괄 자동배정을 완료했습니다!${skippedCount > 0 ? ` (${skippedCount}건은 이미 배정이 다 찼거나 배정 가능한 파트너가 없어 건너뜀)` : ''}`, 'success');
    renderAdminOrderAllocation();
    recalculateKPIs();
}

function allocateOrderToPartner(orderCode) {
    const selectEl = document.getElementById(`select-partner-${orderCode}`);
    if (!selectEl || !selectEl.value) { showToast("배정할 안심 인증 파트너사를 선택해주세요.", "warning"); return; }

    const partnerName = selectEl.value;
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;

    if (order.bids.some(b => b.partner === partnerName)) { showToast(`이미 [${partnerName}] 파트너사가 이 오더에 배정되어 있습니다.`, "info"); return; }
    if (order.bids.length >= order.partnerCountLimit) { showToast(`목표 배정 수량(${order.partnerCountLimit}개사)이 이미 차서 더 이상 추가할 수 없습니다.`, "warning"); return; }

    order.bids.push({ partner: partnerName, price: order.budget, desc: `[매니저 센터 직할 수동 배정] ${partnerName}에 프리미엄 전속 오더가 안전하게 할당되었습니다.`, verified: true, progress: 'bidding' });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ALLOCATE', `[매니저 센터] 고액 오더(${orderCode}, ₩ ${order.budget.toLocaleString()}만원)를 [${partnerName}] 파트너사에 수동 배정완료.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName} 파트너사가 배정되어 견적서를 보냈어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `매니저 센터가 고액 오더(${orderCode})를 전속 배정했어요. (예산 ₩ ${order.budget.toLocaleString()}만원)`);
    renderAdminOrderAllocation(); recalculateKPIs();
    showToast(`[${partnerName}] 파트너사에 고액 오더 배정이 완료되었습니다!`, "success");
}

/* 오더 하나에 대해 남은 슬롯만큼 평점 우수 인증 파트너를 채워 배정하는 핵심 로직.
 * 토스트/재렌더링은 호출부(autoAllocateOrder 단건, bulkAutoAllocateSelectedOrders 일괄)에서 처리한다. */
function autoAllocateOrderCore(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return null;

    const currentMatchedCount = order.bids ? order.bids.length : 0;
    const totalSlotLimit = order.partnerCountLimit || 3;
    const slotsNeeded = totalSlotLimit - currentMatchedCount;
    if (slotsNeeded <= 0) return { assignedCount: 0, reason: 'full' };

    let candidates = (window.AppState.partners || []).filter(p => p.status !== 'banned' && !p.isPaused && p.isCertified && !order.bids.some(b => b.partner === p.name));
    if (candidates.length === 0) return { assignedCount: 0, reason: 'no-candidates' };

    candidates.sort((a, b) => b.rating - a.rating);
    const selectedToAssign = candidates.slice(0, slotsNeeded);
    selectedToAssign.forEach(selected => {
        order.bids.push({ partner: selected.name, price: order.budget, desc: `[추천 일괄 자동 배정] 우수 평점 인증 파트너사 ${selected.name}에 전속 배정되었습니다.`, verified: true, progress: 'bidding' });
    });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'AUTO_ALLOCATE', `[자동 배정] 오더 ${orderCode} -> [${selectedToAssign.map(s => s.name).join(', ')}] ${selectedToAssign.length}개 인증 파트너사 일괄 자동 배정 완료.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `파트너사 ${selectedToAssign.length}곳이 추가로 배정되어 견적서를 보냈어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') {
        selectedToAssign.forEach(selected => pushPartnerNotification(selected.name, `자동 배정으로 새 오더(${orderCode})에 매칭되었어요.`));
    }
    return { assignedCount: selectedToAssign.length, assignedNames: selectedToAssign.map(s => s.name) };
}

function autoAllocateOrder(orderCode) {
    const result = autoAllocateOrderCore(orderCode);
    if (!result) return;
    if (result.reason === 'full') { showToast(`이미 목표 배정 인원이 모두 차있습니다.`, "info"); return; }
    if (result.reason === 'no-candidates') { showToast("배정 가능한 추가 인증 파트너사가 존재하지 않습니다.", "warning"); return; }

    renderAdminOrderAllocation(); recalculateKPIs();
    showToast(`${result.assignedCount}개 인증 파트너사에 일괄 자동 배정이 성공적으로 완료되었습니다!`, "success");
}

/* 업체가 쌓일수록 "제명된 곳만", "지금 일시중단 중인 곳만" 같은 걸 눈으로 하나씩
 * 찾기 번거로워진다 — 텍스트 검색과 별개로 상태 필터 탭을 추가한다. */
function getPartnerMonitorStatusKey(p) {
    if (p.status === 'banned') return 'banned';
    if (p.isPaused) return 'paused';
    if (p.strikeCount > 0) return 'warning';
    return 'active';
}

let adminPartnerMonitorStatusFilter = 'all';

function setAdminPartnerMonitorStatusFilter(key) {
    adminPartnerMonitorStatusFilter = key;
    renderAdminPartnerMonitor();
}

function renderAdminPartnerMonitor() {
    const container = document.getElementById('admin-partner-monitor-list');
    if (!container) return;
    const input = document.getElementById('admin-partner-search');
    const query = input ? input.value.trim().toLowerCase() : '';
    const allPartners = window.AppState.partners || [];

    const statusTabsEl = document.getElementById('admin-partner-status-tabs');
    if (statusTabsEl) {
        const statusTabs = [
            ['all', '전체', allPartners.length],
            ['active', '정상', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'active').length],
            ['warning', '경고', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'warning').length],
            ['paused', '일시중단', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'paused').length],
            ['banned', '제명', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'banned').length]
        ];
        statusTabsEl.innerHTML = statusTabs.map(([key, label, count]) =>
            `<button type="button" onclick="setAdminPartnerMonitorStatusFilter('${key}')" class="gnb-tab ${adminPartnerMonitorStatusFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    const filtered = allPartners
        .filter(p => adminPartnerMonitorStatusFilter === 'all' || getPartnerMonitorStatusKey(p) === adminPartnerMonitorStatusFilter)
        .filter(p => !query || p.name.toLowerCase().includes(query) || (p.bizFile && p.bizFile.includes(query)));

    if (filtered.length === 0) { container.innerHTML = '<p class="text-xs font-bold text-ink-500 text-center col-span-full py-12">검색 조건에 해당되는 파트너사가 존재하지 않습니다.</p>'; return; }

    container.innerHTML = '';
    filtered.forEach(p => {
        const isBanned = p.status === 'banned';
        const isWarning = p.strikeCount > 0;
        let statusDotClass = 'bg-emeraldCustom', statusText = '정상 가동';
        if (isBanned) { statusDotClass = 'bg-roseCustom'; statusText = '영구 제명'; }
        else if (isWarning) { statusDotClass = 'bg-amberCustom'; statusText = `옐로카드 ${p.strikeCount}회`; }

        const activeBidsCount = (window.AppState.orders || []).filter(o => o.bids && o.bids.some(b => b.partner === p.name)).length;
        const completedContractsCount = (window.AppState.orders || []).filter(o => o.status === 'contracted' && o.acceptedPartner === p.name).length;

        const card = document.createElement('div');
        card.className = "surface p-5 space-y-4 hover:border-ink-300 transition-all text-left flex flex-col justify-between";
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start gap-2">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2"><span class="badge badge-neutral"><span class="badge-dot ${statusDotClass}"></span>${statusText}</span>${p.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 우리집 인증</span>` : ''}${p.isPaused ? `<span class="badge badge-amber"><i data-lucide="pause-circle" class="w-2.5 h-2.5"></i> 매칭 일시중단</span>` : ''}</div>
                        <h4 class="text-sm font-black text-ink-950">${p.name}</h4>
                        <p class="text-[10px] text-ink-400 font-mono">사업자 번호: ${p.bizFile || '미등록'}</p>
                    </div>
                    <div class="text-right shrink-0"><div class="flex items-center gap-1 text-xs font-black text-ink-800 justify-end"><span class="text-gold-500">★</span><span>${p.rating ? p.rating.toFixed(1) : '5.0'}</span></div><span class="text-[10px] text-ink-400 font-bold block mt-0.5">리뷰 ${p.reviews ? p.reviews.length : 0}개</span></div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-center text-xs">
                    <div class="article-spec-chip items-center"><span>참여 오더</span><span class="val">${activeBidsCount}건</span></div>
                    <div class="article-spec-chip items-center"><span>계약 체결</span><span class="val">${completedContractsCount}건</span></div>
                </div>
            </div>
            <div class="pt-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.openClientPartnerProfile('${p.name}')" class="btn btn-secondary btn-sm">프로필 조회</button>
                    <button type="button" onclick="openPartnerMetricsModal('${p.name}')" class="btn btn-dark btn-sm"><i data-lucide="bar-chart-2" class="w-3 h-3"></i> 상세 성과</button>
                    <button type="button" onclick="viewPartnerBizCertDoc('${p.id}')" class="btn btn-secondary btn-sm"><i data-lucide="file-text" class="w-3 h-3"></i> 사업자등록증</button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="togglePartnerCertification('${p.name}')" class="btn btn-secondary btn-sm">${p.isCertified ? '인증 해제' : '인증 부여'}</button>
                    ${isWarning ? `<button type="button" onclick="resetPartnerStrikes('${p.name}')" class="btn btn-secondary btn-sm">경고 리셋</button>` : ''}
                    ${!isBanned ? `<button type="button" onclick="issuePartnerStrike('${p.name}')" class="btn btn-secondary btn-sm">+ 옐로카드</button>` : ''}
                </div>
            </div>`;
        container.appendChild(card);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 고객이 남긴 후기는 지금까지 관리자가 검토/삭제할 방법이 전혀 없었다 — 허위·악의적인
 * 후기가 올라와도 매니저 센터에서 대응할 수단이 없던 기능 공백. 파트너 상세 성과
 * 모달에 후기 목록과 삭제 버튼을 추가한다. */
function buildAdminReviewModerationHtml(partner) {
    const reviews = partner.reviews || [];
    if (reviews.length === 0) {
        return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">등록된 후기가 없습니다.</div>`;
    }
    return reviews.map((r, idx) => `
        <div class="p-3.5 bg-ink-50/80 rounded-xl border border-ink-100 space-y-1.5 text-left">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-ink-800">${escapeHtml(r.client)}</span>
                    <span class="text-gold-500 font-extrabold text-xs">★ ${r.rating}.0</span>
                    <span class="text-[10px] text-ink-400 font-bold">${r.date}</span>
                </div>
                <button type="button" onclick="adminDeleteReview('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
            </div>
            <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(r.text)}</p>
        </div>`).join('');
}

function adminDeleteReview(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.reviews || !partner.reviews[reviewIdx]) return;
    partner.reviews.splice(reviewIdx, 1);
    partner.rating = partner.reviews.length > 0
        ? Math.round((partner.reviews.reduce((acc, r) => acc + r.rating, 0) / partner.reviews.length) * 10) / 10
        : 5.0;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_MODERATE', `[후기 삭제] '${partnerName}' 파트너의 후기를 매니저 센터에서 삭제 조치함.`, 'WARNING');
    showToast('후기를 삭제했습니다.', 'info');
    openPartnerMetricsModal(partnerName);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 관리자용 상세 성과 모달과 파트너 본인용 "내 실적" 탭이 똑같은 참여/계약/GMV
 * 계산 로직을 쓴다 — 한 곳에 모아두면 나중에 계산 방식이 바뀌어도 두 화면이
 * 어긋날 일이 없다. */
function computePartnerMetrics(partnerName) {
    const allOrders = window.AppState.orders || [];
    const participatedOrders = allOrders.filter(o => o.bids && o.bids.some(b => b.partner === partnerName));
    const contractedOrders = allOrders.filter(o => o.status === 'contracted' && o.acceptedPartner === partnerName);
    const participatedCount = participatedOrders.length;
    const contractedCount = contractedOrders.length;
    const contractRate = participatedCount > 0 ? ((contractedCount / participatedCount) * 100).toFixed(1) : '0.0';

    let totalGmv = 0, totalCommissionPaid = 0, pendingEscrow = 0;
    contractedOrders.forEach(o => {
        // 수수료·GMV는 고객이 처음 써낸 예산이 아니라 파트너가 견적서를 바탕으로 입력·확정한
        // 최종 계약금액(o.finalPrice)만 반영한다. 아직 미확정인 건은 0으로 집계된다.
        const price = o.finalPrice || 0;
        totalGmv += price;
        const comm = Math.floor(price * PLATFORM_COMMISSION_RATE);
        if (o.commissionPaid) totalCommissionPaid += comm; else pendingEscrow += comm;
    });

    // 포트폴리오의 '좋아요'처럼 파트너 본인 업체를 몇 명이나 관심 등록했는지 확인할
    // 방법이 없었다 — 좋아요와 대칭되는 지표로 관심 고객 수를 계산해 넣는다.
    const favoriteClientCount = (window.AppState.clientAccounts || []).filter(a => (a.favoritePartners || []).includes(partnerName)).length;

    return { participatedCount, contractedCount, contractRate, totalGmv, totalCommissionPaid, pendingEscrow, contractedOrders, favoriteClientCount };
}

function buildPartnerContractedOrdersListHtml(contractedOrders, partnerName) {
    if (contractedOrders.length === 0) return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">최근 체결된 안심 계약 내역이 없습니다.</div>`;
    return contractedOrders.map(o => {
        const steps = getPartnerContractProgressSteps(o, partnerName);
        const contractBtn = o.contractDoc
            ? `<button type="button" onclick="openUploadedPartnerDoc('${o.code}', 'contract')" class="btn btn-outline btn-sm"><i data-lucide="file-text" class="w-3 h-3 text-brand-500"></i> 계약서 (업로드본)</button>`
            : `<button type="button" onclick="downloadContractDoc('${o.code}', '${partnerName}')" class="btn btn-outline btn-sm"><i data-lucide="file-text" class="w-3 h-3 text-ink-400"></i> 계약서 (샘플)</button>`;
        const estimateBtn = o.estimateDoc
            ? `<button type="button" onclick="openUploadedPartnerDoc('${o.code}', 'estimate')" class="btn btn-outline btn-sm"><i data-lucide="calculator" class="w-3 h-3 text-emeraldCustom"></i> 견적서 (업로드본)</button>`
            : `<button type="button" onclick="downloadEstimateDoc('${o.code}', '${partnerName}')" class="btn btn-outline btn-sm"><i data-lucide="calculator" class="w-3 h-3 text-ink-400"></i> 견적서 (샘플)</button>`;
        return `
        <div class="p-3.5 bg-ink-50/80 rounded-xl border border-ink-100 space-y-2.5 text-xs text-left">
            <div class="flex justify-between items-center">
                <div class="space-y-0.5"><div class="flex items-center gap-2"><span class="font-mono text-[10px] font-black text-ink-500 bg-white px-1.5 py-0.5 rounded border border-ink-200">${o.code}</span><h5 class="font-black text-ink-950">${o.clientName} 고객님 (${o.pyung}평형)</h5></div><p class="text-[10px] text-ink-500 font-medium truncate max-w-xs">${o.clientAddress}</p></div>
                <div class="text-right shrink-0"><span class="font-black text-ink-950 text-xs">${o.finalPrice ? `₩ ${o.finalPrice.toLocaleString()} 만원` : '<span class="text-ink-400">계약금액 미확정</span>'}</span><span class="block text-[9px] font-bold ${o.commissionPaid ? 'text-emeraldCustom' : (o.finalPrice ? 'text-amberCustom' : 'text-ink-400')}">${o.commissionPaid ? '수수료 납부 완료' : (o.finalPrice ? '에스크로 정산 대기' : '견적서·계약금액 확정 대기')}</span></div>
            </div>
            <div class="pt-2 border-t border-ink-200">${renderPartnerContractProgressStepperHtml(steps)}</div>
            <div class="pt-2 border-t border-ink-200 flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-extrabold text-ink-500 flex items-center gap-1"><i data-lucide="file-check-2" class="w-3.5 h-3.5 text-ink-400"></i> 계약 서류 확인</span>
                <div class="flex items-center gap-1.5">
                    ${contractBtn}
                    ${estimateBtn}
                </div>
            </div>
        </div>`;
    }).join('');
}

function openPartnerMetricsModal(partnerName) {
    const partner = (window.AppState.partners || []).find(p => p.name === partnerName);
    if (!partner) return;

    let modal = document.getElementById('admin-partner-metrics-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'admin-partner-metrics-modal'; modal.className = "hidden modal-overlay"; modal.style.zIndex = '220'; document.body.appendChild(modal); }

    const { participatedCount, contractedCount, contractRate, totalGmv, totalCommissionPaid, pendingEscrow, contractedOrders, favoriteClientCount } = computePartnerMetrics(partnerName);
    const contractedListHtml = buildPartnerContractedOrdersListHtml(contractedOrders, partnerName);

    const isBanned = partner.status === 'banned';
    const isWarning = partner.strikeCount > 0;
    let statusText = '정상 가동 중', statusDotColor = 'bg-emeraldCustom';
    if (isBanned) { statusText = '영구 제명'; statusDotColor = 'bg-roseCustom'; }
    else if (isWarning) { statusText = `옐로카드 ${partner.strikeCount}회`; statusDotColor = 'bg-amberCustom'; }

    modal.innerHTML = `
        <div id="admin-partner-metrics-modal-card" class="modal-card w-full max-w-2xl p-6 sm:p-8 space-y-6 text-left">
            <div class="flex justify-between items-center border-b border-ink-100 pb-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2"><span class="badge badge-neutral"><span class="badge-dot ${statusDotColor}"></span>${statusText}</span>${partner.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 우리집 인증</span>` : ''}</div>
                    <h3 class="text-base sm:text-lg font-black text-ink-950 tracking-tight mt-1">${partner.name} - 경영 및 안심 거래 지표 분석</h3>
                    <p class="text-xs text-ink-500 font-medium">사업자 등록번호: ${partner.bizFile || '미등록'} | 누적 평점: ★ ${partner.rating ? partner.rating.toFixed(1) : '5.0'}</p>
                </div>
                <button type="button" onclick="closePartnerMetricsModal()" class="btn btn-ghost btn-sm px-1.5" aria-label="닫기"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="space-y-5 max-h-[65vh] overflow-y-auto custom-scroll pr-1">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="article-spec-chip"><span>참여 입찰 오더</span><span class="val">${participatedCount} 건</span></div>
                    <div class="article-spec-chip"><span>최종 계약 체결</span><span class="val">${contractedCount} 건</span></div>
                    <div class="article-spec-chip"><span>계약 성공률</span><span class="val">${contractRate} %</span></div>
                    <div class="article-spec-chip"><span>누적 거래액 (GMV)</span><span class="val">₩ ${totalGmv.toLocaleString()} 만원</span></div>
                    <div class="article-spec-chip"><span>수수료 지불완료</span><span class="val">₩ ${totalCommissionPaid.toLocaleString()} 만원</span></div>
                    <div class="article-spec-chip"><span>보증 에스크로 잔액</span><span class="val">₩ ${pendingEscrow.toLocaleString()} 만원</span></div>
                    <div class="article-spec-chip"><span>관심 고객 수</span><span class="val">${favoriteClientCount} 명</span></div>
                </div>
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-check" class="w-4 h-4 text-ink-600"></i> 최근 안심 계약 체결 및 안심 문서 검증 (${contractedCount}건)</h4>
                    <div class="space-y-2">${contractedListHtml}</div>
                </div>
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="star" class="w-4 h-4 text-ink-600"></i> 등록된 안심 후기 관리 (${(partner.reviews || []).length}건)</h4>
                    <div class="space-y-2">${buildAdminReviewModerationHtml(partner)}</div>
                </div>
            </div>
            <div class="pt-3 border-t border-ink-100 flex justify-end"><button type="button" onclick="closePartnerMetricsModal()" class="btn btn-dark">확인 및 닫기</button></div>
        </div>`;

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-partner-metrics-modal-card')?.classList.add('modal-open'), 30);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePartnerMetricsModal() {
    const modal = document.getElementById('admin-partner-metrics-modal');
    const card = document.getElementById('admin-partner-metrics-modal-card');
    if (modal && card) { card.classList.remove('modal-open'); setTimeout(() => modal.classList.add('hidden'), 150); }
}

/* 파트너 콘솔 > 내 실적 — 지금까지는 참여 오더 수/계약 성공률/GMV/수수료 같은
 * 실적 지표를 관리자만(openPartnerMetricsModal) 볼 수 있었고, 파트너 본인은
 * 자기 성과를 확인할 방법이 전혀 없었다. computePartnerMetrics/
 * buildPartnerContractedOrdersListHtml을 그대로 재사용해 관리자 화면과 숫자가
 * 어긋나지 않게 한다. */
function renderPartnerPerformanceView() {
    const container = document.getElementById('partner-mode-performance-view');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    const { participatedCount, contractedCount, contractRate, totalGmv, totalCommissionPaid, pendingEscrow, contractedOrders, favoriteClientCount } = computePartnerMetrics(partnerName);
    const contractedListHtml = buildPartnerContractedOrdersListHtml(contractedOrders, partnerName);

    container.innerHTML = `
        <div class="surface surface-lg p-6 sm:p-8 space-y-5 text-left">
            <div class="border-b border-ink-100 pb-4">
                <span class="badge badge-brand">경영 지표</span>
                <h4 class="text-sm sm:text-base font-black text-ink-950 tracking-tight mt-1 flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-4 h-4 text-brand-500"></i> 내 실적 요약</h4>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="article-spec-chip"><span>참여 입찰 오더</span><span class="val">${participatedCount} 건</span></div>
                <div class="article-spec-chip"><span>최종 계약 체결</span><span class="val">${contractedCount} 건</span></div>
                <div class="article-spec-chip"><span>계약 성공률</span><span class="val">${contractRate} %</span></div>
                <div class="article-spec-chip"><span>누적 거래액 (GMV)</span><span class="val">₩ ${totalGmv.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>수수료 지불완료</span><span class="val">₩ ${totalCommissionPaid.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>보증 에스크로 잔액</span><span class="val">₩ ${pendingEscrow.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>관심 고객 수</span><span class="val">${favoriteClientCount} 명</span></div>
            </div>
            <div class="space-y-2.5 pt-2">
                <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-check" class="w-4 h-4 text-ink-600"></i> 최근 안심 계약 체결 및 안심 문서 검증 (${contractedCount}건)</h4>
                <div class="space-y-2">${contractedListHtml}</div>
            </div>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function buildDocFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadContractDoc(orderCode, partnerName) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const clientName = order ? order.clientName : "고객";
    const address = order ? order.clientAddress : "부산광역시";
    const price = order ? (order.finalPrice || order.budget) : 0;
    const content = `====================================================\n[우리집 안심 중개] 실내건축 표준 안심 공사계약서\n====================================================\n\n1. 프로젝트 정보\n   - 의뢰 코드: ${orderCode}\n   - 시공 장소: ${address}\n   - 의뢰 고객: ${clientName} 고객님\n   - 담당 시공사: ${partnerName}\n\n2. 계약 금액 및 정산 조건\n   - 총 시공 계약 금액: ₩ ${price.toLocaleString()} 만원 (VAT 포함)\n   - 안심 에스크로 결제 보증: 100% 본사 이행보증 가입 완료\n   - 하자이행 보증기간: 준공일로부터 3년 무상 보증\n\n3. 특약 사항\n   - 본 계약은 '우리집 안심 중개' 플랫폼 표준 약관에 따라\n     하자보증보험 및 공정별 시공 감리 규정을 준수합니다.\n   - 당사자 간 이면 계약 및 수수료 우회 직거래 시 삼진아웃 규정이 적용됩니다.\n\n발행일자: ${getLocalDateString()}\n플랫폼 인증 검증 완료: (주)우리집안심중개 관제센터\n====================================================`;
    buildDocFile(content, `[우리집안심중개]_표준계약서_${orderCode}_${partnerName}.txt`);
    if (typeof showToast === 'function') showToast(`[${orderCode}] 안심 표준 계약서 다운로드가 시작되었습니다.`, "success");
}

function downloadEstimateDoc(orderCode, partnerName) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const clientName = order ? order.clientName : "고객";
    const pyung = order ? order.pyung : 0;
    const price = order ? (order.finalPrice || order.budget) : 0;
    const content = `====================================================\n[우리집 안심 중개] 공종별 세부 정밀 견적 내역서\n====================================================\n\n1. 견적 개요\n   - 오더 번호: ${orderCode}\n   - 고객명: ${clientName} 고객님\n   - 시공 면적: ${pyung}평형\n   - 시공사: ${partnerName}\n\n2. 공종별 가견적 세부 산출 내역 (단위: 만원)\n   --------------------------------------------------\n   [01] 철거 및 폐기물 처리 공사: ₩ ${Math.floor(price * 0.12).toLocaleString()} 만원\n   [02] 창호 및 단열 보강 공사: ₩ ${Math.floor(price * 0.22).toLocaleString()} 만원\n   [03] 목공 및 문선/몰딩 공사: ₩ ${Math.floor(price * 0.18).toLocaleString()} 만원\n   [04] 타일 및 욕실 수전 공사: ₩ ${Math.floor(price * 0.20).toLocaleString()} 만원\n   [05] 도배 및 친환경 마루 공사: ₩ ${Math.floor(price * 0.15).toLocaleString()} 만원\n   [06] 조도 및 전기/라인조명 공사: ₩ ${Math.floor(price * 0.13).toLocaleString()} 만원\n   --------------------------------------------------\n   - 총 합계 금액: ₩ ${price.toLocaleString()} 만원 (VAT 포함)\n\n3. 특이사항\n   - 자재 스펙: E0 등급 친환경 합판, 수입 포셀린 타일, 무몰딩 마감\n   - 본 견적서는 우리집 안심 중개 보증 심사를 통과한 정식 서류입니다.\n\n발행일자: ${getLocalDateString()}\n====================================================`;
    buildDocFile(content, `[우리집안심중개]_정밀견적서_${orderCode}_${partnerName}.txt`);
    if (typeof showToast === 'function') showToast(`[${orderCode}] 공종별 정밀 견적서 다운로드가 시작되었습니다.`, "success");
}

function issuePartnerStrike(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if (partner.status === 'banned') { showToast('이미 삼진아웃으로 영구 제명된 파트너사입니다.', 'info'); return; }
    partner.strikeCount = (partner.strikeCount || 0) + 1;
    if (partner.strikeCount >= 3) {
        partner.status = 'banned';
        window.AppState.blacklistDb.unshift({ company: partner.name, bizFile: partner.bizFile || '미등록', phone: '010-****-****', reason: '누적 옐로카드 3회 초과로 매니저 센터 직할 영구 제명 처리', date: getLocalDateString() });
        if (typeof pushLog === 'function') pushLog('MANAGER', 'STRIKE_OUT', `[삼진아웃] '${partner.name}' 경고 3회 초과로 영구 제명 및 블랙리스트 등록.`, 'WARNING');
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, '삼진아웃(경고 3회 초과)으로 영구 제명 처리되었습니다.');
        showToast(`[${partner.name}] 파트너사가 삼진아웃(경고 3회)으로 영구 제명되었습니다.`, "warning");
    } else {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'STRIKE', `'${partner.name}' 파트너사에 옐로카드 부여 (누적 ${partner.strikeCount}회).`, 'INFO');
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, `옐로카드가 부여되었습니다. (누적 ${partner.strikeCount}/3회 — 3회 누적 시 영구 제명됩니다)`);
        showToast(`[${partner.name}] 파트너사에 옐로카드가 부여되었습니다. (누적: ${partner.strikeCount}/3회)`, "info");
    }
    renderAdminPartnerMonitor(); renderBlacklistDb();
}

function resetPartnerStrikes(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const wasBanned = partner.status === 'banned';
    partner.strikeCount = 0;
    if (wasBanned) partner.status = 'active';
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, wasBanned ? '제명이 해제되고 경고 기록이 초기화되었습니다.' : '경고 기록이 초기화되었습니다.');
    showToast(`[${partnerName}] 파트너사의 경고가 정상 초기화되었습니다.`, "success");
    renderAdminPartnerMonitor();
}

function togglePartnerCertification(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    partner.isCertified = !partner.isCertified;
    showToast(`[${partnerName}] 파트너사의 안심 인증 상태가 변경되었습니다.`, "info");
    renderAdminPartnerMonitor();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* ----------------------------------------------------------------
 * 매니저 콘솔 > 파트너 가입 심사 (입점 신청 승인/거절)
 * ---------------------------------------------------------------- */
function isImageBizCertDoc(doc) {
    if (!doc || !doc.dataUrl) return false;
    if (doc.dataUrl.startsWith('data:application/pdf')) return false;
    if (doc.dataUrl.startsWith('data:image')) return true;
    return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(doc.name || doc.dataUrl);
}

function renderAdminPartnerApplications() {
    const container = document.getElementById('admin-partner-applications-list');
    if (!container) return;

    const pending = (window.AppState.partners || []).filter(p => p.status === 'pending');
    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">현재 심사 대기 중인 입점 신청이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = pending.map(p => {
        const doc = p.bizCertDoc;
        const isImg = isImageBizCertDoc(doc);
        const docPreview = doc
            ? (isImg
                ? `<img src="${doc.dataUrl}" alt="사업자등록증" class="w-full h-40 object-cover rounded-xl border border-ink-100 cursor-pointer" onclick="viewPartnerBizCertDoc('${p.id}')">`
                : `<button type="button" onclick="viewPartnerBizCertDoc('${p.id}')" class="btn btn-secondary btn-sm btn-block"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> ${escapeHtml(doc.name) || '첨부파일'} 열기</button>`)
            : `<div class="p-3 bg-rose-50 rounded-xl border border-dashed border-roseCustom/40 text-center"><p class="text-[10px] text-roseCustom font-bold">첨부된 사업자등록증이 없습니다.</p></div>`;

        return `
            <div class="surface p-5 space-y-4 text-left flex flex-col justify-between">
                <div class="space-y-3">
                    <div class="flex justify-between items-start gap-2">
                        <div class="space-y-1">
                            <span class="badge badge-amber">심사 대기</span>
                            <h4 class="text-sm font-black text-ink-950">${escapeHtml(p.name)}</h4>
                            <p class="text-[10px] text-ink-400 font-mono">신청일시: ${p.appliedAt || '-'}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-[11px] font-bold text-ink-600 bg-ink-50 p-3 rounded-xl border border-ink-100">
                        <span>아이디: <b class="text-ink-900">${escapeHtml(p.id)}</b></span>
                        <span>연락처: <b class="text-ink-900">${escapeHtml(p.phone) || '-'}</b></span>
                        <span class="col-span-2">사업자등록번호: <b class="text-ink-900 font-mono">${escapeHtml(p.bizFile) || '-'}</b></span>
                    </div>
                    <div class="space-y-1.5">
                        <span class="text-[11px] font-black text-ink-500">사업자등록증</span>
                        ${docPreview}
                    </div>
                </div>
                <div class="pt-3 border-t border-ink-100 space-y-2">
                    <input type="text" id="partner-app-reject-reason-${p.id}" placeholder="거절 사유 (선택 입력)" class="input text-xs">
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="approvePartnerApplication('${p.id}')" class="btn btn-primary btn-sm flex-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> 승인</button>
                        <button type="button" onclick="rejectPartnerApplication('${p.id}')" class="btn btn-secondary btn-sm flex-1"><i data-lucide="x" class="w-3.5 h-3.5"></i> 거절</button>
                    </div>
                </div>
            </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function viewPartnerBizCertDoc(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    const doc = partner ? partner.bizCertDoc : null;
    if (!doc || !doc.dataUrl) { showToast('업로드된 사업자등록증을 찾을 수 없습니다.', 'warning'); return; }
    window.open(doc.dataUrl, '_blank');
}

function approvePartnerApplication(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner) return;
    partner.status = 'active';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_APPROVE', `[입점 승인] '${partner.name}'(${partner.id}) 파트너 계정을 승인했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, '입점 신청이 승인되었습니다! 이제 로그인 후 오더를 받아보실 수 있어요.');
    showToast(`[${partner.name}] 파트너사의 입점을 승인했습니다.`, 'success');
    switchAdminMode('applications');
}

function rejectPartnerApplication(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner) return;
    const reasonInput = document.getElementById(`partner-app-reject-reason-${partnerId}`);
    const reason = reasonInput ? reasonInput.value.trim() : '';
    partner.status = 'rejected';
    partner.rejectReason = reason || '매니저 센터 검토 결과 반려';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_REJECT', `[입점 거절] '${partner.name}'(${partner.id}) 입점 신청을 거절했습니다. 사유: ${partner.rejectReason}`, 'WARNING');
    showToast(`[${partner.name}] 파트너사의 입점 신청을 거절했습니다.`, 'info');
    switchAdminMode('applications');
}

/* ----------------------------------------------------------------
 * 매니저 콘솔 > 직원 권한 관리 (super_admin 전용)
 * 직원은 별도 계정 없이 일반 고객으로 회원가입한 뒤, 여기서 아이디를 검색해
 * 매니저 권한(super_admin/partner_manager)을 부여하거나 회수한다.
 * ---------------------------------------------------------------- */
function renderAdminStaffManager() {
    const resultEl = document.getElementById('admin-staff-search-result');
    if (resultEl) resultEl.innerHTML = '';
    const input = document.getElementById('admin-staff-search-input');
    if (input) input.value = '';
    renderAdminStaffGrantedList();
}

function searchClientForManagerGrant() {
    const input = document.getElementById('admin-staff-search-input');
    const resultEl = document.getElementById('admin-staff-search-result');
    if (!input || !resultEl) return;
    const idVal = input.value.trim();
    if (!idVal) { showToast('검색할 고객 아이디를 입력해 주세요.', 'warning'); return; }

    const account = (window.AppState.clientAccounts || []).find(a => a.id === idVal);
    if (!account) {
        resultEl.innerHTML = `<div class="p-4 bg-rose-50 rounded-xl border border-dashed border-roseCustom/40 text-center"><p class="text-xs text-roseCustom font-bold">'${escapeHtml(idVal)}' 아이디로 가입된 고객 계정을 찾을 수 없습니다.</p></div>`;
        return;
    }

    const roleLabel = account.managerRole === 'super_admin' ? '최고관리자' : account.managerRole === 'partner_manager' ? '파트너 매니저' : '일반 고객';
    resultEl.innerHTML = `
        <div class="surface-flat p-4 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-0.5">
                <p class="text-sm font-black text-ink-950">${escapeHtml(account.name)} <span class="text-ink-400 font-bold text-xs">(${escapeHtml(account.id)})</span></p>
                <p class="text-[11px] text-ink-500 font-bold">연락처 ${account.phone || '-'} · 현재 권한: <b>${roleLabel}</b></p>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" onclick="grantManagerRole('${account.id}', 'partner_manager')" class="btn btn-secondary btn-sm">파트너 매니저 부여</button>
                <button type="button" onclick="grantManagerRole('${account.id}', 'super_admin')" class="btn btn-dark btn-sm">최고관리자 부여</button>
                ${account.managerRole ? `<button type="button" onclick="revokeManagerRole('${account.id}')" class="btn btn-secondary btn-sm">권한 회수</button>` : ''}
            </div>
        </div>`;
}

function grantManagerRole(clientId, role) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === clientId);
    if (!account) return;
    account.managerRole = role;
    const roleLabel = role === 'super_admin' ? '최고관리자' : '파트너 매니저';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'STAFF_GRANT', `'${account.name}'(${account.id}) 계정에 ${roleLabel} 권한을 부여했습니다.`, 'SUCCESS');
    showToast(`[${account.name}]님에게 ${roleLabel} 권한을 부여했습니다.`, 'success');
    searchClientForManagerGrant();
    renderAdminStaffGrantedList();
}

function revokeManagerRole(clientId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === clientId);
    if (!account) return;
    account.managerRole = null;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'STAFF_REVOKE', `'${account.name}'(${account.id}) 계정의 매니저 권한을 회수했습니다.`, 'WARNING');
    showToast(`[${account.name}]님의 매니저 권한을 회수했습니다.`, 'info');
    searchClientForManagerGrant();
    renderAdminStaffGrantedList();
}

function renderAdminStaffGrantedList() {
    const listEl = document.getElementById('admin-staff-granted-list');
    if (!listEl) return;
    const granted = (window.AppState.clientAccounts || []).filter(a => a.managerRole);
    if (granted.length === 0) {
        listEl.innerHTML = buildEmptyStateHtml('users', '매니저 권한이 부여된 계정이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    listEl.innerHTML = granted.map(a => `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl">
            <div class="space-y-0.5">
                <p class="text-xs font-black text-ink-900">${escapeHtml(a.name)} <span class="text-ink-400 font-bold">(${escapeHtml(a.id)})</span></p>
                <span class="badge ${a.managerRole === 'super_admin' ? 'badge-brand' : 'badge-neutral'}">${a.managerRole === 'super_admin' ? '최고관리자' : '파트너 매니저'}</span>
            </div>
            <button type="button" onclick="revokeManagerRole('${a.id}')" class="btn btn-secondary btn-sm">권한 회수</button>
        </div>`).join('');
}

function renderBlacklistDb() {
    const tbody = document.getElementById('admin-blacklist-tbody');
    if (!tbody) return;
    const input = document.getElementById('admin-blacklist-search');
    const query = input ? input.value.trim().toLowerCase() : '';
    const allList = window.AppState.blacklistDb || [];
    const list = query
        ? allList.filter(item => (item.company && item.company.toLowerCase().includes(query)) || (item.bizFile && item.bizFile.toLowerCase().includes(query)))
        : allList;
    if (allList.length === 0) { tbody.innerHTML = `<tr><td class="px-6 py-8 text-center text-ink-400 font-bold" colspan="4">등록된 블랙리스트 대상이 없습니다.</td></tr>`; return; }
    if (list.length === 0) { tbody.innerHTML = `<tr><td class="px-6 py-8 text-center text-ink-400 font-bold" colspan="4">검색 조건에 해당되는 대상이 없습니다.</td></tr>`; return; }
    tbody.innerHTML = list.map(item => `
        <tr>
            <td class="font-mono text-[11px] text-ink-500">${escapeHtml(item.date)}</td>
            <td><span class="badge badge-rose">${escapeHtml(item.company)}</span></td>
            <td class="font-mono text-[11px] text-ink-400">${escapeHtml(item.bizFile || '-')}</td>
            <td class="text-xs font-bold text-ink-700 leading-relaxed">${escapeHtml(item.reason)}</td>
        </tr>`).join('');
}

/* ----------------------------------------------------------------
 * 매니저 콘솔 > 노출 관리 (히어로 업체 광고 슬라이더 / 이벤트 팜플렛)
 * ---------------------------------------------------------------- */
function renderAdminDisplayManager() {
    renderAdminHeroPartnerSelectOptions();
    renderAdminHeroFeaturedList();
    renderAdminPamphletList();
}

function renderAdminHeroPartnerSelectOptions() {
    const sel = document.getElementById('admin-hero-add-partner');
    if (!sel) return;
    const prevVal = sel.value;
    const eligible = (window.AppState.partners || []).filter(p => p.status === 'active' && p.portfolios && p.portfolios.length > 0);
    if (eligible.length === 0) {
        sel.innerHTML = `<option value="">등록된 시공사례가 있는 업체가 없습니다</option>`;
        renderAdminHeroPortfolioOptions();
        return;
    }
    sel.innerHTML = eligible.map(p => `<option value="${p.name}">${p.name} (시공사례 ${p.portfolios.length}건)</option>`).join('');
    if (eligible.some(p => p.name === prevVal)) sel.value = prevVal;
    renderAdminHeroPortfolioOptions();
}

function renderAdminHeroPortfolioOptions() {
    const partnerSel = document.getElementById('admin-hero-add-partner');
    const portSel = document.getElementById('admin-hero-add-portfolio');
    if (!partnerSel || !portSel) return;
    const partner = (window.AppState.partners || []).find(p => p.name === partnerSel.value);
    if (!partner || !partner.portfolios || partner.portfolios.length === 0) {
        portSel.innerHTML = `<option value="">-</option>`;
        return;
    }
    portSel.innerHTML = partner.portfolios.map((port, idx) => `<option value="${idx}">${port.title}</option>`).join('');
}

function addFeaturedHeroPartner() {
    const partnerSel = document.getElementById('admin-hero-add-partner');
    const portSel = document.getElementById('admin-hero-add-portfolio');
    if (!partnerSel || !partnerSel.value) { showToast('추가할 업체를 먼저 선택해 주세요.', 'warning'); return; }
    const featured = window.AppState.featuredPartners || (window.AppState.featuredPartners = []);
    if (featured.length >= 5) { showToast('히어로 업체 슬라이더는 최대 5개까지만 등록할 수 있어요.', 'warning'); return; }
    const partnerName = partnerSel.value;
    const targetPartner = (window.AppState.partners || []).find(p => p.name === partnerName);
    if (!targetPartner || targetPartner.status !== 'active') { showToast('제명되었거나 심사 중인 업체는 히어로 슬라이더에 노출할 수 없어요.', 'warning'); return; }
    const portIdx = Number(portSel.value || 0);
    if (featured.some(f => f.partnerName === partnerName && f.portIdx === portIdx)) {
        showToast('이미 등록된 업체+시공사례 조합이에요.', 'warning');
        return;
    }
    featured.push({ partnerName, portIdx });
    if (typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[히어로 노출] '${partnerName}' 업체를 히어로 업체 광고 슬라이더에 추가.`, 'INFO');
    showToast(`[${partnerName}]를 히어로 슬라이더에 추가했습니다.`, 'success');
    renderAdminHeroFeaturedList();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
}

function removeFeaturedHeroPartner(index) {
    const featured = window.AppState.featuredPartners || [];
    const removed = featured.splice(index, 1)[0];
    if (removed && typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[히어로 노출] '${removed.partnerName}' 업체를 히어로 업체 광고 슬라이더에서 제거.`, 'INFO');
    showToast('히어로 슬라이더에서 제거했습니다.', 'info');
    window.AppState.currentHeroSlideIndex = 0;
    renderAdminHeroFeaturedList();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
}

function moveFeaturedHeroPartner(index, dir) {
    const featured = window.AppState.featuredPartners || [];
    const target = index + dir;
    if (target < 0 || target >= featured.length) return;
    [featured[index], featured[target]] = [featured[target], featured[index]];
    renderAdminHeroFeaturedList();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
}

function renderAdminHeroFeaturedList() {
    const container = document.getElementById('admin-hero-featured-list');
    const countEl = document.getElementById('admin-hero-featured-count');
    if (!container) return;
    const featured = window.AppState.featuredPartners || [];
    if (countEl) countEl.textContent = `${featured.length} / 5`;

    if (featured.length === 0) {
        container.innerHTML = `<p class="text-xs text-ink-400 font-bold py-6 text-center">수동으로 등록된 업체가 없습니다. 현재는 평점 높은 순으로 자동 노출 중입니다.</p>`;
        return;
    }

    container.innerHTML = featured.map((item, idx) => {
        const partner = (window.AppState.partners || []).find(p => p.name === item.partnerName);
        const port = partner && partner.portfolios ? partner.portfolios[item.portIdx] : null;
        const thumb = port ? port.img : '';
        const title = port ? port.title : '(삭제된 시공사례)';
        return `
        <div class="flex items-center gap-3 p-3 surface-flat">
            <span class="text-xs font-mono font-black text-ink-400 w-5 text-center shrink-0">${idx + 1}</span>
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-ink-100 shrink-0">${thumb ? `<img src="${thumb}" class="w-full h-full object-cover">` : ''}</div>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-black text-ink-950 truncate">${item.partnerName}</p>
                <p class="text-[11px] text-ink-500 font-medium truncate">${title}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="moveFeaturedHeroPartner(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-2" aria-label="위로"><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="moveFeaturedHeroPartner(${idx}, 1)" ${idx === featured.length - 1 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-2" aria-label="아래로"><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="removeFeaturedHeroPartner(${idx})" class="btn btn-ghost btn-sm px-2 text-roseCustom" aria-label="제거"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderAdminPamphletList() {
    const container = document.getElementById('admin-pamphlet-list');
    if (!container) return;
    const pamphlets = window.AppState.pamphlets || [];
    if (pamphlets.length === 0) {
        container.innerHTML = buildEmptyStateHtml('image-plus', '등록된 이벤트 팜플렛이 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    container.innerHTML = pamphlets.map((evt, idx) => `
        <div class="flex items-center gap-3 p-3 surface-flat">
            <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-ink-100">${evt.img ? `<img src="${evt.img}" class="w-full h-full object-cover">` : `<i data-lucide="image-plus" class="w-4 h-4 text-ink-300"></i>`}</div>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-black text-ink-950 truncate">${evt.title || '(제목 없음)'}</p>
                <p class="text-[11px] text-ink-500 font-medium truncate">${evt.detail || evt.sub || ''}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="movePamphlet(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-2" aria-label="위로"><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="movePamphlet(${idx}, 1)" ${idx === pamphlets.length - 1 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-2" aria-label="아래로"><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="openPamphletEditor('${evt.id}')" class="btn btn-ghost btn-sm px-2" aria-label="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="deletePamphlet('${evt.id}')" class="btn btn-ghost btn-sm px-2 text-roseCustom" aria-label="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function movePamphlet(index, dir) {
    const pamphlets = window.AppState.pamphlets || [];
    const target = index + dir;
    if (target < 0 || target >= pamphlets.length) return;
    [pamphlets[index], pamphlets[target]] = [pamphlets[target], pamphlets[index]];
    window.AppState.currentHomeEventIndex = 0;
    renderAdminPamphletList();
    if (typeof renderHomeEventSlider === 'function') renderHomeEventSlider();
}

/* 팜플렛 편집기에서 현재 작업 중인 업로드 사진(base64 data URL)과 확대/위치 조정 값을 임시로 들고 있는
 * 드래프트 상태. 저장(savePamphlet) 전까지는 AppState에 반영되지 않으며, 편집기를 열거나 닫을 때 초기화된다. */
/* 광고판(카드) 이미지와 상세페이지(큰 배너) 이미지를 별도로 업로드한다 — 서로 크기/비율이 완전히
 * 달라서(카드는 세로형, 상세페이지는 가로 와이드 배너) 하나의 이미지를 억지로 재사용하면 반드시
 * 한쪽에서 잘려 보이므로, 각 용도에 맞게 미리 제작된 이미지를 그대로 업로드하는 방식을 쓴다. */
let _pamphletDraftImg = '';
let _pamphletDraftDetailImg = '';

function openPamphletEditor(pamphletId) {
    const isEdit = !!pamphletId;
    window.AppState.editingPamphletId = pamphletId || null;

    const evt = isEdit ? (window.AppState.pamphlets || []).find(e => e.id === pamphletId) : null;
    safeUpdateValue('pamphlet-form-title', evt ? evt.title : '');
    safeUpdateValue('pamphlet-form-detail', evt ? (evt.detail || evt.sub || '') : '');

    _pamphletDraftImg = evt ? (evt.img || '') : '';
    _pamphletDraftDetailImg = evt ? (evt.detailImg || '') : '';

    const fileInput = document.getElementById('pamphlet-form-img-file');
    if (fileInput) fileInput.value = '';
    const removeBtn = document.getElementById('pamphlet-form-img-remove-btn');
    if (removeBtn) removeBtn.classList.toggle('hidden', !_pamphletDraftImg);

    const detailFileInput = document.getElementById('pamphlet-form-detailimg-file');
    if (detailFileInput) detailFileInput.value = '';
    const detailRemoveBtn = document.getElementById('pamphlet-form-detailimg-remove-btn');
    if (detailRemoveBtn) detailRemoveBtn.classList.toggle('hidden', !_pamphletDraftDetailImg);

    safeUpdateText('pamphlet-editor-title', isEdit ? '광고 팜플렛 수정' : '새 광고 팜플렛 추가');
    openModal('pamphlet-editor-modal', 'pamphlet-editor-modal-card');
    updatePamphletLivePreview();
    updatePamphletDetailPreview();
}
function closePamphletEditor() {
    closeModal('pamphlet-editor-modal', 'pamphlet-editor-modal-card');
    _pamphletDraftImg = ''; _pamphletDraftDetailImg = '';
}

/* 관리자가 광고판 이미지를 첨부하면 실제 홈 화면 광고판 카드와 동일한 모습을 그대로 미리보기로 보여준다. */
function updatePamphletLivePreview() {
    const preview = document.getElementById('pamphlet-live-preview');
    if (!preview) return;
    const draft = { title: document.getElementById('pamphlet-form-title')?.value || '', img: _pamphletDraftImg || '' };
    preview.innerHTML = buildPamphletCardHtml(draft, 0, 1);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 상세페이지 이미지 미리보기 — 실제 상세페이지의 와이드 배너 영역과 동일한 비율(16:9)로 보여준다. */
function updatePamphletDetailPreview() {
    const preview = document.getElementById('pamphlet-detail-live-preview');
    if (!preview) return;
    preview.innerHTML = _pamphletDraftDetailImg
        ? `<img src="${_pamphletDraftDetailImg}" alt="" class="w-full h-full object-cover">`
        : `<div class="w-full h-full flex flex-col items-center justify-center gap-2 bg-ink-100 text-ink-400"><i data-lucide="image-plus" class="w-6 h-6"></i><p class="text-xs font-bold px-6 text-center">상세페이지 이미지가 없으면 광고판 이미지가 대신 노출됩니다</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handlePamphletImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 업로드할 수 있어요.', 'warning'); event.target.value = ''; return; }
    if (file.size > 15 * 1024 * 1024) { showToast('이미지 용량은 15MB 이하로 올려주세요.', 'warning'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        _pamphletDraftImg = e.target.result;
        const removeBtn = document.getElementById('pamphlet-form-img-remove-btn');
        if (removeBtn) removeBtn.classList.remove('hidden');
        updatePamphletLivePreview();
        showToast('광고판 이미지를 불러왔어요.', 'success');
    };
    reader.onerror = () => showToast('이미지를 불러오지 못했어요. 다시 시도해 주세요.', 'error');
    reader.readAsDataURL(file);
}

function removePamphletDraftImage() {
    _pamphletDraftImg = '';
    const fileInput = document.getElementById('pamphlet-form-img-file');
    if (fileInput) fileInput.value = '';
    const removeBtn = document.getElementById('pamphlet-form-img-remove-btn');
    if (removeBtn) removeBtn.classList.add('hidden');
    updatePamphletLivePreview();
}

function handlePamphletDetailImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 업로드할 수 있어요.', 'warning'); event.target.value = ''; return; }
    if (file.size > 15 * 1024 * 1024) { showToast('이미지 용량은 15MB 이하로 올려주세요.', 'warning'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        _pamphletDraftDetailImg = e.target.result;
        const removeBtn = document.getElementById('pamphlet-form-detailimg-remove-btn');
        if (removeBtn) removeBtn.classList.remove('hidden');
        updatePamphletDetailPreview();
        showToast('상세페이지 이미지를 불러왔어요.', 'success');
    };
    reader.onerror = () => showToast('이미지를 불러오지 못했어요. 다시 시도해 주세요.', 'error');
    reader.readAsDataURL(file);
}

function removePamphletDetailDraftImage() {
    _pamphletDraftDetailImg = '';
    const fileInput = document.getElementById('pamphlet-form-detailimg-file');
    if (fileInput) fileInput.value = '';
    const removeBtn = document.getElementById('pamphlet-form-detailimg-remove-btn');
    if (removeBtn) removeBtn.classList.add('hidden');
    updatePamphletDetailPreview();
}

function savePamphlet() {
    const title = (document.getElementById('pamphlet-form-title')?.value || '').trim();
    const detail = (document.getElementById('pamphlet-form-detail')?.value || '').trim();
    const img = _pamphletDraftImg || '';
    const detailImg = _pamphletDraftDetailImg || '';

    if (!img) { showToast('광고판 이미지를 업로드해 주세요.', 'warning'); return; }
    if (!title) { showToast('제목을 입력해 주세요.', 'warning'); return; }

    const pamphlets = window.AppState.pamphlets || (window.AppState.pamphlets = []);
    const editingId = window.AppState.editingPamphletId;

    if (editingId) {
        const idx = pamphlets.findIndex(e => e.id === editingId);
        if (idx > -1) {
            pamphlets[idx] = { ...pamphlets[idx], title, detail, img, detailImg };
        }
        showToast('팜플렛을 수정했습니다.', 'success');
        if (typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[팜플렛] '${title}' 이벤트 팜플렛 수정.`, 'INFO');
    } else {
        pamphlets.push({ id: `pamphlet-${Date.now()}`, title, detail, img, detailImg });
        showToast('새 팜플렛을 등록했습니다.', 'success');
        if (typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[팜플렛] '${title}' 이벤트 팜플렛 신규 등록.`, 'SUCCESS');
    }

    closePamphletEditor();
    renderAdminPamphletList();
    if (typeof renderHomeEventSlider === 'function') renderHomeEventSlider();
}

function deletePamphlet(pamphletId) {
    const pamphlets = window.AppState.pamphlets || [];
    const idx = pamphlets.findIndex(e => e.id === pamphletId);
    if (idx === -1) return;
    const removed = pamphlets.splice(idx, 1)[0];
    if (removed && typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[팜플렛] '${removed.title}' 이벤트 팜플렛 삭제.`, 'WARNING');
    showToast('팜플렛을 삭제했습니다.', 'info');
    window.AppState.currentHomeEventIndex = 0;
    renderAdminPamphletList();
    if (typeof renderHomeEventSlider === 'function') renderHomeEventSlider();
}

window.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof syncFormStateUI === 'function') syncFormStateUI();
    renderHeroPortfolioSlider();
    renderHomeEventSlider();
    switchPanel('home-panel');
});

window.switchPanel = switchPanel;
window.openB2BAccessModal = openB2BAccessModal;
window.handleB2BNavClick = handleB2BNavClick;
window.updateB2BNavButton = updateB2BNavButton;
window.closeB2BAccessModal = closeB2BAccessModal;
window.accessB2BPanel = accessB2BPanel;
window.renderHeroPortfolioSlider = renderHeroPortfolioSlider;
window.renderHeroTrustStats = renderHeroTrustStats;
window.nextHeroSlide = nextHeroSlide;
window.prevHeroSlide = prevHeroSlide;
window.renderPartnerSearchGrid = renderPartnerSearchGrid;
window.setPartnerSearchRegion = setPartnerSearchRegion;
window.switchAdminMode = switchAdminMode;
window.validateManagerLogin = validateManagerLogin;
window.managerLogout = managerLogout;
window.toggleManagerConsoleVisibility = toggleManagerConsoleVisibility;
window.validatePartnerLogin = validatePartnerLogin;
window.openPartnerReapplyModal = openPartnerReapplyModal;
window.closePartnerReapplyModal = closePartnerReapplyModal;
window.submitPartnerReapplication = submitPartnerReapplication;
window.partnerLogout = partnerLogout;
window.submitPartnerBid = submitPartnerBid;
window.selectOrderForAudit = selectOrderForAudit;
window.togglePartnerConsoleVisibility = togglePartnerConsoleVisibility;
window.renderPartnerNotifications = renderPartnerNotifications;
window.markAllPartnerNotificationsRead = markAllPartnerNotificationsRead;
window.markPartnerNotificationRead = markPartnerNotificationRead;
window.updatePartnerNotificationBadge = updatePartnerNotificationBadge;
window.renderPartnerOrderList = renderPartnerOrderList;
window.renderPartnerContractsView = renderPartnerContractsView;
window.setPartnerContractsStatusFilter = setPartnerContractsStatusFilter;
window.recalculateKPIs = recalculateKPIs;
window.syncAuditLogs = syncAuditLogs;
window.renderAdminPartnerMonitor = renderAdminPartnerMonitor;
window.searchOrderLookup = searchOrderLookup;
window.renderAdminSupportTickets = renderAdminSupportTickets;
window.setAdminSupportStatusFilter = setAdminSupportStatusFilter;
window.setAdminPartnerMonitorStatusFilter = setAdminPartnerMonitorStatusFilter;
window.exportLogsToCsv = exportLogsToCsv;
window.exportPartnerListToCsv = exportPartnerListToCsv;
window.exportClientListToCsv = exportClientListToCsv;
window.replyToSupportTicket = replyToSupportTicket;
window.sendAdminBroadcastNotification = sendAdminBroadcastNotification;
window.renderAdminClientManager = renderAdminClientManager;
window.jumpToClientOrderLookup = jumpToClientOrderLookup;
window.toggleClientSuspension = toggleClientSuspension;
window.renderAdminContractCancellations = renderAdminContractCancellations;
window.openPartnerCancelRequestModal = openPartnerCancelRequestModal;
window.closePartnerCancelRequestModal = closePartnerCancelRequestModal;
window.submitPartnerCancelRequest = submitPartnerCancelRequest;
window.approveContractCancellation = approveContractCancellation;
window.rejectContractCancellation = rejectContractCancellation;
window.openPartnerMetricsModal = openPartnerMetricsModal;
window.renderPartnerPerformanceView = renderPartnerPerformanceView;
window.closePartnerMetricsModal = closePartnerMetricsModal;
window.adminDeleteReview = adminDeleteReview;
window.downloadContractDoc = downloadContractDoc;
window.downloadEstimateDoc = downloadEstimateDoc;
window.issuePartnerStrike = issuePartnerStrike;
window.resetPartnerStrikes = resetPartnerStrikes;
window.togglePartnerCertification = togglePartnerCertification;
window.renderBlacklistDb = renderBlacklistDb;
window.autoAllocateOrder = autoAllocateOrder;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.syncSelectAllOrdersCheckbox = syncSelectAllOrdersCheckbox;
window.bulkAutoAllocateSelectedOrders = bulkAutoAllocateSelectedOrders;
window.allocateOrderToPartner = allocateOrderToPartner;
window.renderHomeEventSlider = renderHomeEventSlider;
window.openPamphletDetail = openPamphletDetail;
window.closePamphletDetail = closePamphletDetail;
window.nextHomeEvent = nextHomeEvent;
window.prevHomeEvent = prevHomeEvent;
window.renderAdminDisplayManager = renderAdminDisplayManager;
window.renderAdminHeroPartnerSelectOptions = renderAdminHeroPartnerSelectOptions;
window.renderAdminHeroPortfolioOptions = renderAdminHeroPortfolioOptions;
window.addFeaturedHeroPartner = addFeaturedHeroPartner;
window.removeFeaturedHeroPartner = removeFeaturedHeroPartner;
window.moveFeaturedHeroPartner = moveFeaturedHeroPartner;
window.renderAdminHeroFeaturedList = renderAdminHeroFeaturedList;
window.renderAdminPamphletList = renderAdminPamphletList;
window.movePamphlet = movePamphlet;
window.openPamphletEditor = openPamphletEditor;
window.closePamphletEditor = closePamphletEditor;
window.savePamphlet = savePamphlet;
window.deletePamphlet = deletePamphlet;
window.updatePamphletLivePreview = updatePamphletLivePreview;
window.updatePamphletDetailPreview = updatePamphletDetailPreview;
window.handlePamphletImageUpload = handlePamphletImageUpload;
window.removePamphletDraftImage = removePamphletDraftImage;
window.handlePamphletDetailImageUpload = handlePamphletDetailImageUpload;
window.removePamphletDetailDraftImage = removePamphletDetailDraftImage;
window.openPartnerOrderDetailModal = openPartnerOrderDetailModal;
window.withdrawMyPartnerBid = withdrawMyPartnerBid;
window.closePartnerOrderDetailModal = closePartnerOrderDetailModal;
window.triggerPartnerDocUpload = triggerPartnerDocUpload;
window.handlePartnerDocUpload = handlePartnerDocUpload;
window.openUploadedPartnerDoc = openUploadedPartnerDoc;
window.payPartnerCommission = payPartnerCommission;
window.switchPartnerAuthTab = switchPartnerAuthTab;
window.triggerPartnerBizCertUpload = triggerPartnerBizCertUpload;
window.handlePartnerBizCertUpload = handlePartnerBizCertUpload;
window.submitPartnerSignup = submitPartnerSignup;
window.renderAdminPartnerApplications = renderAdminPartnerApplications;
window.viewPartnerBizCertDoc = viewPartnerBizCertDoc;
window.approvePartnerApplication = approvePartnerApplication;
window.rejectPartnerApplication = rejectPartnerApplication;
window.pauseHeroAutoplay = pauseHeroAutoplay;
window.resumeHeroAutoplay = resumeHeroAutoplay;
window.pauseHomeEventAutoplay = pauseHomeEventAutoplay;
window.resumeHomeEventAutoplay = resumeHomeEventAutoplay;
window.renderAdminStaffManager = renderAdminStaffManager;
window.searchClientForManagerGrant = searchClientForManagerGrant;
window.grantManagerRole = grantManagerRole;
window.revokeManagerRole = revokeManagerRole;
window.savePartnerFinalContractAmount = savePartnerFinalContractAmount;
