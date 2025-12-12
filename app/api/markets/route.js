export async function GET() {
  const MIN_VOLUME = 5000;

  // 제외 키워드
  const EXCLUDE_KEYWORDS = [
    // 정치/선거
    'trump', 'biden', 'president', 'election', 'congress', 'senate',
    'democrat', 'republican', 'governor', 'mayor', 'political',
    // 국제관계/전쟁
    'war ', 'ukraine', 'russia', 'putin', 'nato', 'israel', 'gaza',
    'military', 'troops', 'missile', 'ceasefire', 'invasion',
    // 스포츠
    'nfl', 'nba', 'mlb', 'nhl', 'ufc', 'super bowl', 'championship',
    'playoffs', 'finals', 'premier league', 'champions league',
    'football', 'basketball', 'baseball', 'hockey', 'soccer',
    'lebron', 'messi', 'ronaldo', 'mahomes',
    // 암호화폐 가격
    'bitcoin', 'btc ', 'ethereum', 'eth ', 'solana', 'xrp', 'doge',
    'reach $', 'hit $', 'price of', 'fdv', 'market cap >',
    // 금융/경제
    'recession', 'fed ', 'interest rate', 'treasury', 'inflation',
    // 기타 제외
    'person of the year', 'pope', 'jesus', 'grossing movie',
  ];

  try {
    // 1. Polymarket /tech 페이지에서 slug 스크래핑
    let techSlugs = [];
    
    try {
      const techPageResponse = await fetch('https://polymarket.com/tech', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        next: { revalidate: 3600 }
      });
      const techPageHtml = await techPageResponse.text();
      
      // __NEXT_DATA__에서 JSON 추출
      const nextDataMatch = techPageHtml.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/);
      
      if (nextDataMatch) {
        const jsonStr = nextDataMatch[1];
        // "slug": "xxx" 패턴 추출
        const slugMatches = jsonStr.matchAll(/"slug"\s*:\s*"([^"]+)"/g);
        const slugSet = new Set();
        for (const match of slugMatches) {
          const slug = match[1];
          // tech 관련 slug만 (길이 > 10, - 포함, 태그 제외)
          if (slug.length > 10 && slug.includes('-') && 
              !['2025-predictions', 'artificial-intelligence', 'prediction-markets', 
                'second-best-ai-company', 'second-largest-company', 'top-ai-company-style-on'].includes(slug)) {
            slugSet.add(slug);
          }
        }
        techSlugs = Array.from(slugSet);
      }
    } catch (scrapeError) {
      console.error('Scraping failed:', scrapeError.message);
    }

    console.log(`Scraped ${techSlugs.length} slugs from /tech page`);

    // Fallback: 스크래핑 실패시 기본 slug 목록 사용
    if (techSlugs.length < 10) {
      techSlugs = [
        'ipos-in-2025', 'which-company-has-best-ai-model-end-of-2025',
        'openai-ipo-in-2025', 'anthropic-ipo-in-2025', 'stripe-ipo-in-2025',
        'spacex-space-exploration-technologies-corp-ipo-in-2025', 'discord-ipo-in-2025',
        'databricks-ipo-in-2025', 'kraken-ipo-in-2025', 'rippling-ipo-in-2025',
        'cerebras-ipo-in-2025', 'anduril-ipo-in-2025', 'ramp-ipo-in-2025',
        'what-day-will-openai-release-a-new-frontier-model',
        'tesla-launches-unsupervised-full-self-driving-fsd-by',
        'when-will-samsung-release-a-trifold-phone',
        'another-cloudflare-outage-by-december-31',
        'which-company-will-have-the-best-ai-model-for-coding-at-the-end-of-2025',
        'which-company-will-have-the-best-ai-model-for-math-at-the-end-of-2025',
        '1-free-app-in-the-us-apple-app-store-on-december-12',
        '1-paid-app-in-the-us-apple-app-store-on-december-12',
        'will-netflix-close-warner-brothers-acquisition-by-end-of-2026',
        'will-perplexity-acquire-chrome-in-2025',
        'openai-acquired-in-2025', 'anthropic-acquired-in-2025',
        'tiktok-sale-announced-in-2025',
        'musk-out-as-tesla-ceo-in-2025', 'which-ceos-will-be-out-in-2025',
        'gemini-3pt0-flash-released-by-december-31',
        'spacex-ipo-closing-market-cap', 'glean-ipo-in-2025',
        'vanta-ipo-in-2025', 'mistral-ai-ipo-in-2025', 'brex-ipo-in-2025',
      ];
      console.log('Using fallback slug list');
    }

    // 필수 slug - 항상 추가 (restricted 마켓 포함)
    const ESSENTIAL_SLUGS = [
      'will-netflix-close-warner-brothers-acquisition-by-end-of-2026',
      'will-perplexity-acquire-chrome-in-2025',
      'openai-acquired-in-2025',
      'anthropic-acquired-in-2025',
      'tiktok-sale-announced-in-2025',
      'will-meta-be-forced-to-sell-instagram-or-whatsapp-in-2025',
      'will-apple-acquire-perplexity-in-2025',
      'ipos-in-2025',
    ];
    
    for (const slug of ESSENTIAL_SLUGS) {
      if (!techSlugs.includes(slug)) {
        techSlugs.push(slug);
      }
    }

    // 2. 각 slug로 이벤트 가져오기
    const slugPromises = techSlugs.map(slug =>
      fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`, {
        next: { revalidate: 3600 }
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    );

    const slugResults = await Promise.all(slugPromises);

    // 3. 마켓 추출 및 필터링
    const now = new Date();
    const markets = [];
    const eventMap = new Map();

    for (const event of slugResults) {
      if (!event || !event.markets) continue;
      if (eventMap.has(event.id)) continue;
      eventMap.set(event.id, true);

      for (const market of event.markets) {
        if (market.closed === true || market.active === false) continue;

        // 종료일 체크
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

        // 제외 키워드 체크
        const isExcluded = EXCLUDE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()));
        if (isExcluded) continue;

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

    markets.sort((a, b) => b.volume - a.volume);

    return Response.json({ 
      markets,
      meta: {
        scrapedSlugs: techSlugs.length,
        totalMarkets: markets.length
      }
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return Response.json({ markets: [], error: error.message }, { status: 500 });
  }
}
