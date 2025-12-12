export async function GET() {
  // 무조건 제외할 키워드
  const ALWAYS_EXCLUDE = [
    // 암호화폐
    'btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'solana', 'sol ',
    'xrp', 'doge', 'dogecoin', 'memecoin', 'meme coin', 'shiba',
    'cardano', 'ada ', 'bnb', 'binance', 'token', 'stablecoin',
    // 귀금속/원자재
    'gold price', 'silver price', 'oil price', 'commodity',
    'gold hit', 'silver hit', 'gold reach', 'silver reach',
    // 금융/채권/금리
    'treasury', 'yield', 'bond', 'interest rate', 'fed ', 'federal reserve',
    'inflation rate', 'gdp', 'unemployment', 'recession', 'cpi',
    'rate cut', 'rate hike', 'basis point', 'fomc',
    // 정치/선거
    'trump', 'biden', 'president', 'election', 'vote', 'congress',
    'senate', 'house of rep', 'democrat', 'republican', 'gop',
    'governor', 'mayor', 'politician', 'political', 'ballot',
    'impeach', 'pardon', 'cabinet', 'secretary of',
    // 국제관계/전쟁
    'war', 'ukraine', 'russia', 'putin', 'zelensky', 'nato',
    'china', 'xi jinping', 'taiwan', 'iran', 'israel', 'gaza',
    'palestine', 'hamas', 'hezbollah', 'military', 'troops',
    'missile', 'nuclear', 'sanction', 'tariff', 'ceasefire',
    'invasion', 'occupation', 'border', 'immigration',
    // 정부/외교
    'government shutdown', 'prime minister', 'minister',
    'embassy', 'diplomat', 'treaty', 'united nations', 'g7', 'g20',
    // 스포츠 - 리그/대회
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'ufc', 'wwe', 'pga', 'atp', 'wta',
    'super bowl', 'world series', 'stanley cup', 'world cup',
    'championship', 'playoffs', 'finals', 'semifinal',
    'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
    'champions league', 'europa league', 'euro 2024', 'copa america',
    // 스포츠 - 종목
    'football', 'basketball', 'baseball', 'hockey', 'soccer', 'tennis',
    'golf', 'boxing', 'mma', 'wrestling', 'f1', 'formula 1', 'nascar',
    'olympics', 'olympic',
    // 스포츠 - 컨퍼런스/디비전
    'afc ', 'nfc ', 'afc west', 'afc east', 'afc north', 'afc south',
    'nfc west', 'nfc east', 'nfc north', 'nfc south',
    'al east', 'al west', 'al central', 'nl east', 'nl west', 'nl central',
    'eastern conference', 'western conference',
    // 스포츠 - 팀명
    'chiefs', 'eagles', 'cowboys', 'patriots', 'packers', 'bears', '49ers',
    'ravens', 'bills', 'dolphins', 'jets', 'steelers', 'bengals', 'browns',
    'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers',
    'commanders', 'giants', 'lions', 'vikings', 'falcons', 'panthers',
    'saints', 'buccaneers', 'cardinals', 'rams', 'seahawks',
    'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
    'yankees', 'dodgers', 'red sox', 'cubs', 'mets', 'braves',
    // 스포츠 - 기타
    'athlete', 'coach', 'quarterback', 'mvp', 'touchdown', 'home run',
    'slam dunk', 'goal', 'assist', 'win the', 'beat the',
    'player', 'game', 'match', 'season', 'draft', 'trade',
    'lebron', 'messi', 'ronaldo', 'mahomes', 'brady', 'curry',
    // 시총/가격 예측
    'largest company', 'biggest company', 'most valuable company',
    'by market cap', 'market cap on', 'overtake', 'surpass',
    'trillion', 'reach $', 'hit $', 'above $', 'below $', 'trading at',
    'stock price', 'share price'
  ];

  // 최소 볼륨 (USD)
  const MIN_VOLUME = 10000;

  // 비상장 기업 (시총 예측 허용)
  const PRIVATE_COMPANIES = [
    'openai', 'anthropic', 'spacex', 'stripe', 'databricks',
    'discord', 'reddit ipo', 'canva', 'instacart', 'klarna',
    'revolut', 'figma', 'notion', 'airtable', 'scale ai'
  ];

  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?tag=tech&closed=false&active=true&limit=500', {
      next: { revalidate: 28800 }
    });
    const events = await res.json();
    
    const now = new Date();
    const markets = [];
    for (const event of events) {
      if (event.markets) {
        for (const market of event.markets) {
          // 종료일이 지난 마켓 제외
          if (market.endDate && new Date(market.endDate) < now) continue;
          
          // 볼륨 $10k 미만 제외
          const volume = market.volumeNum || parseFloat(market.volume) || 0;
          if (volume < MIN_VOLUME) continue;
          
          const questionLower = (market.question || '').toLowerCase();
          const eventTitleLower = (event.title || '').toLowerCase();
          const combined = questionLower + ' ' + eventTitleLower;
          
          // 무조건 제외 키워드 체크
          const alwaysExcluded = ALWAYS_EXCLUDE.some(keyword => 
            combined.includes(keyword)
          );
          if (alwaysExcluded) {
            // 비상장 기업이면 예외적으로 허용
            const isPrivateCompany = PRIVATE_COMPANIES.some(company => 
              combined.includes(company)
            );
            if (!isPrivateCompany) continue;
          }
          
          markets.push({
            id: market.id,
            conditionId: market.conditionId,
            question: market.question,
            slug: market.slug,
            image: market.image || event.image,
            outcomes: JSON.parse(market.outcomes || '["Yes", "No"]'),
            outcomePrices: JSON.parse(market.outcomePrices || '[0.5, 0.5]'),
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
