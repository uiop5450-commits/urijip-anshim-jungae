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
    if (typeof renderClientNavUnreadBadge === 'function') renderClientNavUnreadBadge();
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
    if (panelId === 'client-panel' && typeof restoreQuoteDraftFromStorage === 'function') restoreQuoteDraftFromStorage();
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

/* 종료일이 지난 팜플렛은 관리자 목록에는 계속 보여야 하지만(이력 확인용),
 * 홈 화면 슬라이더에는 더 이상 노출되면 안 된다 — 홈 슬라이더/좌우 이동
 * 세 곳(renderHomeEventSlider, nextHomeEvent, prevHomeEvent)이 전부 이 목록
 * 하나만 기준으로 인덱싱해야 currentHomeEventIndex가 어긋나지 않는다. */
function getVisiblePamphlets() {
    return (window.AppState.pamphlets || []).filter(evt => !isPamphletExpired(evt));
}

function renderHomeEventSlider(direction) {
    const container = document.getElementById('home-event-slider-container');
    if (!container) return;
    const pamphlets = getVisiblePamphlets();
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
function nextHomeEvent(e) { if (e) e.stopPropagation(); const total = getVisiblePamphlets().length || 1; const current = window.AppState.currentHomeEventIndex || 0; window.AppState.currentHomeEventIndex = (current + 1) % total; renderHomeEventSlider('next'); }
function prevHomeEvent(e) { if (e) e.stopPropagation(); const total = getVisiblePamphlets().length || 1; const current = window.AppState.currentHomeEventIndex || 0; window.AppState.currentHomeEventIndex = (current - 1 + total) % total; renderHomeEventSlider('prev'); }

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

/* 지역 필터는 있었지만 "아파트 전문", "상가·사무실 전문"처럼 시공 유형으로
 * 파트너를 골라볼 방법이 없었다 — 파트너마다 별도 전문분야 필드를 추가하는 대신,
 * 이미 등록된 시공사례(portfolio)의 category 분포를 그대로 재사용해 필터링한다. */
let partnerSearchCategoryFilter = 'all';
function setPartnerSearchCategory(category) {
    partnerSearchCategoryFilter = category;
    renderPartnerSearchGrid();
}

function renderPartnerSearchGrid() {
    const container = document.getElementById('partner-search-grid');
    if (!container) return;
    const input = document.getElementById('partner-search-input');
    const query = input ? input.value.trim().toLowerCase() : '';
    const sortSelect = document.getElementById('partner-search-sort');
    const sortMode = sortSelect ? sortSelect.value : 'rating';

    // 입점 심사 대기(pending)·제명(banned)·자진 해지(closed) 파트너는 고객 대상 공개 탐색 페이지에 노출하지 않는다.
    const allPartners = (window.AppState.partners || []).filter(p => p.status !== 'pending' && p.status !== 'banned' && p.status !== 'info_requested' && p.status !== 'closed');

    // 지역 필터 칩 — 실제 등록된 파트너들의 지역만 모아 중복 없이 노출한다.
    const regionChipsEl = document.getElementById('partner-search-region-chips');
    if (regionChipsEl) {
        const regions = [...new Set(allPartners.map(p => p.region).filter(Boolean))].sort();
        const chips = [['all', '전체 지역'], ...regions.map(r => [r, r])];
        regionChipsEl.innerHTML = chips.map(([key, label]) =>
            `<button type="button" onclick="setPartnerSearchRegion('${key}')" class="region-chip ${partnerSearchRegionFilter === key ? 'active' : ''}"><i data-lucide="map-pin" class="w-3 h-3"></i>${label}</button>`
        ).join('');
    }

    // 전문분야 필터 칩 — 파트너별 발행된 시공사례의 category를 모아, 최소 1건이라도 있는 파트너만 해당 칩으로 노출된다.
    const categoryChipsEl = document.getElementById('partner-search-category-chips');
    const partnerCategorySets = new Map(allPartners.map(p => [p.name, new Set((p.portfolios || []).filter(port => !port.isDraft && port.category).map(port => port.category))]));
    if (categoryChipsEl) {
        const categoriesPresent = [...new Set([...partnerCategorySets.values()].flatMap(s => [...s]))];
        if (categoriesPresent.length > 1) {
            const chips = [['all', '전체 분야'], ...categoriesPresent.map(c => [c, PORTFOLIO_CATEGORY_LABELS[c] || c])];
            categoryChipsEl.innerHTML = chips.map(([key, label]) =>
                `<button type="button" onclick="setPartnerSearchCategory('${key}')" class="region-chip ${partnerSearchCategoryFilter === key ? 'active' : ''}"><i data-lucide="hammer" class="w-3 h-3"></i>${label}</button>`
            ).join('');
        } else {
            categoryChipsEl.innerHTML = '';
        }
    }

    const filtered = allPartners
        .filter(p => partnerSearchRegionFilter === 'all' || p.region === partnerSearchRegionFilter)
        .filter(p => partnerSearchCategoryFilter === 'all' || partnerCategorySets.get(p.name)?.has(partnerSearchCategoryFilter))
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
        const publishedPortfolios = (p.portfolios || []).filter(port => !port.isDraft);
        const samplePort = publishedPortfolios.length > 0 ? publishedPortfolios[0] : null;
        const repImg = (p.heroImages && p.heroImages.length > 0) ? p.heroImages[0] : (samplePort ? samplePort.img : 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=60');
        const safePName = escapeHtml(p.name);
        const slogan = p.promoSlogan ? escapeHtml(p.promoSlogan) : `${safePName} - 부산 지역 대표 인테리어`;
        const promo = p.promoText ? escapeHtml(p.promoText) : (p.desc ? escapeHtml(p.desc) : '검증된 1군 실내건축 종합면허 보유사입니다.');
        const certifiedBadge = p.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 인증</span>` : '';
        const portfolioCount = publishedPortfolios.length;
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
                        <h4 class="text-sm font-black text-ink-950 truncate flex items-center gap-1.5"><span>${safePName}</span>${certifiedBadge}${buildPartnerTierBadgeHtml(p.name)}</h4>
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
    ['dashboard', 'layout-dashboard', '통합 대시보드'],
    ['appeals', 'scale', '전체 이의신청'],
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
    super_admin: ['dashboard', 'appeals', 'allocation', 'monitor', 'applications', 'blacklist', 'logs', 'display', 'staff', 'community', 'support', 'broadcast', 'clients', 'cancellations'],
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
        const pendingCount = (window.AppState.partners || []).filter(p => p.status === 'pending' || p.status === 'info_requested').length;
        const openTicketCount = (window.AppState.supportTickets || []).filter(t => t.status === 'open').length;
        const cancelRequestCount = (window.AppState.orders || []).filter(o => o.status === 'cancel_requested').length;
        const pendingAppealCount = typeof getAllPendingAppeals === 'function' ? getAllPendingAppeals().length : 0;
        const tabs = ALL_ADMIN_TABS.filter(([id]) => allowedTabs.includes(id)).map(([id, icon, label]) => {
            let finalLabel = label;
            if (id === 'applications' && pendingCount > 0) finalLabel = `${label} (${pendingCount})`;
            else if (id === 'support' && openTicketCount > 0) finalLabel = `${label} (${openTicketCount})`;
            else if (id === 'cancellations' && cancelRequestCount > 0) finalLabel = `${label} (${cancelRequestCount})`;
            else if (id === 'appeals' && pendingAppealCount > 0) finalLabel = `${label} (${pendingAppealCount})`;
            return [id, icon, finalLabel];
        });
        tabBar.innerHTML = tabs.map(([id, icon, label]) => `<button type="button" id="btn-admin-view-${id}" onclick="switchAdminMode('${id}')" class="gnb-tab ${mode === id ? 'active' : ''}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${label}</button>`).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    ['dashboard', 'appeals', 'allocation', 'monitor', 'applications', 'blacklist', 'logs', 'display', 'staff', 'community', 'support', 'broadcast', 'clients', 'cancellations'].forEach(m => document.getElementById(`admin-mode-${m}-view`)?.classList.add('hidden'));
    document.getElementById(`admin-mode-${mode}-view`)?.classList.remove('hidden');

    const kpiGrid = document.getElementById('admin-kpi-grid');
    if (kpiGrid) kpiGrid.classList.toggle('hidden', window.AppState.managerRole === 'partner_manager');

    if (mode === 'dashboard') renderAdminDashboard();
    else if (mode === 'appeals') renderAdminAppealInbox();
    else if (mode === 'allocation') renderAdminOrderAllocation();
    else if (mode === 'monitor') renderAdminPartnerMonitor();
    else if (mode === 'applications') renderAdminPartnerApplications();
    else if (mode === 'blacklist') renderBlacklistDb();
    else if (mode === 'logs') syncAuditLogs();
    else if (mode === 'display') renderAdminDisplayManager();
    else if (mode === 'staff') renderAdminStaffManager();
    else if (mode === 'community' && typeof renderAdminCommunityModeration === 'function') renderAdminCommunityModeration();
    else if (mode === 'support' && typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
    else if (mode === 'clients') renderAdminClientManager();
    else if (mode === 'cancellations') { renderAdminContractCancellations(); renderAdminRefundPendingList(); renderAdminStrikeAppeals(); }
    else if (mode === 'broadcast' && typeof updateAdminBroadcastSegmentUI === 'function') updateAdminBroadcastSegmentUI();

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

    if (typeof sweepExpiredManagerRoles === 'function') sweepExpiredManagerRoles();
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
                        ${window.AppState.partnerLoggedInStaffLabel ? `<span class="badge badge-neutral"><i data-lucide="user" class="w-2.5 h-2.5"></i> 담당자: ${escapeHtml(window.AppState.partnerLoggedInStaffLabel)}</span>` : ''}
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
                    <button type="button" id="btn-partner-view-schedule" onclick="switchPartnerMode('schedule')" class="gnb-tab">방문 일정</button>
                    <button type="button" id="btn-partner-view-performance" onclick="switchPartnerMode('performance')" class="gnb-tab">내 실적</button>
                    <button type="button" id="btn-partner-view-portfolio" onclick="switchPartnerMode('portfolio')" class="gnb-tab">포트폴리오 관리</button>
                    <button type="button" id="btn-partner-view-myinfo" onclick="switchPartnerMode('myinfo')" class="gnb-tab">내정보 관리</button>
                    <button type="button" id="btn-partner-view-support" onclick="switchPartnerMode('support')" class="gnb-tab">고객센터</button>
                    <button type="button" id="btn-partner-view-notifications" onclick="switchPartnerMode('notifications')" class="gnb-tab">알림<span id="partner-notif-badge-count"></span></button>
                    <button type="button" onclick="partnerLogout()" class="btn btn-ghost btn-sm"><i data-lucide="log-out" class="w-3.5 h-3.5"></i> 퇴근</button>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                if (typeof updatePartnerNotificationBadge === 'function') updatePartnerNotificationBadge();
            }
            renderPartnerOnboardingBanner();
        }
    } else { consoleBox.classList.add('hidden'); gatewayBox.classList.remove('hidden'); }
}

/* 승인되면 바로 빈 콘솔에 던져질 뿐, 사업자등록증/활동지역/시공사례 중 뭘 먼저
 * 채워야 안심 매칭이 원활해지는지 안내가 전혀 없었다 — 체크리스트를 통해 남은
 * 항목을 알려주고, 전부 채우거나 직접 닫으면 다시 뜨지 않는다. */
function renderPartnerOnboardingBanner() {
    const banner = document.getElementById('partner-onboarding-banner');
    if (!banner) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) { banner.classList.add('hidden'); return; }

    const items = [
        { label: '사업자등록증 첨부', done: !!partner.bizCertDoc },
        { label: '활동 지역 설정', done: !!partner.region },
        { label: '시공사례 1건 이상 등록', done: (partner.portfolios || []).length > 0 }
    ];
    const allDone = items.every(i => i.done);

    // onboardingDismissed가 명시적으로 false일 때만(=approvePartnerApplication을 거쳐
    // 새로 승인된 파트너만) 노출한다 — undefined인 기존 파트너들에게 뒤늦게
    // 소급 적용되어 계속 떠 있는 것을 방지한다.
    if (partner.onboardingDismissed !== false || allDone) { banner.classList.add('hidden'); return; }

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="surface surface-lg p-5 space-y-3 text-left" style="background:var(--brand-50);border-color:var(--brand-100,#dbe8ff)">
            <div class="flex justify-between items-start gap-3">
                <div class="space-y-0.5">
                    <span class="badge badge-brand">시작 가이드</span>
                    <h4 class="text-sm font-black text-ink-950 mt-1">아래 항목을 채우면 안심 매칭 확률이 높아져요!</h4>
                </div>
                <button type="button" onclick="dismissPartnerOnboardingBanner()" class="btn btn-ghost btn-sm px-1.5" aria-label="닫기"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="flex flex-wrap gap-2">
                ${items.map(i => `<span class="badge ${i.done ? 'badge-emerald' : 'badge-neutral'}"><i data-lucide="${i.done ? 'check-circle-2' : 'circle'}" class="w-3 h-3"></i> ${i.label}</span>`).join('')}
            </div>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function dismissPartnerOnboardingBanner() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    partner.onboardingDismissed = true;
    renderPartnerOnboardingBanner();
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
        <div class="notif-tl-item">
            <div class="notif-tl-marker">
                <span class="notif-tl-dot ${n.read ? 'read' : ''}"><i data-lucide="bell" class="w-3 h-3"></i></span>
                ${isLast ? '' : '<span class="notif-tl-line"></span>'}
            </div>
            <div class="notif-tl-body ${isLast ? '' : 'has-line'}">
                <div class="flex justify-between items-start gap-2">
                    <p class="text-xs font-bold text-ink-800 leading-relaxed ${n.read ? '' : 'cursor-pointer'}" ${n.read ? '' : `onclick="markPartnerNotificationRead('${n.id}')"`}>${escapeHtml(n.message)}</p>
                    <button type="button" onclick="deletePartnerNotification('${n.id}')" class="text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0" aria-label="알림 삭제"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                </div>
                <p class="text-[10px] text-ink-400 font-bold mt-0.5">${dateLabel}${n.read ? '' : ' · <span class="text-brand-600">탭하여 읽음 처리</span>'}</p>
                ${n.dmThreadId ? `<div class="flex gap-1.5 mt-1.5"><input type="text" id="partner-dm-reply-input-${n.id}" placeholder="매니저에게 답장하기" class="input flex-1 text-xs"><button type="button" onclick="replyToManagerDmAsPartner('${n.id}')" class="btn btn-dark btn-sm shrink-0">답장</button></div>` : ''}
            </div>
        </div>`;
    }).join('') + `</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 고객 쪽에 관리자 쪽지 답장(replyToManagerDirectMessage, client_panel.js)이
 * 생겼으니 파트너 쪽에도 대칭으로 필요하다. 두 파일 모두 전역 window에 노출되므로
 * client_panel.js가 나중에 로드되어 동일 이름을 덮어쓰지 않도록 별도 이름을 쓴다. */
function replyToManagerDmAsPartner(notifId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const notif = (window.AppState.partnerNotifications || []).find(n => n.id === notifId);
    if (!notif || !notif.dmThreadId) return;
    const input = document.getElementById(`partner-dm-reply-input-${notifId}`);
    const text = input?.value.trim();
    if (!text) { showToast('답장 내용을 입력해주세요.', 'warning'); return; }

    const thread = (window.AppState.directMessageThreads || []).find(t => t.id === notif.dmThreadId);
    if (!thread) return;
    thread.messages.push({ from: 'recipient', text, date: getLocalDateString() });
    thread.hasUnreadReply = true;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'DM_REPLY', `[${partnerName}]가 매니저 쪽지에 답장했습니다: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`, 'INFO');
    showToast('답장을 보냈습니다.', 'success');
    renderPartnerNotifications();
}

function markAllPartnerNotificationsRead() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    (window.AppState.partnerNotifications || []).forEach(n => { if (n.partnerName === partnerName) n.read = true; });
    renderPartnerNotifications();
    updatePartnerNotificationBadge();
}

/* 고객측(deleteClientNotification/clearAllClientNotifications)과 동일하게, 읽음
 * 처리만 가능하고 삭제는 불가능해서 알림이 계속 쌓이기만 했던 공백을 해소한다. */
function deletePartnerNotification(notifId) {
    const idx = (window.AppState.partnerNotifications || []).findIndex(n => n.id === notifId);
    if (idx === -1) return;
    window.AppState.partnerNotifications.splice(idx, 1);
    renderPartnerNotifications();
    updatePartnerNotificationBadge();
}

function clearAllPartnerNotifications() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    window.AppState.partnerNotifications = (window.AppState.partnerNotifications || []).filter(n => n.partnerName !== partnerName);
    showToast('알림을 모두 삭제했습니다.', 'info');
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

/* 고객은 커뮤니티에서 악성 유저를 차단할 수 있고 관리자는 고객 계정을 정지할 수
 * 있는데, 계약 상대인 파트너가 노쇼·상습 갑질 등 불량 고객을 신고할 방법이 전혀
 * 없었다 — 후기 신고(reportReview)와 동일한 1인 1회 신고 패턴을 적용하되, 신고
 * 대상이 후기가 아니라 계약 건(주문)이라 window.AppState.clientReports에 별도로
 * 쌓고 관리자 "고객 관리" 탭에서 확인한다. */
let reportClientTargetCode = null;

function isOrderReportedByMe(orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    return (window.AppState.clientReports || []).some(r => r.orderCode === orderCode && r.reportedByPartner === partnerName);
}

function openReportClientModal(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    if (isOrderReportedByMe(orderCode)) { showToast('이미 신고를 접수한 고객입니다.', 'info'); return; }
    reportClientTargetCode = orderCode;
    safeUpdateValue('report-client-reason', '');
    openModal('report-client-modal', 'report-client-modal-card');
}

function closeReportClientModal() {
    reportClientTargetCode = null;
    closeModal('report-client-modal', 'report-client-modal-card');
}

function submitClientReport() {
    const order = (window.AppState.orders || []).find(o => o.code === reportClientTargetCode);
    if (!order) { closeReportClientModal(); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (isOrderReportedByMe(order.code)) { showToast('이미 신고를 접수한 고객입니다.', 'info'); closeReportClientModal(); return; }

    const reason = document.getElementById('report-client-reason')?.value.trim();
    if (!reason) { showToast('신고 사유를 입력해 주세요.', 'warning'); return; }

    if (!window.AppState.clientReports) window.AppState.clientReports = [];
    window.AppState.clientReports.unshift({
        id: `crpt-${Date.now()}`, orderCode: order.code, clientName: order.clientName, clientPhone: order.clientPhone,
        reportedByPartner: partnerName, reason, date: getLocalDateString()
    });

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CLIENT_REPORT', `[${partnerName}]가 오더 ${order.code}의 고객(${order.clientName})을 신고했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약 파트너사로부터 신고가 접수되어 매니저 센터가 검토 중입니다. 부당하다고 생각되시면 마이페이지 계정 정보에서 소명하실 수 있어요.`);
    showToast('신고가 접수되었습니다. 매니저 센터에서 검토할게요.', 'success');
    closeReportClientModal();
    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
    if (typeof openPartnerOrderDetailModal === 'function') openPartnerOrderDetailModal(order.code);
}

/* 고객 쪽엔 파트너 신고 철회(retractPartnerReport, client_panel.js)가 생겼으니,
 * 대칭으로 파트너도 자신이 접수한 고객 신고를 관리자 검토 전까지 철회할 수 있어야
 * 한다. */
function retractClientReport(orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const report = (window.AppState.clientReports || []).find(r => r.orderCode === orderCode && r.reportedByPartner === partnerName);
    if (!report) return;

    window.AppState.clientReports = window.AppState.clientReports.filter(r => r.id !== report.id);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CLIENT_REPORT_RETRACT', `[${partnerName}]가 오더 ${orderCode}의 고객 신고를 철회했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function' && report.clientPhone) pushClientNotification(report.clientPhone, `계약 파트너사가 신고를 철회했어요.`);
    showToast('신고를 철회했습니다.', 'info');

    if (typeof renderAdminClientManager === 'function') renderAdminClientManager();
    if (typeof openPartnerOrderDetailModal === 'function') openPartnerOrderDetailModal(orderCode);
}

/* 파트너 콘솔 > 고객센터 — 지금까지 1:1 문의 티켓 시스템은 고객 전용이었고 파트너는
 * 정산/매칭/계정 관련 문의를 접수할 방법이 전혀 없었다. 기존 supportTickets 배열과
 * renderAdminSupportTickets(관리자 답변 화면)을 그대로 재사용하되, role 필드로
 * 고객 문의(role 없음 = 하위 호환)와 파트너 문의를 구분한다. */
function submitPartnerSupportInquiry() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const subject = document.getElementById('partner-support-subject')?.value.trim();
    const message = document.getElementById('partner-support-message')?.value.trim();
    if (!subject || !message) { showToast('제목과 문의 내용을 모두 입력해 주세요.', 'warning'); return; }

    const ticket = {
        id: `tk-${Date.now()}`, role: 'partner', partnerName,
        subject, message, date: getLocalDateString(), status: 'open', adminReply: null, adminReplyDate: null,
        followUps: []
    };
    if (!window.AppState.supportTickets) window.AppState.supportTickets = [];
    window.AppState.supportTickets.unshift(ticket);
    if (typeof pushLog === 'function') pushLog('PARTNER', 'SUPPORT_INQUIRY', `[${partnerName}]가 매니저 센터에 1:1 문의를 등록했습니다. (${subject})`, 'INFO');
    showToast('문의가 등록되었습니다. 빠르게 답변드릴게요!', 'success');
    safeUpdateValue('partner-support-subject', '');
    safeUpdateValue('partner-support-message', '');
    renderMyPartnerSupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

function renderMyPartnerSupportTickets() {
    const container = document.getElementById('partner-support-my-tickets');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const myTickets = (window.AppState.supportTickets || []).filter(t => t.role === 'partner' && t.partnerName === partnerName);

    if (myTickets.length === 0) {
        container.innerHTML = `<p class="text-xs text-ink-400 font-bold text-center py-4">아직 등록한 문의가 없습니다.</p>`;
        return;
    }
    container.innerHTML = myTickets.map(t => {
        const followUps = t.followUps || [];
        const followUpsHtml = followUps.map(f => `
            <div class="mt-1.5 pl-2.5 border-l-2 border-ink-200 space-y-1">
                <p class="text-[11px] text-ink-700 font-semibold leading-relaxed">${escapeHtml(f.clientMessage)} <span class="text-[9px] text-ink-400 font-bold">(${f.clientDate})</span></p>
                ${f.adminReply ? `<div class="p-2.5 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">매니저 센터 답변</p><p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(f.adminReply)}</p></div>` : `<p class="text-[10px] text-amberCustom font-bold">답변 대기중</p>`}
            </div>`).join('');
        const hasPendingFollowUp = followUps.length > 0 && !followUps[followUps.length - 1].adminReply;
        const canFollowUp = t.status === 'answered' && !hasPendingFollowUp;

        return `
        <div class="p-3.5 bg-ink-50 rounded-xl space-y-1.5 text-left">
            <div class="flex justify-between items-center">
                <h6 class="text-xs font-black text-ink-950">${escapeHtml(t.subject)}</h6>
                <div class="flex items-center gap-2">
                    <span class="badge ${t.status === 'answered' ? 'badge-emerald' : 'badge-amber'}">${t.status === 'answered' ? '답변 완료' : '답변 대기'}</span>
                    ${(t.status === 'open' && followUps.length === 0) ? `<button type="button" onclick="cancelPartnerSupportTicket('${t.id}')" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">취소</button>` : ''}
                </div>
            </div>
            <p class="text-[11px] text-ink-600 font-medium leading-relaxed">${escapeHtml(t.message)}</p>
            <p class="text-[10px] text-ink-400 font-bold">${t.date}</p>
            ${t.adminReply ? `<div class="mt-1.5 p-2.5 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">매니저 센터 답변</p><p class="text-[11px] text-ink-700 font-medium leading-relaxed">${escapeHtml(t.adminReply)}</p></div>` : ''}
            ${followUpsHtml}
            ${canFollowUp ? `
                <div class="flex gap-1.5 pt-1.5">
                    <input type="text" id="partner-ticket-followup-input-${t.id}" placeholder="추가로 궁금한 점을 남겨주세요" class="input flex-1 text-xs">
                    <button type="button" onclick="submitPartnerSupportFollowUp('${t.id}')" class="btn btn-dark btn-sm shrink-0">추가 문의</button>
                </div>` : ''}
        </div>`;
    }).join('');
}

function submitPartnerSupportFollowUp(ticketId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const ticket = (window.AppState.supportTickets || []).find(t => t.id === ticketId);
    if (!ticket || ticket.partnerName !== partnerName || ticket.status !== 'answered') return;

    const input = document.getElementById(`partner-ticket-followup-input-${ticketId}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('추가 문의 내용을 입력해 주세요.', 'warning'); return; }

    if (!ticket.followUps) ticket.followUps = [];
    ticket.followUps.push({ clientMessage: text, clientDate: getLocalDateString(), adminReply: null, adminReplyDate: null });
    ticket.status = 'open';

    if (typeof pushLog === 'function') pushLog('PARTNER', 'SUPPORT_FOLLOWUP', `[${partnerName}]가 문의(${ticket.subject})에 추가 질문을 남겼습니다.`, 'INFO');
    showToast('추가 문의가 등록되었습니다.', 'success');
    renderMyPartnerSupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

function cancelPartnerSupportTicket(ticketId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const idx = (window.AppState.supportTickets || []).findIndex(t => t.id === ticketId);
    if (idx === -1) return;
    const ticket = window.AppState.supportTickets[idx];
    if (ticket.partnerName !== partnerName) return;
    if (ticket.status !== 'open' || (ticket.followUps && ticket.followUps.length > 0)) { showToast('이미 답변이 등록된 문의는 취소할 수 없어요.', 'warning'); return; }
    window.AppState.supportTickets.splice(idx, 1);
    showToast('문의가 취소되었습니다.', 'info');
    renderMyPartnerSupportTickets();
    if (typeof renderAdminSupportTickets === 'function') renderAdminSupportTickets();
}

/* 로그인 폼 인라인 에러 — 이전엔 메시지 문구에 ⚠️/❌/⏳ 이모지를 박아 넣었는데,
 * 앱 전체가 lucide 아이콘 체계로 정리된 뒤 이 자리만 남아있던 것을 통일한다. */
let reapplyTargetPartnerId = null;

function openPartnerReapplyModal() {
    const partner = (window.AppState.partners || []).find(p => p.id === reapplyTargetPartnerId);
    if (!partner || (partner.status !== 'rejected' && partner.status !== 'info_requested')) { showToast('재신청 대상 계정을 찾을 수 없습니다.', 'warning'); return; }
    const isInfoRequested = partner.status === 'info_requested';
    safeUpdateText('partner-reapply-modal-title', isInfoRequested ? '요청 내용을 확인하고 재신청하세요' : '반려 사유를 확인하고 재신청하세요');
    safeUpdateText('partner-reapply-reason-label', isInfoRequested ? '매니저 센터 요청 내용' : '반려 사유');
    safeUpdateText('partner-reapply-reason-text', isInfoRequested ? (partner.infoRequestNote || '매니저 센터 추가 정보 요청') : (partner.rejectReason || '매니저 센터 검토 결과 반려'));
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
    if (!partner || (partner.status !== 'rejected' && partner.status !== 'info_requested')) { closePartnerReapplyModal(); return; }

    const finalize = () => {
        const wasInfoRequested = partner.status === 'info_requested';
        partner.status = 'pending';
        partner.appliedAt = new Date().toLocaleString('ko-KR');
        const memo = document.getElementById('partner-reapply-memo')?.value.trim();
        const prevReason = wasInfoRequested ? partner.infoRequestNote : partner.rejectReason;
        partner.rejectReason = null;
        partner.infoRequestNote = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'REAPPLY', `[${partner.name}](${partner.id})가 입점 ${wasInfoRequested ? '정보 보완 후 재신청' : '재신청'}했습니다. (이전 ${wasInfoRequested ? '요청 내용' : '반려 사유'}: ${prevReason || '-'}${memo ? ' | 보완 메모: ' + memo : ''})`, 'INFO');
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

    if (typeof sweepExpiredPartnerCertifications === 'function') sweepExpiredPartnerCertifications();
    document.getElementById('partner-reapply-btn')?.classList.add('hidden');
    const idVal = idInput.value.trim();
    const pwVal = pwInput.value.trim();
    const partner = window.AppState.partners.find(p => p.id === idVal && p.pw === pwVal);
    // 부계정(staffAccounts) 로그인 시 어느 담당자로 들어왔는지 감사 로그에 남기기
    // 위해 매칭된 담당자 라벨을 기억해둔다 — 마스터 계정 로그인이면 null.
    let matchedStaffLabel = null;
    const staffMatchedPartner = !partner ? window.AppState.partners.find(p => (p.staffAccounts || []).some(s => s.id === idVal && s.pw === pwVal)) : null;
    const effectivePartner = partner || staffMatchedPartner;
    if (staffMatchedPartner) matchedStaffLabel = staffMatchedPartner.staffAccounts.find(s => s.id === idVal && s.pw === pwVal).label;

    if (effectivePartner) {
        if (effectivePartner.status === 'banned') {
            showToast("귀사는 삼진아웃 누적 초과(3회 이상 적발)로 인해 영구 제명 처리되었습니다.", "warning");
            showInlineLoginError(errorMsg, "삼진아웃제 규정에 따라 영구 제명 처리된 불량 사업자망 계정입니다.", 'ban');
            return;
        }
        if (effectivePartner.status === 'closed') {
            showToast("입점 해지 처리된 계정입니다.", "warning");
            showInlineLoginError(errorMsg, "자진 해지된 입점 계정입니다. 재입점을 원하시면 매니저 센터에 문의해 주세요.", 'store');
            return;
        }
        if (effectivePartner.status === 'pending') {
            showToast("아직 매니저 센터의 입점 심사가 진행 중인 계정입니다. 사업자등록증 확인 후 승인되면 로그인하실 수 있어요.", "info");
            showInlineLoginError(errorMsg, "입점 신청 검토 대기 중입니다. 승인 완료 후 로그인해 주세요.", 'clock');
            return;
        }
        if (effectivePartner.status === 'rejected') {
            showToast(`입점 신청이 반려되었습니다.${effectivePartner.rejectReason ? ' 사유: ' + effectivePartner.rejectReason : ''}`, "warning");
            showInlineLoginError(errorMsg, "입점 신청이 반려된 계정입니다.", 'x-circle');
            // 지금까지는 반려되면 영구히 재신청할 방법이 없어서 새 아이디로 재가입해야 했다 —
            // 로그인 폼에 재신청 버튼을 노출해 같은 계정으로 다시 심사받을 수 있게 한다.
            reapplyTargetPartnerId = effectivePartner.id;
            document.getElementById('partner-reapply-btn')?.classList.remove('hidden');
            return;
        }
        if (effectivePartner.status === 'info_requested') {
            showToast(`입점 심사를 위해 추가 정보가 필요해요.${effectivePartner.infoRequestNote ? ' 요청 내용: ' + effectivePartner.infoRequestNote : ''}`, "info");
            showInlineLoginError(errorMsg, "매니저 센터가 추가 정보를 요청했습니다. 아래에서 보완 후 재신청해 주세요.", 'message-circle-question');
            reapplyTargetPartnerId = effectivePartner.id;
            document.getElementById('partner-reapply-btn')?.classList.remove('hidden');
            return;
        }
        // 고객 계정 정지(toggleClientSuspension)는 옐로카드 누적 없이도 매니저가 즉시
        // 잠글 수 있는데, 파트너 쪽은 삼진아웃(영구 제명) 아니면 손 쓸 방법이 없었다
        // — 조사 중인 파트너를 잠시 막아둘 가역적 수단이 없던 비대칭을 해소한다.
        // 고객의 계정 정지에는 로그인 화면에서 바로 소명할 수 있는 이의신청
        // (openSuspensionAppealModal)이 있는데 파트너 정지는 그마저도 없었으므로
        // 동일하게 이의신청 모달을 띄운다.
        if (effectivePartner.isSuspended) {
            openPartnerSuspensionAppealModal(effectivePartner.id);
            return;
        }
        window.AppState.partnerLoggedIn = true;
        window.AppState.partnerName = effectivePartner.name;
        window.AppState.partnerLoggedInStaffLabel = matchedStaffLabel;
        errorMsg?.classList.add('hidden');
        togglePartnerConsoleVisibility();
        updateB2BNavButton();
        pushLog('PARTNER', 'AUTH', matchedStaffLabel ? `'${effectivePartner.name}' 담당자(${matchedStaffLabel}) 로그인 완료.` : `'${effectivePartner.name}' 마스터 로그인 완료.`, 'SUCCESS');
        if (typeof switchPartnerMode === 'function') switchPartnerMode('orders');
    } else if (errorMsg) {
        showInlineLoginError(errorMsg, "아이디 또는 비밀번호가 일치하지 않습니다.");
    }
}

function partnerLogout() {
    window.AppState.partnerLoggedIn = false;
    window.AppState.partnerName = '';
    window.AppState.partnerLoggedInStaffLabel = null;
    togglePartnerConsoleVisibility();
    document.getElementById('partner-audit-empty')?.classList.remove('hidden');
    document.getElementById('partner-audit-details')?.classList.add('hidden');
    updateB2BNavButton();
    showToast('안전하게 로그아웃 되었습니다.', 'info');
}

/* updatePartnerPassword는 이미 로그인된 파트너만 쓸 수 있어서, 아이디/비밀번호를
 * 잊은 파트너는 매니저 센터에 별도로 문의하는 수밖에 없었다 — 고객 쪽 계정 찾기
 * (findClientId/sendClientPasswordResetCode, client_panel.js)와 동일한 가상 SMS
 * 패턴으로, 업체명+사업자등록번호 본인 확인 후 아이디 조회·비밀번호 재설정을
 * 할 수 있게 한다. */
let partnerRecoverySentCode = null;

function openPartnerAccountRecoveryModal() {
    ['partner-recovery-findid-company', 'partner-recovery-findid-biznum', 'partner-recovery-resetpw-id', 'partner-recovery-resetpw-company', 'partner-recovery-resetpw-biznum', 'partner-recovery-resetpw-code', 'partner-recovery-resetpw-newpw', 'partner-recovery-resetpw-newpw2'].forEach(id => safeUpdateValue(id, ''));
    document.getElementById('partner-recovery-findid-result')?.classList.add('hidden');
    document.getElementById('partner-recovery-resetpw-verified-fields')?.classList.add('hidden');
    partnerRecoverySentCode = null;
    switchPartnerRecoveryTab('findId');
    openModal('partner-account-recovery-modal', 'partner-account-recovery-modal-card');
}

function closePartnerAccountRecoveryModal() {
    closeModal('partner-account-recovery-modal', 'partner-account-recovery-modal-card');
}

function switchPartnerRecoveryTab(mode) {
    document.getElementById('partner-recovery-tab-findid')?.classList.toggle('active', mode === 'findId');
    document.getElementById('partner-recovery-tab-resetpw')?.classList.toggle('active', mode === 'resetPw');
    document.getElementById('partner-recovery-findid-pane')?.classList.toggle('hidden', mode !== 'findId');
    document.getElementById('partner-recovery-resetpw-pane')?.classList.toggle('hidden', mode !== 'resetPw');
}

function findPartnerId() {
    const company = document.getElementById('partner-recovery-findid-company')?.value.trim();
    const bizNum = document.getElementById('partner-recovery-findid-biznum')?.value.trim();
    const resultEl = document.getElementById('partner-recovery-findid-result');
    if (!company || !bizNum) { showToast('업체명과 사업자등록번호를 입력해 주세요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === company && p.bizFile === bizNum);
    if (!resultEl) return;
    resultEl.classList.remove('hidden');
    if (!partner) {
        resultEl.className = 'text-xs font-bold text-center p-3 bg-rose-50 rounded-xl text-roseCustom';
        resultEl.textContent = '일치하는 계정을 찾을 수 없습니다.';
        return;
    }
    resultEl.className = 'text-xs font-bold text-center p-3 bg-emerald-50 rounded-xl text-emeraldCustom';
    resultEl.textContent = `귀사의 아이디는 [${partner.id}] 입니다.`;
}

// 파트너 계정 찾기(findPartnerId 등)는 마스터 계정만 대상으로 했는데, 담당자
// 부계정(partner.staffAccounts, 오늘 추가된 기능)으로 로그인하는 직원이 비밀번호를
// 잊으면 복구할 방법이 없었다 — 소속 업체의 사업자등록번호로 본인 확인해 담당자
// 계정 비밀번호도 재설정할 수 있게, 마스터/담당자 아이디를 모두 조회한다.
function findPartnerAccountByRecoveryId(id, company, bizNum) {
    const partner = window.AppState.partners.find(p => p.name === company && p.bizFile === bizNum);
    if (!partner) return null;
    if (partner.id === id) return { partner, staffAccount: null };
    const staffAccount = (partner.staffAccounts || []).find(s => s.id === id);
    return staffAccount ? { partner, staffAccount } : null;
}

function sendPartnerPasswordResetCode() {
    const id = document.getElementById('partner-recovery-resetpw-id')?.value.trim();
    const company = document.getElementById('partner-recovery-resetpw-company')?.value.trim();
    const bizNum = document.getElementById('partner-recovery-resetpw-biznum')?.value.trim();
    if (!id || !company || !bizNum) { showToast('아이디·업체명·사업자등록번호를 모두 입력해 주세요.', 'warning'); return; }
    const match = findPartnerAccountByRecoveryId(id, company, bizNum);
    if (!match) { showToast('입력하신 정보와 일치하는 계정을 찾을 수 없습니다.', 'warning'); return; }

    partnerRecoverySentCode = String(Math.floor(1000 + Math.random() * 9000));
    document.getElementById('partner-recovery-resetpw-verified-fields')?.classList.remove('hidden');
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PASSWORD_RESET_SMS', `'${id}' 계정의 비밀번호 재설정 가상 SMS [${partnerRecoverySentCode}] 전송.`, 'INFO');
    showToast(`가상 SMS 인증코드 [${partnerRecoverySentCode}]가 발송되었습니다.`, 'info');
}

function resetPartnerPassword() {
    const id = document.getElementById('partner-recovery-resetpw-id')?.value.trim();
    const company = document.getElementById('partner-recovery-resetpw-company')?.value.trim();
    const bizNum = document.getElementById('partner-recovery-resetpw-biznum')?.value.trim();
    const code = document.getElementById('partner-recovery-resetpw-code')?.value.trim();
    const newPw = document.getElementById('partner-recovery-resetpw-newpw')?.value;
    const newPw2 = document.getElementById('partner-recovery-resetpw-newpw2')?.value;
    if (!partnerRecoverySentCode) { showToast('먼저 인증코드를 발송해 주세요.', 'warning'); return; }
    if (!code || code !== partnerRecoverySentCode) { showToast('인증코드가 일치하지 않습니다.', 'warning'); return; }
    if (!newPw || !newPw2) { showToast('새 비밀번호를 입력해 주세요.', 'warning'); return; }
    if (newPw !== newPw2) { showToast('새 비밀번호가 일치하지 않습니다.', 'warning'); return; }
    const match = findPartnerAccountByRecoveryId(id, company, bizNum);
    if (!match) { showToast('계정을 찾을 수 없습니다.', 'warning'); return; }

    if (match.staffAccount) match.staffAccount.pw = newPw; else match.partner.pw = newPw;
    partnerRecoverySentCode = null;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PASSWORD_RESET', `'${id}' 계정이 본인 확인 후 비밀번호를 재설정했습니다.`, 'WARNING');
    showToast('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.', 'success');
    closePartnerAccountRecoveryModal();
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

    // 고객 회원가입의 추천인 입력(form-signup-referral)과 동일하게, 추천인 아이디는
    // 선택 입력이며 존재하지 않거나 자기 자신을 적어도 입점 신청 자체는 막지 않는다.
    const referralIdVal = document.getElementById('partner-signup-referral')?.value.trim();
    const referrerPartner = referralIdVal ? window.AppState.partners.find(p => p.id === referralIdVal) : null;
    if (referralIdVal && !referrerPartner) { showToast('추천인 아이디를 찾을 수 없어 추천 없이 입점 신청을 진행합니다.', 'info'); }

    const now = new Date().toLocaleString('ko-KR');
    const newPartner = {
        name: company, id: idVal, pw: pwVal, bizFile: bizNum, phone,
        rating: 5.0, strikeCount: 0, status: 'pending', suspensionEndDate: null, isCertified: false,
        appliedAt: now, bizCertDoc: _partnerSignupBizCertDraft,
        portfolios: [], reviews: []
    };
    if (referrerPartner) newPartner.referredBy = referrerPartner.id;
    window.AppState.partners.push(newPartner);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'SIGNUP_REQUEST', `'${company}'(${idVal}) 입점 신청 접수 — 매니저 승인 대기.`, 'INFO');
    showToast(`입점 신청이 접수되었습니다!\n매니저 센터 검토 후 승인되면 로그인하실 수 있어요.`, 'success');

    _partnerSignupBizCertDraft = null;
    ['partner-signup-company', 'partner-signup-phone', 'partner-signup-biznum', 'partner-signup-id', 'partner-signup-pw', 'partner-signup-pw2', 'partner-signup-referral'].forEach(id => safeUpdateValue(id, ''));
    safeUpdateText('partner-signup-bizcert-filename', '선택된 파일 없음');
    switchPartnerAuthTab('login');
}

/* 고객의 "관심 파트너" 찜하기(toggleFavoritePartner, client_panel.js)와 대칭되는
 * 파트너용 기능 — 즉시입찰 스트림이 실시간으로 계속 흘러가기 때문에, 당장 입찰할지
 * 판단이 안 서는 오더를 놓치지 않게 찜해두고 나중에 모아볼 수 있게 한다.
 * 고객측과 달리 별도 개수 상한은 두지 않는다(파트너 본인의 업무 도구 성격). */
let partnerFavoriteOrdersOnly = false;

function isFavoriteOrder(orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    return !!(partner && partner.favoriteOrders && partner.favoriteOrders.includes(orderCode));
}

const MAX_FAVORITE_ORDERS = 20;

function toggleFavoriteOrder(orderCode, event) {
    if (event) event.stopPropagation();
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if (!partner.favoriteOrders) partner.favoriteOrders = [];
    const idx = partner.favoriteOrders.indexOf(orderCode);
    if (idx >= 0) { partner.favoriteOrders.splice(idx, 1); showToast(`오더 ${orderCode}를 관심 오더에서 제거했습니다.`, 'info'); }
    else {
        // 고객측 관심 파트너(MAX_FAVORITE_PARTNERS)와 동일하게, 상한 없이 계속 쌓이면
        // '관심'이라는 기능 취지가 무색해지므로 동일한 상한을 둔다.
        if (partner.favoriteOrders.length >= MAX_FAVORITE_ORDERS) { showToast(`관심 오더는 최대 ${MAX_FAVORITE_ORDERS}건까지 저장할 수 있어요. 기존 항목을 해제한 후 다시 시도해주세요.`, 'warning'); return; }
        partner.favoriteOrders.push(orderCode); showToast(`오더 ${orderCode}를 관심 오더로 저장했습니다!`, 'success');
    }
    renderPartnerOrderList();
}

function togglePartnerFavoriteOrdersFilter() {
    partnerFavoriteOrdersOnly = !partnerFavoriteOrdersOnly;
    const btn = document.getElementById('btn-partner-favorite-orders-toggle');
    if (btn) btn.classList.toggle('btn-dark', partnerFavoriteOrdersOnly);
    renderPartnerOrderList();
}

/* 고객은 파트너를 관심 등록할 수 있는데(toggleFavoritePartner, client_panel.js),
 * 반대로 파트너가 재구매 가능성이 높은 단골/유망 고객을 기억해둘 방법이 없었다 —
 * favoriteClientCount는 "몇 명이 나를 찜했는지" 집계일 뿐, 파트너 본인이 특정
 * 고객을 저장하는 기능은 아니었다. clientPhone을 식별자로 저장한다(계정이 없어도
 * 오더에는 항상 phone이 있음). */
const MAX_FAVORITE_CLIENTS = 20;

function isClientFavorited(clientPhone) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    return !!(partner && partner.favoriteClients && partner.favoriteClients.some(c => c.phone === clientPhone));
}

function toggleFavoriteClient(clientPhone, clientName, orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if (!partner.favoriteClients) partner.favoriteClients = [];
    const idx = partner.favoriteClients.findIndex(c => c.phone === clientPhone);
    if (idx >= 0) { partner.favoriteClients.splice(idx, 1); showToast(`[${clientName}]님을 단골 고객에서 제거했습니다.`, 'info'); }
    else {
        if (partner.favoriteClients.length >= MAX_FAVORITE_CLIENTS) { showToast(`단골 고객은 최대 ${MAX_FAVORITE_CLIENTS}명까지 저장할 수 있어요. 기존 항목을 해제한 후 다시 시도해주세요.`, 'warning'); return; }
        partner.favoriteClients.push({ phone: clientPhone, name: clientName }); showToast(`[${clientName}]님을 단골 고객으로 저장했습니다!`, 'success');
        // 고객이 파트너를 찜하면 파트너에게 알림이 가는데(2f5ff75), 반대로 파트너가
        // 고객을 단골로 저장해도 고객은 전혀 알 수 없었다 — 대칭으로 알린다
        // (해제는 굳이 알릴 필요가 없어 저장 시에만 보낸다).
        if (typeof pushClientNotification === 'function') pushClientNotification(clientPhone, `${partnerName}에서 고객님을 단골로 등록했어요.`);
    }
    if (orderCode) openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerPerformanceView === 'function' && window.AppState.partnerConsoleMode === 'performance') renderPartnerPerformanceView();
}

/* 고객은 관심 파트너에게 재의뢰(1:1 지정) 요청을 직접 보낼 수 있는데
 * (requestDirectQuoteFromPortfolio, cms.js) 파트너 쪽엔 단골로 저장한 고객에게
 * 먼저 손을 내밀 방법이 없었다 — 단골 고객 목록(buildPartnerFavoriteClientsHtml)에
 * "해제"만 있고 다시 연락할 방법이 없던 공백. 스팸성 반복 전송을 막기 위해
 * lastInvitedDate로 쿨다운을 둔다. */
const FAVORITE_CLIENT_INVITE_COOLDOWN_DAYS = 7;

function invitePartnerFavoriteClient(clientPhone, clientName) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.favoriteClients) return;
    const entry = partner.favoriteClients.find(c => c.phone === clientPhone);
    if (!entry) return;

    const account = (window.AppState.clientAccounts || []).find(a => a.phone === clientPhone);
    if (account && account.blockedPartners && account.blockedPartners.includes(partnerName)) {
        showToast('해당 고객이 파트너사를 차단하여 제안을 보낼 수 없습니다.', 'warning');
        return;
    }
    if (entry.lastInvitedDate) {
        const daysSince = Math.floor((new Date() - new Date(entry.lastInvitedDate)) / (1000 * 60 * 60 * 24));
        if (daysSince < FAVORITE_CLIENT_INVITE_COOLDOWN_DAYS) {
            showToast(`최근에 이미 제안을 보냈어요. ${FAVORITE_CLIENT_INVITE_COOLDOWN_DAYS - daysSince}일 후 다시 보낼 수 있습니다.`, 'warning');
            return;
        }
    }

    entry.lastInvitedDate = getLocalDateString();
    if (typeof pushLog === 'function') pushLog('PARTNER', 'FAVORITE_CLIENT_INVITE', `[${partnerName}]가 단골 고객(${clientName})에게 견적 제안을 보냈습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(clientPhone, `${partnerName}에서 인테리어 견적 상담을 제안했어요. 관심 있으시면 견적 요청을 보내보세요!`, { invitingPartner: partnerName }, 'marketing');
    showToast(`[${clientName}]님에게 견적 제안을 보냈습니다.`, 'success');
    if (typeof renderPartnerPerformanceView === 'function' && window.AppState.partnerConsoleMode === 'performance') renderPartnerPerformanceView();
}

/* 고객은 특정 파트너를 영구 차단해 이후 매칭/1:1 지정에서 제외할 수 있는데
 * (togglePartnerBlock, client_panel.js) 파트너 쪽엔 대칭 기능이 없었다 — 노쇼·
 * 상습 갑질 고객은 신고(openReportClientModal)해서 매니저 센터가 판단하게 할 수는
 * 있지만, 신고 사유가 안 될 만큼 애매하게 안 맞는 고객이라도 "이 고객 오더는
 * 다시는 뜨지 않았으면" 하는 파트너 개인의 선호를 저장할 방법이 없었다. */
function isClientBlockedByPartner(clientPhone) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    return !!(partner && partner.blockedClients && partner.blockedClients.some(c => c.phone === clientPhone));
}

function togglePartnerBlockClient(clientPhone, clientName, orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if (!partner.blockedClients) partner.blockedClients = [];
    const idx = partner.blockedClients.findIndex(c => c.phone === clientPhone);
    if (idx >= 0) { partner.blockedClients.splice(idx, 1); showToast(`[${clientName}]님을 차단 해제했습니다.`, 'info'); }
    else {
        partner.blockedClients.push({ phone: clientPhone, name: clientName });
        // 관심 고객(단골)과 차단은 동시에 의미가 없으므로, 차단하면 단골 목록에서도 뺀다.
        if (partner.favoriteClients) {
            const favIdx = partner.favoriteClients.findIndex(c => c.phone === clientPhone);
            if (favIdx >= 0) partner.favoriteClients.splice(favIdx, 1);
        }
        if (typeof pushLog === 'function') pushLog('PARTNER', 'CLIENT_BLOCK', `[${partnerName}]가 고객(${clientName})을 차단했습니다.`, 'INFO');
        showToast(`[${clientName}]님을 차단했습니다. 이 고객의 오더는 더 이상 즉시입찰 목록에 뜨지 않아요.`, 'success');
    }
    if (orderCode) openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    if (typeof renderPartnerPerformanceView === 'function' && window.AppState.partnerConsoleMode === 'performance') renderPartnerPerformanceView();
}

function buildPartnerBlockedClientsHtml(partner) {
    const blocked = partner.blockedClients || [];
    if (blocked.length === 0) {
        return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">차단한 고객이 없습니다.</div>`;
    }
    return blocked.map(c => `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <span class="text-xs font-bold text-ink-800">${escapeHtml(c.name)}</span>
            <button type="button" onclick="togglePartnerBlockClient('${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" class="text-[11px] font-bold text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0">차단 해제</button>
        </div>`).join('');
}

/* 클라이언트는 마이페이지에서 커뮤니티 차단 목록을 확인/해제할 수 있는데
 * (renderBlockedUsersList), 파트너는 toggleBlockCommunityUser로 차단은 할 수 있어도
 * 콘솔 어디서도 누굴 차단했는지 확인·해제할 방법이 없었다 — 동일한 패턴을
 * 마이인포 화면에 추가한다. */
function renderPartnerBlockedCommunityUsersList() {
    const container = document.getElementById('partner-blocked-community-users-list');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const blockedIds = (partner && partner.communityBlockedUsers) || [];

    if (blockedIds.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-bold text-center py-3">차단한 사용자가 없습니다.</p>`;
        return;
    }
    container.innerHTML = blockedIds.map(id => {
        const account = (window.AppState.clientAccounts || []).find(acc => acc.id === id);
        const post = (window.AppState.communityPosts || []).find(p => p.authorId === id);
        const displayName = (account && account.name) || (post && post.authorName) || id;
        return `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <span class="text-xs font-bold text-ink-800">${escapeHtml(displayName)}</span>
            <button type="button" onclick="toggleBlockCommunityUser('${escapeHtml(id)}', '${escapeHtml(displayName)}')" class="text-[11px] font-bold text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0">차단 해제</button>
        </div>`;
    }).join('');
}

function buildPartnerFavoriteClientsHtml(partner) {
    const favorites = partner.favoriteClients || [];
    if (favorites.length === 0) {
        return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">저장된 단골 고객이 없습니다.</div>`;
    }
    return favorites.map(c => {
        const myOrders = (window.AppState.orders || []).filter(o => o.clientPhone === c.phone);
        const contractedCount = myOrders.filter(o => o.status === 'contracted').length;
        const avgRating = typeof getClientAverageRating === 'function' ? getClientAverageRating(c.phone) : null;
        const tierBadge = typeof buildClientTierBadgeHtml === 'function' ? buildClientTierBadgeHtml(c.phone) : '';
        let daysSinceInvite = null;
        if (c.lastInvitedDate) daysSinceInvite = Math.floor((new Date() - new Date(c.lastInvitedDate)) / (1000 * 60 * 60 * 24));
        const inCooldown = daysSinceInvite !== null && daysSinceInvite < FAVORITE_CLIENT_INVITE_COOLDOWN_DAYS;
        const inviteBtn = inCooldown
            ? `<span class="text-[10px] font-bold text-ink-300">제안 보냄 (${FAVORITE_CLIENT_INVITE_COOLDOWN_DAYS - daysSinceInvite}일 후 재전송 가능)</span>`
            : `<button type="button" onclick="invitePartnerFavoriteClient('${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" class="text-[10px] font-bold text-brand-600 hover:underline bg-transparent border-0 cursor-pointer p-0">견적 제안 보내기</button>`;
        return `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <div class="space-y-0.5"><p class="text-xs font-black text-ink-900">${escapeHtml(c.name)} ${tierBadge}</p><p class="text-[10px] text-ink-500 font-bold">${escapeHtml(c.phone)} · 계약 ${contractedCount}건${avgRating ? ` · <span class="text-gold-500">★ ${avgRating.avg}</span> (${avgRating.count}건 평가)` : ''}</p></div>
            <div class="flex items-center gap-3 shrink-0">
                ${inviteBtn}
                <button type="button" onclick="toggleFavoriteClient('${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">해제</button>
            </div>
        </div>`;
    }).join('');
}

/* 고객→파트너 후기(submitClientReview, client_panel.js)와 대칭으로, 파트너도
 * 계약 완료 고객의 협조도·소통·결제 신뢰도를 별점으로 남길 수 있게 한다.
 * partnerReports(노쇼·갑질 블랙리스트 신고)와는 별개의 일반 평가 채널이며,
 * 평점 집계(getClientAverageRating, utils_ui.js)는 다른 파트너가 재계약/입찰
 * 전에 참고할 수 있도록 단골 고객 목록에 노출한다. 코멘트는 공개하지 않고
 * 매니저 센터와 파트너 본인만 볼 수 있게 유지해 고객과의 불필요한 마찰을 막는다. */
let clientRatingTargetCode = null;

function openClientRatingModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    clientRatingTargetCode = orderCode;
    const existing = (window.AppState.clientRatings || []).find(r => r.orderCode === orderCode);
    window.AppState.activeClientRating = existing ? existing.rating : 5;
    safeUpdateValue('client-rating-comment-input', existing ? (existing.comment || '') : '');
    renderClientRatingStars();
    openModal('client-rating-modal', 'client-rating-modal-card');
}

function closeClientRatingModal() {
    clientRatingTargetCode = null;
    closeModal('client-rating-modal', 'client-rating-modal-card');
}

function renderClientRatingStars() {
    const el = document.getElementById('client-rating-stars');
    if (!el) return;
    const rating = window.AppState.activeClientRating || 5;
    el.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" onclick="setClientRatingStar(${n})" class="bg-transparent border-0 cursor-pointer p-0.5 leading-none ${n <= rating ? 'text-gold-500' : 'text-ink-200'}" aria-label="${n}점">★</button>`).join('');
}

function setClientRatingStar(n) {
    window.AppState.activeClientRating = n;
    renderClientRatingStars();
}

function submitClientRating() {
    const order = window.AppState.orders.find(o => o.code === clientRatingTargetCode);
    if (!order) { closeClientRatingModal(); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (order.acceptedPartner !== partnerName) { closeClientRatingModal(); return; }
    const comment = document.getElementById('client-rating-comment-input')?.value.trim() || '';
    const rating = window.AppState.activeClientRating || 5;

    if (!window.AppState.clientRatings) window.AppState.clientRatings = [];
    const existing = window.AppState.clientRatings.find(r => r.orderCode === order.code);
    const isEditing = !!existing;
    if (existing) {
        existing.rating = rating; existing.comment = comment; existing.editedDate = getLocalDateString();
        existing.appeal = null;
    } else {
        window.AppState.clientRatings.push({ orderCode: order.code, clientPhone: order.clientPhone, clientName: order.clientName, partnerName, rating, comment, date: getLocalDateString(), appeal: null });
    }

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CLIENT_RATING', `[${partnerName}]가 오더(${order.code}) 고객(${order.clientName})을 평가${isEditing ? ' 수정' : ''}했습니다. (★${rating})`, 'INFO');
    // 평가 대상인 고객 본인은 지금까지 평가가 남았다는 사실조차 알 방법이 없었다 —
    // 다른 모든 제재성 조치(신고, 계정 정지, 옐로카드)는 당사자에게 알리는데
    // 이것만 조용히 쌓이고 있었던 비대칭을 해소한다.
    if (typeof pushClientNotification === 'function' && order.clientPhone) pushClientNotification(order.clientPhone, `계약 파트너사가 고객님에 대한 평가를 남겼어요. 마이페이지에서 확인해보세요.`);
    showToast(isEditing ? '고객 평가를 수정했습니다.' : '고객 평가가 등록되었습니다.', 'success');

    closeClientRatingModal();
    openPartnerOrderDetailModal(order.code);
}

function buildPartnerClientRatingHtml(order) {
    const myRating = (window.AppState.clientRatings || []).find(r => r.orderCode === order.code);
    return `<div class="surface p-5 space-y-2">
        <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="user-check" class="w-4 h-4 text-gold-500"></i> 고객 평가</h5>
        <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">협조도·소통·결제 신뢰도 등을 평가해 다른 파트너사가 참고할 수 있게 해요. 코멘트는 공개되지 않아요.</p>
        ${myRating
            ? `<div class="flex items-center justify-between"><span class="text-gold-500 font-black text-sm">${'★'.repeat(myRating.rating)}${'☆'.repeat(5 - myRating.rating)}</span><button type="button" onclick="openClientRatingModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">수정</button></div>`
            : `<button type="button" onclick="openClientRatingModal('${order.code}')" class="btn btn-secondary btn-sm">고객 평가하기</button>`}
    </div>`;
}

function renderPartnerOrderList() {
    const streamList = document.getElementById('partner-order-stream-list');
    const liveOrderBadge = document.getElementById('partner-live-order-badge');
    if (!streamList) return;

    const currentPartner = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const allOrders = window.AppState.orders;
    let filteredOrders = allOrders.filter(o => o.status === 'bidding' && o.budget < 7000 && !o.is1on1 && o.bids.length < o.partnerCountLimit && !o.bids.some(b => b.partner === currentPartner) && (!o.excludedPartners || !o.excludedPartners.includes(currentPartner)) && !isClientBlockedByPartner(o.clientPhone));
    if (partnerFavoriteOrdersOnly) filteredOrders = filteredOrders.filter(o => isFavoriteOrder(o.code));

    if (liveOrderBadge) liveOrderBadge.innerText = `${filteredOrders.length}개 선착순 즉시입찰 참여 가능 오더`;

    if (filteredOrders.length === 0) {
        streamList.innerHTML = partnerFavoriteOrdersOnly
            ? `<div class="empty-state !py-16 surface"><p class="text-xs text-ink-800 font-extrabold leading-relaxed">찜한 오더가 없습니다.<br><span class="text-[10px] text-ink-500 font-semibold mt-1 inline-block">오더 카드의 북마크 아이콘을 눌러 찜해보세요.</span></p></div>`
            : `<div class="empty-state !py-16 surface"><p class="text-xs text-ink-800 font-extrabold leading-relaxed">지금 참여 가능한 새로운 안심 입찰 오더가 존재하지 않습니다.<br><span class="text-[10px] text-ink-500 font-semibold mt-1 inline-block">(신청 완료한 건은 상단 '안심계약' 확인)</span></p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    streamList.innerHTML = '';
    filteredOrders.forEach(order => {
        const item = document.createElement('div');
        const isSelected = order.code === window.AppState.selectedOrderCode;
        const favorited = isFavoriteOrder(order.code);
        item.className = `p-4 rounded-2xl border ${isSelected ? 'border-2 border-ink-950 bg-ink-50' : 'border-ink-100 bg-white hover:border-ink-300'} transition-all cursor-pointer space-y-2 text-left`;
        item.style.boxShadow = 'var(--shadow-1)';
        item.onclick = () => selectOrderForAudit(order.code);

        const slotsLeft = order.partnerCountLimit - order.bids.length;
        const clientAvgRating = typeof getClientAverageRating === 'function' ? getClientAverageRating(order.clientPhone) : null;
        const clientTierBadge = typeof buildClientTierBadgeHtml === 'function' ? buildClientTierBadgeHtml(order.clientPhone) : '';
        item.innerHTML = `
            <div class="flex justify-between items-center text-[10px] font-bold">
                <span class="font-mono text-ink-600 bg-ink-100 px-2 py-0.5 rounded-md border border-ink-200 font-extrabold">${order.code}</span>
                <div class="flex items-center gap-1.5">
                    <span class="badge badge-neutral"><span class="badge-dot ${slotsLeft === 1 ? 'bg-amberCustom' : 'bg-ink-400'}"></span>선착순 ${slotsLeft}개사 남음</span>
                    <button type="button" class="btn btn-ghost btn-sm px-1.5" aria-label="관심 오더 찜하기"><i data-lucide="bookmark" class="w-3.5 h-3.5 ${favorited ? 'text-brand-600' : 'text-ink-300'}" ${favorited ? 'fill="currentColor"' : ''}></i></button>
                </div>
            </div>
            <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5 flex-wrap">${maskName(order.clientName)} 고객님 (${order.pyung}평형) ${clientTierBadge}${clientAvgRating ? `<span class="text-[10px] font-bold text-ink-500"><span class="text-gold-500">★</span> ${clientAvgRating.avg} (${clientAvgRating.count}건)</span>` : ''}</h5>
            <p class="text-[10px] text-ink-500 font-medium truncate">${maskAddress(order.clientAddress)}</p>
            <span class="badge badge-brand">희망예산 ₩ ${order.budget.toLocaleString()}만원</span>`;
        item.querySelector('button[aria-label="관심 오더 찜하기"]').onclick = (e) => toggleFavoriteOrder(order.code, e);
        streamList.appendChild(item);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

    /* 고객 쪽엔 파트너를 고르기 전부터 등급 배지·평점이 보이는데(renderPartnerSearchGrid),
     * 정작 파트너가 입찰 여부를 결정하는 이 화면에는 고객의 단골/평점 이력이 전혀
     * 노출되지 않았다 — 관심 고객으로 저장한 뒤에야(buildPartnerFavoriteClientsHtml)
     * 볼 수 있었던 정보를 입찰 결정 시점으로 앞당긴다. */
    const auditClientTierBadge = typeof buildClientTierBadgeHtml === 'function' ? buildClientTierBadgeHtml(order.clientPhone) : '';
    const auditClientAvgRating = typeof getClientAverageRating === 'function' ? getClientAverageRating(order.clientPhone) : null;

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
                        <h4 class="text-base font-black text-ink-950 tracking-tight flex items-center gap-1.5 flex-wrap">${displayClientName} ${auditClientTierBadge}${auditClientAvgRating ? `<span class="text-xs font-bold text-ink-500"><span class="text-gold-500">★</span> ${auditClientAvgRating.avg} (파트너 평가 ${auditClientAvgRating.count}건)</span>` : ''}</h4>
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
                ${order.status === 'bidding' ? (() => {
                    const myBid = order.bids.find(b => b.partner === currentPartnerName);
                    return `
                <div class="surface-flat p-4 space-y-3 text-left">
                    <h5 class="text-xs font-black text-ink-950">제출한 입찰 내용 수정</h5>
                    <div><label class="field-label">입찰 제안 금액 (만원)</label><input type="number" id="partner-bid-price-input" value="${myBid ? myBid.price : ''}" min="1" class="input"></div>
                    <div><label class="field-label">제안 메시지</label><textarea id="partner-bid-desc-input" class="textarea h-20">${escapeHtml(myBid ? myBid.desc : '')}</textarea></div>
                    ${buildBidCostBreakdownInputsHtml(myBid)}
                    <button type="button" onclick="editPartnerBid('${order.code}')" class="btn btn-secondary btn-lg btn-block">입찰 내용 수정 완료</button>
                </div>`;
                })() : ''}
            ` : `
                ${buildPreBidQnaHtml(order, currentPartnerName)}
                <div class="surface-flat p-4 space-y-3 text-left">
                    <div><label class="field-label">입찰 제안 금액 (만원)</label><input type="number" id="partner-bid-price-input" value="${Math.floor(order.budget * 0.95)}" min="1" class="input"></div>
                    <div><label class="field-label">제안 메시지</label><textarea id="partner-bid-desc-input" class="textarea h-20" placeholder="고객에게 보여줄 제안 메시지를 입력하세요.">${currentPartnerName}에서 제안하는 하이엔드 시공 안심 제안입니다.</textarea></div>
                    ${buildBidCostBreakdownInputsHtml(null)}
                    <button type="button" onclick="submitPartnerBid()" class="btn btn-dark btn-lg btn-block"><i data-lucide="zap" class="w-4 h-4"></i> 선착순 입찰 즉시 참여하기</button>
                </div>`}
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 입찰서가 견적금액 하나로만 이뤄져 있어서, 고객이 비교 테이블(openBidCompareModal,
 * client_panel.js)로 여러 입찰서를 봐도 "왜 이 가격인지" 근거를 전혀 알 수 없었다 —
 * 자재비/인건비/철거비/기타로 나눠 선택 입력받는다(전부 선택 사항이라, 입력 안 해도
 * 기존과 동일하게 총액만으로 입찰 가능). */
const BID_COST_BREAKDOWN_CATEGORIES = [
    { key: 'materials', label: '자재비' },
    { key: 'labor', label: '인건비' },
    { key: 'demolition', label: '철거비' },
    { key: 'other', label: '기타' }
];

function buildBidCostBreakdownInputsHtml(existingBid) {
    const existing = {};
    (existingBid && existingBid.costBreakdown || []).forEach(item => { existing[item.key] = item.amount; });
    return `<div class="space-y-1.5">
        <label class="field-label mb-0">비용 세부내역 (만원, 선택)</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${BID_COST_BREAKDOWN_CATEGORIES.map(c => `<input type="number" id="partner-bid-cost-${c.key}-input" placeholder="${c.label}" min="0" value="${existing[c.key] || ''}" class="input text-xs">`).join('')}
        </div>
    </div>`;
}

function readBidCostBreakdownInputs() {
    return BID_COST_BREAKDOWN_CATEGORIES
        .map(c => ({ key: c.key, label: c.label, amount: parseInt(document.getElementById(`partner-bid-cost-${c.key}-input`)?.value, 10) || 0 }))
        .filter(item => item.amount > 0);
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
    const costBreakdown = readBidCostBreakdownInputs();

    order.bids.push({ partner: partnerName, price, desc, verified: true, progress: 'bidding', costBreakdown, date: getLocalDateString(), validUntil: computeBidValidUntil(), respondedAt: new Date().toISOString() });

    selectOrderForAudit(code);
    renderPartnerOrderList();
    recalculateKPIs();
    pushLog('PARTNER', 'BID', `[${partnerName}]가 오더 ${code} 입찰 선점.`, 'SUCCESS');
    showToast("선착순 입찰에 참여했습니다!", "success");
}

/* 지금까지 입찰 제출 후 오탈자나 경쟁사 대비 금액을 조정하려면 철회(withdrawMyPartnerBid)
 * 후 재입찰해야 했는데, 철회는 즉시 excludedPartners에 등록되어 해당 오더에 다시는
 * 입찰할 수 없게 막아버린다 — 사실상 "수정"의 대가가 영구 퇴장이었다. 계약 확정 전
 * (status === 'bidding')이라면 기존 입찰을 그대로 두고 금액/제안 내용만 바꿀 수 있게 한다. */
function editPartnerBid(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding') { showToast('이미 계약이 진행 중이거나 종료된 오더는 입찰을 수정할 수 없어요.', 'warning'); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const bid = order.bids.find(b => b.partner === partnerName);
    if (!bid) return;

    const priceInput = document.getElementById('partner-bid-price-input');
    const price = priceInput ? parseInt(priceInput.value, 10) : NaN;
    if (!price || price <= 0) { showToast('입찰 제안 금액을 올바르게 입력해 주세요.', 'warning'); return; }
    const descInput = document.getElementById('partner-bid-desc-input');
    const desc = (descInput && descInput.value.trim()) || bid.desc;

    const oldPrice = bid.price;
    const wasExpired = typeof isBidExpired === 'function' && isBidExpired(bid);
    bid.price = price;
    bid.desc = desc;
    bid.costBreakdown = readBidCostBreakdownInputs();
    // 견적 내용을 다시 제출하는 행위 자체가 최신 자재·인건비 기준으로 재확인했다는
    // 뜻이므로, 수정할 때마다 유효기간(validUntil)도 오늘로부터 새로 갱신한다.
    bid.validUntil = computeBidValidUntil();

    if (typeof pushLog === 'function') pushLog('PARTNER', 'BID_EDIT', `[${partnerName}]가 오더 ${orderCode}의 입찰 금액을 ₩${oldPrice.toLocaleString()}만원 → ₩${price.toLocaleString()}만원으로 수정했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, wasExpired
        ? `${partnerName} 파트너사가 만료됐던 입찰 견적을 최신 기준으로 재확인하여 다시 제출했어요. (의뢰 코드: ${orderCode})`
        : `${partnerName} 파트너사가 입찰 제안 내용을 수정했어요. (의뢰 코드: ${orderCode})`);
    showToast(wasExpired ? '만료됐던 견적을 재확인하여 갱신했습니다.' : '입찰 내용을 수정했습니다.', 'success');
    selectOrderForAudit(orderCode);
    recalculateKPIs();
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
    if (typeof pushClientNotification === 'function') {
        pushClientNotification(order.clientPhone, `${partnerName} 파트너사가 입찰을 철회했어요. (의뢰 코드: ${orderCode})`);
        // 마지막 남은 입찰까지 철회되면 오더가 조용히 "무응답" 상태로 남는다 —
        // 클라이언트가 이미 가진 재매칭 버튼(triggerRebidding)을 쓰도록 바로 알려준다.
        if (order.bids.length === 0) pushClientNotification(order.clientPhone, `오더(${orderCode})에 남은 입찰 제안이 없어요. 마이페이지에서 재매칭을 받아보세요.`);
    }
    showToast('입찰을 철회했습니다.', 'info');

    closePartnerOrderDetailModal();
    renderPartnerOrderList();
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    recalculateKPIs();
}

/* 고객의 계약 전 문의(openBidQuestionModal, client_panel.js)에 답변한다 — 후기 답글
 * 알림(submitReviewReply)과 동일한 패턴으로 pushClientNotification을 재사용한다. */
function replyToBidQuestion(orderCode, questionIdx) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const bid = order.bids && order.bids.find(b => b.partner === partnerName);
    const question = bid && bid.questions && bid.questions[questionIdx];
    if (!question) return;

    const input = document.getElementById(`bid-question-reply-input-${orderCode}-${questionIdx}`);
    const reply = input ? input.value.trim() : '';
    if (!reply) { showToast('답변 내용을 입력해 주세요.', 'warning'); return; }

    question.reply = reply;
    question.replyDate = getLocalDateString();
    if (typeof pushLog === 'function') pushLog('PARTNER', 'BID_QUESTION_REPLY', `[${partnerName}]가 오더(${orderCode}) 문의에 답변했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName} 파트너사가 계약 전 문의에 답변했어요. (의뢰 코드: ${orderCode})`);
    showToast('답변이 등록되었습니다.', 'success');
    openPartnerOrderDetailModal(orderCode);
}

/* 고객은 이미 입찰한 파트너에게 계약 전 문의를 할 수 있는데(openBidQuestionModal,
 * client_panel.js), 반대로 파트너가 입찰하기 전에 고객에게 층수·엘리베이터 유무처럼
 * 견적에 영향을 줄 사항을 미리 물어볼 방법은 없었다 — 아직 입찰 전이라 bid 객체가
 * 없으므로 오더 자체에 질문을 쌓고(order.partnerPreQuestions) 파트너별로 자기 질문만
 * 보이게 한다(경쟁사에게 노출되지 않도록).*/
let preBidQuestionTargetCode = null;

function buildPreBidQnaHtml(order, partnerName) {
    const myQuestions = (order.partnerPreQuestions || []).filter(q => q.partnerName === partnerName);
    const listHtml = myQuestions.length > 0 ? `
        <div class="space-y-2">${myQuestions.map(q => `
            <div class="p-3 bg-ink-50 rounded-xl space-y-1">
                <p class="text-xs text-ink-700 font-semibold leading-relaxed"><i data-lucide="help-circle" class="w-3 h-3 inline text-ink-400"></i> ${escapeHtml(q.text)} <span class="text-[10px] text-ink-400 font-bold">(${q.date})</span></p>
                ${q.reply ? `<p class="text-xs text-brand-700 font-semibold leading-relaxed pl-4"><i data-lucide="reply" class="w-3 h-3 inline"></i> ${escapeHtml(q.reply)}</p>` : `<p class="text-[10px] text-ink-400 font-bold pl-4">답변 대기중</p>`}
            </div>`).join('')}</div>` : '';
    return `
        <div class="surface-flat p-4 space-y-2.5 text-left">
            <div class="flex justify-between items-center">
                <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="message-circle-question" class="w-4 h-4 text-brand-500"></i> 입찰 전 문의 (경쟁사에게 비공개)</h5>
                <button type="button" onclick="openPreBidQuestionModal('${order.code}')" class="btn btn-secondary btn-sm">질문하기</button>
            </div>
            ${listHtml}
        </div>`;
}

function openPreBidQuestionModal(orderCode) {
    preBidQuestionTargetCode = orderCode;
    safeUpdateValue('partner-preask-text', '');
    openModal('partner-preask-modal', 'partner-preask-modal-card');
}

function closePreBidQuestionModal() {
    preBidQuestionTargetCode = null;
    closeModal('partner-preask-modal', 'partner-preask-modal-card');
}

function submitPreBidQuestion() {
    const order = window.AppState.orders.find(o => o.code === preBidQuestionTargetCode);
    if (!order) { closePreBidQuestionModal(); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';

    const text = document.getElementById('partner-preask-text')?.value.trim();
    if (!text) { showToast('문의 내용을 입력해 주세요.', 'warning'); return; }

    if (!order.partnerPreQuestions) order.partnerPreQuestions = [];
    order.partnerPreQuestions.push({ partnerName, text, date: getLocalDateString(), reply: null, replyDate: null });

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PRE_BID_QUESTION', `[${partnerName}]가 오더(${order.code})에 입찰 전 문의를 남겼습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}에서 오더(${order.code})에 대해 입찰 전 문의를 남겼어요: "${text}"`);
    showToast('문의를 보냈습니다. 답변이 도착하면 알려드릴게요.', 'success');
    closePreBidQuestionModal();
    selectOrderForAudit(order.code);
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

/* 고객은 본인이 요청한 계약 취소를 철회할 수 있는데(retractContractCancellationRequest,
 * client_panel.js) 파트너가 직접 요청한 취소는 파트너 본인이 철회할 방법이 없었다 —
 * 실수로 요청했거나 마음이 바뀌어도 매니저 심사 결과를 그냥 기다려야 했던 비대칭을
 * 해소한다. */
function retractPartnerCancellationRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'cancel_requested') return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order.cancelRequest || order.cancelRequest.requestedBy !== 'partner' || order.acceptedPartner !== partnerName) {
        showToast('고객이 요청한 취소는 파트너가 직접 철회할 수 없어요. 매니저 센터 심사를 기다려주세요.', 'warning');
        return;
    }
    order.status = 'contracted';
    order.cancelRequest = null;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CONTRACT_CANCEL_RETRACT', `[${partnerName}]가 계약(${order.code}) 취소 요청을 철회했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약 파트너사가 계약(${order.code}) 취소 요청을 철회했어요. 계약이 그대로 유지됩니다.`);
    showToast('취소 요청을 철회했습니다. 계약이 그대로 유지됩니다.', 'info');

    openPartnerOrderDetailModal(orderCode);
    renderPartnerOrderList();
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    if (typeof renderAdminContractCancellations === 'function') renderAdminContractCancellations();
}

/* 고객 쪽에 관리자 강제 취소 이의신청(openForceCancelAppealModal, client_panel.js)이
 * 생겼으니 파트너 쪽에도 대칭으로 필요하다. 두 파일 모두 window에 노출되므로
 * 이름이 겹치지 않도록 별도 함수명을 쓴다. */
let partnerForceCancelAppealTargetCode = null;

function openPartnerForceCancelAppealModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'cancelled' || !order.cancelRequest || order.cancelRequest.requestedBy !== 'admin' || order.acceptedPartner !== partnerName) return;
    if (order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    partnerForceCancelAppealTargetCode = orderCode;
    safeUpdateValue('partner-force-cancel-appeal-reason-input', '');
    openModal('partner-force-cancel-appeal-modal', 'partner-force-cancel-appeal-modal-card');
}

function closePartnerForceCancelAppealModal() {
    partnerForceCancelAppealTargetCode = null;
    closeModal('partner-force-cancel-appeal-modal', 'partner-force-cancel-appeal-modal-card');
}

function submitPartnerForceCancelAppeal() {
    const order = window.AppState.orders.find(o => o.code === partnerForceCancelAppealTargetCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || !order.cancelRequest) { closePartnerForceCancelAppealModal(); return; }
    const reason = document.getElementById('partner-force-cancel-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    order.cancelRequest.appeal = { reason, filedBy: 'partner', status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'FORCE_CANCEL_APPEAL', `[${partnerName}]가 계약(${order.code}) 강제 취소 조치에 대해 이의신청을 제출했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약 파트너사가 계약(${order.code}) 강제 취소에 대한 이의신청을 제출했어요.`);
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closePartnerForceCancelAppealModal();
    openPartnerOrderDetailModal(order.code);
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
        // 지금까지는 고객이 계약을 체결하려다 막혀야만(clientFinalizeContract) 파트너가
        // 자기 견적의 유효기간이 지난 걸 알 수 있었다 — 고객의 행동을 기다리지 않고
        // 입찰 심사중 목록에서 바로 확인하고 미리 재확인(editPartnerBid)할 수 있게 한다.
        const isMyBidExpired = statusKey === 'bidding' && myBid && typeof isBidExpired === 'function' && isBidExpired(myBid);
        const statusBadge = statusKey === 'contracted_mine' ? `<span class="badge badge-emerald">계약 체결</span>`
            : statusKey === 'contracted_other' ? `<span class="badge badge-neutral">타사 계약</span>`
            : statusKey === 'withdrawn' ? `<span class="badge badge-rose">고객 철회</span>`
            : statusKey === 'cancel_requested' ? `<span class="badge badge-amber">계약 취소 심사중</span>`
            : statusKey === 'cancelled' ? `<span class="badge badge-rose">계약 취소됨</span>`
            : `<span class="badge badge-amber">입찰 심사중</span>${isMyBidExpired ? ` <span class="badge badge-rose"><i data-lucide="clock" class="w-2.5 h-2.5"></i> 견적 만료</span>` : ''}`;
        // 이 목록에 뜨는 오더는 전부 우리가 이미 입찰에 참여한 건이므로(이미 안심 잠금해제 대상),
        // selectOrderForAudit()의 "입찰 참여 시 개인정보 잠금해제" 규칙과 동일하게 고객명을 가리지 않는다.
        const unreadCount = typeof getUnreadOrderMessageCount === 'function' ? getUnreadOrderMessageCount(o, 'partner') : 0;
        return `<tr class="cursor-pointer hover:bg-ink-50 transition-colors" onclick="openPartnerOrderDetailModal('${o.code}')"><td class="font-mono">${o.code}${unreadCount > 0 ? ` <span class="badge badge-rose"><i data-lucide="message-circle" class="w-2.5 h-2.5"></i> ${unreadCount}</span>` : ''}</td><td class="font-black text-ink-950">${o.clientName}</td><td>${o.pyung}평</td><td onclick="event.stopPropagation(); setPartnerContractsStatusFilter('${statusKey}')" class="cursor-pointer" title="이 상태만 필터링">${statusBadge}</td><td class="font-black text-ink-950">₩ ${(myBid ? myBid.price : 0).toLocaleString()}만</td><td><span class="btn btn-outline btn-sm">상세보기</span></td></tr>`;
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

/* 계약 체결 후 고객이 확인할 수 있는 건 서명·서류·수수료 결제 상태뿐이라, 실제
 * 시공이 지금 어느 단계인지는 전혀 알 방법이 없었다 — 일정/금액 변경 요청과
 * 하자보수는 있지만 "지금 뭐가 진행되고 있는지"에 대한 답이 없는 공백이었다.
 * 양측 서명이 완료된 계약에 한해 파트너가 철거→설비/골조→마감→준공 단계를
 * 순서대로 진행 표시하고, 고객은 읽기 전용으로 확인한다. */
function buildPartnerProgressStagesHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const stages = getOrInitProgressStages(order);
    const nextStage = stages.find(s => !s.done);
    const disputedStages = stages.filter(s => s.disputed);
    const disputeListHtml = disputedStages.length === 0 ? '' : `<div class="space-y-1">${disputedStages.map(s => {
        const statusText = s.disputeResolution === 'rejected' ? `이의제기 반려됨(완료 유지)${s.disputeAdminResponse ? ` — ${escapeHtml(s.disputeAdminResponse)}` : ''}`
            : s.disputeResolution === 'approved' ? '이의제기 승인됨(재작업 필요)'
                : '고객 이의제기 심사중';
        return `<p class="text-[10px] text-roseCustom font-bold">"${escapeHtml(s.label)}" 단계: ${statusText}</p>`;
    }).join('')}</div>`;
    return `<div class="surface p-5 space-y-3">
        <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="hard-hat" class="w-4 h-4 text-brand-500"></i> 시공 진행 단계</h5>
        ${renderPartnerContractProgressStepperHtml(stages)}
        ${disputeListHtml}
        ${nextStage
            ? `<button type="button" onclick="advanceOrderProgressStage('${order.code}')" class="btn btn-dark btn-sm btn-block">"${escapeHtml(nextStage.label)}" 단계 완료로 표시</button>`
            : `<p class="text-[11px] text-emeraldCustom font-bold text-center">모든 시공 단계가 완료되었습니다.</p>`}
    </div>`;
}

function advanceOrderProgressStage(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    const stages = getOrInitProgressStages(order);
    const stage = stages.find(s => !s.done);
    if (!stage) return;
    stage.done = true;
    stage.date = getLocalDateString();
    const allDone = stages.every(s => s.done);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PROGRESS_STAGE_ADVANCE', `[${partnerName}]가 오더(${order.code}) 시공 단계를 "${stage.label}" 완료로 표시했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, allDone ? `시공이 모두 완료되었습니다! (마지막 단계: ${stage.label})` : `시공 진행 단계가 업데이트됐어요: "${stage.label}" 완료`);
    showToast(`"${stage.label}" 단계를 완료로 표시했습니다.`, 'success');
    openPartnerOrderDetailModal(order.code);
}

/* 계약 체결 후 착공(progressStages) 전까지, 실제 인테리어 시공에서는 항상 있는
 * 실측(현장 방문 측정) 일정 조율 단계가 전혀 없었다 — 시공 범위·자재를 확정하기
 * 위한 필수 단계인데도 이 플랫폼에는 아예 존재하지 않았다. 결제 마일스톤과 동일한
 * 요청→확인/거절 핸드셰이크 패턴을 적용한다. */
/* 실측/하자보수 방문 일정은 각 오더 상세에 따로따로 흩어져 있어서, 계약 건이
 * 여러 개인 파트너는 "오늘/이번 주에 어디를 가야 하는지" 한눈에 볼 방법이
 * 전혀 없었고, 같은 날 방문 두 건이 겹쳐도 알아챌 방법이 없었다 — 모든 오더의
 * 확정/제안된 방문을 날짜순으로 모아 보여주고, 같은 날짜에 겹치면 경고한다. */
function getPartnerScheduledVisits(partnerName) {
    const entries = [];
    (window.AppState.orders || []).filter(o => o.acceptedPartner === partnerName).forEach(o => {
        const visit = o.siteVisit;
        if (visit && (visit.status === 'proposed' || visit.status === 'confirmed')) {
            const date = visit.status === 'confirmed' ? visit.confirmedDate : visit.proposedDate;
            if (date) entries.push({ date, status: visit.status, orderCode: o.code, label: `${o.clientName} 고객님 · 실측 방문` });
        }
        (o.repairClaims || []).forEach(c => {
            if ((c.visitStatus === 'proposed' || c.visitStatus === 'confirmed') && c.visitDate) {
                entries.push({ date: c.visitDate, status: c.visitStatus, orderCode: o.code, label: `${o.clientName} 고객님 · 하자보수(${c.title}) 방문` });
            }
        });
    });
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
}

function renderPartnerScheduleView() {
    const container = document.getElementById('partner-mode-schedule-view');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const entries = getPartnerScheduledVisits(partnerName);

    const blockedDatesHtml = `
        <div class="surface surface-lg p-6 sm:p-8 space-y-4 text-left">
            <h3 class="text-base font-black text-ink-950 tracking-tight flex items-center gap-2"><i data-lucide="calendar-x" class="w-4 h-4 text-roseCustom"></i> 휴무일 관리</h3>
            <p class="text-[11px] text-ink-500 font-medium">연차·경조사 등으로 실측·하자보수 방문을 잡을 수 없는 날짜를 미리 등록해두면, 방문 일정을 제안할 때 착오로 겹치지 않게 알려드려요.</p>
            <div id="partner-blocked-dates-list" class="space-y-2"></div>
            <div class="flex flex-wrap gap-2">
                <input type="date" id="partner-blocked-date-input" class="input w-auto">
                <input type="text" id="partner-blocked-date-reason-input" placeholder="사유 (선택)" class="input flex-1 min-w-[120px]">
                <button type="button" onclick="addPartnerBlockedDate()" class="btn btn-secondary btn-sm shrink-0"><i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> 휴무일 등록</button>
            </div>
        </div>`;

    if (entries.length === 0) {
        container.innerHTML = blockedDatesHtml + `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--brand-50);color:var(--brand-600)"><i data-lucide="calendar" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">예정된 방문 일정이 없습니다.</p></div>`;
        renderPartnerBlockedDatesList();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const byDate = {};
    entries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });

    container.innerHTML = `
        <div class="surface surface-lg p-6 sm:p-8 space-y-5 text-left">
            <h3 class="text-base font-black text-ink-950 tracking-tight flex items-center gap-2"><i data-lucide="calendar-days" class="w-4 h-4 text-brand-500"></i> 방문 일정 (${entries.length}건)</h3>
            <div class="space-y-3">
                ${Object.keys(byDate).sort().map(date => {
                    const dayEntries = byDate[date];
                    const hasConflict = dayEntries.length > 1;
                    const isBlocked = isPartnerDateBlocked(partnerName, date);
                    return `<div class="p-4 rounded-2xl border ${hasConflict || isBlocked ? 'border-rose-200 bg-rose-50/40' : 'border-ink-100 bg-ink-50/70'} space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-ink-950">${date}</span>
                            <div class="flex items-center gap-1.5">
                                ${isBlocked ? `<span class="badge badge-rose"><i data-lucide="calendar-x" class="w-2.5 h-2.5"></i> 휴무일 등록됨</span>` : ''}
                                ${hasConflict ? `<span class="badge badge-rose"><i data-lucide="alert-triangle" class="w-2.5 h-2.5"></i> 같은 날 방문 ${dayEntries.length}건</span>` : ''}
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            ${dayEntries.map(e => `
                            <div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-xl border border-ink-100 cursor-pointer hover:border-ink-300" onclick="openPartnerOrderDetailModal('${e.orderCode}')">
                                <span class="text-[11px] font-bold text-ink-700">${escapeHtml(e.label)} <span class="text-ink-400 font-mono">${e.orderCode}</span></span>
                                <span class="badge ${e.status === 'confirmed' ? 'badge-emerald' : 'badge-amber'}">${e.status === 'confirmed' ? '확정' : '제안중'}</span>
                            </div>`).join('')}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>` + blockedDatesHtml;
    renderPartnerBlockedDatesList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 파트너는 매칭 자체를 통째로 멈추는 전체 일시중단(isPaused)만 가능할 뿐,
 * 특정 날짜(휴무일·선약·연차)만 콕 집어 막아둘 방법이 없었다 — 방문 일정 통합
 * 뷰(getPartnerScheduledVisits)와 동일한 "같은 날 겹침 경고" 패턴으로, 스스로
 * 등록한 휴무일에 실측/하자보수 방문을 잡으려 할 때도 미리 알려준다. */
function isPartnerDateBlocked(partnerName, date) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    return !!(partner && partner.blockedDates && partner.blockedDates.some(b => b.date === date));
}

function addPartnerBlockedDate() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const date = document.getElementById('partner-blocked-date-input')?.value;
    const reason = document.getElementById('partner-blocked-date-reason-input')?.value.trim();
    if (!date) { showToast('휴무일로 등록할 날짜를 선택해 주세요.', 'warning'); return; }
    if (!partner.blockedDates) partner.blockedDates = [];
    if (partner.blockedDates.some(b => b.date === date)) { showToast('이미 등록된 휴무일입니다.', 'info'); return; }

    partner.blockedDates.push({ date, reason: reason || '' });
    partner.blockedDates.sort((a, b) => a.date.localeCompare(b.date));
    if (typeof pushLog === 'function') pushLog('PARTNER', 'BLOCKED_DATE_ADD', `[${partnerName}]가 휴무일(${date})을 등록했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'INFO');
    showToast(`휴무일(${date})을 등록했습니다.`, 'success');
    safeUpdateValue('partner-blocked-date-input', '');
    safeUpdateValue('partner-blocked-date-reason-input', '');
    renderPartnerBlockedDatesList();
}

function removePartnerBlockedDate(date) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.blockedDates) return;
    const idx = partner.blockedDates.findIndex(b => b.date === date);
    if (idx === -1) return;
    partner.blockedDates.splice(idx, 1);
    if (typeof pushLog === 'function') pushLog('PARTNER', 'BLOCKED_DATE_REMOVE', `[${partnerName}]가 휴무일(${date}) 등록을 해제했습니다.`, 'INFO');
    showToast(`휴무일(${date}) 등록을 해제했습니다.`, 'info');
    renderPartnerBlockedDatesList();
}

function renderPartnerBlockedDatesList() {
    const container = document.getElementById('partner-blocked-dates-list');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const blockedDates = (partner && partner.blockedDates) || [];

    if (blockedDates.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-bold text-center py-3">등록된 휴무일이 없습니다.</p>`;
        return;
    }
    container.innerHTML = blockedDates.map(b => `
        <div class="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
            <span class="text-xs font-bold text-ink-800">${b.date}${b.reason ? ` <span class="text-ink-400 font-medium">· ${escapeHtml(b.reason)}</span>` : ''}</span>
            <button type="button" onclick="removePartnerBlockedDate('${b.date}')" class="text-[11px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
        </div>`).join('');
}

let siteVisitTargetCode = null;

function openSiteVisitModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    if (order.siteVisit && order.siteVisit.status === 'proposed') { showToast('이미 고객 확인을 기다리는 실측 일정이 있어요.', 'warning'); return; }
    if (order.siteVisit && order.siteVisit.status === 'completed') { showToast('이미 완료 처리된 실측 방문이에요.', 'info'); return; }
    siteVisitTargetCode = orderCode;
    safeUpdateValue('site-visit-date-input', '');
    safeUpdateValue('site-visit-note-input', '');
    openModal('site-visit-modal', 'site-visit-modal-card');
}

function closeSiteVisitModal() {
    siteVisitTargetCode = null;
    closeModal('site-visit-modal', 'site-visit-modal-card');
}

function submitSiteVisitProposal() {
    const order = window.AppState.orders.find(o => o.code === siteVisitTargetCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order) { closeSiteVisitModal(); return; }
    const date = document.getElementById('site-visit-date-input')?.value;
    const note = document.getElementById('site-visit-note-input')?.value.trim();
    if (!date) { showToast('실측 방문 희망일을 선택해주세요.', 'warning'); return; }

    // 방문 일정 통합 뷰(renderPartnerScheduleView)를 보지 않는 이상, 이미 다른 오더에
    // 같은 날 방문이 잡혀있어도 파트너가 모른 채 겹쳐서 잡을 수 있었다 — 막지는
    // 않되(고객 사정상 그 날짜가 최선일 수 있으므로), 제안 시점에 미리 알려준다.
    const conflictingVisit = getPartnerScheduledVisits(partnerName).find(v => v.date === date && v.orderCode !== order.code);
    const isBlockedDate = isPartnerDateBlocked(partnerName, date);

    // 이미 확정된 일정을 뒤엎고 새로 제안하는 경우("일정 변경")와, 처음/재거절 후
    // 새로 제안하는 경우를 구분해서 알림 문구를 다르게 준다 — 고객 입장에서 "확정된
    // 일정이 갑자기 바뀌었다"는 사실을 명확히 알아야 하기 때문.
    const isReschedule = order.siteVisit && order.siteVisit.status === 'confirmed';
    order.siteVisit = { status: 'proposed', proposedDate: date, note, confirmedDate: null, completedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'SITE_VISIT_PROPOSE', `[${partnerName}]가 오더(${order.code}) 실측 방문 일정을 ${isReschedule ? '변경 제안' : '제안'}했습니다: ${date}`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, isReschedule
        ? `${partnerName}가 확정된 실측 방문 일정을 ${date}로 변경 제안했어요. 다시 확인해 주세요.${note ? ` (${note})` : ''}`
        : `${partnerName}가 실측 방문 일정을 제안했어요: ${date}${note ? ` (${note})` : ''}`);
    showToast(isReschedule ? '실측 방문 일정 변경을 제안했습니다. 고객 재확인을 기다려주세요.' : '실측 방문 일정을 제안했습니다. 고객 확인을 기다려주세요.', 'success');
    if (conflictingVisit) showToast(`이 날짜(${date})에 이미 다른 방문 일정이 있어요: ${conflictingVisit.label} (${conflictingVisit.orderCode})`, 'warning');
    if (isBlockedDate) showToast(`이 날짜(${date})는 직접 등록한 휴무일이에요. 착오가 아닌지 확인해 주세요.`, 'warning');

    closeSiteVisitModal();
    openPartnerOrderDetailModal(order.code);
}

/* 실측 방문이 확정(confirmed)되면 그 다음부터는 아무 조치도 취할 수 없어서 —
 * 실제로 방문을 다녀왔어도 그 사실을 기록할 방법이 없이 상태가 영구히
 * "확정됨"에 멈춰 있었다. 파트너가 완료 처리로 마무리할 수 있게 한다. */
function completeSiteVisit(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    if (!order.siteVisit || order.siteVisit.status !== 'confirmed') return;
    order.siteVisit.status = 'completed';
    order.siteVisit.completedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('PARTNER', 'SITE_VISIT_COMPLETE', `[${partnerName}]가 오더(${order.code}) 실측 방문을 완료 처리했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `실측 방문이 완료 처리되었습니다.`);
    showToast('실측 방문을 완료 처리했습니다.', 'success');
    openPartnerOrderDetailModal(order.code);
}

function buildPartnerSiteVisitHtml(order) {
    if (order.status !== 'contracted') return '';
    const visit = order.siteVisit;
    let statusHtml = '';
    if (visit && visit.status === 'proposed') {
        statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">고객 확인 대기중: ${visit.proposedDate}${visit.note ? ` (${escapeHtml(visit.note)})` : ''}</p>`;
    } else if (visit && visit.status === 'confirmed') {
        statusHtml = `<div class="mt-1 space-y-1.5"><p class="text-[10px] font-black text-emeraldCustom">확정됨: ${visit.confirmedDate}</p><div class="flex items-center gap-2"><button type="button" onclick="completeSiteVisit('${order.code}')" class="btn btn-dark btn-sm">방문 완료 처리</button><button type="button" onclick="downloadVisitCalendarFile('${escapeHtml(order.clientName)} 고객 실측 방문 (${order.code})', '${escapeHtml(order.clientAddress)}', '${visit.confirmedDate}')" class="text-[9px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0"><i data-lucide="calendar-plus" class="w-3 h-3 inline"></i> 캘린더에 추가</button></div></div>`;
    } else if (visit && visit.status === 'completed') {
        const disputeNote = !visit.disputed ? '' : (visit.disputeResolution === 'rejected'
            ? `<p class="text-[9px] font-bold text-ink-400 mt-0.5">고객 이의제기 반려됨(완료 유지)${visit.disputeAdminResponse ? ` — ${escapeHtml(visit.disputeAdminResponse)}` : ''}</p>`
            : `<p class="text-[9px] font-black text-roseCustom mt-0.5">고객 이의제기 심사중</p>`);
        statusHtml = `<p class="text-[10px] font-black text-ink-500 mt-1">실측 완료됨: ${visit.completedDate}</p>${disputeNote}`;
    } else if (visit && visit.status === 'declined') {
        statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">고객이 거절했어요${visit.declineReason ? ` — ${escapeHtml(visit.declineReason)}` : ''}. 새 일정을 다시 제안해주세요.</p>`;
    }
    const showBtn = !visit || visit.status === 'none' || visit.status === 'declined' || visit.status === 'confirmed';
    const btnLabel = visit && visit.status === 'confirmed' ? '일정 변경 제안' : '일정 제안하기';
    return `<div class="surface p-5 space-y-2">
        <div class="flex items-center justify-between">
            <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="ruler" class="w-4 h-4 text-brand-500"></i> 실측 방문 일정</h5>
            ${showBtn ? `<button type="button" onclick="openSiteVisitModal('${order.code}')" class="btn btn-secondary btn-sm">${btnLabel}</button>` : ''}
        </div>
        ${statusHtml || `<p class="text-[10px] text-ink-400 font-semibold">아직 제안한 실측 일정이 없습니다.</p>`}
    </div>`;
}

/* commissionPaid는 플랫폼 중개 수수료 완납 여부만 표시할 뿐, 정작 고객이 파트너에게
 * 지불하는 공사대금 자체는 finalPrice 총액 하나로만 다뤄졌다 — 실제 인테리어
 * 계약은 계약금/중도금/잔금으로 나눠 단계별로 청구·지급되는데 그 흐름을 추적할
 * 방법이 전혀 없었다. 시공 진행 단계와 자연스럽게 짝을 이루는 지급 마일스톤을 둔다. */
function buildPartnerPaymentMilestonesHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const milestones = typeof sweepOverduePaymentMilestones === 'function' ? sweepOverduePaymentMilestones(order) : getOrInitPaymentMilestones(order);
    if (typeof sweepMilestoneDueSoonReminders === 'function') sweepMilestoneDueSoonReminders(order);
    const price = order.finalPrice || 0;
    return `<div class="surface p-5 space-y-3">
        <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="wallet" class="w-4 h-4 text-brand-500"></i> 단계별 공사대금 청구</h5>
        <div class="space-y-2">${milestones.map(m => {
            const amount = typeof getMilestoneAmount === 'function' ? getMilestoneAmount(m, price) : Math.floor(price * m.percent / 100);
            const overdue = typeof isMilestoneOverdue === 'function' && isMilestoneOverdue(m);
            const statusBadge = m.status === 'paid' ? `<span class="badge badge-emerald">납부완료</span>` : m.status === 'payment_disputed' ? `<span class="badge badge-rose">미입금 이의제기중</span>` : m.status === 'disputed' ? `<span class="badge badge-rose">이의제기중</span>` : overdue ? `<span class="badge badge-rose">연체</span>` : m.status === 'requested' ? `<span class="badge badge-amber">청구중</span>` : `<span class="badge badge-neutral">청구 전</span>`;
            return `<div class="p-3 bg-ink-50 rounded-xl flex items-center justify-between gap-2">
                <div class="text-left min-w-0">
                    <p class="text-xs font-black text-ink-900">${m.label} ${typeof m.fixedAmount === 'number' ? '' : `(${m.percent}%)`}</p>
                    <p class="text-[10px] ${overdue ? 'text-roseCustom font-bold' : 'text-ink-500 font-semibold'}">₩ ${amount.toLocaleString()}만원${m.paidDate ? ` · 납부일 ${m.paidDate}` : (m.dueDate ? ` · 납부기한 ${m.dueDate}${overdue ? ' (기한 초과)' : ''}` : '')}</p>
                    ${m.status === 'disputed' ? `<p class="text-[10px] text-roseCustom font-bold">고객 이의제기: ${escapeHtml(m.disputeReason || '')}</p>` : ''}
                    ${m.status === 'payment_disputed' ? `<p class="text-[10px] text-roseCustom font-bold">미입금 이의제기: ${escapeHtml(m.paymentDisputeReason || '')}</p>` : ''}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${statusBadge}
                    ${m.status === 'pending' ? `<button type="button" onclick="requestPaymentMilestone('${order.code}', '${m.key}')" class="btn btn-secondary btn-sm">청구하기</button>` : ''}
                    ${m.status === 'paid' ? `<button type="button" onclick="openReportReasonPrompt((reason) => disputeMilestonePaymentReceipt('${order.code}', '${m.key}', reason))" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">이 납부, 실제로 못 받았어요</button>` : ''}
                </div>
            </div>`;
        }).join('')}</div>
    </div>`;
}

function requestPaymentMilestone(orderCode, key) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    const milestones = getOrInitPaymentMilestones(order);
    const m = milestones.find(x => x.key === key);
    if (!m || m.status !== 'pending') return;
    m.status = 'requested';
    m.requestedDate = getLocalDateString();
    const due = new Date();
    due.setDate(due.getDate() + 7);
    m.dueDate = due.toISOString().slice(0, 10);
    m.overdueNotified = false;
    m.dueSoonNotified = false;
    const amount = typeof getMilestoneAmount === 'function' ? getMilestoneAmount(m, order.finalPrice) : Math.floor((order.finalPrice || 0) * m.percent / 100);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PAYMENT_MILESTONE_REQUEST', `[${partnerName}]가 오더(${order.code}) ${m.label} 청구를 요청했습니다. (₩${amount.toLocaleString()}만원, 납부기한 ${m.dueDate})`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${m.label} 납부를 요청드려요: ₩${amount.toLocaleString()}만원 (납부기한 ${m.dueDate})`);
    showToast(`${m.label} 청구를 요청했습니다.`, 'success');
    openPartnerOrderDetailModal(order.code);
}

/* 시공 진행 단계 완료(disputeProgressStage), 실측 방문 완료(disputeSiteVisitCompletion),
 * 하자보수 방문 완료(disputeRepairVisitCompletion) 등 "한쪽이 단독으로 완료 처리하면
 * 반대쪽이 이의제기할 수 있다"는 대칭 구조가 이 앱 전체에 일관되게 있는데, 정작
 * 고객이 confirmPaymentMilestone으로 "납부 완료"를 단독 처리하는 마일스톤 결제에는
 * 그 대칭이 빠져 있었다 — 실제 입금 없이 완료 처리된 경우 파트너가 이의를 제기할
 * 수 있게 한다. */
function disputeMilestonePaymentReceipt(orderCode, key, reason) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.acceptedPartner !== partnerName) return;
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'paid') return;
    m.status = 'payment_disputed';
    m.paymentDisputeReason = reason;
    m.paymentDisputeDate = getLocalDateString();
    m.paymentDisputeResolution = null;
    m.paymentDisputeAdminResponse = null;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PAYMENT_MILESTONE_RECEIPT_DISPUTE', `[${partnerName}]가 오더(${order.code}) ${m.label} 납부완료 처리에 미입금 이의를 제기했습니다: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${m.label} 납부완료 처리에 파트너가 이의를 제기했어요. 매니저 센터가 검토 중입니다.`);
    showToast('매니저 센터에 이의제기를 접수했습니다.', 'success');
    openPartnerOrderDetailModal(order.code);
}

/* 계약금/중도금/잔금(PAYMENT_MILESTONE_DEFS)은 계약 시점에 고정되는 3단계뿐이라,
 * 실제 인테리어 현장에서 흔한 "공사 중 구조 변경/자재 업그레이드로 추가 비용
 * 발생" 상황을 반영할 방법이 없었다 — 고객 동의를 받는 변경계약(추가공사) 제안을
 * 두고, 수락되면 기존 마일스톤과 같은 방식(getMilestoneAmount의 fixedAmount)으로
 * 새 청구 항목이 자동 생성된다(client_panel.js의 respondChangeOrder가 처리). */
let changeOrderTargetCode = null;

function openChangeOrderModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    changeOrderTargetCode = orderCode;
    safeUpdateValue('change-order-desc-input', '');
    safeUpdateValue('change-order-amount-input', '');
    openModal('change-order-modal', 'change-order-modal-card');
}

function closeChangeOrderModal() {
    changeOrderTargetCode = null;
    closeModal('change-order-modal', 'change-order-modal-card');
}

function submitChangeOrder() {
    const order = window.AppState.orders.find(o => o.code === changeOrderTargetCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order) { closeChangeOrderModal(); return; }
    const description = document.getElementById('change-order-desc-input')?.value.trim();
    const extraAmount = parseInt(document.getElementById('change-order-amount-input')?.value, 10);
    if (!description) { showToast('추가 공사 내용을 입력해주세요.', 'warning'); return; }
    if (!extraAmount || extraAmount <= 0) { showToast('추가 금액을 올바르게 입력해주세요.', 'warning'); return; }

    if (!order.changeOrders) order.changeOrders = [];
    const entry = { id: `co-${Date.now()}-${Math.floor(Math.random() * 1000)}`, description, extraAmount, status: 'pending', proposedDate: getLocalDateString(), resolvedDate: null };
    order.changeOrders.unshift(entry);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CHANGE_ORDER_PROPOSE', `[${partnerName}]가 오더(${order.code}) 추가공사 변경계약을 제안했습니다: ${description} (+₩${extraAmount.toLocaleString()}만원)`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 추가공사를 제안했어요: "${description}" (+₩${extraAmount.toLocaleString()}만원)`);
    showToast('추가공사 변경계약을 제안했습니다. 고객 동의를 기다려주세요.', 'success');

    closeChangeOrderModal();
    openPartnerOrderDetailModal(order.code);
}

function buildPartnerChangeOrdersHtml(order) {
    if (order.status !== 'contracted') return '';
    const entries = order.changeOrders || [];
    const statusMeta = { pending: { label: '고객 동의 대기중', cls: 'badge-amber' }, accepted: { label: '수락됨', cls: 'badge-emerald' }, rejected: { label: '거절됨', cls: 'badge-neutral' } };
    const listHtml = entries.length === 0 ? `<p class="text-[10px] text-ink-400 font-semibold">등록된 추가공사 요청이 없습니다.</p>` : entries.map(e => {
        const meta = statusMeta[e.status] || statusMeta.pending;
        return `<div class="p-2.5 bg-ink-50 rounded-lg space-y-0.5">
            <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-900">${escapeHtml(e.description)}</span><span class="badge ${meta.cls}">${meta.label}</span></div>
            <p class="text-[10px] text-ink-500 font-semibold">추가 금액 +₩${e.extraAmount.toLocaleString()}만원 · 제안일 ${e.proposedDate}</p>
        </div>`;
    }).join('');
    return `<div class="surface p-5 space-y-2">
        <div class="flex items-center justify-between">
            <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-plus-2" class="w-4 h-4 text-brand-500"></i> 추가공사 변경계약</h5>
            <button type="button" onclick="openChangeOrderModal('${order.code}')" class="btn btn-secondary btn-sm">제안하기</button>
        </div>
        <div class="space-y-1.5">${listHtml}</div>
    </div>`;
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
                </div>
                <button type="button" onclick="downloadPartnerSettlementReceipt('${order.code}')" class="btn btn-secondary btn-sm btn-block"><i data-lucide="receipt" class="w-3.5 h-3.5"></i> 정산 확인서 다운로드</button>`;
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
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="pen-tool" class="w-4 h-4 text-ink-600"></i> 계약 합의서 서명</h5>
                ${order.partnerSigned
                    ? `<div class="p-3.5 surface-flat flex items-center justify-between"><span class="text-[11px] font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="pen-tool" class="w-3.5 h-3.5 text-emeraldCustom"></i> 파트너사 서명 완료</span><span class="text-[10px] text-ink-400 font-bold">${order.partnerSignedDate}</span></div>`
                    : `<div class="space-y-2 text-left">
                        <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">아래 서명란에 마우스나 터치로 서명해 주세요.</p>
                        <canvas id="partner-signature-canvas-${order.code}" width="400" height="140" class="w-full rounded-xl border border-dashed border-ink-200 bg-white" style="touch-action:none; cursor:crosshair;"></canvas>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="clearPartnerSignatureCanvas('${order.code}')" class="btn btn-secondary btn-sm flex-1">지우기</button>
                            <button type="button" onclick="submitPartnerSignatureCanvas('${order.code}')" class="btn btn-dark btn-sm flex-1">서명 완료</button>
                        </div>
                    </div>`}
                <div class="p-3 bg-ink-50 rounded-xl flex items-center justify-between">
                    <span class="text-[11px] font-bold text-ink-600 flex items-center gap-1.5"><i data-lucide="pen-tool" class="w-3.5 h-3.5 ${order.clientSigned ? 'text-emeraldCustom' : 'text-ink-300'}"></i> 고객 서명</span>
                    <span class="badge ${order.clientSigned ? 'badge-emerald' : 'badge-amber'}">${order.clientSigned ? '완료' : '대기중'}</span>
                </div>
                ${order.clientSigned && order.partnerSigned ? `<div class="p-2.5 text-center"><span class="badge badge-brand"><i data-lucide="shield-check" class="w-3 h-3"></i> 양측 서명 완료 — 계약 합의서 최종 확정</span></div>` : ''}
            </div>
            ${buildPartnerSiteVisitHtml(order)}
            ${buildPartnerProgressStagesHtml(order)}
            ${buildPartnerPaymentMilestonesHtml(order)}
            ${buildPartnerChangeOrdersHtml(order)}
            <div class="surface p-5 space-y-3">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="credit-card" class="w-4 h-4 text-ink-600"></i> 플랫폼 중개 수수료 결제</h5>
                ${commissionBodyHtml}
            </div>
            ${buildPartnerScheduleChangeHtml(order)}
            ${buildPartnerPriceChangeHtml(order)}
            <div class="surface p-5 space-y-2">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="ban" class="w-4 h-4 text-roseCustom"></i> 계약 취소 요청</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">시공이 불가능하거나 고객과의 분쟁으로 계약을 유지할 수 없는 경우, 매니저 센터 심사를 거쳐 계약을 취소할 수 있어요.</p>
                <button type="button" onclick="openPartnerCancelRequestModal('${order.code}')" class="btn btn-secondary btn-sm text-roseCustom">계약 취소 요청하기</button>
            </div>
            ${!order.reviewWritten ? `
            <div class="surface p-5 space-y-2">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="star" class="w-4 h-4 text-gold-500"></i> 후기 작성 요청</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">시공이 마무리됐다면 고객님께 안심 후기 작성을 부탁드려보세요. 평점은 파트너 신뢰도에 반영됩니다.</p>
                <button type="button" onclick="requestReviewFromClient('${order.code}')" class="btn btn-secondary btn-sm" ${order.lastReviewReminderDate === getLocalDateString() ? 'disabled' : ''}>${order.lastReviewReminderDate === getLocalDateString() ? '오늘 요청 완료' : '후기 작성 요청 보내기'}</button>
            </div>` : ''}
            ${buildPartnerRepairClaimsHtml(order)}
            ${typeof buildOrderMessageThreadHtml === 'function' ? buildOrderMessageThreadHtml(order, 'partner') : ''}
            <div class="surface p-5 space-y-2">
                <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="flag" class="w-4 h-4 text-roseCustom"></i> 고객 신고</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">노쇼, 상습 갑질 등 불량 고객은 매니저 센터에 신고할 수 있어요.</p>
                ${isOrderReportedByMe(order.code)
                    ? `<div class="flex items-center gap-2"><span class="badge badge-neutral">신고 접수 완료</span><button type="button" onclick="retractClientReport('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">철회</button></div>`
                    : `<button type="button" onclick="openReportClientModal('${order.code}')" class="btn btn-secondary btn-sm text-roseCustom">고객 신고하기</button>`}
            </div>
            ${buildPartnerClientRatingHtml(order)}`;
    } else {
        const isPartnerOwnCancelRequest = order.status === 'cancel_requested' && order.cancelRequest && order.cancelRequest.requestedBy === 'partner' && order.acceptedPartner === partnerName;
        actionSectionHtml = `
            <div class="p-4 surface-flat text-left space-y-1">
                <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="lock" class="w-4 h-4 text-ink-500"></i> 계약서·견적서 업로드 및 수수료 결제는 계약 확정 후 가능합니다</h5>
                <p class="text-[10px] text-ink-500 font-semibold leading-relaxed">${order.status === 'contracted' ? '이 오더는 다른 파트너사와 계약이 체결되었습니다.' : order.status === 'withdrawn' ? '고객이 이 의뢰를 철회하여 더 이상 진행되지 않습니다.' : order.status === 'cancel_requested' ? (isPartnerOwnCancelRequest ? '귀사가 요청한 계약 취소를 매니저 센터에서 심사 중입니다. 심사가 끝날 때까지 계약 관련 절차가 일시 중단됩니다.' : '고객이 계약 취소를 요청하여 매니저 센터에서 심사 중입니다. 심사가 끝날 때까지 계약 관련 절차가 일시 중단됩니다.') : order.status === 'cancelled' ? '이 계약은 취소 승인되어 더 이상 유효하지 않습니다.' : '고객이 최종 파트너사를 확정하면 이 오더의 계약서·견적서 업로드와 수수료 결제 기능이 열립니다.'}</p>
                ${isPartnerOwnCancelRequest ? `<button type="button" onclick="retractPartnerCancellationRequest('${order.code}')" class="btn btn-secondary btn-sm mt-1">취소 요청 철회하기</button>` : ''}
                ${(order.status === 'cancelled' && order.cancelRequest && order.cancelRequest.requestedBy === 'admin' && order.acceptedPartner === partnerName) ? (
                    order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'pending'
                        ? `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`
                        : order.cancelRequest.appeal && order.cancelRequest.appeal.status === 'rejected'
                            ? `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${order.cancelRequest.appeal.adminResponse ? ` — ${escapeHtml(order.cancelRequest.appeal.adminResponse)}` : ''}</p>`
                            : `<button type="button" onclick="openPartnerForceCancelAppealModal('${order.code}')" class="btn btn-secondary btn-sm mt-1">강제 취소에 이의신청하기</button>`
                ) : ''}
            </div>
            ${myBid && myBid.questions && myBid.questions.length > 0 ? `
            <div class="p-4 surface-flat text-left space-y-2.5">
                <h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="message-circle-question" class="w-4 h-4 text-brand-500"></i> 고객 계약 전 문의</h5>
                <div class="space-y-2">${myBid.questions.map((q, qIdx) => `
                    <div class="p-3 bg-ink-50 rounded-xl space-y-1.5">
                        <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(q.text)} <span class="text-[10px] text-ink-400 font-bold">(${q.date})</span></p>
                        ${q.reply
                            ? `<p class="text-xs text-brand-700 font-semibold leading-relaxed pl-3 border-l-2 border-brand-200">${escapeHtml(q.reply)}</p>`
                            : `<div class="flex gap-1.5"><input type="text" id="bid-question-reply-input-${order.code}-${qIdx}" placeholder="답변을 입력하세요" class="input flex-1 text-xs"><button type="button" onclick="replyToBidQuestion('${order.code}', ${qIdx})" class="btn btn-dark btn-sm shrink-0">답변</button></div>`}
                    </div>`).join('')}</div>
            </div>` : ''}
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
                    <h3 class="text-base sm:text-lg font-black text-ink-950 tracking-tight flex items-center gap-1.5">${escapeHtml(order.clientName)} 고객님 (${order.clientPhone}) ${typeof buildClientTierBadgeHtml === 'function' ? buildClientTierBadgeHtml(order.clientPhone) : ''}
                        <button type="button" onclick="toggleFavoriteClient('${escapeHtml(order.clientPhone)}', '${escapeHtml(order.clientName)}', '${order.code}')" class="btn btn-ghost btn-sm px-1.5" aria-label="단골 고객으로 저장"><i data-lucide="star" class="w-4 h-4 ${isClientFavorited(order.clientPhone) ? 'text-gold-500' : 'text-ink-300'}" ${isClientFavorited(order.clientPhone) ? 'fill="currentColor"' : ''}></i></button>
                        <button type="button" onclick="togglePartnerBlockClient('${escapeHtml(order.clientPhone)}', '${escapeHtml(order.clientName)}', '${order.code}')" class="btn btn-ghost btn-sm px-1.5" aria-label="고객 차단"><i data-lucide="user-x" class="w-4 h-4 ${isClientBlockedByPartner(order.clientPhone) ? 'text-roseCustom' : 'text-ink-300'}"></i></button>
                    </h3>
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
    if (isContracted && !order.partnerSigned) initPartnerSignatureCanvas(order.code);
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
    const rejection = order.docRejections && order.docRejections[docType];
    if (rejection) {
        const appeal = rejection.appeal;
        let appealHtml;
        if (appeal && appeal.status === 'pending') {
            appealHtml = `<p class="text-[10px] font-black text-amberCustom">이의신청 심사 대기중</p>`;
        } else if (appeal && appeal.status === 'rejected') {
            appealHtml = `<p class="text-[10px] font-bold text-ink-400 leading-relaxed">이의신청 반려됨${appeal.adminResponse ? ` — ${escapeHtml(appeal.adminResponse)}` : ''}</p>`;
        } else {
            appealHtml = `<button type="button" onclick="openReportReasonPrompt((reason) => appealPartnerDocRejection('${order.code}', '${docType}', reason))" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">이의신청하기</button>`;
        }
        return `
        <div class="p-3.5 surface-flat space-y-2 text-left">
            <div class="flex items-center justify-between"><span class="text-[11px] font-black text-ink-950">${label}</span><span class="badge badge-rose">반려됨</span></div>
            <p class="text-[10px] text-roseCustom font-bold leading-relaxed">반려 사유: ${escapeHtml(rejection.reason)}</p>
            ${appealHtml}
            <button type="button" onclick="triggerPartnerDocUpload('${docType}')" class="btn btn-dark btn-sm btn-block">${label} 다시 업로드하기</button>
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
let adminLogCategoryFilter = 'all';

function setAdminLogCategoryFilter(key) {
    adminLogCategoryFilter = key;
    syncAuditLogs();
}

/* 로그가 쌓일수록 "매니저 조치만", "고객 활동만" 같은 걸 눈으로 하나씩 찾기
 * 번거로워진다 — 파트너 모니터링/고객 문의 탭과 동일한 상태 필터 칩 + 텍스트
 * 검색 패턴을 그대로 적용한다. */
function syncAuditLogs() {
    const tbody = document.getElementById('admin-log-tbody');
    if (!tbody) return;
    const allLogs = (window.AppState && window.AppState.logs) ? window.AppState.logs : [];

    const tabsEl = document.getElementById('admin-log-category-tabs');
    if (tabsEl) {
        const categories = Array.from(new Set(allLogs.map(l => l.category)));
        const tabs = [['all', '전체', allLogs.length], ...categories.map(c => [c, c, allLogs.filter(l => l.category === c).length])];
        tabsEl.innerHTML = tabs.map(([key, label, count]) =>
            `<button type="button" onclick="setAdminLogCategoryFilter('${key}')" class="gnb-tab ${adminLogCategoryFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    if (allLogs.length === 0) { tbody.innerHTML = `<tr><td class="px-6 py-8 text-center text-ink-400 font-bold" colspan="5">기록된 로그가 없습니다.</td></tr>`; return; }

    const query = (document.getElementById('admin-log-search-input')?.value || '').trim().toLowerCase();
    const logs = allLogs
        .filter(l => adminLogCategoryFilter === 'all' || l.category === adminLogCategoryFilter)
        .filter(l => !query || (l.target || '').toLowerCase().includes(query) || (l.message || '').toLowerCase().includes(query));

    if (logs.length === 0) { tbody.innerHTML = `<tr><td class="px-6 py-8 text-center text-ink-400 font-bold" colspan="5">검색 조건에 해당되는 로그가 없습니다.</td></tr>`; return; }
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

/* GMV/에스크로/수수료는 상단 KPI 바에 항상 떠 있지만, 그 외의 플랫폼 전체 현황
 * (파트너 상태 분포, 계약 전환율, 계약 체결 상위 파트너 등)은 관리자가 한눈에
 * 볼 방법이 전혀 없었다 — 있는 지표는 전부 openPartnerMetricsModal처럼 파트너
 * 한 곳 단위였다. 플랫폼 전체를 집계하는 대시보드 탭을 새로 둔다. */
function renderAdminDashboard() {
    const container = document.getElementById('admin-dashboard-content');
    if (!container) return;

    const orders = window.AppState.orders || [];
    const partners = window.AppState.partners || [];
    const clients = (window.AppState.clientAccounts || []).filter(a => !a.managerRole);

    const contractedOrders = orders.filter(o => o.status === 'contracted');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    const biddingOrders = orders.filter(o => o.status === 'bidding');
    const withdrawnCount = orders.filter(o => o.status === 'withdrawn').length;
    const totalNonWithdrawn = orders.length - withdrawnCount;
    const contractRate = totalNonWithdrawn > 0 ? Math.round((contractedOrders.length / totalNonWithdrawn) * 1000) / 10 : 0;
    const avgOrderValue = contractedOrders.length > 0 ? Math.floor(contractedOrders.reduce((acc, o) => acc + (o.finalPrice || 0), 0) / contractedOrders.length) : 0;

    const activePartners = partners.filter(p => p.status === 'active').length;
    const pendingPartners = partners.filter(p => p.status === 'pending' || p.status === 'info_requested').length;
    const bannedPartners = partners.filter(p => p.status === 'banned').length;
    const certifiedPartners = partners.filter(p => p.isCertified).length;

    const topPartners = partners
        .filter(p => p.status !== 'banned')
        .map(p => ({ name: p.name, rating: p.rating || 5.0, contractCount: orders.filter(o => o.status === 'contracted' && o.acceptedPartner === p.name).length }))
        .filter(p => p.contractCount > 0)
        .sort((a, b) => b.contractCount - a.contractCount || b.rating - a.rating)
        .slice(0, 5);

    const kpis = window.AppState.kpis || { gmv: 0, escrow: 0, revenue: 0 };

    /* 연체 마일스톤(sweepOverduePaymentMilestones)·만료 견적(isBidExpired)·보증
     * 만료 임박(sweepWarrantyExpiryReminders)은 각각 해당 오더 상세를 직접 열어야만
     * 알 수 있는 개별 신호였다 — 관리자가 전체 현황을 파악하려면 오더를 하나하나
     * 열어보는 수밖에 없었다. 통합 대시보드에 운영 이슈 건수를 집계해 노출한다. */
    const overdueMilestoneCount = orders.reduce((acc, o) => acc + ((o.paymentMilestones || []).filter(m => typeof isMilestoneOverdue === 'function' && isMilestoneOverdue(m)).length), 0);
    const expiredBidOrderCount = orders.filter(o => o.status === 'bidding' && (o.bids || []).some(b => typeof isBidExpired === 'function' && isBidExpired(b))).length;
    const warrantyEndingSoonCount = orders.filter(o => {
        const end = typeof getWarrantyEndDate === 'function' ? getWarrantyEndDate(o) : null;
        if (!end || (typeof isWarrantyExpired === 'function' && isWarrantyExpired(o))) return false;
        const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 30;
    }).length;
    // 착공일/계약금액 변경 협의가 결렬되어 관리자에게 조정을 요청한 건(escalateScheduleChangeToAdmin/
    // escalatePriceChangeToAdmin)도 통합 대기함에는 노출되지만, 대시보드에선 여전히 안 보였다.
    const escalatedNegotiationCount = orders.filter(o =>
        (o.scheduleChangeRequest && o.scheduleChangeRequest.status === 'pending' && o.scheduleChangeRequest.escalated) ||
        (o.priceChangeRequest && o.priceChangeRequest.status === 'pending' && o.priceChangeRequest.escalated)
    ).length;
    const hasOperationalIssues = overdueMilestoneCount > 0 || expiredBidOrderCount > 0 || warrantyEndingSoonCount > 0 || escalatedNegotiationCount > 0;

    container.innerHTML = `
        <div class="space-y-2.5">
            <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider">운영 이슈 모니터링</h4>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div class="article-spec-chip ${overdueMilestoneCount > 0 ? '!border-rose-200' : ''}"><span>연체된 공사대금 마일스톤</span><span class="val ${overdueMilestoneCount > 0 ? 'text-roseCustom' : ''}">${overdueMilestoneCount}건</span></div>
                <div class="article-spec-chip ${expiredBidOrderCount > 0 ? '!border-rose-200' : ''}"><span>만료 견적 방치 오더</span><span class="val ${expiredBidOrderCount > 0 ? 'text-roseCustom' : ''}">${expiredBidOrderCount}건</span></div>
                <div class="article-spec-chip ${warrantyEndingSoonCount > 0 ? '!border-amber-200' : ''}"><span>보증 만료 임박(30일 내)</span><span class="val">${warrantyEndingSoonCount}건</span></div>
                <div class="article-spec-chip ${escalatedNegotiationCount > 0 ? '!border-rose-200' : ''}"><span>협의 조정 요청 대기</span><span class="val ${escalatedNegotiationCount > 0 ? 'text-roseCustom' : ''}">${escalatedNegotiationCount}건</span></div>
            </div>
            ${!hasOperationalIssues ? '<p class="text-[11px] text-ink-400 font-semibold">현재 확인이 필요한 운영 이슈가 없습니다.</p>' : ''}
        </div>`;

    container.innerHTML += `
        <div class="space-y-2.5">
            <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider">거래 지표</h4>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="article-spec-chip"><span>누적 GMV</span><span class="val">₩ ${kpis.gmv.toLocaleString()}만원</span></div>
                <div class="article-spec-chip"><span>수수료 매출</span><span class="val">₩ ${kpis.revenue.toLocaleString()}만원</span></div>
                <div class="article-spec-chip"><span>에스크로 보관</span><span class="val">₩ ${kpis.escrow.toLocaleString()}만원</span></div>
                <div class="article-spec-chip"><span>평균 계약금액</span><span class="val">₩ ${avgOrderValue.toLocaleString()}만원</span></div>
            </div>
        </div>
        <div class="space-y-2.5 pt-4">
            <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider">의뢰 현황</h4>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="article-spec-chip"><span>전체 의뢰</span><span class="val">${orders.length}건</span></div>
                <div class="article-spec-chip"><span>계약 체결</span><span class="val">${contractedOrders.length}건</span></div>
                <div class="article-spec-chip"><span>계약 전환율</span><span class="val">${contractRate}%</span></div>
                <div class="article-spec-chip"><span>입찰 진행중</span><span class="val">${biddingOrders.length}건</span></div>
            </div>
        </div>
        <div class="space-y-2.5 pt-4">
            <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider">파트너·고객 현황</h4>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="article-spec-chip"><span>활동 파트너</span><span class="val">${activePartners}곳</span></div>
                <div class="article-spec-chip"><span>가입 심사 대기</span><span class="val">${pendingPartners}곳</span></div>
                <div class="article-spec-chip"><span>영구 제명</span><span class="val">${bannedPartners}곳</span></div>
                <div class="article-spec-chip"><span>안심 인증</span><span class="val">${certifiedPartners}곳</span></div>
                <div class="article-spec-chip"><span>가입 고객</span><span class="val">${clients.length}명</span></div>
                <div class="article-spec-chip"><span>취소된 계약</span><span class="val">${cancelledOrders.length}건</span></div>
            </div>
        </div>
        <div class="space-y-2.5 pt-4">
            <h4 class="text-xs font-black text-ink-800 uppercase tracking-wider">계약 체결 상위 파트너</h4>
            <div class="space-y-1.5">${topPartners.length === 0 ? '<p class="text-[11px] text-ink-400 font-semibold">아직 체결된 계약이 없습니다.</p>' : topPartners.map((p, idx) => `
                <div class="flex items-center justify-between p-2.5 bg-ink-50 rounded-xl">
                    <span class="text-xs font-bold text-ink-800">${idx + 1}. ${escapeHtml(p.name)}</span>
                    <span class="text-[11px] text-ink-500 font-semibold">계약 ${p.contractCount}건 · ★ ${p.rating.toFixed(1)}</span>
                </div>`).join('')}</div>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 이의신청 종류가 세션 내내 하나씩 늘어나 이제 8종(옐로카드/제명, 고객·파트너 계정
 * 정지, 고객→파트너 신고, 파트너→고객 신고, 강제 계약취소, 입찰 무효화, 후기 삭제)이
 * 됐는데, 각각 자기 탭(모니터링/고객 관리/계약 취소 심사 등)에 흩어져 있어 관리자가
 * "지금 처리할 게 뭐가 있는지" 한눈에 보려면 탭을 7~8개 다 열어봐야 했다 — 이미 있는
 * 개별 승인/반려 함수는 그대로 재사용하고, 대기 중인 것만 한 곳에 모아 보여준다. */
function getAllPendingAppeals() {
    const items = [];
    const rejectBtn = (label, onclick) => `<button type="button" onclick="${onclick}" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">${label}</button>`;
    const approveBtn = (label, onclick) => `<button type="button" onclick="${onclick}" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">${label}</button>`;

    (window.AppState.partners || []).forEach(p => {
        if (p.strikeAppeal && p.strikeAppeal.status === 'pending') {
            items.push({
                typeLabel: '옐로카드/제명 이의신청', subject: p.name, reason: p.strikeAppeal.reason, date: p.strikeAppeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectStrikeAppeal('${escapeHtml(p.name)}', reason))`) + approveBtn('승인(경고 취소)', `adminApproveStrikeAppeal('${escapeHtml(p.name)}')`)
            });
        }
        if (p.isSuspended && p.suspensionAppeal && p.suspensionAppeal.status === 'pending') {
            items.push({
                typeLabel: '파트너 계정 정지 이의신청', subject: p.name, reason: p.suspensionAppeal.reason, date: p.suspensionAppeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectPartnerSuspensionAppeal('${p.id}', reason))`) + approveBtn('승인(정지 해제)', `adminApprovePartnerSuspensionAppeal('${p.id}')`)
            });
        }
    });
    (window.AppState.clientAccounts || []).forEach(acc => {
        if (acc.clientStrikeAppeal && acc.clientStrikeAppeal.status === 'pending') {
            items.push({
                typeLabel: '고객 경고/제명 이의신청', subject: `${acc.name} (${acc.id})`, reason: acc.clientStrikeAppeal.reason, date: acc.clientStrikeAppeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectClientStrikeAppeal('${acc.id}', reason))`) + approveBtn('승인(경고 취소)', `adminApproveClientStrikeAppeal('${acc.id}')`)
            });
        }
        if (acc.isSuspended && acc.suspensionAppeal && acc.suspensionAppeal.status === 'pending') {
            items.push({
                typeLabel: '고객 계정 정지 이의신청', subject: acc.name, reason: acc.suspensionAppeal.reason, date: acc.suspensionAppeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectClientSuspensionAppeal('${acc.id}', reason))`) + approveBtn('승인(정지 해제)', `adminApproveClientSuspensionAppeal('${acc.id}')`)
            });
        }
    });
    (window.AppState.clientReports || []).forEach(r => {
        if (r.appeal && r.appeal.status === 'pending') {
            items.push({
                typeLabel: '고객 신고 이의신청 (파트너→고객)', subject: `${r.clientName} · ${r.orderCode}`, reason: r.appeal.reason, date: r.appeal.date, orderCode: r.orderCode,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectClientReportAppeal('${r.id}', reason))`) + approveBtn('승인(신고 취하)', `adminApproveClientReportAppeal('${r.id}')`)
            });
        }
    });
    (window.AppState.partnerReports || []).forEach(r => {
        if (r.appeal && r.appeal.status === 'pending') {
            items.push({
                typeLabel: '파트너 신고 이의신청 (고객→파트너)', subject: `${r.partnerName} · ${r.orderCode}`, reason: r.appeal.reason, date: r.appeal.date, orderCode: r.orderCode,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectPartnerReportAppeal('${r.id}', reason))`) + approveBtn('승인(신고 취하)', `adminApprovePartnerReportAppeal('${r.id}')`)
            });
        }
    });
    (window.AppState.orders || []).forEach(o => {
        if (o.cancelRequest && o.cancelRequest.appeal && o.cancelRequest.appeal.status === 'pending') {
            items.push({
                typeLabel: '강제 계약취소 이의신청', subject: `${o.code} (${o.cancelRequest.appeal.filedBy === 'client' ? '고객' : '파트너'} 제기)`, reason: o.cancelRequest.appeal.reason, date: o.cancelRequest.appeal.date, orderCode: o.code,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectForceCancelAppeal('${o.code}', reason))`) + approveBtn('승인(계약 복원)', `adminApproveForceCancelAppeal('${o.code}')`)
            });
        }
        (o.adminInvalidatedBids || []).forEach(ib => {
            if (ib.appeal && ib.appeal.status === 'pending') {
                items.push({
                    typeLabel: '입찰 무효화 이의신청', subject: `${ib.partnerName} · ${o.code}`, reason: ib.appeal.reason, date: ib.appeal.date, orderCode: o.code,
                    actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectInvalidatedBidAppeal('${o.code}', '${escapeHtml(ib.partnerName)}', reason))`) + approveBtn('승인(자격 복원)', `adminRestoreInvalidatedBid('${o.code}', '${escapeHtml(ib.partnerName)}')`)
                });
            }
        });
    });
    (window.AppState.reviewDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: '후기 삭제 이의신청', subject: `${e.partnerName} · ${e.orderCode}`, reason: e.appeal.reason, date: e.appeal.date, orderCode: e.orderCode,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectReviewDeletionAppeal('${e.id}', reason))`) + approveBtn('승인(후기 복원)', `adminApproveReviewDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.reviewReplyDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: '후기 답글 삭제 이의신청', subject: `${e.partnerName}`, reason: e.appeal.reason, date: e.appeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectReviewReplyDeletionAppeal('${e.id}', reason))`) + approveBtn('승인(답글 복원)', `adminApproveReviewReplyDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.communityDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: `커뮤니티 ${e.typeLabelKo} 삭제 이의신청`, subject: `${e.authorName} · ${e.contentPreview}`, reason: e.appeal.reason, date: e.appeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectCommunityDeletionAppeal('${e.id}', reason))`) + approveBtn(`승인(${e.typeLabelKo} 복원)`, `adminApproveCommunityDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.orders || []).forEach(o => {
        (o.paymentMilestones || []).forEach(m => {
            if (m.status === 'disputed') {
                items.push({
                    typeLabel: '공사대금 청구 이의제기', subject: `${o.code} · ${m.label}`, reason: m.disputeReason, date: m.disputeDate, orderCode: o.code,
                    actionsHtml: rejectBtn('반려(청구 유지)', `openReportReasonPrompt((reason) => adminRejectMilestoneDispute('${o.code}', '${m.key}', reason))`) + approveBtn('승인(청구 취소)', `adminApproveMilestoneDispute('${o.code}', '${m.key}')`)
                });
            }
            if (m.status === 'payment_disputed') {
                items.push({
                    typeLabel: '미입금 이의제기', subject: `${o.code} · ${m.label}`, reason: m.paymentDisputeReason, date: m.paymentDisputeDate, orderCode: o.code,
                    actionsHtml: rejectBtn('반려(납부완료 유지)', `openReportReasonPrompt((reason) => adminRejectPaymentReceiptDispute('${o.code}', '${m.key}', reason))`) + approveBtn('승인(재청구)', `adminApprovePaymentReceiptDispute('${o.code}', '${m.key}')`)
                });
            }
        });
    });
    /* 착공일/계약금액 변경 협의는 서로 거절·역제안만 반복할 수 있을 뿐 결렬됐을 때
     * 관리자에게 조정을 요청할 방법이 없었다 — 다른 분쟁(공사대금 청구, 후기 등)엔
     * 전부 있는 "이의제기 → 관리자 심사" 경로가 이 두 협의에는 빠져 있었다. 이미 있는
     * 직권 승인/반려(adminResolveScheduleChangeRequest/adminResolvePriceChangeRequest)를
     * 그대로 재사용하고, 통합 대기함에도 노출되도록 escalated 플래그만 추가한다. */
    (window.AppState.orders || []).forEach(o => {
        if (o.scheduleChangeRequest && o.scheduleChangeRequest.status === 'pending' && o.scheduleChangeRequest.escalated) {
            const req = o.scheduleChangeRequest;
            items.push({
                typeLabel: '착공일 변경 협의 조정 요청', subject: `${o.code} · ${req.newDate}로 변경 요청`, reason: req.reason, date: req.date, orderCode: o.code,
                actionsHtml: rejectBtn('반려(기존 일정 유지)', `adminResolveScheduleChangeRequest('${o.code}', false)`) + approveBtn('승인(변경 확정)', `adminResolveScheduleChangeRequest('${o.code}', true)`)
            });
        }
        if (o.priceChangeRequest && o.priceChangeRequest.status === 'pending' && o.priceChangeRequest.escalated) {
            const req = o.priceChangeRequest;
            items.push({
                typeLabel: '계약금액 변경 협의 조정 요청', subject: `${o.code} · ₩${req.newPrice.toLocaleString()}만원으로 변경 요청`, reason: req.reason, date: req.date, orderCode: o.code,
                actionsHtml: rejectBtn('반려(기존 금액 유지)', `adminResolvePriceChangeRequest('${o.code}', false)`) + approveBtn('승인(변경 확정)', `adminResolvePriceChangeRequest('${o.code}', true)`)
            });
        }
    });
    (window.AppState.orders || []).forEach(o => {
        (o.messages || []).forEach((m, idx) => {
            if (m.report && m.report.status === 'pending') {
                items.push({
                    typeLabel: '메시지 신고', subject: `${o.code} · ${m.report.reportedBy === 'client' ? '파트너' : '고객'} 메시지`, reason: m.report.reason, date: m.report.date, orderCode: o.code,
                    actionsHtml: rejectBtn('반려(메시지 유지)', `adminDismissOrderMessageReport('${o.code}', ${idx})`) + approveBtn('삭제', `adminDeleteReportedOrderMessage('${o.code}', ${idx})`)
                });
            }
        });
    });
    (window.AppState.orderMessageDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: '메시지 삭제 이의신청', subject: `${e.orderCode} · ${e.messageSnapshot.from === 'client' ? '고객' : '파트너'} 메시지`, reason: e.appeal.reason, date: e.appeal.date, orderCode: e.orderCode,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectOrderMessageDeletionAppeal('${e.id}', reason))`) + approveBtn('승인(메시지 복원)', `adminApproveOrderMessageDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.portfolioQuestionDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: '시공사례 문의 삭제 이의신청', subject: `${e.partnerName} · ${e.portfolioTitle}`, reason: e.appeal.reason, date: e.appeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectPortfolioQuestionDeletionAppeal('${e.id}', reason))`) + approveBtn('승인(문의 복원)', `adminApprovePortfolioQuestionDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.orders || []).forEach(o => {
        ['contract', 'estimate'].forEach(docType => {
            const rejection = o.docRejections && o.docRejections[docType];
            if (rejection && rejection.appeal && rejection.appeal.status === 'pending') {
                const label = docType === 'contract' ? '계약서' : '견적서';
                items.push({
                    typeLabel: `${label} 반려 이의신청`, subject: `${o.code} · ${o.acceptedPartner}`, reason: rejection.appeal.reason, date: rejection.appeal.date, orderCode: o.code,
                    actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectDocRejectionAppeal('${o.code}', '${docType}', reason))`) + approveBtn(`승인(${label} 복원)`, `adminApproveDocRejectionAppeal('${o.code}', '${docType}')`)
                });
            }
        });
    });
    (window.AppState.clientRatings || []).forEach(r => {
        if (r.appeal && r.appeal.status === 'pending') {
            items.push({
                typeLabel: '고객 평가 이의신청', subject: `${r.clientName} · ${r.orderCode} (평가자: ${r.partnerName})`, reason: r.appeal.reason, date: r.appeal.date, orderCode: r.orderCode,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectClientRatingAppeal('${r.orderCode}', reason))`) + approveBtn('승인(평가 삭제)', `adminApproveClientRatingAppeal('${r.orderCode}')`)
            });
        }
    });
    (window.AppState.portfolioDeletionLog || []).forEach(e => {
        if (e.appeal && e.appeal.status === 'pending') {
            items.push({
                typeLabel: '시공사례 삭제 이의신청', subject: `${e.partnerName} · ${e.portfolioSnapshot.title || '(제목 없음)'}`, reason: e.appeal.reason, date: e.appeal.date,
                actionsHtml: rejectBtn('반려', `openReportReasonPrompt((reason) => adminRejectPortfolioDeletionAppeal('${e.id}', reason))`) + approveBtn('승인(시공사례 복원)', `adminApprovePortfolioDeletionAppeal('${e.id}')`)
            });
        }
    });
    (window.AppState.orders || []).forEach(o => {
        (o.repairClaims || []).forEach(c => {
            if (c.completionDisputed && !c.completionDisputeResolution) {
                items.push({
                    typeLabel: '하자보수 완료처리 이의제기', subject: `${o.code} · ${c.title}`, reason: c.completionDisputeNote, date: c.resolvedDate || c.createdDate, orderCode: o.code,
                    actionsHtml: rejectBtn('반려(완료 유지)', `openReportReasonPrompt((reason) => adminRejectRepairClaimCompletionDispute('${o.code}', '${c.id}', reason))`) + approveBtn('승인(재작업)', `adminApproveRepairClaimCompletionDispute('${o.code}', '${c.id}')`)
                });
            }
        });
        (o.progressStages || []).forEach((s, idx) => {
            if (s.disputed && !s.disputeResolution) {
                items.push({
                    typeLabel: '시공 진행 단계 이의제기', subject: `${o.code} · ${s.label}`, reason: s.disputeReason, date: s.date || getLocalDateString(), orderCode: o.code,
                    actionsHtml: rejectBtn('반려(완료 유지)', `openReportReasonPrompt((reason) => adminRejectProgressStageDispute('${o.code}', ${idx}, reason))`) + approveBtn('승인(재작업)', `adminApproveProgressStageDispute('${o.code}', ${idx})`)
                });
            }
        });
        if (o.siteVisit && o.siteVisit.disputed && !o.siteVisit.disputeResolution) {
            items.push({
                typeLabel: '실측 방문 완료처리 이의제기', subject: o.code, reason: o.siteVisit.disputeReason, date: o.siteVisit.completedDate || getLocalDateString(), orderCode: o.code,
                actionsHtml: rejectBtn('반려(완료 유지)', `openReportReasonPrompt((reason) => adminRejectSiteVisitCompletionDispute('${o.code}', reason))`) + approveBtn('승인(재방문)', `adminApproveSiteVisitCompletionDispute('${o.code}')`)
            });
        }
        (o.repairClaims || []).forEach(c => {
            if (c.visitCompletionDisputed && !c.visitCompletionDisputeResolution) {
                items.push({
                    typeLabel: '하자보수 방문 완료처리 이의제기', subject: `${o.code} · ${c.title}`, reason: c.visitCompletionDisputeReason, date: c.visitCompletedDate || getLocalDateString(), orderCode: o.code,
                    actionsHtml: rejectBtn('반려(완료 유지)', `openReportReasonPrompt((reason) => adminRejectRepairVisitCompletionDispute('${o.code}', '${c.id}', reason))`) + approveBtn('승인(재방문)', `adminApproveRepairVisitCompletionDispute('${o.code}', '${c.id}')`)
                });
            }
        });
    });

    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderAdminAppealInbox() {
    const container = document.getElementById('admin-appeal-inbox-list');
    if (!container) return;
    const items = getAllPendingAppeals();

    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">현재 심사 대기 중인 이의신청이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    /* 이의신청은 구조화된 사유 텍스트 한 줄만 보고 판단해야 했는데, 그 이의의
     * 배경이 된 실제 대화(order.messages)는 오더 조회에서만 별도로 찾아봐야
     * 했다 — 판단이 이루어지는 이 화면에 바로 연결해 왕복을 없앤다. */
    const buildAppealMessagesToggleHtml = (it) => {
        if (!it.orderCode) return '';
        const order = (window.AppState.orders || []).find(o => o.code === it.orderCode);
        const count = order ? (order.messages || []).length : 0;
        if (count === 0) return '';
        const expanded = adminOrderLookupExpandedThreads.has(it.orderCode);
        return `<div class="pt-1">
            <button type="button" onclick="toggleAdminOrderMessageThread('${it.orderCode}')" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"><i data-lucide="message-circle" class="w-3 h-3"></i> 대화 내역 ${count}건 ${expanded ? '숨기기' : '보기'}</button>
            ${expanded ? buildAdminOrderMessageThreadHtml(order) : ''}
        </div>`;
    };

    container.innerHTML = items.map(it => `
        <div class="surface p-4 space-y-2 text-left">
            <div class="flex items-center justify-between gap-2">
                <span class="badge badge-brand">${it.typeLabel}</span>
                <span class="text-[10px] text-ink-400 font-bold">${it.date}</span>
            </div>
            <h4 class="text-xs font-black text-ink-950">${escapeHtml(it.subject)}</h4>
            <p class="text-[11px] text-ink-600 font-medium leading-relaxed">${escapeHtml(it.reason)}</p>
            ${buildAppealMessagesToggleHtml(it)}
            <div class="flex items-center gap-1.5 justify-end pt-1 border-t border-ink-100">${it.actionsHtml}</div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 지금까지는 관리자가 오더 하나를 찾으려면 그 오더의 성격(고액/파트너 참여 여부)에
 * 맞는 특정 탭으로 들어가야 했음 — 예를 들어 일반 예산 오더는 어느 관리자 탭에서도
 * 검색이 안 됐다. 고객이 전화로 "제 의뢰 어떻게 됐나요" 물어볼 때 관리자가 즉시
 * 찾을 수 있도록, 모든 탭에서 공통으로 보이는 조회창을 추가한다(전체 오더 대상,
 * 의뢰코드/고객명/연락처로 검색). */
function getOrderLookupMatches(query) {
    return (window.AppState.orders || []).filter(o =>
        o.code.toLowerCase().includes(query) ||
        (o.clientName && o.clientName.toLowerCase().includes(query)) ||
        (o.clientPhone && o.clientPhone.includes(query))
    );
}

let adminOrderLookupExpandedThreads = new Set();

function toggleAdminOrderMessageThread(orderCode) {
    if (adminOrderLookupExpandedThreads.has(orderCode)) adminOrderLookupExpandedThreads.delete(orderCode);
    else adminOrderLookupExpandedThreads.add(orderCode);
    if (document.getElementById('admin-order-lookup-result')) searchOrderLookup();
    if (document.getElementById('admin-appeal-inbox-list')) renderAdminAppealInbox();
}

/* 커뮤니티 신고(dismissReviewReport 등)와 동일한 반려/삭제 대칭 구조를 계약
 * 메시지 신고(reportOrderMessage, utils_ui.js)에도 적용한다 — 신고를 검토한 뒤
 * 실제 문제가 없다고 판단하면 메시지를 유지한 채 신고만 종료(반려)하고,
 * 실제로 부적절하면 그 메시지 한 건만 삭제한다(대화 전체를 지우지 않음). */
function adminDismissOrderMessageReport(orderCode, msgIndex) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const msg = order && order.messages && order.messages[msgIndex];
    if (!msg || !msg.report || msg.report.status !== 'pending') return;
    msg.report.status = 'dismissed';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_MESSAGE_REPORT_DISMISS', `[메시지 신고 반려] 오더 ${orderCode}의 메시지 신고를 검토 후 반려(메시지 유지)했습니다.`, 'INFO');
    // dismissReviewReport/dismissReviewReplyReport 등 다른 모든 신고 반려 함수는
    // 검토 결과를 신고자에게 알리는데, 이 함수만 그 알림이 빠져 있었다 — 동일하게 맞춘다.
    const reporterRole = msg.report.reportedBy;
    if (reporterRole === 'client' && typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `신고하신 메시지를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    if (reporterRole === 'partner' && typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `신고하신 메시지를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 메시지는 그대로 유지됩니다.', 'info');
    searchOrderLookup();
    if (typeof renderAdminAppealInbox === 'function') renderAdminAppealInbox();
}

/* 후기/후기 답글/커뮤니티/시공사례 문의/서류 반려는 전부 삭제 시 스냅샷을 남겨
 * 작성자가 이의신청할 수 있는데, 메시지 삭제만 그 경로가 빠져 있었다 —
 * 삭제된 메시지 하나하나를 되돌릴 수 있게 로그를 남긴다. */
function adminDeleteReportedOrderMessage(orderCode, msgIndex) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const msg = order && order.messages && order.messages[msgIndex];
    if (!msg || !msg.report || msg.report.status !== 'pending') return;
    order.messages.splice(msgIndex, 1);

    if (!window.AppState.orderMessageDeletionLog) window.AppState.orderMessageDeletionLog = [];
    const logEntry = { id: `omdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`, orderCode, clientPhone: order.clientPhone, partnerName: order.acceptedPartner, messageSnapshot: msg, date: getLocalDateString(), appeal: null };
    window.AppState.orderMessageDeletionLog.unshift(logEntry);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_MESSAGE_MODERATE', `[메시지 삭제] 오더 ${orderCode}의 신고된 메시지를 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (msg.from === 'client' && typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `보내신 메시지 중 일부가 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 이의신청하실 수 있어요.`);
    if (msg.from === 'partner' && typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `보내신 메시지 중 일부가 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 이의신청하실 수 있어요.`);
    showToast('메시지를 삭제했습니다.', 'info');
    searchOrderLookup();
    if (typeof renderAdminAppealInbox === 'function') renderAdminAppealInbox();
}

function appealOrderMessageDeletion(logId, viewerRole, reason) {
    const entry = (window.AppState.orderMessageDeletionLog || []).find(e => e.id === logId);
    if (!entry || entry.messageSnapshot.from !== viewerRole) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog(viewerRole === 'client' ? 'CLIENT' : 'PARTNER', 'ORDER_MESSAGE_DELETION_APPEAL', `오더(${entry.orderCode})의 삭제된 메시지에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');
    if (viewerRole === 'client' && typeof selectMyPageEstimate === 'function') selectMyPageEstimate(entry.orderCode);
    if (viewerRole === 'partner' && typeof openPartnerOrderDetailModal === 'function') openPartnerOrderDetailModal(entry.orderCode);
}

function adminApproveOrderMessageDeletionAppeal(logId) {
    const entry = (window.AppState.orderMessageDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    const order = (window.AppState.orders || []).find(o => o.code === entry.orderCode);
    if (!order) return;
    if (!order.messages) order.messages = [];
    order.messages.push(entry.messageSnapshot);
    window.AppState.orderMessageDeletionLog = window.AppState.orderMessageDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_MESSAGE_DELETION_APPEAL_APPROVE', `[이의신청 승인] 오더 ${entry.orderCode}의 삭제된 메시지를 재검토하여 복원했습니다.`, 'SUCCESS');
    if (entry.messageSnapshot.from === 'client' && typeof pushClientNotification === 'function') pushClientNotification(entry.clientPhone, `제출하신 이의신청이 승인되어 삭제됐던 메시지가 복원되었습니다.`);
    if (entry.messageSnapshot.from === 'partner' && typeof pushPartnerNotification === 'function' && entry.partnerName) pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 승인되어 삭제됐던 메시지가 복원되었습니다.`);
    showToast('메시지를 복원했습니다.', 'success');
    searchOrderLookup();
}

function adminRejectOrderMessageDeletionAppeal(logId, reason) {
    const entry = (window.AppState.orderMessageDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_MESSAGE_DELETION_APPEAL_REJECT', `[이의신청 반려] 오더 ${entry.orderCode}의 메시지 삭제 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (entry.messageSnapshot.from === 'client' && typeof pushClientNotification === 'function') pushClientNotification(entry.clientPhone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    if (entry.messageSnapshot.from === 'partner' && typeof pushPartnerNotification === 'function' && entry.partnerName) pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
}

/* 모든 오더는 고객 자기신청(견적 신청 폼) 또는 고객이 직접 지정하는 1:1 요청에서만
 * 생겨났다 — 실제 중개 플랫폼이라면 흔한 "전화·방문 상담으로 접수된 고객"을 매니저가
 * 대신 등록할 방법이 전혀 없어, 상담원이 접수한 리드는 고객이 직접 사이트에서 다시
 * 신청하지 않는 한 그냥 유실됐다. completeMatchingSim(client_panel.js)과 동일한
 * 오더 생성/자동매칭 로직을 재사용해, 매니저가 대신 등록해도 이후 흐름은 완전히
 * 동일하게 진행되도록 한다. */
function openAdminOrderRegistrationModal() {
    ['admin-order-reg-name', 'admin-order-reg-phone', 'admin-order-reg-address', 'admin-order-reg-pyung', 'admin-order-reg-date', 'admin-order-reg-budget'].forEach(id => safeUpdateValue(id, ''));
    safeUpdateValue('admin-order-reg-space-type', 'residential');
    safeUpdateValue('admin-order-reg-work-type', 'all');
    safeUpdateValue('admin-order-reg-vacancy', 'empty');
    openModal('admin-order-registration-modal', 'admin-order-registration-modal-card');
}

function closeAdminOrderRegistrationModal() {
    closeModal('admin-order-registration-modal', 'admin-order-registration-modal-card');
}

function submitAdminOrderRegistration() {
    const name = document.getElementById('admin-order-reg-name')?.value.trim();
    const phone = document.getElementById('admin-order-reg-phone')?.value.trim();
    const address = document.getElementById('admin-order-reg-address')?.value.trim();
    const pyung = parseInt(document.getElementById('admin-order-reg-pyung')?.value, 10);
    const preferredDate = document.getElementById('admin-order-reg-date')?.value;
    const budget = parseInt(document.getElementById('admin-order-reg-budget')?.value, 10);
    const spaceType = document.getElementById('admin-order-reg-space-type')?.value || 'residential';
    const workType = document.getElementById('admin-order-reg-work-type')?.value || 'all';
    const vacancy = document.getElementById('admin-order-reg-vacancy')?.value || 'empty';

    if (!name || !phone || !address || !pyung || pyung <= 0 || !preferredDate || !budget || budget <= 0) {
        showToast('모든 항목을 올바르게 입력해 주세요.', 'warning');
        return;
    }

    const code = `WJ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const isHighBudget = budget >= 7000;
    const newOrder = {
        code, clientName: name, clientPhone: phone, clientAddress: address,
        spaceType, workType, pyung, vacancy, preferredDate, partnerCountLimit: 3, budget,
        status: 'bidding', contractUploaded: false, clientSigned: false, reviewWritten: false,
        acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isRebidding: false,
        isHighBudgetAdminPending: isHighBudget, commissionPaid: false, contractDoc: null, estimateDoc: null,
        createdAt: new Date().toISOString(), createdByManager: true
    };

    if (!isHighBudget) {
        const availablePartners = (window.AppState.partners || []).filter(p => p.status === 'active' && !p.isPaused);
        const count = Math.min(newOrder.partnerCountLimit, availablePartners.length);
        const shuffled = [...availablePartners].sort(() => 0.5 - Math.random());
        newOrder.bids = shuffled.slice(0, count).map(partner => ({
            partner: partner.name,
            price: Math.floor(budget * (0.9 + Math.random() * 0.08)),
            desc: `${partner.name}에서 제안하는 맞춤 견적서입니다. 최고급 친환경 마감 자재와 철저한 하자보증 무상 적용.`,
            verified: true, progress: 'bidding',
            date: getLocalDateString(), validUntil: computeBidValidUntil(), respondedAt: new Date().toISOString()
        }));
    }

    window.AppState.orders.push(newOrder);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ADMIN_ORDER_REGISTER', `[매니저 센터] 전화·방문 상담으로 접수된 고객(${name})의 견적을 대신 등록했습니다. (${code})`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(phone, `상담원이 접수해주신 견적 요청이 정상 등록됐어요. (의뢰 코드: ${code})${isHighBudget ? ' 고액 오더는 관리자가 직접 우수 파트너사를 배정해드려요.' : ` 파트너사 ${newOrder.bids.length}곳이 매칭되어 견적서를 보냈어요.`}`);

    showToast('견적이 등록되었습니다.', 'success');
    closeAdminOrderRegistrationModal();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
    if (document.getElementById('admin-order-lookup-input')?.value) searchOrderLookup();
}

function searchOrderLookup() {
    const input = document.getElementById('admin-order-lookup-input');
    const resultEl = document.getElementById('admin-order-lookup-result');
    if (!input || !resultEl) return;
    const query = input.value.trim().toLowerCase();
    if (!query) { resultEl.innerHTML = ''; return; }

    const matches = getOrderLookupMatches(query).slice(0, 10);

    if (matches.length === 0) {
        resultEl.innerHTML = `<p class="text-xs font-bold text-ink-400 text-center py-3">조회 조건에 해당되는 의뢰를 찾을 수 없습니다.</p>`;
        return;
    }

    const statusLabel = (o) => o.status === 'withdrawn' ? '<span class="badge badge-neutral">철회됨</span>'
        : o.status === 'contracted' ? '<span class="badge badge-emerald">계약 체결</span>'
        : o.is1on1 ? '<span class="badge badge-neutral">1:1 지정</span>'
        : '<span class="badge badge-amber">입찰 심사중</span>';

    const buildDocReviewRowHtml = (o, docType, label) => {
        const doc = docType === 'contract' ? o.contractDoc : o.estimateDoc;
        if (!doc) return '';
        return `
            <div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-ink-100">
                <span class="text-[11px] font-bold text-ink-700 truncate">${label}: ${escapeHtml(doc.name)}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="openUploadedPartnerDoc('${o.code}', '${docType}')" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">보기</button>
                    <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectPartnerDoc('${o.code}', '${docType}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                </div>
            </div>`;
    };

    const buildBidInvalidateRowHtml = (o) => {
        if (o.status !== 'bidding' || !o.bids || o.bids.length === 0) return '';
        return `<div class="w-full space-y-1.5 pt-1">${o.bids.map(b => `
            <div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-ink-100">
                <span class="text-[11px] font-bold text-ink-700 truncate">${escapeHtml(b.partner)} · ₩${(b.price || 0).toLocaleString()}만원</span>
                <button type="button" onclick="openReportReasonPrompt((reason) => adminInvalidateBid('${o.code}', '${escapeHtml(b.partner)}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0">입찰 무효화</button>
            </div>`).join('')}</div>`;
    };

    /* adminInvalidateBid는 excludedPartners에 등록해 재입찰을 막기만 할 뿐, 오판이나
     * 오해로 무효화한 경우 되돌릴 방법이 없었다 — 파트너 입장에서는 사실상 영구
     * 퇴장이었다. 관리자 직권으로 무효화한 건만 별도로 기록해두고(클라이언트/파트너가
     * 스스로 매칭취소·입찰철회한 건은 대상에서 제외) 복원할 수 있게 한다. */
    const buildInvalidatedBidsRowHtml = (o) => {
        if (o.status !== 'bidding' || !o.adminInvalidatedBids || o.adminInvalidatedBids.length === 0) return '';
        return `<div class="w-full space-y-1.5 pt-1">${o.adminInvalidatedBids.map(ib => {
            const hasPendingAppeal = ib.appeal && ib.appeal.status === 'pending';
            return `<div class="flex items-center justify-between gap-2 px-3 py-2 bg-rose-50/60 rounded-lg border border-rose-200">
                <span class="text-[11px] font-bold text-ink-700 truncate">직권 무효화됨: ${escapeHtml(ib.partnerName)} (${ib.date}) — ${escapeHtml(ib.reason)}${hasPendingAppeal ? ` · 이의신청: ${escapeHtml(ib.appeal.reason)}` : (ib.appeal && ib.appeal.status === 'rejected' ? ' · 이의신청 반려됨' : '')}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${hasPendingAppeal ? `<button type="button" onclick="openReportReasonPrompt((reason) => adminRejectInvalidatedBidAppeal('${o.code}', '${escapeHtml(ib.partnerName)}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">이의신청 반려</button>` : ''}
                    <button type="button" onclick="adminRestoreInvalidatedBid('${o.code}', '${escapeHtml(ib.partnerName)}')" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">복원</button>
                </div>
            </div>`;
        }).join('')}</div>`;
    };

    /* 하자보수·일정변경·금액변경 3종 요청이 전부 client_panel.js/partner_panel.js의
     * 당사자 간 절차로만 처리되어, 한쪽이 계속 반려하거나 응답이 없으면 관리자가
     * 개입할 방법이 전혀 없었다 — 오더 조회는 이미 계약 강제취소·입찰 무효화 등
     * 직권 개입의 중심 화면이므로, 대기중인 분쟁을 여기서 함께 보여주고 직권으로
     * 정리할 수 있게 한다. */
    const buildDisputeRowHtml = (o) => {
        const rows = [];
        (o.repairClaims || []).filter(c => c.status === 'submitted' || c.status === 'in_progress').forEach(c => {
            rows.push(`<div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-ink-100">
                <span class="text-[11px] font-bold text-ink-700 truncate">하자보수: ${escapeHtml(c.title)} (${c.status === 'in_progress' ? '처리중' : '접수됨'})</span>
                <button type="button" onclick="openReportReasonPrompt((note) => adminForceCompleteRepairClaim('${o.code}', '${c.id}', note))" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 shrink-0">직권 처리완료</button>
            </div>`);
        });
        /* 고객이 반려된 하자보수 신청에 재검토를 요청하면(escalateRepairClaimToAdmin,
         * client_panel.js) 관리자가 이를 놓치지 않도록 별도 강조 행으로 보여준다 —
         * 재검토를 요청하지 않은 단순 반려 건까지 모두 노출하면 정말 판단이 필요한
         * 건이 파묻힌다. */
        (o.repairClaims || []).filter(c => c.status === 'rejected' && c.escalated).forEach(c => {
            rows.push(`<div class="flex items-center justify-between gap-2 px-3 py-2 bg-rose-50/60 rounded-lg border border-rose-200">
                <span class="text-[11px] font-bold text-ink-700 truncate">하자보수(반려·재검토 요청): ${escapeHtml(c.title)} — ${escapeHtml(c.escalationNote || '')}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="adminDismissRepairClaimEscalation('${o.code}', '${c.id}')" class="text-[10px] font-bold text-ink-500 hover:text-ink-700 bg-transparent border-0 cursor-pointer p-0">반려 유지</button>
                    <button type="button" onclick="openReportReasonPrompt((note) => adminForceCompleteRepairClaim('${o.code}', '${c.id}', note))" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">직권 처리완료</button>
                </div>
            </div>`);
        });
        if (o.scheduleChangeRequest && o.scheduleChangeRequest.status === 'pending') {
            rows.push(`<div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-ink-100">
                <span class="text-[11px] font-bold text-ink-700 truncate">일정 변경 요청 (${o.scheduleChangeRequest.requestedBy === 'client' ? '고객' : '파트너'} 제안): ${o.scheduleChangeRequest.newDate}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="adminResolveScheduleChangeRequest('${o.code}', false)" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">직권 반려</button>
                    <button type="button" onclick="adminResolveScheduleChangeRequest('${o.code}', true)" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">직권 승인</button>
                </div>
            </div>`);
        }
        if (o.priceChangeRequest && o.priceChangeRequest.status === 'pending') {
            rows.push(`<div class="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-ink-100">
                <span class="text-[11px] font-bold text-ink-700 truncate">금액 변경 요청 (${o.priceChangeRequest.requestedBy === 'client' ? '고객' : '파트너'} 제안): ₩${o.priceChangeRequest.newPrice.toLocaleString()}만원</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="adminResolvePriceChangeRequest('${o.code}', false)" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">직권 반려</button>
                    <button type="button" onclick="adminResolvePriceChangeRequest('${o.code}', true)" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">직권 승인</button>
                </div>
            </div>`);
        }
        if (o.status === 'cancelled' && o.cancelRequest && o.cancelRequest.requestedBy === 'admin' && o.cancelRequest.appeal && o.cancelRequest.appeal.status === 'pending') {
            rows.push(`<div class="flex items-center justify-between gap-2 px-3 py-2 bg-rose-50/60 rounded-lg border border-rose-200">
                <span class="text-[11px] font-bold text-ink-700 truncate">강제 취소 이의신청 (${o.cancelRequest.appeal.filedBy === 'client' ? '고객' : '파트너'} 제출): ${escapeHtml(o.cancelRequest.appeal.reason)}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectForceCancelAppeal('${o.code}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                    <button type="button" onclick="adminApproveForceCancelAppeal('${o.code}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(계약 복원)</button>
                </div>
            </div>`);
        }
        return rows.length === 0 ? '' : `<div class="w-full space-y-1.5 pt-1">${rows.join('')}</div>`;
    };

    /* 위 분쟁 행들은 구조화된 사유/답변만 보여줄 뿐, 실제로 어떤 대화를 주고받다가
     * 분쟁까지 이어졌는지는 order.messages 안에만 있고 관리자는 볼 방법이 없었다 —
     * 목록에 항상 펼쳐두면 화면이 너무 길어지므로 접힌 토글로 필요할 때만 연다. */
    const buildOrderMessagesRowHtml = (o) => {
        const count = (o.messages || []).length;
        if (count === 0) return '';
        const expanded = adminOrderLookupExpandedThreads.has(o.code);
        return `<div class="w-full pt-1">
            <button type="button" onclick="toggleAdminOrderMessageThread('${o.code}')" class="text-[10px] font-bold text-ink-500 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"><i data-lucide="message-circle" class="w-3 h-3"></i> 대화 내역 ${count}건 ${expanded ? '숨기기' : '보기'}</button>
            ${expanded ? buildAdminOrderMessageThreadHtml(o) : ''}
        </div>`;
    };

    /* 오더 조회 화면엔 고객↔파트너 대화(order.messages, buildOrderMessagesRowHtml)까지
     * 관리자가 볼 수 있는데, 정작 매니저끼리 인수인계할 방법은 전혀 없었다 — 전화
     * 통화 내용이나 다음 조치 계획 같은 내부 메모는 담당 매니저 머릿속에만 있다가
     * 교대하면 사라졌다. 고객·파트너에게는 절대 노출되지 않는 매니저 공유 메모를 둔다. */
    const buildAdminOrderNotesHtml = (o) => {
        const notes = o.adminNotes || [];
        const notesHtml = notes.length === 0 ? '' : `<div class="space-y-1 max-h-32 overflow-y-auto custom-scroll pr-1">${notes.map(n => `
            <div class="flex items-start justify-between gap-2 text-[10px] text-ink-600 font-semibold leading-relaxed bg-white rounded-lg border border-ink-100 px-2 py-1.5">
                <span><span class="text-ink-400 font-bold">${escapeHtml(n.managerName)} · ${n.date}</span><br>${escapeHtml(n.text)}</span>
                <button type="button" onclick="deleteAdminOrderNote('${o.code}', '${n.id}')" class="text-ink-300 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0" aria-label="메모 삭제"><i data-lucide="x" class="w-3 h-3"></i></button>
            </div>`).join('')}</div>`;
        return `<div class="w-full pt-1 space-y-1.5">
            <p class="text-[10px] font-black text-ink-400 uppercase tracking-wider flex items-center gap-1"><i data-lucide="sticky-note" class="w-3 h-3"></i> 매니저 메모 (내부 공유, 고객·파트너 비공개)</p>
            ${notesHtml}
            <div class="flex gap-1.5">
                <input type="text" id="admin-order-note-input-${o.code}" placeholder="인수인계용 메모를 입력하세요" class="input flex-1 text-[10px] py-1.5" onkeydown="if(event.key==='Enter'){addAdminOrderNote('${o.code}');}">
                <button type="button" onclick="addAdminOrderNote('${o.code}')" class="btn btn-secondary btn-sm shrink-0">추가</button>
            </div>
        </div>`;
    };

    resultEl.innerHTML = matches.map(o => `
        <div class="p-3.5 bg-ink-50 rounded-xl flex flex-wrap justify-between items-center gap-2 text-xs">
            <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-2"><span class="font-mono text-[10px] font-black text-ink-500">${o.code}</span>${statusLabel(o)}</div>
                <p class="font-bold text-ink-900">${escapeHtml(o.clientName)} 고객님 (${o.clientPhone || '-'})</p>
                <p class="text-[10px] text-ink-500 font-medium truncate">${escapeHtml(o.clientAddress || '')} · ${o.pyung || '-'}평형 · 입찰 ${o.bids ? o.bids.length : 0}/${o.partnerCountLimit || '-'}개사${o.acceptedPartner ? ` · 계약: ${escapeHtml(o.acceptedPartner)}` : ''}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="font-black text-ink-950">₩ ${(o.finalPrice || o.budget || 0).toLocaleString()}만원</span>
                ${o.status === 'contracted' ? `<button type="button" onclick="openReportReasonPrompt((reason) => adminForceCancelContract('${o.code}', reason))" class="btn btn-secondary btn-sm text-roseCustom">계약 강제 취소</button>` : ''}
            </div>
            ${(o.contractDoc || o.estimateDoc) ? `<div class="w-full space-y-1.5 pt-1">${buildDocReviewRowHtml(o, 'contract', '계약서')}${buildDocReviewRowHtml(o, 'estimate', '견적서')}</div>` : ''}
            ${buildBidInvalidateRowHtml(o)}
            ${buildInvalidatedBidsRowHtml(o)}
            ${buildDisputeRowHtml(o)}
            ${buildOrderMessagesRowHtml(o)}
            ${buildAdminOrderNotesHtml(o)}
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addAdminOrderNote(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;
    const input = document.getElementById(`admin-order-note-input-${orderCode}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('메모 내용을 입력해주세요.', 'warning'); return; }

    if (!order.adminNotes) order.adminNotes = [];
    order.adminNotes.push({ id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`, managerName: window.AppState.managerName || '매니저', text, date: getLocalDateString() });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_NOTE_ADD', `[${window.AppState.managerName}]가 오더(${orderCode})에 내부 메모를 남겼습니다.`, 'INFO');
    showToast('메모를 추가했습니다.', 'success');
    searchOrderLookup();
}

function deleteAdminOrderNote(orderCode, noteId) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || !order.adminNotes) return;
    order.adminNotes = order.adminNotes.filter(n => n.id !== noteId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_NOTE_DELETE', `[${window.AppState.managerName}]가 오더(${orderCode})의 내부 메모를 삭제했습니다.`, 'INFO');
    showToast('메모를 삭제했습니다.', 'info');
    searchOrderLookup();
}

function adminForceCompleteRepairClaim(orderCode, claimId, note) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim) return;
    claim.status = 'completed';
    claim.partnerResponse = note;
    claim.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_CLAIM_FORCE_RESOLVE', `[하자보수 직권 처리완료] 오더 ${order.code}의 하자보수 신청("${claim.title}")을 매니저가 직권으로 처리 완료했습니다. 안내: ${note}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `하자보수 신청("${claim.title}")이 매니저 센터 직권으로 처리 완료되었습니다. 안내: ${note}`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `하자보수 신청("${claim.title}")이 매니저 센터 직권으로 처리 완료 처리되었습니다.`);
    showToast('하자보수 신청을 매니저 직권으로 처리 완료했습니다.', 'success');
    searchOrderLookup();
}

function adminDismissRepairClaimEscalation(orderCode, claimId) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.status !== 'rejected' || !claim.escalated) return;
    claim.escalated = false;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_CLAIM_ESCALATION_DISMISS', `[하자보수 재검토 반려] 오더 ${order.code}의 하자보수 신청("${claim.title}") 재검토 요청을 검토했으나 기존 반려 결정을 유지합니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `하자보수 신청("${claim.title}")에 대한 매니저 재검토 결과, 기존 반려 결정이 유지됩니다.`);
    showToast('재검토 요청을 확인했습니다. 기존 반려 결정을 유지합니다.', 'info');
    searchOrderLookup();
}

/* 고객의 완료 처리 이의제기(disputeCompletedRepairClaim, client_panel.js)를 관리자가
 * 승인(재작업 필요 — in_progress로 되돌림)/반려(완료 처리 유지) 중 하나로 처리한다. */
function adminApproveRepairClaimCompletionDispute(orderCode, claimId) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || !claim.completionDisputed || claim.completionDisputeResolution) return;
    claim.status = 'in_progress';
    claim.completionDisputeResolution = 'approved';
    claim.completionDisputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_CLAIM_COMPLETION_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 하자보수 신청("${claim.title}") 완료 처리 이의제기를 승인하여 처리중으로 되돌렸습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 승인되어 하자보수("${claim.title}")가 다시 처리중 상태로 전환되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `하자보수("${claim.title}") 완료 처리에 고객이 이의제기했고, 매니저 센터가 승인하여 재작업이 필요합니다.`);
    showToast('이의제기를 승인하여 처리중 상태로 되돌렸습니다.', 'success');
    searchOrderLookup();
}

function adminRejectRepairClaimCompletionDispute(orderCode, claimId, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || !claim.completionDisputed || claim.completionDisputeResolution) return;
    claim.completionDisputeResolution = 'rejected';
    claim.completionDisputeAdminResponse = reason;
    claim.completionDisputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_CLAIM_COMPLETION_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 하자보수 신청("${claim.title}") 완료 처리 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 반려되었습니다. 사유: ${reason}`);
    showToast('이의제기를 반려했습니다.', 'info');
    searchOrderLookup();
}

/* 고객의 시공 진행 단계 이의제기(disputeProgressStage, client_panel.js)를 관리자가
 * 승인(재작업 필요 — 단계를 다시 미완료로 되돌림)/반려(완료 표시 유지) 중 하나로
 * 처리한다. 승인 시엔 disputed 플래그도 초기화해 파트너가 재작업 후 다시
 * 완료 표시하면 깨끗한 상태에서 시작하게 한다. */
function adminApproveProgressStageDispute(orderCode, stageIndex) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const stages = order && getOrInitProgressStages(order);
    const stage = stages && stages[stageIndex];
    if (!stage || !stage.disputed || stage.disputeResolution) return;
    stage.done = false;
    stage.date = null;
    stage.disputed = false;
    stage.disputeResolution = null;
    stage.disputeReason = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PROGRESS_STAGE_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 시공 단계("${stage.label}") 완료 표시 이의제기를 승인하여 미완료로 되돌렸습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 승인되어 "${stage.label}" 단계가 다시 진행중 상태로 전환되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `"${stage.label}" 단계 완료 표시에 고객이 이의제기했고, 매니저 센터가 승인하여 재작업이 필요합니다.`);
    showToast('이의제기를 승인하여 미완료 상태로 되돌렸습니다.', 'success');
    searchOrderLookup();
}

function adminRejectProgressStageDispute(orderCode, stageIndex, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const stages = order && getOrInitProgressStages(order);
    const stage = stages && stages[stageIndex];
    if (!stage || !stage.disputed || stage.disputeResolution) return;
    stage.disputeResolution = 'rejected';
    stage.disputeAdminResponse = reason;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PROGRESS_STAGE_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 시공 단계("${stage.label}") 완료 표시 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 반려되었습니다. 사유: ${reason}`);
    showToast('이의제기를 반려했습니다.', 'info');
    searchOrderLookup();
}

/* 고객의 실측 방문 완료 처리 이의제기(disputeSiteVisitCompletion, client_panel.js)를
 * 관리자가 승인(재방문 필요 — confirmed로 되돌림)/반려(완료 유지) 중 하나로
 * 처리한다. 시공 진행 단계 이의제기(adminApprove/RejectProgressStageDispute)와
 * 동일한 패턴. */
function adminApproveSiteVisitCompletionDispute(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const visit = order && order.siteVisit;
    if (!visit || !visit.disputed || visit.disputeResolution) return;
    visit.status = 'confirmed';
    visit.completedDate = null;
    visit.disputed = false;
    visit.disputeResolution = null;
    visit.disputeReason = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'SITE_VISIT_COMPLETION_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 실측 방문 완료 처리 이의제기를 승인하여 확정 상태로 되돌렸습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 승인되어 실측 방문이 다시 확정 상태로 전환되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `실측 방문 완료 처리에 고객이 이의제기했고, 매니저 센터가 승인하여 재방문이 필요합니다.`);
    showToast('이의제기를 승인하여 확정 상태로 되돌렸습니다.', 'success');
    searchOrderLookup();
}

function adminRejectSiteVisitCompletionDispute(orderCode, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const visit = order && order.siteVisit;
    if (!visit || !visit.disputed || visit.disputeResolution) return;
    visit.disputeResolution = 'rejected';
    visit.disputeAdminResponse = reason;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'SITE_VISIT_COMPLETION_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 실측 방문 완료 처리 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 반려되었습니다. 사유: ${reason}`);
    showToast('이의제기를 반려했습니다.', 'info');
    searchOrderLookup();
}

/* adminApprove/RejectSiteVisitCompletionDispute와 동일한 승인/반려 대칭 구조를
 * 하자보수 방문 완료 처리 이의제기에도 적용한다 — 승인 시 확정 상태로 되돌려
 * 파트너가 재방문(completeRepairVisit)을 다시 처리할 수 있게 한다. */
function adminApproveRepairVisitCompletionDispute(orderCode, claimId) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || !claim.visitCompletionDisputed || claim.visitCompletionDisputeResolution) return;
    claim.visitStatus = 'confirmed';
    claim.visitCompletedDate = null;
    claim.visitCompletionDisputed = false;
    claim.visitCompletionDisputeResolution = null;
    claim.visitCompletionDisputeReason = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_VISIT_COMPLETION_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 하자보수 방문 완료 처리 이의제기를 승인하여 확정 상태로 되돌렸습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 승인되어 하자보수 방문이 다시 확정 상태로 전환되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `하자보수 방문 완료 처리에 고객이 이의제기했고, 매니저 센터가 승인하여 재방문이 필요합니다.`);
    showToast('이의제기를 승인하여 확정 상태로 되돌렸습니다.', 'success');
    searchOrderLookup();
}

function adminRejectRepairVisitCompletionDispute(orderCode, claimId, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || !claim.visitCompletionDisputed || claim.visitCompletionDisputeResolution) return;
    claim.visitCompletionDisputeResolution = 'rejected';
    claim.visitCompletionDisputeAdminResponse = reason;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REPAIR_VISIT_COMPLETION_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 하자보수 방문 완료 처리 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 이의제기가 반려되었습니다. 사유: ${reason}`);
    showToast('이의제기를 반려했습니다.', 'info');
    searchOrderLookup();
}

/* 하자보수 재검토 요청(escalateRepairClaimToAdmin)과 동일하게, 고객이 이의제기한
 * 마일스톤 청구(submitMilestoneDispute)도 관리자가 승인(청구 취소, 파트너가
 * 필요 시 재청구)/반려(기존 청구 유지, 고객이 다시 납부해야 함) 중 하나로 처리한다. */
function adminApproveMilestoneDispute(orderCode, key) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'disputed') return;
    m.status = 'pending';
    m.requestedDate = null;
    m.dueDate = null;
    m.overdueNotified = false;
    m.dueSoonNotified = false;
    m.disputeResolution = 'approved';
    m.disputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PAYMENT_MILESTONE_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 ${m.label} 청구 이의제기를 승인하여 청구를 취소했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 ${m.label} 청구 이의제기가 승인되어 청구가 취소되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `${m.label} 청구 이의제기가 승인되어 청구가 취소되었습니다. 필요 시 다시 청구해 주세요.`);
    showToast(`[${order.code}] ${m.label} 청구 이의제기를 승인하여 청구를 취소했습니다.`, 'success');
    searchOrderLookup();
}

function adminRejectMilestoneDispute(orderCode, key, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'disputed') return;
    m.status = 'requested';
    m.disputeResolution = 'rejected';
    m.disputeAdminResponse = reason;
    m.disputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PAYMENT_MILESTONE_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 ${m.label} 청구 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `제출하신 ${m.label} 청구 이의제기가 반려되었습니다. 사유: ${reason}`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `${m.label} 청구 이의제기가 반려되어 청구가 유지됩니다.`);
    showToast(`[${order.code}] ${m.label} 청구 이의제기를 반려했습니다.`, 'info');
    searchOrderLookup();
}

/* adminApprove/RejectMilestoneDispute(청구 자체에 대한 고객측 이의제기)와 대칭되는
 * 파트너측 미입금 이의제기 심사 — 승인(파트너 말이 맞음)이면 다시 청구 상태로
 * 되돌려 고객이 실제로 납부해야 하고, 반려(고객 말이 맞음)면 납부완료로 복원한다. */
function adminApprovePaymentReceiptDispute(orderCode, key) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'payment_disputed') return;
    m.status = 'requested';
    m.paidDate = null;
    const due = new Date();
    due.setDate(due.getDate() + 7);
    m.dueDate = due.toISOString().slice(0, 10);
    m.overdueNotified = false;
    m.dueSoonNotified = false;
    m.paymentDisputeResolution = 'approved';
    m.paymentDisputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PAYMENT_MILESTONE_RECEIPT_DISPUTE_APPROVE', `[이의제기 승인] 오더 ${order.code}의 ${m.label} 미입금 이의제기를 승인하여 다시 청구 상태로 되돌렸습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${m.label} 납부완료 처리가 미입금 이의제기 승인으로 취소되었습니다. 다시 납부를 확인해 주세요. (납부기한 ${m.dueDate})`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `${m.label} 미입금 이의제기가 승인되어 다시 청구 상태로 전환되었습니다.`);
    showToast(`[${order.code}] ${m.label} 미입금 이의제기를 승인했습니다.`, 'success');
    searchOrderLookup();
}

function adminRejectPaymentReceiptDispute(orderCode, key, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const m = order && getOrInitPaymentMilestones(order).find(x => x.key === key);
    if (!m || m.status !== 'payment_disputed') return;
    m.status = 'paid';
    m.paymentDisputeResolution = 'rejected';
    m.paymentDisputeAdminResponse = reason;
    m.paymentDisputeResolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PAYMENT_MILESTONE_RECEIPT_DISPUTE_REJECT', `[이의제기 반려] 오더 ${order.code}의 ${m.label} 미입금 이의제기를 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${m.label} 미입금 이의제기가 반려되어 납부완료 상태가 유지됩니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `${m.label} 미입금 이의제기가 반려되었습니다. 사유: ${reason}`);
    showToast(`[${order.code}] ${m.label} 미입금 이의제기를 반려했습니다.`, 'info');
    searchOrderLookup();
}

function adminResolveScheduleChangeRequest(orderCode, approve) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || !order.scheduleChangeRequest || order.scheduleChangeRequest.status !== 'pending') return;
    const { newDate } = order.scheduleChangeRequest;
    const oldDate = order.preferredDate;
    if (approve) order.preferredDate = newDate;
    order.scheduleChangeRequest = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'SCHEDULE_CHANGE_FORCE_RESOLVE', `[착공일 변경 직권 ${approve ? '승인' : '반려'}] 오더 ${order.code}의 일정 변경 요청을 매니저가 직권으로 ${approve ? `승인 처리했습니다 (${oldDate} → ${newDate})` : '반려했습니다'}.`, 'WARNING');
    const msg = `착공일 변경 요청이 매니저 센터 직권으로 ${approve ? `승인되어 착공일이 ${newDate}로 변경되었습니다` : '반려되어 기존 일정이 유지됩니다'}.`;
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, msg);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, msg);
    showToast(`일정 변경 요청을 매니저 직권으로 ${approve ? '승인' : '반려'}했습니다.`, 'success');
    searchOrderLookup();
}

function adminResolvePriceChangeRequest(orderCode, approve) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || !order.priceChangeRequest || order.priceChangeRequest.status !== 'pending') return;
    const { newPrice } = order.priceChangeRequest;
    const oldPrice = order.finalPrice;
    if (approve) order.finalPrice = newPrice;
    order.priceChangeRequest = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PRICE_CHANGE_FORCE_RESOLVE', `[계약 금액 변경 직권 ${approve ? '승인' : '반려'}] 오더 ${order.code}의 금액 변경 요청을 매니저가 직권으로 ${approve ? `승인 처리했습니다 (₩${(oldPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원)` : '반려했습니다'}.`, 'WARNING');
    const msg = `계약 금액 변경 요청이 매니저 센터 직권으로 ${approve ? `승인되어 계약 금액이 ₩${newPrice.toLocaleString()}만원으로 변경되었습니다` : '반려되어 기존 금액이 유지됩니다'}.`;
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, msg);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, msg);
    showToast(`금액 변경 요청을 매니저 직권으로 ${approve ? '승인' : '반려'}했습니다.`, 'success');
    searchOrderLookup();
}

/* 관리자는 이미 체결된 계약을 직권으로 취소할 수 있지만(adminForceCancelContract),
 * 계약 전 입찰 단계에서 특정 파트너의 제안이 허위·위반 소지가 있어도 관리자가
 * 개별 입찰을 무효화할 방법은 없었다 — cancelPartnerBid(client_panel.js)와 동일한
 * excludedPartners 등록 패턴을 관리자 직권 조치로도 열어준다. */
function adminInvalidateBid(orderCode, partnerName, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding') { showToast('입찰 심사중 상태의 오더만 개별 입찰을 무효화할 수 있어요.', 'warning'); return; }
    if (!order.bids || !order.bids.some(b => b.partner === partnerName)) return;

    order.bids = order.bids.filter(b => b.partner !== partnerName);
    if (!order.excludedPartners) order.excludedPartners = [];
    if (!order.excludedPartners.includes(partnerName)) order.excludedPartners.push(partnerName);
    if (!order.adminInvalidatedBids) order.adminInvalidatedBids = [];
    order.adminInvalidatedBids = order.adminInvalidatedBids.filter(ib => ib.partnerName !== partnerName);
    order.adminInvalidatedBids.push({ partnerName, reason, date: getLocalDateString() });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BID_INVALIDATE', `[입찰 직권 무효화] 오더 ${order.code}의 [${partnerName}] 입찰을 매니저가 무효화했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `오더(${orderCode}) 입찰이 매니저 센터 직권으로 무효화되었습니다. 사유: ${reason}`);
    if (order.bids.length === 0 && typeof pushClientNotification === 'function') {
        pushClientNotification(order.clientPhone, `오더(${orderCode})에 남은 입찰 제안이 없어요. 마이페이지에서 재매칭을 받아보세요.`);
    }
    showToast(`[${partnerName}] 입찰을 무효화했습니다.`, 'success');
    searchOrderLookup();
}

function adminRestoreInvalidatedBid(orderCode, partnerName) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding') return;
    if (!order.adminInvalidatedBids || !order.adminInvalidatedBids.some(ib => ib.partnerName === partnerName)) return;

    order.adminInvalidatedBids = order.adminInvalidatedBids.filter(ib => ib.partnerName !== partnerName);
    if (order.excludedPartners) order.excludedPartners = order.excludedPartners.filter(p => p !== partnerName);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BID_RESTORE', `[입찰 자격 복원] 오더 ${order.code}에서 [${partnerName}]의 직권 무효화 조치를 취소하고 재입찰 자격을 복원했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `오더(${orderCode})의 입찰 무효화 조치가 취소되어 재입찰 자격이 복원되었습니다.`);
    showToast(`[${partnerName}]의 입찰 자격을 복원했습니다.`, 'success');
    searchOrderLookup();
}

/* 파트너가 입찰 무효화에 이의신청을 제출할 수 있게 됐으니(openInvalidatedBidAppealModal,
 * cms.js), 관리자 쪽에도 반려 경로가 필요하다 — 승인은 adminRestoreInvalidatedBid로
 * 이미 처리되므로(복원 자체가 승인이다), 반려만 별도로 둔다. */
function adminRejectInvalidatedBidAppeal(orderCode, partnerName, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const entry = order && order.adminInvalidatedBids && order.adminInvalidatedBids.find(ib => ib.partnerName === partnerName);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'INVALIDATED_BID_APPEAL_REJECT', `[이의신청 반려] 오더 ${order.code}의 [${partnerName}] 입찰 무효화 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `입찰 무효화 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${partnerName}]의 이의신청을 반려했습니다.`, 'info');
    searchOrderLookup();
}

/* 지금까지 관리자는 고객/파트너가 먼저 계약 취소를 요청해야만(cancel_requested)
 * 승인/반려할 수 있었다 — 관제 로그·블랙리스트에서 사기·분쟁 정황을 포착해도
 * 관리자가 스스로 계약을 취소시킬 방법이 없었다. approveContractCancellation과
 * 동일한 환불 플래그 로직을 재사용하되, 사전 요청 없이도 바로 취소할 수 있게 한다. */
function adminForceCancelContract(orderCode, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'contracted') { showToast('계약 체결 상태의 오더만 강제 취소할 수 있어요.', 'warning'); return; }

    order.status = 'cancelled';
    order.cancelRequest = { reason, requestedBy: 'admin', date: getLocalDateString() };

    const needsRefund = !!order.commissionPaid;
    if (needsRefund) {
        order.refundStatus = 'pending';
        order.refundAmount = Math.floor((order.finalPrice || 0) * PLATFORM_COMMISSION_RATE);
    }

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CONTRACT_FORCE_CANCEL', `[계약 강제 취소] 오더 ${order.code}를 매니저가 직권으로 취소했습니다. 사유: ${reason}${needsRefund ? ` (수수료 환불 대상 ₩${order.refundAmount.toLocaleString()}만원)` : ''}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약(${order.code})이 매니저 센터 직권으로 취소되었습니다. 사유: ${reason}`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) {
        pushPartnerNotification(order.acceptedPartner, needsRefund
            ? `계약(${order.code})이 매니저 센터 직권으로 취소되었습니다. 이미 납부하신 플랫폼 수수료 ₩${order.refundAmount.toLocaleString()}만원은 환불 처리할 예정입니다.`
            : `계약(${order.code})이 매니저 센터 직권으로 취소되었습니다.`);
    }
    showToast(`오더 ${order.code}의 계약을 강제 취소했습니다.${needsRefund ? ' 수수료 환불 대기 목록에 등록되었어요.' : ''}`, 'success');
    searchOrderLookup();
    if (typeof renderAdminRefundPendingList === 'function') renderAdminRefundPendingList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

/* 강제 취소에 고객·파트너가 이의신청을 제출할 수 있게 됐으니(openForceCancelAppealModal/
 * openPartnerForceCancelAppealModal), 관리자 쪽 심사 경로가 필요하다. 승인하면 계약을
 * 그대로 복원하고(환불 대기였다면 취소), 반려하면 취소 결정을 유지한다. */
function adminApproveForceCancelAppeal(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || !order.cancelRequest || !order.cancelRequest.appeal || order.cancelRequest.appeal.status !== 'pending') return;

    order.status = 'contracted';
    if (order.refundStatus === 'pending') { order.refundStatus = null; order.refundAmount = null; }
    order.cancelRequest = null;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'FORCE_CANCEL_APPEAL_APPROVE', `[이의신청 승인] 오더 ${order.code}의 강제 취소 조치를 재검토하여 계약을 복원했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약(${order.code}) 강제 취소 이의신청이 승인되어 계약이 복원되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `계약(${order.code}) 강제 취소 이의신청이 승인되어 계약이 복원되었습니다.`);
    showToast(`오더 ${order.code}의 계약을 복원했습니다.`, 'success');
    searchOrderLookup();
    if (typeof renderAdminRefundPendingList === 'function') renderAdminRefundPendingList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

function adminRejectForceCancelAppeal(orderCode, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || !order.cancelRequest || !order.cancelRequest.appeal || order.cancelRequest.appeal.status !== 'pending') return;
    order.cancelRequest.appeal.status = 'rejected';
    order.cancelRequest.appeal.adminResponse = reason;
    order.cancelRequest.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'FORCE_CANCEL_APPEAL_REJECT', `[이의신청 반려] 오더 ${order.code}의 강제 취소 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `계약(${order.code}) 강제 취소 이의신청이 반려되었습니다. 사유: ${reason}`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `계약(${order.code}) 강제 취소 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
    searchOrderLookup();
}

/* 파트너가 업로드한 계약서·견적서는 지금까지 관리자가 열람만 할 수 있었고, 서류가
 * 잘못됐거나 위조가 의심돼도 반려하고 재제출을 요청할 방법이 없었다 — 파트너
 * 입점 심사의 "정보 보완 요청"(500994a)과 동일한 반려→재제출 패턴을 적용한다.
 * 파일 자체를 지워 업로드 카드가 다시 "대기중"으로 보이게 한다. */
/* 파트너 신청서 반려는 재정보요청/이의신청 경로가 있고, 후기·시공사례·게시글
 * 삭제도 전부 스냅샷+이의신청 경로가 있는데, 계약서/견적서 반려만 파일을 그냥
 * 지워버리고 끝이라 관리자 판단이 틀렸어도 파트너가 되돌릴 방법이 전혀 없었다. */
function adminRejectPartnerDoc(orderCode, docType, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order) return;
    const label = docType === 'contract' ? '계약서' : '견적서';
    const hadDoc = docType === 'contract' ? order.contractDoc : order.estimateDoc;
    if (!hadDoc) return;

    if (docType === 'contract') order.contractDoc = null; else order.estimateDoc = null;
    if (!order.docRejections) order.docRejections = {};
    order.docRejections[docType] = { reason, date: getLocalDateString(), docSnapshot: hadDoc, appeal: null };

    if (typeof pushLog === 'function') pushLog('MANAGER', 'DOC_REJECT', `[서류 반려] 오더 ${order.code}의 ${label}를 매니저가 반려하고 재제출을 요청했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `오더(${order.code})에 제출하신 ${label}가 반려되었습니다. 사유: ${reason} 새 파일로 다시 업로드하거나, 부당하다고 생각되시면 이의신청하실 수 있어요.`);
    showToast(`${label}를 반려하고 재제출을 요청했습니다.`, 'success');
    searchOrderLookup();
}

function appealPartnerDocRejection(orderCode, docType, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const rejection = order && order.docRejections && order.docRejections[docType];
    if (!rejection) return;
    if (rejection.appeal && rejection.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    const label = docType === 'contract' ? '계약서' : '견적서';
    rejection.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'DOC_REJECT_APPEAL', `[${order.acceptedPartner}]가 오더(${order.code}) ${label} 반려에 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');
    openPartnerOrderDetailModal(order.code);
}

function adminApproveDocRejectionAppeal(orderCode, docType) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const rejection = order && order.docRejections && order.docRejections[docType];
    if (!rejection || !rejection.appeal || rejection.appeal.status !== 'pending') return;
    const label = docType === 'contract' ? '계약서' : '견적서';
    if (docType === 'contract') order.contractDoc = rejection.docSnapshot; else order.estimateDoc = rejection.docSnapshot;
    delete order.docRejections[docType];

    if (typeof pushLog === 'function') pushLog('MANAGER', 'DOC_REJECT_APPEAL_APPROVE', `[이의신청 승인] 오더 ${order.code}의 ${label} 반려 이의신청을 승인하여 서류를 복원했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `제출하신 ${label} 반려 이의신청이 승인되어 서류가 복원되었습니다.`);
    showToast(`${label}를 복원했습니다.`, 'success');
    searchOrderLookup();
}

function adminRejectDocRejectionAppeal(orderCode, docType, reason) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const rejection = order && order.docRejections && order.docRejections[docType];
    if (!rejection || !rejection.appeal || rejection.appeal.status !== 'pending') return;
    const label = docType === 'contract' ? '계약서' : '견적서';
    rejection.appeal.status = 'rejected';
    rejection.appeal.adminResponse = reason;
    rejection.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'DOC_REJECT_APPEAL_REJECT', `[이의신청 반려] 오더 ${order.code}의 ${label} 반려 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `제출하신 ${label} 반려 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
    searchOrderLookup();
}

/* 파트너/고객/로그는 전부 CSV로 내보낼 수 있는데, 어느 관리자 탭에서든 쓸 수 있는
 * 통합 오더 조회창(searchOrderLookup)만 CSV 내보내기가 없었다 — 화면에는 10건까지만
 * 보여주지만(성능/가독성 목적) CSV는 검색 조건에 맞는 전체 건수를 내보낸다. */
function exportOrderLookupResultsToCsv() {
    const input = document.getElementById('admin-order-lookup-input');
    const query = (input?.value || '').trim().toLowerCase();
    if (!query) { showToast('먼저 조회할 의뢰코드·고객명·연락처를 입력해 주세요.', 'warning'); return; }

    const matches = getOrderLookupMatches(query);
    if (matches.length === 0) { showToast('내보낼 조회 결과가 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const statusText = (o) => o.status === 'withdrawn' ? '철회됨' : o.status === 'contracted' ? '계약 체결' : o.is1on1 ? '1:1 지정' : '입찰 심사중';
    const header = ['의뢰코드', '고객명', '연락처', '주소', '평형', '입찰수', '참여사제한', '계약파트너', '상태', '금액(만원)'].map(escapeCsvCell).join(',');
    const rows = matches.map(o => [
        o.code, o.clientName, o.clientPhone || '-', o.clientAddress || '-', o.pyung || '-',
        o.bids ? o.bids.length : 0, o.partnerCountLimit || '-', o.acceptedPartner || '-', statusText(o), (o.finalPrice || o.budget || 0)
    ].map(escapeCsvCell).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_오더조회_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ORDER_LOOKUP_EXPORT', `[오더 조회] 매니저가 "${query}" 조회 결과 ${matches.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`오더 ${matches.length}건을 CSV로 내보냈습니다.`, 'success');
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
        .filter(t => !query || (t.role === 'partner' ? t.partnerName : t.clientName).toLowerCase().includes(query) || (t.clientPhone || '').includes(query) || t.subject.toLowerCase().includes(query))
        .slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) || (new Date(b.date) - new Date(a.date)));

    if (tickets.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap"><i data-lucide="inbox" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">${allTickets.length === 0 ? '등록된 고객 문의가 없습니다.' : '조건에 해당되는 문의가 없습니다.'}</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = tickets.map(t => {
        const followUps = t.followUps || [];
        const followUpsHtml = followUps.map((f, idx) => {
            const isLastPending = !f.adminReply && idx === followUps.length - 1;
            return `
            <div class="pl-3 border-l-2 border-ink-200 space-y-1.5">
                <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(f.clientMessage)} <span class="text-[10px] text-ink-400 font-bold">(${f.clientDate})</span></p>
                ${f.adminReply
                    ? `<div class="p-3 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">답변 (${f.adminReplyDate})</p><p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(f.adminReply)}</p></div>`
                    : isLastPending
                        ? `<div class="flex gap-2 pt-1"><input type="text" id="ticket-followup-reply-input-${t.id}" placeholder="추가 문의에 답변을 입력하세요" class="input flex-1 text-xs"><button type="button" onclick="replyToSupportTicketFollowUp('${t.id}')" class="btn btn-dark btn-sm shrink-0">답변 등록</button></div>`
                        : ''}
            </div>`;
        }).join('');
        const hasPendingFollowUp = followUps.length > 0 && !followUps[followUps.length - 1].adminReply;

        return `
        <div class="surface p-4 space-y-2.5 text-left ${t.status === 'open' ? 'border border-amber-200' : ''}">
            <div class="flex justify-between items-start gap-2">
                <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2 text-[10px] font-bold text-ink-400">
                        <span class="badge ${t.status === 'answered' ? 'badge-emerald' : 'badge-amber'}">${t.status === 'answered' ? '답변 완료' : '답변 대기'}</span>
                        <span class="badge ${t.role === 'partner' ? 'badge-brand' : 'badge-neutral'}">${t.role === 'partner' ? '파트너' : '고객'}</span>
                        <span>${t.date} · ${t.role === 'partner' ? escapeHtml(t.partnerName) : `${escapeHtml(t.clientName)} (${t.clientPhone || '-'})`}</span>
                    </div>
                    <h5 class="text-sm font-black text-ink-950">${escapeHtml(t.subject)}</h5>
                    <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(t.message)}</p>
                </div>
            </div>
            ${t.adminReply ? `
                <div class="p-3 rounded-lg" style="background:var(--brand-50)"><p class="text-[10px] font-black text-brand-700 mb-0.5">답변 (${t.adminReplyDate})</p><p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(t.adminReply)}</p></div>
            ` : !hasPendingFollowUp ? `
                <div class="flex gap-2 pt-1">
                    <input type="text" id="ticket-reply-input-${t.id}" placeholder="답변을 입력하세요" class="input flex-1 text-xs">
                    <button type="button" onclick="replyToSupportTicket('${t.id}')" class="btn btn-dark btn-sm shrink-0">답변 등록</button>
                </div>
            ` : ''}
            ${followUpsHtml ? `<div class="space-y-2.5 pt-1">${followUpsHtml}</div>` : ''}
        </div>`;
    }).join('');
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

    if (ticket.role === 'partner') {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'SUPPORT_REPLY', `[파트너 문의 답변] '${ticket.partnerName}'의 문의(${ticket.subject})에 답변 완료.`, 'SUCCESS');
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(ticket.partnerName, `매니저 센터에서 문의(${ticket.subject})에 답변을 남겼어요.`);
    } else {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'SUPPORT_REPLY', `[고객 문의 답변] '${ticket.clientName}' 고객님의 문의(${ticket.subject})에 답변 완료.`, 'SUCCESS');
        if (typeof pushClientNotification === 'function') pushClientNotification(ticket.clientPhone, `고객센터에서 문의(${ticket.subject})에 답변을 남겼어요.`);
    }
    showToast('답변이 등록되었습니다.', 'success');
    renderAdminSupportTickets();
}

/* 답변 완료 후 고객이 남긴 추가 문의(followUps)에 답변한다 — replyToSupportTicket과
 * 동일한 검증/알림 패턴이지만 대상이 원본 문의가 아니라 followUps 배열의 마지막
 * (아직 답변 안 된) 라운드라는 점만 다르다. */
function replyToSupportTicketFollowUp(ticketId) {
    const ticket = (window.AppState.supportTickets || []).find(t => t.id === ticketId);
    if (!ticket || !ticket.followUps || ticket.followUps.length === 0) return;
    const followUp = ticket.followUps[ticket.followUps.length - 1];
    if (followUp.adminReply) return;

    const input = document.getElementById(`ticket-followup-reply-input-${ticketId}`);
    const reply = input ? input.value.trim() : '';
    if (!reply) { showToast('답변 내용을 입력해 주세요.', 'warning'); return; }

    followUp.adminReply = reply;
    followUp.adminReplyDate = getLocalDateString();
    ticket.status = 'answered';

    if (ticket.role === 'partner') {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'SUPPORT_REPLY', `[파트너 문의 추가답변] '${ticket.partnerName}'의 추가 문의(${ticket.subject})에 답변 완료.`, 'SUCCESS');
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(ticket.partnerName, `매니저 센터에서 추가 문의(${ticket.subject})에 답변을 남겼어요.`);
    } else {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'SUPPORT_REPLY', `[고객 문의 추가답변] '${ticket.clientName}' 고객님의 추가 문의(${ticket.subject})에 답변 완료.`, 'SUCCESS');
        if (typeof pushClientNotification === 'function') pushClientNotification(ticket.clientPhone, `고객센터에서 추가 문의(${ticket.subject})에 답변을 남겼어요.`);
    }
    showToast('답변이 등록되었습니다.', 'success');
    renderAdminSupportTickets();
}

/* 발송 대상(전체 고객/전체 파트너)에 따라 세그먼트 필터 UI를 전환한다. 파트너
 * 모니터링에 이미 있는 지역 필터, 고객 관리에 이미 있는 이용정지 필터를 재사용해
 * "해운대구 파트너에게만" / "정상 고객에게만" 같은 타겟팅을 가능하게 한다. */
function updateAdminBroadcastSegmentUI() {
    const target = document.getElementById('admin-broadcast-target')?.value || 'clients';
    const regionWrap = document.getElementById('admin-broadcast-region-wrap');
    const statusWrap = document.getElementById('admin-broadcast-status-wrap');
    if (regionWrap) regionWrap.classList.toggle('hidden', target !== 'partners');
    if (statusWrap) statusWrap.classList.toggle('hidden', target !== 'clients');

    const regionSelect = document.getElementById('admin-broadcast-region');
    if (regionSelect && target === 'partners' && regionSelect.options.length <= 1) {
        const regions = [...new Set((window.AppState.partners || []).map(p => p.region).filter(Boolean))].sort();
        regionSelect.innerHTML = `<option value="all">전체 지역</option>` + regions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    }
}

/* 관리자가 전체 고객/전체 파트너에게 한 번에 공지를 보낼 방법이 지금까지 전혀 없었다
 * (1:1 알림 시스템만 존재). 기존 pushClientNotification/pushPartnerNotification과 동일한
 * 데이터 모양으로 대량 삽입하되, 매 건마다 다시 렌더링하지 않고 발송 종료 후 한 번만 갱신한다.
 * 이후 대상 전체 일괄 발송만 가능해 지역/상태로 좁혀 보낼 방법이 없던 공백을 메워,
 * 파트너는 활동 지역으로, 고객은 이용정지 여부로 필터링해 발송할 수 있게 확장한다. */
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
    let segmentLabel = '';

    if (target === 'partners') {
        const region = document.getElementById('admin-broadcast-region')?.value || 'all';
        const partners = (window.AppState.partners || []).filter(p => p.status === 'active' && (region === 'all' || p.region === region));
        partners.forEach(p => {
            window.AppState.partnerNotifications.unshift({ id: `pntf-${Date.now()}-${Math.floor(Math.random() * 100000)}`, partnerName: p.name, message: noticeText, date: nowIso, read: false });
            recipientCount++;
        });
        if (window.AppState.partnerNotifications.length > 200) window.AppState.partnerNotifications.length = 200;
        if (typeof renderPartnerNotifications === 'function') renderPartnerNotifications();
        if (typeof updatePartnerNotificationBadge === 'function') updatePartnerNotificationBadge();
        segmentLabel = region === 'all' ? '전체 파트너사' : `${region} 파트너사`;
    } else {
        const statusFilter = document.getElementById('admin-broadcast-status')?.value || 'all';
        const clients = (window.AppState.clientAccounts || []).filter(acc => {
            if (!acc.phone || acc.status === 'withdrawn') return false;
            if (statusFilter === 'normal') return !acc.isSuspended;
            if (statusFilter === 'suspended') return !!acc.isSuspended;
            return true;
        });
        clients.forEach(acc => {
            window.AppState.clientNotifications.unshift({ id: `ntf-${Date.now()}-${Math.floor(Math.random() * 100000)}`, clientPhone: acc.phone, message: noticeText, date: nowIso, read: false });
            recipientCount++;
        });
        if (window.AppState.clientNotifications.length > 200) window.AppState.clientNotifications.length = 200;
        if (typeof renderClientMyPage === 'function') renderClientMyPage();
        segmentLabel = statusFilter === 'normal' ? '정상 이용 고객' : statusFilter === 'suspended' ? '이용정지 고객' : '전체 고객';
    }

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BROADCAST', `${segmentLabel} ${recipientCount}명에게 공지 발송: "${message.slice(0, 40)}${message.length > 40 ? '...' : ''}"`, 'SUCCESS');
    showToast(`${segmentLabel} ${recipientCount}명에게 공지가 발송되었습니다.`, 'success');
    if (msgInput) msgInput.value = '';
}

/* 전체 공지 발송(sendAdminBroadcastNotification)은 세그먼트(지역/상태) 단위로만
 * 보낼 수 있었고, 특정 파트너/고객 한 명에게 개별적으로 알릴 방법이 없었다 —
 * 예를 들어 신고를 검토한 뒤 "정보 보완이 필요합니다"처럼 한 명에게만 전달할
 * 메시지를 보내려면 억지로 전체 공지를 쓰거나 아예 방법이 없었다. */
let _adminDmTarget = null;

/* 1:1 쪽지가 일방향 알림 발송에 그쳐, 받는 쪽이 답장할 방법이 없었다 — 문의나
 * 소명이 필요한 내용이어도 관리자가 다시 확인할 방법 없이 새 쪽지로만 대응해야
 * 했다. (type, identifier) 쌍마다 지속되는 스레드를 두어 여러 번 주고받을 수
 * 있게 한다. */
function findOrCreateDmThread(type, identifier, displayName) {
    if (!window.AppState.directMessageThreads) window.AppState.directMessageThreads = [];
    let thread = window.AppState.directMessageThreads.find(t => t.type === type && t.identifier === identifier);
    if (!thread) {
        thread = { id: `dmthread-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type, identifier, displayName, messages: [], hasUnreadReply: false };
        window.AppState.directMessageThreads.push(thread);
    }
    return thread;
}

function renderDmThreadHistory(thread) {
    const container = document.getElementById('admin-direct-message-thread-history');
    if (!container) return;
    if (!thread || !thread.messages || thread.messages.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = thread.messages.map(m => `
        <div class="p-2 rounded-lg text-[11px] font-semibold leading-relaxed ${m.from === 'manager' ? 'bg-brand-50 text-brand-700 ml-6' : 'bg-ink-50 text-ink-700 mr-6'}">
            <span class="text-[9px] font-bold text-ink-400 block mb-0.5">${m.from === 'manager' ? '매니저' : escapeHtml(thread.displayName)} · ${m.date}</span>
            ${escapeHtml(m.text)}
        </div>`).join('');
}

function openAdminDirectMessageModal(type, identifier, displayName) {
    const thread = findOrCreateDmThread(type, identifier, displayName || identifier);
    thread.hasUnreadReply = false;
    _adminDmTarget = { type, identifier, displayName: displayName || identifier, threadId: thread.id };
    safeUpdateText('admin-direct-message-modal-title', `${_adminDmTarget.displayName}님께 쪽지 보내기`);
    safeUpdateValue('admin-direct-message-text', '');
    renderDmThreadHistory(thread);
    openModal('admin-direct-message-modal', 'admin-direct-message-modal-card');
    if (type === 'client' && typeof renderAdminClientManager === 'function') renderAdminClientManager();
    if (type === 'partner' && typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function closeAdminDirectMessageModal() {
    _adminDmTarget = null;
    closeModal('admin-direct-message-modal', 'admin-direct-message-modal-card');
}

function submitAdminDirectMessage() {
    if (!_adminDmTarget) return;
    const text = document.getElementById('admin-direct-message-text')?.value.trim();
    if (!text) { showToast('보낼 내용을 입력해 주세요.', 'warning'); return; }

    const { type, identifier, displayName, threadId } = _adminDmTarget;
    const thread = (window.AppState.directMessageThreads || []).find(t => t.id === threadId);
    if (thread) thread.messages.push({ from: 'manager', text, date: getLocalDateString() });

    if (type === 'partner' && typeof pushPartnerNotification === 'function') {
        pushPartnerNotification(identifier, `[매니저 쪽지] ${text}`, { dmThreadId: threadId });
    } else if (type === 'client' && typeof pushClientNotification === 'function') {
        pushClientNotification(identifier, `[매니저 쪽지] ${text}`, { dmThreadId: threadId });
    }

    if (typeof pushLog === 'function') pushLog('MANAGER', 'DIRECT_MESSAGE', `[1:1 쪽지] ${type === 'partner' ? '파트너' : '고객'} '${displayName}'에게 쪽지를 보냈습니다: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`, 'INFO');
    showToast(`${displayName}님께 쪽지를 보냈습니다.`, 'success');
    safeUpdateValue('admin-direct-message-text', '');
    renderDmThreadHistory(thread);
}

/* 파트너/고객이 매니저 쪽지에 답장하면(replyToManagerDirectMessage, client_panel.js/
 * partner_panel.js) 관리자가 알아챌 방법이 필요하다 — 파트너 모니터링/고객 관리
 * 카드의 "쪽지 보내기" 버튼 옆에 답장 도착 배지를 띄운다. */
function hasUnreadDmReply(type, identifier) {
    return (window.AppState.directMessageThreads || []).some(t => t.type === type && t.identifier === identifier && t.hasUnreadReply);
}

/* 지금까지 관리자 콘솔은 파트너 모니터링/블랙리스트/가입심사처럼 파트너 관리 도구는
 * 풍부한데, 고객 계정 목록을 한눈에 조회할 방법이 전혀 없었다(전화로 문의가 와도
 * 오더 코드를 모르면 검색조차 불가능). 고객별 의뢰/계약/후기 통계를 모아 보여주고,
 * 이미 있는 통합 오더 조회창(searchOrderLookup)으로 바로 넘겨준다. */
/* 파트너 모니터링에는 상태별 필터 탭이 있는데(renderAdminPartnerMonitor), 파트너
 * 신고가 쌓이는 '고객 관리' 탭은 자유 검색만 있어서 신고/정지 계정만 모아 보며
 * 트리아지할 방법이 없었다 — 동일한 필터 탭 패턴을 적용한다. */
let adminClientStatusFilter = 'all';

function setAdminClientStatusFilter(key) {
    adminClientStatusFilter = key;
    renderAdminClientManager();
}

function renderAdminClientManager() {
    const container = document.getElementById('admin-client-manager-list');
    if (!container) return;
    const query = (document.getElementById('admin-client-search-input')?.value || '').trim().toLowerCase();

    const allClients = (window.AppState.clientAccounts || []).filter(a => !a.managerRole);
    const reportedCount = allClients.filter(a => (window.AppState.clientReports || []).some(r => r.clientPhone === a.phone)).length;
    const suspendedCount = allClients.filter(a => a.isSuspended).length;
    const bannedCount = allClients.filter(a => a.status === 'banned').length;
    // 파트너 자진 입점 해지엔 '영구 제명'과 나란히 필터가 있는데(관리자 파트너 모니터링),
    // 고객 회원 탈퇴는 필터 탭이 없어 목록 전체를 훑어야만 탈퇴 회원을 찾을 수 있었다.
    const withdrawnCount = allClients.filter(a => a.status === 'withdrawn').length;

    const tabsEl = document.getElementById('admin-client-status-tabs');
    if (tabsEl) {
        const statusTabs = [
            ['all', '전체', allClients.length],
            ['reported', '신고됨', reportedCount],
            ['suspended', '이용 정지', suspendedCount],
            ['banned', '영구 제명', bannedCount],
            ['withdrawn', '탈퇴 회원', withdrawnCount]
        ];
        tabsEl.innerHTML = statusTabs.map(([key, label, count]) =>
            `<button type="button" onclick="setAdminClientStatusFilter('${key}')" class="gnb-tab ${adminClientStatusFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    const clients = adminClientStatusFilter === 'reported'
        ? allClients.filter(a => (window.AppState.clientReports || []).some(r => r.clientPhone === a.phone))
        : adminClientStatusFilter === 'suspended'
            ? allClients.filter(a => a.isSuspended)
            : adminClientStatusFilter === 'banned'
                ? allClients.filter(a => a.status === 'banned')
                : adminClientStatusFilter === 'withdrawn'
                    ? allClients.filter(a => a.status === 'withdrawn')
                    : allClients;
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
        const myReports = (window.AppState.clientReports || []).filter(r => r.clientPhone === acc.phone);
        const avgRating = typeof getClientAverageRating === 'function' ? getClientAverageRating(acc.phone) : null;
        const tierBadge = typeof buildClientTierBadgeHtml === 'function' ? buildClientTierBadgeHtml(acc.phone) : '';

        return `
        <div class="surface-flat p-4 space-y-2.5 text-left">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-1.5">
                        <p class="text-sm font-black text-ink-950">${escapeHtml(acc.name)} <span class="text-ink-400 font-bold text-xs">(${escapeHtml(acc.id)})</span></p>
                        ${tierBadge}
                        ${acc.status === 'withdrawn' ? '<span class="badge badge-neutral">탈퇴함</span>' : acc.status === 'banned' ? '<span class="badge badge-rose">영구 제명</span>' : acc.isSuspended ? '<span class="badge badge-rose">이용 정지</span>' : ''}
                        ${(acc.clientStrikeCount || 0) > 0 ? `<span class="badge badge-amber">경고 ${acc.clientStrikeCount}/3회</span>` : ''}
                        ${myReports.length > 0 ? `<span class="badge badge-amber">파트너 신고 ${myReports.length}건</span>` : ''}
                        ${avgRating ? `<span class="badge badge-neutral"><span class="text-gold-500">★</span> ${avgRating.avg} (파트너 평가 ${avgRating.count}건)</span>` : ''}
                    </div>
                    <p class="text-[11px] text-ink-500 font-bold">연락처 ${escapeHtml(acc.phone || '-')}</p>
                </div>
                <div class="flex items-center flex-wrap gap-3 text-[11px] font-bold text-ink-600 w-full sm:w-auto sm:shrink-0">
                    <span>의뢰 ${myOrders.length}건</span><span>계약 ${contractedCount}건</span><span>후기 ${reviewCount}건</span><span>관심업체 ${favoriteCount}곳</span>
                    <button type="button" onclick="jumpToClientOrderLookup('${escapeHtml(acc.phone || '')}')" class="btn btn-secondary btn-sm">의뢰 조회</button>
                    <button type="button" onclick="openAdminDirectMessageModal('client', '${escapeHtml(acc.phone || '')}', '${escapeHtml(acc.name)}')" class="btn btn-secondary btn-sm relative"><i data-lucide="send" class="w-3 h-3"></i> 쪽지 보내기${hasUnreadDmReply('client', acc.phone) ? `<span class="badge badge-rose absolute -top-2 -right-2 px-1.5">답장</span>` : ''}</button>
                    <button type="button" onclick="toggleClientSuspension('${acc.id}')" class="btn ${acc.isSuspended ? 'btn-dark' : 'btn-secondary'} btn-sm">${acc.isSuspended ? '정지 해제' : '계정 정지'}</button>
                    <button type="button" onclick="issueClientStrike('${acc.id}')" class="btn btn-secondary btn-sm">경고 부여</button>
                    ${(acc.clientStrikeCount || 0) > 0 || acc.status === 'banned' ? `<button type="button" onclick="resetClientStrikes('${acc.id}')" class="btn btn-secondary btn-sm">경고 초기화</button>` : ''}
                </div>
            </div>
            ${myReports.length > 0 ? `
            <div class="p-3 bg-amber-50 rounded-xl space-y-2">
                ${myReports.map(r => `
                <div class="space-y-1">
                    <p class="text-[11px] text-ink-700 font-semibold leading-relaxed">· [${escapeHtml(r.reportedByPartner)}] ${escapeHtml(r.reason)} <span class="text-[10px] text-ink-400 font-bold">(${r.orderCode} · ${r.date})</span></p>
                    ${r.appeal ? (r.appeal.status === 'pending' ? `
                    <div class="pl-3 flex items-center justify-between gap-2">
                        <p class="text-[10px] font-black text-brand-700">이의신청: ${escapeHtml(r.appeal.reason)}</p>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectClientReportAppeal('${r.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                            <button type="button" onclick="adminApproveClientReportAppeal('${r.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(신고 취하)</button>
                        </div>
                    </div>` : `<p class="pl-3 text-[10px] font-bold text-ink-400">이의신청 반려됨 — ${escapeHtml(r.appeal.adminResponse || '')}</p>`) : ''}
                </div>`).join('')}
            </div>` : ''}
            ${acc.isSuspended && acc.suspensionAppeal ? (acc.suspensionAppeal.status === 'pending' ? `
            <div class="p-3 bg-brand-50 rounded-xl flex items-center justify-between gap-2">
                <p class="text-[11px] font-black text-brand-700">계정 정지 이의신청: ${escapeHtml(acc.suspensionAppeal.reason)}</p>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectClientSuspensionAppeal('${acc.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                    <button type="button" onclick="adminApproveClientSuspensionAppeal('${acc.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(정지 해제)</button>
                </div>
            </div>` : `<div class="p-3 bg-ink-50 rounded-xl"><p class="text-[10px] font-bold text-ink-400">계정 정지 이의신청 반려됨 — ${escapeHtml(acc.suspensionAppeal.adminResponse || '')}</p></div>`) : ''}
        </div>`;
    }).join('');
}

/* 이용 정지된 계정은 로그인 화면에서 바로 이의신청을 제출할 수 있게 됐으니
 * (openSuspensionAppealModal, client_panel.js), 관리자 쪽에도 심사(승인/반려)
 * 화면이 필요하다 — 승인 시 toggleClientSuspension과 동일하게 정지를 해제한다. */
function adminApproveClientSuspensionAppeal(accountId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account || !account.suspensionAppeal || account.suspensionAppeal.status !== 'pending') return;
    account.isSuspended = false;
    account.suspensionAppeal.status = 'approved';
    account.suspensionAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_SUSPENSION_APPEAL_APPROVE', `[이의신청 승인] '${account.name}'(${account.id}) 고객의 계정 정지 이의신청을 승인하여 정지를 해제했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `제출하신 이의신청이 승인되어 계정 정지가 해제되었습니다. 다시 로그인하실 수 있어요.`);
    showToast(`[${account.name}] 고객의 이의신청을 승인하여 정지를 해제했습니다.`, 'success');
    renderAdminClientManager();
}

function adminRejectClientSuspensionAppeal(accountId, reason) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account || !account.suspensionAppeal || account.suspensionAppeal.status !== 'pending') return;
    account.suspensionAppeal.status = 'rejected';
    account.suspensionAppeal.adminResponse = reason;
    account.suspensionAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_SUSPENSION_APPEAL_REJECT', `[이의신청 반려] '${account.name}'(${account.id}) 고객의 계정 정지 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${account.name}] 고객의 이의신청을 반려했습니다.`, 'info');
    renderAdminClientManager();
}

/* 파트너는 노쇼·상습 갑질 고객을 신고할 수 있지만(submitClientReport), 고객은
 * 자신이 신고당한 사실조차 알 방법이 없고 소명할 방법도 없었다 — 방금 추가한
 * partner.strikeAppeal(파트너의 옐로카드 이의신청)과 동일한 제출→심사 패턴을
 * 반대 방향(고객→관리자)에도 적용한다. */
function adminApproveClientReportAppeal(reportId) {
    const report = (window.AppState.clientReports || []).find(r => r.id === reportId);
    if (!report || !report.appeal || report.appeal.status !== 'pending') return;
    window.AppState.clientReports = window.AppState.clientReports.filter(r => r.id !== reportId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_REPORT_APPEAL_APPROVE', `[이의신청 승인] '${report.clientName}' 고객에 대한 [${report.reportedByPartner}]의 신고(${report.orderCode})를 이의신청 승인으로 취하 처리했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(report.clientPhone, `제출하신 이의신청이 승인되어 신고가 취하되었습니다.`);
    showToast(`[${report.clientName}] 고객의 이의신청을 승인하여 신고를 취하했습니다.`, 'success');
    renderAdminClientManager();
}

function adminRejectClientReportAppeal(reportId, reason) {
    const report = (window.AppState.clientReports || []).find(r => r.id === reportId);
    if (!report || !report.appeal || report.appeal.status !== 'pending') return;
    report.appeal.status = 'rejected';
    report.appeal.adminResponse = reason;
    report.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_REPORT_APPEAL_REJECT', `[이의신청 반려] '${report.clientName}' 고객의 신고(${report.orderCode}) 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(report.clientPhone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${report.clientName}] 고객의 이의신청을 반려했습니다.`, 'info');
    renderAdminClientManager();
}

/* 파트너의 고객 평가(submitClientRating)는 다른 모든 제재/평가 기능(옐로카드,
 * 계정 정지, 신고)과 달리 유일하게 이의신청 경로가 없었다 — clientReports 이의신청과
 * 동일한 제출→심사 패턴을 적용한다. 승인 시 부당한 평가이므로 기록 자체를 삭제하고
 * (신고 이의신청 승인이 신고를 취하하는 것과 동일), 반려 시 평가는 그대로 유지된다. */
function adminApproveClientRatingAppeal(orderCode) {
    const rating = (window.AppState.clientRatings || []).find(r => r.orderCode === orderCode);
    if (!rating || !rating.appeal || rating.appeal.status !== 'pending') return;
    window.AppState.clientRatings = window.AppState.clientRatings.filter(r => r.orderCode !== orderCode);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_RATING_APPEAL_APPROVE', `[이의신청 승인] '${rating.clientName}' 고객에 대한 [${rating.partnerName}]의 평가(${orderCode})를 이의신청 승인으로 삭제 처리했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(rating.clientPhone, `제출하신 이의신청이 승인되어 해당 평가가 삭제되었습니다.`);
    showToast(`[${rating.clientName}] 고객의 이의신청을 승인하여 평가를 삭제했습니다.`, 'success');
    renderAdminClientManager();
}

function adminRejectClientRatingAppeal(orderCode, reason) {
    const rating = (window.AppState.clientRatings || []).find(r => r.orderCode === orderCode);
    if (!rating || !rating.appeal || rating.appeal.status !== 'pending') return;
    rating.appeal.status = 'rejected';
    rating.appeal.adminResponse = reason;
    rating.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_RATING_APPEAL_REJECT', `[이의신청 반려] '${rating.clientName}' 고객의 평가(${orderCode}) 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(rating.clientPhone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${rating.clientName}] 고객의 이의신청을 반려했습니다.`, 'info');
    renderAdminClientManager();
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
    // 파트너 제재(issuePartnerStrike)는 pushPartnerNotification으로 당사자에게 알리는데,
    // 대칭인 고객 계정 정지는 알림이 전혀 가지 않았다 — 정지 중엔 로그인이 막혀 당장
    // 볼 수 없어도, 정지 해제 후(또는 문의 시) 이력으로 확인할 수 있게 남겨둔다.
    if (typeof pushClientNotification === 'function' && account.phone) {
        pushClientNotification(account.phone, account.isSuspended
            ? '이용 정지 처리되었습니다. 자세한 사유는 고객센터로 문의해 주세요.'
            : '이용 정지가 해제되었습니다. 다시 서비스를 이용하실 수 있어요.');
    }
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

/* 계약 취소가 승인되면 recalculateKPIs()의 'contracted' 필터에서 자동으로 빠져
 * GMV/에스크로/수수료 집계는 되돌려지지만, 파트너가 이미 결제한 수수료
 * (commissionPaid)는 그대로 "결제됨" 상태로 남아 실제 환불이 됐는지 알 방법이
 * 없었다 — 계약이 사라졌는데 돈은 계속 낸 것으로 표시되는 공백. 환불 대상 플래그를
 * 세워 별도 환불 처리 큐에서 관리자가 명시적으로 완료 처리하게 한다. */
function approveContractCancellation(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.status !== 'cancel_requested') return;
    order.status = 'cancelled';

    const needsRefund = !!order.commissionPaid;
    if (needsRefund) {
        order.refundStatus = 'pending';
        order.refundAmount = Math.floor((order.finalPrice || 0) * PLATFORM_COMMISSION_RATE);
    }

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CONTRACT_CANCEL_APPROVE', `[계약 취소 승인] 오더 ${order.code}의 계약 취소 요청을 승인했습니다.${needsRefund ? ` (수수료 환불 대상 ₩${order.refundAmount.toLocaleString()}만원)` : ''}`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `요청하신 계약(${order.code}) 취소가 승인되었습니다.`);
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) {
        pushPartnerNotification(order.acceptedPartner, needsRefund
            ? `계약(${order.code}) 취소 요청이 승인되어 계약이 취소되었습니다. 이미 납부하신 플랫폼 수수료 ₩${order.refundAmount.toLocaleString()}만원은 매니저 센터에서 환불 처리할 예정입니다.`
            : `계약(${order.code}) 취소 요청이 승인되어 계약이 취소되었습니다.`);
    }
    showToast(`오더 ${order.code}의 계약 취소를 승인했습니다.${needsRefund ? ' 수수료 환불 대기 목록에 등록되었어요.' : ''}`, 'success');
    renderAdminContractCancellations();
    if (typeof renderAdminRefundPendingList === 'function') renderAdminRefundPendingList();
    if (typeof recalculateKPIs === 'function') recalculateKPIs();
}

function renderAdminRefundPendingList() {
    const container = document.getElementById('admin-refund-pending-list');
    if (!container) return;
    const pending = (window.AppState.orders || []).filter(o => o.refundStatus === 'pending');

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">환불 대기 중인 건이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = pending.map(o => `
        <div class="surface p-5 space-y-3 text-left">
            <div class="flex justify-between items-start gap-2">
                <div class="space-y-1">
                    <span class="badge badge-amber">환불 대기</span>
                    <h4 class="text-sm font-black text-ink-950">${o.code} · ${escapeHtml(o.acceptedPartner || '-')}</h4>
                    <p class="text-[11px] text-ink-500 font-bold">환불 대상 수수료 ₩ ${(o.refundAmount || 0).toLocaleString()}만원</p>
                </div>
                <button type="button" onclick="processCommissionRefund('${o.code}')" class="btn btn-dark btn-sm">환불 처리 완료</button>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function processCommissionRefund(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    if (!order || order.refundStatus !== 'pending') return;
    order.refundStatus = 'refunded';

    if (typeof pushLog === 'function') pushLog('MANAGER', 'COMMISSION_REFUND', `[수수료 환불] 오더 ${order.code}의 플랫폼 수수료 ₩${(order.refundAmount || 0).toLocaleString()}만원을 [${order.acceptedPartner}]에게 환불 처리했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function' && order.acceptedPartner) pushPartnerNotification(order.acceptedPartner, `취소된 계약(${order.code})의 플랫폼 수수료 ₩${(order.refundAmount || 0).toLocaleString()}만원이 환불 처리되었습니다.`);
    showToast(`오더 ${order.code}의 수수료 환불 처리를 완료했습니다.`, 'success');
    renderAdminRefundPendingList();
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
            ? `<div class="flex flex-wrap gap-1.5">${o.bids.map(b => `<span class="badge badge-neutral">${escapeHtml(b.partner)}<button type="button" onclick="unassignOrderFromPartner('${o.code}', '${b.partner}')" class="bg-transparent border-0 cursor-pointer p-0 ml-1 text-ink-400 hover:text-roseCustom" aria-label="배정 취소" title="배정 취소"><i data-lucide="x" class="w-2.5 h-2.5"></i></button></span>`).join('')}</div>`
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

    order.bids.push({ partner: partnerName, price: order.budget, desc: `[매니저 센터 직할 수동 배정] ${partnerName}에 프리미엄 전속 오더가 안전하게 할당되었습니다.`, verified: true, progress: 'bidding', date: getLocalDateString(), validUntil: computeBidValidUntil(), respondedAt: new Date().toISOString() });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'ALLOCATE', `[매니저 센터] 고액 오더(${orderCode}, ₩ ${order.budget.toLocaleString()}만원)를 [${partnerName}] 파트너사에 수동 배정완료.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName} 파트너사가 배정되어 견적서를 보냈어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `매니저 센터가 고액 오더(${orderCode})를 전속 배정했어요. (예산 ₩ ${order.budget.toLocaleString()}만원)`);
    renderAdminOrderAllocation(); recalculateKPIs();
    showToast(`[${partnerName}] 파트너사에 고액 오더 배정이 완료되었습니다!`, "success");
}

/* 배정 실수를 되돌릴 방법이 전혀 없었다 — 수동/자동 배정 모두 order.bids에 한 번
 * push되면 관리자가 직접 상태를 고치지 않는 한 영구히 남아있었다. 계약이 이미
 * 체결된 건(더 이상 이 화면에 노출되지 않는 status='bidding' 대상 밖)은 이 함수가
 * 호출될 상황 자체가 없지만, 방어적으로 한 번 더 확인한다. */
function unassignOrderFromPartner(orderCode, partnerName) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    if (!order || order.status !== 'bidding') { showToast('이미 계약이 진행된 오더는 배정을 취소할 수 없어요.', 'warning'); return; }
    const idx = order.bids.findIndex(b => b.partner === partnerName);
    if (idx === -1) return;
    order.bids.splice(idx, 1);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'UNASSIGN', `[매니저 센터] 오더(${orderCode})에서 [${partnerName}] 파트너사 배정을 취소했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName} 파트너사의 배정이 취소되었어요. (의뢰 코드: ${orderCode})`);
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `매니저 센터가 오더(${orderCode}) 배정을 취소했어요.`);
    showToast(`[${partnerName}] 파트너사의 배정을 취소했습니다.`, 'info');
    renderAdminOrderAllocation();
    recalculateKPIs();
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
        order.bids.push({ partner: selected.name, price: order.budget, desc: `[추천 일괄 자동 배정] 우수 평점 인증 파트너사 ${selected.name}에 전속 배정되었습니다.`, verified: true, progress: 'bidding', date: getLocalDateString(), validUntil: computeBidValidUntil(), respondedAt: new Date().toISOString() });
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
    if (p.status === 'closed') return 'closed';
    if (p.isSuspended) return 'suspended';
    if (p.isPaused) return 'paused';
    if (p.strikeCount > 0) return 'warning';
    return 'active';
}

let adminPartnerMonitorStatusFilter = 'all';

function setAdminPartnerMonitorStatusFilter(key) {
    adminPartnerMonitorStatusFilter = key;
    renderAdminPartnerMonitor();
}

let adminPartnerMonitorRegionFilter = 'all';

function setAdminPartnerMonitorRegionFilter(region) {
    adminPartnerMonitorRegionFilter = region;
    renderAdminPartnerMonitor();
}

function renderAdminPartnerMonitor() {
    const container = document.getElementById('admin-partner-monitor-list');
    if (!container) return;
    if (typeof sweepExpiredPartnerCertifications === 'function') sweepExpiredPartnerCertifications();
    const input = document.getElementById('admin-partner-search');
    const query = input ? input.value.trim().toLowerCase() : '';
    const sortSelect = document.getElementById('admin-partner-sort');
    const sortMode = sortSelect ? sortSelect.value : 'rating';
    const allPartners = window.AppState.partners || [];

    const statusTabsEl = document.getElementById('admin-partner-status-tabs');
    if (statusTabsEl) {
        const statusTabs = [
            ['all', '전체', allPartners.length],
            ['active', '정상', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'active').length],
            ['warning', '경고', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'warning').length],
            ['paused', '일시중단', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'paused').length],
            ['suspended', '이용 정지', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'suspended').length],
            ['banned', '제명', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'banned').length],
            ['closed', '자진 해지', allPartners.filter(p => getPartnerMonitorStatusKey(p) === 'closed').length]
        ];
        statusTabsEl.innerHTML = statusTabs.map(([key, label, count]) =>
            `<button type="button" onclick="setAdminPartnerMonitorStatusFilter('${key}')" class="gnb-tab ${adminPartnerMonitorStatusFilter === key ? 'active' : ''}">${label} (${count})</button>`
        ).join('');
    }

    // 고객 대상 파트너 탐색 페이지(renderPartnerSearchGrid)에는 지역 필터/정렬이 있는데
    // 관리자 모니터링 보드에는 자유 텍스트 검색만 있어서, 지역별로 몰아보거나 평점/리뷰
    // 순으로 정렬할 방법이 없었던 비대칭을 해소한다.
    const regionChipsEl = document.getElementById('admin-partner-region-chips');
    if (regionChipsEl) {
        const regions = [...new Set(allPartners.map(p => p.region).filter(Boolean))].sort();
        const chips = [['all', '전체 지역'], ...regions.map(r => [r, r])];
        regionChipsEl.innerHTML = chips.map(([key, label]) =>
            `<button type="button" onclick="setAdminPartnerMonitorRegionFilter('${key}')" class="region-chip ${adminPartnerMonitorRegionFilter === key ? 'active' : ''}"><i data-lucide="map-pin" class="w-3 h-3"></i>${label}</button>`
        ).join('');
    }

    const filtered = allPartners
        .filter(p => adminPartnerMonitorStatusFilter === 'all' || getPartnerMonitorStatusKey(p) === adminPartnerMonitorStatusFilter)
        .filter(p => adminPartnerMonitorRegionFilter === 'all' || p.region === adminPartnerMonitorRegionFilter)
        .filter(p => !query || p.name.toLowerCase().includes(query) || (p.bizFile && p.bizFile.includes(query)))
        .sort((a, b) => sortMode === 'reviews'
            ? (b.reviews ? b.reviews.length : 0) - (a.reviews ? a.reviews.length : 0)
            : (b.rating || 0) - (a.rating || 0));

    if (filtered.length === 0) { container.innerHTML = '<p class="text-xs font-bold text-ink-500 text-center col-span-full py-12">검색 조건에 해당되는 파트너사가 존재하지 않습니다.</p>'; return; }

    container.innerHTML = '';
    filtered.forEach(p => {
        const isBanned = p.status === 'banned';
        const isClosed = p.status === 'closed';
        const isWarning = p.strikeCount > 0;
        let statusDotClass = 'bg-emeraldCustom', statusText = '정상 가동';
        if (isBanned) { statusDotClass = 'bg-roseCustom'; statusText = '영구 제명'; }
        else if (isClosed) { statusDotClass = 'bg-ink-400'; statusText = '자진 해지'; }
        else if (p.isSuspended) { statusDotClass = 'bg-roseCustom'; statusText = '이용 정지'; }
        else if (isWarning) { statusDotClass = 'bg-amberCustom'; statusText = `옐로카드 ${p.strikeCount}회`; }

        const activeBidsCount = (window.AppState.orders || []).filter(o => o.bids && o.bids.some(b => b.partner === p.name)).length;
        const completedContractsCount = (window.AppState.orders || []).filter(o => o.status === 'contracted' && o.acceptedPartner === p.name).length;
        const myPartnerReports = (window.AppState.partnerReports || []).filter(r => r.partnerName === p.name);

        const card = document.createElement('div');
        card.className = "surface p-5 space-y-4 hover:border-ink-300 transition-all text-left flex flex-col justify-between";
        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start gap-2">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2"><span class="badge badge-neutral"><span class="badge-dot ${statusDotClass}"></span>${statusText}</span>${p.isCertified ? `<span class="chip-cert"><i data-lucide="verified" class="w-2.5 h-2.5"></i> 우리집 인증${p.certExpiryDate ? ` (~${p.certExpiryDate})` : ''}</span>` : ''}${p.isPaused ? `<span class="badge badge-amber"><i data-lucide="pause-circle" class="w-2.5 h-2.5"></i> 매칭 일시중단</span>` : ''}${myPartnerReports.length > 0 ? `<span class="badge badge-rose">고객 신고 ${myPartnerReports.length}건</span>` : ''}${p.certRenewalRequested ? `<span class="badge badge-amber">인증 갱신 요청</span>` : ''}</div>
                        <h4 class="text-sm font-black text-ink-950">${p.name}</h4>
                        <p class="text-[10px] text-ink-400 font-mono">사업자 번호: ${p.bizFile || '미등록'}</p>
                    </div>
                    <div class="text-right shrink-0"><div class="flex items-center gap-1 text-xs font-black text-ink-800 justify-end"><span class="text-gold-500">★</span><span>${p.rating ? p.rating.toFixed(1) : '5.0'}</span></div><span class="text-[10px] text-ink-400 font-bold block mt-0.5">리뷰 ${p.reviews ? p.reviews.length : 0}개</span></div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-center text-xs">
                    <div class="article-spec-chip items-center"><span>참여 오더</span><span class="val">${activeBidsCount}건</span></div>
                    <div class="article-spec-chip items-center"><span>계약 체결</span><span class="val">${completedContractsCount}건</span></div>
                </div>
                ${p.isSuspended && p.suspensionAppeal ? (p.suspensionAppeal.status === 'pending' ? `
                <div class="p-3 bg-brand-50 rounded-xl flex items-center justify-between gap-2">
                    <p class="text-[11px] font-black text-brand-700">계정 정지 이의신청: ${escapeHtml(p.suspensionAppeal.reason)}</p>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectPartnerSuspensionAppeal('${p.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                        <button type="button" onclick="adminApprovePartnerSuspensionAppeal('${p.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(정지 해제)</button>
                    </div>
                </div>` : `<div class="p-3 bg-ink-50 rounded-xl"><p class="text-[10px] font-bold text-ink-400">계정 정지 이의신청 반려됨 — ${escapeHtml(p.suspensionAppeal.adminResponse || '')}</p></div>`) : ''}
            </div>
            <div class="pt-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center flex-wrap gap-1.5">
                    <button type="button" onclick="window.openClientPartnerProfile('${p.name}')" class="btn btn-secondary btn-sm">프로필 조회</button>
                    <button type="button" onclick="openPartnerMetricsModal('${p.name}')" class="btn btn-dark btn-sm"><i data-lucide="bar-chart-2" class="w-3 h-3"></i> 상세 성과</button>
                    <button type="button" onclick="viewPartnerBizCertDoc('${p.id}')" class="btn btn-secondary btn-sm"><i data-lucide="file-text" class="w-3 h-3"></i> 사업자등록증</button>
                    <button type="button" onclick="openAdminDirectMessageModal('partner', '${escapeHtml(p.name)}')" class="btn btn-secondary btn-sm relative"><i data-lucide="send" class="w-3 h-3"></i> 쪽지 보내기${hasUnreadDmReply('partner', p.name) ? `<span class="badge badge-rose absolute -top-2 -right-2 px-1.5">답장</span>` : ''}</button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="togglePartnerCertification('${p.name}')" class="btn btn-secondary btn-sm">${p.isCertified ? '인증 해제' : '인증 부여'}</button>
                    ${isWarning ? `<button type="button" onclick="resetPartnerStrikes('${p.name}')" class="btn btn-secondary btn-sm">경고 리셋</button>` : ''}
                    ${!isBanned && !isClosed ? `<button type="button" onclick="issuePartnerStrike('${p.name}')" class="btn btn-secondary btn-sm">+ 옐로카드</button>` : ''}
                    ${!isBanned && !isClosed ? `<button type="button" onclick="togglePartnerSuspension('${p.name}')" class="btn ${p.isSuspended ? 'btn-dark' : 'btn-secondary'} btn-sm">${p.isSuspended ? '정지 해제' : '일시 정지'}</button>` : ''}
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
    // 신고가 쌓인 후기를 관리자가 바로 알아챌 수 있도록, 커뮤니티 관리와 동일하게
    // 신고 수가 많은 후기를 맨 위로 올리고 신고 배지를 표시한다.
    return reviews
        .map((r, idx) => ({ r, idx, reportCount: (r.reportedBy || []).length }))
        .sort((a, b) => (b.reportCount + (b.r.partnerFlagged ? 1 : 0)) - (a.reportCount + (a.r.partnerFlagged ? 1 : 0)))
        .map(({ r, idx, reportCount }) => `
        <div class="p-3.5 bg-ink-50/80 rounded-xl border ${reportCount > 0 || r.partnerFlagged ? 'border-rose-200' : 'border-ink-100'} space-y-1.5 text-left">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-ink-800">${escapeHtml(r.client)}</span>
                    <span class="text-gold-500 font-extrabold text-xs">★ ${r.rating}.0</span>
                    <span class="text-[10px] text-ink-400 font-bold">${r.date}</span>
                    ${reportCount > 0 ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 고객 신고 ${reportCount}건</span>` : ''}
                    ${r.partnerFlagged ? `<span class="badge badge-rose"><i data-lucide="shield-alert" class="w-2.5 h-2.5"></i> 사장님 신고</span>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    ${reportCount > 0 ? `<button type="button" onclick="dismissReviewReport('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>` : ''}
                    ${r.partnerFlagged ? `<button type="button" onclick="dismissPartnerReviewFlag('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">사장님 신고 반려</button>` : ''}
                    <button type="button" onclick="adminDeleteReview('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                </div>
            </div>
            <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(r.text)}</p>
            ${buildReportReasonsHtml(r.reportReasons)}
            ${r.partnerFlagged && r.partnerFlagReason ? `<p class="text-[11px] text-roseCustom font-bold">사장님 신고 사유: ${escapeHtml(r.partnerFlagReason)}</p>` : ''}
            ${r.reply && r.reply.text ? (() => {
                const replyReportCount = (r.reply.reportedBy || []).length;
                return `<div class="mt-1.5 p-2.5 rounded-lg space-y-1" style="background:var(--brand-50)">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[10px] font-black text-brand-700 flex items-center gap-1.5"><i data-lucide="reply" class="w-3 h-3"></i> 사장님 답글${replyReportCount > 0 ? ` <span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${replyReportCount}건</span>` : ''}</span>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${replyReportCount > 0 ? `<button type="button" onclick="dismissReviewReplyReport('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>` : ''}
                            <button type="button" onclick="adminDeleteReviewReply('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">답글 삭제</button>
                        </div>
                    </div>
                    <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(r.reply.text)}</p>
                    ${buildReportReasonsHtml(r.reply.reportReasons)}
                </div>`;
            })() : ''}
        </div>`).join('');
}

function buildReviewDeletionAppealsHtml(partnerName) {
    const entries = (window.AppState.reviewDeletionLog || []).filter(e => e.partnerName === partnerName && e.appeal && e.appeal.status === 'pending');
    if (entries.length === 0) return '';
    return `<div class="space-y-2.5 pt-2">
        <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="undo-2" class="w-4 h-4 text-roseCustom"></i> 후기 삭제 이의신청 (${entries.length}건)</h4>
        <div class="space-y-2">${entries.map(e => `
        <div class="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1.5 text-left">
            <p class="text-xs text-ink-700 font-medium leading-relaxed">삭제된 후기: "${escapeHtml(e.reviewSnapshot.text)}" (★${e.reviewSnapshot.rating}.0, ${e.reviewSnapshot.date})</p>
            <p class="text-[11px] font-black text-brand-700">이의신청: ${escapeHtml(e.appeal.reason)}</p>
            <div class="flex items-center gap-1.5 justify-end">
                <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectReviewDeletionAppeal('${e.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                <button type="button" onclick="adminApproveReviewDeletionAppeal('${e.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(후기 복원)</button>
            </div>
        </div>`).join('')}</div>
    </div>`;
}

/* buildReviewDeletionAppealsHtml(후기 자체 삭제 이의신청)이 관리자가 방금 이 파트너의
 * 후기를 살펴보는 화면에 바로 노출되는 것과 동일하게, 답글 삭제 이의신청도 통합
 * 이의신청함까지 가지 않고 이 화면에서 바로 처리할 수 있게 한다. */
function buildReviewReplyDeletionAppealsHtml(partnerName) {
    const entries = (window.AppState.reviewReplyDeletionLog || []).filter(e => e.partnerName === partnerName && e.appeal && e.appeal.status === 'pending');
    if (entries.length === 0) return '';
    return `<div class="space-y-2.5 pt-2">
        <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="undo-2" class="w-4 h-4 text-roseCustom"></i> 후기 답글 삭제 이의신청 (${entries.length}건)</h4>
        <div class="space-y-2">${entries.map(e => `
        <div class="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1.5 text-left">
            <p class="text-xs text-ink-700 font-medium leading-relaxed">삭제된 답글: "${escapeHtml(e.replySnapshot.text)}" (${e.date})</p>
            <p class="text-[11px] font-black text-brand-700">이의신청: ${escapeHtml(e.appeal.reason)}</p>
            <div class="flex items-center gap-1.5 justify-end">
                <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectReviewReplyDeletionAppeal('${e.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                <button type="button" onclick="adminApproveReviewReplyDeletionAppeal('${e.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(답글 복원)</button>
            </div>
        </div>`).join('')}</div>
    </div>`;
}

/* 후기 삭제 이의신청이 승인되면 스냅샷을 그대로 partner.reviews에 되돌려 복원한다 —
 * 신청 당시 배열 위치는 의미가 없으므로 맨 위에 다시 올린다. */
function adminApproveReviewDeletionAppeal(logId) {
    const entry = (window.AppState.reviewDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    const partner = window.AppState.partners.find(p => p.name === entry.partnerName);
    if (!partner) return;

    if (!partner.reviews) partner.reviews = [];
    partner.reviews.unshift(entry.reviewSnapshot);
    partner.rating = Math.round((partner.reviews.reduce((acc, r) => acc + r.rating, 0) / partner.reviews.length) * 10) / 10;
    window.AppState.reviewDeletionLog = window.AppState.reviewDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_DELETION_APPEAL_APPROVE', `[이의신청 승인] '${entry.partnerName}' 파트너의 삭제된 후기를 재검토하여 복원했습니다.`, 'SUCCESS');
    if (entry.clientPhone && typeof pushClientNotification === 'function') pushClientNotification(entry.clientPhone, `제출하신 이의신청이 승인되어 삭제됐던 후기가 복원되었습니다.`);
    showToast('후기를 복원했습니다.', 'success');
    openPartnerMetricsModal(entry.partnerName);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function adminRejectReviewDeletionAppeal(logId, reason) {
    const entry = (window.AppState.reviewDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_DELETION_APPEAL_REJECT', `[이의신청 반려] '${entry.partnerName}' 파트너의 삭제된 후기 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (entry.clientPhone && typeof pushClientNotification === 'function') pushClientNotification(entry.clientPhone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
    openPartnerMetricsModal(entry.partnerName);
}

/* 후기 삭제 이의신청(adminApproveReviewDeletionAppeal)과 동일한 패턴 — 승인 시
 * 스냅샷을 그대로 portfolios 맨 위에 복원한다(신청 당시 배열 위치는 의미가 없다). */
function adminApprovePortfolioDeletionAppeal(logId) {
    const entry = (window.AppState.portfolioDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    const partner = window.AppState.partners.find(p => p.name === entry.partnerName);
    if (!partner) return;

    if (!partner.portfolios) partner.portfolios = [];
    partner.portfolios.unshift(entry.portfolioSnapshot);
    window.AppState.portfolioDeletionLog = window.AppState.portfolioDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_DELETION_APPEAL_APPROVE', `[이의신청 승인] '${entry.partnerName}' 파트너의 삭제된 시공사례를 재검토하여 복원했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 승인되어 삭제됐던 시공사례가 복원되었습니다.`);
    showToast('시공사례를 복원했습니다.', 'success');
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function adminRejectPortfolioDeletionAppeal(logId, reason) {
    const entry = (window.AppState.portfolioDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_DELETION_APPEAL_REJECT', `[이의신청 반려] '${entry.partnerName}' 파트너의 삭제된 시공사례 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
}

/* 신고를 검토한 뒤 실제 위반이 아니라고 판단하면 콘텐츠를 지우지 않고 신고만
 * 종료할 방법이 지금까지 없었다 — 계약 취소 심사(approve/reject)와 동일한 승인/반려
 * 대칭 구조를 신고 처리에도 적용한다. 신고 표시만 초기화하고 신고자에게 알린다. */
function dismissReviewReport(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev || !rev.reportedBy || rev.reportedBy.length === 0) return;
    const reportedBy = rev.reportedBy;
    rev.reportedBy = [];
    rev.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_REPORT_DISMISS', `[후기 신고 반려] '${partnerName}' 파트너의 후기 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 후기를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 후기는 그대로 유지됩니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

/* dismissReviewReport(고객 신고 반려)와 동일한 승인/반려 대칭 구조를 파트너의
 * 허위 후기 신고(flagReviewAsPartner)에도 적용한다 — 검토 후 실제 위반이 아니라고
 * 판단되면 신고 표시만 초기화하고 신고한 파트너에게 결과를 알린다. */
function dismissPartnerReviewFlag(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev || !rev.partnerFlagged) return;
    rev.partnerFlagged = false;
    rev.partnerFlagReason = '';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_PARTNER_FLAG_DISMISS', `[사장님 후기 신고 반려] '${partnerName}' 파트너가 신고한 후기를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `신고하신 후기를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 후기는 그대로 유지됩니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

/* 신고된 후기 본문은 adminDeleteReview로 처리할 수 있는데, 그러면 답글까지 함께
 * 지워지고 고객의 원 후기까지 통째로 사라진다 — 답글(rev.reply)만 문제인 경우
 * 답글만 골라 지울 방법이 없던 공백. 후기 삭제 이의신청(reviewDeletionLog)과
 * 동일한 구조로 답글 전용 삭제/신고반려/이의신청 체계를 별도로 둔다. */
function dismissReviewReplyReport(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev || !rev.reply || !rev.reply.reportedBy || rev.reply.reportedBy.length === 0) return;
    const reportedBy = rev.reply.reportedBy;
    rev.reply.reportedBy = [];
    rev.reply.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_REPLY_REPORT_DISMISS', `[후기 답글 신고 반려] '${partnerName}' 파트너의 후기 답글 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 후기 답글을 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 답글은 그대로 유지됩니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

function adminDeleteReviewReply(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev || !rev.reply) return;
    const reportedBy = rev.reply.reportedBy;
    const replySnapshot = rev.reply;
    delete rev.reply;

    if (!window.AppState.reviewReplyDeletionLog) window.AppState.reviewReplyDeletionLog = [];
    const logEntry = { id: `rrdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`, partnerName, reviewRef: rev, replySnapshot, date: getLocalDateString(), appeal: null };
    window.AppState.reviewReplyDeletionLog.unshift(logEntry);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_REPLY_MODERATE', `[후기 답글 삭제] '${partnerName}' 파트너의 후기 답글을 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function' && reportedBy && reportedBy.length > 0) notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 후기 답글이 검토 후 삭제 처리되었습니다.`);
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `작성하신 후기 답글이 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 마이페이지에서 소명하실 수 있어요.`);
    showToast('후기 답글을 삭제했습니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

let reviewReplyDeletionAppealTargetId = null;

function openReviewReplyDeletionAppealModal(logId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const entry = (window.AppState.reviewReplyDeletionLog || []).find(e => e.id === logId && e.partnerName === partnerName);
    if (!entry) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    reviewReplyDeletionAppealTargetId = logId;
    safeUpdateValue('review-reply-deletion-appeal-reason-input', '');
    openModal('review-reply-deletion-appeal-modal', 'review-reply-deletion-appeal-modal-card');
}

function closeReviewReplyDeletionAppealModal() {
    reviewReplyDeletionAppealTargetId = null;
    closeModal('review-reply-deletion-appeal-modal', 'review-reply-deletion-appeal-modal-card');
}

function submitReviewReplyDeletionAppeal() {
    const entry = (window.AppState.reviewReplyDeletionLog || []).find(e => e.id === reviewReplyDeletionAppealTargetId);
    if (!entry) { closeReviewReplyDeletionAppealModal(); return; }
    const reason = document.getElementById('review-reply-deletion-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'REVIEW_REPLY_DELETION_APPEAL', `[${entry.partnerName}]가 삭제된 후기 답글에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeReviewReplyDeletionAppealModal();
    renderPartnerReviewReplyDeletionStatus();
}

function renderPartnerReviewReplyDeletionStatus() {
    const container = document.getElementById('partner-review-reply-deletion-status');
    if (!container) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const myEntries = (window.AppState.reviewReplyDeletionLog || []).filter(e => e.partnerName === partnerName);

    if (myEntries.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="space-y-2 pt-2">
        <h4 class="text-xs font-black text-ink-400 uppercase tracking-widest border-b border-ink-100 pb-2">삭제된 내 후기 답글</h4>
        ${myEntries.map(e => {
            let statusHtml;
            if (e.appeal && e.appeal.status === 'pending') {
                statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
            } else if (e.appeal && e.appeal.status === 'rejected') {
                statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${e.appeal.adminResponse ? ` — ${escapeHtml(e.appeal.adminResponse)}` : ''}</p>`;
            } else {
                statusHtml = `<button type="button" onclick="openReviewReplyDeletionAppealModal('${e.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
            }
            return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5 text-left">
                <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">삭제된 답글: "${escapeHtml(e.replySnapshot.text)}" (${e.date})</p>
                ${statusHtml}
            </div>`;
        }).join('')}
    </div>`;
}

function adminApproveReviewReplyDeletionAppeal(logId) {
    const entry = (window.AppState.reviewReplyDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.reviewRef.reply = entry.replySnapshot;
    window.AppState.reviewReplyDeletionLog = window.AppState.reviewReplyDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_REPLY_DELETION_APPEAL_APPROVE', `[이의신청 승인] '${entry.partnerName}' 파트너의 삭제된 후기 답글을 재검토하여 복원했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 승인되어 삭제됐던 후기 답글이 복원되었습니다.`);
    showToast('후기 답글을 복원했습니다.', 'success');
    openPartnerMetricsModal(entry.partnerName);
    renderPartnerReviewReplyDeletionStatus();
}

function adminRejectReviewReplyDeletionAppeal(logId, reason) {
    const entry = (window.AppState.reviewReplyDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_REPLY_DELETION_APPEAL_REJECT', `[이의신청 반려] '${entry.partnerName}' 파트너의 후기 답글 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(entry.partnerName, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
    renderPartnerReviewReplyDeletionStatus();
}

/* 커뮤니티 글/후기 신고는 관리자가 검토할 수 있는데, 파트너가 올리는 시공사례
 * (포트폴리오)는 저작권 도용·허위 사진이 신고되어도 검토할 창구가 없었다 —
 * buildAdminReviewModerationHtml과 동일한 신고순 정렬 + 삭제 패턴을 적용한다.
 * 초안(isDraft)은 고객에게 아직 노출되지 않아 신고 대상이 아니므로 제외한다. */
function buildAdminPortfolioModerationHtml(partner) {
    const portfolios = (partner.portfolios || []).filter(p => !p.isDraft);
    if (portfolios.length === 0) {
        return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">등록된 시공사례가 없습니다.</div>`;
    }
    return partner.portfolios
        .map((p, idx) => ({ p, idx, reportCount: (p.reportedBy || []).length }))
        .filter(({ p }) => !p.isDraft)
        .sort((a, b) => b.reportCount - a.reportCount)
        .map(({ p, idx, reportCount }) => {
            const reportedQuestions = (p.questions || []).map((q, qIdx) => ({ q, qIdx })).filter(({ q }) => (q.reportedBy || []).length > 0);
            const questionsHtml = reportedQuestions.length > 0 ? `
            <div class="pt-1.5 space-y-1.5">
                ${reportedQuestions.map(({ q, qIdx }) => `
                <div class="p-2.5 bg-rose-50/60 rounded-lg border border-rose-200 flex justify-between items-start gap-2">
                    <p class="text-[11px] text-ink-700 font-semibold leading-relaxed">문의: ${escapeHtml(q.text)} <span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${q.reportedBy.length}건</span>${buildReportReasonsHtml(q.reportReasons)}</p>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="dismissPortfolioQuestionReport('${partner.name}', ${idx}, ${qIdx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>
                        <button type="button" onclick="adminDeletePortfolioQuestion('${partner.name}', ${idx}, ${qIdx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                    </div>
                </div>`).join('')}
            </div>` : '';
            return `
        <div class="p-3.5 bg-ink-50/80 rounded-xl border ${reportCount > 0 ? 'border-rose-200' : 'border-ink-100'} space-y-1.5 text-left">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-ink-800">${escapeHtml(p.title || '(제목 없음)')}</span>
                    ${reportCount > 0 ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 ${reportCount}건</span>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    ${reportCount > 0 ? `<button type="button" onclick="dismissPortfolioReport('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">신고 반려</button>` : ''}
                    <button type="button" onclick="adminDeletePortfolio('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                </div>
            </div>
            <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(p.desc || '')}</p>
            ${buildReportReasonsHtml(p.reportReasons)}
            ${questionsHtml}
        </div>`;
        }).join('');
}

/* 시공사례 문의 신고(reportPortfolioQuestion, cms.js)를 관리자가 검토할 수 있게
 * 시공사례 관리 카드 안에 신고된 문의만 모아 보여주고, 위반으로 판단되면 문의
 * 자체를 삭제한다(질문만 삭제, 시공사례/답변에는 영향 없음). */
/* 커뮤니티 글/댓글, 후기, 후기 답글은 전부 삭제 시 작성자 알림 + 스냅샷 로그
 * + 이의신청 경로가 있는데, 시공사례 문의(port.questions)만 삭제해도 작성자에게
 * 알림조차 가지 않았고 소명할 방법도 없었다 — 동일한 3종 세트를 적용한다. */
function adminDeletePortfolioQuestion(partnerName, idx, questionIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port || !port.questions || !port.questions[questionIdx]) return;
    const question = port.questions[questionIdx];
    port.questions.splice(questionIdx, 1);

    if (!window.AppState.portfolioQuestionDeletionLog) window.AppState.portfolioQuestionDeletionLog = [];
    const logEntry = { id: `pqdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`, partnerName, portfolioTitle: port.title || '(제목 없음)', authorId: question.authorId, authorPhone: question.authorPhone, questionSnapshot: question, portfolioRef: port, date: getLocalDateString(), appeal: null };
    window.AppState.portfolioQuestionDeletionLog.unshift(logEntry);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_QUESTION_MODERATE', `[시공사례 문의 삭제] '${partnerName}' 파트너의 시공사례 문의를 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (question.authorPhone && typeof pushClientNotification === 'function') pushClientNotification(question.authorPhone, `작성하신 시공사례 문의가 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 마이페이지에서 소명하실 수 있어요.`);
    showToast('문의를 삭제했습니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

function dismissPortfolioQuestionReport(partnerName, idx, questionIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    const question = port && port.questions && port.questions[questionIdx];
    if (!question || !question.reportedBy || question.reportedBy.length === 0) return;
    const reportedBy = question.reportedBy;
    question.reportedBy = [];
    question.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_QUESTION_REPORT_DISMISS', `[시공사례 문의 신고 반려] '${partnerName}' 파트너의 시공사례 문의 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 시공사례 문의를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 문의는 그대로 유지됩니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

/* adminApproveCommunityDeletionAppeal과 동일하게, 승인 시 스냅샷을 살아있는
 * portfolioRef.questions 배열에 그대로 되돌린다 — 신청 당시 인덱스는 의미가
 * 없으므로 맨 끝에 다시 붙인다. */
function adminApprovePortfolioQuestionDeletionAppeal(logId) {
    const entry = (window.AppState.portfolioQuestionDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    if (!entry.portfolioRef.questions) entry.portfolioRef.questions = [];
    entry.portfolioRef.questions.push(entry.questionSnapshot);
    window.AppState.portfolioQuestionDeletionLog = window.AppState.portfolioQuestionDeletionLog.filter(e => e.id !== logId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_QUESTION_DELETION_APPEAL_APPROVE', `[이의신청 승인] '${entry.partnerName}' 파트너의 삭제된 시공사례 문의를 재검토하여 복원했습니다.`, 'SUCCESS');
    if (entry.authorPhone && typeof pushClientNotification === 'function') pushClientNotification(entry.authorPhone, `제출하신 이의신청이 승인되어 삭제됐던 시공사례 문의가 복원되었습니다.`);
    showToast('시공사례 문의를 복원했습니다.', 'success');
    openPartnerMetricsModal(entry.partnerName);
}

function adminRejectPortfolioQuestionDeletionAppeal(logId, reason) {
    const entry = (window.AppState.portfolioQuestionDeletionLog || []).find(e => e.id === logId);
    if (!entry || !entry.appeal || entry.appeal.status !== 'pending') return;
    entry.appeal.status = 'rejected';
    entry.appeal.adminResponse = reason;
    entry.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_QUESTION_DELETION_APPEAL_REJECT', `[이의신청 반려] '${entry.partnerName}' 파트너의 시공사례 문의 삭제 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (entry.authorPhone && typeof pushClientNotification === 'function') pushClientNotification(entry.authorPhone, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast('이의신청을 반려했습니다.', 'info');
}

function dismissPortfolioReport(partnerName, idx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port || !port.reportedBy || port.reportedBy.length === 0) return;
    const reportedBy = port.reportedBy;
    port.reportedBy = [];
    port.reportReasons = [];
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_REPORT_DISMISS', `[시공사례 신고 반려] '${partnerName}' 파트너의 시공사례 신고를 검토 후 반려(콘텐츠 유지)했습니다.`, 'INFO');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 시공사례를 검토했지만 위반 사항이 확인되지 않아 반려되었습니다.`);
    showToast('신고를 반려했습니다. 시공사례는 그대로 유지됩니다.', 'info');
    openPartnerMetricsModal(partnerName);
}

/* 고객이 신고한 파트너 계약 불이행/부실 시공 신고(submitPartnerReport, client_panel.js)를
 * 관리자가 검토할 수 있게, 후기/시공사례 관리와 동일한 목록 블록을 파트너 상세 성과
 * 모달에 추가한다. 신고는 삭제 대상이 아니라 참고 기록이므로 삭제 버튼은 두지 않는다. */
function buildAdminPartnerReportsHtml(partner) {
    const reports = (window.AppState.partnerReports || []).filter(r => r.partnerName === partner.name);
    if (reports.length === 0) {
        return `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">접수된 고객 신고가 없습니다.</div>`;
    }
    return reports.map(r => `
        <div class="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1.5 text-left">
            <div class="flex items-center gap-2">
                <span class="text-xs font-black text-ink-800">${escapeHtml(r.clientName)}</span>
                <span class="text-[10px] text-ink-400 font-bold">${r.orderCode} · ${r.date}</span>
            </div>
            <p class="text-xs text-ink-600 font-medium leading-relaxed">${escapeHtml(r.reason)}</p>
            ${r.appeal ? (r.appeal.status === 'pending' ? `
            <div class="pl-3 flex items-center justify-between gap-2">
                <p class="text-[10px] font-black text-brand-700">이의신청: ${escapeHtml(r.appeal.reason)}</p>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectPartnerReportAppeal('${r.id}', reason))" class="text-[10px] font-bold text-ink-500 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">반려</button>
                    <button type="button" onclick="adminApprovePartnerReportAppeal('${r.id}')" class="text-[10px] font-bold text-ink-500 hover:text-emeraldCustom bg-transparent border-0 cursor-pointer p-0">승인(신고 취하)</button>
                </div>
            </div>` : `<p class="pl-3 text-[10px] font-bold text-ink-400">이의신청 반려됨 — ${escapeHtml(r.appeal.adminResponse || '')}</p>`) : ''}
        </div>`).join('');
}

function adminApprovePartnerReportAppeal(reportId) {
    const report = (window.AppState.partnerReports || []).find(r => r.id === reportId);
    if (!report || !report.appeal || report.appeal.status !== 'pending') return;
    window.AppState.partnerReports = window.AppState.partnerReports.filter(r => r.id !== reportId);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_REPORT_APPEAL_APPROVE', `[이의신청 승인] '${report.partnerName}' 파트너에 대한 고객 신고(${report.orderCode})를 이의신청 승인으로 취하 처리했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(report.partnerName, `제출하신 이의신청이 승인되어 신고가 취하되었습니다.`);
    showToast(`[${report.partnerName}] 파트너의 이의신청을 승인하여 신고를 취하했습니다.`, 'success');
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
    const modal = document.getElementById('admin-partner-metrics-modal');
    if (modal && !modal.classList.contains('hidden')) openPartnerMetricsModal(report.partnerName);
}

function adminRejectPartnerReportAppeal(reportId, reason) {
    const report = (window.AppState.partnerReports || []).find(r => r.id === reportId);
    if (!report || !report.appeal || report.appeal.status !== 'pending') return;
    report.appeal.status = 'rejected';
    report.appeal.adminResponse = reason;
    report.appeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_REPORT_APPEAL_REJECT', `[이의신청 반려] '${report.partnerName}' 파트너의 고객 신고(${report.orderCode}) 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(report.partnerName, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${report.partnerName}] 파트너의 이의신청을 반려했습니다.`, 'info');
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
    const modal = document.getElementById('admin-partner-metrics-modal');
    if (modal && !modal.classList.contains('hidden')) openPartnerMetricsModal(report.partnerName);
}

function adminDeletePortfolio(partnerName, idx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios || !partner.portfolios[idx]) return;
    const port = partner.portfolios[idx];
    const reportedBy = port.reportedBy;

    partner.portfolios.splice(idx, 1);

    // 후기 삭제(adminDeleteReview)는 스냅샷을 남겨 작성자 본인에게 알리고 소명(이의신청)할
    // 방법을 주는데, 시공사례 삭제는 신고자에게만 알리고 정작 작성한 파트너는 삭제
    // 사실 자체를 통보만 받을 뿐 소명할 방법이 없었다 — 동일한 패턴을 적용한다.
    if (!window.AppState.portfolioDeletionLog) window.AppState.portfolioDeletionLog = [];
    const logEntry = {
        id: `pdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        partnerName, portfolioSnapshot: port, date: getLocalDateString(), appeal: null
    };
    window.AppState.portfolioDeletionLog.unshift(logEntry);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PORTFOLIO_MODERATE', `[시공사례 삭제] '${partnerName}' 파트너의 시공사례를 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 시공사례가 검토 후 삭제 처리되었습니다.`);
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `등록하신 시공사례("${port.title || '-'}")가 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 내 정보에서 소명하실 수 있어요.`);
    showToast('시공사례를 삭제했습니다.', 'info');
    openPartnerMetricsModal(partnerName);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 후기 시스템(평점 입력, 답글, 도움돼요, 신고)은 이미 다 갖춰져 있는데, 계약이
 * 끝난 뒤 고객에게 후기를 남겨달라고 부탁할 방법이 파트너에게 전혀 없었다 —
 * 평점이 파트너 신뢰도/랭킹에 직결되므로 실사용 가치가 크다. 같은 날 중복 요청은
 * 스팸이 되므로 하루 1회로 제한한다. */
function requestReviewFromClient(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    if (order.reviewWritten) return;
    const today = getLocalDateString();
    if (order.lastReviewReminderDate === today) { showToast('오늘 이미 후기 작성 요청을 보냈어요.', 'info'); return; }

    order.lastReviewReminderDate = today;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'REVIEW_REQUEST', `[${partnerName}]가 오더(${orderCode}) 고객에게 후기 작성을 요청했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}에서 안심 후기 작성을 부탁드려요! 솔직한 후기가 큰 도움이 됩니다.`, null, 'marketing');
    showToast('후기 작성 요청을 보냈습니다.', 'success');
    openPartnerOrderDetailModal(orderCode);
}

/* 고객이 하자보수를 신청할 수 있게 됐으니(client_panel.js의 openRepairClaimModal),
 * 파트너 쪽에도 신청 내역을 확인하고 처리 현황(접수→처리중→처리완료)을
 * 안내할 수단이 필요하다. */
function buildPartnerRepairClaimsHtml(order) {
    if (!order.clientSigned || !order.partnerSigned) return '';
    const claims = order.repairClaims || [];
    if (claims.length === 0) {
        return `<div class="surface p-5 space-y-2">
            <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="wrench" class="w-4 h-4 text-brand-500"></i> 하자보수 신청 내역</h5>
            <p class="text-[10px] text-ink-400 font-semibold">아직 접수된 하자보수 신청이 없습니다.</p>
        </div>`;
    }
    const statusMeta = {
        submitted: { label: '접수됨', cls: 'badge-amber' },
        in_progress: { label: '처리중', cls: 'badge-brand' },
        completed: { label: '처리완료', cls: 'badge-emerald' },
        rejected: { label: '반려됨', cls: 'badge-neutral' }
    };
    return `<div class="surface p-5 space-y-3">
        <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="wrench" class="w-4 h-4 text-brand-500"></i> 하자보수 신청 내역 (${claims.length})</h5>
        <div class="space-y-2">${claims.map(c => {
            const meta = statusMeta[c.status] || statusMeta.submitted;
            return `<div class="p-3 bg-ink-50 rounded-xl space-y-1.5">
                <div class="flex items-center justify-between"><span class="text-xs font-black text-ink-900">${escapeHtml(c.title)}</span><span class="badge ${meta.cls}">${meta.label}</span></div>
                <p class="text-[11px] text-ink-600 font-semibold leading-relaxed">${escapeHtml(c.description)}</p>
                ${(c.photos || []).length > 0 ? `<div class="flex gap-1.5 pt-0.5">${c.photos.map(src => `<img src="${src}" class="w-14 h-14 object-cover rounded-lg border border-ink-100 cursor-pointer" onclick="window.open('${src}', '_blank')">`).join('')}</div>` : ''}
                <p class="text-[9px] text-ink-400 font-semibold">신청일: ${c.createdDate}</p>
                ${c.partnerResponse ? `<p class="text-[10px] text-brand-700 font-semibold leading-relaxed pl-3 border-l-2 border-brand-200">${escapeHtml(c.partnerResponse)}</p>` : ''}
                ${(c.responsePhotos || []).length > 0 ? `<div class="flex gap-1.5 pt-0.5">${c.responsePhotos.map(src => `<img src="${src}" class="w-14 h-14 object-cover rounded-lg border border-brand-200 cursor-pointer" onclick="window.open('${src}', '_blank')">`).join('')}</div>` : ''}
                ${(c.status !== 'completed' && c.status !== 'rejected') ? `<div class="p-2 bg-white rounded-lg border border-ink-100 space-y-1">
                    ${c.visitStatus === 'proposed' ? `<p class="text-[10px] font-black text-amberCustom">방문 일정 제안함: ${c.visitDate} (고객 확인 대기중)</p>`
                        : c.visitStatus === 'confirmed' ? `<p class="text-[10px] font-black text-emeraldCustom">방문 일정 확정됨: ${c.visitDate}</p><div class="flex items-center gap-2 mt-0.5"><button type="button" onclick="completeRepairVisit('${order.code}', '${c.id}')" class="btn btn-dark btn-sm">방문 완료 처리</button><button type="button" onclick="downloadVisitCalendarFile('하자보수 방문: ${escapeHtml(c.title)} (${order.code})', '${escapeHtml(c.description)}', '${c.visitDate}')" class="text-[9px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0"><i data-lucide="calendar-plus" class="w-3 h-3 inline"></i> 캘린더에 추가</button></div>`
                        : c.visitStatus === 'completed' ? `<p class="text-[10px] font-black text-ink-500">방문 완료됨: ${c.visitCompletedDate}</p>${!c.visitCompletionDisputed ? '' : (c.visitCompletionDisputeResolution === 'rejected'
                            ? `<p class="text-[9px] font-bold text-ink-400 mt-0.5">고객 이의제기 반려됨(완료 유지)${c.visitCompletionDisputeAdminResponse ? ` — ${escapeHtml(c.visitCompletionDisputeAdminResponse)}` : ''}</p>`
                            : `<p class="text-[9px] font-black text-roseCustom mt-0.5">고객 이의제기 심사중</p>`)}`
                        : `<div class="flex items-center gap-1.5">
                            ${c.visitStatus === 'declined' ? `<span class="text-[9px] text-ink-400 font-semibold shrink-0">거절됨${c.visitDeclineReason ? ` — ${escapeHtml(c.visitDeclineReason)}` : ''}. 새로 제안:</span>` : `<span class="text-[9px] text-ink-400 font-semibold shrink-0">방문 일정 제안:</span>`}
                            <input type="date" id="repair-visit-date-input-${c.id}" class="input text-[10px] py-1 px-1.5 flex-1">
                            <button type="button" onclick="proposeRepairVisitDate('${order.code}', '${c.id}')" class="btn btn-secondary btn-sm shrink-0">제안</button>
                        </div>`}
                </div>` : ''}
                ${(c.status !== 'completed' && c.status !== 'rejected') ? `<div class="flex gap-1.5 mt-1">
                    ${c.status === 'submitted' ? `<button type="button" onclick="openRepairClaimResponseModal('${order.code}', '${c.id}', 'in_progress')" class="btn btn-secondary btn-sm flex-1">처리 시작</button>` : ''}
                    <button type="button" onclick="openRepairClaimResponseModal('${order.code}', '${c.id}', 'completed')" class="btn btn-dark btn-sm flex-1">처리 완료</button>
                    <button type="button" onclick="openRepairClaimResponseModal('${order.code}', '${c.id}', 'rejected')" class="btn btn-secondary btn-sm text-roseCustom flex-1">반려</button>
                </div>` : ''}
            </div>`;
        }).join('')}</div>
    </div>`;
}

/* 계약 전 실측 방문은 propose/confirm/decline 전 과정이 있는데(openSiteVisitModal),
 * 하자보수(AS) 방문은 파트너가 "처리중"이라고만 표시할 뿐 실제 방문 날짜를 조율할
 * 방법이 없었다 — 확정/거절 처리는 client_panel.js의 confirmRepairVisitDate/
 * declineRepairVisitDate가 담당한다. */
function proposeRepairVisitDate(orderCode, claimId) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.acceptedPartner !== partnerName) return;
    const claim = order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.status === 'completed' || claim.status === 'rejected') return;
    const input = document.getElementById(`repair-visit-date-input-${claimId}`);
    const date = input ? input.value : '';
    if (!date) { showToast('방문 희망일을 선택해주세요.', 'warning'); return; }

    const conflictingVisit = getPartnerScheduledVisits(partnerName).find(v => v.date === date && v.orderCode !== order.code);
    const isBlockedDate = isPartnerDateBlocked(partnerName, date);
    const isReschedule = claim.visitStatus === 'confirmed';
    claim.visitStatus = 'proposed';
    claim.visitDate = date;
    claim.visitDeclineReason = null;
    claim.visitCompletedDate = null;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'REPAIR_VISIT_PROPOSE', `[${partnerName}]가 하자보수("${claim.title}") 방문 일정을 ${isReschedule ? '변경 제안' : '제안'}했습니다: ${date}`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, isReschedule
        ? `${partnerName}가 확정된 하자보수("${claim.title}") 방문 일정을 ${date}로 변경 제안했어요. 다시 확인해 주세요.`
        : `하자보수("${claim.title}") 방문 일정을 제안했어요: ${date}`);
    showToast(isReschedule ? '방문 일정 변경을 제안했습니다. 고객 재확인을 기다려주세요.' : '방문 일정을 제안했습니다.', 'success');
    if (conflictingVisit) showToast(`이 날짜(${date})에 이미 다른 방문 일정이 있어요: ${conflictingVisit.label} (${conflictingVisit.orderCode})`, 'warning');
    if (isBlockedDate) showToast(`이 날짜(${date})는 직접 등록한 휴무일이에요. 착오가 아닌지 확인해 주세요.`, 'warning');
    openPartnerOrderDetailModal(orderCode);
}

/* 실측 방문의 completeSiteVisit과 동일하게, 확정(confirmed) 상태에 멈춰 있던
 * 하자보수 방문도 실제로 다녀왔음을 기록할 방법이 없었다 — 완료 처리로
 * 마무리하고, 고객이 부당하다고 느끼면 이의제기할 수 있게 한다. */
function completeRepairVisit(orderCode, claimId) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.acceptedPartner !== partnerName) return;
    const claim = order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim || claim.visitStatus !== 'confirmed') return;
    claim.visitStatus = 'completed';
    claim.visitCompletedDate = getLocalDateString();
    claim.visitCompletionDisputed = false;
    claim.visitCompletionDisputeResolution = null;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'REPAIR_VISIT_COMPLETE', `[${partnerName}]가 하자보수("${claim.title}") 방문을 완료 처리했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `하자보수("${claim.title}") 방문이 완료 처리되었습니다.`);
    showToast('방문을 완료 처리했습니다.', 'success');
    openPartnerOrderDetailModal(orderCode);
}

/* buildOrderMessageThreadHtml(utils_ui.js)의 파트너 쪽 전송 핸들러 — 고객 쪽
 * sendClientOrderMessage(client_panel.js)와 대칭. */
function sendPartnerOrderMessage(orderCode) {
    const input = document.getElementById(`order-message-input-${orderCode}`);
    const text = input ? input.value : '';
    if (!text.trim()) { showToast('메시지를 입력해주세요.', 'warning'); return; }
    if (typeof sendOrderMessage === 'function') sendOrderMessage(orderCode, 'partner', text);
    if (input) input.value = '';
    openPartnerOrderDetailModal(orderCode);
}

let _repairClaimResponseTarget = null;

function openRepairClaimResponseModal(orderCode, claimId, newStatus) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.acceptedPartner !== partnerName) return;
    _repairClaimResponseTarget = { orderCode, claimId, newStatus };
    const titleMap = { completed: '하자보수 처리 완료 안내', rejected: '하자보수 신청 반려 안내', in_progress: '하자보수 처리 시작 안내' };
    const btnMap = { completed: '처리 완료로 등록', rejected: '반려로 등록', in_progress: '처리 시작으로 등록' };
    safeUpdateText('repair-claim-response-modal-title', titleMap[newStatus] || titleMap.in_progress);
    safeUpdateText('repair-claim-response-submit-btn', btnMap[newStatus] || btnMap.in_progress);
    safeUpdateValue('repair-claim-response-input', '');
    // 완료 처리(completed)일 때만 "처리 완료 사진"이 의미가 있다 — 반려/처리시작
    // 단계에서는 아직 보여줄 결과물이 없으므로 숨긴다.
    document.getElementById('repair-claim-response-photo-section')?.classList.toggle('hidden', newStatus !== 'completed');
    window.AppState.repairClaimResponsePhotoDrafts = [];
    renderRepairClaimResponsePhotoPreview();
    openModal('repair-claim-response-modal', 'repair-claim-response-modal-card');
}

function closeRepairClaimResponseModal() {
    _repairClaimResponseTarget = null;
    closeModal('repair-claim-response-modal', 'repair-claim-response-modal-card');
}

/* 고객은 하자보수 신청 시 사진(하자 증거)을 첨부할 수 있게 됐는데, 파트너가
 * 처리 완료로 등록할 때는 여전히 텍스트 안내뿐이라 실제로 고치긴 한 건지
 * 확인할 방법이 없었다 — 완료 처리에 이의제기(disputeCompletedRepairClaim)가
 * 이미 있는 상황에서, "처리 후" 사진이 있으면 그 이의제기를 훨씬 공정하게
 * 판단할 수 있다. 동일한 FileReader 첨부 패턴을 그대로 재사용한다. */
const MAX_REPAIR_CLAIM_RESPONSE_PHOTOS = 4;

function renderRepairClaimResponsePhotoPreview() {
    const grid = document.getElementById('repair-claim-response-photo-preview-grid');
    if (!grid) return;
    const drafts = window.AppState.repairClaimResponsePhotoDrafts || [];
    grid.innerHTML = drafts.map((src, idx) => `
        <div class="relative aspect-square rounded-xl overflow-hidden border border-ink-100 bg-ink-50">
            <img src="${src}" class="w-full h-full object-cover">
            <button type="button" onclick="removeRepairClaimResponsePhotoDraft(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-ink-950/70 text-white flex items-center justify-center" aria-label="사진 삭제"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removeRepairClaimResponsePhotoDraft(idx) {
    window.AppState.repairClaimResponsePhotoDrafts.splice(idx, 1);
    renderRepairClaimResponsePhotoPreview();
}

function handleRepairClaimResponsePhotoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    if (!window.AppState.repairClaimResponsePhotoDrafts) window.AppState.repairClaimResponsePhotoDrafts = [];
    const remaining = MAX_REPAIR_CLAIM_RESPONSE_PHOTOS - window.AppState.repairClaimResponsePhotoDrafts.length;
    if (input.files.length > remaining) showToast(`사진은 최대 ${MAX_REPAIR_CLAIM_RESPONSE_PHOTOS}장까지 첨부할 수 있어요. (${input.files.length - remaining}장은 담기지 않았어요)`, 'warning');
    Array.from(input.files).slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            window.AppState.repairClaimResponsePhotoDrafts.push(e.target.result);
            renderRepairClaimResponsePhotoPreview();
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}

function submitRepairClaimResponse() {
    if (!_repairClaimResponseTarget) { closeRepairClaimResponseModal(); return; }
    const { orderCode, claimId, newStatus } = _repairClaimResponseTarget;
    const response = document.getElementById('repair-claim-response-input')?.value.trim();
    if (!response) { showToast('고객에게 안내할 내용을 입력해주세요.', 'warning'); return; }

    const order = window.AppState.orders.find(o => o.code === orderCode);
    const claim = order && order.repairClaims && order.repairClaims.find(c => c.id === claimId);
    if (!claim) { closeRepairClaimResponseModal(); return; }

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    claim.status = newStatus;
    claim.partnerResponse = response;
    if (newStatus === 'completed') claim.responsePhotos = (window.AppState.repairClaimResponsePhotoDrafts || []).slice();
    if (newStatus === 'completed' || newStatus === 'rejected') claim.resolvedDate = getLocalDateString();
    window.AppState.repairClaimResponsePhotoDrafts = [];

    const statusLabel = newStatus === 'completed' ? '처리 완료' : newStatus === 'rejected' ? '반려' : '처리 시작';
    if (typeof pushLog === 'function') pushLog('PARTNER', 'REPAIR_CLAIM_UPDATE', `[${partnerName}]가 하자보수 신청("${claim.title}")을 ${statusLabel} 처리했습니다.`, newStatus === 'rejected' ? 'WARNING' : 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `하자보수 신청("${claim.title}")이 ${statusLabel}되었어요.`);
    showToast('하자보수 처리 현황이 업데이트되었습니다.', 'success');

    closeRepairClaimResponseModal();
    openPartnerOrderDetailModal(orderCode);
}

/* 고객이 계약 후 착공일 변경을 요청할 수 있게 됐으니(client_panel.js의
 * openScheduleChangeModal), 파트너 쪽에서도 대칭적으로 요청하고 상대방(고객)의
 * 요청을 수락/거절할 수 있어야 한다. */
let partnerScheduleChangeTargetCode = null;

function openPartnerScheduleChangeModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    const req = order.scheduleChangeRequest;
    if (req && req.status === 'pending' && req.requestedBy === 'partner') { showToast('이미 처리 대기 중인 일정 변경 요청이 있어요.', 'warning'); return; }
    partnerScheduleChangeTargetCode = orderCode;
    safeUpdateValue('partner-schedule-change-date-input', (req && req.status === 'pending') ? req.newDate : order.preferredDate);
    safeUpdateValue('partner-schedule-change-reason-input', '');
    openModal('partner-schedule-change-modal', 'partner-schedule-change-modal-card');
}

function closePartnerScheduleChangeModal() {
    partnerScheduleChangeTargetCode = null;
    closeModal('partner-schedule-change-modal', 'partner-schedule-change-modal-card');
}

function submitPartnerScheduleChangeRequest() {
    const order = window.AppState.orders.find(o => o.code === partnerScheduleChangeTargetCode);
    if (!order) { closePartnerScheduleChangeModal(); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const newDate = document.getElementById('partner-schedule-change-date-input')?.value;
    const reason = document.getElementById('partner-schedule-change-reason-input')?.value.trim();
    if (!newDate) { showToast('변경할 착공일을 선택해주세요.', 'warning'); return; }
    if (!reason) { showToast('변경 사유를 입력해주세요.', 'warning'); return; }
    if (newDate === order.preferredDate) { showToast('현재 착공일과 동일해요.', 'warning'); return; }

    const isCounter = order.scheduleChangeRequest && order.scheduleChangeRequest.status === 'pending' && order.scheduleChangeRequest.requestedBy === 'client';
    order.scheduleChangeRequest = { requestedBy: 'partner', newDate, reason, status: 'pending', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('PARTNER', isCounter ? 'SCHEDULE_CHANGE_COUNTER' : 'SCHEDULE_CHANGE_REQUEST', `[${partnerName}]가 계약(${order.code}) 착공일 변경을 ${isCounter ? '역제안했습니다' : '요청했습니다'}: ${order.preferredDate} → ${newDate}`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, isCounter ? `${partnerName}가 착공일을 ${newDate}로 역제안했어요.` : `${partnerName}가 착공일 변경을 요청했어요: ${order.preferredDate} → ${newDate}`);
    showToast(isCounter ? '역제안을 보냈습니다. 고객 확인을 기다려주세요.' : '착공일 변경 요청을 보냈습니다. 고객 확인을 기다려주세요.', 'success');

    closePartnerScheduleChangeModal();
    openPartnerOrderDetailModal(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function retractPartnerScheduleChangeRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || !order.scheduleChangeRequest || order.scheduleChangeRequest.status !== 'pending') return;
    if (order.scheduleChangeRequest.requestedBy !== 'partner' || order.acceptedPartner !== partnerName) { showToast('고객이 요청한 일정 변경은 파트너사가 직접 철회할 수 없어요.', 'warning'); return; }
    order.scheduleChangeRequest = null;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'SCHEDULE_CHANGE_RETRACT', `[${partnerName}]가 계약(${order.code}) 착공일 변경 요청을 철회했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 착공일 변경 요청을 철회했어요.`);
    showToast('일정 변경 요청을 철회했습니다.', 'info');
    openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function respondToClientScheduleChangeRequest(orderCode, accept) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || !order.scheduleChangeRequest || order.scheduleChangeRequest.status !== 'pending' || order.acceptedPartner !== partnerName) return;
    if (order.scheduleChangeRequest.requestedBy !== 'client') return;
    const { newDate } = order.scheduleChangeRequest;
    if (accept) {
        const oldDate = order.preferredDate;
        order.preferredDate = newDate;
        order.scheduleChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'SCHEDULE_CHANGE_ACCEPT', `[${partnerName}]가 계약(${order.code}) 착공일 변경 요청을 수락했습니다: ${oldDate} → ${newDate}`, 'INFO');
        if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 착공일 변경을 수락했어요. 착공일이 ${newDate}로 변경되었습니다.`);
        showToast('착공일 변경을 수락했습니다.', 'success');
    } else {
        order.scheduleChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'SCHEDULE_CHANGE_REJECT', `[${partnerName}]가 계약(${order.code}) 착공일 변경 요청을 거절했습니다.`, 'INFO');
        if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 착공일 변경 요청을 거절했어요. 기존 일정(${order.preferredDate})이 유지됩니다.`);
        showToast('착공일 변경 요청을 거절했습니다.', 'info');
    }
    openPartnerOrderDetailModal(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildPartnerScheduleChangeHtml(order) {
    const req = order.scheduleChangeRequest;
    let statusHtml = '';
    if (req && req.status === 'pending') {
        const escalateRow = req.escalated
            ? `<p class="text-[10px] font-bold text-roseCustom">매니저 센터에 조정을 요청했어요. 결과를 기다려 주세요.</p>`
            : `<button type="button" onclick="escalateScheduleChangeToAdmin('${order.code}'); openPartnerOrderDetailModal('${order.code}');" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">협의가 어렵다면 매니저에게 조정 요청</button>`;
        statusHtml = req.requestedBy === 'partner'
            ? `<div class="p-2.5 bg-amber-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-amberCustom">고객 확인 대기중: ${req.newDate}로 변경 요청</p>
                <button type="button" onclick="retractPartnerScheduleChangeRequest('${order.code}')" class="btn btn-secondary btn-sm">요청 철회</button>
                ${escalateRow}
            </div>`
            : `<div class="p-2.5 bg-brand-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-brand-700">고객이 착공일 변경을 요청했어요: ${req.newDate} (사유: ${escapeHtml(req.reason)})</p>
                <div class="flex gap-1.5"><button type="button" onclick="respondToClientScheduleChangeRequest('${order.code}', true)" class="btn btn-dark btn-sm flex-1">수락</button><button type="button" onclick="respondToClientScheduleChangeRequest('${order.code}', false)" class="btn btn-secondary btn-sm flex-1">거절</button><button type="button" onclick="openPartnerScheduleChangeModal('${order.code}')" class="btn btn-ghost btn-sm flex-1">역제안</button></div>
                ${escalateRow}
            </div>`;
    }
    return `<div class="p-4 surface-flat text-left space-y-1">
        <div class="flex items-center justify-between"><h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="calendar-clock" class="w-4 h-4 text-ink-500"></i> 착공일: ${order.preferredDate}</h5>
        ${!req || req.status !== 'pending' ? `<button type="button" onclick="openPartnerScheduleChangeModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">변경 요청</button>` : ''}</div>
        ${statusHtml}
    </div>`;
}

/* 고객이 계약 후 금액 변경을 요청할 수 있게 됐으니(client_panel.js의
 * openPriceChangeModal), 파트너 쪽에서도 대칭적으로 요청하고 상대방(고객)의
 * 요청을 수락/거절할 수 있어야 한다. scheduleChangeRequest와 동일한 패턴. */
let partnerPriceChangeTargetCode = null;

function openPartnerPriceChangeModal(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    const req = order.priceChangeRequest;
    if (req && req.status === 'pending' && req.requestedBy === 'partner') { showToast('이미 처리 대기 중인 금액 변경 요청이 있어요.', 'warning'); return; }
    partnerPriceChangeTargetCode = orderCode;
    safeUpdateValue('partner-price-change-amount-input', (req && req.status === 'pending') ? req.newPrice : (order.finalPrice || order.budget));
    safeUpdateValue('partner-price-change-reason-input', '');
    openModal('partner-price-change-modal', 'partner-price-change-modal-card');
}

function closePartnerPriceChangeModal() {
    partnerPriceChangeTargetCode = null;
    closeModal('partner-price-change-modal', 'partner-price-change-modal-card');
}

function submitPartnerPriceChangeRequest() {
    const order = window.AppState.orders.find(o => o.code === partnerPriceChangeTargetCode);
    if (!order) { closePartnerPriceChangeModal(); return; }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const newPrice = parseInt(document.getElementById('partner-price-change-amount-input')?.value, 10);
    const reason = document.getElementById('partner-price-change-reason-input')?.value.trim();
    if (!newPrice || newPrice <= 0) { showToast('변경할 계약 금액을 올바르게 입력해주세요.', 'warning'); return; }
    if (!reason) { showToast('변경 사유를 입력해주세요.', 'warning'); return; }
    if (newPrice === order.finalPrice) { showToast('현재 계약 금액과 동일해요.', 'warning'); return; }

    const isCounter = order.priceChangeRequest && order.priceChangeRequest.status === 'pending' && order.priceChangeRequest.requestedBy === 'client';
    order.priceChangeRequest = { requestedBy: 'partner', newPrice, reason, status: 'pending', date: getLocalDateString() };

    if (typeof pushLog === 'function') pushLog('PARTNER', isCounter ? 'PRICE_CHANGE_COUNTER' : 'PRICE_CHANGE_REQUEST', `[${partnerName}]가 계약(${order.code}) 금액 변경을 ${isCounter ? '역제안했습니다' : '요청했습니다'}: ₩${(order.finalPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, isCounter ? `${partnerName}가 계약 금액을 ₩${newPrice.toLocaleString()}만원으로 역제안했어요.` : `${partnerName}가 계약 금액 변경을 요청했어요: ₩${(order.finalPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`);
    showToast(isCounter ? '역제안을 보냈습니다. 고객 확인을 기다려주세요.' : '계약 금액 변경 요청을 보냈습니다. 고객 확인을 기다려주세요.', 'success');

    closePartnerPriceChangeModal();
    openPartnerOrderDetailModal(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function retractPartnerPriceChangeRequest(orderCode) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || !order.priceChangeRequest || order.priceChangeRequest.status !== 'pending') return;
    if (order.priceChangeRequest.requestedBy !== 'partner' || order.acceptedPartner !== partnerName) { showToast('고객이 요청한 금액 변경은 파트너사가 직접 철회할 수 없어요.', 'warning'); return; }
    order.priceChangeRequest = null;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PRICE_CHANGE_RETRACT', `[${partnerName}]가 계약(${order.code}) 금액 변경 요청을 철회했습니다.`, 'INFO');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 계약 금액 변경 요청을 철회했어요.`);
    showToast('금액 변경 요청을 철회했습니다.', 'info');
    openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function respondToClientPriceChangeRequest(orderCode, accept) {
    const order = window.AppState.orders.find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || !order.priceChangeRequest || order.priceChangeRequest.status !== 'pending' || order.acceptedPartner !== partnerName) return;
    if (order.priceChangeRequest.requestedBy !== 'client') return;
    const { newPrice } = order.priceChangeRequest;
    if (accept) {
        const oldPrice = order.finalPrice;
        order.finalPrice = newPrice;
        order.priceChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'PRICE_CHANGE_ACCEPT', `[${partnerName}]가 계약(${order.code}) 금액 변경 요청을 수락했습니다: ₩${(oldPrice || 0).toLocaleString()}만원 → ₩${newPrice.toLocaleString()}만원`, 'INFO');
        if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 계약 금액 변경을 수락했어요. 계약 금액이 ₩${newPrice.toLocaleString()}만원으로 변경되었습니다.`);
        showToast('계약 금액 변경을 수락했습니다.', 'success');
    } else {
        order.priceChangeRequest = null;
        if (typeof pushLog === 'function') pushLog('PARTNER', 'PRICE_CHANGE_REJECT', `[${partnerName}]가 계약(${order.code}) 금액 변경 요청을 거절했습니다.`, 'INFO');
        if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}가 계약 금액 변경 요청을 거절했어요. 기존 금액(₩${(order.finalPrice || 0).toLocaleString()}만원)이 유지됩니다.`);
        showToast('계약 금액 변경 요청을 거절했습니다.', 'info');
    }
    openPartnerOrderDetailModal(order.code);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildPartnerPriceChangeHtml(order) {
    const req = order.priceChangeRequest;
    let statusHtml = '';
    if (req && req.status === 'pending') {
        const escalateRow = req.escalated
            ? `<p class="text-[10px] font-bold text-roseCustom">매니저 센터에 조정을 요청했어요. 결과를 기다려 주세요.</p>`
            : `<button type="button" onclick="escalatePriceChangeToAdmin('${order.code}'); openPartnerOrderDetailModal('${order.code}');" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">협의가 어렵다면 매니저에게 조정 요청</button>`;
        statusHtml = req.requestedBy === 'partner'
            ? `<div class="p-2.5 bg-amber-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-amberCustom">고객 확인 대기중: ₩${req.newPrice.toLocaleString()}만원으로 변경 요청</p>
                <button type="button" onclick="retractPartnerPriceChangeRequest('${order.code}')" class="btn btn-secondary btn-sm">요청 철회</button>
                ${escalateRow}
            </div>`
            : `<div class="p-2.5 bg-brand-50 rounded-xl mt-2 space-y-1.5">
                <p class="text-[10px] font-black text-brand-700">고객이 계약 금액 변경을 요청했어요: ₩${req.newPrice.toLocaleString()}만원 (사유: ${escapeHtml(req.reason)})</p>
                <div class="flex gap-1.5"><button type="button" onclick="respondToClientPriceChangeRequest('${order.code}', true)" class="btn btn-dark btn-sm flex-1">수락</button><button type="button" onclick="respondToClientPriceChangeRequest('${order.code}', false)" class="btn btn-secondary btn-sm flex-1">거절</button><button type="button" onclick="openPartnerPriceChangeModal('${order.code}')" class="btn btn-ghost btn-sm flex-1">역제안</button></div>
                ${escalateRow}
            </div>`;
    }
    return `<div class="p-4 surface-flat text-left space-y-1">
        <div class="flex items-center justify-between"><h5 class="text-xs font-black text-ink-950 flex items-center gap-1.5"><i data-lucide="banknote" class="w-4 h-4 text-ink-500"></i> 계약 금액: ₩ ${(order.finalPrice || 0).toLocaleString()}만원</h5>
        ${!req || req.status !== 'pending' ? `<button type="button" onclick="openPartnerPriceChangeModal('${order.code}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0">변경 요청</button>` : ''}</div>
        ${statusHtml}
    </div>`;
}

/* 후기가 삭제되면 신고자에게는 알림이 가지만(notifyReportResolved), 정작 그 후기를
 * 작성한 고객 본인은 자기 글이 지워진 사실조차 알 방법이 없었고 소명할 방법도
 * 없었다 — 계약 강제 취소 이의신청과 동일한 비대칭이다. 삭제 시 스냅샷을 별도
 * 로그에 남겨 작성자가 이의신청을 제출하면 관리자가 승인(복원) 또는 반려할 수
 * 있게 한다. */
function adminDeleteReview(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.reviews || !partner.reviews[reviewIdx]) return;
    const review = partner.reviews[reviewIdx];
    const reportedBy = review.reportedBy;
    const order = review.orderCode ? (window.AppState.orders || []).find(o => o.code === review.orderCode) : null;

    partner.reviews.splice(reviewIdx, 1);
    partner.rating = partner.reviews.length > 0
        ? Math.round((partner.reviews.reduce((acc, r) => acc + r.rating, 0) / partner.reviews.length) * 10) / 10
        : 5.0;

    if (!window.AppState.reviewDeletionLog) window.AppState.reviewDeletionLog = [];
    const logEntry = {
        id: `rdl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        partnerName, orderCode: review.orderCode, clientPhone: order ? order.clientPhone : null,
        reviewSnapshot: review, date: getLocalDateString(), appeal: null
    };
    window.AppState.reviewDeletionLog.unshift(logEntry);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'REVIEW_MODERATE', `[후기 삭제] '${partnerName}' 파트너의 후기를 매니저 센터에서 삭제 조치함.`, 'WARNING');
    if (typeof notifyReportResolved === 'function') notifyReportResolved(reportedBy, `신고하신 [${partnerName}]의 후기가 검토 후 삭제 처리되었습니다.`);
    if (logEntry.clientPhone && typeof pushClientNotification === 'function') pushClientNotification(logEntry.clientPhone, `작성하신 [${partnerName}] 후기가 매니저 센터 검토 후 삭제되었습니다. 부당하다고 생각되시면 마이페이지에서 소명하실 수 있어요.`);
    showToast('후기를 삭제했습니다.', 'info');
    openPartnerMetricsModal(partnerName);
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 관리자용 상세 성과 모달과 파트너 본인용 "내 실적" 탭이 똑같은 참여/계약/GMV
 * 계산 로직을 쓴다 — 한 곳에 모아두면 나중에 계산 방식이 바뀌어도 두 화면이
 * 어긋날 일이 없다. */
/* "안심 인증"(togglePartnerCertification)은 매니저가 심사해서 부여/회수하는
 * 이진 배지이고, "이번 주 인기"는 최근 7일 좋아요·조회수 기반의 일시적 배지다 —
 * 정작 누적 계약 건수·평점으로 쌓인 장기 신뢰도를 한눈에 보여줄 배지가 전혀
 * 없어서, 고객이 3건짜리 신규 업체와 300건짜리 노포를 별점 하나로만 구분해야
 * 했다. 관리자 개입 없이 데이터로만 자동 산정되는 등급을 둔다. */
const PARTNER_TIER_DEFS = [
    { key: 'platinum', label: '플래티넘 파트너', minContracts: 20, minRating: 4.5, cls: 'badge-brand' },
    { key: 'gold', label: '골드 파트너', minContracts: 10, minRating: 4.0, cls: 'badge-gold' },
    { key: 'silver', label: '실버 파트너', minContracts: 3, minRating: 0, cls: 'badge-neutral' }
];

function computePartnerTier(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return null;
    const contractedCount = (window.AppState.orders || []).filter(o => o.status === 'contracted' && o.acceptedPartner === partnerName).length;
    const rating = partner.rating || 5.0;
    return PARTNER_TIER_DEFS.find(t => contractedCount >= t.minContracts && rating >= t.minRating) || null;
}

function buildPartnerTierBadgeHtml(partnerName) {
    const tier = computePartnerTier(partnerName);
    return tier ? `<span class="badge ${tier.cls}">${tier.label}</span>` : '';
}

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

/* favoriteClientCount는 "몇 명이 나를 찜했는지" 숫자만 보여줄 뿐, 그 숫자를 만든
 * toggleFavoritePartner(client_panel.js)를 클릭한 고객이 정확히 누구인지는 파트너가
 * 끝내 알 수 없었다 — 파트너 본인이 고르는 단골 고객 목록(favoriteClients,
 * toggleFavoriteClient)과는 정반대 방향의 데이터다. 이미 관심을 보인 고객을
 * 바로 단골로 전환할 수 있게 한다. */
function getPartnerFavoritedByClients(partnerName) {
    return (window.AppState.clientAccounts || [])
        .filter(a => !a.managerRole && (a.favoritePartners || []).includes(partnerName))
        .map(a => ({ id: a.id, name: a.name, phone: a.phone }));
}

function buildPartnerFavoritedByClientsHtml(partnerName) {
    const clients = getPartnerFavoritedByClients(partnerName);
    if (clients.length === 0) {
        return `<p class="text-[10px] text-ink-400 font-semibold">아직 나를 관심 등록한 고객이 없습니다.</p>`;
    }
    return `<div class="space-y-1.5">${clients.map(c => {
        const alreadyFavorited = isClientFavorited(c.phone);
        return `<div class="flex items-center justify-between p-2.5 bg-ink-50 rounded-xl">
            <p class="text-xs font-black text-ink-900">${escapeHtml(maskName(c.name))}</p>
            <button type="button" onclick="toggleFavoriteClient('${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" class="text-[10px] font-bold ${alreadyFavorited ? 'text-ink-400' : 'text-brand-600'} hover:underline bg-transparent border-0 cursor-pointer p-0">${alreadyFavorited ? '단골 등록됨' : '단골로 저장'}</button>
        </div>`;
    }).join('')}</div>`;
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
    const avgResponseHours = typeof computePartnerAvgResponseHours === 'function' ? computePartnerAvgResponseHours(partnerName) : null;

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
                    <div class="article-spec-chip"><span>평균 응답 속도</span><span class="val">${typeof formatResponseHours === 'function' ? formatResponseHours(avgResponseHours) : '-'}</span></div>
                    <div class="article-spec-chip"><span>등록된 담당자 계정</span><span class="val">${(partner.staffAccounts || []).length} 명</span></div>
                </div>
                ${(partner.staffAccounts || []).length > 0 ? `
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="users" class="w-4 h-4 text-ink-600"></i> 담당자 계정 목록 (${partner.staffAccounts.length}명)</h4>
                    <div class="flex flex-wrap gap-1.5">${partner.staffAccounts.map(s => `<span class="badge badge-neutral">${escapeHtml(s.label)} (${escapeHtml(s.id)})</span>`).join('')}</div>
                </div>` : ''}
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="heart" class="w-4 h-4 text-roseCustom"></i> 나를 관심 등록한 고객 (${favoriteClientCount}명)</h4>
                    ${buildPartnerFavoritedByClientsHtml(partnerName)}
                </div>
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-check" class="w-4 h-4 text-ink-600"></i> 최근 안심 계약 체결 및 안심 문서 검증 (${contractedCount}건)</h4>
                    <div class="space-y-2">${contractedListHtml}</div>
                </div>
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="star" class="w-4 h-4 text-ink-600"></i> 등록된 안심 후기 관리 (${(partner.reviews || []).length}건)</h4>
                    <div class="space-y-2">${buildAdminReviewModerationHtml(partner)}</div>
                </div>
                ${buildReviewDeletionAppealsHtml(partner.name)}
                ${buildReviewReplyDeletionAppealsHtml(partner.name)}
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="image" class="w-4 h-4 text-ink-600"></i> 등록된 시공사례 관리 (${(partner.portfolios || []).filter(p => !p.isDraft).length}건)</h4>
                    <div class="space-y-2">${buildAdminPortfolioModerationHtml(partner)}</div>
                </div>
                <div class="space-y-2.5 pt-2">
                    <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="flag" class="w-4 h-4 text-roseCustom"></i> 고객 신고 내역 (${((window.AppState.partnerReports || []).filter(r => r.partnerName === partner.name)).length}건)</h4>
                    <div class="space-y-2">${buildAdminPartnerReportsHtml(partner)}</div>
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
    const avgResponseHours = typeof computePartnerAvgResponseHours === 'function' ? computePartnerAvgResponseHours(partnerName) : null;

    container.innerHTML = `
        <div class="surface surface-lg p-6 sm:p-8 space-y-5 text-left">
            <div class="border-b border-ink-100 pb-4 flex flex-wrap justify-between items-center gap-2">
                <div><span class="badge badge-brand">경영 지표</span>${buildPartnerTierBadgeHtml(partnerName)}
                <h4 class="text-sm sm:text-base font-black text-ink-950 tracking-tight mt-1 flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-4 h-4 text-brand-500"></i> 내 실적 요약</h4></div>
                <button type="button" onclick="exportPartnerPerformanceCsv()" class="btn btn-secondary btn-sm shrink-0"><i data-lucide="download" class="w-3.5 h-3.5"></i> CSV로 내보내기</button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="article-spec-chip"><span>참여 입찰 오더</span><span class="val">${participatedCount} 건</span></div>
                <div class="article-spec-chip"><span>최종 계약 체결</span><span class="val">${contractedCount} 건</span></div>
                <div class="article-spec-chip"><span>계약 성공률</span><span class="val">${contractRate} %</span></div>
                <div class="article-spec-chip"><span>누적 거래액 (GMV)</span><span class="val">₩ ${totalGmv.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>수수료 지불완료</span><span class="val">₩ ${totalCommissionPaid.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>보증 에스크로 잔액</span><span class="val">₩ ${pendingEscrow.toLocaleString()} 만원</span></div>
                <div class="article-spec-chip"><span>관심 고객 수</span><span class="val">${favoriteClientCount} 명</span></div>
                <div class="article-spec-chip"><span>평균 응답 속도</span><span class="val">${typeof formatResponseHours === 'function' ? formatResponseHours(avgResponseHours) : '-'}</span></div>
            </div>
            <div class="space-y-2.5 pt-2">
                <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="heart" class="w-4 h-4 text-roseCustom"></i> 나를 관심 등록한 고객 (${favoriteClientCount}명)</h4>
                ${buildPartnerFavoritedByClientsHtml(partnerName)}
            </div>
            <div class="space-y-2.5 pt-2">
                <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="file-check" class="w-4 h-4 text-ink-600"></i> 최근 안심 계약 체결 및 안심 문서 검증 (${contractedCount}건)</h4>
                <div class="space-y-2">${contractedListHtml}</div>
            </div>
            <div class="space-y-2.5 pt-2">
                <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="star" class="w-4 h-4 text-gold-500"></i> 저장한 단골 고객 (${(partner.favoriteClients || []).length}명)</h4>
                <div class="space-y-2">${buildPartnerFavoriteClientsHtml(partner)}</div>
            </div>
            <div class="space-y-2.5 pt-2">
                <h4 class="text-xs font-black text-ink-800 flex items-center gap-1.5 uppercase tracking-wider"><i data-lucide="user-x" class="w-4 h-4 text-roseCustom"></i> 차단한 고객 (${(partner.blockedClients || []).length}명)</h4>
                <div class="space-y-2">${buildPartnerBlockedClientsHtml(partner)}</div>
            </div>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 관리자 쪽에는 고객/파트너/로그 CSV 내보내기가 다 있는데, 파트너 본인의 "내 실적"은
 * 화면으로만 볼 수 있고 엑셀 등으로 내려받아 세무·정산 자료로 보관할 방법이 없었다 —
 * 동일한 exportXToCsv 패턴을 재사용한다. */
function exportPartnerPerformanceCsv() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const { contractedOrders } = computePartnerMetrics(partnerName);
    if (contractedOrders.length === 0) { showToast('내보낼 계약 체결 내역이 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const header = ['의뢰코드', '고객명', '시공장소', '계약금액(만원)', '수수료(만원)', '수수료납부여부'].map(escapeCsvCell).join(',');
    const rows = contractedOrders.map(o => {
        const price = o.finalPrice || 0;
        const commission = Math.floor(price * PLATFORM_COMMISSION_RATE);
        return [o.code, o.clientName, o.clientAddress, price, commission, o.commissionPaid ? '납부완료' : '납부대기'].map(escapeCsvCell).join(',');
    });
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_내실적_${partnerName}_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PERFORMANCE_EXPORT', `[${partnerName}]가 내 실적 계약 내역 ${contractedOrders.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`계약 체결 내역 ${contractedOrders.length}건을 CSV로 내보냈습니다.`, 'success');
}

/* 고객은 캔버스 서명(initSignatureCanvas, client_panel.js)으로 계약에 서명할 수
 * 있게 됐지만, 계약은 양측 서명이 필요한데 파트너 콘솔에는 대응 서명 기능이
 * 전혀 없어서 order.clientSigned 하나만으로 "서명 완료"인 것처럼 보였다 —
 * 동일한 캔버스 서명 패턴을 파트너 쪽에도 구현한다. */
const _partnerSignaturePads = {};

function initPartnerSignatureCanvas(orderCode) {
    const canvas = document.getElementById(`partner-signature-canvas-${orderCode}`);
    if (!canvas || canvas.dataset.initialized) return;
    canvas.dataset.initialized = 'true';
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    _partnerSignaturePads[orderCode] = { hasInk: false };

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
        _partnerSignaturePads[orderCode].hasInk = true;
    };
    const end = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', move);
    canvas.addEventListener('touchend', end);
}

function clearPartnerSignatureCanvas(orderCode) {
    const canvas = document.getElementById(`partner-signature-canvas-${orderCode}`);
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (_partnerSignaturePads[orderCode]) _partnerSignaturePads[orderCode].hasInk = false;
}

function submitPartnerSignatureCanvas(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) return;
    const canvas = document.getElementById(`partner-signature-canvas-${orderCode}`);
    if (!canvas || !_partnerSignaturePads[orderCode] || !_partnerSignaturePads[orderCode].hasInk) {
        showToast('서명란에 서명을 먼저 입력해 주세요.', 'warning');
        return;
    }

    order.partnerSigned = true;
    order.partnerSignedDate = getLocalDateString();
    order.partnerSignatureImage = canvas.toDataURL('image/png');

    if (order.clientSigned && order.partnerSigned && typeof grantClientBenefit === 'function') {
        grantClientBenefit(order.clientPhone, 'warranty_coupon', '3년 하자이행보증 무상 쿠폰', '하자보수 무상 보증', order.code);
    }

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CONTRACT_SIGN', `[${partnerName}]가 계약(${order.code}) 합의서에 전자서명을 완료했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function') pushClientNotification(order.clientPhone, `${partnerName}에서 계약(${order.code}) 합의서에 서명을 완료했어요.${order.clientSigned ? ' 양측 서명이 모두 완료되었습니다.' : ''}`);
    showToast('서명이 완료되었습니다.', 'success');
    openPartnerOrderDetailModal(orderCode);
    if (typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
}

function buildDocFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* 고객은 계약 완료 후 최종 금액/수수료/납부상태가 정리된 거래 확인서를 받을 수
 * 있는데(downloadTransactionReceipt, client_panel.js), 파트너 쪽에는 동일한 정산
 * 요약본이 없었다 — downloadContractDoc은 표준 계약서 양식일 뿐 실지급액을 담지
 * 않는다. 수수료 납부가 끝난 계약에 한해 실지급액까지 정리한 확인서를 내려준다. */
function downloadPartnerSettlementReceipt(orderCode) {
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    if (!order || order.status !== 'contracted' || order.acceptedPartner !== partnerName) { showToast('계약이 체결된 오더만 정산 확인서를 발급할 수 있어요.', 'warning'); return; }
    if (!order.commissionPaid) { showToast('플랫폼 수수료 납부가 완료된 이후에 발급할 수 있어요.', 'warning'); return; }

    const price = order.finalPrice || order.budget;
    const commission = Math.floor(price * PLATFORM_COMMISSION_RATE);
    const payout = price - commission;
    const content = `====================================================\n[우리집 안심 중개] 파트너 정산 확인서\n====================================================\n\n1. 거래 정보\n   - 의뢰 코드: ${order.code}\n   - 시공 장소: ${order.clientAddress}\n   - 고객명: ${order.clientName} 고객님\n   - 파트너사: ${partnerName}\n\n2. 정산 내역 (단위: 만원)\n   --------------------------------------------------\n   - 최종 계약 금액: ₩ ${price.toLocaleString()} 만원\n   - 플랫폼 중개 수수료 (${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)}%): - ₩ ${commission.toLocaleString()} 만원\n   - 실지급액: ₩ ${payout.toLocaleString()} 만원\n   - 수수료 납부 상태: 납부 완료\n\n발급일자: ${getLocalDateString()}\n본 확인서는 우리집 안심 중개 플랫폼에서 자동 발급되었습니다.\n====================================================`;
    buildDocFile(content, `[우리집안심중개]_파트너정산확인서_${order.code}.txt`);
    showToast('정산 확인서 다운로드가 시작되었습니다.', 'success');
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

/* 파트너에는 옐로카드(strikeCount) 누적→삼진아웃(영구 제명) 체계가 있는데, 고객
 * 계정은 toggleClientSuspension의 가역적 boolean 정지 하나뿐이라 반복 위반자를
 * 단계적으로 제재하거나 영구 제명할 방법이 없었다 — issuePartnerStrike/
 * resetPartnerStrikes와 완전히 동일한 구조를 clientAccounts에도 적용한다. */
function issueClientStrike(accountId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account) return;
    if (account.status === 'banned') { showToast('이미 삼진아웃으로 영구 제명된 고객입니다.', 'info'); return; }
    account.clientStrikeCount = (account.clientStrikeCount || 0) + 1;
    if (account.clientStrikeCount >= 3) {
        account.status = 'banned';
        if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_STRIKE_OUT', `[삼진아웃] '${account.name}'(${account.id}) 경고 3회 초과로 영구 제명 처리.`, 'WARNING');
        if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, '삼진아웃(경고 3회 초과)으로 영구 제명 처리되었습니다.');
        showToast(`[${account.name}] 고객이 삼진아웃(경고 3회)으로 영구 제명되었습니다.`, 'warning');
    } else {
        if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_STRIKE', `'${account.name}'(${account.id}) 고객에게 경고 부여 (누적 ${account.clientStrikeCount}회).`, 'INFO');
        if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `경고가 부여되었습니다. (누적 ${account.clientStrikeCount}/3회 — 3회 누적 시 영구 제명됩니다)`);
        showToast(`[${account.name}] 고객에게 경고가 부여되었습니다. (누적: ${account.clientStrikeCount}/3회)`, 'info');
    }
    renderAdminClientManager();
}

function resetClientStrikes(accountId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account) return;
    const wasBanned = account.status === 'banned';
    account.clientStrikeCount = 0;
    if (wasBanned) account.status = 'active';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_STRIKE_RESET', `'${account.name}'(${account.id}) 고객의 경고 기록을 초기화했습니다.${wasBanned ? ' 제명도 해제되었습니다.' : ''}`, 'INFO');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, wasBanned ? '제명이 해제되고 경고 기록이 초기화되었습니다.' : '경고 기록이 초기화되었습니다.');
    showToast(`[${account.name}] 고객의 경고가 정상 초기화되었습니다.`, 'success');
    renderAdminClientManager();
}

/* adminApproveStrikeAppeal/adminRejectStrikeAppeal(파트너)과 동일한 승인/반려
 * 대칭 구조를 고객 경고 이의신청(clientStrikeAppeal)에도 적용한다. */
function adminApproveClientStrikeAppeal(accountId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account || !account.clientStrikeAppeal || account.clientStrikeAppeal.status !== 'pending') return;
    const wasBanned = account.status === 'banned';
    account.clientStrikeCount = Math.max(0, (account.clientStrikeCount || 0) - 1);
    if (wasBanned && account.clientStrikeCount < 3) account.status = 'active';
    account.clientStrikeAppeal.status = 'approved';
    account.clientStrikeAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_STRIKE_APPEAL_APPROVE', `[이의신청 승인] '${account.name}'(${account.id}) 고객의 이의신청을 승인하여 경고 1회를 취소했습니다.${wasBanned ? ' 제명도 해제되었습니다.' : ''} (현재 누적 ${account.clientStrikeCount}회)`, 'SUCCESS');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `이의신청이 승인되어 경고가 취소되었습니다.${wasBanned ? ' 제명도 해제되었습니다.' : ''} (현재 누적 ${account.clientStrikeCount}회)`);
    showToast(`[${account.name}] 이의신청을 승인했습니다.`, 'success');
    renderAdminClientManager();
}

function adminRejectClientStrikeAppeal(accountId, reason) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === accountId);
    if (!account || !account.clientStrikeAppeal || account.clientStrikeAppeal.status !== 'pending') return;
    account.clientStrikeAppeal.status = 'rejected';
    account.clientStrikeAppeal.adminResponse = reason;
    account.clientStrikeAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CLIENT_STRIKE_APPEAL_REJECT', `[이의신청 반려] '${account.name}'(${account.id}) 고객의 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${account.name}] 이의신청을 반려했습니다.`, 'info');
    renderAdminClientManager();
}

/* toggleClientSuspension(고객 계정 즉시 정지)의 파트너 쪽 대칭 기능. 옐로카드는
 * 영구 기록이라 조사 중인 파트너를 잠시만 막아두기엔 과하고, 삼진아웃(영구 제명)
 * 전까지는 매니저가 취할 조치가 전혀 없었다 — isSuspended 플래그만으로 로그인을
 * 막는 가역적인 "일시 정지"를 strikeCount와 완전히 분리해서 추가한다. */
function togglePartnerSuspension(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    partner.isSuspended = !partner.isSuspended;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_SUSPEND', `'${partner.name}' 파트너 계정을 ${partner.isSuspended ? '이용 정지' : '정지 해제'}했습니다.`, partner.isSuspended ? 'WARNING' : 'INFO');
    if (typeof pushPartnerNotification === 'function') {
        pushPartnerNotification(partner.name, partner.isSuspended
            ? '이용 정지 처리되었습니다. 자세한 사유는 매니저 센터로 문의해 주세요.'
            : '이용 정지가 해제되었습니다. 다시 서비스를 이용하실 수 있어요.');
    }
    showToast(`[${partner.name}] 파트너 계정이 ${partner.isSuspended ? '이용 정지되었습니다' : '정지 해제되었습니다'}.`, partner.isSuspended ? 'warning' : 'success');
    renderAdminPartnerMonitor();
}

/* 고객 계정 정지는 로그인 화면에서 바로 이의신청할 수 있는데(openSuspensionAppealModal,
 * client_panel.js) 방금 추가한 파트너 정지(togglePartnerSuspension)는 소명할 방법이
 * 전혀 없었다 — 로그인 자체가 막혀 파트너 콘솔(옐로카드 이의신청이 있는 곳)에도
 * 접근할 수 없으므로, 고객과 동일하게 로그인 화면에서 바로 제출하는 모달을 둔다. */
let partnerSuspensionAppealTargetId = null;

function openPartnerSuspensionAppealModal(partnerId) {
    const partner = window.AppState.partners.find(p => p.id === partnerId);
    if (!partner) return;
    if (partner.suspensionAppeal && partner.suspensionAppeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요. 매니저 센터 심사 결과를 기다려주세요.', 'warning'); return; }
    partnerSuspensionAppealTargetId = partnerId;
    safeUpdateValue('partner-suspension-appeal-reason-input', '');
    openModal('partner-suspension-appeal-modal', 'partner-suspension-appeal-modal-card');
}

function closePartnerSuspensionAppealModal() {
    partnerSuspensionAppealTargetId = null;
    closeModal('partner-suspension-appeal-modal', 'partner-suspension-appeal-modal-card');
}

function submitPartnerSuspensionAppeal() {
    const partner = window.AppState.partners.find(p => p.id === partnerSuspensionAppealTargetId);
    if (!partner) { closePartnerSuspensionAppealModal(); return; }
    const reason = document.getElementById('partner-suspension-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    partner.suspensionAppeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PARTNER_SUSPENSION_APPEAL', `[${partner.name}]가 계정 정지에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closePartnerSuspensionAppealModal();
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function adminApprovePartnerSuspensionAppeal(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner || !partner.suspensionAppeal || partner.suspensionAppeal.status !== 'pending') return;
    partner.isSuspended = false;
    partner.suspensionAppeal.status = 'approved';
    partner.suspensionAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_SUSPENSION_APPEAL_APPROVE', `[이의신청 승인] '${partner.name}' 파트너의 계정 정지 이의신청을 승인하여 정지를 해제했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, `제출하신 이의신청이 승인되어 계정 정지가 해제되었습니다. 다시 로그인하실 수 있어요.`);
    showToast(`[${partner.name}] 파트너의 이의신청을 승인하여 정지를 해제했습니다.`, 'success');
    renderAdminPartnerMonitor();
}

function adminRejectPartnerSuspensionAppeal(partnerId, reason) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner || !partner.suspensionAppeal || partner.suspensionAppeal.status !== 'pending') return;
    partner.suspensionAppeal.status = 'rejected';
    partner.suspensionAppeal.adminResponse = reason;
    partner.suspensionAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_SUSPENSION_APPEAL_REJECT', `[이의신청 반려] '${partner.name}' 파트너의 계정 정지 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, `제출하신 이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${partner.name}] 파트너의 이의신청을 반려했습니다.`, 'info');
    renderAdminPartnerMonitor();
}

/* 파트너가 옐로카드/제명 조치에 이의신청을 제출할 수 있게 됐으니(cms.js의
 * openStrikeAppealModal), 관리자 쪽에도 심사(승인/반려) 화면이 필요하다.
 * approveContractCancellation과 동일한 제출→심사 패턴. */
function renderAdminStrikeAppeals() {
    const container = document.getElementById('admin-strike-appeals-list');
    if (!container) return;
    const pending = (window.AppState.partners || []).filter(p => p.strikeAppeal && p.strikeAppeal.status === 'pending');

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">현재 심사 대기 중인 이의신청이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = pending.map(p => `
        <div class="surface p-5 space-y-3 text-left">
            <div class="flex justify-between items-start gap-2">
                <div class="space-y-1">
                    <span class="badge badge-amber">이의신청 심사대기</span>
                    <h4 class="text-sm font-black text-ink-950">${escapeHtml(p.name)} ${p.strikeAppeal.wasBanned ? '(영구 제명)' : `(옐로카드 ${p.strikeAppeal.strikeCountAtAppeal}회)`}</h4>
                </div>
            </div>
            <div class="p-3 bg-ink-50 rounded-xl">
                <p class="text-[10px] font-black text-ink-500 uppercase tracking-wider mb-1">이의신청 내용 (${p.strikeAppeal.date})</p>
                <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(p.strikeAppeal.reason)}</p>
            </div>
            <div class="flex items-center gap-2 justify-end pt-1">
                <button type="button" onclick="openReportReasonPrompt((reason) => adminRejectStrikeAppeal('${escapeHtml(p.name)}', reason))" class="btn btn-secondary btn-sm">이의신청 반려</button>
                <button type="button" onclick="adminApproveStrikeAppeal('${escapeHtml(p.name)}')" class="btn btn-dark btn-sm text-emeraldCustom">승인 (경고 취소)</button>
            </div>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function adminApproveStrikeAppeal(partnerName) {
    const partner = (window.AppState.partners || []).find(p => p.name === partnerName);
    if (!partner || !partner.strikeAppeal || partner.strikeAppeal.status !== 'pending') return;
    const wasBanned = partner.status === 'banned';
    partner.strikeCount = Math.max(0, (partner.strikeCount || 0) - 1);
    if (wasBanned && partner.strikeCount < 3) partner.status = 'active';
    partner.strikeAppeal.status = 'approved';
    partner.strikeAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'STRIKE_APPEAL_APPROVE', `[이의신청 승인] '${partner.name}' 파트너의 이의신청을 승인하여 경고 1회를 취소했습니다.${wasBanned ? ' 제명도 해제되었습니다.' : ''} (현재 누적 ${partner.strikeCount}회)`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `이의신청이 승인되어 경고가 취소되었습니다.${wasBanned ? ' 제명도 해제되었습니다.' : ''} (현재 누적 ${partner.strikeCount}회)`);
    showToast(`[${partnerName}] 이의신청을 승인했습니다.`, 'success');
    renderAdminStrikeAppeals();
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function adminRejectStrikeAppeal(partnerName, reason) {
    const partner = (window.AppState.partners || []).find(p => p.name === partnerName);
    if (!partner || !partner.strikeAppeal || partner.strikeAppeal.status !== 'pending') return;
    partner.strikeAppeal.status = 'rejected';
    partner.strikeAppeal.adminResponse = reason;
    partner.strikeAppeal.resolvedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('MANAGER', 'STRIKE_APPEAL_REJECT', `[이의신청 반려] '${partner.name}' 파트너의 이의신청을 반려했습니다. 사유: ${reason}`, 'WARNING');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `이의신청이 반려되었습니다. 사유: ${reason}`);
    showToast(`[${partnerName}] 이의신청을 반려했습니다.`, 'info');
    renderAdminStrikeAppeals();
}

/* 인증 부여(togglePartnerCertification)가 지금까지 만료 없는 영구 boolean이라,
 * 실제 자격증·면허 갱신 없이도 인증이 평생 유지되는 공백이 있었다 — 매니저 권한
 * 만료(sweepExpiredManagerRoles)와 동일하게 접근 시점에 만료를 검사해 자동
 * 회수하고, 파트너가 직접 갱신을 요청할 수 있게 한다. */
function togglePartnerCertification(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if (!partner.isCertified) {
        openPartnerCertGrantModal(partnerName);
        return;
    }
    partner.isCertified = false;
    partner.certExpiryDate = null;
    partner.certRenewalRequested = false;
    showToast(`[${partnerName}] 파트너사의 안심 인증이 해제되었습니다.`, "info");
    renderAdminPartnerMonitor();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

let partnerCertGrantTarget = null;

function openPartnerCertGrantModal(partnerName) {
    partnerCertGrantTarget = partnerName;
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    safeUpdateValue('partner-cert-expiry-input', oneYearLater.toISOString().slice(0, 10));
    openModal('partner-cert-grant-modal', 'partner-cert-grant-modal-card');
}

function closePartnerCertGrantModal() {
    partnerCertGrantTarget = null;
    closeModal('partner-cert-grant-modal', 'partner-cert-grant-modal-card');
}

function submitPartnerCertGrant() {
    const partner = window.AppState.partners.find(p => p.name === partnerCertGrantTarget);
    if (!partner) { closePartnerCertGrantModal(); return; }
    const expiryDate = document.getElementById('partner-cert-expiry-input')?.value;
    if (!expiryDate) { showToast('인증 만료일을 선택해주세요.', 'warning'); return; }

    partner.isCertified = true;
    partner.certExpiryDate = expiryDate;
    partner.certRenewalRequested = false;

    if (typeof pushLog === 'function') pushLog('MANAGER', 'CERT_GRANT', `'${partner.name}' 파트너사에 안심 인증을 부여했습니다. (만료일: ${expiryDate})`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, `안심 인증이 부여되었습니다. (만료일: ${expiryDate})`);
    showToast(`[${partner.name}] 파트너사에 안심 인증을 부여했습니다.`, 'success');

    closePartnerCertGrantModal();
    renderAdminPartnerMonitor();
    if (typeof renderAdminOrderAllocation === 'function') renderAdminOrderAllocation();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function sweepExpiredPartnerCertifications() {
    const today = getLocalDateString();
    (window.AppState.partners || []).forEach(p => {
        if (p.isCertified && p.certExpiryDate && p.certExpiryDate < today) {
            p.isCertified = false;
            if (typeof pushLog === 'function') pushLog('MANAGER', 'CERT_EXPIRE', `'${p.name}' 파트너사의 안심 인증이 만료일(${p.certExpiryDate})을 지나 자동 해제되었습니다.`, 'WARNING');
            if (typeof pushPartnerNotification === 'function') pushPartnerNotification(p.name, `안심 인증 만료일이 지나 인증이 자동 해제되었습니다. 갱신을 원하시면 마이인포에서 갱신을 요청해주세요.`);
        }
    });
}

/* 파트너가 마이인포에서 인증 만료 임박/만료 상태를 확인하고 직접 갱신을 요청할 수
 * 있게 한다 — 지금까지는 관리자가 먼저 알아채야만 재인증이 가능했다. */
function requestPartnerCertRenewal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || partner.certRenewalRequested) return;
    partner.certRenewalRequested = true;

    if (typeof pushLog === 'function') pushLog('PARTNER', 'CERT_RENEWAL_REQUEST', `[${partnerName}]가 안심 인증 갱신을 요청했습니다.`, 'WARNING');
    showToast('인증 갱신을 요청했습니다. 매니저 센터에서 검토 후 재인증해드릴게요.', 'success');
    if (typeof renderPartnerCertStatus === 'function') renderPartnerCertStatus(partner);
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
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

    const pending = (window.AppState.partners || []).filter(p => p.status === 'pending' || p.status === 'info_requested');
    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state surface surface-lg col-span-full"><span class="icon-wrap" style="background:var(--emerald-50);color:var(--emerald-600)"><i data-lucide="check-circle-2" class="w-5 h-5"></i></span><p class="text-xs font-extrabold text-ink-600">현재 심사 대기 중인 입점 신청이 없습니다.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const listHtml = pending.map(p => {
        const doc = p.bizCertDoc;
        const isImg = isImageBizCertDoc(doc);
        const docPreview = doc
            ? (isImg
                ? `<img src="${doc.dataUrl}" alt="사업자등록증" class="w-full h-40 object-cover rounded-xl border border-ink-100 cursor-pointer" onclick="viewPartnerBizCertDoc('${p.id}')">`
                : `<button type="button" onclick="viewPartnerBizCertDoc('${p.id}')" class="btn btn-secondary btn-sm btn-block"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> ${escapeHtml(doc.name) || '첨부파일'} 열기</button>`)
            : `<div class="p-3 bg-rose-50 rounded-xl border border-dashed border-roseCustom/40 text-center"><p class="text-[10px] text-roseCustom font-bold">첨부된 사업자등록증이 없습니다.</p></div>`;
        const isInfoRequested = p.status === 'info_requested';

        return `
            <div class="surface p-5 space-y-4 text-left flex flex-col justify-between">
                <div class="space-y-3">
                    <div class="flex justify-between items-start gap-2">
                        <div class="space-y-1">
                            <label class="flex items-center gap-2 cursor-pointer mb-1">
                                <input type="checkbox" class="admin-partner-app-select-checkbox w-4 h-4" data-partner-id="${p.id}" onchange="syncSelectAllPartnerApplicationsCheckbox()">
                                <span class="badge ${isInfoRequested ? 'badge-neutral' : 'badge-amber'}">${isInfoRequested ? '정보 보완 요청됨' : '심사 대기'}</span>
                            </label>
                            <h4 class="text-sm font-black text-ink-950">${escapeHtml(p.name)}</h4>
                            <p class="text-[10px] text-ink-400 font-mono">신청일시: ${p.appliedAt || '-'}</p>
                        </div>
                    </div>
                    ${isInfoRequested ? `<div class="p-3 bg-ink-50 rounded-xl border border-dashed border-ink-200"><p class="text-[10px] font-black text-ink-500 uppercase tracking-wider mb-1">요청한 보완 내용</p><p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(p.infoRequestNote || '-')}</p></div>` : ''}
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
                    <input type="text" id="partner-app-reject-reason-${p.id}" placeholder="거절 사유 또는 보완 요청 내용" class="input text-xs">
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="approvePartnerApplication('${p.id}')" class="btn btn-primary btn-sm flex-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> 승인</button>
                        <button type="button" onclick="requestMoreInfoFromApplicant('${p.id}')" class="btn btn-secondary btn-sm flex-1"><i data-lucide="message-circle-question" class="w-3.5 h-3.5"></i> 정보 요청</button>
                        <button type="button" onclick="rejectPartnerApplication('${p.id}')" class="btn btn-secondary btn-sm flex-1"><i data-lucide="x" class="w-3.5 h-3.5"></i> 거절</button>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="col-span-full flex flex-wrap items-center justify-between gap-2 pb-2">
            <label class="flex items-center gap-2 text-xs font-bold text-ink-600 cursor-pointer">
                <input type="checkbox" id="admin-partner-app-select-all" onchange="toggleSelectAllPartnerApplications(this)" class="w-4 h-4">
                전체 선택
            </label>
            <div class="flex items-center gap-2">
                <button type="button" onclick="bulkRejectPartnerApplications()" class="btn btn-secondary btn-sm whitespace-nowrap"><i data-lucide="x" class="w-3.5 h-3.5"></i> 선택 일괄 거절</button>
                <button type="button" onclick="bulkApprovePartnerApplications()" class="btn btn-primary btn-sm whitespace-nowrap"><i data-lucide="check-check" class="w-3.5 h-3.5"></i> 선택 일괄 승인</button>
            </div>
        </div>
        ${listHtml}`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 지금까지는 심사가 승인/거절 둘 중 하나뿐이라, 서류가 애매하거나 정보가 부족한
 * 경우에도 무조건 거절부터 해야 했다 — 거절하면 partner_panel.js의 재신청 플로우를
 * 타야 하니 지원자 입장에서도 불필요하게 가혹하다. '정보 보완 요청' 중간 상태를
 * 추가해 반려까지 가지 않고 소통할 수 있게 하고, 보완 제출은 기존 재신청
 * 모달(openPartnerReapplyModal/submitPartnerReapplication)을 그대로 재사용한다. */
function requestMoreInfoFromApplicant(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner) return;
    const noteInput = document.getElementById(`partner-app-reject-reason-${partnerId}`);
    const note = noteInput ? noteInput.value.trim() : '';
    if (!note) { showToast('어떤 정보가 더 필요한지 요청 내용을 입력해 주세요.', 'warning'); return; }

    partner.status = 'info_requested';
    partner.infoRequestNote = note;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_INFO_REQUEST', `[정보 요청] '${partner.name}'(${partner.id})에게 추가 정보를 요청했습니다. 내용: ${note}`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, `입점 심사를 위해 추가 정보가 필요해요: "${note}" 로그인 후 보완해서 재신청해 주세요.`);
    showToast(`[${partner.name}] 파트너사에 추가 정보를 요청했습니다.`, 'success');
    renderAdminPartnerApplications();
}

function viewPartnerBizCertDoc(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    const doc = partner ? partner.bizCertDoc : null;
    if (!doc || !doc.dataUrl) { showToast('업로드된 사업자등록증을 찾을 수 없습니다.', 'warning'); return; }
    window.open(doc.dataUrl, '_blank');
}

function approvePartnerApplicationCore(partner) {
    partner.status = 'active';
    partner.onboardingDismissed = false;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_APPROVE', `[입점 승인] '${partner.name}'(${partner.id}) 파트너 계정을 승인했습니다.`, 'SUCCESS');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partner.name, '입점 신청이 승인되었습니다! 이제 로그인 후 오더를 받아보실 수 있어요.');

    // 고객 친구 추천 보상(referral_reward)과 동일하게, 추천으로 가입한 신규 파트너가
    // 실제로 승인(입점 확정)됐을 때만 지급한다 — 승인 전에 지급하면 심사 반려로
    // 무효화된 추천에도 보상이 나가는 문제가 생긴다.
    if (partner.referredBy && typeof grantPartnerBenefit === 'function') {
        const referrer = (window.AppState.partners || []).find(p => p.id === partner.referredBy);
        if (referrer) {
            grantPartnerBenefit(referrer.name, 'referral_reward', `파트너 추천 감사 혜택 (${partner.name} 추천)`, '커미션 5만원 할인', partner.id);
            grantPartnerBenefit(partner.name, 'referral_reward', '추천 입점 축하 혜택', '커미션 5만원 할인', partner.id);
        }
    }
}

function approvePartnerApplication(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner) return;
    approvePartnerApplicationCore(partner);
    showToast(`[${partner.name}] 파트너사의 입점을 승인했습니다.`, 'success');
    switchAdminMode('applications');
}

function rejectPartnerApplicationCore(partner, reason) {
    partner.status = 'rejected';
    partner.rejectReason = reason || '매니저 센터 검토 결과 반려';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'PARTNER_REJECT', `[입점 거절] '${partner.name}'(${partner.id}) 입점 신청을 거절했습니다. 사유: ${partner.rejectReason}`, 'WARNING');
}

function rejectPartnerApplication(partnerId) {
    const partner = (window.AppState.partners || []).find(p => p.id === partnerId);
    if (!partner) return;
    const reasonInput = document.getElementById(`partner-app-reject-reason-${partnerId}`);
    const reason = reasonInput ? reasonInput.value.trim() : '';
    rejectPartnerApplicationCore(partner, reason);
    showToast(`[${partner.name}] 파트너사의 입점 신청을 거절했습니다.`, 'info');
    switchAdminMode('applications');
}

/* 입점 신청 심사가 건별로 승인/거절 버튼을 눌러야 해서, 신청이 몰리는 날에는
 * 관리자가 같은 클릭을 반복해야 했다 — 오더 일괄 자동배정(bulkAutoAllocateSelectedOrders)
 * 과 동일한 체크박스 선택 패턴을 심사 대기 목록에도 적용한다. */
function toggleSelectAllPartnerApplications(checkbox) {
    document.querySelectorAll('.admin-partner-app-select-checkbox').forEach(cb => { cb.checked = checkbox.checked; });
}

function syncSelectAllPartnerApplicationsCheckbox() {
    const all = Array.from(document.querySelectorAll('.admin-partner-app-select-checkbox'));
    const selectAll = document.getElementById('admin-partner-app-select-all');
    if (selectAll) selectAll.checked = all.length > 0 && all.every(cb => cb.checked);
}

function bulkApprovePartnerApplications() {
    const checked = Array.from(document.querySelectorAll('.admin-partner-app-select-checkbox:checked')).map(cb => cb.dataset.partnerId);
    if (checked.length === 0) { showToast('일괄 승인할 신청을 먼저 선택해 주세요.', 'warning'); return; }

    let successCount = 0;
    checked.forEach(id => {
        const partner = (window.AppState.partners || []).find(p => p.id === id);
        if (partner) { approvePartnerApplicationCore(partner); successCount++; }
    });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BULK_PARTNER_APPROVE', `[일괄 입점 승인] 선택한 신청 ${checked.length}건 중 ${successCount}건을 승인했습니다.`, 'SUCCESS');
    showToast(`선택한 신청 ${successCount}건을 일괄 승인했습니다.`, 'success');
    renderAdminPartnerApplications();
}

function bulkRejectPartnerApplications() {
    const checked = Array.from(document.querySelectorAll('.admin-partner-app-select-checkbox:checked')).map(cb => cb.dataset.partnerId);
    if (checked.length === 0) { showToast('일괄 거절할 신청을 먼저 선택해 주세요.', 'warning'); return; }

    let successCount = 0;
    checked.forEach(id => {
        const partner = (window.AppState.partners || []).find(p => p.id === id);
        if (!partner) return;
        const reasonInput = document.getElementById(`partner-app-reject-reason-${id}`);
        rejectPartnerApplicationCore(partner, reasonInput ? reasonInput.value.trim() : '');
        successCount++;
    });

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BULK_PARTNER_REJECT', `[일괄 입점 거절] 선택한 신청 ${checked.length}건 중 ${successCount}건을 거절했습니다.`, 'WARNING');
    showToast(`선택한 신청 ${successCount}건을 일괄 거절했습니다.`, 'info');
    renderAdminPartnerApplications();
}

/* ----------------------------------------------------------------
 * 매니저 콘솔 > 직원 권한 관리 (super_admin 전용)
 * 직원은 별도 계정 없이 일반 고객으로 회원가입한 뒤, 여기서 아이디를 검색해
 * 매니저 권한(super_admin/partner_manager)을 부여하거나 회수한다.
 * ---------------------------------------------------------------- */
function renderAdminStaffManager() {
    if (typeof sweepExpiredManagerRoles === 'function') sweepExpiredManagerRoles();
    const resultEl = document.getElementById('admin-staff-search-result');
    if (resultEl) resultEl.innerHTML = '';
    const input = document.getElementById('admin-staff-search-input');
    if (input) input.value = '';
    renderAdminStaffGrantedList();
}

/* 부여한 매니저 권한이 기본적으로 영원히 유지돼서, 한시적으로 파견 나온 직원 등에게
 * 임시 권한을 주고 회수를 깜빡하면 그대로 영구 권한이 되어버리는 위험이 있었다 —
 * 만료일을 지정할 수 있게 하고, 지난 만료일은 화면을 그릴 때/로그인 시 자동으로
 * 회수한다(삼진아웃 등 다른 상태 체크와 동일하게 접근 시점에 검사하는 패턴). */
function sweepExpiredManagerRoles() {
    const today = getLocalDateString();
    (window.AppState.clientAccounts || []).forEach(a => {
        if (a.managerRole && a.managerRoleExpiresAt && a.managerRoleExpiresAt < today) {
            const roleLabel = a.managerRole === 'super_admin' ? '최고관리자' : '파트너 매니저';
            if (typeof pushLog === 'function') pushLog('MANAGER', 'STAFF_EXPIRE', `'${a.name}'(${a.id})의 ${roleLabel} 권한이 만료일(${a.managerRoleExpiresAt})을 지나 자동 회수되었습니다.`, 'WARNING');
            if (typeof pushClientNotification === 'function' && a.phone) pushClientNotification(a.phone, `${roleLabel} 권한 만료일이 지나 권한이 자동 회수되었습니다.`);
            a.managerRole = null;
            a.managerRoleExpiresAt = null;
        }
    });
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
                <p class="text-[11px] text-ink-500 font-bold">연락처 ${account.phone || '-'} · 현재 권한: <b>${roleLabel}</b>${account.managerRoleExpiresAt ? ` (만료일: ${account.managerRoleExpiresAt})` : ''}</p>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
                <input type="date" id="staff-grant-expiry-${account.id}" class="input input-sm w-auto" title="만료일 (선택, 비워두면 상시 권한)">
                <button type="button" onclick="grantManagerRole('${account.id}', 'partner_manager')" class="btn btn-secondary btn-sm">파트너 매니저 부여</button>
                <button type="button" onclick="grantManagerRole('${account.id}', 'super_admin')" class="btn btn-dark btn-sm">최고관리자 부여</button>
                ${account.managerRole ? `<button type="button" onclick="revokeManagerRole('${account.id}')" class="btn btn-secondary btn-sm">권한 회수</button>` : ''}
            </div>
        </div>`;
}

function grantManagerRole(clientId, role) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === clientId);
    if (!account) return;
    const expiryInput = document.getElementById(`staff-grant-expiry-${clientId}`);
    const expiresAt = expiryInput ? expiryInput.value : '';
    if (expiresAt && expiresAt < getLocalDateString()) { showToast('만료일은 오늘 이후 날짜로 설정해 주세요.', 'warning'); return; }
    account.managerRole = role;
    account.managerRoleExpiresAt = expiresAt || null;
    const roleLabel = role === 'super_admin' ? '최고관리자' : '파트너 매니저';
    if (typeof pushLog === 'function') pushLog('MANAGER', 'STAFF_GRANT', `'${account.name}'(${account.id}) 계정에 ${roleLabel} 권한을 부여했습니다.${expiresAt ? ` (만료일: ${expiresAt})` : ' (상시 권한)'}`, 'SUCCESS');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `${roleLabel} 권한이 부여되었습니다.${expiresAt ? ` (만료일: ${expiresAt})` : ''}`);
    showToast(`[${account.name}]님에게 ${roleLabel} 권한을 부여했습니다.${expiresAt ? ` (${expiresAt}까지)` : ''}`, 'success');
    searchClientForManagerGrant();
    renderAdminStaffGrantedList();
}

function revokeManagerRole(clientId) {
    const account = (window.AppState.clientAccounts || []).find(a => a.id === clientId);
    if (!account) return;
    const roleLabel = account.managerRole === 'super_admin' ? '최고관리자' : '파트너 매니저';
    account.managerRole = null;
    account.managerRoleExpiresAt = null;
    if (typeof pushLog === 'function') pushLog('MANAGER', 'STAFF_REVOKE', `'${account.name}'(${account.id}) 계정의 매니저 권한을 회수했습니다.`, 'WARNING');
    if (typeof pushClientNotification === 'function' && account.phone) pushClientNotification(account.phone, `${roleLabel} 권한이 회수되었습니다.`);
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
                <div class="flex items-center gap-1.5">
                    <span class="badge ${a.managerRole === 'super_admin' ? 'badge-brand' : 'badge-neutral'}">${a.managerRole === 'super_admin' ? '최고관리자' : '파트너 매니저'}</span>
                    ${a.managerRoleExpiresAt ? `<span class="badge badge-amber">만료일 ${a.managerRoleExpiresAt}</span>` : `<span class="badge badge-neutral">상시</span>`}
                </div>
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

/* 관제 로그·파트너 목록·고객 목록·오더 조회·파트너 실적은 전부 CSV로 내보낼 수
 * 있었는데, 유일하게 블랙리스트 DB 조회 화면에는 내보내기가 없었다 — 감사·규정
 * 준수 보고용으로 필요할 때마다 화면을 수동으로 옮겨 적어야 했던 공백을 메운다.
 * 현재 검색 필터가 적용된 결과만 내보낸다(다른 CSV들과 동일한 관례). */
function exportBlacklistDbToCsv() {
    const input = document.getElementById('admin-blacklist-search');
    const query = input ? input.value.trim().toLowerCase() : '';
    const allList = window.AppState.blacklistDb || [];
    const list = query
        ? allList.filter(item => (item.company && item.company.toLowerCase().includes(query)) || (item.bizFile && item.bizFile.toLowerCase().includes(query)))
        : allList;
    if (list.length === 0) { showToast('내보낼 블랙리스트 대상이 없습니다.', 'warning'); return; }

    const escapeCsvCell = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
    const header = ['제명일', '업체명', '사업자번호', '제명 사유'].map(escapeCsvCell).join(',');
    const rows = list.map(item => [item.date, item.company, item.bizFile || '-', item.reason].map(escapeCsvCell).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리집안심중개_블랙리스트DB_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof pushLog === 'function') pushLog('MANAGER', 'BLACKLIST_EXPORT', `[블랙리스트 DB] 매니저가 블랙리스트 ${list.length}건을 CSV로 내보냄.`, 'INFO');
    showToast(`블랙리스트 ${list.length}건을 CSV로 내보냈습니다.`, 'success');
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
    portSel.innerHTML = partner.portfolios.map((port, idx) => port.isDraft ? '' : `<option value="${idx}">${port.title}</option>`).join('');
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

/* 팜플렛/이벤트는 지금까지 종료일 개념이 없어서 관리자가 직접 지우기 전까지
 * 영원히 노출됐다 — 프로모션은 보통 기간이 정해져 있는데, 끝난 이벤트를
 * 수동으로 매번 지워야 했던 공백을 해소한다. endDate가 없으면 계속 노출된다. */
function isPamphletExpired(evt) {
    return !!(evt.endDate && evt.endDate < getLocalDateString());
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
        <div class="flex items-center gap-3 p-3 surface-flat ${isPamphletExpired(evt) ? 'opacity-60' : ''}">
            <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-ink-100">${evt.img ? `<img src="${evt.img}" class="w-full h-full object-cover">` : `<i data-lucide="image-plus" class="w-4 h-4 text-ink-300"></i>`}</div>
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                    <p class="text-xs font-black text-ink-950 truncate">${evt.title || '(제목 없음)'}</p>
                    ${isPamphletExpired(evt) ? '<span class="badge badge-neutral shrink-0">종료됨</span>' : evt.endDate ? `<span class="badge badge-amber shrink-0">~${evt.endDate}</span>` : ''}
                </div>
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
    safeUpdateValue('pamphlet-form-enddate', evt ? (evt.endDate || '') : '');

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
    const endDate = (document.getElementById('pamphlet-form-enddate')?.value || '') || null;
    const img = _pamphletDraftImg || '';
    const detailImg = _pamphletDraftDetailImg || '';

    if (!img) { showToast('광고판 이미지를 업로드해 주세요.', 'warning'); return; }
    if (!title) { showToast('제목을 입력해 주세요.', 'warning'); return; }
    if (endDate && endDate < getLocalDateString()) { showToast('노출 종료일은 오늘 이후 날짜로 설정해 주세요.', 'warning'); return; }

    const pamphlets = window.AppState.pamphlets || (window.AppState.pamphlets = []);
    const editingId = window.AppState.editingPamphletId;

    if (editingId) {
        const idx = pamphlets.findIndex(e => e.id === editingId);
        if (idx > -1) {
            pamphlets[idx] = { ...pamphlets[idx], title, detail, img, detailImg, endDate };
        }
        showToast('팜플렛을 수정했습니다.', 'success');
        if (typeof pushLog === 'function') pushLog('MANAGER', 'DISPLAY', `[팜플렛] '${title}' 이벤트 팜플렛 수정.`, 'INFO');
    } else {
        pamphlets.push({ id: `pamphlet-${Date.now()}`, title, detail, img, detailImg, endDate });
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
window.setPartnerSearchCategory = setPartnerSearchCategory;
window.switchAdminMode = switchAdminMode;
window.validateManagerLogin = validateManagerLogin;
window.managerLogout = managerLogout;
window.toggleManagerConsoleVisibility = toggleManagerConsoleVisibility;
window.validatePartnerLogin = validatePartnerLogin;
window.openPartnerReapplyModal = openPartnerReapplyModal;
window.closePartnerReapplyModal = closePartnerReapplyModal;
window.submitPartnerReapplication = submitPartnerReapplication;
window.partnerLogout = partnerLogout;
window.openPartnerAccountRecoveryModal = openPartnerAccountRecoveryModal;
window.closePartnerAccountRecoveryModal = closePartnerAccountRecoveryModal;
window.switchPartnerRecoveryTab = switchPartnerRecoveryTab;
window.findPartnerId = findPartnerId;
window.sendPartnerPasswordResetCode = sendPartnerPasswordResetCode;
window.resetPartnerPassword = resetPartnerPassword;
window.submitPartnerBid = submitPartnerBid;
window.editPartnerBid = editPartnerBid;
window.renderAdminRefundPendingList = renderAdminRefundPendingList;
window.processCommissionRefund = processCommissionRefund;
window.selectOrderForAudit = selectOrderForAudit;
window.togglePartnerConsoleVisibility = togglePartnerConsoleVisibility;
window.renderPartnerOnboardingBanner = renderPartnerOnboardingBanner;
window.dismissPartnerOnboardingBanner = dismissPartnerOnboardingBanner;
window.renderPartnerNotifications = renderPartnerNotifications;
window.replyToManagerDmAsPartner = replyToManagerDmAsPartner;
window.markAllPartnerNotificationsRead = markAllPartnerNotificationsRead;
window.markPartnerNotificationRead = markPartnerNotificationRead;
window.deletePartnerNotification = deletePartnerNotification;
window.clearAllPartnerNotifications = clearAllPartnerNotifications;
window.updatePartnerNotificationBadge = updatePartnerNotificationBadge;
window.submitPartnerSupportInquiry = submitPartnerSupportInquiry;
window.renderMyPartnerSupportTickets = renderMyPartnerSupportTickets;
window.submitPartnerSupportFollowUp = submitPartnerSupportFollowUp;
window.cancelPartnerSupportTicket = cancelPartnerSupportTicket;
window.isFavoriteOrder = isFavoriteOrder;
window.toggleFavoriteOrder = toggleFavoriteOrder;
window.togglePartnerFavoriteOrdersFilter = togglePartnerFavoriteOrdersFilter;
window.isOrderReportedByMe = isOrderReportedByMe;
window.retractClientReport = retractClientReport;
window.openReportClientModal = openReportClientModal;
window.closeReportClientModal = closeReportClientModal;
window.submitClientReport = submitClientReport;
window.renderPartnerOrderList = renderPartnerOrderList;
window.renderPartnerContractsView = renderPartnerContractsView;
window.setPartnerContractsStatusFilter = setPartnerContractsStatusFilter;
window.recalculateKPIs = recalculateKPIs;
window.renderAdminDashboard = renderAdminDashboard;
window.getAllPendingAppeals = getAllPendingAppeals;
window.renderAdminAppealInbox = renderAdminAppealInbox;
window.adminApproveMilestoneDispute = adminApproveMilestoneDispute;
window.adminRejectMilestoneDispute = adminRejectMilestoneDispute;
window.adminApprovePaymentReceiptDispute = adminApprovePaymentReceiptDispute;
window.adminRejectPaymentReceiptDispute = adminRejectPaymentReceiptDispute;
window.adminApproveClientRatingAppeal = adminApproveClientRatingAppeal;
window.adminRejectClientRatingAppeal = adminRejectClientRatingAppeal;
window.adminApprovePortfolioDeletionAppeal = adminApprovePortfolioDeletionAppeal;
window.adminRejectPortfolioDeletionAppeal = adminRejectPortfolioDeletionAppeal;
window.adminApproveRepairClaimCompletionDispute = adminApproveRepairClaimCompletionDispute;
window.adminRejectRepairClaimCompletionDispute = adminRejectRepairClaimCompletionDispute;
window.adminApproveProgressStageDispute = adminApproveProgressStageDispute;
window.adminRejectProgressStageDispute = adminRejectProgressStageDispute;
window.adminApproveSiteVisitCompletionDispute = adminApproveSiteVisitCompletionDispute;
window.adminRejectSiteVisitCompletionDispute = adminRejectSiteVisitCompletionDispute;
window.isClientBlockedByPartner = isClientBlockedByPartner;
window.togglePartnerBlockClient = togglePartnerBlockClient;
window.computePartnerTier = computePartnerTier;
window.buildPartnerTierBadgeHtml = buildPartnerTierBadgeHtml;
window.sendPartnerOrderMessage = sendPartnerOrderMessage;
window.proposeRepairVisitDate = proposeRepairVisitDate;
window.completeRepairVisit = completeRepairVisit;
window.addAdminOrderNote = addAdminOrderNote;
window.deleteAdminOrderNote = deleteAdminOrderNote;
window.adminApproveRepairVisitCompletionDispute = adminApproveRepairVisitCompletionDispute;
window.adminRejectRepairVisitCompletionDispute = adminRejectRepairVisitCompletionDispute;
window.openChangeOrderModal = openChangeOrderModal;
window.closeChangeOrderModal = closeChangeOrderModal;
window.submitChangeOrder = submitChangeOrder;
window.openClientRatingModal = openClientRatingModal;
window.closeClientRatingModal = closeClientRatingModal;
window.setClientRatingStar = setClientRatingStar;
window.submitClientRating = submitClientRating;
window.syncAuditLogs = syncAuditLogs;
window.setAdminLogCategoryFilter = setAdminLogCategoryFilter;
window.renderAdminPartnerMonitor = renderAdminPartnerMonitor;
window.searchOrderLookup = searchOrderLookup;
window.openAdminOrderRegistrationModal = openAdminOrderRegistrationModal;
window.closeAdminOrderRegistrationModal = closeAdminOrderRegistrationModal;
window.submitAdminOrderRegistration = submitAdminOrderRegistration;
window.toggleAdminOrderMessageThread = toggleAdminOrderMessageThread;
window.adminDismissOrderMessageReport = adminDismissOrderMessageReport;
window.adminDeleteReportedOrderMessage = adminDeleteReportedOrderMessage;
window.appealOrderMessageDeletion = appealOrderMessageDeletion;
window.adminApproveOrderMessageDeletionAppeal = adminApproveOrderMessageDeletionAppeal;
window.adminRejectOrderMessageDeletionAppeal = adminRejectOrderMessageDeletionAppeal;
window.renderAdminSupportTickets = renderAdminSupportTickets;
window.setAdminSupportStatusFilter = setAdminSupportStatusFilter;
window.setAdminPartnerMonitorStatusFilter = setAdminPartnerMonitorStatusFilter;
window.setAdminPartnerMonitorRegionFilter = setAdminPartnerMonitorRegionFilter;
window.exportLogsToCsv = exportLogsToCsv;
window.exportPartnerListToCsv = exportPartnerListToCsv;
window.exportClientListToCsv = exportClientListToCsv;
window.replyToSupportTicket = replyToSupportTicket;
window.replyToSupportTicketFollowUp = replyToSupportTicketFollowUp;
window.sendAdminBroadcastNotification = sendAdminBroadcastNotification;
window.openAdminDirectMessageModal = openAdminDirectMessageModal;
window.closeAdminDirectMessageModal = closeAdminDirectMessageModal;
window.submitAdminDirectMessage = submitAdminDirectMessage;
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
window.exportPartnerPerformanceCsv = exportPartnerPerformanceCsv;
window.closePartnerMetricsModal = closePartnerMetricsModal;
window.adminDeleteReview = adminDeleteReview;
window.buildReviewDeletionAppealsHtml = buildReviewDeletionAppealsHtml;
window.adminApproveReviewDeletionAppeal = adminApproveReviewDeletionAppeal;
window.adminRejectReviewDeletionAppeal = adminRejectReviewDeletionAppeal;
window.adminDeletePortfolio = adminDeletePortfolio;
window.setAdminClientStatusFilter = setAdminClientStatusFilter;
window.exportOrderLookupResultsToCsv = exportOrderLookupResultsToCsv;
window.updateAdminBroadcastSegmentUI = updateAdminBroadcastSegmentUI;
window.downloadContractDoc = downloadContractDoc;
window.downloadPartnerSettlementReceipt = downloadPartnerSettlementReceipt;
window.initPartnerSignatureCanvas = initPartnerSignatureCanvas;
window.clearPartnerSignatureCanvas = clearPartnerSignatureCanvas;
window.submitPartnerSignatureCanvas = submitPartnerSignatureCanvas;
window.adminForceCancelContract = adminForceCancelContract;
window.openPartnerForceCancelAppealModal = openPartnerForceCancelAppealModal;
window.closePartnerForceCancelAppealModal = closePartnerForceCancelAppealModal;
window.submitPartnerForceCancelAppeal = submitPartnerForceCancelAppeal;
window.adminApproveForceCancelAppeal = adminApproveForceCancelAppeal;
window.adminRejectForceCancelAppeal = adminRejectForceCancelAppeal;
window.adminInvalidateBid = adminInvalidateBid;
window.adminRestoreInvalidatedBid = adminRestoreInvalidatedBid;
window.adminRejectInvalidatedBidAppeal = adminRejectInvalidatedBidAppeal;
window.adminForceCompleteRepairClaim = adminForceCompleteRepairClaim;
window.adminDismissRepairClaimEscalation = adminDismissRepairClaimEscalation;
window.adminResolveScheduleChangeRequest = adminResolveScheduleChangeRequest;
window.adminResolvePriceChangeRequest = adminResolvePriceChangeRequest;
window.adminApproveClientReportAppeal = adminApproveClientReportAppeal;
window.adminApproveClientSuspensionAppeal = adminApproveClientSuspensionAppeal;
window.adminRejectClientSuspensionAppeal = adminRejectClientSuspensionAppeal;
window.adminRejectClientReportAppeal = adminRejectClientReportAppeal;
window.adminApprovePartnerReportAppeal = adminApprovePartnerReportAppeal;
window.adminRejectPartnerReportAppeal = adminRejectPartnerReportAppeal;
window.isClientFavorited = isClientFavorited;
window.toggleFavoriteClient = toggleFavoriteClient;
window.invitePartnerFavoriteClient = invitePartnerFavoriteClient;
window.requestReviewFromClient = requestReviewFromClient;
window.buildPartnerRepairClaimsHtml = buildPartnerRepairClaimsHtml;
window.openRepairClaimResponseModal = openRepairClaimResponseModal;
window.closeRepairClaimResponseModal = closeRepairClaimResponseModal;
window.submitRepairClaimResponse = submitRepairClaimResponse;
window.renderRepairClaimResponsePhotoPreview = renderRepairClaimResponsePhotoPreview;
window.removeRepairClaimResponsePhotoDraft = removeRepairClaimResponsePhotoDraft;
window.handleRepairClaimResponsePhotoUpload = handleRepairClaimResponsePhotoUpload;
window.openPartnerScheduleChangeModal = openPartnerScheduleChangeModal;
window.closePartnerScheduleChangeModal = closePartnerScheduleChangeModal;
window.submitPartnerScheduleChangeRequest = submitPartnerScheduleChangeRequest;
window.retractPartnerScheduleChangeRequest = retractPartnerScheduleChangeRequest;
window.respondToClientScheduleChangeRequest = respondToClientScheduleChangeRequest;
window.buildPartnerScheduleChangeHtml = buildPartnerScheduleChangeHtml;
window.openPartnerPriceChangeModal = openPartnerPriceChangeModal;
window.closePartnerPriceChangeModal = closePartnerPriceChangeModal;
window.submitPartnerPriceChangeRequest = submitPartnerPriceChangeRequest;
window.retractPartnerPriceChangeRequest = retractPartnerPriceChangeRequest;
window.respondToClientPriceChangeRequest = respondToClientPriceChangeRequest;
window.buildPartnerPriceChangeHtml = buildPartnerPriceChangeHtml;
window.adminRejectPartnerDoc = adminRejectPartnerDoc;
window.appealPartnerDocRejection = appealPartnerDocRejection;
window.adminApproveDocRejectionAppeal = adminApproveDocRejectionAppeal;
window.adminRejectDocRejectionAppeal = adminRejectDocRejectionAppeal;
window.retractPartnerCancellationRequest = retractPartnerCancellationRequest;
window.exportBlacklistDbToCsv = exportBlacklistDbToCsv;
window.dismissReviewReport = dismissReviewReport;
window.dismissPartnerReviewFlag = dismissPartnerReviewFlag;
window.renderPartnerBlockedCommunityUsersList = renderPartnerBlockedCommunityUsersList;
window.dismissReviewReplyReport = dismissReviewReplyReport;
window.adminDeleteReviewReply = adminDeleteReviewReply;
window.openReviewReplyDeletionAppealModal = openReviewReplyDeletionAppealModal;
window.closeReviewReplyDeletionAppealModal = closeReviewReplyDeletionAppealModal;
window.submitReviewReplyDeletionAppeal = submitReviewReplyDeletionAppeal;
window.renderPartnerReviewReplyDeletionStatus = renderPartnerReviewReplyDeletionStatus;
window.adminApproveReviewReplyDeletionAppeal = adminApproveReviewReplyDeletionAppeal;
window.adminRejectReviewReplyDeletionAppeal = adminRejectReviewReplyDeletionAppeal;
window.dismissPortfolioReport = dismissPortfolioReport;
window.adminDeletePortfolioQuestion = adminDeletePortfolioQuestion;
window.dismissPortfolioQuestionReport = dismissPortfolioQuestionReport;
window.adminApprovePortfolioQuestionDeletionAppeal = adminApprovePortfolioQuestionDeletionAppeal;
window.adminRejectPortfolioQuestionDeletionAppeal = adminRejectPortfolioQuestionDeletionAppeal;
window.downloadEstimateDoc = downloadEstimateDoc;
window.issuePartnerStrike = issuePartnerStrike;
window.resetPartnerStrikes = resetPartnerStrikes;
window.issueClientStrike = issueClientStrike;
window.resetClientStrikes = resetClientStrikes;
window.adminApproveClientStrikeAppeal = adminApproveClientStrikeAppeal;
window.adminRejectClientStrikeAppeal = adminRejectClientStrikeAppeal;
window.togglePartnerSuspension = togglePartnerSuspension;
window.openPartnerSuspensionAppealModal = openPartnerSuspensionAppealModal;
window.closePartnerSuspensionAppealModal = closePartnerSuspensionAppealModal;
window.submitPartnerSuspensionAppeal = submitPartnerSuspensionAppeal;
window.adminApprovePartnerSuspensionAppeal = adminApprovePartnerSuspensionAppeal;
window.adminRejectPartnerSuspensionAppeal = adminRejectPartnerSuspensionAppeal;
window.togglePartnerCertification = togglePartnerCertification;
window.openPartnerCertGrantModal = openPartnerCertGrantModal;
window.closePartnerCertGrantModal = closePartnerCertGrantModal;
window.submitPartnerCertGrant = submitPartnerCertGrant;
window.sweepExpiredPartnerCertifications = sweepExpiredPartnerCertifications;
window.requestPartnerCertRenewal = requestPartnerCertRenewal;
window.renderAdminStrikeAppeals = renderAdminStrikeAppeals;
window.adminApproveStrikeAppeal = adminApproveStrikeAppeal;
window.adminRejectStrikeAppeal = adminRejectStrikeAppeal;
window.renderBlacklistDb = renderBlacklistDb;
window.autoAllocateOrder = autoAllocateOrder;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.syncSelectAllOrdersCheckbox = syncSelectAllOrdersCheckbox;
window.bulkAutoAllocateSelectedOrders = bulkAutoAllocateSelectedOrders;
window.allocateOrderToPartner = allocateOrderToPartner;
window.unassignOrderFromPartner = unassignOrderFromPartner;
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
window.buildPartnerProgressStagesHtml = buildPartnerProgressStagesHtml;
window.advanceOrderProgressStage = advanceOrderProgressStage;
window.buildPartnerPaymentMilestonesHtml = buildPartnerPaymentMilestonesHtml;
window.requestPaymentMilestone = requestPaymentMilestone;
window.disputeMilestonePaymentReceipt = disputeMilestonePaymentReceipt;
window.renderPartnerScheduleView = renderPartnerScheduleView;
window.isPartnerDateBlocked = isPartnerDateBlocked;
window.addPartnerBlockedDate = addPartnerBlockedDate;
window.removePartnerBlockedDate = removePartnerBlockedDate;
window.renderPartnerBlockedDatesList = renderPartnerBlockedDatesList;
window.openSiteVisitModal = openSiteVisitModal;
window.closeSiteVisitModal = closeSiteVisitModal;
window.submitSiteVisitProposal = submitSiteVisitProposal;
window.completeSiteVisit = completeSiteVisit;
window.buildPartnerSiteVisitHtml = buildPartnerSiteVisitHtml;
window.withdrawMyPartnerBid = withdrawMyPartnerBid;
window.replyToBidQuestion = replyToBidQuestion;
window.buildPreBidQnaHtml = buildPreBidQnaHtml;
window.openPreBidQuestionModal = openPreBidQuestionModal;
window.closePreBidQuestionModal = closePreBidQuestionModal;
window.submitPreBidQuestion = submitPreBidQuestion;
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
window.toggleSelectAllPartnerApplications = toggleSelectAllPartnerApplications;
window.syncSelectAllPartnerApplicationsCheckbox = syncSelectAllPartnerApplicationsCheckbox;
window.bulkApprovePartnerApplications = bulkApprovePartnerApplications;
window.bulkRejectPartnerApplications = bulkRejectPartnerApplications;
window.rejectPartnerApplication = rejectPartnerApplication;
window.requestMoreInfoFromApplicant = requestMoreInfoFromApplicant;
window.pauseHeroAutoplay = pauseHeroAutoplay;
window.resumeHeroAutoplay = resumeHeroAutoplay;
window.pauseHomeEventAutoplay = pauseHomeEventAutoplay;
window.resumeHomeEventAutoplay = resumeHomeEventAutoplay;
window.renderAdminStaffManager = renderAdminStaffManager;
window.searchClientForManagerGrant = searchClientForManagerGrant;
window.grantManagerRole = grantManagerRole;
window.revokeManagerRole = revokeManagerRole;
window.savePartnerFinalContractAmount = savePartnerFinalContractAmount;
