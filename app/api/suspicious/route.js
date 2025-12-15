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
      { next: { revalidate: 300 } } // 5분 캐시
    );
    const holdersData = await holdersRes.json();
    
    // 홀더 정보 추출
    const allHolders = [];
    for (const tokenData of holdersData) {
      if (tokenData.holders) {
        for (const holder of tokenData.holders) {
          const side = holder.outcomeIndex === 0 ? 'YES' : 'NO';
          const shares = holder.amount;
          // 실제 포지션 가치 계산: shares × price
          const price = side === 'YES' ? yesPrice : noPrice;
          const positionValue = shares * price;
          
          allHolders.push({
            wallet: holder.proxyWallet,
            name: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : holder.pseudonym,
            shares: shares,
            amount: positionValue,  // 이제 실제 달러 가치
            side: side,
            price: price,
          });
        }
      }
    }
    
    // 2. 각 홀더의 전체 포지션 수 조회 (병렬, 10개씩 배치)
    const analyzeHolder = async (holder) => {
      try {
        const posRes = await fetch(
          `https://data-api.polymarket.com/positions?user=${holder.wallet}&sizeThreshold=100`,
          { next: { revalidate: 300 } }
        );
        const positions = await posRes.json();
        
        const totalMarkets = positions.length;
        const totalValue = positions.reduce((sum, p) => sum + (p.size || 0), 0);
        
        // 해당 마켓 비중 계산 (shares 기준)
        const marketRatio = totalValue > 0 ? holder.shares / totalValue : 1;
        
        // 내부자 점수 계산
        let score = 0;
        
        // 1. 마켓 수 적으면 의심 (핵심 지표)
        if (totalMarkets <= 1) score += 50;
        else if (totalMarkets <= 2) score += 45;
        else if (totalMarkets <= 3) score += 35;
        else if (totalMarkets <= 5) score += 25;
        else if (totalMarkets <= 10) score += 10;
        
        // 2. 포지션 가치 크면 의심 (실제 달러 가치 기준)
        if (holder.amount >= 50000) score += 30;
        else if (holder.amount >= 20000) score += 25;
        else if (holder.amount >= 10000) score += 20;
        else if (holder.amount >= 5000) score += 15;
        else if (holder.amount >= 1000) score += 10;
        
        // 3. 해당 마켓 비중 높으면 의심
        if (marketRatio >= 0.9) score += 20;
        else if (marketRatio >= 0.7) score += 15;
        else if (marketRatio >= 0.5) score += 10;
        
        return {
          ...holder,
          totalMarkets,
          totalValue,
          marketRatio: Math.round(marketRatio * 100),
          score,
        };
      } catch (err) {
        return {
          ...holder,
          totalMarkets: -1,
          totalValue: 0,
          marketRatio: 0,
          score: 0,
          error: true,
        };
      }
    };
    
    // 병렬 처리 (10개씩)
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
      .filter(h => h.amount >= 5000)  // Position value $5K 이상
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
