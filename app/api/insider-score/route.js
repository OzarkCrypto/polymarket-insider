// 서버 캐시 (5분)
let cache = {
  data: null,
  timestamp: 0,
};
const CACHE_DURATION = 5 * 60 * 1000; // 5분

const BLACKLIST = [
  '0xa5ef39c3d3e10d0b270233af41cac69796b12966'
];

const COMPANIES = [
  { name: 'OpenAI', keywords: ['openai', 'chatgpt', 'gpt-5', 'gpt5', 'sam altman'] },
  { name: 'Anthropic', keywords: ['anthropic', 'claude'] },
  { name: 'Google', keywords: ['google', 'alphabet', 'deepmind', 'gemini'] },
  { name: 'Apple', keywords: ['apple', 'iphone', 'ipad', 'tim cook', 'vision pro'] },
  { name: 'Microsoft', keywords: ['microsoft', 'msft', 'satya nadella', 'bing', 'copilot'] },
  { name: 'Meta', keywords: ['meta', 'facebook', 'instagram', 'zuckerberg', 'threads', 'whatsapp'] },
  { name: 'Amazon', keywords: ['amazon', 'aws', 'bezos', 'alexa'] },
  { name: 'Tesla', keywords: ['tesla', 'elon musk', 'cybertruck', 'model 3', 'model y', 'robotaxi'] },
  { name: 'Nvidia', keywords: ['nvidia', 'nvda', 'jensen huang'] },
  { name: 'SpaceX', keywords: ['spacex', 'starship', 'starlink', 'falcon'] },
  { name: 'xAI', keywords: ['xai', 'grok'] },
  { name: 'Netflix', keywords: ['netflix', 'warner'] },
  { name: 'Twitter/X', keywords: ['twitter', ' x.com', 'x corp', 'x ceo'] },
  { name: 'TikTok', keywords: ['tiktok', 'bytedance'] },
  { name: 'Uber', keywords: ['uber'] },
  { name: 'Stripe', keywords: ['stripe'] },
  { name: 'Discord', keywords: ['discord'] },
  { name: 'Snap', keywords: ['snap', 'snapchat'] },
  { name: 'Adobe', keywords: ['adobe'] },
  { name: 'Salesforce', keywords: ['salesforce'] },
  { name: 'Oracle', keywords: ['oracle', 'larry ellison'] },
  { name: 'IBM', keywords: ['ibm'] },
  { name: 'Intel', keywords: ['intel'] },
  { name: 'AMD', keywords: [' amd ', 'advanced micro'] },
  { name: 'Palantir', keywords: ['palantir'] },
  { name: 'Databricks', keywords: ['databricks'] },
  { name: 'Perplexity', keywords: ['perplexity'] },
  { name: 'Kraken', keywords: ['kraken'] },
  { name: 'Coinbase', keywords: ['coinbase'] },
  { name: 'Robinhood', keywords: ['robinhood'] },
  { name: 'Fed', keywords: ['fed ', 'fomc', 'powell', 'interest rate'] },
];

function extractCompany(question) {
  const q = question.toLowerCase();
  for (const company of COMPANIES) {
    for (const keyword of company.keywords) {
      if (q.includes(keyword)) return company.name;
    }
  }
  return null;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {}
  }
  return null;
}

async function computeInsiderScores() {
  // 1. 마켓 목록 직접 가져오기 (route.js 로직과 동일하게)
  const MIN_VOLUME = 5000;
  
  const INSIDER_KEYWORDS = [
    'acquisition', 'acquire', 'merger', 'buyout', 'ipo', 'go public',
    'ceo', 'step down', 'resign', 'fired', 'release', 'launch', 'announce',
    'model', 'gpt', 'claude', 'gemini', 'llama', 'grok',
    'partner', 'deal', 'ban', 'approve', 'rate cut', 'rate hike', 'fed ',
    'airdrop', 'sentenced', 'arrested', 'jail', 'prison',
    'outage', 'settlement', 'lawsuit',
  ];

  const MAJOR_COMPANIES = [
    'apple', 'google', 'microsoft', 'amazon', 'meta', 'netflix',
    'nvidia', 'tesla', 'spacex', 'openai', 'anthropic', 'xai',
  ];

  const EXCLUDE_KEYWORDS = [
    'trump', 'biden', 'election', 'war', 'ukraine', 'russia',
    'nfl', 'nba', 'super bowl', 'bitcoin', 'ethereum',
  ];

  // Polymarket API 직접 호출
  const [offset0, offset100, offset200] = await Promise.all([
    fetchWithRetry('https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=0'),
    fetchWithRetry('https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=100'),
    fetchWithRetry('https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=200'),
  ]);

  const allEvents = [...(offset0 || []), ...(offset100 || []), ...(offset200 || [])];
  const markets = [];

  for (const event of allEvents) {
    if (!event.markets) continue;
    for (const market of event.markets) {
      if (market.closed || !market.active) continue;
      const volume = market.volumeNum || parseFloat(market.volume) || 0;
      if (volume < MIN_VOLUME) continue;

      const combined = ((market.question || '') + ' ' + (event.title || '')).toLowerCase();
      
      if (EXCLUDE_KEYWORDS.some(kw => combined.includes(kw))) continue;
      
      const hasKeyword = INSIDER_KEYWORDS.some(kw => combined.includes(kw));
      const hasCompany = MAJOR_COMPANIES.some(c => combined.includes(c));
      if (!hasKeyword && !hasCompany) continue;

      markets.push({
        conditionId: market.conditionId,
        question: market.question,
        slug: market.slug,
        eventSlug: event.slug,
        image: market.image || event.image,
        volume,
      });
    }
  }

  if (markets.length === 0) return [];

  // 기업별 마켓 매핑
  const companyMarkets = {};
  const marketConditionIds = new Set();
  const marketInfoMap = {};

  markets.forEach(market => {
    marketConditionIds.add(market.conditionId);
    marketInfoMap[market.conditionId] = market;
    const company = extractCompany(market.question);
    if (company) {
      if (!companyMarkets[company]) companyMarkets[company] = [];
      companyMarkets[company].push(market);
    }
  });

  // 2. 각 마켓의 Top 홀더 수집 (병렬, 50개씩)
  const uniqueWallets = new Set();
  const walletNames = {};

  const batchSize = 50;
  for (let i = 0; i < markets.length; i += batchSize) {
    const batch = markets.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(m => 
        fetchWithRetry(`https://data-api.polymarket.com/positions?market=${m.conditionId}&sizeThreshold=0&limit=100`)
      )
    );

    results.forEach(data => {
      if (!data) return;
      (Array.isArray(data) ? data : []).forEach(pos => {
        const wallet = pos.proxyWallet || pos.wallet;
        if (!wallet || BLACKLIST.includes(wallet.toLowerCase())) return;
        uniqueWallets.add(wallet);
        if (pos.name && !walletNames[wallet]) walletNames[wallet] = pos.name;
      });
    });
  }

  // 3. 각 지갑의 포지션 수집 (병렬, 20개씩)
  const holdersMap = {};
  const walletArray = Array.from(uniqueWallets);

  for (let i = 0; i < walletArray.length; i += 20) {
    const batch = walletArray.slice(i, i + 20);
    const results = await Promise.all(
      batch.map(wallet =>
        fetchWithRetry(`https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=0`)
      )
    );

    results.forEach((data, idx) => {
      const wallet = batch[idx];
      if (!data || !Array.isArray(data)) return;

      const relevantPositions = data.filter(pos => 
        marketConditionIds.has(pos.conditionId)
      );

      if (relevantPositions.length === 0) return;

      holdersMap[wallet] = {
        wallet,
        name: walletNames[wallet],
        totalShares: 0,
        positions: [],
        companyPositions: {},
      };

      relevantPositions.forEach(pos => {
        const market = marketInfoMap[pos.conditionId];
        if (!market) return;

        const company = extractCompany(market.question);
        const side = pos.outcome === 'Yes' ? 'YES' : 'NO';
        const amount = parseFloat(pos.size) || 0;

        holdersMap[wallet].totalShares += amount;
        holdersMap[wallet].positions.push({
          market: market.question,
          marketSlug: market.slug,
          eventSlug: market.eventSlug,
          image: market.image,
          company,
          side,
          amount,
        });

        if (company) {
          if (!holdersMap[wallet].companyPositions[company]) {
            holdersMap[wallet].companyPositions[company] = {
              markets: [],
              totalAmount: 0,
              yesCount: 0,
              noCount: 0,
            };
          }
          holdersMap[wallet].companyPositions[company].markets.push({
            question: market.question,
            side,
            amount,
          });
          holdersMap[wallet].companyPositions[company].totalAmount += amount;
          if (side === 'YES') {
            holdersMap[wallet].companyPositions[company].yesCount++;
          } else {
            holdersMap[wallet].companyPositions[company].noCount++;
          }
        }
      });
    });
  }

  // 4. Insider Score 계산
  const insiders = Object.values(holdersMap).map(holder => {
    const companies = Object.keys(holder.companyPositions);
    const totalPositions = holder.positions.length;

    let focusCompany = null;
    let focusCompanyData = null;
    let maxPortfolioRatio = 0;

    companies.forEach(company => {
      const companyData = holder.companyPositions[company];
      const portfolioRatio = companyData.markets.length / totalPositions;

      if (portfolioRatio > maxPortfolioRatio) {
        maxPortfolioRatio = portfolioRatio;
        focusCompany = company;
        focusCompanyData = companyData;
      }
    });

    const portfolioConcentration = maxPortfolioRatio;

    let marketCoverage = 0;
    if (focusCompany && focusCompanyData) {
      const totalMarketsForCompany = companyMarkets[focusCompany]?.length || 1;
      marketCoverage = Math.min(1, focusCompanyData.markets.length / totalMarketsForCompany);
    }

    let directionConsistency = 0;
    if (focusCompanyData) {
      const total = focusCompanyData.yesCount + focusCompanyData.noCount;
      const dominant = Math.max(focusCompanyData.yesCount, focusCompanyData.noCount);
      directionConsistency = total > 0 ? dominant / total : 0;
    }

    const companyPositionValue = focusCompanyData?.totalAmount || 0;
    let positionValueScore = 0;
    if (companyPositionValue >= 50000) {
      positionValueScore = 1;
    } else if (companyPositionValue >= 1000) {
      positionValueScore = Math.log10(companyPositionValue / 1000) / Math.log10(50);
    }

    const score = Math.round(
      (portfolioConcentration * 45) +
      (positionValueScore * 30) +
      (marketCoverage * 15) +
      (directionConsistency * 10)
    );

    return {
      wallet: holder.wallet,
      name: holder.name,
      score,
      focusCompany,
      focusCompanyMarkets: focusCompanyData?.markets.length || 0,
      totalCompanyMarkets: focusCompany ? (companyMarkets[focusCompany]?.length || 0) : 0,
      totalMarkets: totalPositions,
      totalShares: holder.totalShares,
      companyShares: focusCompanyData?.totalAmount || 0,
      direction: focusCompanyData
        ? (focusCompanyData.yesCount > focusCompanyData.noCount ? 'YES' : 'NO')
        : '-',
      positionValue: companyPositionValue,
      portfolioRatio: (maxPortfolioRatio * 100).toFixed(0),
      positions: holder.positions,
      companyPositions: holder.companyPositions,
    };
  });

  return insiders
    .filter(i => i.score >= 20 && i.focusCompany)
    .sort((a, b) => b.score - a.score);
}

export async function GET() {
  try {
    const now = Date.now();

    // 캐시 유효하면 바로 반환
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      return Response.json({
        insiders: cache.data,
        cached: true,
        cacheAge: Math.round((now - cache.timestamp) / 1000),
      });
    }

    // 새로 계산
    const insiders = await computeInsiderScores();

    // 캐시 저장
    cache = {
      data: insiders,
      timestamp: now,
    };

    return Response.json({
      insiders,
      cached: false,
      cacheAge: 0,
    });
  } catch (error) {
    console.error('Error computing insider scores:', error);
    
    // 에러 시 기존 캐시 반환 (있으면)
    if (cache.data) {
      return Response.json({
        insiders: cache.data,
        cached: true,
        cacheAge: Math.round((Date.now() - cache.timestamp) / 1000),
        error: 'Using stale cache due to error',
      });
    }

    return Response.json({ error: error.message, insiders: [] }, { status: 500 });
  }
}
