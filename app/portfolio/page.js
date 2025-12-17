'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const BANKROLL = 10000; // $10K

// 카테고리 분류
const CATEGORY_KEYWORDS = {
  'AI/Tech': ['openai', 'gpt', 'claude', 'gemini', 'anthropic', 'google', 'apple', 'microsoft', 'meta', 'nvidia', 'tesla'],
  'Government': ['fed ', 'fomc', 'rate', 'fda', 'sec', 'cabinet', 'secretary', 'nominate', 'trump', 'biden'],
  'Legal': ['epstein', 'diddy', 'weinstein', 'trial', 'sentenced', 'indicted', 'files', 'lawsuit'],
  'Crypto': ['bitcoin', 'btc', 'eth', 'airdrop', 'token', 'solana', 'crypto'],
  'Entertainment': ['movie', 'album', 'tour', 'netflix', 'disney', 'spotify'],
};

function categorizeMarket(question) {
  const q = (question || '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) return category;
  }
  return 'Other';
}

// 상관관계 클러스터 정의
const CORRELATION_CLUSTERS = {
  'OpenAI': ['openai', 'gpt', 'sam altman', 'chatgpt'],
  'Fed/Rates': ['fed ', 'fomc', 'rate cut', 'rate hike', 'interest rate'],
  'Epstein': ['epstein'],
  'Trump Admin': ['trump', 'cabinet', 'secretary', 'nominate'],
  'Google/Gemini': ['google', 'gemini', 'alphabet'],
  'Meta': ['meta', 'facebook', 'instagram', 'zuckerberg'],
};

function getCluster(question) {
  const q = (question || '').toLowerCase();
  for (const [cluster, keywords] of Object.entries(CORRELATION_CLUSTERS)) {
    if (keywords.some(kw => q.includes(kw))) return cluster;
  }
  return null;
}

// PTJ 스타일 포지션 사이징
function ptjPositionSize(signal, bankroll) {
  const score = signal.maxScore || 0;
  
  // 티어 결정
  let tier, maxPct, confidence;
  if (score >= 200) {
    tier = 'S';
    maxPct = 0.05;
    confidence = 0.9;
  } else if (score >= 150) {
    tier = 'A';
    maxPct = 0.03;
    confidence = 0.7;
  } else if (score >= 100) {
    tier = 'B';
    maxPct = 0.015;
    confidence = 0.5;
  } else {
    tier = 'C';
    maxPct = 0.005;
    confidence = 0.3;
  }
  
  // 1/4 Kelly (보수적)
  const baseSize = maxPct * confidence * 0.25;
  const size = Math.min(baseSize * bankroll, bankroll * maxPct);
  
  return { tier, size: Math.round(size), maxPct, confidence };
}

// Ken Griffin 스타일 포지션 사이징
function kgPositionSize(signal, bankroll, clusterExposure) {
  const score = signal.maxScore || 0;
  const cluster = getCluster(signal.markets?.[0]?.question);
  
  // 기본 사이즈 계산
  let basePct;
  if (score >= 200) basePct = 0.04;
  else if (score >= 150) basePct = 0.025;
  else if (score >= 100) basePct = 0.015;
  else basePct = 0.008;
  
  // 클러스터 노출 조정
  let clusterAdjustment = 1.0;
  if (cluster && clusterExposure[cluster]) {
    const currentExposure = clusterExposure[cluster];
    const maxClusterExposure = bankroll * 0.15; // 15% 한도
    const remainingRoom = Math.max(0, maxClusterExposure - currentExposure);
    clusterAdjustment = Math.min(1, remainingRoom / (basePct * bankroll));
  }
  
  const size = Math.round(basePct * bankroll * clusterAdjustment);
  
  return { size, cluster, clusterAdjustment, basePct };
}

// PTJ 포트폴리오 구성
function buildPTJPortfolio(accounts) {
  const positions = [];
  let totalAllocated = 0;
  const maxTotal = BANKROLL * 0.5; // 최대 50% 배치
  
  // S, A 티어만 선별
  const filtered = accounts
    .filter(acc => acc.maxScore >= 100)
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 15);
  
  for (const acc of filtered) {
    if (totalAllocated >= maxTotal) break;
    
    const { tier, size, confidence } = ptjPositionSize(acc, BANKROLL);
    if (size < 50) continue; // $50 미만 스킵
    
    const market = acc.markets?.[0];
    const category = categorizeMarket(market?.question);
    
    // 크립토는 PTJ 스타일에서 스킵
    if (category === 'Crypto') continue;
    
    const actualSize = Math.min(size, maxTotal - totalAllocated);
    totalAllocated += actualSize;
    
    positions.push({
      ...acc,
      tier,
      size: actualSize,
      confidence,
      category,
      stopLoss: -0.3, // 30% 손절
      takeProfit: [0.5, 1.0, 2.0], // 50%, 100%, 200%
    });
  }
  
  return {
    positions,
    totalAllocated,
    cashReserve: BANKROLL - totalAllocated,
    maxDrawdown: totalAllocated * 0.3, // 최대 예상 손실
  };
}

// Ken Griffin 포트폴리오 구성
function buildKGPortfolio(accounts) {
  const positions = [];
  let totalAllocated = 0;
  const maxTotal = BANKROLL * 0.6; // 최대 60% 배치
  const clusterExposure = {};
  const categoryExposure = {};
  
  // 점수순 정렬
  const sorted = accounts
    .filter(acc => acc.maxScore >= 80)
    .sort((a, b) => b.maxScore - a.maxScore);
  
  for (const acc of sorted) {
    if (totalAllocated >= maxTotal) break;
    if (positions.length >= 20) break; // 최대 20개 포지션
    
    const market = acc.markets?.[0];
    const category = categorizeMarket(market?.question);
    const cluster = getCluster(market?.question);
    
    // 카테고리 한도 체크 (25%)
    const categoryLimit = BANKROLL * 0.25;
    if (categoryExposure[category] >= categoryLimit) continue;
    
    const { size, clusterAdjustment } = kgPositionSize(acc, BANKROLL, clusterExposure);
    if (size < 50) continue;
    
    const actualSize = Math.min(size, maxTotal - totalAllocated);
    
    // 노출 업데이트
    totalAllocated += actualSize;
    if (cluster) clusterExposure[cluster] = (clusterExposure[cluster] || 0) + actualSize;
    categoryExposure[category] = (categoryExposure[category] || 0) + actualSize;
    
    positions.push({
      ...acc,
      size: actualSize,
      category,
      cluster,
      clusterAdjustment,
      rebalanceThreshold: 0.2, // 20% 이탈시 리밸런싱
    });
  }
  
  return {
    positions,
    totalAllocated,
    cashReserve: BANKROLL - totalAllocated,
    clusterExposure,
    categoryExposure,
    diversificationScore: Object.keys(clusterExposure).length / 6, // 클러스터 분산도
  };
}

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('ptj');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ptjPortfolio, setPtjPortfolio] = useState(null);
  const [kgPortfolio, setKgPortfolio] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/suspicious');
        const data = await res.json();
        setAccounts(data.accounts || []);
        
        // 포트폴리오 구성
        setPtjPortfolio(buildPTJPortfolio(data.accounts || []));
        setKgPortfolio(buildKGPortfolio(data.accounts || []));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-xl">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-gray-400 hover:text-white text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold mt-1">Copy-Trading Portfolio Manager</h1>
              <p className="text-gray-400">Bankroll: ${BANKROLL.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Last Updated</div>
              <div className="text-green-400">{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('ptj')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'ptj'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🛡️ Paul Tudor Jones
          </button>
          <button
            onClick={() => setActiveTab('kg')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'kg'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            📊 Ken Griffin
          </button>
        </div>

        {/* PTJ Tab */}
        {activeTab === 'ptj' && ptjPortfolio && (
          <div>
            {/* PTJ Philosophy */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="text-blue-400 font-semibold mb-2">💡 PTJ Philosophy</h3>
              <p className="text-gray-300 text-sm">
                "First survive, then make money." 손절은 협상의 대상이 아니다. 
                1/4 Kelly로 보수적 사이징, S/A 티어만 선별, 크립토 제외.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Allocated</div>
                <div className="text-2xl font-bold text-green-400">
                  ${ptjPortfolio.totalAllocated.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">
                  {((ptjPortfolio.totalAllocated / BANKROLL) * 100).toFixed(1)}% of bankroll
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Cash Reserve</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${ptjPortfolio.cashReserve.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">
                  {((ptjPortfolio.cashReserve / BANKROLL) * 100).toFixed(1)}% safe
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Max Drawdown Risk</div>
                <div className="text-2xl font-bold text-red-400">
                  -${ptjPortfolio.maxDrawdown.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">If all stop-losses hit</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Positions</div>
                <div className="text-2xl font-bold text-white">
                  {ptjPortfolio.positions.length}
                </div>
                <div className="text-gray-500 text-sm">Active trades</div>
              </div>
            </div>

            {/* Risk Rules */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">⚠️ PTJ Risk Rules</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Stop-Loss:</span>
                  <span className="text-red-400 ml-2">-30%</span>
                </div>
                <div>
                  <span className="text-gray-400">Take-Profit:</span>
                  <span className="text-green-400 ml-2">+50/100/200%</span>
                </div>
                <div>
                  <span className="text-gray-400">Max Single:</span>
                  <span className="text-yellow-400 ml-2">5%</span>
                </div>
                <div>
                  <span className="text-gray-400">Daily Loss Limit:</span>
                  <span className="text-red-400 ml-2">-$500</span>
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm">Tier</th>
                    <th className="px-4 py-3 text-left text-sm">Account</th>
                    <th className="px-4 py-3 text-left text-sm">Market</th>
                    <th className="px-4 py-3 text-left text-sm">Category</th>
                    <th className="px-4 py-3 text-right text-sm">Score</th>
                    <th className="px-4 py-3 text-right text-sm">Size</th>
                    <th className="px-4 py-3 text-right text-sm">Stop</th>
                  </tr>
                </thead>
                <tbody>
                  {ptjPortfolio.positions.map((pos, i) => (
                    <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          pos.tier === 'S' ? 'bg-yellow-500 text-black' :
                          pos.tier === 'A' ? 'bg-purple-500 text-white' :
                          pos.tier === 'B' ? 'bg-blue-500 text-white' :
                          'bg-gray-500 text-white'
                        }`}>
                          {pos.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={`https://polymarket.com/profile/${pos.wallet}`}
                          target="_blank"
                          className="text-blue-400 hover:underline"
                        >
                          {pos.name || pos.wallet?.slice(0, 10)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                        {pos.markets?.[0]?.question || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          pos.category === 'AI/Tech' ? 'bg-green-900 text-green-300' :
                          pos.category === 'Government' ? 'bg-blue-900 text-blue-300' :
                          pos.category === 'Legal' ? 'bg-red-900 text-red-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {pos.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{pos.maxScore}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        ${pos.size.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-400">
                        -${Math.round(pos.size * 0.3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ken Griffin Tab */}
        {activeTab === 'kg' && kgPortfolio && (
          <div>
            {/* KG Philosophy */}
            <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-4 mb-6">
              <h3 className="text-purple-400 font-semibold mb-2">💡 Ken Griffin Philosophy</h3>
              <p className="text-gray-300 text-sm">
                "Risk is what you don't see." 상관관계 클러스터 관리, 분산 최적화, 
                포트폴리오 레벨 한도, 시스템적 리밸런싱.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Allocated</div>
                <div className="text-2xl font-bold text-green-400">
                  ${kgPortfolio.totalAllocated.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">
                  {((kgPortfolio.totalAllocated / BANKROLL) * 100).toFixed(1)}% deployed
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Cash Reserve</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${kgPortfolio.cashReserve.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Dry powder</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Diversification</div>
                <div className="text-2xl font-bold text-purple-400">
                  {(kgPortfolio.diversificationScore * 100).toFixed(0)}%
                </div>
                <div className="text-gray-500 text-sm">
                  {Object.keys(kgPortfolio.clusterExposure).length} clusters
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Positions</div>
                <div className="text-2xl font-bold text-white">
                  {kgPortfolio.positions.length}
                </div>
                <div className="text-gray-500 text-sm">Max 20</div>
              </div>
            </div>

            {/* Cluster Exposure */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">📊 Cluster Exposure (Max 15% each)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(kgPortfolio.clusterExposure).map(([cluster, amount]) => {
                  const pct = (amount / BANKROLL) * 100;
                  const isNearLimit = pct > 12;
                  return (
                    <div key={cluster} className="flex items-center justify-between">
                      <span className="text-gray-300">{cluster}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${isNearLimit ? 'bg-yellow-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(pct / 15 * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm ${isNearLimit ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Exposure */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">🏷️ Category Exposure (Max 25% each)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(kgPortfolio.categoryExposure).map(([cat, amount]) => {
                  const pct = (amount / BANKROLL) * 100;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <span className={`text-sm px-2 py-1 rounded ${
                        cat === 'AI/Tech' ? 'bg-green-900 text-green-300' :
                        cat === 'Government' ? 'bg-blue-900 text-blue-300' :
                        cat === 'Legal' ? 'bg-red-900 text-red-300' :
                        cat === 'Crypto' ? 'bg-orange-900 text-orange-300' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {cat}
                      </span>
                      <span className="text-gray-400">${amount.toLocaleString()} ({pct.toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm">#</th>
                    <th className="px-4 py-3 text-left text-sm">Account</th>
                    <th className="px-4 py-3 text-left text-sm">Market</th>
                    <th className="px-4 py-3 text-left text-sm">Cluster</th>
                    <th className="px-4 py-3 text-right text-sm">Score</th>
                    <th className="px-4 py-3 text-right text-sm">Size</th>
                    <th className="px-4 py-3 text-right text-sm">Adj.</th>
                  </tr>
                </thead>
                <tbody>
                  {kgPortfolio.positions.map((pos, i) => (
                    <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <a 
                          href={`https://polymarket.com/profile/${pos.wallet}`}
                          target="_blank"
                          className="text-purple-400 hover:underline"
                        >
                          {pos.name || pos.wallet?.slice(0, 10)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                        {pos.markets?.[0]?.question || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {pos.cluster ? (
                          <span className="text-xs px-2 py-1 rounded bg-purple-900 text-purple-300">
                            {pos.cluster}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{pos.maxScore}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        ${pos.size.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400">
                        {pos.clusterAdjustment < 1 ? (
                          <span className="text-yellow-400">
                            {(pos.clusterAdjustment * 100).toFixed(0)}%
                          </span>
                        ) : '100%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Comparison */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="font-semibold mb-4">📈 Strategy Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-2 text-left">Metric</th>
                  <th className="px-4 py-2 text-right text-blue-400">PTJ</th>
                  <th className="px-4 py-2 text-right text-purple-400">Ken Griffin</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="px-4 py-2">Total Allocated</td>
                  <td className="px-4 py-2 text-right">${ptjPortfolio?.totalAllocated.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">${kgPortfolio?.totalAllocated.toLocaleString()}</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="px-4 py-2">Positions</td>
                  <td className="px-4 py-2 text-right">{ptjPortfolio?.positions.length}</td>
                  <td className="px-4 py-2 text-right">{kgPortfolio?.positions.length}</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="px-4 py-2">Avg Position Size</td>
                  <td className="px-4 py-2 text-right">
                    ${ptjPortfolio?.positions.length > 0 
                      ? Math.round(ptjPortfolio.totalAllocated / ptjPortfolio.positions.length).toLocaleString() 
                      : 0}
                  </td>
                  <td className="px-4 py-2 text-right">
                    ${kgPortfolio?.positions.length > 0 
                      ? Math.round(kgPortfolio.totalAllocated / kgPortfolio.positions.length).toLocaleString() 
                      : 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="px-4 py-2">Cash Reserve</td>
                  <td className="px-4 py-2 text-right">{((ptjPortfolio?.cashReserve / BANKROLL) * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2 text-right">{((kgPortfolio?.cashReserve / BANKROLL) * 100).toFixed(0)}%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="px-4 py-2">Risk Profile</td>
                  <td className="px-4 py-2 text-right text-green-400">Conservative</td>
                  <td className="px-4 py-2 text-right text-yellow-400">Balanced</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Focus</td>
                  <td className="px-4 py-2 text-right">Survival First</td>
                  <td className="px-4 py-2 text-right">Optimization</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
