/* Home navigation and quote intent; no backend or paid services. */
const HOME_INTENT_KEY = 'spacelink-home-intent-v1';
function readHomeIntent() {
    try { return JSON.parse(sessionStorage.getItem(HOME_INTENT_KEY) || 'null'); } catch (_) { return window.AppState.homeQuoteIntent || null; }
}
function rememberHomeIntent(intent) {
    window.AppState.homeQuoteIntent = intent;
    try { sessionStorage.setItem(HOME_INTENT_KEY, JSON.stringify(intent)); } catch (_) {}
}
function startHomeQuote(category) {
    const value = id => document.getElementById(id)?.value || '';
    const intent = {region:value('home-search-region'),space:category || value('home-search-space'),budget:value('home-search-budget'),pending:true};
    rememberHomeIntent(intent);
    switchPanel('client-panel');
}
function applyHomeQuoteIntent() {
    const intent = readHomeIntent();
    if (!intent) return;
    if (intent.pending && window.AppState.currentPanel === 'client-panel') {
        const kind = intent.space === '상가/사무실' ? 'commercial' : intent.space ? 'residential' : null;
        if (kind) updateFormState('spaceType',kind);
        intent.pending=false;
        rememberHomeIntent(intent);
    }
    const summary = [intent.region && '부산 '+intent.region,intent.space,intent.budget].filter(Boolean).join(' · ');
    for (const id of ['home-quote-intent','home-login-intent']) {
        const box=document.getElementById(id);
        if (box) {box.hidden=!summary;box.textContent=summary ? '홈에서 선택한 조건: '+summary+' — 상세 주소와 정확한 예산은 신청서에서 확인해 주세요.' : '';}
    }
    const address=document.getElementById('client-address');
    if(address && intent.region) address.placeholder='부산 '+intent.region+'의 상세 주소를 입력하세요';
}
function syncHomeAccount() {
    const auth=window.AppState.clientAuth || {};
    const first=document.getElementById('home-account-primary'),second=document.getElementById('home-account-secondary');
    if(first){first.textContent=auth.loggedIn?'마이페이지':'로그인';first.onclick=()=>auth.loggedIn?switchPanel('client-mypage-panel'):handleClientLoginNavClick();}
    if(second){second.textContent=auth.loggedIn?'로그아웃':'회원가입';second.onclick=()=>{if(auth.loggedIn)performClientLogout();else {switchPanel('client-login-panel');switchClientAuthTab('signup');}};}
}
function openHomeCommunity(category) {
    switchPanel('community-panel');
    for(const id of ['community-detail-subview','community-write-subview'])document.getElementById(id)?.classList.add('hidden');
    document.getElementById('community-list-subview')?.classList.remove('hidden');
    const search=document.getElementById('community-search-input');if(search)search.value='';
    document.getElementById('community-search-input-clear')?.classList.add('hidden');
    setCommunityCategory(category);
    window.scrollTo({top:0,behavior:'instant'});
}
function openHomeCasePreview(category) {
    const photos={'아파트':'apartment','빌라/주택':'villa','오피스텔':'officetel','상가/사무실':'commercial','리모델링':'remodel'};
    if(!photos[category])return;
    const dialog=document.getElementById('home-case-preview');
    const photo=document.getElementById('home-case-preview-photo');
    photo.className='sl-preview-photo sl-photo sl-photo--'+photos[category];
    photo.setAttribute('aria-label',category+' 인테리어 참고 이미지');
    document.getElementById('home-case-preview-title').textContent=category+' 공간 둘러보기';
    document.getElementById('home-case-preview-quote').onclick=()=>{dialog.close();startHomeQuote(category);};
    dialog.showModal();
}
function openHomeCases(){switchPanel('cases-panel');window.scrollTo({top:0,behavior:'instant'});}
Object.assign(window,{startHomeQuote,applyHomeQuoteIntent,syncHomeAccount,openHomeCommunity,openHomeCasePreview,openHomeCases});
syncHomeAccount();applyHomeQuoteIntent();
