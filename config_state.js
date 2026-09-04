/**
 * ====================================================================
 * [config_state.js] 기초 설정 프리셋, 글로벌 상태 저장소 및 가상 API
 * ====================================================================
 */

const CONFIG = {
    imageMoodPresets: {
        living: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=60',
        kitchen: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=60',
        bathroom: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&auto=format&fit=crop&q=60',
        bedroom: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&auto=format&fit=crop&q=60'
    },
    competitorPool: [
        { partner: '영도 인프라 인테리어', desc: '영도구 및 중구 상가 전문. 하자 보증 보험 이행 증권 전면 발행.' },
        { partner: '센텀 프리미엄 디자인', desc: '해운대구 고급 대리석 설계 전속 특화팀 보유. 시공 경력 20년.' },
        { partner: '부산진 종합건축디자인', desc: '부산진구 전역 아파트 전체 리모델링 전문. 가성비 극대화 설계.' },
        { partner: '금정 가온 디자인', desc: '금정구 친환경 도배/바닥재 특화 라이인 보유. 최단기 시공.' },
        { partner: '동래 명장 인테리어', desc: '동래구 전통 명가. 책임 시공 기능사 직접 직영 체제 운영.' }
    ]
};

window.AppState = {
    formData: {
        clientName: '',
        clientPhone: '',
        clientAddress: '',
        spaceType: 'residential',
        workType: 'all',
        pyung: 0,
        vacancy: 'empty',
        preferredDate: null,
        partnerCountLimit: 3,
        budget: 1500
    },
    clientAuth: {
        loggedIn: false,
        id: '',
        phone: '',
        name: '',
        sentCode: null,
        phoneVerified: false
    },
    currentPanel: 'client-panel',
    partnerLoggedIn: false,
    partnerName: '',
    managerLoggedIn: false,
    managerName: '',
    // 'super_admin'(전체 메뉴 접근) 또는 'partner_manager'(파트너 관련 메뉴만 접근, ROLE_TAB_ACCESS 참고)
    managerRole: null,
    partnerConsoleMode: 'orders',
    portfolioRegisterMode: 'manual',
    portfolioSubMode: 'list',
    activeReviewRating: 5,
    reviewOrderTarget: null,
    reviewPhotoDrafts: [],
    modalTabMode: 'portfolio',
    tempUploadedBizFile: null,
    selectedOrderCode: null,
    selectedMyPageOrderCode: null,
    editingPortfolioIndex: null,
    tempPortfolioImage: null,
    currentScenes: [],
    calendar: {
        year: 2026,
        month: 7
    },
    notifications: [],

    blacklistDb: [
        {
            company: '(주)바가지 날림 인프라',
            bizFile: '607-81-22904',
            phone: '010-9900-2211',
            reason: '2회 연속 금액 축소 이면계약서(다운계약) 적발 및 본사 소명 거부 은폐',
            date: '2026-07-10'
        },
        {
            company: '현장직거래 하우징',
            bizFile: '107-12-88741',
            phone: '010-4411-9988',
            reason: '안심 중개 플랫폼 우회 유도용 탈세 직거래 시도 클라이언트 제보 적발',
            date: '2026-07-15'
        },
        {
            company: '부산부실건설(주)',
            bizFile: '605-82-99120',
            phone: '010-3322-1100',
            reason: '무허가 재하도급 시공 및 하자 보수 이행증권 위조 제출 적발',
            date: '2026-07-18'
        },
        {
            company: '선금착복 스튜디오',
            bizFile: '211-86-55412',
            phone: '010-7788-2233',
            reason: '착공 선금 수령 후 현장 무단 이탈 및 연락 두절 (클라이언트 집단 제보)',
            date: '2026-07-22'
        },
        {
            company: '삼진아웃 옐로하우스',
            bizFile: '108-81-33211',
            phone: '010-6655-4433',
            reason: '누적 옐로카드 3회 초과 (불성실 저가 자재 임의 교체 2회 + 무단 착공 지연 1회)',
            date: '2026-07-29'
        }
    ],

    // 매니저 센터 로그인 계정. role에 따라 접근 가능한 콘솔 탭이 달라진다
    // (switchAdminMode의 ROLE_TAB_ACCESS 참고). 'super_admin'은 전체 메뉴,
    // 'partner_manager'는 파트너 모니터링/가입 심사/블랙리스트만 접근 가능하다.
    managers: [
        { id: 'admin', pw: '1234', name: '박서준 대표', role: 'super_admin' },
        { id: 'manager1', pw: '1234', name: '김민지 매니저', role: 'partner_manager' }
    ],

    partners: [
        {
            name: '오륙도 디자인 실내건축', id: 'orukdo', pw: '1234', bizFile: '602-23-45601',
            rating: 5.0, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true,
            portfolios: [
                {
                    title: '광안 쌍용예가 34평 내추럴 화이트 감성 하우스', pyung: 34, img: CONFIG.imageMoodPresets.living,
                    desc: '광안리 해변 조망을 극대화하면서 따뜻하고 자연스러운 원목 톤을 조화시킨 아늑한 화이트 인테리어 시공 사례입니다.',
                    likes: 24,
                    scenes: [
                        { id: 'scene-init-1', img: CONFIG.imageMoodPresets.living, text: '거실 전경 마감 디테일입니다. 전체 친환경 무몰딩 도배 마감 공법을 적용하여 군더더기 없는 확장감을 더하고, 원목 마루와 간접 조명 라인으로 우아함을 연출했습니다.' },
                        { id: 'scene-init-2', img: CONFIG.imageMoodPresets.kitchen, text: '주방 다이닝 구역입니다. 대리석 아일랜드 테이블과 빌트인 수납장을 깔끔하게 설치하여 주방 공간의 실용성과 디자인을 동시에 잡았습니다.' },
                        { id: 'scene-init-3', img: CONFIG.imageMoodPresets.bathroom, text: '욕실 공간입니다. 600각 수입 포셀린 타일과 무광 니켈 수전을 매치하여 호텔 같은 고급스러운 느낌을 연출했습니다.' }
                    ]
                },
                {
                    title: '센텀 스타클래스 프리미엄 다이닝 주방', pyung: 45, img: CONFIG.imageMoodPresets.kitchen,
                    desc: '최고급 가구 자재와 세련된 모노톤 설계를 결합하여 완성한 센텀 프리미엄 리모델링 주방 시공사례입니다.',
                    likes: 15,
                    scenes: [
                        { id: 'scene-init-4', img: CONFIG.imageMoodPresets.kitchen, text: '주방 조리대 영역의 졸리컷 타일 시공 디테일입니다. 수입 가스 후드 배관 가림 마감과 더불어 원목 다이닝 선반을 정합 연동하였습니다.' },
                        { id: 'scene-init-5', img: CONFIG.imageMoodPresets.bedroom, text: '마스터 침실 안쪽 드레스룸 동선 마감입니다. 템바보드 벽체 시공과 웜 화이트 간접 조명을 배치했습니다.' }
                    ]
                }
            ],
            reviews: [
                {
                    client: '김*은', rating: 5,
                    text: '광안 쌍용예가 34평 전체 리모델링을 오륙도 디자인 실내건축에 맡겼습니다! 처음 상담할 때부터 대표님이 현장 동선과 마감재 특성을 상세히 설명해 주셔서 정말 신뢰가 갔어요.',
                    date: '2026-06-12',
                    photos: [
                        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80',
                        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80'
                    ]
                }
            ]
        },
        {
            name: '영도 인프라 인테리어', id: 'youngdo', pw: '1234', bizFile: '214-82-01994',
            rating: 4.5, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true,
            portfolios: [
                {
                    title: '영도 해돋이마을 산토리니식 미니멀 욕실', pyung: 24, img: CONFIG.imageMoodPresets.bathroom,
                    desc: '테라조 타일과 블랙 수전 마감 배치로 그리스 감성 공간 연출. 벽체 젠다이 보강 공사 완벽 완료.',
                    likes: 8,
                    scenes: [{ id: 'scene-init-6', img: CONFIG.imageMoodPresets.bathroom, text: '젠다이 및 욕실 세면대 상세입니다.' }]
                }
            ],
            reviews: [{ client: '박*호', rating: 5, text: '영도 상가 인프라 전문답네요. 꼼꼼히 하자 체크해주시고 정액 중개수수료 투명보증도 아주 좋았습니다.', date: '2026-06-20' }]
        },
        {
            name: '센텀 프리미엄 디자인', id: 'centum', pw: '1234', bizFile: '105-82-44109',
            rating: 5.0, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true,
            portfolios: [
                {
                    title: '해운대 엘시티 하이엔드 마스터 침실', pyung: 62, img: CONFIG.imageMoodPresets.bedroom,
                    desc: '이탈리아 수입 포셀린 타일 마감 및 우물천장 전접 라인 간접 조명 설계.',
                    likes: 31,
                    scenes: [{ id: 'scene-init-8', img: CONFIG.imageMoodPresets.bedroom, text: '마스터 침실 침대 헤드보드 및 조명 시공 컷입니다.' }]
                }
            ],
            reviews: [{ client: '최*민', rating: 5, text: '명성에 걸맞는 완벽한 조도 계산과 자재 선정이었습니다.', date: '2026-06-05' }]
        },
        {
            name: '부산진 종합건축디자인', id: 'busanjin', pw: '1234', bizFile: '315-81-00124',
            rating: 4.7, strikeCount: 1, status: 'active', suspensionEndDate: null, isCertified: true,
            portfolios: [
                {
                    title: '서면 삼한골든뷰 32평 심플 화이트 우드 리모델링', pyung: 32, img: CONFIG.imageMoodPresets.living,
                    desc: '은은한 평천장 조도 설계와 우드 선반을 조화시킨 인테리어.',
                    likes: 19,
                    scenes: [{ id: 'scene-bj-1', img: CONFIG.imageMoodPresets.living, text: '거실 전경 마감 디테일입니다.' }]
                }
            ],
            reviews: [{ client: '김*현', rating: 5, text: '하자보수도 신속하게 와서 검사해주셨습니다.', date: '2026-06-18' }]
        },
        { name: '금정 가온 디자인', id: 'gaeon', pw: '1234', bizFile: '112-24-99801', rating: 4.6, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },
        { name: '동래 명장 인테리어', id: 'myeongjang', pw: '1234', bizFile: '607-81-00214', rating: 4.9, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },
        { name: '해운대 마린 디자인데크', id: 'marine', pw: '1234', bizFile: '605-88-12345', rating: 4.9, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },
        { name: '수영 스페이스 하우징', id: 'suyeong', pw: '1234', bizFile: '617-81-99881', rating: 4.8, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },
        { name: '연제 더샵 아키텍처', id: 'yeonje', pw: '1234', bizFile: '602-86-77112', rating: 4.7, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },
        { name: '사상 서부산 스튜디오', id: 'sasang', pw: '1234', bizFile: '609-82-33445', rating: 4.6, strikeCount: 0, status: 'active', suspensionEndDate: null, isCertified: true, portfolios: [], reviews: [] },

        // 입점 신청 후 매니저 승인을 기다리는 파트너 예시 (status: 'pending'). 승인/거절은
        // 매니저 콘솔 > 파트너 가입 심사 탭에서 처리한다 (approvePartnerApplication/rejectPartnerApplication 참고).
        {
            name: '해운대 클래스 인테리어', id: 'haeundaeclass', pw: 'temp1234', bizFile: '621-05-77812',
            phone: '010-2233-9981', rating: 5.0, strikeCount: 0, status: 'pending', suspensionEndDate: null, isCertified: false,
            appliedAt: '2026.09.02 14:20',
            bizCertDoc: { name: '사업자등록증_해운대클래스.jpg', uploadedAt: '2026.09.02 14:20', dataUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop&q=80' },
            portfolios: [], reviews: []
        }
    ],

    orders: [
        { code: 'WJ-2026-0801H', clientName: '강태원', clientPhone: '010-8877-1122', clientAddress: '부산광역시 해운대구 중동 엘시티 더샵 101동 5201호', spaceType: 'residential', workType: 'all', pyung: 68, vacancy: 'empty', preferredDate: '2026-08-25', partnerCountLimit: 5, budget: 12000, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0802H', clientName: '윤지민', clientPhone: '010-7711-2233', clientAddress: '부산광역시 남구 용호동 W 아파트 102동 4103호', spaceType: 'residential', workType: 'all', pyung: 53, vacancy: 'empty', preferredDate: '2026-09-01', partnerCountLimit: 3, budget: 9500, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0803H', clientName: '최성훈', clientPhone: '010-9944-5566', clientAddress: '부산광역시 해운대구 우동 센텀시티 대우월드마크 103동 2802호', spaceType: 'residential', workType: 'all', pyung: 58, vacancy: 'empty', preferredDate: '2026-09-05', partnerCountLimit: 5, budget: 8800, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0804H', clientName: '박서현', clientPhone: '010-3388-9900', clientAddress: '부산광역시 해운대구 마린시티3로 두산위브더제니스 101동 6502호', spaceType: 'residential', workType: 'all', pyung: 65, vacancy: 'empty', preferredDate: '2026-09-10', partnerCountLimit: 5, budget: 15000, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0805H', clientName: '임동현', clientPhone: '010-6622-4411', clientAddress: '부산광역시 강서구 명지국제신도시 에코델타 메디컬타워 3층 301호', spaceType: 'commercial', workType: 'all', pyung: 45, vacancy: 'empty', preferredDate: '2026-08-28', partnerCountLimit: 3, budget: 7800, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0806H', clientName: '한유진', clientPhone: '010-1122-9988', clientAddress: '부산광역시 수영구 남천동 삼익비치타운 301동 1201호', spaceType: 'residential', workType: 'all', pyung: 42, vacancy: 'empty', preferredDate: '2026-09-15', partnerCountLimit: 3, budget: 8200, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0807H', clientName: '정재민', clientPhone: '010-5544-3322', clientAddress: '부산광역시 금정구 구서동 롯데캐슬 1단지 108동 1902호', spaceType: 'residential', workType: 'all', pyung: 50, vacancy: 'empty', preferredDate: '2026-09-20', partnerCountLimit: 3, budget: 7500, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0808H', clientName: '송아름', clientPhone: '010-2233-8899', clientAddress: '부산광역시 연제구 거제동 아시아드코오롱하늘채 105동 2203호', spaceType: 'residential', workType: 'all', pyung: 48, vacancy: 'empty', preferredDate: '2026-09-25', partnerCountLimit: 3, budget: 8500, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0809H', clientName: '배성민', clientPhone: '010-7766-5544', clientAddress: '부산광역시 동래구 온천동 래미안포레스티지 204동 3101호', spaceType: 'residential', workType: 'all', pyung: 52, vacancy: 'empty', preferredDate: '2026-10-01', partnerCountLimit: 5, budget: 9000, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0810H', clientName: '조경수', clientPhone: '010-9911-3355', clientAddress: '부산광역시 남구 문현동 국제금융단지 BIFC 타워 12층 전관', spaceType: 'commercial', workType: 'all', pyung: 60, vacancy: 'empty', preferredDate: '2026-10-10', partnerCountLimit: 5, budget: 11000, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [], bids: [], isHighBudgetAdminPending: true, contractDoc: null, estimateDoc: null },

        { code: 'WJ-2026-0625A', clientName: '안선우', clientPhone: '010-9988-7766', clientAddress: '부산광역시 수영구 광안동 광안리안안 아파트 104동 502호', spaceType: 'residential', workType: 'all', pyung: 32, vacancy: 'empty', preferredDate: '2026-07-21', partnerCountLimit: 3, budget: 3500, status: 'bidding', contractUploaded: false, commissionPaid: false, reviewWritten: false, acceptedPartner: null, finalPrice: 0, excludedPartners: [],
            bids: [{ partner: '영도 인프라 인테리어', price: 3200, desc: '부산 영도구 인프라 전문 실내건축 종합면허 보유사.', verified: true, progress: 'bidding' }], contractDoc: null, estimateDoc: null },
        { code: 'WJ-2026-0711L', clientName: '박민서', clientPhone: '010-3456-7890', clientAddress: '부산광역시 수영구 민락동 푸르지오 102동 1104호', spaceType: 'residential', workType: 'all', pyung: 32, vacancy: 'empty', preferredDate: '2026-07-28', partnerCountLimit: 3, budget: 3500, status: 'contracted', contractUploaded: true, commissionPaid: true, reviewWritten: false, acceptedPartner: '오륙도 디자인 실내건축', finalPrice: 3400, excludedPartners: [],
            bids: [{ partner: '오륙도 디자인 실내건축', price: 3400, desc: '귀사의 최종 안심 계약 완료 이력입니다.', verified: true, progress: 'completed' }], contractDoc: null, estimateDoc: null }
    ],

    kpis: { gmv: 3400, escrow: 0, revenue: 102 },
    logs: [
        { time: '09:00:00', category: 'SYSTEM', target: 'ENGINE', message: '우리집 안심 중개 및 매니저 관제 시스템 구동 완료.', status: 'SUCCESS' }
    ],

    // 히어로 좌측 "업체 광고" 슬라이더에 수동으로 지정한 업체+시공사례 목록 (최대 5개, [{partnerName, portIdx}]).
    // 비어있으면 평점 높은 순으로 자동 노출된다 (getFeaturedHeroSlides 참고). 매니저 콘솔 > 노출 관리에서 편집.
    featuredPartners: [],

    // 히어로 우측 이벤트 슬라이더(광고판)에 노출되는 팜플렛 목록. 매니저 콘솔 > 노출 관리에서 추가/수정/삭제.
    pamphlets: [
        {
            id: 'evt-pamphlet-1', title: '🎁 첫 견적 신청 고객 100% 혜택',
            img: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
            btnText: '무료 안심 견적 신청하기', actionPanel: 'client-panel',
            detail: '휴대폰 안심 본인인증 완료 후 인테리어 의뢰서 등록 시 신세계 모바일 상품권 5만원권을 100% 전원 증정합니다. 또한 계약 체결 시 3년 하자이행보증 무상 가입 쿠폰이 함께 제공되어, 공종별 하자 보수를 수수료 부담 없이 무상으로 보증받으실 수 있습니다.\n\n본 프로모션은 부산 지역 인테리어 안심 계약 촉진을 위하여 본사 및 부산 1군 안심 파트너스가 100% 공동 지원합니다.'
        },
        {
            id: 'evt-pamphlet-2', title: '📸 완공 포토 후기 작성 페스티벌',
            img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80',
            btnText: '마이페이지에서 후기 작성하기', actionPanel: 'client-mypage-panel',
            detail: '공사 마감 후 마이페이지에서 고화질 현장 사진 3장 이상과 50자 이상의 솔직한 후기를 남겨주시면 신세계/롯데 백화점 모바일 상품권 10만원을 검수 후 전원 증정합니다.\n\n매월 우수 베스트 후기로 선정된 3분께는 전문 작가의 완공 공간 화보집 촬영과 고급 액자를 선물로 드립니다.'
        },
        {
            id: 'evt-pamphlet-3', title: '⚡ 1:1 우수 파트너 지정 상담 이벤트',
            img: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
            btnText: '우수 파트너사 탐색하기', actionPanel: 'partner-search-panel',
            detail: '부산 1군 인증 우수 파트너를 전속으로 지정하시면 현장 감리 및 전문 자재 컨설팅 수수료를 본사가 전액 지원합니다. 타사 경쟁 없이 지정하신 대표 시공사의 마스터가 24시간 이내 직접 1:1 맞춤 가견적으로 답변을 드립니다.\n\n실내건축 종합면허 보유사와의 프리미엄 1:1 전속 상담으로 불필요한 중개 피로도를 없앴습니다.'
        }
    ]
};

window.AppState.clientAccounts = [
    { id: 'busanhome', pw: '1234', name: '김도경', phone: '010-1234-5678' }
];

window.CONFIG = CONFIG;
window.APIService = {
    apiKey: "",
    async fetchOrders() {
        return window.AppState.orders;
    },
    async submitBidToDb(orderCode, bidPayload) {
        const order = window.AppState.orders.find(o => o.code === orderCode);
        if (!order) throw new Error("존재하지 않는 주문입니다.");
        order.bids.push(bidPayload);
        return { success: true };
    }
};
