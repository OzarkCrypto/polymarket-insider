#!/usr/bin/env node

/**
 * Polymarket Insider Scanner
 * 모든 insider-possible 마켓을 스캔하고 의심 계정을 수집
 * GitHub Actions에서 3시간마다 실행
 */

const fs = require('fs');
const path = require('path');

// API endpoints
const MARKETS_API = 'https://polymarket-insider-filter.vercel.app/api/markets';
const POLYMARKET_API = 'https://data-api.polymarket.com';

// 설정
const MIN_POSITION_VALUE = 5000;  // $5K 이상만
const MIN_SCORE = 50;             // 50점 이상만
const TOP_HOLDERS_LIMIT = 30;     // 마켓당 상위 30명만 분석
const BATCH_SIZE = 5;             // 병렬 처리 배치 크기
const DELAY_MS = 500;             // API 호출 간 딜레이

// 유틸리티 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// 의심 계정 점수 계산
function calculateScore(holder, marketRatio, totalMarkets, accountAgeDays, marketEntryDays) {
  let score = 0;
  
  // 1. 마켓 진입 시점 (최대 35점)
  if (marketEntryDays <= 3) score += 35;
  else if (marketEntryDays <= 7) score += 25;
  else if (marketEntryDays <= 14) score += 15;
  
  // 2. 계정 활동 기간 (최대 25점)
  if (accountAgeDays <= 7) score += 25;
  else if (accountAgeDays <= 30) score += 15;
  else if (accountAgeDays <= 90) score += 5;
  
  // 3. 마켓 집중도 (최대 25점)
  if (totalMarkets <= 1) score += 25;
  else if (totalMarkets <= 2) score += 20;
  else if (totalMarkets <= 3) score += 15;
  else if (totalMarkets <= 5) score += 5;
  
  // 4. 포지션 가치 (최대 15점)
  if (holder.amount >= 50000) score += 15;
  else if (holder.amount >= 20000) score += 12;
  else if (holder.amount >= 10000) score += 10;
  else if (holder.amount >= 5000) score += 5;
  
  // 5. 위장 분산 탐지 (보너스)
  const expectedRatio = totalMarkets > 0 ? 100 / totalMarkets : 100;
  const ratioMultiple = (marketRatio * 100) / expectedRatio;
  
  let isCamouflage = false;
  if (totalMarkets >= 6 && ratioMultiple >= 3) {
    score += 20;
    isCamouflage = true;
  }
  if (totalMarkets >= 10 && ratioMultiple >= 5) {
    score += 10;
  }
  
  return { score, isCamouflage };
}

// 단일 홀더 분석
async function analyzeHolder(holder, conditionId) {
  try {
    const [positions, activities, profile] = await Promise.all([
      fetchJSON(`${POLYMARKET_API}/positions?user=${holder.wallet}&sizeThreshold=100`),
      fetchJSON(`${POLYMARKET_API}/activity?user=${holder.wallet}&limit=200`),
      fetchJSON(`${POLYMARKET_API}/profile/${holder.wallet}`).catch(() => null)
    ]);
    
    const totalMarkets = positions.length;
    
    // 전체 포지션 가치 (currentValue 사용)
    const totalValue = positions.reduce((sum, p) => sum + (p.currentValue || p.size || 0), 0);
    
    // 이 마켓에서의 포지션 가치
    const thisMarketPos = positions.find(p => p.conditionId === conditionId);
    const thisMarketValue = thisMarketPos ? (thisMarketPos.currentValue || thisMarketPos.size || 0) : holder.amount;
    
    const marketRatio = totalValue > 0 ? thisMarketValue / totalValue : 1;
    
    // PnL - profile API에서 가져오기 (더 정확)
    let allTimePnl = 0;
    let monthPnl = 0;
    
    if (profile) {
      allTimePnl = profile.pnl || profile.allTimePnl || 0;
      monthPnl = profile.pnl30d || profile.monthPnl || 0;
    } else {
      // fallback: positions에서 계산
      allTimePnl = positions.reduce((sum, p) => sum + (p.pnl || p.cashPnl || 0), 0);
    }
    
    // 계정 나이
    let accountAgeDays = 999;
    if (activities && activities.length > 0) {
      const timestamps = activities.map(a => a.timestamp).filter(t => t);
      if (timestamps.length > 0) {
        const firstTs = Math.min(...timestamps);
        accountAgeDays = Math.floor((Date.now() - firstTs * 1000) / (1000 * 60 * 60 * 24));
      }
    }
    
    // 이 마켓 첫 베팅 시점
    let marketEntryDays = 999;
    if (activities && activities.length > 0) {
      const marketTrades = activities.filter(a => a.conditionId === conditionId);
      if (marketTrades.length > 0) {
        const marketTs = marketTrades.map(a => a.timestamp).filter(t => t);
        if (marketTs.length > 0) {
          const firstMarketTs = Math.min(...marketTs);
          marketEntryDays = Math.floor((Date.now() - firstMarketTs * 1000) / (1000 * 60 * 60 * 24));
        }
      }
    }
    
    const { score, isCamouflage } = calculateScore(
      { ...holder, amount: thisMarketValue }, marketRatio, totalMarkets, accountAgeDays, marketEntryDays
    );
    
    return {
      ...holder,
      amount: thisMarketValue,
      totalMarkets,
      marketRatio: Math.round(marketRatio * 100),
      accountAgeDays,
      marketEntryDays,
      isCamouflage,
      score,
      allTimePnl: Math.round(allTimePnl),
      monthPnl: Math.round(monthPnl)
    };
  } catch (err) {
    return null;
  }
}

// 단일 마켓 분석
async function analyzeMarket(market) {
  try {
    const holdersData = await fetchJSON(
      `${POLYMARKET_API}/holders?market=${market.conditionId}&limit=${TOP_HOLDERS_LIMIT}`
    );
    
    // outcomePrices에서 가격 추출
    const yesPrice = market.outcomePrices ? parseFloat(market.outcomePrices[0]) : 0.5;
    const noPrice = market.outcomePrices ? parseFloat(market.outcomePrices[1]) : 0.5;
    
    const allHolders = [];
    for (const tokenData of holdersData) {
      if (tokenData.holders) {
        for (const holder of tokenData.holders) {
          const side = holder.outcomeIndex === 0 ? 'YES' : 'NO';
          const shares = holder.amount;
          const price = side === 'YES' ? yesPrice : noPrice;
          const positionValue = shares * price;
          
          if (positionValue >= MIN_POSITION_VALUE) {
            allHolders.push({
              wallet: holder.proxyWallet,
              name: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : holder.pseudonym,
              shares,
              amount: positionValue,
              side,
              price
            });
          }
        }
      }
    }
    
    // 홀더 분석 (배치 처리)
    const analyzed = [];
    for (let i = 0; i < allHolders.length; i += BATCH_SIZE) {
      const batch = allHolders.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(h => analyzeHolder(h, market.conditionId))
      );
      analyzed.push(...results.filter(r => r !== null));
      await sleep(DELAY_MS);
    }
    
    return analyzed.filter(h => h.score >= MIN_SCORE);
  } catch (err) {
    console.error(`Error analyzing market ${market.slug}:`, err.message);
    return [];
  }
}

// 메인 스캔 함수
async function main() {
  console.log('🔍 Polymarket Insider Scanner 시작...\n');
  const startTime = Date.now();
  
  // 1. 마켓 목록 가져오기
  console.log('📋 마켓 목록 가져오는 중...');
  const marketsData = await fetchJSON(MARKETS_API);
  const markets = marketsData.markets || [];
  console.log(`   ${markets.length}개 마켓 발견\n`);
  
  // 2. 각 마켓 분석
  const allSuspicious = new Map(); // wallet -> { account info, markets: [] }
  let processedCount = 0;
  
  for (const market of markets) {
    processedCount++;
    process.stdout.write(`\r⏳ 분석 중: ${processedCount}/${markets.length} - ${market.slug?.slice(0, 30)}...`);
    
    const suspicious = await analyzeMarket(market);
    
    for (const holder of suspicious) {
      const existing = allSuspicious.get(holder.wallet);
      
      const marketInfo = {
        slug: market.slug,
        question: market.question,
        conditionId: market.conditionId,
        side: holder.side,
        amount: holder.amount,
        marketRatio: holder.marketRatio,
        marketEntryDays: holder.marketEntryDays,
        score: holder.score
      };
      
      if (existing) {
        existing.markets.push(marketInfo);
        // 최고 점수 업데이트
        if (holder.score > existing.maxScore) {
          existing.maxScore = holder.score;
        }
        existing.totalValue += holder.amount;
        // PnL은 가장 최신 데이터 사용
        existing.allTimePnl = holder.allTimePnl;
        existing.monthPnl = holder.monthPnl;
      } else {
        allSuspicious.set(holder.wallet, {
          wallet: holder.wallet,
          name: holder.name,
          totalMarkets: holder.totalMarkets,
          accountAgeDays: holder.accountAgeDays,
          isCamouflage: holder.isCamouflage,
          maxScore: holder.score,
          totalValue: holder.amount,
          allTimePnl: holder.allTimePnl,
          monthPnl: holder.monthPnl,
          markets: [marketInfo]
        });
      }
    }
    
    await sleep(300); // 마켓 간 딜레이
  }
  
  console.log('\n\n✅ 스캔 완료!');
  
  // 3. 결과 정리
  const results = Array.from(allSuspicious.values())
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 100); // Top 100만 저장
  
  const output = {
    updatedAt: new Date().toISOString(),
    totalMarketsScanned: markets.length,
    totalSuspiciousAccounts: results.length,
    scanDurationSeconds: Math.round((Date.now() - startTime) / 1000),
    accounts: results
  };
  
  // 4. JSON 저장
  const outputPath = path.join(__dirname, '../public/data/suspicious.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 결과 저장: ${outputPath}`);
  console.log(`   - 의심 계정: ${results.length}개`);
  console.log(`   - 스캔 시간: ${output.scanDurationSeconds}초`);
  
  // 5. 요약 출력
  console.log('\n🏆 Top 10 의심 계정:');
  for (const account of results.slice(0, 10)) {
    const camo = account.isCamouflage ? '🎭' : '';
    const pnl = account.allTimePnl >= 0 ? `+$${account.allTimePnl}` : `-$${Math.abs(account.allTimePnl)}`;
    console.log(`   ${account.maxScore}점 | ${account.name || account.wallet.slice(0, 10)} | $${Math.round(account.totalValue).toLocaleString()} | PnL: ${pnl} ${camo}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
