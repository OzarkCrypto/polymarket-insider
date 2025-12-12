export async function GET() {
  // 무조건 제외할 키워드 (암호화폐, 귀금속, 국제정치)
  const ALWAYS_EXCLUDE = [
    // 암호화폐
    'btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'solana', 'sol ',
    'xrp', 'doge', 'dogecoin', 'memecoin', 'meme coin', 'shiba',
    'cardano', 'ada ', 'bnb', 'binance', 'token', 'stablecoin',
    // 귀금속/원자재
    'gold price', 'silver price', 'oil price', 'commodity',
    'gold hit', 'silver hit', 'gold reach', 'silver reach',
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
    // 기타 비기업
    'fed ', 'federal reserve', 'interest rate', 'inflation rate',
    'gdp', 'unemployment', 'recession'
  ];

  // 가격/시총 예측 키워드
  const PRICE_KEYWORDS = [
    'price', 'market cap', 'marketcap', 'reach $', 'hit $', 'above $',
    'below $', 'trading at', 'worth $', 'valuation', 'trillion', 'billion market',
    'largest company', 'biggest company', 'most valuable', 'by market cap',
    'market cap on', 'overtake', 'surpass'
  ];

  // 상장 주식 티커/회사명 (가격 예측시 제외)
  const PUBLIC_STOCKS = [
    'aapl', 'apple stock', 'tsla', 'tesla stock', 'nvda', 'nvidia stock',
    'googl', 'goog', 'google stock', 'alphabet stock',
    'msft', 'microsoft stock', 'meta stock', 'facebook stock',
    'amzn', 'amazon stock', 'nflx', 'netflix stock',
    'amd', 'intel', 'intc', 'ibm', 'orcl', 'oracle stock',
    'crm', 'salesforce', 'adobe', 'adbe', 'snap', 'uber', 'lyft',
    'coin', 'coinbase stock', 'hood', 'robinhood', 'pltr', 'palantir',
    'sp500', 's&p 500', 's&p500', 'nasdaq', 'dow jones'
  ];

  // 비상장 기업 (시총 예측 허용)
  const PRIVATE_COMPANIES = [
    'openai', 'anthropic', 'spacex', 'stripe', 'databricks',
    'discord', 'reddit ipo', 'canva', 'instacart', 'klarna',
    'revolut', 'figma', 'notion', 'airtable', 'scale ai'
  ];

  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?tag=tech&closed=false&limit=50', {
      next: { revalidate: 60 }
    });
    const events = await res.json();
    
    const markets = [];
    for (const event of events) {
      if (event.markets) {
        for (const market of event.markets) {
          const questionLower = (market.question || '').toLowerCase();
          const eventTitleLower = (event.title || '').toLowerCase();
          const combined = questionLower + ' ' + eventTitleLower;
          
          // 1. 무조건 제외 키워드 체크
          const alwaysExcluded = ALWAYS_EXCLUDE.some(keyword => 
            combined.includes(keyword)
          );
          if (alwaysExcluded) continue;
          
          // 2. 가격/시총 예측 마켓인지 체크
          const isPricePrediction = PRICE_KEYWORDS.some(keyword => 
            combined.includes(keyword)
          );
          
          if (isPricePrediction) {
            // 비상장 기업이면 허용
            const isPrivateCompany = PRIVATE_COMPANIES.some(company => 
              combined.includes(company)
            );
            if (isPrivateCompany) {
              // 허용 - 아래로 진행
            } else {
              // 상장 주식이면 제외
              const isPublicStock = PUBLIC_STOCKS.some(stock => 
                combined.includes(stock)
              );
              if (isPublicStock) continue;
              
              // 상장/비상장 불명확하면 제외 (안전하게)
              // 단, 기업 이름이 명확히 있으면 허용
              const hasCompanyContext = combined.includes('company') || 
                combined.includes('startup') || combined.includes('ipo');
              if (!hasCompanyContext) continue;
            }
          }
          
          markets.push({
            id: market.id,
            conditionId: market.conditionId,
            question: market.question,
            slug: market.slug,
            image: market.image || event.image,
            outcomes: JSON.parse(market.outcomes || '["Yes", "No"]'),
            outcomePrices: JSON.parse(market.outcomePrices || '[0.5, 0.5]'),
            volume: market.volumeNum || parseFloat(market.volume) || 0,
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
