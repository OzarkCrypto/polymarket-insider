export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('market');
  const wallet = searchParams.get('wallet');
  
  // wallet 파라미터가 있으면 해당 유저의 전체 포지션 반환
  if (wallet) {
    try {
      const res = await fetch(
        `https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=0`,
        { next: { revalidate: 28800 } }
      );
      const data = await res.json();
      return Response.json({ positions: data });
    } catch (error) {
      console.error('Error fetching user positions:', error);
      return Response.json({ positions: [], error: error.message }, { status: 500 });
    }
  }
  
  if (!conditionId) {
    return Response.json({ error: 'market or wallet parameter required' }, { status: 400 });
  }
  
  try {
    // Top 50 홀더로 늘림
    const res = await fetch(
      `https://data-api.polymarket.com/holders?market=${conditionId}&limit=50`,
      { next: { revalidate: 28800 } }
    );
    const data = await res.json();
    
    // Yes와 No 홀더를 분리
    const yesHolders = [];
    const noHolders = [];
    
    for (const tokenData of data) {
      if (tokenData.holders) {
        for (const holder of tokenData.holders) {
          const holderInfo = {
            wallet: holder.proxyWallet,
            name: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : holder.pseudonym,
            amount: holder.amount,
            profileImage: holder.profileImage || holder.profileImageOptimized,
          };
          
          if (holder.outcomeIndex === 0) {
            yesHolders.push(holderInfo);
          } else {
            noHolders.push(holderInfo);
          }
        }
      }
    }
    
    // 보유량 기준 정렬
    yesHolders.sort((a, b) => b.amount - a.amount);
    noHolders.sort((a, b) => b.amount - a.amount);
    
    return Response.json({
      yes: yesHolders.slice(0, 10),
      no: noHolders.slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching holders:', error);
    return Response.json({ yes: [], no: [], error: error.message }, { status: 500 });
  }
}
