export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('market');
  const yesPrice = parseFloat(searchParams.get('yesPrice')) || 0.5;
  const noPrice = parseFloat(searchParams.get('noPrice')) || 0.5;
  
  if (!conditionId) {
    return Response.json({ error: 'market parameter required' }, { status: 400 });
  }
  
  try {
    // 1. 마켓의 홀더 목록 가져오기 (Top 50)
    const holdersRes = await fetch(
      `https://data-api.polymarket.com/holders?market=${conditionId}&limit=50`,
      { next: { revalidate: 300 } }
    );
    const holdersData = await holdersRes.json();
    
    // 홀더 정보 추출
    const allHolders = [];
    for (const tokenData of holdersData) {
      if (tokenData.holders) {
        for (const holder of tokenData.holders) {
          const side = holder.outcomeIndex === 0 ? 'YES' : 'NO';
          const shares = holder.amount;
          const price = side === 'YES' ? yesPrice : noPrice;
          const positionValue = shares * price;
          
          allHolders.push({
            wallet: holder.proxyWallet,
            name: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : holder.pseudonym,
            shares: shares,
            amount: positionValue,
            side: side,
            price: price,
          });
        }
      }
    }
    
    // 2. 각 홀더 분석 (positions + activity 병렬 호출)
    const analyzeHolder = async (holder) => {
      try {
        const [posRes, actRes] = await Promise.all([
          fetch(
            `https://data-api.polymarket.com/positions?user=${holder.wallet}&sizeThreshold=100`,
            { next: { revalidate: 300 } }
          ),
          fetch(
            `https://data-api.polymarket.com/activity?user=${holder.wallet}&limit=200`,
            { next: { revalidate: 300 } }
          )
        ]);
        
        const positions = await posRes.json();
        const activities = await actRes.json();
        
        // 포지션 분석
        const totalMarkets = positions.length;
        const totalValue = positions.reduce((sum, p) => sum + (p.size || 0), 0);
        const marketRatio = totalValue > 0 ? holder.shares / totalValue : 1;
        
        // 계정 나이 계산 (첫 거래 ~ 현재)
        let accountAgeDays = 999;
        let firstTradeDate = null;
        
        // 이 마켓 첫 베팅 시점 계산 ★ 핵심 ★
        let marketEntryDays = 999;
        let marketFirstBetDate = null;
        
        if (activities && activities.length > 0) {
          const allTimestamps = activities.map(a => a.timestamp).filter(t => t);
          if (allTimestamps.length > 0) {
            const firstTimestamp = Math.min(...allTimestamps);
            firstTradeDate = new Date(firstTimestamp * 1000);
            const now = new Date();
            accountAgeDays = Math.floor((now - firstTradeDate) / (1000 * 60 * 60 * 24));
          }
          
          // 이 마켓의 거래만 필터링
          const marketTrades = activities.filter(a => a.conditionId === conditionId);
          if (marketTrades.length > 0) {
            const marketTimestamps = marketTrades.map(a => a.timestamp).filter(t => t);
            if (marketTimestamps.length > 0) {
              const firstMarketTs = Math.min(...marketTimestamps);
              marketFirstBetDate = new Date(firstMarketTs * 1000);
              const now = new Date();
              marketEntryDays = Math.floor((now - marketFirstBetDate) / (1000 * 60 * 60 * 24));
            }
          }
        }
        
        // ========== 개선된 점수 체계 (100점) ==========
        let score = 0;
        
        // 1. 이 마켓 첫 베팅 시점 (최대 35점) ★ 핵심 지표 ★
        if (marketEntryDays <= 3) score += 35;       // 🚨 마켓 초기 진입
        else if (marketEntryDays <= 7) score += 25;  // ⚠️ 최근 진입
        else if (marketEntryDays <= 14) score += 15; // 👀 관찰
        // 15일+ = 0점
        
        // 2. 계정 활동 기간 (최대 25점)
        if (accountAgeDays <= 7) score += 25;
        else if (accountAgeDays <= 30) score += 15;
        else if (accountAgeDays <= 90) score += 5;
        // 90일+ = 0점
        
        // 3. 현재 마켓 집중도 (최대 25점)
        if (totalMarkets <= 1) score += 25;
        else if (totalMarkets <= 2) score += 20;
        else if (totalMarkets <= 3) score += 15;
        else if (totalMarkets <= 5) score += 5;
        // 6+ = 0점
        
        // 4. 포지션 가치 (최대 15점)
        if (holder.amount >= 50000) score += 15;
        else if (holder.amount >= 20000) score += 12;
        else if (holder.amount >= 10000) score += 10;
        else if (holder.amount >= 5000) score += 5;
        
        return {
          ...holder,
          totalMarkets,
          totalValue,
          marketRatio: Math.round(marketRatio * 100),
          accountAgeDays,
          firstTradeDate: firstTradeDate ? firstTradeDate.toISOString().split('T')[0] : null,
          marketEntryDays,
          marketFirstBetDate: marketFirstBetDate ? marketFirstBetDate.toISOString().split('T')[0] : null,
          score,
        };
      } catch (err) {
        return {
          ...holder,
          totalMarkets: -1,
          totalValue: 0,
          marketRatio: 0,
          accountAgeDays: 999,
          marketEntryDays: 999,
          score: 0,
          error: true,
        };
      }
    };
    
    // 병렬 처리 (10개씩 배치)
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < allHolders.length; i += batchSize) {
      const batch = allHolders.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(analyzeHolder));
      results.push(...batchResults);
    }
    
    // 점수 순 정렬
    results.sort((a, b) => b.score - a.score);
    
    // 의심 등급 추가 + $5K 이상만 필터링
    const analyzed = results
      .filter(h => h.amount >= 5000)
      .map(h => ({
        ...h,
        flag: h.score >= 70 ? 'HIGH' : h.score >= 50 ? 'MEDIUM' : h.score >= 30 ? 'LOW' : null,
      }));
    
    return Response.json({
      market: conditionId,
      yesPrice,
      noPrice,
      totalHolders: analyzed.length,
      suspicious: analyzed.filter(h => h.score >= 50),
      all: analyzed,
    });
    
  } catch (error) {
    console.error('Error analyzing suspicious accounts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
