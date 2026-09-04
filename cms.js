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
    const tabs = { orders: 'btn-partner-view-orders', contracts: 'btn-partner-view-contracts', portfolio: 'btn-partner-view-portfolio', myinfo: 'btn-partner-view-myinfo' };
    const views = { orders: 'partner-mode-orders-view', contracts: 'partner-mode-contracts-view', portfolio: 'partner-mode-portfolio-view', myinfo: 'partner-mode-myinfo-view' };

    Object.values(tabs).forEach(id => document.getElementById(id)?.classList.remove('active'));
    Object.values(views).forEach(id => document.getElementById(id)?.classList.add('hidden'));

    document.getElementById(tabs[mode])?.classList.add('active');
    document.getElementById(views[mode])?.classList.remove('hidden');

    if (mode === 'orders' && typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
    else if (mode === 'contracts' && typeof renderPartnerContractsView === 'function') renderPartnerContractsView();
    else if (mode === 'myinfo') renderPartnerProfileManager();
    else if (mode === 'portfolio') renderPartnerConsolePortfolios();

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

function applyPortfolioEditorCommand(cmd) {
    const editor = document.getElementById('portfolio-body-editor');
    if (!editor) return;
    editor.focus();
    try { document.execCommand(cmd, false, null); } catch (err) { /* no-op */ }
    onPortfolioBodyEditorInput();
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

/* 굵게/기울임/밑줄 버튼은 삭제됐다 — 남아있는 정렬 버튼들은 활성 상태를 표시하지
 * 않으므로 이 함수는 더 할 일이 없다. HTML의 oninput/onkeyup/onmouseup 훅에서
 * 여전히 호출되므로 자리만 남겨둔다. */
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

function submitPartnerPortfolio() {
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
        bodyHtml
    };

    if (editIndex !== null) partner.portfolios[editIndex] = newPort;
    else partner.portfolios.unshift(newPort);

    if (typeof pushLog === 'function') pushLog('PARTNER', 'PORTFOLIO', `[${partnerName}]가 포트폴리오 "${title}"를 발행했습니다.`, 'SUCCESS');
    showToast('포트폴리오가 발행되었습니다!', 'success');
    closePortfolioEditor();
    if (typeof renderHeroPortfolioSlider === 'function') renderHeroPortfolioSlider();
    if (typeof renderPartnerSearchGrid === 'function') renderPartnerSearchGrid();
}

function renderPartnerProfileManager() {
    const partnerName = window.AppState.partnerName || '오륙도 디자인 실내건축';
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) return;

    if (!partner.heroImages || partner.heroImages.length === 0) partner.heroImages = ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=60'];
    if (typeof partner.heroSlideIndex !== 'number') partner.heroSlideIndex = 0;
    if (partner.heroSlideIndex >= partner.heroImages.length) partner.heroSlideIndex = 0;

    safeUpdateValue('partner-promo-slogan', partner.promoSlogan || '');
    safeUpdateValue('partner-promo-text', partner.promoText || '');

    const img = document.getElementById('partner-hero-slide-img');
    if (img) img.src = partner.heroImages[partner.heroSlideIndex];
    safeUpdateText('partner-hero-slide-counter', `${partner.heroSlideIndex + 1} / ${partner.heroImages.length}`);
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
            <div class="portfolio-img" onclick="openPortfolioBlogDetail('${partner.name}', ${idx})">${buildPortfolioCardMediaHtml(item)}</div>
            <div class="p-4 space-y-1.5">
                <h5 class="font-black text-ink-950 text-xs line-clamp-1">${item.title}</h5>
                <p class="text-[10px] text-ink-500 line-clamp-2">${item.desc || ''}</p>
                <div class="flex justify-between items-center pt-2 border-t border-ink-100 mt-1">
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="event.stopPropagation();openPortfolioEditor(${idx})" class="btn btn-ghost btn-sm px-1.5">수정</button>
                        <button type="button" onclick="event.stopPropagation();deletePartnerPortfolio(${idx})" class="btn btn-ghost btn-sm px-1.5 text-roseCustom">삭제</button>
                    </div>
                    <span class="text-[10px] text-ink-400 font-bold">♡ ${item.likes || 0}</span>
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

    const baseOrder = userOrders[0];
    const existingBid = baseOrder.bids.find(b => b.partner === partnerName);
    if (existingBid) {
        showToast(`이미 [${partnerName}] 파트너사의 견적이 신청서(${baseOrder.code})에 포함되어 있습니다.`, "info");
        if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
        if (typeof selectMyPageEstimate === 'function') selectMyPageEstimate(baseOrder.code);
        closeClientPartnerProfile(); closePortfolioBlogDetail();
        return;
    }

    baseOrder.bids.push({
        partner: partnerName,
        price: Math.floor(baseOrder.budget * 0.96),
        desc: `[1:1 전속 지정 상담] ${partnerName}에서 고객님의 실거주/공실 정보(${baseOrder.pyung}평형, 예산 ₩ ${baseOrder.budget.toLocaleString()}만원)를 바탕으로 전속 가견적서 및 단독 자재 컨설팅안을 발송했습니다.`,
        verified: true, progress: 'bidding'
    });

    closeClientPartnerProfile(); closePortfolioBlogDetail();
    if (typeof pushLog === 'function') pushLog('CLIENT', '1ON1_REQUEST', `[${auth.name}] 고객님이 기존 신청서(${baseOrder.code})에 [${partnerName}] 파트너를 1:1 단독 지정함.`, 'SUCCESS');
    showToast(`⚡ 작성하신 견적서(${baseOrder.code})에 [${partnerName}] 1:1 전속 지정 상담이 성공적으로 연결되었습니다!`, 'success');

    if (typeof switchPanel === 'function') switchPanel('client-mypage-panel');
    if (typeof renderClientMyPage === 'function') renderClientMyPage();
    if (typeof selectMyPageEstimate === 'function') selectMyPageEstimate(baseOrder.code);
    if (typeof renderPartnerOrderList === 'function') renderPartnerOrderList();
}

function openClientPartnerProfile(partnerName) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner) { console.warn(`Partner '${partnerName}' not found in AppState.partners`); return; }

    safeUpdateText('profile-partner-name', partner.name);
    safeUpdateText('profile-partner-name-hero', partner.name);
    safeUpdateText('profile-partner-slogan-hero', partner.promoSlogan || `${partner.name} - 부산 우수 안심 파트너`);
    safeUpdateText('profile-partner-promo-hero', partner.promoText || '하자보증 무상 3년 지원 대상 기업');
    safeUpdateText('profile-rating-avg', partner.rating ? partner.rating.toFixed(1) : "5.0");

    const hero1on1Btn = document.getElementById('profile-hero-1on1-btn');
    if (hero1on1Btn) hero1on1Btn.onclick = () => requestDirectQuoteFromPortfolio(partner.name, 0);

    const portGrid = document.getElementById('profile-portfolios-grid');
    if (portGrid) {
        portGrid.innerHTML = '';
        if (partner.portfolios && partner.portfolios.length > 0) {
            partner.portfolios.forEach((port, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "portfolio-card text-left group";
                itemDiv.onclick = (e) => { e.stopPropagation(); openPortfolioBlogDetail(partner.name, idx); };
                itemDiv.innerHTML = `
                    <div class="portfolio-img">${buildPortfolioCardMediaHtml(port)}</div>
                    <div class="p-4 space-y-1.5">
                        <h5 class="font-black text-ink-950 text-xs truncate group-hover:text-ink-600 transition-colors">${port.title}</h5>
                        <p class="text-[11px] text-ink-500 font-medium line-clamp-2 leading-relaxed">${port.desc || ''}</p>
                        <div class="flex items-center justify-between pt-1.5 mt-0.5 border-t border-ink-100">
                            <span class="text-[10px] text-ink-400 font-bold">♡ ${port.likes || 0}</span>
                            <span class="text-[10px] text-ink-800 font-extrabold group-hover:underline">자세히 보기 →</span>
                        </div>
                    </div>`;
                portGrid.appendChild(itemDiv);
            });
        } else {
            portGrid.innerHTML = `<p class="text-xs text-ink-400 font-bold py-8 text-center col-span-full">등록된 시공 사례가 없습니다.</p>`;
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
                        <div class="flex items-center gap-1.5 font-extrabold text-ink-950"><span class="w-1.5 h-1.5 rounded-full bg-ink-800"></span><span>${rev.client} 고객님</span></div>
                        <span class="text-gold-500 font-extrabold text-xs">${fullStars}${emptyStars} <span class="text-ink-800 text-[10px] ml-0.5">(${rev.rating}.0)</span></span>
                    </div>
                    <p class="text-xs text-ink-700 font-medium leading-relaxed line-clamp-3">${rev.text}</p>
                    ${photosHtml}
                    <div class="flex justify-between items-center pt-2 border-t border-ink-100 text-[10px] text-ink-400 font-semibold">
                        <span>작성일: ${rev.date}</span><span class="text-ink-800 font-extrabold group-hover:underline">자세히 보기 →</span>
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

    openModal('review-detail-modal', 'review-detail-modal-card');
}

function closeReviewDetailModal() { closeModal('review-detail-modal', 'review-detail-modal-card'); }
function closeClientPartnerProfile() { closeModal('client-partner-profile-modal', 'client-partner-profile-modal-card'); }

function openPortfolioBlogDetail(partnerName, idx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (!partner || !partner.portfolios[idx]) return;
    const port = partner.portfolios[idx];
    _blogDetailContext = { partnerName, idx };

    safeUpdateText('blog-modal-partner-name', partnerName);
    safeUpdateText('blog-modal-pyung', `${port.pyung}평형 시공 사례`);
    safeUpdateText('blog-modal-title', port.title);
    safeUpdateText('blog-modal-overview', port.desc || '');

    const catLabel = PORTFOLIO_CATEGORY_LABELS[port.category] || '';
    const catBadge = document.getElementById('blog-modal-category-badge');
    if (catBadge) { catBadge.textContent = catLabel; catBadge.classList.toggle('hidden', !catLabel); }

    renderBlogLikeButton(port.likes || 0);

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
        showToast('❤️ 좋아요가 반영되었습니다!', 'success');
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

function toggleLikePortfolio(partnerName, idx) {
    const partner = window.AppState.partners.find(p => p.name === partnerName);
    if (partner && partner.portfolios[idx]) partner.portfolios[idx].likes = (partner.portfolios[idx].likes || 0) + 1;
    showToast("❤️ 좋아요가 반영되었습니다!", "success");
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
window.closeClientPartnerProfile = closeClientPartnerProfile;
window.openPortfolioBlogDetail = openPortfolioBlogDetail;
window.closePortfolioBlogDetail = closePortfolioBlogDetail;
window.requestDirectQuoteFromPortfolio = requestDirectQuoteFromPortfolio;
window.renderPartnerProfileManager = renderPartnerProfileManager;
window.savePartnerProfileInfo = savePartnerProfileInfo;
window.triggerPartnerHeroImagePicker = triggerPartnerHeroImagePicker;
window.handlePartnerHeroImageUpload = handlePartnerHeroImageUpload;
window.nextPartnerHeroSlide = nextPartnerHeroSlide;
window.prevPartnerHeroSlide = prevPartnerHeroSlide;
window.deleteCurrentPartnerHeroSlide = deleteCurrentPartnerHeroSlide;
window.openReviewDetailModal = openReviewDetailModal;
window.closeReviewDetailModal = closeReviewDetailModal;
window.toggleLikePortfolio = toggleLikePortfolio;
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
window.handleBlogLikeClick = handleBlogLikeClick;
