export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('market');
  
  if (!conditionId) {
    return Response.json({ error: 'market parameter required' }, { status: 400 });
  }
  
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/holders?market=${conditionId}&limit=10`,
      { next: { revalidate: 300 } }
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
