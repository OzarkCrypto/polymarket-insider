export async function GET() {
  // ========================================
  // 내부정보 활용 가능 마켓 필터링
  // 관점: "누가 미리 알 수 있는가?"
  // ========================================
  
  const INSIDER_KEYWORDS = [
    // ===== 1. 기업 내부자 (임원, 이사회, 직원, IB) =====
    
    // M&A/인수합병 - 딜팀, 법무팀, IB, 양사 임원
    'acquisition', 'acquire', 'acquires', 'acquired', 'merger', 'merge',
    'buyout', 'takeover', 'buy ', 'sell ', 'sale', 'divest',
    
    // IPO/상장 - CFO, IB, SEC, 거래소
    'ipo', 'go public', 'goes public', 'public offering', 'direct listing',
    
    // 임원 변경 - 이사회, HR, 헤드헌터
    'ceo', 'chief executive', 'step down', 'resign', 'fired', 'replaced',
    'new ceo', 'out as', 'leave', 'depart', 'retire',
    
    // 제품 출시 - PM, 개발팀, 마케팅
    'release', 'released', 'launch', 'launched', 'announce', 'announced',
    'ship', 'debut', 'unveil', 'reveal', 'available', 'coming soon',
    
    // 파트너십/계약 - BD팀, 법무팀
    'partner', 'partnership', 'deal', 'contract', 'agreement', 'collaboration',
    'exclusive', 'integrate',
    
    // 구조조정 - 경영진, HR
    'shutdown', 'discontinue', 'close', 'terminate', 'wind down',
    'restructur', 'layoff', 'lay off', 'workforce reduction',
    'bankruptcy', 'chapter 11', 'insolvent',
    
    // 실적/재무 - CFO, 감사팀, IR
    'earnings', 'revenue', 'profit', 'guidance', 'forecast',
    
    // ===== 2. 정부/규제기관 (공무원, 위원, 정책 담당자) =====
    
    // 중앙은행 - FOMC 위원, 연준 직원, ECB
    'rate cut', 'rate hike', 'fomc', 'fed ', 'interest rate',
    'bank of england', 'ecb', 'central bank', 'monetary policy',
    'quantitative', 'tightening', 'easing',
    
    // 규제 승인/거부 - FDA, SEC, FTC, FCC 직원
    'approve', 'approved', 'approval', 'reject', 'block', 'ban',
    'fine', 'antitrust', 'regulate', 'regulation',
    'fda approv', 'fda clear', 'drug approv', 'clinical trial',
    'phase 3', 'phase 2', 'clinical result',
    'forced to', 'required to', 'must ', 'mandate',
    
    // 인사 지명 - 백악관, 인사청, 상원
    'nominate', 'nomination', 'appointee', 'appointment',
    'confirmed as', 'appointed', 'nominated',
    'cabinet', 'secretary', ' chair', 'chairman', 'director',
    'fed chair', 'treasury secretary', 'attorney general',
    'ambassador', 'commissioner',
    
    // 정책/법안 - 의회 스태프, 위원회
    'bill', 'legislation', 'law passed', 'signed into law',
    'executive order', 'tariff', 'sanction',
    
    // ===== 3. 사법/수사 (검찰, 법원, FBI, DOJ) =====
    
    // 기소/체포 - 검찰, FBI, DOJ
    'indicted', 'arrested', 'charged', 'prosecute',
    'investigation', 'probe', 'inquiry', 'subpoena',
    
    // 재판/판결 - 법원, 판사 보좌관
    'verdict', 'trial', 'guilty', 'acquitted', 'convicted',
    'sentenced', 'jail', 'prison', 'plea deal',
    
    // 문서 공개 - 법원 서기, FOIA 담당
    'files', 'documents', 'declassif', 'unseal', 'sealed',
    'named in', 'implicated', 'accused', 'linked to',
    'testimony', 'deposition',
    
    // 합의/소송 - 법무팀
    'settlement', 'lawsuit', 'sue', 'legal action',
    
    // 고프로필 수사 - 수사팀, 피해자측
    'epstein', 'diddy', 'weinstein', 'scandal',
    
    // ===== 4. 기술/AI (연구팀, PM, 엔지니어) =====
    
    // AI 모델 - OpenAI, Google, Anthropic, Meta 내부
    'gpt', 'gpt-4', 'gpt-5', 'gpt-6', 'chatgpt',
    'claude', 'gemini', 'llama', 'mistral',
    'frontier model', 'foundation model', 'agi',
    'model release', 'model launch',
    
    // 제품 기능 - PM, 개발팀
    'feature', 'update', 'version', 'upgrade',
    'beta', 'alpha', 'early access',
    
    // 앱스토어 - 앱 개발사, 애플 피처드팀
    'app store', '#1 app', '1 app', 'top app', 'free app', 'paid app',
    
    // 해킹/보안 - 보안팀, 화이트햇
    'hack', 'hacked', 'exploit', 'breach', 'vulnerability',
    'outage', 'incident', 'downtime',
    
    // ===== 5. 금융/크립토 (거래소, 발행사, VC) =====
    
    // ETF 승인 - SEC, 신청 회사
    ' etf', 'etf ', 'spot etf', 'etf approv', 'etf filing',
    
    // 스테이블코인 - 발행사, 감사팀
    'depeg', 'usdt ', 'usdc ', 'tether ',
    
    // 에어드랍/토큰 - 프로젝트팀, VC
    'airdrop', 'token launch', 'listing',
    
    // 신용등급 - Moody's, S&P, Fitch
    'downgrade', 'upgrade rating', 'credit rating',
    
    // ===== 5.5 크립토 거버넌스 (코어팀, 대형 홀더, 재단) =====
    
    // 거버넌스 투표 - DAO 코어팀, 대형 토큰 홀더, 재단
    'governance', 'proposal', 'vote', 'voting', 'dao ',
    ' dao', 'token holder', 'alignment', 'snapshot',
    'on-chain vote', 'governance vote', 'pass proposal',
    
    // 주요 DeFi 프로토콜 - 코어팀, 멀티시그 홀더
    'aave', 'uniswap', 'compound', 'makerdao', 'maker ',
    'curve', 'lido', 'arbitrum', 'optimism', 'polygon',
    'chainlink', 'synthetix', 'yearn', 'sushi', 'balancer',
    'frax', 'convex', 'gmx', 'dydx', 'jupiter', 'jito',
    
    // 프로토콜 업그레이드 - 코어 개발팀
    'upgrade proposal', 'protocol upgrade', 'hard fork',
    'tokenomics', 'fee switch', 'revenue share',
    
    // ===== 6. 엔터테인먼트/미디어 (스튜디오, 레이블) =====
    
    // 영화/TV - 스튜디오, 네트워크
    'cancel', 'cancelled', 'renewed', 'season ',
    'box office', 'streaming', 'premiere',
    'rotten tomatoes', 'imdb',
    
    // 게임 - 개발사, 퍼블리셔
    'gta 6', 'gta vi', 'game release', 'game delay', 'game launch',
    
    // 음악 - 레이블, 매니저
    'album', 'tour', 'concert',
    
    // 시상식 - 투표위원, 아카데미
    'oscar', 'grammy', 'emmy', 'golden globe', 'award',
    
    // ===== 7. 스포츠 (에이전트, 팀 프런트) =====
    
    // 계약/이적 (에이전트, GM)
    'trade', 'sign', 'contract extension', 'free agent',
    
    // 은퇴/복귀
    'retire', 'retirement', 'comeback',
  ];

  // ========== 제외 키워드 (Insider 가치 낮거나 관심 없는 분야) ==========
  // 정치인 이름 - 인사 지명 마켓은 제외하지 않음 (SOFT_EXCLUDE)
  const SOFT_EXCLUDE_KEYWORDS = [
    'trump', 'biden', 'harris', 'desantis', 'president', 'election', 'vote',
    'congress', 'senate', 'democrat', 'republican', 'gop', 'ballot',
    'governor', 'mayor', 'politician', 'political', 'impeach', 'pardon',
    'presidential', '2028', '2032',
    'prime minister', ' pm ', 'starmer', 'poilievre', 'sanchez', 'sánchez',
    'maduro', 'trudeau', 'macron', 'scholz', 'modi', 'netanyahu',
    'kim jong', 'supreme leader', 'parliament', 'citizenship',
    'conservatives', 'labour', 'liberal', 'referendum', 'afd',
  ];
  
  // 절대 제외 - INSIDER 키워드가 있어도 제외
  const EXCLUDE_KEYWORDS = [
    // 자연현상 (예측 불가)
    'hottest year', 'temperature', 'weather', 'climate', 'earthquake',
    'hurricane', 'tornado', 'flood',
    // 스포츠 추가
    'verstappen', 'red bull', 'formula', 'f1 ',
    // 국제관계/전쟁
    'war ', 'ukraine', 'russia', 'putin', 'zelensky', 'nato',
    'xi jinping', 'iran ', 'israel', 'gaza', 'palestine',
    'hamas', 'hezbollah', 'military', 'troops', 'missile',
    'ceasefire', 'invasion', 'nuclear weapon', 'khamenei',
    // 스포츠
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ufc', 'wwe', 'pga', 'atp', 'wta',
    'super bowl', 'world series', 'stanley cup', 'world cup',
    'championship', 'playoffs', 'finals', 'semifinal',
    'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
    'champions league', 'europa league', 'poker',
    'football', 'basketball', 'baseball', 'hockey', 'soccer', 'tennis',
    'golf', 'boxing', 'mma', 'f1 ', 'formula 1', 'nascar', 'olympics',
    'lebron', 'messi', 'ronaldo', 'curry', 'mahomes', 'brady',
    'chiefs', 'eagles', 'cowboys', 'patriots', 'packers',
    'lakers', 'celtics', 'warriors', 'yankees', 'dodgers',
    '49ers', 'niners', 'nfc', 'afc', 'win the',
    'winner', 'champion', 'league winner', 'division winner',
    // 정치/정책
    'rfk', 'vaccine', 'vaccination', 'covid',
    // 암호화폐 가격 (에어드랍은 제외 - 내부정보 가치 있음)
    'bitcoin', 'btc ', 'ethereum', 'eth ', 'solana', 'sol ',
    'xrp', 'doge', 'dogecoin', 'memecoin', 'shiba', 'cardano',
    'bnb', 'altcoin',
    'reach $', 'hit $', 'price of',
    'fdv', 'fully diluted', 'market cap >', 'mcap',
    'token launch', 'token price',
    'base launch', 'base token',
    // 금융 예측 (예측 불가능한 것만)
    'gold price', 'silver price', 'oil price', 'commodity',
    'gold close', 'silver close', 'oil close', 'close at',
    'treasury', 'yield', 'bond',
    'inflation rate', 'gdp', 'unemployment', 'recession',
    'largest company', 'biggest company', 'by market cap', 'trillion',
    // 연예/가십/종교
    'divorce', 'pregnant', 'wedding', 'engaged', 'dating',
    'taylor swift', 'beyonce', 'kardashian', 'bieber',
    'jesus christ', 'pope', 'second coming', 'rapture',
    'person of the year', 'time magazine',
    // 영화/엔터 (내부정보 가치 낮음)
    'grossing movie', 'box office', 'avatar', 'oscar', 'grammy', 'emmy',
    'minecraft movie', 'opening weekend', 'domestic opening',
    // 장기/추상적 예측
    'agi', 'artificial general intelligence', 'singularity',
    'alien', 'ufo', 'extraterrestrial',
    // 트윗/소셜미디어 (노이즈)
    'tweet', 'tweets', 'follower', 'subscribers',
    // 전쟁/침공/영토
    'invade', 'invasion', 'annex', 'territory', 'greenland', 'taiwan',
    // 암호화폐 토큰 출시
    'launch a token', 'token in 2025', 'token by',
    // 기타
    'weed', 'cannabis', 'marijuana', 'reschedule',
  ];

  // ========== 주요 기업 (이 회사들 관련 마켓은 우선 포함) ==========
  const MAJOR_COMPANIES = [
    'apple', 'google', 'alphabet', 'microsoft', 'amazon', 'meta', 'facebook',
    'netflix', 'nvidia', 'amd', 'intel', 'tesla', 'spacex', 'twitter',
    'openai', 'anthropic', 'deepmind', 'mistral', 'xai', 'perplexity',
    'uber', 'lyft', 'airbnb', 'doordash', 'stripe',
    'coinbase', 'robinhood', 'paypal',
    'salesforce', 'oracle', 'ibm', 'cisco', 'adobe', 'zoom', 'slack',
    'snapchat', 'pinterest', 'linkedin', 'tiktok', 'bytedance',
    'spotify', 'disney', 'warner', 'hbo', 'paramount', 'sony', 'nintendo',
    'samsung', 'qualcomm', 'broadcom', 'arm', 'tsmc', 'asml',
    'palantir', 'snowflake', 'databricks', 'crowdstrike', 'cloudflare',
    'shopify', 'figma', 'canva', 'notion', 'discord', 'reddit', 'twitch',
    'draftkings', 'kraken', 'gemini',
    // AI 모델/회사
    'chatgpt', 'gpt-4', 'gpt-5', 'claude', 'gemini', 'llama',
    'tencent', 'alibaba', 'baidu', 'moonshot', 'deepseek', 'z.ai',
  ];

  // 직접 가져올 중요 이벤트 slug
  const IMPORTANT_SLUGS = [
    // M&A
    'will-netflix-close-warner-brothers-acquisition-by-end-of-2026',
    'openai-acquired-in-2025',
    'anthropic-acquired-in-2025',
    'will-apple-acquire-perplexity-in-2025',
    'will-perplexity-acquire-chrome-in-2025',
    'will-meta-be-forced-to-sell-instagram-or-whatsapp-in-2025',
    'will-elon-musk-buy-openai-in-2025',
    'tiktok-sale-announced-in-2025',
    // IPO
    'ipos-in-2025',
    'kraken-ipo-in-2025',
    // CEO
    'which-ceos-will-be-out-in-2025',
    'musk-out-as-tesla-ceo-in-2025',
    'who-will-replace-musk-as-tesla-ceo',
    'next-ceo-of-x',
    'will-sam-altman-get-openai-equity-in-2025',
    // AI 모델
    'which-company-has-best-ai-model-end-of-2025',
    'which-companies-will-have-a-1-ai-model-this-year',
    'will-chatgpt-reach-1b-monthly-active-users-in-2025',
    'meta-release-llama-5-in-2025',
    'what-day-will-openai-next-release-a-new-frontier-model',
    // 제품 출시
    'apple-vision-pro-2-released-by-december-31',
    'will-apple-release-a-new-product-line-in-2025',
    'when-will-samsung-release-a-trifold-phone',
    'gta-vi-released-in-2025',
    'will-openai-launch-a-consumer-hardware-product-by',
    'gemini-3-0-flash-released-by-december-15',
    'gemini-3-0-flash-released-by-december-31',
    // Tesla / SpaceX
    'will-tesla-launch-robotaxis-in-california-in-2025',
    'tesla-launches-unsupervised-full-self-driving-fsd-by',
    'how-many-spacex-launches-in-2025',
    'how-many-spacex-starship-launches-reach-space-in-2025',
    // 기타
    'another-cloudflare-outage-by-december-31',
    'x-money-launch-in-2025',
    'will-draftkings-launch-a-prediction-market-in-2025',
    // 연준/금리
    'bank-of-england-rate-cut-in-2025',
    'federal-reserve-interest-rate-decision',
    // 🆕 연준 인사
    'who-will-trump-nominate-as-fed-chair',
    'jerome-powell-out-as-fed-chair-in-2025',
    // 앱스토어
    '1-free-app-in-the-us-apple-app-store-on-december-12',
    '1-paid-app-in-the-us-apple-app-store-on-december-12',
    // 에어드랍
    'lighter-airdop-by',
    'pumpfun-airdop-by',
    // 법적 판결
    'will-yoon-be-sentenced-to-prison-in-2025',
    
    // 🆕 ETF 승인
    'cardano-etf-in-2025',
    'pepe-etf-in-2025',
    
    // 🆕 스테이블코인
    'usdt-depeg-in-2025',
    'tether-insolvent-in-2025',
    'boa-launches-a-usd-stablecoin-in-2025',
  ];

  const MIN_VOLUME = 5000;

  try {
    // 1. 중요 이벤트 직접 가져오기
    const slugPromises = IMPORTANT_SLUGS.map(slug =>
      fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`, {
        next: { revalidate: 3600 }
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    );

    // 2. 일반 이벤트
    const offsetPromises = [];
    for (let offset = 0; offset <= 600; offset += 100) {
      offsetPromises.push(
        fetch(`https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=${offset}`, {
          next: { revalidate: 3600 }
        }).then(r => r.json()).catch(() => [])
      );
    }

    // 3. 태그별
    const tags = ['tech', 'business', 'ai', 'big-tech'];
    const tagPromises = tags.map(tag =>
      fetch(`https://gamma-api.polymarket.com/events?tag=${tag}&closed=false&active=true&limit=200`, {
        next: { revalidate: 3600 }
      }).then(r => r.json()).catch(() => [])
    );

    const [slugResults, offsetResults, tagResults] = await Promise.all([
      Promise.all(slugPromises),
      Promise.all(offsetPromises),
      Promise.all(tagPromises)
    ]);

    const eventMap = new Map();

    for (const event of slugResults) {
      if (event && event.id) eventMap.set(event.id, event);
    }
    for (const events of offsetResults) {
      if (Array.isArray(events)) {
        for (const event of events) {
          if (event && event.id && !eventMap.has(event.id)) {
            eventMap.set(event.id, event);
          }
        }
      }
    }
    for (const events of tagResults) {
      if (Array.isArray(events)) {
        for (const event of events) {
          if (event && event.id && !eventMap.has(event.id)) {
            eventMap.set(event.id, event);
          }
        }
      }
    }

    const now = new Date();
    const markets = [];

    for (const event of eventMap.values()) {
      if (!event.markets) continue;

      for (const market of event.markets) {
        if (market.closed === true || market.active === false) continue;

        if (market.endDate) {
          const endDate = new Date(market.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (endDate < now) continue;
        }

        const volume = market.volumeNum || parseFloat(market.volume) || 0;
        if (volume < MIN_VOLUME) continue;

        const questionLower = (market.question || '').toLowerCase();
        const eventTitleLower = (event.title || '').toLowerCase();
        const combined = questionLower + ' ' + eventTitleLower;

        // 1. 절대 블랙리스트 체크 (먼저 제외)
        const isHardExcluded = EXCLUDE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
        if (isHardExcluded) continue;

        // 2. Insider 가치 판단
        const hasInsiderKeyword = INSIDER_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
        const hasMajorCompany = MAJOR_COMPANIES.some(c => combined.includes(c.toLowerCase()));
        
        // 3. 소프트 제외 체크 (정치인 이름 등) - INSIDER 키워드가 있으면 우회
        if (!hasInsiderKeyword) {
          const isSoftExcluded = SOFT_EXCLUDE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
          if (isSoftExcluded) continue;
        }
        
        // Insider 키워드가 있거나, 주요 기업 관련이면 포함
        if (!hasInsiderKeyword && !hasMajorCompany) continue;

        let outcomes = ['Yes', 'No'];
        let outcomePrices = [0.5, 0.5];
        try {
          if (typeof market.outcomes === 'string') outcomes = JSON.parse(market.outcomes);
          else if (Array.isArray(market.outcomes)) outcomes = market.outcomes;
          if (typeof market.outcomePrices === 'string') outcomePrices = JSON.parse(market.outcomePrices);
          else if (Array.isArray(market.outcomePrices)) outcomePrices = market.outcomePrices;
        } catch (e) {}

        markets.push({
          id: market.id,
          conditionId: market.conditionId,
          question: market.question,
          slug: market.slug,
          image: market.image || event.image,
          outcomes,
          outcomePrices,
          volume,
          liquidity: market.liquidityNum || parseFloat(market.liquidity) || 0,
          endDate: market.endDate,
          eventTitle: event.title,
          eventSlug: event.slug,
        });
      }
    }

    markets.sort((a, b) => b.volume - a.volume);

    return Response.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return Response.json({ markets: [], error: error.message }, { status: 500 });
  }
}
