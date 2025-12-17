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
function calculateScore(holder, marketRatio, totalMarkets, accountAgeDays, marketEntryDays, extraData = {}) {
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
  
  // === 새로운 내부자 탐지 요소 ===
  
  // 6. 역베팅 점수 (최대 30점) - 낮은 확률에 큰 금액 베팅
  const avgPrice = extraData.avgPrice || 0;
  const shares = extraData.shares || 0;
  
  // 현재 가치 기준 또는 shares 기준 (롱샷 베팅)
  if (avgPrice > 0 && avgPrice < 0.15) {
    if (holder.amount >= 5000 || shares >= 20000) {
      score += 30;  // 15% 미만 확률에 큰 베팅
    } else if (holder.amount >= 3000 || shares >= 10000) {
      score += 20;
    }
  } else if (avgPrice > 0 && avgPrice < 0.25) {
    if (holder.amount >= 3000 || shares >= 15000) {
      score += 20;
    } else if (holder.amount >= 1000 || shares >= 5000) {
      score += 10;
    }
  } else if (avgPrice > 0 && avgPrice < 0.35 && holder.amount >= 1000) {
    score += 10;
  }
  
  // 7. 승리 횟수 대비 계정 나이 (최대 25점) - 짧은 기간에 많은 승리
  const winCount = extraData.winCount || 0;
  const winsPerMonth = accountAgeDays > 0 ? (winCount / accountAgeDays) * 30 : 0;
  if (winCount >= 10 && winsPerMonth >= 15) {
    score += 25;  // 월 15승 이상
  } else if (winCount >= 5 && winsPerMonth >= 8) {
    score += 15;  // 월 8승 이상
  } else if (winCount >= 3 && winsPerMonth >= 4) {
    score += 8;   // 월 4승 이상
  }
  
  // 8. 카테고리 집중도 (최대 25점) - 특정 분야만 베팅
  const categoryRatio = extraData.categoryRatio || 0;
  if (categoryRatio >= 0.8 && totalMarkets >= 3) {
    score += 25;  // 80% 이상 같은 카테고리
  } else if (categoryRatio >= 0.6 && totalMarkets >= 3) {
    score += 15;  // 60% 이상 같은 카테고리
  } else if (categoryRatio >= 0.4 && totalMarkets >= 3) {
    score += 8;   // 40% 이상 같은 카테고리
  }
  
  // === 내부자 특성 가점 ===
  
  // 9. 높은 승리 횟수 (최대 35점)
  if (winCount >= 50) {
    score += 35;
  } else if (winCount >= 30) {
    score += 25;
  } else if (winCount >= 15) {
    score += 15;
  } else if (winCount >= 5) {
    score += 5;
  }
  
  // 10. REDEEM 총액 (최대 70점) - 실제 수익 실현 = 핵심 지표
  const redeemTotal = extraData.redeemTotal || 0;
  if (redeemTotal >= 100000) {
    score += 70;  // $100K+ 청산 = 확실한 내부자
  } else if (redeemTotal >= 50000) {
    score += 50;  // $50K+ 청산
  } else if (redeemTotal >= 20000) {
    score += 30;  // $20K+ 청산
  } else if (redeemTotal >= 5000) {
    score += 15;  // $5K+ 청산
  }
  
  // 콤보 가점: 카테고리 집중 + 높은 REDEEM = 전문 내부자
  if (categoryRatio >= 0.5 && redeemTotal >= 50000) {
    score += 25;  // 집중 + 고수익 콤보
  }
  
  // 11. 수익률 기반 가점 (REDEEM / totalValue)
  const profitRatio = totalValue > 0 ? redeemTotal / totalValue : 0;
  if (profitRatio >= 5) {
    score += 30;  // 투자금 대비 5배 이상 수익
  } else if (profitRatio >= 3) {
    score += 20;  // 3배 이상
  } else if (profitRatio >= 2) {
    score += 10;  // 2배 이상
  }
  
  // 11. 높은 수익률 (최대 30점)
  const totalPnl = extraData.totalPnl || 0;
  const totalValue = extraData.totalValue || 1;
  const pnlRatio = totalValue > 0 ? totalPnl / totalValue : 0;
  
  if (pnlRatio >= 1.0) {
    score += 30;  // +100% 이상 수익
  } else if (pnlRatio >= 0.5) {
    score += 20;  // +50% 이상 수익
  } else if (pnlRatio >= 0.2) {
    score += 10;  // +20% 이상 수익
  }
  
  // === 내부자 아닌 특성 감점 ===
  
  // 12. Open PnL 마이너스 감점
  if (pnlRatio < -1.0) {
    score -= 40;
  } else if (pnlRatio < -0.5) {
    score -= 30;
  } else if (pnlRatio < -0.2) {
    score -= 15;
  }
  
  // 13. 분산 투자 감점 - 단, 카테고리 집중도 높거나 승리 많으면 감점 감소/무효
  const focusedInvestor = categoryRatio >= 0.4 || winCount >= 15 || redeemTotal >= 20000;
  if (!focusedInvestor) {
    if (totalMarkets >= 50) {
      score -= 30;
    } else if (totalMarkets >= 20) {
      score -= 20;
    } else if (totalMarkets >= 10) {
      score -= 10;
    }
  }
  
  // 14. 손실 + 분산 콤보 = 확실히 내부자 아님
  if (pnlRatio < -0.3 && totalMarkets >= 10 && !focusedInvestor) {
    score -= 15;
  }
  
  return { score, isCamouflage };
}

// 단일 홀더 분석
async function analyzeHolder(holder, conditionId) {
  try {
    const [positions, activities, oldestActivity, redeemActivity] = await Promise.all([
      fetchJSON(`${POLYMARKET_API}/positions?user=${holder.wallet}&sizeThreshold=100`),
      fetchJSON(`${POLYMARKET_API}/activity?user=${holder.wallet}&limit=200`),
      // 계정 나이용 - 가장 오래된 거래 1개만 가져오기
      fetchJSON(`${POLYMARKET_API}/activity?user=${holder.wallet}&limit=1&sortBy=TIMESTAMP&sortDirection=ASC`),
      // 승리 횟수용 - REDEEM 기록
      fetchJSON(`${POLYMARKET_API}/activity?user=${holder.wallet}&limit=200&type=REDEEM`)
    ]);
    
    const totalMarkets = positions.length;
    
    // 전체 포지션 가치 - currentValue 사용 (USD)
    const totalValue = positions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
    
    // 이 마켓에서의 포지션 가치 - currentValue만 사용
    const thisMarketPos = positions.find(p => p.conditionId === conditionId);
    const thisMarketValue = thisMarketPos?.currentValue || 0;
    
    // thisMarketValue가 0이면 스킵 (포지션 없음)
    if (thisMarketValue < 100) {
      return null;
    }
    
    const marketRatio = totalValue > 0 ? thisMarketValue / totalValue : 1;
    
    // PnL - positions에서 계산 (realizedPnl + cashPnl)
    let allTimePnl = 0;
    let monthPnl = 0;
    
    // positions에서 PnL 계산: realizedPnl (실현) + cashPnl (미실현)
    allTimePnl = positions.reduce((sum, p) => {
      const realized = p.realizedPnl || 0;
      const unrealized = p.cashPnl || 0;
      return sum + realized + unrealized;
    }, 0);
    
    // 계정 나이 - 가장 오래된 거래 기준
    let accountAgeDays = 999;
    if (oldestActivity && oldestActivity.length > 0 && oldestActivity[0].timestamp) {
      const firstTs = oldestActivity[0].timestamp;
      accountAgeDays = Math.floor((Date.now() - firstTs * 1000) / (1000 * 60 * 60 * 24));
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
    
    // === 새로운 내부자 탐지 데이터 ===
    
    // 역베팅 탐지: 이 마켓의 평균 매수 가격
    const avgPrice = thisMarketPos?.avgPrice || 0;
    
    // 승리 횟수: REDEEM 기록 수
    const winCount = redeemActivity?.length || 0;
    
    // REDEEM 총액: 실제 청산 금액
    const redeemTotal = redeemActivity?.reduce((sum, r) => sum + (r.size || 0), 0) || 0;
    
    // 카테고리 집중도: 같은 eventSlug 또는 같은 키워드를 가진 마켓 비율
    let categoryRatio = 0;
    if (positions.length >= 2) {
      // 방법 1: eventSlug 기반
      const eventSlugs = positions.map(p => p.eventSlug).filter(s => s);
      const slugCounts = {};
      eventSlugs.forEach(s => slugCounts[s] = (slugCounts[s] || 0) + 1);
      const maxSlugCount = Math.max(...Object.values(slugCounts), 0);
      const slugRatio = positions.length > 0 ? maxSlugCount / positions.length : 0;
      
      // 방법 2: 키워드 기반 (OpenAI, Gemini 등)
      const keywords = ['openai', 'gpt', 'chatgpt', 'gemini', 'google', 'anthropic', 'claude', 'meta', 'llama'];
      let keywordMatches = 0;
      for (const p of positions) {
        const title = (p.title || '').toLowerCase();
        if (keywords.some(kw => title.includes(kw))) {
          keywordMatches++;
        }
      }
      const keywordRatio = positions.length > 0 ? keywordMatches / positions.length : 0;
      
      // 더 높은 값 사용
      categoryRatio = Math.max(slugRatio, keywordRatio);
    }
    
    const extraData = { avgPrice, winCount, categoryRatio, totalPnl: allTimePnl, totalValue, redeemTotal, shares: holder.shares };
    
    const { score, isCamouflage } = calculateScore(
      { ...holder, amount: thisMarketValue }, marketRatio, totalMarkets, accountAgeDays, marketEntryDays, extraData
    );
    
    return {
      ...holder,
      amount: thisMarketValue,  // currentValue (USD)
      totalMarkets,
      marketRatio: Math.round(marketRatio * 100),
      accountAgeDays,
      marketEntryDays,
      isCamouflage,
      score,
      allTimePnl: Math.round(allTimePnl),
      monthPnl: Math.round(monthPnl),
      // 새로운 필드
      avgPrice: Math.round(avgPrice * 100),  // 퍼센트로 저장
      winCount,
      categoryRatio: Math.round(categoryRatio * 100)
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
          // 낮은 확률 베팅도 포함 (shares가 크면 잠재 수익이 큼)
          else if (shares >= 10000 && price < 0.30) {
            allHolders.push({
              wallet: holder.proxyWallet,
              name: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : holder.pseudonym,
              shares,
              amount: positionValue,
              side,
              price,
              isLongshot: true  // 롱샷 베팅 표시
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
    .slice(0, 150); // Top 150만 저장
  
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
