export async function GET() {
  // 제외할 키워드 - 최소화 (정치/스포츠/암호화폐/원자재만)
  const EXCLUDE_KEYWORDS = [
    // 암호화폐 (가격 예측)
    'bitcoin', 'btc ', 'ethereum', 'eth ', 'solana', 'sol ',
    'xrp', 'doge', 'dogecoin', 'memecoin', 'shiba',
    'cardano', 'bnb', 'binance coin', 'stablecoin',
    'reach $', 'hit $', 'price of bitcoin', 'price of eth',
    // 원자재 가격
    'gold price', 'silver price', 'oil price', 'commodity',
    'close at $', 'close above', 'close below',
    // 정치/선거
    'trump', 'biden', 'president', 'election', 'vote', 'congress',
    'senate', 'democrat', 'republican', 'gop', 'ballot',
    'governor', 'mayor', 'politician', 'political',
    // 국제관계/전쟁
    'war ', 'ukraine', 'russia', 'putin', 'zelensky', 'nato',
    'xi jinping', 'iran ', 'israel', 'gaza', 'palestine',
    'hamas', 'hezbollah', 'military', 'troops', 'missile',
    'ceasefire', 'invasion',
    // 스포츠
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ufc', 'wwe',
    'super bowl', 'world series', 'stanley cup', 'world cup',
    'championship', 'playoffs', 'finals',
    'premier league', 'la liga', 'bundesliga', 'champions league',
    'football', 'basketball', 'baseball', 'hockey', 'soccer',
    'tennis', 'golf', 'boxing', 'mma', 'f1 ', 'formula 1',
    'olympics', 'olympic', 'quarterback', 'mvp', 'touchdown',
    // 스포츠 팀
    'chiefs', 'eagles', 'cowboys', 'patriots', 'packers',
    'lakers', 'celtics', 'warriors', 'yankees', 'dodgers',
    // 연예/가십 (tech과 무관)
    'divorce', 'pregnant', 'wedding', 'engaged', 'dating',
    'rehab', 'arrested', 'jail',
    'taylor swift', 'beyonce', 'kardashian', 'bieber',
    // 시총/가격 예측 (주식)
    'largest company', 'biggest company', 'by market cap',
    'market cap on', 'trillion', 'stock price', 'share price',
  ];

  // 최소 볼륨 (USD)
  const MIN_VOLUME = 5000;

  // Tech 관련 중요 이벤트 슬러그 목록
  const IMPORTANT_EVENT_SLUGS = [
    'ipos-in-2025',
    'which-ceos-will-be-out-in-2025',
    'which-company-has-best-ai-model-end-of-2025',
    'which-companies-will-have-a-1-ai-model-this-year',
    'another-cloudflare-outage-by-december-31',
    'when-will-samsung-release-a-trifold-phone',
    '1-free-app-in-the-us-apple-app-store-on-december-12',
    'will-apple-release-a-new-product-line-in-2025',
    'how-many-spacex-launches-in-2025',
    'how-many-spacex-starship-launches-reach-space-in-2025',
    'tiktok-sale-announced-in-2025',
    'gta-vi-released-in-2025',
    'openai-announces-it-has-achieved-agi-in-2025',
    'will-chatgpt-reach-1b-monthly-active-users-in-2025',
    'will-tesla-launch-robotaxis-in-california-in-2025',
    'tesla-launches-unsupervised-full-self-driving-fsd-by',
    'x-money-launch-in-2025',
    'musk-out-as-tesla-ceo-in-2025',
    'who-will-replace-musk-as-tesla-ceo',
    'next-ceo-of-x',
    'kraken-ipo-in-2025',
    'meta-release-llama-5-in-2025',
    'openai-acquired-in-2025',
    'anthropic-acquired-in-2025',
    'will-openai-launch-a-consumer-hardware-product-by',
    'will-meta-be-forced-to-sell-instagram-or-whatsapp-in-2025',
    'will-elon-musk-buy-openai-in-2025',
    'will-sam-altman-get-openai-equity-in-2025',
    'us-enacts-ai-safety-bill-in-2025',
  ];

  try {
    // 1. 중요 이벤트 슬러그로 직접 가져오기 (가장 확실한 방법)
    const slugPromises = IMPORTANT_EVENT_SLUGS.map(slug =>
      fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`, {
        next: { revalidate: 28800 }
      }).then(res => res.ok ? res.json() : null).catch(() => null)
    );
    
    // 2. 태그로 추가 마켓 가져오기
    const tags = ['big-tech', 'ai', 'business'];
    const tagPromises = tags.map(tag =>
      fetch(`https://gamma-api.polymarket.com/events?tag=${tag}&closed=false&active=true&limit=200`, {
        next: { revalidate: 28800 }
      }).then(res => res.json()).catch(() => [])
    );
    
    const [slugResults, tagResults] = await Promise.all([
      Promise.all(slugPromises),
      Promise.all(tagPromises)
    ]);
    
    // 중복 제거 (event id 기준)
    const eventMap = new Map();
    
    // 슬러그 결과 먼저 추가 (우선순위)
    for (const event of slugResults) {
      if (event && event.id) {
        eventMap.set(event.id, event);
      }
    }
    
    // 태그 결과 추가
    for (const events of tagResults) {
      if (Array.isArray(events)) {
        for (const event of events) {
          if (!eventMap.has(event.id)) {
            eventMap.set(event.id, event);
          }
        }
      }
    }
    
    const events = Array.from(eventMap.values());
    const now = new Date();
    const markets = [];
    
    for (const event of events) {
      if (event.markets) {
        for (const market of event.markets) {
          // 마켓이 닫혔거나 비활성인 경우 제외
          if (market.closed === true || market.active === false) continue;
          
          // 종료일이 지난 마켓 제외
          if (market.endDate && new Date(market.endDate) < now) continue;
          
          // 볼륨 체크
          const volume = market.volumeNum || parseFloat(market.volume) || 0;
          if (volume < MIN_VOLUME) continue;
          
          const questionLower = (market.question || '').toLowerCase();
          const eventTitleLower = (event.title || '').toLowerCase();
          const combined = questionLower + ' ' + eventTitleLower;
          
          // 제외 키워드 체크
          const shouldExclude = EXCLUDE_KEYWORDS.some(keyword => 
            combined.includes(keyword.toLowerCase())
          );
          if (shouldExclude) continue;
          
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
          } catch (e) {
            // 파싱 실패시 기본값 사용
          }
          
          markets.push({
            id: market.id,
            conditionId: market.conditionId,
            question: market.question,
            slug: market.slug,
            image: market.image || event.image,
            outcomes,
            outcomePrices,
            volume: volume,
            liquidity: market.liquidityNum || parseFloat(market.liquidity) || 0,
            endDate: market.endDate,
            eventTitle: event.title,
            eventSlug: event.slug,
          });
        }
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
