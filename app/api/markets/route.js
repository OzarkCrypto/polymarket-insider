export async function GET() {
  // 제외할 키워드 (암호화폐 관련)
  const EXCLUDE_KEYWORDS = [
    'btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'solana', 'sol ', 
    'xrp', 'doge', 'dogecoin', 'memecoin', 'meme coin', 'shiba',
    'cardano', 'ada ', 'bnb', 'binance', 'coinbase', 'token'
  ];

  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?tag=tech&closed=false&limit=50', {
      next: { revalidate: 60 }
    });
    const events = await res.json();
    
    // 각 이벤트의 마켓들을 평탄화하여 반환
    const markets = [];
    for (const event of events) {
      if (event.markets) {
        for (const market of event.markets) {
          const questionLower = (market.question || '').toLowerCase();
          const eventTitleLower = (event.title || '').toLowerCase();
          
          // 암호화폐 관련 키워드가 포함된 마켓 제외
          const isExcluded = EXCLUDE_KEYWORDS.some(keyword => 
            questionLower.includes(keyword) || eventTitleLower.includes(keyword)
          );
          
          if (isExcluded) continue;
          
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
