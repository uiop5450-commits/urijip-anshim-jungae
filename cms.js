/**
 * ====================================================================
 * [cms.js] 포트폴리오 에디터, 1:1 지정 상담, 장면(Scenes) 순차 렌더링 및
 * 라이트박스 연속 이동/휠 줌/드래그 통합
 * ====================================================================
 */

if (typeof AppState !== 'undefined') {
    window.AppState = window.AppState || AppState;
} else {
    window.AppState = window.AppState || {
        partnerName: '오륙도 디자인 실내건축', partnerConsoleMode: 'orders', partnerLoggedIn: false,
        orders: [], partners: [], calendar: { year: 2026, month: 7 }, kpis: { gmv: 0, escrow: 0, revenue: 0 }, logs: []
    };
}

/* 포트폴리오 시공 유형(카테고리) 라벨 — 선택 사항이라 값이 없는 기존 데이터는 배지를 그냥 숨긴다. */
const PORTFOLIO_CATEGORY_LABELS = { apartment: '아파트', house: '주택', commercial: '상가·사무실', etc: '기타' };

/* 포트폴리오 상세(블로그) 페이지에서 좋아요/1:1 상담 버튼이 "지금 보고 있는" 포트폴리오를 알 수 있도록
 * 여는 시점에 기록해두는 컨텍스트. */
let _blogDetailContext = { partnerName: null, idx: null };

let lightboxScale = 1, lightboxPanX = 0, lightboxPanY = 0;
let isLightboxDragging = false, lightboxStartX = 0, lightboxStartY = 0, lightboxStartPanX = 0, lightboxStartPanY = 0, lightboxHasDragged = false;
let lightboxPhotos = [], lightboxCurrentIndex = 0;

var safeUpdateValue = window.safeUpdateValue || function(id, val) { const el = document.getElementById(id); if (el) el.value = val; };
var safeUpdateText = window.safeUpdateText || function(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; };
var showToast = window.showToast || function(msg, type) { console.log(`[Toast] ${type || 'info'}: ${msg}`); };

function openModal(modalId, cardId) {
    const modal = document.getElementById(modalId);
    const card = document.getElementById(cardId);
    if (!modal || !card) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => setTimeout(() => card.classList.add('modal-open'), 20));
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeModal(modalId, cardId, delay = 180) {
    const modal = document.getElementById(modalId);
    const card = document.getElementById(cardId);
    if (!modal || !card) return;
    card.classList.remove('modal-open');
    setTimeout(() => modal.classList.add('hidden'), delay);
}

function switchPartnerMode(mode) {
    window.AppState.partnerConsoleMode = mode;
    const tabs = { orders: 'btn-partner-view-orders', contracts: 'btn-partner-view-contracts', schedule: 'btn-partner-view-schedule', performance: 'btn-partner-view-performance', portfolio: 'btn-partner-view-portfolio', myinfo: 'btn-partner-view-myinfo', notifications: 'btn-partner-view-notifications', support: 'btn-partner-view-support' };
    const views = { orders: 'partner-mode-orders-view', contracts: 'partner-mode-contracts-view', schedule: 'partner-mode-schedule-view', performance: 'partner-mode-performance-view', portfolio: 'partner-mode-portfolio-view', myinfo: 'partner-mode-myinfo-view', notifications: 'partner-mode-notifications-view', support: 'partner-mode-support-view' };

    Object.values(tabs).forEach(id => document.getElementById(id)?.classList.remove('active'));
    Object.values(views).forEach(id => document.getElementById(id)?.classList.add('hidden'));

    document.getElementById(tabs[mode])?.classList.add('active');
    document.getElementById(views[mode])?.classList.remove('hidden');

    if (mode === 'orders' && typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    else if (mode === 'contracts' && typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    else if (mode === 'schedule' && typeof renderPartnerScheduleView === 'function') renderPartnerScheduleView();
    else if (mode === 'performance' && typeof renderPartnerPerformanceView === 'function') renderPartnerPerformanceView();
    else if (mode === 'myinfo') renderPartnerProfileManager();
    else if (mode === 'portfolio') renderPartnerConsolePortfolios();
    else if (mode === 'notifications' && typeof renderPartnerNotifications === 'function') renderPartnerNotifications();
    else if (mode === 'support' && typeof renderMyPartnerSupportTickets === 'function') renderMyPartnerSupportTickets();

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ----------------------------------------------------------------
 * 포트폴리오 카드 미디어(썸네일) 마크업 — 파트너 콘솔 목록, 고객 프로필 그리드가
 * 모두 이 함수를 공유해 카드 노출 방식이 항상 일치하도록 한다.
 * ---------------------------------------------------------------- */
function buildPortfolioCardMediaHtml(port) {
    const hasImg = !!(port && port.img);
    const title = (port && port.title) || '';
    const pyungLabel = (port && port.pyung) ? `${port.pyung}평형` : '평형 미입력';
    const catLabel = PORTFOLIO_CATEGORY_LABELS[port && port.category] || '';
    return `
        ${hasImg
            ? `<img src="${port.img}" alt="${title}">`
            : `<div class="w-full h-full flex flex-col items-center justify-center gap-2 bg-ink-100 text-ink-400"><i data-lucide="image-plus" class="w-6 h-6"></i><p class="text-[11px] font-bold px-4 text-center">대표 사진이 없습니다</p></div>`}
        <span class="absolute top-3 left-3 badge badge-dark">${pyungLabel}</span>
        ${catLabel ? `<span class="absolute top-3 right-3 badge badge-dark">${catLabel}</span>` : ''}`;
}

/* ----------------------------------------------------------------
 * 포트폴리오 에디터 — 네이버 블로그 에디터와 동일한 방식: 상단 툴바 + 클릭하면 바로 쓸 수 있는
 * contentEditable 본문 캔버스 하나로 사진과 글을 자유롭게 섞어 쓴다. 저장 시 본문을 그대로
 * HTML 문자열(bodyHtml)로 저장하고, 고객이 보는 상세 페이지는 그 HTML을 그대로 렌더링하므로
 * "쓰는 화면 = 보이는 화면"이 완벽히 일치한다.
 * ---------------------------------------------------------------- */

/* 구버전 데이터(scenes: 사진+캡션 쌍 / blocks: 사진·텍스트 블록 / img: 단일 대표사진)를
 * 전부 새 본문 HTML 문자열로 변환 — 예전에 저장된 포트폴리오도 그대로 열람/수정 가능하게 한다. */
function portfolioToBodyHtml(port) {
    if (!port) return '';
    if (typeof port.bodyHtml === 'string' && port.bodyHtml.length > 0) return port.bodyHtml;
    if (port.blocks && port.blocks.length > 0) return portfolioBlocksToBodyHtml(port.blocks);
    if (port.scenes && port.scenes.length > 0) return portfolioBlocksToBodyHtml(scenesToBlocks(port.scenes));
    if (port.img) return portfolioImgWrapHtml(port.img) + '<p><br></p>';
    return '';
}

/* (구) scenes -> (구) blocks 변환 — portfolioBlocksToBodyHtml과 함께 예전 포맷 호환에만 쓰인다. */
function scenesToBlocks(scenes) {
    const out = [];
    (scenes || []).forEach(sc => {
        if (sc.img) out.push({ type: 'image', images: [sc.img] });
        if (sc.text) out.push({ type: 'text', text: sc.text });
    });
    return out;
}

function portfolioBlocksToBodyHtml(blocks) {
    let html = '';
    (blocks || []).forEach(b => {
        if (b.type === 'image') {
            const imgs = Array.isArray(b.images) ? b.images.filter(Boolean) : (b.img ? [b.img] : []);
            if (imgs.length >= 2) {
                html += portfolioImgRowHtml(imgs.slice(0, 2));
            } else if (imgs.length === 1) {
                html += portfolioImgWrapHtml(imgs[0]);
            }
        } else if (b.type === 'text' && b.text) {
            const div = document.createElement('div');
            div.textContent = b.text;
            html += `<p>${div.innerHTML.replace(/\n/g, '<br>')}</p>`;
        }
    });
    return html;
}

/* 사진(또는 나란히 배치된 듀오 사진 묶음)마다 위/아래 이동 버튼을 붙인다 — 본문 안 다른 사진/글과
 * 순서를 자유롭게 바꿀 수 있게 한다. standalone=false면(듀오 안에 나란히 들어가는 사진) 개별
 * 이동 버튼 없이 삭제 버튼만 두고, 듀오 묶음 전체의 이동 버튼은 portfolioImgRowHtml이 따로 붙인다. */
function portfolioImgWrapHtml(src, standalone) {
    if (standalone === undefined) standalone = true;
    const moveBtns = standalone ? portfolioImgMoveControlsHtml() : '';
    return `<span class="blog-img-wrap" contenteditable="false">${moveBtns}<img src="${src}" alt="포트폴리오 사진"><button type="button" class="blog-img-remove-btn" onclick="removePortfolioBodyImage(this)" title="사진 삭제"><i data-lucide="x" class="w-3.5 h-3.5"></i></button></span>`;
}

function portfolioImgRowHtml(pair) {
    return `<div class="blog-img-row" contenteditable="false">${pair.map(src => portfolioImgWrapHtml(src, false)).join('')}${portfolioImgMoveControlsHtml()}</div>`;
}

function portfolioImgMoveControlsHtml() {
    return `<div class="blog-img-move-controls"><button type="button" class="blog-img-move-btn" onclick="movePortfolioBodyImage(this, -1)" title="위로 이동"><i data-lucide="chevron-up" class="w-3.5 h-3.5"></i></button><button type="button" class="blog-img-move-btn" onclick="movePortfolioBodyImage(this, 1)" title="아래로 이동"><i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button></div>`;
}

/* 사진(또는 듀오 묶음)을 본문 안에서 바로 앞/뒤 형제 요소와 자리를 맞바꿔 위/아래로 옮긴다. */
function movePortfolioBodyImage(btn, dir) {
    const container = btn.closest('.blog-img-wrap, .blog-img-row');
    if (!container) return;
    const parent = container.parentNode;
    if (!parent) return;
    if (dir < 0) {
        const prev = container.previousElementSibling;
        if (prev) parent.insertBefore(container, prev);
    } else {
        const next = container.nextElementSibling;
        if (next) parent.insertBefore(next, container);
    }
    onPortfolioBodyEditorInput();
}

/* 본문 어디든 클릭하면 바로 입력되는 contentEditable 캔버스에 커서 위치 기준으로 HTML을 삽입한다. */
function insertHtmlAtCursor(editor, html) {
    editor.focus();
    const sel = window.getSelection();
    let range;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        range = sel.getRangeAt(0);
    } else {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
    }
    range.deleteContents();
    const frag = range.createContextualFragment(html);
    const lastNode = frag.lastChild;
    range.insertNode(frag);
    if (lastNode && sel) {
        range.setStartAfter(lastNode);
        range.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function triggerPortfolioImageInsert() {
    const input = document.getElementById('portfolio-body-image-input');
    if (input) { input.value = ''; input.click(); }
}

/* 여러 장을 한 번에 선택하면 네이버 블로그처럼 2장씩 묶어 한 줄에 나란히 삽입한다. */
function handlePortfolioBodyImageInsert(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (files.some(f => !f.type.startsWith('image/'))) { showToast('이미지 파일만 업로드할 수 있어요.', 'warning'); return; }
    if (files.some(f => f.size > 15 * 1024 * 1024)) { showToast('이미지 용량은 15MB 이하로 올려주세요.', 'warning'); return; }

    const editor = document.getElementById('portfolio-body-editor');
    if (!editor) return;

    readPortfolioFilesAsResizedDataUrls(files, (dataUrls) => {
        let html = '';
        for (let i = 0; i < dataUrls.length; i += 2) {
            const pair = dataUrls.slice(i, i + 2).filter(Boolean);
            if (pair.length === 2) html += portfolioImgRowHtml(pair);
            else if (pair.length === 1) html += portfolioImgWrapHtml(pair[0]);
        }
        html += '<p><br></p>';
        insertHtmlAtCursor(editor, html);
        onPortfolioBodyEditorInput();
    });
}

/* 원본 해상도 그대로 올리면 화면에 너무 꽉 차 보이므로, 여러 장을 동시에 캔버스로 적당한
 * 크기로 줄여서 반환한다 (가로/세로 어떤 사진이든 긴 변을 최대 1200px로 제한, 비율은 유지).
 * 본문이 네이버 블로그 기본 문서 너비(780px)로 표시되므로 1200px이면 고해상도 화면에서도
 * 선명하면서, 과거(1600px)보다 업로드 용량은 가벼워진다. */
function readPortfolioFilesAsResizedDataUrls(files, callback) {
    const results = new Array(files.length);
    let remaining = files.length;
    files.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resizePortfolioImageDataUrl(e.target.result, (resized) => {
                results[i] = resized;
                remaining -= 1;
                if (remaining === 0) callback(results);
            });
        };
        reader.onerror = () => { results[i] = null; remaining -= 1; if (remaining === 0) callback(results); };
        reader.readAsDataURL(file);
    });
}

function resizePortfolioImageDataUrl(dataUrl, callback) {
    const MAX_DIM = 1200;
    try {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (!w || !h || (w <= MAX_DIM && h <= MAX_DIM)) { callback(dataUrl); return; }
            const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
            const targetW = Math.max(1, Math.round(w * scale));
            const targetH = Math.max(1, Math.round(h * scale));
            try {
                const canvas = document.createElement('canvas');
                canvas.width = targetW; canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, targetW, targetH);
                callback(canvas.toDataURL('image/jpeg', 0.86));
            } catch (err) {
                callback(dataUrl);
            }
        };
        img.onerror = () => callback(dataUrl);
        img.src = dataUrl;
    } catch (err) {
        callback(dataUrl);
    }
}

/* 사진 삭제 버튼 — 나란히 배치된 둘 중 하나만 지우면 남은 한 장은 위/아래 이동 버튼이 있는
 * 일반 단일 사진으로 풀어준다. */
function removePortfolioBodyImage(btn) {
    const wrap = btn.closest('.blog-img-wrap');
    if (!wrap) return;
    const row = wrap.closest('.blog-img-row');
    if (row) {
        const remaining = Array.from(row.querySelectorAll('.blog-img-wrap')).filter(w => w !== wrap);
        if (remaining.length === 1) {
            const src = remaining[0].querySelector('img')?.getAttribute('src') || '';
            const temp = document.createElement('div');
            temp.innerHTML = portfolioImgWrapHtml(src);
            row.replaceWith(temp.firstElementChild);
        } else {
            row.remove();
        }
    } else {
        wrap.remove();
    }
    onPortfolioBodyEditorInput();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 굵게/기울임/밑줄/정렬은 브라우저 표준에서 빠진(deprecated) document.execCommand
 * 대신 Selection/Range API를 직접 다뤄서 구현한다 — 지금은 대부분 브라우저가 여전히
 * execCommand를 지원하지만, 장기적으로 제거될 수 있는 API에 기대지 않는 편이 안전하다. */
const PORTFOLIO_INLINE_FORMAT_TAGS = { bold: 'b', italic: 'i', underline: 'u' };

function applyPortfolioEditorCommand(cmd) {
    const editor = document.getElementById('portfolio-body-editor');
    if (!editor) return;
    editor.focus();
    const tag = PORTFOLIO_INLINE_FORMAT_TAGS[cmd];
    if (tag) toggleInlineFormatTag(editor, tag);
    else applyPortfolioBlockAlign(editor, cmd);
    onPortfolioBodyEditorInput();
}

/* 선택 영역 전체가 이미 같은 태그 하나로 감싸져 있으면(토글 켜짐) 그 태그를 벗겨내고,
 * 아니면 선택 영역을 새 태그로 감싼다. 겹치는 서식이 복잡하게 얽힌 경우까지 완벽히
 * 처리하진 않지만(그 경우 태그가 중첩될 뿐 화면엔 동일하게 굵게/기울임/밑줄로 보임),
 * 이 에디터에서 실제로 쓰이는 "문장을 선택하고 버튼 클릭" 흐름은 정확히 처리한다. */
function toggleInlineFormatTag(editor, tag) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

    const startTag = closestTagWithinEditor(range.startContainer, tag, editor);
    const endTag = closestTagWithinEditor(range.endContainer, tag, editor);
    if (startTag && startTag === endTag) {
        unwrapEditorElement(startTag);
    } else {
        const wrapper = document.createElement(tag);
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }
}

function closestTagWithinEditor(node, tag, editor) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== editor) {
        if (el.tagName && el.tagName.toLowerCase() === tag) return el;
        el = el.parentElement;
    }
    return null;
}

function unwrapEditorElement(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

/* 정렬은 텍스트 선택 없이 커서 위치만으로도 적용돼야 하므로(문단 전체에 적용) 굵게/기울임과
 * 달리 range.collapsed를 막지 않는다 — 커서가 속한 블록 요소를 찾아 text-align만 지정한다. */
function applyPortfolioBlockAlign(editor, cmd) {
    const alignMap = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' };
    const align = alignMap[cmd];
    if (!align) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    let node = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    while (node && node !== editor && !['P', 'DIV', 'BLOCKQUOTE', 'H1', 'H2', 'H3'].includes(node.tagName)) {
        node = node.parentElement;
    }
    if (node && node !== editor) node.style.textAlign = align;
}

function insertPortfolioQuote() {
    const editor = document.getElementById('portfolio-body-editor');
    if (!editor) return;
    insertHtmlAtCursor(editor, '<blockquote>인용구를 입력해주세요.</blockquote><p><br></p>');
    onPortfolioBodyEditorInput();
}

function insertPortfolioDivider() {
    const editor = document.getElementById('portfolio-body-editor');
    if (!editor) return;
    insertHtmlAtCursor(editor, '<hr><p><br></p>');
    onPortfolioBodyEditorInput();
}

/* ----------------------------------------------------------------
 * 다른 사이트(네이버 블로그, 인스타그램 등)에 올린 포트폴리오 링크를 붙여넣으면 대표 사진 /
 * 제목 / 소개글을 자동으로 가져와 본문 맨 앞에 채워준다. 브라우저에서 직접 다른 사이트로 요청을
 * 보내는 방식이라(별도 서버 없이 동작하는 데모 환경), 그 사이트가 교차 출처 요청(CORS)을 허용하지
 * 않으면 가져오기가 실패할 수 있다 — 이 경우 사용자에게 알리고 직접 작성하도록 안내한다.
 * ---------------------------------------------------------------- */
async function importPortfolioFromUrl() {
    const input = document.getElementById('portfolio-import-url');
    const btn = document.getElementById('portfolio-import-btn');
    const hint = document.getElementById('portfolio-import-hint');
    const rawUrl = (input?.value || '').trim();
    if (!rawUrl) { showToast('가져올 포트폴리오 링크를 입력해주세요.', 'warning'); return; }

    let url;
    try { url = new URL(rawUrl); } catch (err) { showToast('올바른 링크 형식이 아니에요. (예: https://blog.naver.com/...)', 'warning'); return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') { showToast('http(s) 링크만 가져올 수 있어요.', 'warning'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '가져오는 중...'; }
    if (hint) hint.textContent = '링크에서 사진과 글을 불러오고 있어요...';

    try {
        const meta = await fetchPortfolioLinkMeta(url.href);
        applyImportedPortfolioMeta(meta);
        showToast('포트폴리오를 가져왔어요! 내용을 확인하고 저장해주세요.', 'success');
        if (hint) hint.textContent = '가져온 내용은 본문 맨 위에 채워졌어요. 자유롭게 다듬은 뒤 저장해주세요.';
    } catch (err) {
        showToast('이 링크는 자동으로 가져올 수 없어요. 사진과 글을 직접 붙여넣어 주세요.', 'warning');
        if (hint) hint.textContent = '이 사이트는 브라우저에서 자동으로 가져오는 것을 허용하지 않아요. 아래에서 직접 사진과 글을 작성해주세요.';
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '가져오기'; }
    }
}

/* 대상 페이지를 직접 요청해보고, 대부분의 외부 사이트가 CORS로 막는 경우를 대비해
 * 공개 CORS 프록시로 한 번 더 시도한다. 둘 다 실패하면 에러를 던져 위에서 안내 메시지를 띄운다. */
async function fetchPortfolioLinkMeta(url) {
    let html = null;
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) html = await res.text();
    } catch (err) { /* 직접 요청은 대부분 CORS로 막힌다 — 아래 프록시로 재시도 */ }

    if (!html) {
        try {
            const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            if (proxyRes.ok) html = await proxyRes.text();
        } catch (err) { /* 프록시도 실패하면 아래에서 에러 처리 */ }
    }
    if (!html) throw new Error('링크에서 내용을 가져오지 못했습니다.');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const metaContent = (sel) => doc.querySelector(sel)?.getAttribute('content') || '';
    const title = metaContent('meta[property="og:title"]') || metaContent('meta[name="twitter:title"]') || doc.querySelector('title')?.textContent || '';
    const desc = metaContent('meta[property="og:description"]') || metaContent('meta[name="description"]') || '';

    let images = Array.from(doc.querySelectorAll('meta[property="og:image"]')).map(m => m.getAttribute('content')).filter(Boolean);
    if (images.length === 0) {
        images = Array.from(doc.querySelectorAll('img')).map(img => img.getAttribute('src')).filter(Boolean);
    }
    images = images.map(src => { try { return new URL(src, url).href; } catch (err) { return null; } }).filter(Boolean).slice(0, 4);

    if (!title.trim() && images.length === 0) throw new Error('가져올 만한 내용이 없습니다.');
    return { title: title.trim(), desc: desc.trim(), images };
}

function applyImportedPortfolioMeta(meta) {
    if (meta.title) safeUpdateValue('editor-title', meta.title.substring(0, 60));
    if (meta.desc) safeUpdateValue('editor-desc', meta.desc.substring(0, 80));

    const editor = document.getElementById('portfolio-body-editor');
    if (editor && meta.images && meta.images.length > 0) {
        let html = '';
        for (let i = 0; i < meta.images.length; i += 2) {
            const pair = meta.images.slice(i, i + 2);
            html += pair.length === 2 ? portfolioImgRowHtml(pair) : portfolioImgWrapHtml(pair[0]);
        }
        if (meta.desc) html += `<p>${meta.desc}</p>`;
        html += '<p><br></p>';
        editor.innerHTML = html + editor.innerHTML;
    }
    onPortfolioBodyEditorInput();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 툴바 버튼에 "현재 커서 위치가 굵게/기울임 상태인지" 하이라이트를 아직 표시하지 않는다.
 * HTML의 oninput/onkeyup/onmouseup 훅에서 여전히 호출되므로 자리만 남겨둔다. */
function updatePortfolioToolbarActiveState() { /* no-op */ }

/* 카드 미리보기 패널은 삭제되었다 — 본문/필드가 바뀔 때마다 훅으로 연결해 두는 지점만 남겨둔다. */
function onPortfolioBodyEditorInput() { /* no-op */ }

/* 본문 HTML에서 첫 번째 사진을 그대로 포트폴리오의 대표 사진(카드/검색결과 썸네일)으로 쓴다. */
function firstPortfolioBodyImage(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    const img = tmp.querySelector('img');
    return img ? (img.getAttribute('src') || '') : '';
}

function openPortfolioEditor(idx) {
    const list = document.getElementById('portfolio-list-subview');
    const editor = document.getElementById('portfolio-editor-subview');
    if (list && editor) { list.classList.add('hidden'); editor.classList.remove('hidden'); }

    const bodyEditor = document.getElementById('portfolio-body-editor');

    if (idx !== null) {
        const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
        const partner = window.AppState.partners.find(p => p.name === partnerName);
        if (!partner || !partner.portfolios[idx]) return;
        const target = partner.portfolios[idx];
        window.AppState.editingPortfolioIndex = idx;
        safeUpdateValue('editor-title', target.title || '');
        safeUpdateValue('editor-pyung', target.pyung || '');
        safeUpdateValue('editor-category', target.category || '');
        safeUpdateValue('editor-desc', target.desc || '');
        if (bodyEditor) bodyEditor.innerHTML = portfolioToBodyHtml(target);
        safeUpdateText('port-submit-btn-text', '수정 내용 저장하기');
        safeUpdateText('portfolio-editor-heading', '포트폴리오 스토리 수정');
    } else {
        window.AppState.editingPortfolioIndex = null;
        safeUpdateValue('editor-title', '');
        safeUpdateValue('editor-pyung', '');
        safeUpdateValue('editor-category', '');
        safeUpdateValue('editor-desc', '');
        if (bodyEditor) bodyEditor.innerHTML = '';
        safeUpdateText('port-submit-btn-text', '안심 포트폴리오 스토리 발행하기');
        safeUpdateText('portfolio-editor-heading', '새 포트폴리오 스토리 작성');
    }
    safeUpdateValue('portfolio-import-url', '');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePortfolioEditor() {
    const list = document.getElementById('portfolio-list-subview');
    const editor = document.getElementById('portfolio-editor-subview');
    if (list && editor) { editor.classList.add('hidden'); list.classList.remove('hidden'); }
    const bodyEditor = document.getElementById('portfolio-body-editor');
    if (bodyEditor) bodyEditor.innerHTML = '';
    renderPartnerConsolePortfolios();
}

/* 지금까지는 저장 버튼이 하나뿐이라 클릭하는 즉시 고객 탐색 페이지·프로필에
 * 바로 노출됐다 — 사진/글을 다 정리하기 전에 미리 저장해두고 나중에 이어서
 * 쓸 방법이 없었다. isDraft 플래그를 두고, 초안은 파트너 콘솔에만 보이며
 * 고객에게 노출되는 모든 화면(공개 프로필, 히어로 슬라이더 선택 등)에서 제외한다. */
function submitPartnerPortfolio(isDraft = false) {
    const titleEl = document.getElementById('editor-title');
    const pyungEl = document.getElementById('editor-pyung');
    if (!titleEl || !pyungEl) return;

    const title = titleEl.value.trim();
    const pyung = parseInt(pyungEl.value, 10);
    const category = document.getElementById('editor-category')?.value || '';
    const desc = (document.getElementById('editor-desc')?.value || '').trim();
    if (!title || isNaN(pyung)) { showToast("제목과 평형을 입력해주세요.", "warning"); return; }

    let bodyHtml = (document.getElementById('portfolio-body-editor')?.innerHTML || '').trim();
    bodyHtml = bodyHtml.replace(/(<p>(<br\s*\/?>)?<\/p>\s*)+$/i, '').trim();

    const coverImg = firstPortfolioBodyImage(bodyHtml);
    if (!coverImg) { showToast("사진을 최소 1장 이상 등록해주세요.", "warning"); return; }

    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    const editIndex = window.AppState.editingPortfolioIndex;
    const plainTextDiv = document.createElement('div');
    plainTextDiv.innerHTML = bodyHtml;
    const plainText = (plainTextDiv.textContent || '').trim();

    const newPort = {
        title, pyung, category,
        desc: desc || plainText.substring(0, 80),
        img: coverImg,
        likes: (editIndex !== null && partner.portfolios[editIndex]) ? (partner.portfolios[editIndex].likes || 0) : 0,
        views: (editIndex !== null && partner.portfolios[editIndex]) ? (partner.portfolios[editIndex].views || 0) : 0,
        date: (editIndex !== null && partner.portfolios[editIndex] && partner.portfolios[editIndex].date) ? partner.portfolios[editIndex].date : new Date().toISOString(),
        id: (editIndex !== null && partner.portfolios[editIndex]) ? partner.portfolios[editIndex].id : undefined,
        bodyHtml,
        isDraft
    };

    const isNewPublish = editIndex === null && !isDraft;
    if (editIndex !== null) partner.portfolios[editIndex] = newPort;
    else partner.portfolios.unshift(newPort);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO', `[${partnerName}]가 포트폴리오 "${title}"를 ${isDraft ? '초안으로 저장' : '발행'}했습니다.`, isDraft ? 'INFO' : 'SUCCESS');
    // 관심 파트너로 찜해둔 고객에게는 지금까지 그 파트너의 신규 시공사례 발행 소식이
    // 전혀 전달되지 않았다 — 초안 저장이나 기존 글 수정에는 보내지 않고, 신규 발행
    // 시에만 보낸다(매번 알림이 오면 피로도가 높아지므로).
    if (isNewPublish && typeof pushClientNotification === 'function') {
        (window.AppState.clientAccounts || [])
            .filter(acc => (acc.favoritePartners || []).includes(partnerName))
            .forEach(acc => pushClientNotification(acc.phone, `관심 파트너 [${partnerName}]가 새 시공사례 "${title}"를 등록했어요.`));
    }
    showToast(isDraft ? '초안으로 저장되었습니다. 고객에게는 보이지 않아요.' : '포트폴리오가 발행되었습니다!', 'success');
    closePortfolioEditor();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 파트너가 휴가/예약 초과로 바쁠 때 신규 자동매칭 대상에서 스스로 빠질 방법이
 * 없었다 — 지금까지는 "심사대기/제명"만 있고 "일시적으로 바쁨" 상태가 없어서,
 * 실제로 못 받는 오더까지 계속 배정됐다. 완전 탈퇴/제명이 아니라 새 매칭만
 * 잠시 멈추는 가벼운 토글이며, 기존 고객의 1:1 지정 상담은 그대로 받을 수 있다
 * (completeMatchingSim/triggerRebidding/autoAllocateOrderCore의 후보 필터 참고). */
function renderPartnerPauseToggle(partner) {
    const btn = document.getElementById('partner-pause-toggle-btn');
    const desc = document.getElementById('partner-pause-status-desc');
    if (!btn) return;
    if (partner.isPaused) {
        btn.textContent = '일시중단 해제하기';
        btn.className = 'btn btn-dark shrink-0';
        if (desc) desc.innerHTML = '<span class="text-amberCustom font-black">⏸ 현재 신규 오더 매칭이 일시중단된 상태예요.</span> 다시 받으려면 해제해 주세요.';
    } else {
        btn.textContent = '일시중단 켜기';
        btn.className = 'btn btn-secondary shrink-0';
        if (desc) desc.textContent = '휴가나 예약 초과로 바쁠 때 켜두면, 자동매칭·재매칭·관리자 일괄배정 대상에서 빠져요. 기존 고객의 1:1 지정 상담은 계속 받을 수 있어요.';
    }
}

function togglePartnerPauseStatus() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    partner.isPaused = !partner.isPaused;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PAUSE_TOGGLE', `[${partnerName}]가 신규 오더 매칭을 ${partner.isPaused ? '일시중단' : '재개'}했습니다.`, 'INFO');
    showToast(partner.isPaused ? '신규 오더 매칭이 일시중단되었습니다.' : '신규 오더 매칭이 재개되었습니다.', partner.isPaused ? 'warning' : 'success');
    renderPartnerPauseToggle(partner);
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

/* 고객과 대칭으로, 파트너도 지금까지 매칭·계약·후기 등 모든 알림을 끌 방법이
 * 없었다 — pushPartnerNotification 자체에서 걸러내는 계정별 on/off 하나로 시작한다. */
function renderPartnerNotificationPrefToggle(partner) {
    const btn = document.getElementById('partner-notif-pref-toggle');
    if (!btn) return;
    const enabled = partner.notificationsEnabled !== false;
    btn.textContent = enabled ? '켜짐' : '꺼짐';
    btn.classList.toggle('btn-dark', enabled);
    btn.classList.toggle('btn-secondary', !enabled);

    ['community', 'marketing'].forEach(category => {
        const catBtn = document.getElementById(`partner-notif-pref-${category}-toggle`);
        if (!catBtn) return;
        const field = category === 'community' ? 'notifyCommunity' : 'notifyMarketing';
        const catEnabled = enabled && partner[field] !== false;
        catBtn.disabled = !enabled;
        catBtn.textContent = catEnabled ? '켜짐' : '꺼짐';
        catBtn.classList.toggle('btn-dark', catEnabled);
        catBtn.classList.toggle('btn-secondary', !catEnabled);
    });
}

function togglePartnerNotificationPref() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const currentlyEnabled = partner.notificationsEnabled !== false;
    partner.notificationsEnabled = !currentlyEnabled;
    showToast(partner.notificationsEnabled ? '알림을 다시 받아요.' : '알림 수신을 꺼두었어요.', partner.notificationsEnabled ? 'success' : 'info');
    renderPartnerNotificationPrefToggle(partner);
}

/* 클라이언트 쪽과 동일하게, 파트너도 필수 알림(계약/분쟁/제재)은 유지한 채
 * 고객 커뮤니티 참여 알림이나 프로모션성 알림만 따로 끌 수 있게 한다. */
function togglePartnerNotificationCategory(category) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const field = category === 'community' ? 'notifyCommunity' : 'notifyMarketing';
    const currentlyEnabled = partner[field] !== false;
    partner[field] = !currentlyEnabled;
    showToast(partner[field] ? '알림을 다시 받아요.' : '알림 수신을 꺼두었어요.', partner[field] ? 'success' : 'info');
    renderPartnerNotificationPrefToggle(partner);
}

/* 관리자는 옐로카드(issuePartnerStrike)와 삼진아웃 영구 제명을 일방적으로 부여할 수
 * 있지만, 파트너가 그 조치가 부당하다고 여겨도 이의를 제기할 방법이 전혀 없었다 —
 * 계약 취소 요청(cancelRequest)과 동일한 제출→심사 패턴으로 소명 절차를 둔다. */
function openStrikeAppealModal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    if ((partner.strikeCount || 0) <= 0 && partner.status !== 'banned') { showToast('이의신청할 경고 기록이 없어요.', 'info'); return; }
    if (partner.strikeAppeal && partner.strikeAppeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    safeUpdateValue('strike-appeal-reason-input', '');
    openModal('strike-appeal-modal', 'strike-appeal-modal-card');
}

function closeStrikeAppealModal() {
    closeModal('strike-appeal-modal', 'strike-appeal-modal-card');
}

function submitStrikeAppeal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) { closeStrikeAppealModal(); return; }
    const reason = document.getElementById('strike-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    partner.strikeAppeal = { reason, strikeCountAtAppeal: partner.strikeCount || 0, wasBanned: partner.status === 'banned', status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'STRIKE_APPEAL', `[${partnerName}]가 옐로카드/제명 조치에 대해 이의신청을 제출했습니다. (당시 누적 ${partner.strikeCount || 0}회)`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeStrikeAppealModal();
    renderPartnerStrikeAppealStatus(partner);
    if (typeof renderAdminStrikeAppeals === 'function') renderAdminStrikeAppeals();
}

function renderPartnerStrikeAppealStatus(partner) {
    const container = document.getElementById('partner-strike-appeal-status');
    if (!container) return;
    const isBanned = partner.status === 'banned';
    const hasStrikes = (partner.strikeCount || 0) > 0 || isBanned;
    const appeal = partner.strikeAppeal;

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
        ? `${resolvedHtml}<button type="button" onclick="openStrikeAppealModal()" class="btn btn-secondary btn-sm">${isBanned ? '영구 제명' : '옐로카드'} 이의신청하기</button>`
        : resolvedHtml;
}

/* 고객은 부실 시공·계약 불이행 파트너를 신고할 수 있지만(submitPartnerReport,
 * client_panel.js) 파트너는 자신이 신고당한 사실조차 알 방법이 없었고(알림조차
 * 가지 않았음) 소명할 방법도 없었다 — 방금 추가한 고객측 이의신청(clientReports[].appeal)
 * 과 정반대 방향의 동일한 비대칭이다. 동일한 제출→심사 패턴을 그대로 적용한다. */
let partnerReportAppealTargetId = null;

function openPartnerReportAppealModal(reportId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const report = (window.AppState.partnerReports || []).find(r => r.id === reportId && r.partnerName === partnerName);
    if (!report) return;
    if (report.appeal && report.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    partnerReportAppealTargetId = reportId;
    safeUpdateValue('partner-report-appeal-reason-input', '');
    openModal('partner-report-appeal-modal', 'partner-report-appeal-modal-card');
}

function closePartnerReportAppealModal() {
    partnerReportAppealTargetId = null;
    closeModal('partner-report-appeal-modal', 'partner-report-appeal-modal-card');
}

function submitPartnerReportAppeal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const report = (window.AppState.partnerReports || []).find(r => r.id === partnerReportAppealTargetId && r.partnerName === partnerName);
    if (!report) { closePartnerReportAppealModal(); return; }
    const reason = document.getElementById('partner-report-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    report.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PARTNER_REPORT_APPEAL', `[${partnerName}]가 고객 신고(${report.orderCode})에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closePartnerReportAppealModal();
    renderPartnerReportedStatus(partnerName);
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function renderPartnerReportedStatus(partnerName) {
    const container = document.getElementById('partner-reported-status');
    if (!container) return;
    const myReports = (window.AppState.partnerReports || []).filter(r => r.partnerName === partnerName);

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
            statusHtml = `<button type="button" onclick="openPartnerReportAppealModal('${r.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">고객이 오더(${r.orderCode})와 관련해 신고를 접수했습니다. (${r.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

/* 관리자가 입찰을 직권 무효화하면(adminInvalidateBid) 파트너는 알림 한 번으로
 * 끝이라, 부당하다고 여겨도 관리자가 스스로 복원해줄 때까지(adminRestoreInvalidatedBid)
 * 기다리는 것 말고는 방법이 없었다 — 옐로카드 이의신청(strikeAppeal)과 동일한
 * 제출→심사 패턴을 무효화된 입찰에도 적용한다. */
let invalidatedBidAppealTarget = null;

function openInvalidatedBidAppealModal(orderCode) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const order = (window.AppState.orders || []).find(o => o.code === orderCode);
    const entry = order && order.adminInvalidatedBids && order.adminInvalidatedBids.find(ib => ib.partnerName === partnerName);
    if (!entry) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    invalidatedBidAppealTarget = orderCode;
    safeUpdateValue('invalidated-bid-appeal-reason-input', '');
    openModal('invalidated-bid-appeal-modal', 'invalidated-bid-appeal-modal-card');
}

function closeInvalidatedBidAppealModal() {
    invalidatedBidAppealTarget = null;
    closeModal('invalidated-bid-appeal-modal', 'invalidated-bid-appeal-modal-card');
}

function submitInvalidatedBidAppeal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const order = (window.AppState.orders || []).find(o => o.code === invalidatedBidAppealTarget);
    const entry = order && order.adminInvalidatedBids && order.adminInvalidatedBids.find(ib => ib.partnerName === partnerName);
    if (!entry) { closeInvalidatedBidAppealModal(); return; }
    const reason = document.getElementById('invalidated-bid-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'INVALIDATED_BID_APPEAL', `[${partnerName}]가 오더 ${order.code} 입찰 무효화 조치에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closeInvalidatedBidAppealModal();
    renderPartnerInvalidatedBidsStatus(partnerName);
    if (typeof searchOrderLookup === 'function') searchOrderLookup();
}

/* 후기 삭제 이의신청(openReviewDeletionAppealModal, client_panel.js)과 동일한 패턴을
 * 시공사례 삭제(adminDeletePortfolio, partner_panel.js가 남기는
 * window.AppState.portfolioDeletionLog)에도 적용한다 — 지금까지는 삭제 통보만 받고
 * 소명할 방법이 없었다. */
let portfolioDeletionAppealTarget = null;

function openPortfolioDeletionAppealModal(logId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const entry = (window.AppState.portfolioDeletionLog || []).find(e => e.id === logId && e.partnerName === partnerName);
    if (!entry) return;
    if (entry.appeal && entry.appeal.status === 'pending') { showToast('이미 심사 대기 중인 이의신청이 있어요.', 'warning'); return; }
    portfolioDeletionAppealTarget = logId;
    safeUpdateValue('portfolio-deletion-appeal-reason-input', '');
    openModal('portfolio-deletion-appeal-modal', 'portfolio-deletion-appeal-modal-card');
}

function closePortfolioDeletionAppealModal() {
    portfolioDeletionAppealTarget = null;
    closeModal('portfolio-deletion-appeal-modal', 'portfolio-deletion-appeal-modal-card');
}

function submitPortfolioDeletionAppeal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const entry = (window.AppState.portfolioDeletionLog || []).find(e => e.id === portfolioDeletionAppealTarget && e.partnerName === partnerName);
    if (!entry) { closePortfolioDeletionAppealModal(); return; }
    const reason = document.getElementById('portfolio-deletion-appeal-reason-input')?.value.trim();
    if (!reason) { showToast('이의신청 내용을 입력해주세요.', 'warning'); return; }

    entry.appeal = { reason, status: 'pending', date: getLocalDateString(), adminResponse: null, resolvedDate: null };

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO_DELETION_APPEAL', `[${partnerName}]가 삭제된 시공사례에 대해 이의신청을 제출했습니다.`, 'WARNING');
    showToast('이의신청이 접수되었습니다. 매니저 센터 심사 후 결과를 안내드릴게요.', 'success');

    closePortfolioDeletionAppealModal();
    renderPartnerPortfolioDeletionStatus(partnerName);
}

function renderPartnerPortfolioDeletionStatus(partnerName) {
    const container = document.getElementById('partner-portfolio-deletion-status');
    if (!container) return;
    const entries = (window.AppState.portfolioDeletionLog || []).filter(e => e.partnerName === partnerName);

    if (entries.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">삭제된 시공사례가 없습니다.</p>`;
        return;
    }
    container.innerHTML = entries.map(e => {
        let statusHtml;
        if (e.appeal && e.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (e.appeal && e.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${e.appeal.adminResponse ? ` — ${escapeHtml(e.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openPortfolioDeletionAppealModal('${e.id}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">시공사례 "${escapeHtml(e.portfolioSnapshot.title || '(제목 없음)')}"가 삭제되었습니다. (${e.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

function renderPartnerInvalidatedBidsStatus(partnerName) {
    const container = document.getElementById('partner-invalidated-bids-status');
    if (!container) return;
    const entries = [];
    (window.AppState.orders || []).forEach(o => {
        (o.adminInvalidatedBids || []).forEach(ib => {
            if (ib.partnerName === partnerName) entries.push({ orderCode: o.code, ...ib });
        });
    });

    if (entries.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">직권 무효화된 입찰이 없습니다.</p>`;
        return;
    }
    container.innerHTML = entries.map(e => {
        let statusHtml;
        if (e.appeal && e.appeal.status === 'pending') {
            statusHtml = `<p class="text-[10px] font-black text-amberCustom mt-1">이의신청 심사 대기중</p>`;
        } else if (e.appeal && e.appeal.status === 'rejected') {
            statusHtml = `<p class="text-[10px] font-bold text-ink-400 mt-1">이의신청 반려됨${e.appeal.adminResponse ? ` — ${escapeHtml(e.appeal.adminResponse)}` : ''}</p>`;
        } else {
            statusHtml = `<button type="button" onclick="openInvalidatedBidAppealModal('${e.orderCode}')" class="text-[10px] font-bold text-ink-400 hover:text-brand-600 bg-transparent border-0 cursor-pointer p-0 mt-1">이의신청하기</button>`;
        }
        return `<div class="p-2.5 bg-amber-50 rounded-xl space-y-0.5">
            <p class="text-[10px] text-ink-600 font-semibold leading-relaxed">오더(${e.orderCode}) 입찰이 매니저 직권으로 무효화되었습니다. 사유: ${escapeHtml(e.reason)} (${e.date})</p>
            ${statusHtml}
        </div>`;
    }).join('');
}

/* 안심 인증(isCertified)이 만료일 없는 영구 boolean이었다가 방금 만료일 관리가
 * 생겼으니(sweepExpiredPartnerCertifications, partner_panel.js), 파트너 본인이
 * 마이인포에서 만료 임박/만료 상태를 확인하고 갱신을 요청할 수 있게 한다. */
function renderPartnerCertStatus(partner) {
    const container = document.getElementById('partner-cert-status');
    if (!container) return;

    if (!partner.isCertified && !partner.certExpiryDate) {
        container.innerHTML = `<p class="text-[11px] text-ink-400 font-semibold">현재 안심 인증 대상이 아닙니다.</p>`;
        return;
    }
    const today = getLocalDateString();
    const isExpired = partner.certExpiryDate && partner.certExpiryDate < today;
    const daysLeft = partner.certExpiryDate ? Math.ceil((new Date(partner.certExpiryDate) - new Date(today)) / (1000 * 60 * 60 * 24)) : null;
    const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 30;

    let statusHtml;
    if (isExpired) {
        statusHtml = `<p class="text-[10px] font-black text-roseCustom">인증이 만료되었습니다. (만료일: ${partner.certExpiryDate})</p>`;
    } else if (isExpiringSoon) {
        statusHtml = `<p class="text-[10px] font-black text-amberCustom">인증 만료 임박 (D-${daysLeft}, 만료일: ${partner.certExpiryDate})</p>`;
    } else {
        statusHtml = `<p class="text-[10px] font-bold text-emeraldCustom">안심 인증 유효 (만료일: ${partner.certExpiryDate})</p>`;
    }

    const showRenewBtn = (isExpired || isExpiringSoon) && !partner.certRenewalRequested;
    container.innerHTML = `${statusHtml}
        ${partner.certRenewalRequested ? `<p class="text-[10px] font-bold text-brand-600 mt-1">갱신 요청 접수됨 — 매니저 센터 검토 중입니다.</p>` : (showRenewBtn ? `<button type="button" onclick="requestPartnerCertRenewal()" class="btn btn-secondary btn-sm mt-1">인증 갱신 요청</button>` : '')}`;
}

/* 고객 친구 추천 보상함(renderClientBenefitsStatus, client_panel.js)과 동일한 패턴 —
 * 신규 파트너 추천 성공 시 grantPartnerBenefit(utils_ui.js)이 쌓는 partner.benefits[]를
 * 보여주고 수령 신청을 받는다. */
function renderPartnerBenefitsStatus(partner) {
    const container = document.getElementById('partner-benefits-status');
    if (!container) return;
    if (!partner) partner = window.AppState.partners.find(p => p.name === (window.AppState.partnerName || '오륙도 디자인 실내건축'));
    if (!partner) return;
    const benefits = partner.benefits || [];

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
                : `<button type="button" onclick="claimPartnerBenefit('${b.id}')" class="btn btn-dark btn-sm shrink-0">수령 신청</button>`}
        </div>`).join('');
}

function claimPartnerBenefit(benefitId) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const benefit = partner && partner.benefits && partner.benefits.find(b => b.id === benefitId);
    if (!benefit || benefit.status === 'claimed') return;

    benefit.status = 'claimed';
    benefit.claimedDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PARTNER_BENEFIT_CLAIM', `[${partnerName}]가 혜택 "${benefit.label}" 수령을 신청했습니다.`, 'INFO');
    showToast(`"${benefit.label}" 수령 신청이 접수되었습니다.`, 'success');
    renderPartnerBenefitsStatus(partner);
}

function renderPartnerProfileManager() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    if (typeof renderPartnerOnboardingBanner === 'function') renderPartnerOnboardingBanner();
    if (!partner.heroImages || partner.heroImages.length === 0) partner.heroImages = ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=60'];
    if (typeof partner.heroSlideIndex !== 'number') partner.heroSlideIndex = 0;
    if (partner.heroSlideIndex >= partner.heroImages.length) partner.heroSlideIndex = 0;

    safeUpdateValue('partner-promo-slogan', partner.promoSlogan || '');
    safeUpdateValue('partner-promo-text', partner.promoText || '');
    renderPartnerPauseToggle(partner);
    renderPartnerNotificationPrefToggle(partner);
    renderPartnerStrikeAppealStatus(partner);
    renderPartnerReportedStatus(partnerName);
    renderPartnerInvalidatedBidsStatus(partnerName);
    renderPartnerPortfolioDeletionStatus(partnerName);
    renderPartnerCertStatus(partner);
    renderPartnerBenefitsStatus(partner);
    safeUpdateText('partner-account-bizcert-filename', partner.bizCertDoc ? partner.bizCertDoc.name : '첨부된 사업자등록증이 없습니다.');

    const img = document.getElementById('partner-hero-slide-img');
    if (img) img.src = partner.heroImages[partner.heroSlideIndex];
    safeUpdateText('partner-hero-slide-counter', `${partner.heroSlideIndex + 1} / ${partner.heroImages.length}`);

    /* 화살표+카운터만으로는 전체 중 몇 장인지, 어떤 사진들인지 한눈에 안 보여서
     * 클릭 가능한 썸네일 스트립을 추가한다. */
    const strip = document.getElementById('partner-hero-thumbnail-strip');
    if (strip) {
        strip.innerHTML = partner.heroImages.map((src, idx) => `
            <button type="button" onclick="jumpToPartnerHeroSlide(${idx})" class="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 ${idx === partner.heroSlideIndex ? 'border-brand-500' : 'border-transparent'} p-0 cursor-pointer bg-ink-100">
                <img src="${src}" class="w-full h-full object-cover">
            </button>`).join('');
    }

    renderPartnerMyReviews(partner);
    safeUpdateValue('partner-account-edit-region', partner.region || '');
    safeUpdateValue('partner-account-edit-bizfile', partner.bizFile || '');
    safeUpdateValue('partner-account-edit-phone', partner.phone || '');
    safeUpdateValue('partner-account-edit-current-pw', '');
    safeUpdateValue('partner-account-edit-new-pw', '');
    safeUpdateValue('partner-account-edit-new-pw2', '');
}

/* 파트너 콘솔 '내 정보' 탭 — 지금까지는 업체 홍보 문구/사진만 수정 가능했고, 담당자
 * 연락처나 비밀번호를 바꿀 방법이 없었다(업체명/아이디는 여러 화면에서 식별자로
 * 쓰이므로 의도적으로 수정 불가 상태 유지). 고객 계정 정보 수정(updateClientProfileInfo/
 * updateClientPassword)과 동일한 검증 패턴을 그대로 따른다. */

/* 가입 시 활동 지역을 입력받지 않아서(파트너 가입 폼에 지역 필드 자체가 없음),
 * 신규 가입 파트너는 region이 계속 비어있어 지역별 검색/필터(고객 탐색 페이지,
 * 관리자 모니터링 보드 모두)에 영원히 노출되지 않는 공백이 있었다 — 계정 설정에서
 * 직접 지정/수정할 수 있게 한다. */
function updatePartnerRegion() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const regionVal = document.getElementById('partner-account-edit-region')?.value || '';
    partner.region = regionVal || null;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PROFILE_UPDATE', `[${partnerName}]가 활동 지역을 '${regionVal || '미지정'}'으로 설정했습니다.`, 'INFO');
    showToast('활동 지역이 저장되었습니다.', 'success');
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function updatePartnerBizFile() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const bizFileVal = document.getElementById('partner-account-edit-bizfile')?.value.trim();
    if (!bizFileVal || bizFileVal.replace(/[^0-9]/g, '').length !== 10) { showToast('사업자등록번호 10자리를 올바르게 입력해 주세요. (예: 000-00-00000)', 'warning'); return; }
    if (window.AppState.partners.some(p => p !== partner && p.bizFile === bizFileVal)) { showToast('이미 등록된 사업자등록번호입니다.', 'warning'); return; }
    if (bizFileVal === partner.bizFile) return;

    const oldBizFile = partner.bizFile;
    partner.bizFile = bizFileVal;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'BIZFILE_UPDATE', `[${partnerName}]가 사업자등록번호를 변경했습니다. (${oldBizFile || '없음'} → ${bizFileVal})`, 'WARNING');
    showToast('사업자등록번호가 변경되었습니다.', 'success');
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

function updatePartnerPhone() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const phoneVal = document.getElementById('partner-account-edit-phone')?.value.trim();
    if (!/^0\d{1,2}-\d{3,4}-\d{4}$/.test(phoneVal)) { showToast('담당자 연락처를 올바른 형식으로 입력해 주세요. (예: 010-0000-0000)', 'warning'); return; }
    partner.phone = phoneVal;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PROFILE_UPDATE', `[${partnerName}]가 담당자 연락처를 수정했습니다.`, 'INFO');
    showToast('담당자 연락처가 저장되었습니다.', 'success');
}

function updatePartnerPassword() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    const currentPw = document.getElementById('partner-account-edit-current-pw')?.value || '';
    const newPw = document.getElementById('partner-account-edit-new-pw')?.value || '';
    const newPw2 = document.getElementById('partner-account-edit-new-pw2')?.value || '';
    if (!currentPw || !newPw || !newPw2) { showToast('비밀번호 항목을 모두 입력해 주세요.', 'warning'); return; }
    if (partner.pw !== currentPw) { showToast('현재 비밀번호가 일치하지 않습니다.', 'warning'); return; }
    if (newPw !== newPw2) { showToast('새 비밀번호가 일치하지 않습니다.', 'warning'); return; }
    partner.pw = newPw;
    if (typeof pushLog === 'function') pushLog('PARTNER', 'PASSWORD_CHANGE', `[${partnerName}]가 비밀번호를 변경했습니다.`, 'INFO');
    showToast('비밀번호가 변경되었습니다.', 'success');
    safeUpdateValue('partner-account-edit-current-pw', '');
    safeUpdateValue('partner-account-edit-new-pw', '');
    safeUpdateValue('partner-account-edit-new-pw2', '');
}

/* 지금까지 사업자등록증은 입점 신청 때 딱 한 번 첨부하면 다시는 바꿀 방법이
 * 없었다 — 사업자 정보가 갱신되거나 잘못 첨부한 경우에도 매니저 센터에 별도로
 * 요청해야 했을 것. 파트너 본인이 직접 새 파일로 교체할 수 있게 한다. */
function handlePartnerBizCertReupload(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('파일 용량은 15MB 이하로 올려주세요.', 'warning'); return; }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showToast('이미지 또는 PDF 파일만 업로드할 수 있어요.', 'warning'); return;
    }
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        partner.bizCertDoc = { name: file.name, uploadedAt: new Date().toLocaleString('ko-KR'), dataUrl: e.target.result };
        safeUpdateText('partner-account-bizcert-filename', file.name);
        if (typeof pushLog === 'function') pushLog('PARTNER', 'BIZCERT_UPDATE', `[${partnerName}]가 사업자등록증을 새 파일로 교체했습니다.`, 'INFO');
        showToast('사업자등록증이 교체되었습니다.', 'success');
    };
    reader.readAsDataURL(file);
}

/* 고객은 회원 탈퇴(openAccountDeleteModal/confirmAccountDeletion, client_panel.js)가
 * 가능한데 파트너는 자진 입점 해지 방법이 전혀 없었다 — 관리자의 옐로카드/제명만
 * 계정을 막을 수 있었다. 진행 중인 계약(status==='contracted')이 있으면 해지를
 * 막아서, 시공 중인 고객을 방치한 채 나갈 수 없게 한다. */
function openPartnerAccountCloseModal() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const activeContract = (window.AppState.orders || []).some(o => o.status === 'contracted' && o.acceptedPartner === partnerName);
    if (activeContract) { showToast('진행 중인 계약이 있어 입점을 해지할 수 없어요. 계약을 모두 마친 후 다시 시도해주세요.', 'warning'); return; }
    safeUpdateValue('partner-account-close-confirm-pw', '');
    openModal('partner-account-close-modal', 'partner-account-close-modal-card');
}

function closePartnerAccountCloseModal() {
    closeModal('partner-account-close-modal', 'partner-account-close-modal-card');
}

function confirmPartnerAccountClosure() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    const activeContract = (window.AppState.orders || []).some(o => o.status === 'contracted' && o.acceptedPartner === partnerName);
    if (activeContract) { showToast('진행 중인 계약이 있어 입점을 해지할 수 없어요.', 'warning'); closePartnerAccountCloseModal(); return; }

    const pw = document.getElementById('partner-account-close-confirm-pw')?.value || '';
    if (!pw) { showToast('비밀번호를 입력해 주세요.', 'warning'); return; }
    if (partner.pw !== pw) { showToast('비밀번호가 일치하지 않습니다.', 'warning'); return; }

    partner.status = 'closed';
    if (typeof pushLog === 'function') pushLog('PARTNER', 'ACCOUNT_CLOSE', `[${partnerName}]가 자진 입점 해지했습니다.`, 'WARNING');
    showToast('입점 해지가 완료되었습니다. 함께해주셔서 감사했습니다.', 'info');
    closePartnerAccountCloseModal();
    partnerLogout();
    if (typeof renderAdminPartnerMonitor === 'function') renderAdminPartnerMonitor();
}

/* 파트너 콘솔 '내 정보' 탭 — 받은 후기 목록과 답글 작성 UI. 지금까지는 파트너가
 * 자기 후기에 답글을 남길 방법이 전혀 없었다(네이버지도/구글리뷰의 '사장님 답글'과
 * 같은 기능 공백). 답글은 rev.reply = {text, date}로 저장되고, 고객이 보는
 * openClientPartnerProfile/openReviewDetailModal에도 그대로 노출된다. */
function renderPartnerMyReviews(partner) {
    const container = document.getElementById('partner-myinfo-reviews-list');
    if (!container) return;
    const reviews = partner.reviews || [];
    if (reviews.length === 0) {
        container.innerHTML = `<div class="p-4 bg-ink-50 rounded-xl border border-dashed border-ink-200 text-center text-xs text-ink-400 font-bold">아직 받은 후기가 없습니다.</div>`;
        return;
    }
    container.innerHTML = reviews.map((rev, idx) => `
        <div class="p-4 bg-ink-50/70 rounded-xl border ${rev.partnerFlagged ? 'border-rose-200' : 'border-ink-100'} space-y-2 text-left">
            <div class="flex justify-between items-center text-xs">
                <div class="flex items-center gap-1.5 font-extrabold text-ink-950"><span>${escapeHtml(rev.client)} 고객님</span>${rev.partnerFlagged ? `<span class="badge badge-rose"><i data-lucide="flag" class="w-2.5 h-2.5"></i> 신고 접수</span>` : ''}</div>
                <span class="text-gold-500 font-extrabold text-xs">★ ${rev.rating}.0 <span class="text-ink-400 text-[10px] ml-1">${rev.date}</span></span>
            </div>
            <p class="text-xs text-ink-700 font-medium leading-relaxed">${escapeHtml(rev.text)}</p>
            <div class="flex justify-end">
                <button type="button" onclick="${rev.partnerFlagged ? `showToast('이미 신고 접수된 후기입니다.', 'info')` : `openReportReasonPrompt((reason) => flagReviewAsPartner('${partner.name}', ${idx}, reason))`}" class="flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-[10px] font-bold text-ink-400 hover:text-roseCustom"><i data-lucide="flag" class="w-3 h-3"></i> ${rev.partnerFlagged ? '허위·부적절 후기 신고 완료' : '허위·부적절 후기로 신고'}</button>
            </div>
            ${rev.reply && rev.reply.text ? `
                <div class="p-3 rounded-lg space-y-1" style="background:var(--brand-50)">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-black text-brand-700 flex items-center gap-1"><i data-lucide="reply" class="w-3 h-3"></i> 사장님 답글</span>
                        <button type="button" onclick="removeReviewReply('${partner.name}', ${idx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0">삭제</button>
                    </div>
                    <p class="text-xs text-ink-700 font-semibold leading-relaxed">${escapeHtml(rev.reply.text)}</p>
                </div>
            ` : `
                <div class="flex gap-2 pt-1">
                    <input type="text" id="review-reply-input-${idx}" placeholder="고객님께 남길 답글을 입력하세요" class="input flex-1 text-xs">
                    <button type="button" onclick="submitReviewReply('${partner.name}', ${idx})" class="btn btn-secondary btn-sm shrink-0">답글 등록</button>
                </div>
            `}
        </div>`).join('');
    if (typeof renderPartnerReviewReplyDeletionStatus === 'function') renderPartnerReviewReplyDeletionStatus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 파트너가 후기에 답글을 남겨도 지금까지 고객에게는 아무 알림이 가지 않아서, 고객이
 * 우연히 재방문하지 않으면 답글을 영영 못 볼 수도 있었다 — review.orderCode로 원 의뢰를
 * 찾아 클라이언트 알림을 보낸다(네이버지도 '사장님 답글' 알림과 동일한 목적). */
function submitReviewReply(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.reviews || !partner.reviews[reviewIdx]) return;
    const input = document.getElementById(`review-reply-input-${reviewIdx}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('답글 내용을 입력해 주세요.', 'warning'); return; }
    const review = partner.reviews[reviewIdx];
    review.reply = { text, date: getLocalDateString() };
    if (typeof pushLog === 'function') pushLog('PARTNER', 'REVIEW_REPLY', `[${partnerName}]가 후기에 답글을 남겼습니다.`, 'INFO');
    if (review.orderCode && typeof pushClientNotification === 'function') {
        const order = (window.AppState.orders || []).find(o => o.code === review.orderCode);
        if (order) pushClientNotification(order.clientPhone, `[${partnerName}]에서 남기신 후기에 답글을 남겼어요.`);
    }
    showToast('답글이 등록되었습니다.', 'success');
    renderPartnerMyReviews(partner);
}

function removeReviewReply(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.reviews || !partner.reviews[reviewIdx]) return;
    delete partner.reviews[reviewIdx].reply;
    showToast('답글을 삭제했습니다.', 'info');
    renderPartnerMyReviews(partner);
}

function jumpToPartnerHeroSlide(idx) {
    const partner = window.AppState.partners.find(p => p.name === (window.AppState.partnerName || '오륙도 디자인 실내건축'));
    if (!partner || !partner.heroImages || idx < 0 || idx >= partner.heroImages.length) return;
    partner.heroSlideIndex = idx;
    renderPartnerProfileManager();
}

function savePartnerProfileInfo() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    partner.promoSlogan = document.getElementById('partner-promo-slogan')?.value.trim();
    partner.promoText = document.getElementById('partner-promo-text')?.value.trim();
    showToast('프로필 정보가 저장되었습니다!', 'success');
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function triggerPartnerHeroImagePicker() { document.getElementById('partner-hero-image-input')?.click(); }

function handlePartnerHeroImageUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
            const partner = window.AppState.partners.find(p => p.name === partnerName);
            if (partner) {
                if (!partner.heroImages) partner.heroImages = [];
                partner.heroImages.push(e.target.result);
                partner.heroSlideIndex = partner.heroImages.length - 1;
                renderPartnerProfileManager();
                showToast('대표 사진이 추가되었습니다.', 'success');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
    input.value = '';
}

function nextPartnerHeroSlide() {
    const partner = window.AppState.partners.find(p => p.name === (window.AppState.partnerName || '오륙도 디자인 실내건축'));
    if (!partner || !partner.heroImages) return;
    partner.heroSlideIndex = ((partner.heroSlideIndex || 0) + 1) % partner.heroImages.length;
    renderPartnerProfileManager();
}
function prevPartnerHeroSlide() {
    const partner = window.AppState.partners.find(p => p.name === (window.AppState.partnerName || '오륙도 디자인 실내건축'));
    if (!partner || !partner.heroImages) return;
    partner.heroSlideIndex = ((partner.heroSlideIndex || 0) - 1 + partner.heroImages.length) % partner.heroImages.length;
    renderPartnerProfileManager();
}
function deleteCurrentPartnerHeroSlide() {
    const partner = window.AppState.partners.find(p => p.name === (window.AppState.partnerName || '오륙도 디자인 실내건축'));
    if (!partner || !partner.heroImages || partner.heroImages.length <= 1) { showToast("최소 1장의 대표 사진은 유지되어야 합니다.", "warning"); return; }
    partner.heroImages.splice(partner.heroSlideIndex || 0, 1);
    partner.heroSlideIndex = 0;
    renderPartnerProfileManager();
    showToast("삭제되었습니다.", "info");
}

function renderPartnerConsolePortfolios() {
    const grid = document.getElementById('partner-console-portfolio-grid');
    if (!grid) return;
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    if (typeof renderPartnerOnboardingBanner === 'function') renderPartnerOnboardingBanner();
    safeUpdateText('partner-port-count-badge', `등록된 시공사례 ${partner.portfolios.length}건`);

    if (partner.portfolios.length === 0) {
        grid.innerHTML = `<div class="empty-state col-span-full"><span class="icon-wrap"><i data-lucide="image-off" class="w-5 h-5"></i></span><p class="text-xs text-ink-500 font-bold">등록된 포트폴리오가 없습니다. 첫 시공 사례를 발행해 보세요.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    grid.innerHTML = '';
    partner.portfolios.forEach((item, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = "portfolio-card text-left";
        itemDiv.innerHTML = `
            <div class="portfolio-img relative" onclick="openPortfolioBlogDetail('${partner.name}', ${idx})">${item.isPrimary ? `<span class="badge badge-gold absolute top-2 left-2 z-10"><i data-lucide="star" class="w-2.5 h-2.5"></i> 대표</span>` : ''}${item.isDraft ? `<span class="badge badge-neutral absolute top-2 right-2 z-10"><i data-lucide="file-edit" class="w-2.5 h-2.5"></i> 초안</span>` : ''}${buildPortfolioCardMediaHtml(item)}</div>
            <div class="p-4 space-y-1.5">
                <h5 class="font-black text-ink-950 text-xs line-clamp-1">${escapeHtml(item.title)}</h5>
                <p class="text-[10px] text-ink-500 line-clamp-2">${escapeHtml(item.desc || '')}</p>
                <div class="flex justify-between items-center pt-2 border-t border-ink-100 mt-1">
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="event.stopPropagation();openPortfolioEditor(${idx})" class="btn btn-ghost btn-sm px-1.5">수정</button>
                        <button type="button" onclick="event.stopPropagation();deletePartnerPortfolio(${idx})" class="btn btn-ghost btn-sm px-1.5 text-roseCustom">삭제</button>
                        <button type="button" onclick="event.stopPropagation();movePartnerPortfolio(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-1.5" aria-label="위로 이동"><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                        <button type="button" onclick="event.stopPropagation();movePartnerPortfolio(${idx}, 1)" ${idx === partner.portfolios.length - 1 ? 'disabled' : ''} class="btn btn-ghost btn-sm px-1.5" aria-label="아래로 이동"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                        ${!item.isPrimary ? `<button type="button" onclick="event.stopPropagation();setPrimaryPortfolio(${idx})" class="btn btn-ghost btn-sm px-1.5" aria-label="대표 시공사례로 지정"><i data-lucide="star" class="w-3.5 h-3.5"></i></button>` : ''}
                    </div>
                    <span class="text-[10px] text-ink-400 font-bold flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i>${item.likes || 0}</span>
                </div>
            </div>`;
        grid.appendChild(itemDiv);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deletePartnerPortfolio(idx) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios[idx]) return;
    const removed = partner.portfolios.splice(idx, 1)[0];
    if (removed && typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO', `[${partnerName}]가 포트폴리오 "${removed.title}"를 삭제했습니다.`, 'WARNING');
    showToast('포트폴리오를 삭제했습니다.', 'info');
    renderPartnerConsolePortfolios();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 지금까지는 포트폴리오 목록 순서를 바꿀 방법이 없어서, 공개 프로필에 어떤 시공사례를
 * 먼저 보여줄지 조정하려면 삭제 후 재등록해야 했다 — 본문 이미지 순서 조정
 * (movePortfolioBodyImage)과 동일한 위/아래 스왑 패턴으로 목록 자체의 순서를 바꾼다. */
function movePartnerPortfolio(idx, dir) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= partner.portfolios.length) return;
    [partner.portfolios[idx], partner.portfolios[targetIdx]] = [partner.portfolios[targetIdx], partner.portfolios[idx]];
    renderPartnerConsolePortfolios();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

/* 관리자가 관리하는 홈 화면 히어로 슬라이더(featuredPartners)와는 별개로, 파트너
 * 본인이 자기 공개 프로필에서 어떤 시공사례를 대표로 보여줄지 정할 방법이 전혀
 * 없었다 — 순서 맨 앞으로 옮기는 동시에 "대표" 배지를 달아 눈에 띄게 한다.
 * 한 번에 하나만 대표로 지정 가능하도록 나머지는 해제한다. */
function setPrimaryPortfolio(idx) {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios || !partner.portfolios[idx]) return;

    partner.portfolios.forEach(p => { p.isPrimary = false; });
    const [selected] = partner.portfolios.splice(idx, 1);
    selected.isPrimary = true;
    partner.portfolios.unshift(selected);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO', `[${partnerName}]가 "${selected.title}"를 대표 시공사례로 지정했습니다.`, 'INFO');
    showToast('대표 시공사례로 지정되었습니다.', 'success');
    renderPartnerConsolePortfolios();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function requestDirectQuoteFromPortfolio(partnerName, portIdx = 0) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) {
        showToast("1:1 지정 상담은 먼저 안심 견적 신청서 작성이 필요합니다. 견적 신청 페이지로 이동합니다.", "warning");
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        if (typeof switchPanel === 'function') switchPanel('client-panel');
        return;
    }
    const userOrders = window.AppState.orders.filter(o => o.clientPhone === auth.phone);
    if (userOrders.length === 0) {
        showToast("안심 견적 신청서를 먼저 작성해주셔야 원하는 파트너사를 1:1 지정할 수 있습니다.", "warning");
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        if (typeof switchPanel === 'function') switchPanel('client-panel');
        return;
    }

    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;
    // 파트너 탐색/프로필 화면은 심사대기·제명 파트너를 이미 걸러서 보여주지만, 그 화면을
    // 열어둔 채로 그 사이 파트너 상태가 바뀌는 경우까지 막기 위해 여기서도 한 번 더 확인한다.
    if (partner.status !== 'active') {
        showToast(`[${partnerName}] 파트너사는 현재 1:1 지정 상담을 받을 수 없는 상태입니다.`, 'warning');
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        return;
    }
    if (typeof isPartnerBlockedByClient === 'function' && isPartnerBlockedByClient(partnerName)) {
        showToast(`[${partnerName}]는 차단한 파트너라 1:1 지정 상담을 신청할 수 없어요. 차단을 해제하려면 마이페이지 계정 정보를 확인해주세요.`, 'warning');
        return;
    }
    if (partner.blockedClients && partner.blockedClients.some(c => c.phone === auth.phone)) {
        showToast(`[${partnerName}] 파트너사는 현재 1:1 지정 상담을 받을 수 없는 상태입니다.`, 'warning');
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        return;
    }

    // 1:1 지정 상담은 최초 견적서(baseOrder)의 주소/평형/예산 정보를 그대로 물려받되,
    // 자동매칭 견적서와 뒤섞이지 않도록 is1on1 플래그를 가진 별도의 오더로 분리 생성한다
    // (마이페이지 의뢰이력의 '자동매칭'/'1:1 지정 매칭' 필터, renderClientMyPage 참고).
    const baseOrder = userOrders[0];
    const existing1on1 = userOrders.find(o => o.is1on1 && o.targetPartner === partnerName);
    // 예전엔 1:1 지정 상담을 취소(매칭취소)해도 이 오더가 남아있어서 existing1on1이 계속 잡혔고,
    // 그러면 같은 파트너를 다시 지정할 방법이 영영 없어지는 막다른 상황이 됐다. 입찰서(bids)가
    // 비어있는(취소된) 경우엔 "이미 신청함"으로 막지 말고 같은 오더에 새 입찰서를 다시 채워준다.
    if (existing1on1 && existing1on1.bids && existing1on1.bids.length > 0) {
        showToast(`이미 [${partnerName}] 파트너사에게 1:1 지정 상담을 신청하셨습니다. (${existing1on1.code})`, "info");
        if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
        if (typeof setClientMyPageHistoryFilter === 'function') setClientMyPageHistoryFilter('1on1');
        if (typeof selectMyPageEstimate === 'function') selectMyPageEstimate(existing1on1.code);
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        return;
    }

    if (existing1on1) {
        existing1on1.status = 'bidding';
        existing1on1.bids = [{
            partner: partnerName,
            price: Math.floor(baseOrder.budget * 0.96),
            desc: `[1:1 전속 지정 상담] ${partnerName}에서 고객님의 실거주/공실 정보(${baseOrder.pyung}평형, 예산 ₩ ${baseOrder.budget.toLocaleString()}만원)를 바탕으로 전속 가견적서 및 단독 자재 컨설팅안을 발송했습니다.`,
            verified: true, progress: 'bidding'
        }];

        closeClientPartnerProfile(); closePortfolioBlogDetail();
        if (typeof pushLog === 'function') pushLog('CLIENT', '1ON1_REQUEST', `[${auth.name}] 고객님이 [${partnerName}] 파트너를 1:1 단독 지정 재신청함. (${existing1on1.code})`, 'SUCCESS');
        showToast(`[${partnerName}] 파트너사에게 1:1 전속 지정 상담을 다시 신청했습니다! (${existing1on1.code})`, 'success');

        if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
        if (typeof renderClientMyPage === 'function') renderClientMyPage();
        if (typeof setClientMyPageHistoryFilter === 'function') setClientMyPageHistoryFilter('1on1');
        if (typeof selectMyPageEstimate === 'function') selectMyPageEstimate(existing1on1.code);
        return;
    }

    const newCode = `WJ-1ON1-${Date.now()}`;
    const newOrder = {
        code: newCode, clientName: baseOrder.clientName, clientPhone: baseOrder.clientPhone, clientAddress: baseOrder.clientAddress,
        spaceType: baseOrder.spaceType, workType: baseOrder.workType, pyung: baseOrder.pyung, vacancy: baseOrder.vacancy,
        preferredDate: baseOrder.preferredDate, partnerCountLimit: 1, budget: baseOrder.budget,
        status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false,
        acceptedPartner: null, finalPrice: 0, excludedPartners: [],
        is1on1: true, targetPartner: partnerName,
        bids: [{
            partner: partnerName,
            price: Math.floor(baseOrder.budget * 0.96),
            desc: `[1:1 전속 지정 상담] ${partnerName}에서 고객님의 실거주/공실 정보(${baseOrder.pyung}평형, 예산 ₩ ${baseOrder.budget.toLocaleString()}만원)를 바탕으로 전속 가견적서 및 단독 자재 컨설팅안을 발송했습니다.`,
            verified: true, progress: 'bidding'
        }],
        contractDoc: null, estimateDoc: null
    };
    window.AppState.orders.unshift(newOrder);

    closeClientPartnerProfile(); closePortfolioBlogDetail();
    if (typeof pushLog === 'function') pushLog('CLIENT', '1ON1_REQUEST', `[${auth.name}] 고객님이 [${partnerName}] 파트너를 1:1 단독 지정 신청함. (${newCode})`, 'SUCCESS');
    showToast(`[${partnerName}] 파트너사에게 1:1 전속 지정 상담을 신청했습니다! (${newCode})`, 'success');

    if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
    if (typeof renderClientMyPage === 'function') renderClientMyPage();
    if (typeof setClientMyPageHistoryFilter === 'function') setClientMyPageHistoryFilter('1on1');
    if (typeof selectMyPageEstimate === 'function') selectMyPageEstimate(newCode);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
}

/* 시공사례엔 이미 category(아파트/주택/상가·사무실/기타)가 있는데 배지로만
 * 보여줄 뿐 필터로는 전혀 쓰이지 않았다 — 파트너 프로필의 시공사례 그리드가
 * 전부 한 목록에 뒤섞여 있어, 원하는 공간 유형만 골라볼 방법이 없었다. */
let profilePortfolioCategoryFilter = 'all';
let profilePortfolioFilterTargetPartner = null;

function setProfilePortfolioCategoryFilter(category) {
    profilePortfolioCategoryFilter = category;
    if (profilePortfolioFilterTargetPartner) openClientPartnerProfile(profilePortfolioFilterTargetPartner);
}

function openClientPartnerProfile(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) { console.warn(`Partner '${partnerName}' not found in AppState.partners`); return; }
    if (profilePortfolioFilterTargetPartner !== partnerName) profilePortfolioCategoryFilter = 'all';
    profilePortfolioFilterTargetPartner = partnerName;

    safeUpdateText('profile-partner-name', partner.name);
    safeUpdateText('profile-partner-name-hero', partner.name);
    safeUpdateText('profile-partner-slogan-hero', partner.promoSlogan || `${partner.name} - 부산 우수 안심 파트너`);
    safeUpdateText('profile-partner-promo-hero', partner.promoText || '하자보증 무상 3년 지원 대상 기업');
    safeUpdateText('profile-rating-avg', partner.rating ? partner.rating.toFixed(1) : "5.0");
    const tierBadgeEl = document.getElementById('profile-partner-tier-badge');
    if (tierBadgeEl) tierBadgeEl.innerHTML = typeof buildPartnerTierBadgeHtml === 'function' ? buildPartnerTierBadgeHtml(partner.name) : '';

    const favoriteBtn = document.getElementById('client-partner-profile-favorite-btn');
    if (favoriteBtn && typeof syncFavoriteButtonIcon === 'function') syncFavoriteButtonIcon(favoriteBtn, partner.name);

    const blockBtn = document.getElementById('client-partner-profile-block-btn');
    if (blockBtn && typeof isPartnerBlockedByClient === 'function') {
        const blocked = isPartnerBlockedByClient(partner.name);
        const blockIcon = blockBtn.querySelector('[data-lucide]');
        if (blockIcon) blockIcon.classList.toggle('text-roseCustom', blocked);
        if (blockIcon) blockIcon.classList.toggle('text-ink-300', !blocked);
        blockBtn.title = blocked ? '차단 해제' : '파트너 차단';
    }

    const hero1on1Btn = document.getElementById('profile-hero-1on1-btn');
    if (hero1on1Btn) hero1on1Btn.onclick = () => requestDirectQuoteFromPortfolio(partner.name, 0);

    const chipsEl = document.getElementById('profile-portfolio-category-chips');
    if (chipsEl) {
        const publishedAll = (partner.portfolios || []).filter(p => !p.isDraft);
        const categoriesPresent = [...new Set(publishedAll.map(p => p.category).filter(Boolean))];
        if (categoriesPresent.length > 1) {
            const chips = [['all', '전체'], ...categoriesPresent.map(c => [c, PORTFOLIO_CATEGORY_LABELS[c] || c])];
            chipsEl.innerHTML = chips.map(([key, label]) =>
                `<button type="button" onclick="setProfilePortfolioCategoryFilter('${key}')" class="gnb-tab ${profilePortfolioCategoryFilter === key ? 'active' : ''}">${label}</button>`
            ).join('');
        } else {
            chipsEl.innerHTML = '';
        }
    }

    const portGrid = document.getElementById('profile-portfolios-grid');
    if (portGrid) {
        portGrid.innerHTML = '';
        const publishedPortfolios = (partner.portfolios || []).filter(p => !p.isDraft && (profilePortfolioCategoryFilter === 'all' || p.category === profilePortfolioCategoryFilter));
        if (publishedPortfolios.length > 0) {
            const weeklyBestIds = getWeeklyBestPortfolioIds();
            partner.portfolios.forEach((port, idx) => {
                if (port.isDraft) return;
                if (profilePortfolioCategoryFilter !== 'all' && port.category !== profilePortfolioCategoryFilter) return;
                const isWeeklyBest = weeklyBestIds.includes(getOrAssignPortfolioId(port));
                const itemDiv = document.createElement('div');
                itemDiv.className = "portfolio-card text-left group";
                itemDiv.onclick = (e) => { e.stopPropagation(); openPortfolioBlogDetail(partner.name, idx); };
                itemDiv.innerHTML = `
                    <div class="portfolio-img relative">${port.isPrimary ? `<span class="badge badge-gold absolute top-2 left-2 z-10"><i data-lucide="star" class="w-2.5 h-2.5"></i> 대표 시공사례</span>` : ''}${isWeeklyBest ? `<span class="badge badge-gold absolute top-2 right-2 z-10">🏆 이번 주 인기</span>` : ''}${buildPortfolioCardMediaHtml(port)}</div>
                    <div class="p-4 space-y-1.5">
                        <h5 class="font-black text-ink-950 text-xs truncate group-hover:text-ink-600 transition-colors">${escapeHtml(port.title)}</h5>
                        <p class="text-[11px] text-ink-500 font-medium line-clamp-2 leading-relaxed">${escapeHtml(port.desc || '')}</p>
                        <div class="flex items-center justify-between pt-1.5 mt-0.5 border-t border-ink-100">
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] text-ink-400 font-bold flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i>${port.likes || 0}</span>
                                <span class="text-[10px] text-ink-400 font-bold flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i>${port.views || 0}</span>
                            </div>
                            <span class="text-[10px] text-ink-800 font-extrabold group-hover:underline">자세히 보기 →</span>
                        </div>
                    </div>`;
                portGrid.appendChild(itemDiv);
            });
        } else {
            const hasAnyPublished = (partner.portfolios || []).some(p => !p.isDraft);
            portGrid.innerHTML = hasAnyPublished
                ? `<p class="text-xs text-ink-400 font-bold py-8 text-center col-span-full">해당 카테고리의 시공 사례가 없습니다.</p>`
                : `<p class="text-xs text-ink-400 font-bold py-8 text-center col-span-full">등록된 시공 사례가 없습니다.</p>`;
        }
    }

    const reviewsList = document.getElementById('profile-reviews-list');
    if (reviewsList) {
        reviewsList.innerHTML = '';
        if (partner.reviews && partner.reviews.length > 0) {
            partner.reviews.forEach((rev, revIdx) => {
                const fullStars = '★'.repeat(rev.rating);
                const emptyStars = '☆'.repeat(5 - rev.rating);
                let photosHtml = '';
                if (rev.photos && rev.photos.length > 0) {
                    photosHtml = `<div class="flex gap-2 pt-1 overflow-x-auto custom-scroll">
                        ${rev.photos.slice(0, 3).map((pUrl) => `<img src="${pUrl}" class="w-14 h-14 object-cover rounded-xl border border-ink-100 shrink-0">`).join('')}
                        ${rev.photos.length > 3 ? `<div class="w-14 h-14 rounded-xl bg-ink-100 flex items-center justify-center text-[10px] font-black text-ink-600 shrink-0">+${rev.photos.length - 3}</div>` : ''}
                    </div>`;
                }
                const cardEl = document.createElement('div');
                cardEl.className = "p-4 bg-ink-50/70 hover:bg-white rounded-2xl border border-ink-100 text-left space-y-2 hover:shadow-md transition-all cursor-pointer group";
                cardEl.onclick = () => openReviewDetailModal(partner.name, revIdx);
                cardEl.innerHTML = `
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center gap-1.5 font-extrabold text-ink-950"><span class="w-1.5 h-1.5 rounded-full bg-ink-800"></span><span>${escapeHtml(rev.client)} 고객님</span></div>
                        <span class="text-gold-500 font-extrabold text-xs">${fullStars}${emptyStars} <span class="text-ink-800 text-[10px] ml-0.5">(${rev.rating}.0)</span></span>
                    </div>
                    <p class="text-xs text-ink-700 font-medium leading-relaxed line-clamp-3">${escapeHtml(rev.text)}</p>
                    ${photosHtml}
                    ${rev.reply && rev.reply.text ? `<div class="text-[10px] font-bold text-brand-600 flex items-center gap-1"><i data-lucide="reply" class="w-3 h-3"></i> 사장님 답글이 있어요</div>` : ''}
                    <div class="flex justify-between items-center pt-2 border-t border-ink-100 text-[10px] font-semibold">
                        <span class="text-ink-400">작성일: ${rev.date}</span>
                        <div class="flex items-center gap-3">
                            <button type="button" onclick="event.stopPropagation(); toggleReviewHelpful('${partner.name}', ${revIdx})" class="flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 ${isReviewHelpfulByMe(rev) ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700'}"><i data-lucide="thumbs-up" class="w-3 h-3"></i> 도움돼요 ${(rev.helpfulBy || []).length}</button>
                            <button type="button" onclick="event.stopPropagation(); ${isReviewReportedByMe(rev) ? `showToast('이미 신고한 후기입니다.', 'info')` : `openReportReasonPrompt((reason) => reportReview('${partner.name}', ${revIdx}, reason))`}" class="flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-ink-400 hover:text-roseCustom"><i data-lucide="flag" class="w-3 h-3"></i> ${isReviewReportedByMe(rev) ? '신고 완료' : '신고'}</button>
                            <span class="text-ink-800 font-extrabold group-hover:underline">자세히 보기 →</span>
                        </div>
                    </div>`;
                reviewsList.appendChild(cardEl);
            });
        } else {
            reviewsList.innerHTML = `<p class="text-xs text-ink-400 font-bold py-8 text-center">등록된 안심 리뷰가 아직 없습니다.</p>`;
        }
    }

    openModal('client-partner-profile-modal', 'client-partner-profile-modal-card');
}

function openReviewDetailModal(partnerName, reviewIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.reviews || !partner.reviews[reviewIdx]) return;
    const rev = partner.reviews[reviewIdx];

    safeUpdateText('review-detail-client', `${rev.client} 고객님 후기`);
    safeUpdateText('review-detail-stars', `${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)} (${rev.rating}.0)`);
    safeUpdateText('review-detail-date', `작성일: ${rev.date}`);
    const textEl = document.getElementById('review-detail-text');
    if (textEl) textEl.innerText = rev.text;

    const photosWrapper = document.getElementById('review-detail-photos-wrapper');
    const photosGrid = document.getElementById('review-detail-photos-grid');
    if (rev.photos && rev.photos.length > 0) {
        photosWrapper?.classList.remove('hidden');
        safeUpdateText('review-detail-photo-count', rev.photos.length);
        const photoList = rev.photos.map((pUrl) => ({ src: pUrl }));
        if (photosGrid) {
            photosGrid.innerHTML = '';
            rev.photos.forEach((photoUrl, pIdx) => {
                const imgEl = document.createElement('img');
                imgEl.src = photoUrl;
                imgEl.className = "w-full h-32 object-cover rounded-xl border border-ink-100 cursor-zoom-in hover:scale-105 transition-transform duration-200";
                imgEl.onclick = () => openLightbox(photoUrl, `${rev.client} 고객님 리뷰 현장 사진`, photoList, pIdx);
                photosGrid.appendChild(imgEl);
            });
        }
    } else {
        photosWrapper?.classList.add('hidden');
    }

    const replyWrapper = document.getElementById('review-detail-reply-wrapper');
    if (rev.reply && rev.reply.text) {
        replyWrapper?.classList.remove('hidden');
        safeUpdateText('review-detail-reply-author', partnerName);
        const replyTextEl = document.getElementById('review-detail-reply-text');
        if (replyTextEl) replyTextEl.innerText = rev.reply.text;
        const replyReportBtn = document.getElementById('review-detail-reply-report-btn');
        if (replyReportBtn) {
            const replyReported = isReviewReplyReportedByMe(rev);
            replyReportBtn.onclick = () => { openReportReasonPrompt((reason) => reportReviewReply(partnerName, reviewIdx, reason)); };
            replyReportBtn.disabled = replyReported;
            replyReportBtn.classList.toggle('hidden', false);
        }
        safeUpdateText('review-detail-reply-report-label', isReviewReplyReportedByMe(rev) ? '답글 신고 완료' : '답글 신고');
    } else {
        replyWrapper?.classList.add('hidden');
    }

    const helpfulBtn = document.getElementById('review-detail-helpful-btn');
    if (helpfulBtn) {
        helpfulBtn.onclick = () => { toggleReviewHelpful(partnerName, reviewIdx); openReviewDetailModal(partnerName, reviewIdx); };
        helpfulBtn.classList.toggle('btn-dark', isReviewHelpfulByMe(rev));
        helpfulBtn.classList.toggle('btn-secondary', !isReviewHelpfulByMe(rev));
    }
    safeUpdateText('review-detail-helpful-label', `도움돼요 ${(rev.helpfulBy || []).length}`);

    const reportBtn = document.getElementById('review-detail-report-btn');
    if (reportBtn) {
        const reported = isReviewReportedByMe(rev);
        reportBtn.onclick = () => { openReportReasonPrompt((reason) => { reportReview(partnerName, reviewIdx, reason); openReviewDetailModal(partnerName, reviewIdx); }); };
        reportBtn.disabled = reported;
    }
    safeUpdateText('review-detail-report-label', isReviewReportedByMe(rev) ? '신고 완료' : '신고');

    openModal('review-detail-modal', 'review-detail-modal-card');
}

/* 후기가 많이 쌓이면 어떤 후기가 실제로 도움이 됐는지 알기 어렵다 — "도움돼요"
 * 투표를 추가해 방문자가 신뢰할 만한 후기를 가려낼 수 있게 한다. 로그인한
 * 고객 1인당 후기 1건에 1votes만 허용한다(rev.helpfulBy로 추적, 토글 가능). */
function isReviewHelpfulByMe(rev) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    return !!(rev.helpfulBy && rev.helpfulBy.includes(auth.id));
}

function toggleReviewHelpful(partnerName, reviewIdx) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev) return;
    if (!rev.helpfulBy) rev.helpfulBy = [];
    const idx = rev.helpfulBy.indexOf(auth.id);
    if (idx >= 0) rev.helpfulBy.splice(idx, 1);
    else rev.helpfulBy.push(auth.id);
    if (typeof window.openClientPartnerProfile === 'function' && !document.getElementById('client-partner-profile-modal')?.classList.contains('hidden')) {
        window.openClientPartnerProfile(partnerName);
    }
}

/* 커뮤니티 글은 신고할 수 있는데(reportCommunityPost) 후기는 허위·악의적인 내용이
 * 올라와도 고객이 신고할 방법이 전혀 없었다 — 관리자는 이미 buildAdminReviewModerationHtml/
 * adminDeleteReview로 직접 삭제할 수 있지만, 어떤 후기가 문제인지 알려줄 신호가 없었다.
 * 커뮤니티 신고와 동일한 패턴(1인 1회, reportedBy 배열)으로 신고 수를 관리자 화면에 노출한다. */
function isReviewReportedByMe(rev) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    return !!(rev.reportedBy && rev.reportedBy.includes(auth.id));
}

function reportReview(partnerName, reviewIdx, reason) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev) return;
    if (!rev.reportedBy) rev.reportedBy = [];
    if (rev.reportedBy.includes(auth.id)) { showToast('이미 신고한 후기입니다.', 'info'); return; }
    rev.reportedBy.push(auth.id);
    if (reason) { if (!rev.reportReasons) rev.reportReasons = []; rev.reportReasons.push({ id: auth.id, reason }); }
    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW_REPORT', `'${auth.name}' 고객님이 [${partnerName}] 파트너의 후기를 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    if (typeof window.openClientPartnerProfile === 'function' && !document.getElementById('client-partner-profile-modal')?.classList.contains('hidden')) {
        window.openClientPartnerProfile(partnerName);
    }
}

/* 고객은 허위·악의적인 후기를 신고할 수 있는데(reportReview) 정작 그 후기의
 * 당사자인 파트너는 신고 수단이 전혀 없었다 — submitReviewReply(공개 답글)로는
 * 관리자 검토 대기열에 올라가지도, 우선순위가 올라가지도 않는다. 고객 신고
 * (rev.reportedBy)와 집계가 섞이지 않도록 별도 필드(partnerFlagged)로 관리한다. */
function flagReviewAsPartner(partnerName, reviewIdx, reason) {
    if (!window.AppState.partnerLoggedIn || window.AppState.partnerName !== partnerName) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev) return;
    if (rev.partnerFlagged) { showToast('이미 신고 접수된 후기입니다.', 'info'); return; }
    rev.partnerFlagged = true;
    rev.partnerFlagReason = reason || '';
    rev.partnerFlagDate = getLocalDateString();
    if (typeof pushLog === 'function') pushLog('PARTNER', 'REVIEW_PARTNER_FLAG', `[${partnerName}]가 자신에게 달린 후기를 허위/부적절 사유로 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    renderPartnerMyReviews(partner);
}

/* 후기 본문은 신고할 수 있는데(reportReview) 파트너의 답글(submitReviewReply)엔
 * 신고 수단이 전혀 없었다 — 커뮤니티 댓글/대댓글과 동일한 신고 대상 비대칭이다.
 * 답글 전용 신고 목록(rev.reply.reportedBy)을 별도로 둔다. */
function isReviewReplyReportedByMe(rev) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn || !rev.reply) return false;
    return !!(rev.reply.reportedBy && rev.reply.reportedBy.includes(auth.id));
}

function reportReviewReply(partnerName, reviewIdx, reason) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const rev = partner && partner.reviews && partner.reviews[reviewIdx];
    if (!rev || !rev.reply) return;
    if (!rev.reply.reportedBy) rev.reply.reportedBy = [];
    if (rev.reply.reportedBy.includes(auth.id)) { showToast('이미 신고한 답글입니다.', 'info'); return; }
    rev.reply.reportedBy.push(auth.id);
    if (reason) { if (!rev.reply.reportReasons) rev.reply.reportReasons = []; rev.reply.reportReasons.push({ id: auth.id, reason }); }
    if (typeof pushLog === 'function') pushLog('CLIENT', 'REVIEW_REPLY_REPORT', `'${auth.name}' 고객님이 [${partnerName}] 파트너의 후기 답글을 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    openReviewDetailModal(partnerName, reviewIdx);
}

/* 커뮤니티 글은 개별 저장(scrap)이 가능한데(toggleSaveCommunityPost), 시공사례는
 * 파트너 전체를 관심 등록(toggleFavoritePartner)할 수만 있고 특정 시공사례 하나만
 * 골라 저장할 방법이 없었다 — 파트너가 시공사례를 이동/대표지정(movePartnerPortfolio/
 * setPrimaryPortfolio)하며 배열 순서를 바꾸므로 인덱스 대신 안정적인 id로 참조해야
 * 한다. 기존(시드) 데이터는 id가 없으므로 최초 상호작용 시점에 지연 발급한다. */
const MAX_SAVED_PORTFOLIOS = 30;

function getOrAssignPortfolioId(port) {
    if (!port.id) port.id = `port-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    return port.id;
}

/* 커뮤니티의 "이번 주 베스트"와 동일한 방식 — 최근 7일 내 발행된 시공사례 중
 * 좋아요×3 + 조회수 점수 상위 3건을 뽑는다. 포트폴리오는 댓글이 없으므로
 * 커뮤니티 공식(좋아요×3 + 댓글×2 + 조회수)에서 댓글 항목만 뺐다. */
function getWeeklyBestPortfolioIds() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const scored = [];
    (window.AppState.partners || []).forEach(partner => {
        (partner.portfolios || []).forEach(port => {
            if (port.isDraft || !port.date) return;
            if (new Date(port.date) < weekAgo) return;
            const score = (port.likes || 0) * 3 + (port.views || 0);
            if (score > 0) scored.push({ id: getOrAssignPortfolioId(port), score });
        });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(p => p.id);
}

function isPortfolioSaved(partnerName, idx) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port || !port.id) return false;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    return !!(account && account.savedPortfolios && account.savedPortfolios.some(s => s.partnerName === partnerName && s.portfolioId === port.id));
}

function toggleSavePortfolio(partnerName, idx) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port) return;
    const portfolioId = getOrAssignPortfolioId(port);
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    if (!account) return;
    if (!account.savedPortfolios) account.savedPortfolios = [];
    const existingIdx = account.savedPortfolios.findIndex(s => s.partnerName === partnerName && s.portfolioId === portfolioId);
    if (existingIdx >= 0) { account.savedPortfolios.splice(existingIdx, 1); showToast('저장한 시공사례에서 제거했습니다.', 'info'); }
    else {
        if (account.savedPortfolios.length >= MAX_SAVED_PORTFOLIOS) { showToast(`저장한 시공사례는 최대 ${MAX_SAVED_PORTFOLIOS}건까지 보관할 수 있어요. 기존 항목을 해제한 후 다시 시도해주세요.`, 'warning'); return; }
        account.savedPortfolios.push({ partnerName, portfolioId }); showToast('시공사례를 저장했습니다!', 'success');
    }
    const saveBtn = document.getElementById('blog-modal-save-btn');
    if (saveBtn) { const saved = isPortfolioSaved(partnerName, idx); saveBtn.classList.toggle('text-brand-600', saved); saveBtn.title = saved ? '저장됨' : '시공사례 저장'; }
    if (typeof renderClientSavedPortfolios === 'function') renderClientSavedPortfolios();
}

function renderClientSavedPortfolios() {
    const container = document.getElementById('client-mypage-saved-portfolios-container');
    if (!container) return;
    const auth = window.AppState.clientAuth;
    if (!auth.loggedIn) return;
    const account = window.AppState.clientAccounts.find(acc => acc.id === auth.id);
    const saved = (account && account.savedPortfolios) || [];
    const items = saved.map(s => {
        const partner = window.AppState.partners.find(p => p.name === s.partnerName);
        const idx = partner && partner.portfolios ? partner.portfolios.findIndex(p => p.id === s.portfolioId) : -1;
        const port = idx >= 0 ? partner.portfolios[idx] : null;
        return port ? { partnerName: s.partnerName, idx, port } : null;
    }).filter(Boolean);

    if (items.length === 0) {
        container.innerHTML = buildEmptyStateHtml('bookmark', '아직 저장한 시공사례가 없습니다.');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = items.map(({ partnerName, idx, port }) => `
        <div class="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl cursor-pointer hover:bg-ink-100 transition-colors" onclick="openPortfolioBlogDetail('${escapeHtml(partnerName)}', ${idx})">
            <div class="space-y-0.5 min-w-0 flex-1">
                <p class="text-[10px] text-ink-400 font-bold">${escapeHtml(partnerName)}</p>
                <h5 class="text-xs font-black text-ink-950 truncate">${escapeHtml(port.title || '(제목 없음)')}</h5>
            </div>
            <span class="text-[11px] text-ink-400 font-bold shrink-0 ml-2">${port.pyung || '-'}평형</span>
        </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* 커뮤니티 글·후기는 신고할 수 있는데 파트너가 올리는 시공사례(포트폴리오)는
 * 저작권 도용이나 허위 사진이 올라와도 신고할 방법이 없었다 — 동일한 1인 1회
 * reportedBy 배열 패턴을 포트폴리오 항목에도 적용한다. */
function isPortfolioReportedByMe(port) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) return false;
    return !!(port.reportedBy && port.reportedBy.includes(auth.id));
}

function reportPortfolio(reason) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const { partnerName, idx } = _blogDetailContext;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port) return;
    if (!port.reportedBy) port.reportedBy = [];
    if (port.reportedBy.includes(auth.id)) { showToast('이미 신고한 시공사례입니다.', 'info'); return; }
    port.reportedBy.push(auth.id);
    if (reason) { if (!port.reportReasons) port.reportReasons = []; port.reportReasons.push({ id: auth.id, reason }); }
    if (typeof pushLog === 'function') pushLog('CLIENT', 'PORTFOLIO_REPORT', `'${auth.name}' 고객님이 [${partnerName}]의 시공사례(${port.title || '-'})를 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    const reportBtn = document.getElementById('blog-modal-report-btn');
    if (reportBtn) { reportBtn.classList.add('text-roseCustom'); reportBtn.title = '신고 완료'; }
}

function closeReviewDetailModal() { closeModal('review-detail-modal', 'review-detail-modal-card'); }
function closeClientPartnerProfile() { closeModal('client-partner-profile-modal', 'client-partner-profile-modal-card'); }

function openPortfolioBlogDetail(partnerName, idx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios[idx]) return;
    const port = partner.portfolios[idx];
    _blogDetailContext = { partnerName, idx };
    port.views = (port.views || 0) + 1;

    safeUpdateText('blog-modal-partner-name', partnerName);
    safeUpdateText('blog-modal-pyung', `${port.pyung}평형 시공 사례`);
    safeUpdateText('blog-modal-views', `조회 ${port.views || 0}`);
    safeUpdateText('blog-modal-title', port.title);
    safeUpdateText('blog-modal-overview', port.desc || '');

    const catLabel = PORTFOLIO_CATEGORY_LABELS[port.category] || '';
    const catBadge = document.getElementById('blog-modal-category-badge');
    if (catBadge) { catBadge.textContent = catLabel; catBadge.classList.toggle('hidden', !catLabel); }

    renderBlogLikeButton(port.likes || 0);
    const reportBtn = document.getElementById('blog-modal-report-btn');
    if (reportBtn) { const reported = isPortfolioReportedByMe(port); reportBtn.classList.toggle('text-roseCustom', reported); reportBtn.title = reported ? '신고 완료' : '시공사례 신고'; }
    const saveBtn = document.getElementById('blog-modal-save-btn');
    if (saveBtn) { const saved = isPortfolioSaved(partnerName, idx); saveBtn.classList.toggle('text-brand-600', saved); saveBtn.title = saved ? '저장됨' : '시공사례 저장'; saveBtn.onclick = () => toggleSavePortfolio(partnerName, idx); }
    renderPortfolioQnaSection(partnerName, idx);

    const ctaBtn = document.getElementById('blog-modal-cta-btn');
    if (ctaBtn) ctaBtn.onclick = () => requestDirectQuoteFromPortfolio(partnerName, idx);

    const feed = document.getElementById('blog-modal-scenes-feed');
    if (feed) {
        // 작성 화면(#portfolio-body-editor)에 쓴 HTML을 그대로 렌더링 — "쓰는 화면 = 보이는 화면".
        // (예전 scenes/blocks/단일 img 포맷 데이터는 portfolioToBodyHtml이 동일한 HTML로 변환해준다.)
        feed.innerHTML = portfolioToBodyHtml(port);
        // 삭제/순서 이동 버튼은 편집 중에만 필요한 UI이므로 고객이 보는 화면에서는 제거한다.
        feed.querySelectorAll('.blog-img-remove-btn').forEach(btn => btn.remove());
        feed.querySelectorAll('.blog-img-move-controls').forEach(el => el.remove());

        setTimeout(() => {
            const imgs = Array.from(feed.querySelectorAll('img'));
            let allPartnerPhotos = [];
            if (partner.portfolios && partner.portfolios.length > 0) {
                partner.portfolios.forEach((pItem) => {
                    if (pItem.isDraft && pItem !== port) return;
                    const tmp = document.createElement('div');
                    tmp.innerHTML = portfolioToBodyHtml(pItem);
                    tmp.querySelectorAll('img').forEach((im) => allPartnerPhotos.push({ src: im.getAttribute('src') || '', title: pItem.title }));
                });
            }
            let currentFeedPhotos = imgs.map((imgEl) => ({ src: imgEl.getAttribute('src') || '', title: port.title }));
            let photoListToUse = currentFeedPhotos.length > 1 ? currentFeedPhotos : (allPartnerPhotos.length > 1 ? allPartnerPhotos : currentFeedPhotos);

            imgs.forEach((img, i) => {
                const src = img.getAttribute('src') || '';
                let startIdx = photoListToUse.findIndex(item => item.src === src);
                if (startIdx === -1) startIdx = i;
                img.onclick = () => openLightbox(src, `${port.title}`, photoListToUse, startIdx);
            });
        }, 50);
    }

    openModal('portfolio-blog-modal', 'portfolio-blog-modal-card');
}

function closePortfolioBlogDetail() { closeModal('portfolio-blog-modal', 'portfolio-blog-modal-card'); _blogDetailContext = { partnerName: null, idx: null }; }

/* 계약 전 입찰 문의(openBidQuestionModal/submitBidQuestion, client_panel.js)는
 * 이미 매칭된 오더 안에서만 동작해, 아직 오더를 넣기 전 "탐색 중" 단계에서 특정
 * 시공사례를 보고 궁금한 점을 물어볼 방법이 없었다 — 동일한 질문/답변 패턴을
 * 시공사례 하나(id 기반, 재정렬에도 안전)에 적용한다. */
function renderPortfolioQnaSection(partnerName, idx) {
    const container = document.getElementById('blog-modal-qna-section');
    if (!container) return;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port) return;
    const questions = port.questions || [];
    const isOwnerPartnerView = window.AppState.partnerLoggedIn && window.AppState.partnerName === partnerName;
    const myId = window.AppState.clientAuth && window.AppState.clientAuth.loggedIn ? window.AppState.clientAuth.id : null;

    const listHtml = questions.length > 0 ? questions.map((q, qIdx) => {
        const isMine = myId && q.authorId === myId;
        const isReported = myId && (q.reportedBy || []).includes(myId);
        return `
        <div class="p-3 bg-ink-50 rounded-xl space-y-1.5">
            <div class="flex justify-between items-start gap-2">
                <p class="text-xs text-ink-700 font-semibold leading-relaxed"><i data-lucide="help-circle" class="w-3 h-3 inline text-ink-400"></i> ${escapeHtml(q.text)} <span class="text-[10px] text-ink-400 font-bold">(${q.date})</span></p>
                ${isMine && !q.reply
                    ? `<button type="button" onclick="deleteMyPortfolioQuestion('${escapeHtml(partnerName)}', ${idx}, ${qIdx})" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0">삭제</button>`
                    : (!isMine && myId ? `<button type="button" onclick="${isReported ? `showToast('이미 신고한 문의입니다.', 'info')` : `openReportReasonPrompt((reason) => reportPortfolioQuestion('${escapeHtml(partnerName)}', ${idx}, ${qIdx}, reason))`}" class="text-[10px] font-bold text-ink-400 hover:text-roseCustom bg-transparent border-0 cursor-pointer p-0 shrink-0">${isReported ? '신고됨' : '신고'}</button>` : '')}
            </div>
            ${q.reply
                ? `<p class="text-xs text-brand-700 font-semibold leading-relaxed pl-4"><i data-lucide="reply" class="w-3 h-3 inline"></i> ${escapeHtml(q.reply)}</p>`
                : isOwnerPartnerView
                    ? `<div class="flex gap-1.5 pl-4"><input type="text" id="portfolio-qna-reply-input-${idx}-${qIdx}" placeholder="답변을 입력하세요" class="input flex-1 text-xs"><button type="button" onclick="replyToPortfolioQuestion('${escapeHtml(partnerName)}', ${idx}, ${qIdx})" class="btn btn-dark btn-sm shrink-0">답변</button></div>`
                    : `<p class="text-[10px] text-ink-400 font-bold pl-4">답변 대기중</p>`}
        </div>`;
    }).join('') : `<p class="text-xs text-ink-400 font-bold text-center py-3">아직 등록된 문의가 없습니다.</p>`;

    const composeHtml = !isOwnerPartnerView ? `
        <div class="flex gap-1.5 pt-1">
            <input type="text" id="portfolio-question-input-${idx}" placeholder="이 시공사례에 대해 궁금한 점을 물어보세요" class="input flex-1 text-xs">
            <button type="button" onclick="submitPortfolioQuestion('${escapeHtml(partnerName)}', ${idx})" class="btn btn-dark btn-sm shrink-0">문의하기</button>
        </div>` : '';

    container.innerHTML = `
        <h5 class="text-xs font-black text-ink-800 flex items-center gap-1.5"><i data-lucide="message-circle-question" class="w-4 h-4 text-brand-500"></i> 시공사례 문의 ${questions.length}건</h5>
        <div class="space-y-2">${listHtml}</div>
        ${composeHtml}`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function submitPortfolioQuestion(partnerName, idx) {
    if (!requireClientLoginForCommunity()) return;
    const auth = window.AppState.clientAuth;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    if (!port) return;

    const input = document.getElementById(`portfolio-question-input-${idx}`);
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('문의 내용을 입력해 주세요.', 'warning'); return; }

    if (!port.questions) port.questions = [];
    port.questions.push({ text, authorId: auth.id, authorPhone: auth.phone, date: getLocalDateString(), reply: null, replyDate: null });

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PORTFOLIO_QUESTION', `'${auth.name}' 고객님이 [${partnerName}]의 시공사례(${port.title || '-'})에 문의를 남겼습니다.`, 'INFO');
    if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `시공사례(${port.title || '-'})에 대해 고객님이 문의를 남겼어요: "${text}"`);
    showToast('문의를 보냈습니다. 답변이 도착하면 알려드릴게요.', 'success');
    renderPortfolioQnaSection(partnerName, idx);
}

function replyToPortfolioQuestion(partnerName, idx, questionIdx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    const question = port && port.questions && port.questions[questionIdx];
    if (!question) return;

    const input = document.getElementById(`portfolio-qna-reply-input-${idx}-${questionIdx}`);
    const reply = input ? input.value.trim() : '';
    if (!reply) { showToast('답변 내용을 입력해 주세요.', 'warning'); return; }

    question.reply = reply;
    question.replyDate = getLocalDateString();

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO_QUESTION_REPLY', `[${partnerName}]가 시공사례(${port.title || '-'}) 문의에 답변했습니다.`, 'SUCCESS');
    if (typeof pushClientNotification === 'function' && question.authorPhone) pushClientNotification(question.authorPhone, `문의하신 시공사례(${port.title || '-'})에 답변이 도착했어요.`);
    showToast('답변이 등록되었습니다.', 'success');
    renderPortfolioQnaSection(partnerName, idx);
}

/* 커뮤니티 댓글/후기는 본인 것을 삭제하거나 타인 것을 신고할 수 있는데, 시공사례
 * 문의는 등록(submitPortfolioQuestion)/답변(replyToPortfolioQuestion)만 있고 삭제·신고
 * 경로가 전혀 없었다 — 동일한 소유권 검증(authorId) + 1인 1회 reportedBy 패턴을
 * 적용한다. 이미 답변이 달린 문의는 삭제하면 파트너의 답변 기록이 사라지므로
 * 미답변 상태에서만 삭제를 허용한다. */
function deleteMyPortfolioQuestion(partnerName, idx, questionIdx) {
    const auth = window.AppState.clientAuth;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    const question = port && port.questions && port.questions[questionIdx];
    if (!question || !auth || question.authorId !== auth.id) return;
    if (question.reply) { showToast('이미 답변이 등록된 문의는 삭제할 수 없어요.', 'warning'); return; }

    port.questions.splice(questionIdx, 1);
    showToast('문의를 삭제했습니다.', 'info');
    renderPortfolioQnaSection(partnerName, idx);
}

function reportPortfolioQuestion(partnerName, idx, questionIdx, reason) {
    const auth = window.AppState.clientAuth;
    if (!auth || !auth.loggedIn) { showToast('로그인 후 이용할 수 있어요.', 'warning'); return; }
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios && partner.portfolios[idx];
    const question = port && port.questions && port.questions[questionIdx];
    if (!question) return;
    if (!question.reportedBy) question.reportedBy = [];
    if (question.reportedBy.includes(auth.id)) { showToast('이미 신고한 문의입니다.', 'info'); return; }
    question.reportedBy.push(auth.id);
    if (reason) { if (!question.reportReasons) question.reportReasons = []; question.reportReasons.push({ id: auth.id, reason }); }

    if (typeof pushLog === 'function') pushLog('CLIENT', 'PORTFOLIO_QUESTION_REPORT', `'${auth.name}' 고객님이 [${partnerName}]의 시공사례 문의를 신고했습니다.${reason ? ` (사유: ${reason})` : ''}`, 'WARNING');
    showToast('신고가 접수되었습니다. 검토 후 조치할게요.', 'success');
    renderPortfolioQnaSection(partnerName, idx);
}

function renderBlogLikeButton(count) {
    const btn = document.getElementById('blog-modal-like-btn');
    const countEl = document.getElementById('blog-modal-like-count');
    if (countEl) countEl.textContent = count;
    if (btn) btn.classList.toggle('liked', !!_blogLikedKeys[`${_blogDetailContext.partnerName}-${_blogDetailContext.idx}`]);
}

const _blogLikedKeys = {};
function handleBlogLikeClick() {
    const { partnerName, idx } = _blogDetailContext;
    if (!partnerName) return;
    const key = `${partnerName}-${idx}`;
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    const port = partner && partner.portfolios[idx];
    if (!port) return;
    if (_blogLikedKeys[key]) {
        port.likes = Math.max(0, (port.likes || 0) - 1);
        delete _blogLikedKeys[key];
    } else {
        port.likes = (port.likes || 0) + 1;
        _blogLikedKeys[key] = true;
        showToast('좋아요가 반영되었습니다!', 'success');
        // 커뮤니티 글 좋아요(toggleCommunityLike)는 작성자에게 알림이 가는데
        // 시공사례 좋아요는 조용히 쌓이기만 해서 파트너가 반응을 알 방법이 없었다 —
        // 동일하게 좋아요가 "새로" 눌렸을 때만(취소 시엔 제외) 알린다.
        if (typeof pushPartnerNotification === 'function') pushPartnerNotification(partnerName, `고객님이 시공사례 "${port.title || '-'}"에 좋아요를 눌렀어요.`, null, 'community');
    }
    renderBlogLikeButton(port.likes || 0);
}

function updateLightboxTransform() {
    const img = document.getElementById('lightbox-img');
    if (!img) return;
    img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxScale})`;
    img.dataset.zoomed = lightboxScale > 1 ? 'true' : 'false';
    img.style.cursor = lightboxScale > 1 ? (isLightboxDragging ? 'grabbing' : 'grab') : 'zoom-in';
}

function renderLightboxPhoto() {
    const img = document.getElementById('lightbox-img');
    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    if (!img || lightboxPhotos.length === 0) return;

    const currentItem = lightboxPhotos[lightboxCurrentIndex];
    let highResSrc = currentItem.src || currentItem.img || '';
    if (highResSrc.includes('unsplash.com')) highResSrc = highResSrc.replace('w=600', 'w=1600').replace('q=60', 'q=95');

    img.src = highResSrc;
    lightboxScale = 1; lightboxPanX = 0; lightboxPanY = 0; isLightboxDragging = false; lightboxHasDragged = false;
    updateLightboxTransform();

    if (prevBtn && nextBtn) {
        if (lightboxPhotos.length > 1) { prevBtn.classList.remove('hidden'); nextBtn.classList.remove('hidden'); }
        else { prevBtn.classList.add('hidden'); nextBtn.classList.add('hidden'); }
    }
}

function prevLightboxPhoto(e) { if (e) e.stopPropagation(); if (lightboxPhotos.length <= 1) return; lightboxCurrentIndex = (lightboxCurrentIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length; renderLightboxPhoto(); }
function nextLightboxPhoto(e) { if (e) e.stopPropagation(); if (lightboxPhotos.length <= 1) return; lightboxCurrentIndex = (lightboxCurrentIndex + 1) % lightboxPhotos.length; renderLightboxPhoto(); }

function initLightboxDragEvents(img) {
    if (!img) return;
    function onPointerDown(e) {
        if (e.button && e.button !== 0) return;
        isLightboxDragging = true; lightboxHasDragged = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        lightboxStartX = clientX; lightboxStartY = clientY;
        lightboxStartPanX = lightboxPanX; lightboxStartPanY = lightboxPanY;
        updateLightboxTransform();
    }
    function onPointerMove(e) {
        if (!isLightboxDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - lightboxStartX, dy = clientY - lightboxStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) lightboxHasDragged = true;
        lightboxPanX = lightboxStartPanX + dx; lightboxPanY = lightboxStartPanY + dy;
        updateLightboxTransform();
    }
    function onPointerUp() { if (isLightboxDragging) { isLightboxDragging = false; updateLightboxTransform(); } }

    img.onmousedown = onPointerDown; window.onmousemove = onPointerMove; window.onmouseup = onPointerUp;
    img.ontouchstart = onPointerDown; window.ontouchmove = onPointerMove; window.ontouchend = onPointerUp;
}

function handleLightboxKeydown(e) {
    const modal = document.getElementById('lightbox-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') prevLightboxPhoto(e);
    else if (e.key === 'ArrowRight') nextLightboxPhoto(e);
    else if (e.key === 'Escape') closeLightbox();
}
window.removeEventListener('keydown', handleLightboxKeydown);
window.addEventListener('keydown', handleLightboxKeydown);

function openLightbox(imgSrc, caption = '', photoList = null, initialIndex = 0) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    if (!modal || !img) return;

    if (Array.isArray(photoList) && photoList.length > 0) {
        lightboxPhotos = photoList.map(item => typeof item === 'string' ? { src: item } : { src: item.src || item.img || item });
        lightboxCurrentIndex = Math.max(0, Math.min(initialIndex, lightboxPhotos.length - 1));
    } else {
        lightboxPhotos = [{ src: imgSrc }]; lightboxCurrentIndex = 0;
    }

    renderLightboxPhoto();
    modal.classList.remove('hidden');

    modal.onwheel = function(e) {
        e.preventDefault(); e.stopPropagation();
        const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
        lightboxScale = Math.min(Math.max(0.6, lightboxScale + zoomDelta), 4.0);
        if (lightboxScale <= 1) { lightboxPanX = 0; lightboxPanY = 0; }
        updateLightboxTransform();
    };

    initLightboxDragEvents(img);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleLightboxZoom(e) {
    if (e) e.stopPropagation();
    if (lightboxHasDragged) { lightboxHasDragged = false; return; }
    const img = document.getElementById('lightbox-img');
    if (!img) return;
    if (lightboxScale > 1) { lightboxScale = 1; lightboxPanX = 0; lightboxPanY = 0; }
    else { lightboxScale = 1.8; lightboxPanX = 0; lightboxPanY = 0; }
    updateLightboxTransform();
}

function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    lightboxScale = 1; lightboxPanX = 0; lightboxPanY = 0; isLightboxDragging = false; lightboxHasDragged = false;
    lightboxPhotos = []; lightboxCurrentIndex = 0;
    if (img) { img.style.transform = 'translate(0px, 0px) scale(1)'; img.onmousedown = null; img.ontouchstart = null; }
    window.onmousemove = null; window.onmouseup = null; window.ontouchmove = null; window.ontouchend = null;
    if (modal) { modal.onwheel = null; modal.classList.add('hidden'); }
}

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.toggleLightboxZoom = toggleLightboxZoom;
window.prevLightboxPhoto = prevLightboxPhoto;
window.nextLightboxPhoto = nextLightboxPhoto;
window.switchPartnerMode = switchPartnerMode;
window.openPortfolioEditor = openPortfolioEditor;
window.closePortfolioEditor = closePortfolioEditor;
window.renderPartnerConsolePortfolios = renderPartnerConsolePortfolios;
window.submitPartnerPortfolio = submitPartnerPortfolio;
window.openClientPartnerProfile = openClientPartnerProfile;
window.openPartnerPortfolioModal = openClientPartnerProfile;
window.setProfilePortfolioCategoryFilter = setProfilePortfolioCategoryFilter;
window.closeClientPartnerProfile = closeClientPartnerProfile;
window.openPortfolioBlogDetail = openPortfolioBlogDetail;
window.closePortfolioBlogDetail = closePortfolioBlogDetail;
window.getWeeklyBestPortfolioIds = getWeeklyBestPortfolioIds;
window.requestDirectQuoteFromPortfolio = requestDirectQuoteFromPortfolio;
window.renderPartnerProfileManager = renderPartnerProfileManager;
window.savePartnerProfileInfo = savePartnerProfileInfo;
window.triggerPartnerHeroImagePicker = triggerPartnerHeroImagePicker;
window.handlePartnerHeroImageUpload = handlePartnerHeroImageUpload;
window.nextPartnerHeroSlide = nextPartnerHeroSlide;
window.prevPartnerHeroSlide = prevPartnerHeroSlide;
window.jumpToPartnerHeroSlide = jumpToPartnerHeroSlide;
window.deleteCurrentPartnerHeroSlide = deleteCurrentPartnerHeroSlide;
window.openReviewDetailModal = openReviewDetailModal;
window.toggleReviewHelpful = toggleReviewHelpful;
window.isReviewHelpfulByMe = isReviewHelpfulByMe;
window.reportReview = reportReview;
window.isReviewReportedByMe = isReviewReportedByMe;
window.flagReviewAsPartner = flagReviewAsPartner;
window.reportReviewReply = reportReviewReply;
window.isReviewReplyReportedByMe = isReviewReplyReportedByMe;
window.reportPortfolio = reportPortfolio;
window.isPortfolioReportedByMe = isPortfolioReportedByMe;
window.isPortfolioSaved = isPortfolioSaved;
window.renderPortfolioQnaSection = renderPortfolioQnaSection;
window.submitPortfolioQuestion = submitPortfolioQuestion;
window.replyToPortfolioQuestion = replyToPortfolioQuestion;
window.deleteMyPortfolioQuestion = deleteMyPortfolioQuestion;
window.reportPortfolioQuestion = reportPortfolioQuestion;
window.toggleSavePortfolio = toggleSavePortfolio;
window.renderClientSavedPortfolios = renderClientSavedPortfolios;
window.closeReviewDetailModal = closeReviewDetailModal;
window.renderPartnerMyReviews = renderPartnerMyReviews;
window.updatePartnerPhone = updatePartnerPhone;
window.updatePartnerRegion = updatePartnerRegion;
window.updatePartnerBizFile = updatePartnerBizFile;
window.togglePartnerPauseStatus = togglePartnerPauseStatus;
window.renderPartnerNotificationPrefToggle = renderPartnerNotificationPrefToggle;
window.openStrikeAppealModal = openStrikeAppealModal;
window.closeStrikeAppealModal = closeStrikeAppealModal;
window.submitStrikeAppeal = submitStrikeAppeal;
window.renderPartnerStrikeAppealStatus = renderPartnerStrikeAppealStatus;
window.openPartnerReportAppealModal = openPartnerReportAppealModal;
window.closePartnerReportAppealModal = closePartnerReportAppealModal;
window.submitPartnerReportAppeal = submitPartnerReportAppeal;
window.renderPartnerReportedStatus = renderPartnerReportedStatus;
window.openInvalidatedBidAppealModal = openInvalidatedBidAppealModal;
window.closeInvalidatedBidAppealModal = closeInvalidatedBidAppealModal;
window.submitInvalidatedBidAppeal = submitInvalidatedBidAppeal;
window.renderPartnerInvalidatedBidsStatus = renderPartnerInvalidatedBidsStatus;
window.openPortfolioDeletionAppealModal = openPortfolioDeletionAppealModal;
window.closePortfolioDeletionAppealModal = closePortfolioDeletionAppealModal;
window.submitPortfolioDeletionAppeal = submitPortfolioDeletionAppeal;
window.renderPartnerPortfolioDeletionStatus = renderPartnerPortfolioDeletionStatus;
window.renderPartnerCertStatus = renderPartnerCertStatus;
window.renderPartnerBenefitsStatus = renderPartnerBenefitsStatus;
window.claimPartnerBenefit = claimPartnerBenefit;
window.togglePartnerNotificationPref = togglePartnerNotificationPref;
window.togglePartnerNotificationCategory = togglePartnerNotificationCategory;
window.updatePartnerPassword = updatePartnerPassword;
window.handlePartnerBizCertReupload = handlePartnerBizCertReupload;
window.openPartnerAccountCloseModal = openPartnerAccountCloseModal;
window.closePartnerAccountCloseModal = closePartnerAccountCloseModal;
window.confirmPartnerAccountClosure = confirmPartnerAccountClosure;
window.submitReviewReply = submitReviewReply;
window.removeReviewReply = removeReviewReply;
window.buildPortfolioCardMediaHtml = buildPortfolioCardMediaHtml;
window.triggerPortfolioImageInsert = triggerPortfolioImageInsert;
window.handlePortfolioBodyImageInsert = handlePortfolioBodyImageInsert;
window.removePortfolioBodyImage = removePortfolioBodyImage;
window.applyPortfolioEditorCommand = applyPortfolioEditorCommand;
window.insertPortfolioQuote = insertPortfolioQuote;
window.insertPortfolioDivider = insertPortfolioDivider;
window.updatePortfolioToolbarActiveState = updatePortfolioToolbarActiveState;
window.onPortfolioBodyEditorInput = onPortfolioBodyEditorInput;
window.portfolioToBodyHtml = portfolioToBodyHtml;
window.importPortfolioFromUrl = importPortfolioFromUrl;
window.movePortfolioBodyImage = movePortfolioBodyImage;
window.deletePartnerPortfolio = deletePartnerPortfolio;
window.movePartnerPortfolio = movePartnerPortfolio;
window.setPrimaryPortfolio = setPrimaryPortfolio;
window.handleBlogLikeClick = handleBlogLikeClick;
