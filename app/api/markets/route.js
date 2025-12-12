export async function GET() {
  // ========== 화이트리스트 (이 키워드가 있으면 포함) ==========
  const INCLUDE_KEYWORDS = [
    // 주요 테크 기업
    'apple', 'google', 'alphabet', 'microsoft', 'amazon', 'meta', 'facebook',
    'netflix', 'nvidia', 'amd', 'intel', 'tesla', 'spacex', 'twitter', ' x ',
    'openai', 'anthropic', 'deepmind', 'mistral', 'cohere', 'perplexity',
    'uber', 'lyft', 'airbnb', 'doordash', 'instacart', 'stripe', 'plaid',
    'coinbase', 'robinhood', 'square', 'block inc', 'paypal', 'visa', 'mastercard',
    'salesforce', 'oracle', 'ibm', 'cisco', 'adobe', 'zoom', 'slack', 'dropbox',
    'snapchat', 'snap inc', 'pinterest', 'linkedin', 'tiktok', 'bytedance',
    'spotify', 'disney', 'warner', 'paramount', 'sony', 'nintendo', 'xbox',
    'samsung', 'lg ', 'huawei', 'xiaomi', 'oppo', 'vivo',
    'qualcomm', 'broadcom', 'arm ', 'tsmc', 'asml',
    'palantir', 'snowflake', 'databricks', 'mongodb', 'elastic',
    'crowdstrike', 'cloudflare', 'datadog', 'splunk', 'okta',
    'shopify', 'squarespace', 'wix', 'wordpress',
    'figma', 'canva', 'notion', 'airtable', 'monday.com',
    'discord', 'reddit', 'twitch', 'youtube',
    // AI/테크 용어
    'chatgpt', 'gpt-', 'gpt4', 'gpt5', 'claude', 'gemini', 'llama',
    'artificial intelligence', ' ai ', 'machine learning', 'deep learning',
    'large language model', 'llm', 'neural network', 'transformer',
    'self-driving', 'autonomous', 'robotaxi', 'fsd', 'autopilot',
    'robot', 'humanoid', 'optimus',
    'vr ', 'virtual reality', 'ar ', 'augmented reality', 'metaverse',
    'quantum computing', 'quantum computer',
    // 비즈니스 용어
    'ipo', 'initial public offering', 'go public', 'goes public',
    'acquisition', 'acquire', 'acquires', 'acquired', 'merger', 'merge',
    'buyout', 'takeover', 'deal', 'purchase',
    'ceo', 'chief executive', 'founder', 'step down', 'resign', 'fired',
    'layoff', 'lay off', 'restructur',
    'launch', 'launches', 'release', 'releases', 'announce', 'announces',
    'product', 'device', 'phone', 'smartphone', 'iphone', 'android',
    'app store', 'play store', 'download',
    'starship', 'rocket', 'satellite', 'starlink',
    // 게임/엔터테인먼트 테크
    'gta ', 'grand theft auto', 'playstation', 'ps5', 'ps6',
    'steam', 'epic games', 'unity', 'unreal',
    'streaming', 'subscriber',
  ];

  // ========== 블랙리스트 (무조건 제외) ==========
  const EXCLUDE_KEYWORDS = [
    // 정치/선거
    'trump', 'biden', 'harris', 'desantis', 'president', 'election', 'vote',
    'congress', 'senate', 'democrat', 'republican', 'gop', 'ballot',
    'governor', 'mayor', 'politician', 'political', 'impeach', 'pardon',
    // 국제관계/전쟁
    'war ', 'ukraine', 'russia', 'putin', 'zelensky', 'nato',
    'xi jinping', 'iran ', 'israel', 'gaza', 'palestine',
    'hamas', 'hezbollah', 'military', 'troops', 'missile',
    'ceasefire', 'invasion', 'nuclear weapon',
    // 스포츠 리그/대회
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ufc', 'wwe', 'pga', 'atp', 'wta',
    'super bowl', 'world series', 'stanley cup', 'world cup',
    'championship', 'playoffs', 'finals', 'semifinal',
    'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
    'champions league', 'europa league',
    // 스포츠 종목
    'football', 'basketball', 'baseball', 'hockey', 'soccer', 'tennis',
    'golf', 'boxing', 'mma', 'f1 ', 'formula 1', 'nascar', 'olympics',
    'quarterback', 'mvp', 'touchdown', 'home run', 'slam dunk',
    // 스포츠 선수/팀
    'lebron', 'messi', 'ronaldo', 'curry', 'mahomes', 'brady',
    'chiefs', 'eagles', 'cowboys', 'patriots', 'packers', 'bears', '49ers',
    'ravens', 'bills', 'dolphins', 'jets', 'steelers', 'bengals', 'browns',
    'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
    'yankees', 'dodgers', 'red sox', 'cubs', 'mets', 'braves',
    // 암호화폐 가격/토큰
    'bitcoin', 'btc ', 'ethereum', 'eth ', 'solana', 'sol ',
    'xrp', 'doge', 'dogecoin', 'memecoin', 'shiba', 'cardano',
    'bnb', 'binance coin', 'stablecoin', 'altcoin', 'airdrop',
    'reach $', 'hit $', 'price of btc', 'price of eth',
    'fdv', 'fully diluted', 'market cap >', 'market cap <', 'mcap',
    'token launch', 'token price', 'lighter ', 'hyperliquid',
    'base launch', 'base token',
    // 원자재/금융 예측
    'gold price', 'silver price', 'oil price', 'commodity',
    'close at $', 'close above', 'close below',
    'treasury', 'yield', 'bond', 'interest rate', 'fed ',
    'inflation rate', 'gdp', 'unemployment', 'recession',
    // 시총 예측
    'largest company', 'biggest company', 'by market cap',
    'market cap on', 'trillion',
    // 연예/가십/종교
    'divorce', 'pregnant', 'wedding', 'engaged', 'dating',
    'taylor swift', 'beyonce', 'kardashian', 'bieber',
    'jesus christ', 'pope', 'second coming', 'rapture',
    'person of the year', 'time magazine',
    // 영화 (tech과 무관)
    'grossing movie', 'box office', 'avatar',
  ];

  const MIN_VOLUME = 5000;

  try {
    // 전체 이벤트 가져오기 (offset으로 페이지네이션)
    const fetchPromises = [];
    
    // offset 0부터 600까지 (600개 이상 이벤트 커버)
    for (let offset = 0; offset <= 600; offset += 100) {
      fetchPromises.push(
        fetch(`https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=${offset}`, {
          next: { revalidate: 3600 }
        }).then(r => r.json()).catch(() => [])
      );
    }
    
    // 추가 태그별 조회 (restricted 마켓 포함 가능성)
    const tags = ['tech', 'business', 'ai', 'finance', 'science', 'big-tech'];
    for (const tag of tags) {
      fetchPromises.push(
        fetch(`https://gamma-api.polymarket.com/events?tag=${tag}&closed=false&active=true&limit=200`, {
          next: { revalidate: 3600 }
        }).then(r => r.json()).catch(() => [])
      );
    }

    const results = await Promise.all(fetchPromises);
    
    // 중복 제거
    const eventMap = new Map();
    for (const events of results) {
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
        // 기본 필터
        if (market.closed === true || market.active === false) continue;

        // 종료일 체크 (오늘까지는 포함)
        if (market.endDate) {
          const endDate = new Date(market.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (endDate < now) continue;
        }

        // 볼륨 체크
        const volume = market.volumeNum || parseFloat(market.volume) || 0;
        if (volume < MIN_VOLUME) continue;

        const questionLower = (market.question || '').toLowerCase();
        const eventTitleLower = (event.title || '').toLowerCase();
        const combined = questionLower + ' ' + eventTitleLower;

        // 1. 블랙리스트 체크 (먼저 제외)
        const isExcluded = EXCLUDE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
        if (isExcluded) continue;

        // 2. 화이트리스트 체크 (포함 키워드 있어야 함)
        const isIncluded = INCLUDE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
        if (!isIncluded) continue;

        // outcomes 파싱
        let outcomes = ['Yes', 'No'];
        let outcomePrices = [0.5, 0.5];
        try {
          if (typeof market.outcomes === 'string') {
            outcomes = JSON.parse(market.outcomes);
          } else if (Array.isArray(market.outcomes)) {
            outcomes = market.outcomes;
          }
          if (typeof market.outcomePrices === 'string') {
            outcomePrices = JSON.parse(market.outcomePrices);
          } else if (Array.isArray(market.outcomePrices)) {
            outcomePrices = market.outcomePrices;
          }
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

    // 볼륨 기준 정렬
    markets.sort((a, b) => b.volume - a.volume);

    return Response.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return Response.json({ markets: [], error: error.message }, { status: 500 });
  }
}
