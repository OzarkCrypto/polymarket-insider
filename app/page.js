// Updated: Mon Dec 15 06:53:30 UTC 2025
'use client';

import { useState, useEffect } from 'react';

function formatNumber(num) {
  if (num >= 1000000) return `$${Math.round(num / 1000000)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${Math.round(num)}`;
}

function formatAmount(num) {
  if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return Math.round(num).toString();
}

// ========== PORTFOLIO MANAGEMENT ==========
const BANKROLL = 10000;

const CATEGORY_KEYWORDS = {
  'AI/Tech': ['openai', 'gpt', 'claude', 'gemini', 'anthropic', 'google', 'apple', 'microsoft', 'meta', 'nvidia', 'tesla'],
  'Government': ['fed ', 'fomc', 'rate', 'fda', 'sec', 'cabinet', 'secretary', 'nominate', 'trump', 'biden'],
  'Legal': ['epstein', 'diddy', 'weinstein', 'trial', 'sentenced', 'indicted', 'files', 'lawsuit'],
  'Crypto': ['bitcoin', 'btc', 'eth', 'airdrop', 'token', 'solana', 'crypto'],
};

const CORRELATION_CLUSTERS = {
  'OpenAI': ['openai', 'gpt', 'sam altman', 'chatgpt'],
  'Fed/Rates': ['fed ', 'fomc', 'rate cut', 'rate hike'],
  'Epstein': ['epstein'],
  'Trump Admin': ['trump', 'cabinet', 'secretary'],
  'Google': ['google', 'gemini'],
};

function categorizeMarket(question) {
  const q = (question || '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) return category;
  }
  return 'Other';
}

function getCluster(question) {
  const q = (question || '').toLowerCase();
  for (const [cluster, keywords] of Object.entries(CORRELATION_CLUSTERS)) {
    if (keywords.some(kw => q.includes(kw))) return cluster;
  }
  return null;
}

// 마켓 단위로 데이터 재구성
function aggregateByMarket(accounts) {
  const marketMap = {};
  
  for (const acc of accounts) {
    for (const m of (acc.markets || [])) {
      const key = m.slug || m.question;
      if (!marketMap[key]) {
        marketMap[key] = {
          slug: m.slug,
          question: m.question,
          category: categorizeMarket(m.question),
          cluster: getCluster(m.question),
          bets: [],
          totalAmount: 0,
          yesAmount: 0,
          noAmount: 0,
          maxScore: 0,
        };
      }
      
      const bet = {
        wallet: acc.wallet,
        name: acc.name,
        side: m.side,
        amount: m.amount || 0,
        score: m.score || acc.maxScore || 0,
      };
      
      marketMap[key].bets.push(bet);
      marketMap[key].totalAmount += bet.amount;
      if (m.side === 'YES') marketMap[key].yesAmount += bet.amount;
      else marketMap[key].noAmount += bet.amount;
      marketMap[key].maxScore = Math.max(marketMap[key].maxScore, bet.score);
    }
  }
  
  // 방향 결정 (금액 기준)
  for (const market of Object.values(marketMap)) {
    market.direction = market.yesAmount >= market.noAmount ? 'YES' : 'NO';
    market.directionAmount = market.direction === 'YES' ? market.yesAmount : market.noAmount;
    market.consensus = market.totalAmount > 0 
      ? Math.round(market.directionAmount / market.totalAmount * 100) 
      : 0;
    market.avgScore = market.bets.length > 0 
      ? Math.round(market.bets.reduce((s, b) => s + b.score, 0) / market.bets.length)
      : 0;
  }
  
  return Object.values(marketMap);
}

// PTJ Tab Component - Market-based
function PTJTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>;
  }

  const accounts = data?.accounts || [];
  const allMarkets = aggregateByMarket(accounts);
  
  const positions = [];
  let totalAllocated = 0;
  const maxTotal = BANKROLL * 0.5;

  const filtered = allMarkets
    .filter(m => m.maxScore >= 100 && m.category !== 'Crypto')
    .sort((a, b) => b.maxScore - a.maxScore);

  for (const market of filtered) {
    if (totalAllocated >= maxTotal || positions.length >= 10) break;
    
    const score = market.maxScore;
    let tier, maxPct;
    if (score >= 200) { tier = 'S'; maxPct = 0.05; }
    else if (score >= 150) { tier = 'A'; maxPct = 0.03; }
    else { tier = 'B'; maxPct = 0.015; }
    
    const size = Math.round(Math.min(maxPct * BANKROLL * 0.25, maxTotal - totalAllocated));
    if (size < 50) continue;
    
    totalAllocated += size;
    positions.push({ ...market, tier, size });
  }

  const cashReserve = BANKROLL - totalAllocated;

  return (
    <div>
      <div style={{display:'flex',gap:'16px',marginBottom:'12px',fontSize:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontWeight:600}}>🛡️ PTJ</span>
        <span>Allocated: <b style={{color:'var(--green)'}}>${totalAllocated.toLocaleString()}</b></span>
        <span>Cash: <b style={{color:'var(--blue)'}}>${cashReserve.toLocaleString()}</b></span>
        <span>Positions: <b>{positions.length}</b></span>
        <span style={{color:'var(--text-dim)'}}>| Stop: -30% | TP: +50/100/200%</span>
      </div>
      <table className="sus-table">
        <thead><tr>
          <th style={{width:'40px'}}>Tier</th>
          <th style={{width:'45px'}}>Side</th>
          <th>Market</th>
          <th style={{width:'40px'}}>Bets</th>
          <th style={{width:'50px'}}>Score</th>
          <th style={{width:'60px'}}>Size</th>
          <th style={{width:'50px'}}>Stop</th>
        </tr></thead>
        <tbody>
          {positions.map((pos, i) => (
            <tr key={i}>
              <td><span style={{
                padding:'1px 6px',borderRadius:'3px',fontSize:'11px',fontWeight:600,
                background: pos.tier === 'S' ? '#fef3c7' : pos.tier === 'A' ? '#ede9fe' : '#dbeafe',
                color: pos.tier === 'S' ? '#92400e' : pos.tier === 'A' ? '#6b21a8' : '#1e40af'
              }}>{pos.tier}</span></td>
              <td><span style={{
                padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:600,
                background: pos.direction === 'YES' ? '#dcfce7' : '#fee2e2',
                color: pos.direction === 'YES' ? '#166534' : '#991b1b'
              }}>{pos.direction}</span></td>
              <td style={{maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}}>{pos.question || '-'}</td>
              <td style={{fontSize:'11px',color:'var(--text-dim)'}}>{pos.bets.length}</td>
              <td style={{fontFamily:'monospace',fontSize:'12px'}}>{pos.maxScore}</td>
              <td style={{fontFamily:'monospace',color:'var(--green)',fontSize:'12px'}}>${pos.size}</td>
              <td style={{fontFamily:'monospace',color:'var(--red)',fontSize:'11px'}}>-${Math.round(pos.size*0.3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Ken Griffin Tab Component - Market-based
function KenGriffinTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>;
  }

  const accounts = data?.accounts || [];
  const allMarkets = aggregateByMarket(accounts);
  
  const positions = [];
  let totalAllocated = 0;
  const maxTotal = BANKROLL * 0.6;
  const clusterExposure = {};
  const categoryExposure = {};

  const sorted = allMarkets
    .filter(m => m.maxScore >= 80)
    .sort((a, b) => b.maxScore - a.maxScore);

  for (const market of sorted) {
    if (totalAllocated >= maxTotal || positions.length >= 20) break;
    
    const categoryLimit = BANKROLL * 0.25;
    if ((categoryExposure[market.category] || 0) >= categoryLimit) continue;
    
    const score = market.maxScore;
    let basePct;
    if (score >= 200) basePct = 0.04;
    else if (score >= 150) basePct = 0.025;
    else if (score >= 100) basePct = 0.015;
    else basePct = 0.008;
    
    let clusterAdj = 1.0;
    if (market.cluster && clusterExposure[market.cluster]) {
      const maxCluster = BANKROLL * 0.15;
      const remaining = Math.max(0, maxCluster - clusterExposure[market.cluster]);
      clusterAdj = Math.min(1, remaining / (basePct * BANKROLL));
    }
    
    const size = Math.round(basePct * BANKROLL * clusterAdj);
    if (size < 50) continue;
    
    const actualSize = Math.min(size, maxTotal - totalAllocated);
    totalAllocated += actualSize;
    if (market.cluster) clusterExposure[market.cluster] = (clusterExposure[market.cluster] || 0) + actualSize;
    categoryExposure[market.category] = (categoryExposure[market.category] || 0) + actualSize;
    
    positions.push({ ...market, size: actualSize, clusterAdj });
  }

  const cashReserve = BANKROLL - totalAllocated;

  return (
    <div>
      <div style={{display:'flex',gap:'16px',marginBottom:'12px',fontSize:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontWeight:600}}>📊 Griffin</span>
        <span>Allocated: <b style={{color:'var(--green)'}}>${totalAllocated.toLocaleString()}</b></span>
        <span>Cash: <b style={{color:'var(--blue)'}}>${cashReserve.toLocaleString()}</b></span>
        <span>Positions: <b>{positions.length}/20</b></span>
        <span style={{color:'var(--text-dim)'}}>| Clusters: {Object.keys(clusterExposure).length}</span>
      </div>
      
      <div style={{display:'flex',gap:'16px',marginBottom:'12px',fontSize:'11px',flexWrap:'wrap'}}>
        {Object.entries(clusterExposure).map(([cluster, amt]) => {
          const pct = (amt / BANKROLL) * 100;
          return (
            <span key={cluster} style={{background:'#f3f4f6',padding:'2px 8px',borderRadius:'4px'}}>
              {cluster}: <b style={{color: pct > 12 ? '#b45309' : 'var(--text)'}}>{pct.toFixed(0)}%</b>
            </span>
          );
        })}
      </div>

      <table className="sus-table">
        <thead><tr>
          <th style={{width:'30px'}}>#</th>
          <th style={{width:'45px'}}>Side</th>
          <th>Market</th>
          <th style={{width:'60px'}}>Cluster</th>
          <th style={{width:'40px'}}>Bets</th>
          <th style={{width:'50px'}}>Score</th>
          <th style={{width:'60px'}}>Size</th>
        </tr></thead>
        <tbody>
          {positions.map((pos, i) => (
            <tr key={i}>
              <td style={{color:'var(--text-dim)',fontSize:'11px'}}>{i+1}</td>
              <td><span style={{
                padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:600,
                background: pos.direction === 'YES' ? '#dcfce7' : '#fee2e2',
                color: pos.direction === 'YES' ? '#166534' : '#991b1b'
              }}>{pos.direction}</span></td>
              <td style={{maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}}>{pos.question || '-'}</td>
              <td style={{fontSize:'10px',color:'var(--text-dim)'}}>{pos.cluster || '-'}</td>
              <td style={{fontSize:'11px',color:'var(--text-dim)'}}>{pos.bets.length}</td>
              <td style={{fontFamily:'monospace',fontSize:'12px'}}>{pos.maxScore}</td>
              <td style={{fontFamily:'monospace',color:'var(--green)',fontSize:'12px'}}>${pos.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Ed Thorp Tab Component - Kelly Criterion Master (Market-based)
function EdThorpTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>;
  }

  const accounts = data?.accounts || [];
  const allMarkets = aggregateByMarket(accounts);
  
  const positions = [];
  let totalAllocated = 0;

  // Thorp: 높은 엣지 + 높은 컨센서스만
  const sorted = allMarkets
    .filter(m => m.maxScore >= 120 && m.consensus >= 70)
    .sort((a, b) => b.maxScore - a.maxScore);

  for (const market of sorted) {
    if (positions.length >= 10) break;
    
    const score = market.maxScore;
    let estimatedEdge;
    if (score >= 200) estimatedEdge = 0.15;
    else if (score >= 150) estimatedEdge = 0.10;
    else estimatedEdge = 0.05;
    
    // 컨센서스 보너스
    const consensusBonus = (market.consensus - 70) / 100 * 0.05;
    estimatedEdge += consensusBonus;
    
    const kellyFraction = estimatedEdge * 0.5;
    const size = Math.round(BANKROLL * Math.min(kellyFraction, 0.05));
    
    if (size < 50) continue;
    
    totalAllocated += size;
    positions.push({ 
      ...market, 
      size, 
      edge: estimatedEdge,
      kelly: kellyFraction
    });
  }

  const cashReserve = BANKROLL - totalAllocated;
  const avgEdge = positions.length > 0 
    ? (positions.reduce((s, p) => s + p.edge, 0) / positions.length * 100).toFixed(1) 
    : 0;

  return (
    <div>
      <div style={{display:'flex',gap:'16px',marginBottom:'12px',fontSize:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontWeight:600}}>🎰 Ed Thorp</span>
        <span>Allocated: <b style={{color:'var(--green)'}}>${totalAllocated.toLocaleString()}</b></span>
        <span>Cash: <b style={{color:'var(--blue)'}}>${cashReserve.toLocaleString()}</b></span>
        <span>Positions: <b>{positions.length}</b></span>
        <span style={{color:'var(--text-dim)'}}>| Avg Edge: <b>{avgEdge}%</b> | Half-Kelly</span>
      </div>

      <table className="sus-table">
        <thead><tr>
          <th style={{width:'30px'}}>#</th>
          <th style={{width:'45px'}}>Side</th>
          <th>Market</th>
          <th style={{width:'40px'}}>Bets</th>
          <th style={{width:'50px'}}>Score</th>
          <th style={{width:'50px'}}>Edge</th>
          <th style={{width:'60px'}}>Size</th>
        </tr></thead>
        <tbody>
          {positions.map((pos, i) => (
            <tr key={i}>
              <td style={{color:'var(--text-dim)',fontSize:'11px'}}>{i+1}</td>
              <td><span style={{
                padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:600,
                background: pos.direction === 'YES' ? '#dcfce7' : '#fee2e2',
                color: pos.direction === 'YES' ? '#166534' : '#991b1b'
              }}>{pos.direction}</span></td>
              <td style={{maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}}>{pos.question || '-'}</td>
              <td style={{fontSize:'11px',color:'var(--text-dim)'}}>{pos.bets.length}</td>
              <td style={{fontFamily:'monospace',fontSize:'12px'}}>{pos.maxScore}</td>
              <td style={{fontFamily:'monospace',fontSize:'12px',color:'var(--green)'}}>{(pos.edge*100).toFixed(0)}%</td>
              <td style={{fontFamily:'monospace',color:'var(--green)',fontSize:'12px'}}>${pos.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Nate Silver Tab Component - Bayesian Probabilist (Market-based)
function NateSilverTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>;
  }

  const accounts = data?.accounts || [];
  const allMarkets = aggregateByMarket(accounts);
  
  const positions = [];
  let totalAllocated = 0;
  const maxTotal = BANKROLL * 0.4;

  // Silver: 다수 베터 + 확률 분석
  const sorted = allMarkets
    .filter(m => m.maxScore >= 100 && m.bets.length >= 2)
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const market of sorted) {
    if (totalAllocated >= maxTotal || positions.length >= 15) break;
    
    const score = market.avgScore;
    const betterCount = market.bets.length;
    
    // 베터 수 보너스
    const countBonus = Math.min(betterCount / 5, 1) * 0.1;
    let myProb;
    if (score >= 200) myProb = 0.75 + countBonus;
    else if (score >= 150) myProb = 0.65 + countBonus;
    else myProb = 0.55 + countBonus;
    myProb = Math.min(myProb, 0.85);
    
    const marketProb = 0.5;
    const probDiff = myProb - marketProb;
    const confidence = Math.min(market.consensus / 100, 0.9);
    
    const betPct = probDiff * confidence * 0.15;
    const size = Math.round(BANKROLL * Math.min(betPct, 0.03));
    
    if (size < 50) continue;
    
    totalAllocated += size;
    positions.push({ 
      ...market, 
      size, 
      marketProb,
      myProb,
      confidence,
      betterCount
    });
  }

  const cashReserve = BANKROLL - totalAllocated;

  return (
    <div>
      <div style={{display:'flex',gap:'16px',marginBottom:'12px',fontSize:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontWeight:600}}>📈 Nate Silver</span>
        <span>Allocated: <b style={{color:'var(--green)'}}>${totalAllocated.toLocaleString()}</b></span>
        <span>Cash: <b style={{color:'var(--blue)'}}>${cashReserve.toLocaleString()}</b></span>
        <span>Positions: <b>{positions.length}</b></span>
        <span style={{color:'var(--text-dim)'}}>| Max 40% | Bayesian</span>
      </div>

      <table className="sus-table">
        <thead><tr>
          <th style={{width:'30px'}}>#</th>
          <th style={{width:'45px'}}>Side</th>
          <th>Market</th>
          <th style={{width:'40px'}}>Bets</th>
          <th style={{width:'60px'}}>Prob</th>
          <th style={{width:'50px'}}>Conf</th>
          <th style={{width:'60px'}}>Size</th>
        </tr></thead>
        <tbody>
          {positions.map((pos, i) => (
            <tr key={i}>
              <td style={{color:'var(--text-dim)',fontSize:'11px'}}>{i+1}</td>
              <td><span style={{
                padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:600,
                background: pos.direction === 'YES' ? '#dcfce7' : '#fee2e2',
                color: pos.direction === 'YES' ? '#166534' : '#991b1b'
              }}>{pos.direction}</span></td>
              <td style={{maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}}>{pos.question || '-'}</td>
              <td style={{fontSize:'11px',color:'var(--text-dim)'}}>{pos.betterCount}</td>
              <td style={{fontFamily:'monospace',fontSize:'11px'}}>50→<b style={{color:'var(--green)'}}>{(pos.myProb*100).toFixed(0)}%</b></td>
              <td style={{fontFamily:'monospace',fontSize:'11px',color:'var(--text-dim)'}}>{(pos.confidence*100).toFixed(0)}%</td>
              <td style={{fontFamily:'monospace',color:'var(--green)',fontSize:'12px'}}>${pos.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Top Suspicious Accounts Tab Component (same structure as HoldersTab)
function SuspiciousTab({ searchQuery }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWallet, setExpandedWallet] = useState(null);
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading suspicious accounts...
      </div>
    );
  }

  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div className="loading">
        <p>🔄 데이터 준비 중...</p>
        <p style={{fontSize: '0.9rem', color: '#8b949e'}}>GitHub Actions에서 스캔이 완료되면 여기에 의심 계정이 표시됩니다.</p>
      </div>
    );
  }

  // 검색 필터링
  const filteredAccounts = data.accounts.filter(acc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      acc.wallet.toLowerCase().includes(query) ||
      (acc.name && acc.name.toLowerCase().includes(query))
    );
  });

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'score': aVal = a.maxScore; bVal = b.maxScore; break;
      case 'position': aVal = a.totalValue; bVal = b.totalValue; break;
      case 'pnl': aVal = a.allTimePnl || 0; bVal = b.allTimePnl || 0; break;
      case 'markets': aVal = a.markets?.length || 0; bVal = b.markets?.length || 0; break;
      case 'age': aVal = a.accountAgeDays || 999; bVal = b.accountAgeDays || 999; break;
      default: return 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const getFlag = (score) => score >= 70 ? '🚨' : score >= 50 ? '⚠️' : '👀';

  const formatPnl = (pnl) => {
    if (pnl === undefined || pnl === null) return '-';
    const absVal = Math.abs(pnl);
    const formatted = absVal >= 1000 ? `${(absVal / 1000).toFixed(1)}K` : absVal.toLocaleString();
    return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };
  
  return (
    <table className="markets-table">
      <thead>
        <tr>
          <th style={{ cursor: 'default' }}>#</th>
          <th style={{ cursor: 'default' }}>Account</th>
          <th onClick={() => handleSort('score')} className={sortKey === 'score' ? 'sorted' : ''}>
            Score
            <span className="sort-icon">{sortKey === 'score' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('position')} className={sortKey === 'position' ? 'sorted' : ''}>
            Position
            <span className="sort-icon">{sortKey === 'position' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('pnl')} className={sortKey === 'pnl' ? 'sorted' : ''}>
            Open PnL
            <span className="sort-icon">{sortKey === 'pnl' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('markets')} className={sortKey === 'markets' ? 'sorted' : ''}>
            Markets
            <span className="sort-icon">{sortKey === 'markets' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('age')} className={sortKey === 'age' ? 'sorted' : ''}>
            Age
            <span className="sort-icon">{sortKey === 'age' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th style={{ cursor: 'default' }}></th>
        </tr>
      </thead>
      <tbody>
        {sortedAccounts.map((acc, idx) => {
          const isExpanded = expandedWallet === acc.wallet;
          const profileUrl = `https://polymarket.com/profile/${acc.wallet}`;

          return (
            <tr key={acc.wallet} className={isExpanded ? 'expanded-row' : ''}>
              <td>#{idx + 1}</td>
              <td>
                <div className="holder-cell">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="holder-link">
                    {acc.name || acc.wallet.slice(0, 12) + '...'}
                  </a>
                </div>
                {isExpanded && acc.markets && (
                  <div className="positions-detail">
                    {acc.markets.sort((a, b) => b.score - a.score).map((mkt, i) => (
                      <div key={i} className={`position-item ${mkt.side?.toLowerCase()}`}>
                        <span className="position-score">{mkt.score}pt</span>
                        <a href={`https://polymarket.com/event/${mkt.slug}`} target="_blank" rel="noopener noreferrer">
                          {mkt.question?.slice(0, 45) || mkt.slug}...
                        </a>
                        <span className={`position-side ${mkt.side?.toLowerCase()}`}>{mkt.side}</span>
                        <span className="position-amount">${Math.round(mkt.amount).toLocaleString()}</span>
                        <span className="text-dim">{mkt.marketRatio}%</span>
                        <span className="text-dim">{mkt.marketEntryDays}d</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="score-cell">{acc.maxScore}pt</td>
              <td className="value-cell">${Math.round(acc.totalValue).toLocaleString()}</td>
              <td className={`pnl-cell ${(acc.allTimePnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                {formatPnl(acc.allTimePnl)}
              </td>
              <td className="text-dim">{acc.markets?.length || 0}</td>
              <td className="text-dim">{acc.accountAgeDays < 999 ? `${acc.accountAgeDays}d` : '?'}</td>
              <td>
                <button className="expand-btn" onClick={() => setExpandedWallet(isExpanded ? null : acc.wallet)}>
                  {isExpanded ? 'Hide' : 'Show'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Markets Tab Component
function MarketsTab({ markets, searchQuery }) {
  const [sortKey, setSortKey] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [suspiciousCache, setSuspiciousCache] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState({});
  const [suspiciousData, setSuspiciousData] = useState(null);
  const [marketSusCount, setMarketSusCount] = useState({});

  // Load suspicious.json and calculate per-market counts
  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(data => {
        setSuspiciousData(data);
        // Calculate suspicious count per market
        const counts = {};
        if (data?.accounts) {
          for (const acc of data.accounts) {
            if (acc.markets) {
              for (const mkt of acc.markets) {
                const key = mkt.conditionId || mkt.slug;
                if (key) {
                  counts[key] = (counts[key] || 0) + 1;
                }
              }
            }
          }
        }
        setMarketSusCount(counts);
      })
      .catch(() => {});
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const analyzeMarket = async (conditionId, outcomePrices) => {
    if (suspiciousCache[conditionId]) return;
    setLoadingAnalysis(prev => ({ ...prev, [conditionId]: true }));
    try {
      // 가격 정보를 쿼리 파라미터로 전달
      const yesPrice = parseFloat(outcomePrices[0]) || 0.5;
      const noPrice = parseFloat(outcomePrices[1]) || 0.5;
      const res = await fetch(`/api/suspicious?market=${conditionId}&yesPrice=${yesPrice}&noPrice=${noPrice}`);
      const data = await res.json();
      setSuspiciousCache(prev => ({ ...prev, [conditionId]: data }));
    } catch (err) {
      setSuspiciousCache(prev => ({ ...prev, [conditionId]: { suspicious: [], all: [] } }));
    }
    setLoadingAnalysis(prev => ({ ...prev, [conditionId]: false }));
  };

  const toggleExpand = (conditionId, outcomePrices) => {
    if (expandedId === conditionId) {
      setExpandedId(null);
    } else {
      setExpandedId(conditionId);
      analyzeMarket(conditionId, outcomePrices);
    }
  };

  // 검색 필터링
  const filteredMarkets = markets.filter(market => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      market.question.toLowerCase().includes(query) ||
      (market.eventTitle && market.eventTitle.toLowerCase().includes(query))
    );
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'yes': aVal = parseFloat(a.outcomePrices[0]); bVal = parseFloat(b.outcomePrices[0]); break;
      case 'no': aVal = parseFloat(a.outcomePrices[1]); bVal = parseFloat(b.outcomePrices[1]); break;
      case 'volume': aVal = a.volume; bVal = b.volume; break;
      case 'liquidity': aVal = a.liquidity; bVal = b.liquidity; break;
      case 'endDate': aVal = a.endDate ? new Date(a.endDate).getTime() : 0; bVal = b.endDate ? new Date(b.endDate).getTime() : 0; break;
      case 'suspicious': 
        aVal = marketSusCount[a.conditionId] || marketSusCount[a.slug] || 0; 
        bVal = marketSusCount[b.conditionId] || marketSusCount[b.slug] || 0; 
        break;
      default: return 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const SortHeader = ({ label, keyName }) => (
    <th onClick={() => handleSort(keyName)} className={sortKey === keyName ? 'sorted' : ''}>
      {label}
      <span className="sort-icon">{sortKey === keyName ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
    </th>
  );

  const getFlagEmoji = (flag) => {
    if (flag === 'HIGH') return '🚨';
    if (flag === 'MEDIUM') return '⚠️';
    if (flag === 'LOW') return '👀';
    return '';
  };

  return (
    <table className="markets-table">
      <thead>
        <tr>
          <th style={{ cursor: 'default' }}>Market</th>
          <SortHeader label="🔍 Sus" keyName="suspicious" />
          <SortHeader label="Yes" keyName="yes" />
          <SortHeader label="No" keyName="no" />
          <SortHeader label="Volume" keyName="volume" />
          <SortHeader label="Liquidity" keyName="liquidity" />
          <SortHeader label="Ends" keyName="endDate" />
          <th style={{ cursor: 'default' }}>Analyze</th>
        </tr>
      </thead>
      <tbody>
        {sortedMarkets.map(market => {
          const yesPrice = (parseFloat(market.outcomePrices[0]) * 100).toFixed(1);
          const noPrice = (parseFloat(market.outcomePrices[1]) * 100).toFixed(1);
          const marketUrl = `https://polymarket.com/event/${market.eventSlug}/${market.slug}`;
          const isExpanded = expandedId === market.conditionId;
          const analysis = suspiciousCache[market.conditionId];
          const isLoading = loadingAnalysis[market.conditionId];
          const susCount = marketSusCount[market.conditionId] || marketSusCount[market.slug] || 0;

          return (
            <tr key={market.conditionId} className={isExpanded ? 'expanded-row' : ''}>
              <td>
                <div className="market-cell">
                  {market.image && <img src={market.image} alt="" className="market-image" />}
                  <span className="market-question">
                    <a href={marketUrl} target="_blank" rel="noopener noreferrer">{market.question}</a>
                  </span>
                </div>
                {isExpanded && (
                  <div className="holders-inline">
                    {isLoading ? (
                      <div className="holders-loading">
                        <div className="spinner-small"></div>
                        Analyzing holders...
                      </div>
                    ) : analysis ? (
                      <div className="suspicious-analysis">
                        {analysis.suspicious && analysis.suspicious.length > 0 ? (
                          <>
                            <h4 className="suspicious-title">
                              🔍 Suspicious Accounts ({analysis.suspicious.length})
                            </h4>
                            <div className="suspicious-list">
                              {analysis.suspicious.map((h, i) => (
                                <div key={h.wallet} className={`suspicious-item flag-${h.flag?.toLowerCase()}`}>
                                  <div className="suspicious-header">
                                    <span className="suspicious-flag">{getFlagEmoji(h.flag)}</span>
                                    <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer" className="suspicious-name">
                                      {h.name || `${h.wallet.slice(0, 10)}...`}
                                    </a>
                                    <span className={`suspicious-side ${h.side?.toLowerCase()}`}>{h.side}</span>
                                    <span className="suspicious-score">Score: {h.score}</span>
                                  </div>
                                  <div className="suspicious-details">
                                    <span>💰 ${Math.round(h.amount || 0).toLocaleString()}</span>
                                    <span>📊 {h.totalMarkets} mkt{h.totalMarkets !== 1 ? 's' : ''}</span>
                                    <span>🎯 {h.marketEntryDays !== undefined && h.marketEntryDays < 999 ? `${h.marketEntryDays}d ago` : '?'}{h.marketEntryDays <= 3 ? ' 🚨' : h.marketEntryDays <= 7 ? ' ⚠️' : ''}</span>
                                    {h.marketRatio >= 60 && <span className="text-dim">{h.marketRatio}% here</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="no-suspicious">
                            ✅ No suspicious accounts detected
                          </div>
                        )}
                        {analysis.all && analysis.all.length > analysis.suspicious?.length && (
                          <details className="other-holders">
                            <summary>View all {analysis.all.length} holders</summary>
                            <div className="all-holders-list">
                              {analysis.all.filter(h => !h.flag || h.flag === 'LOW').slice(0, 20).map((h, i) => (
                                <div key={h.wallet} className="holder-item-simple">
                                  <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                                    {h.name || `${h.wallet.slice(0, 10)}...`}
                                  </a>
                                  <span className={`side-badge ${h.side?.toLowerCase()}`}>{h.side}</span>
                                  <span>${Math.round(h.amount || 0).toLocaleString()}</span>
                                  <span className="text-dim">{h.totalMarkets} mkts</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </td>
              <td className={`sus-count-cell ${susCount > 0 ? 'has-sus' : ''}`}>
                {susCount > 0 ? `🚨 ${susCount}` : '-'}
              </td>
              <td className="price-yes">{yesPrice}¢</td>
              <td className="price-no">{noPrice}¢</td>
              <td className="volume-cell">{formatNumber(market.volume)}</td>
              <td className="text-dim">{formatNumber(market.liquidity)}</td>
              <td className="text-dim">{market.endDate ? new Date(market.endDate).toLocaleDateString() : '-'}</td>
              <td>
                <button className="expand-btn" onClick={() => toggleExpand(market.conditionId, market.outcomePrices)}>
                  {isExpanded ? 'Hide' : 'Scan'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Blacklisted addresses
const BLACKLIST = [
  '0xa5ef39c3d3e10d0b270233af41cac69796b12966'
];

// 주요 기업 목록 (마켓에서 추출할 기업명)
const COMPANIES = [
  { name: 'OpenAI', keywords: ['openai', 'chatgpt', 'gpt-5', 'gpt5', 'sam altman'] },
  { name: 'Anthropic', keywords: ['anthropic', 'claude'] },
  { name: 'Google', keywords: ['google', 'alphabet', 'deepmind', 'gemini'] },
  { name: 'Apple', keywords: ['apple', 'iphone', 'ipad', 'tim cook'] },
  { name: 'Microsoft', keywords: ['microsoft', 'msft', 'satya nadella', 'bing', 'copilot'] },
  { name: 'Meta', keywords: ['meta', 'facebook', 'instagram', 'zuckerberg', 'threads'] },
  { name: 'Amazon', keywords: ['amazon', 'aws', 'bezos', 'alexa'] },
  { name: 'Tesla', keywords: ['tesla', 'elon musk', 'cybertruck', 'model 3', 'model y'] },
  { name: 'Nvidia', keywords: ['nvidia', 'nvda', 'jensen huang'] },
  { name: 'SpaceX', keywords: ['spacex', 'starship', 'starlink', 'falcon'] },
  { name: 'xAI', keywords: ['xai', 'grok'] },
  { name: 'Netflix', keywords: ['netflix'] },
  { name: 'Twitter/X', keywords: ['twitter', ' x.com', 'x corp'] },
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
  { name: 'Figma', keywords: ['figma'] },
  { name: 'Notion', keywords: ['notion'] },
  { name: 'Perplexity', keywords: ['perplexity'] },
];

// 마켓에서 기업명 추출
function extractCompany(marketQuestion) {
  const questionLower = marketQuestion.toLowerCase();
  for (const company of COMPANIES) {
    for (const keyword of company.keywords) {
      if (questionLower.includes(keyword)) {
        return company.name;
      }
    }
  }
  return null;
}

// Holders Tab Component
function HoldersTab({ markets, searchQuery }) {
  const [allHolders, setAllHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWallet, setExpandedWallet] = useState(null);
  const [sortKey, setSortKey] = useState('totalShares');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function fetchAllHolders() {
      setLoading(true);
      const holdersMap = {};

      // Fetch holders for all markets
      await Promise.all(
        markets.map(async (market) => {
          try {
            const res = await fetch(`/api/holders?market=${market.conditionId}`);
            const data = await res.json();

            // Process YES holders
            data.yes?.forEach(h => {
              if (!holdersMap[h.wallet]) {
                holdersMap[h.wallet] = {
                  wallet: h.wallet,
                  name: h.name,
                  profileImage: h.profileImage,
                  totalShares: 0,
                  positions: []
                };
              }
              if (h.name && !holdersMap[h.wallet].name) {
                holdersMap[h.wallet].name = h.name;
              }
              holdersMap[h.wallet].totalShares += h.amount;
              holdersMap[h.wallet].positions.push({
                market: market.question,
                marketSlug: market.slug,
                eventSlug: market.eventSlug,
                side: 'YES',
                amount: h.amount,
                image: market.image
              });
            });

            // Process NO holders
            data.no?.forEach(h => {
              if (!holdersMap[h.wallet]) {
                holdersMap[h.wallet] = {
                  wallet: h.wallet,
                  name: h.name,
                  profileImage: h.profileImage,
                  totalShares: 0,
                  positions: []
                };
              }
              if (h.name && !holdersMap[h.wallet].name) {
                holdersMap[h.wallet].name = h.name;
              }
              holdersMap[h.wallet].totalShares += h.amount;
              holdersMap[h.wallet].positions.push({
                market: market.question,
                marketSlug: market.slug,
                eventSlug: market.eventSlug,
                side: 'NO',
                amount: h.amount,
                image: market.image
              });
            });
          } catch (err) {
            console.error('Error fetching holders for', market.conditionId);
          }
        })
      );

      const holdersList = Object.values(holdersMap).filter(
        h => !BLACKLIST.includes(h.wallet.toLowerCase())
      );
      setAllHolders(holdersList);
      setLoading(false);
    }

    if (markets.length > 0) {
      fetchAllHolders();
    }
  }, [markets]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // 검색 필터링
  const filteredHolders = allHolders.filter(holder => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      holder.wallet.toLowerCase().includes(query) ||
      (holder.name && holder.name.toLowerCase().includes(query))
    );
  });

  const sortedHolders = [...filteredHolders].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'totalShares': aVal = a.totalShares; bVal = b.totalShares; break;
      case 'markets': aVal = a.positions.length; bVal = b.positions.length; break;
      default: return 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Aggregating holder data from all markets...
      </div>
    );
  }

  return (
    <table className="markets-table">
      <thead>
        <tr>
          <th style={{ cursor: 'default' }}>Rank</th>
          <th style={{ cursor: 'default' }}>Holder</th>
          <th onClick={() => handleSort('totalShares')} className={sortKey === 'totalShares' ? 'sorted' : ''}>
            Total Shares
            <span className="sort-icon">{sortKey === 'totalShares' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('markets')} className={sortKey === 'markets' ? 'sorted' : ''}>
            Markets
            <span className="sort-icon">{sortKey === 'markets' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th style={{ cursor: 'default' }}>Positions</th>
        </tr>
      </thead>
      <tbody>
        {sortedHolders.map((holder, idx) => {
          const isExpanded = expandedWallet === holder.wallet;
          const profileUrl = `https://polymarket.com/profile/${holder.wallet}`;

          return (
            <tr key={holder.wallet} className={isExpanded ? 'expanded-row' : ''}>
              <td className="rank-cell">#{idx + 1}</td>
              <td>
                <div className="holder-cell">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="holder-link">
                    {holder.name || holder.wallet}
                  </a>
                  <span className="wallet-address">{holder.wallet}</span>
                </div>
                {isExpanded && (
                  <div className="positions-detail">
                    {holder.positions.map((pos, i) => (
                      <div key={i} className={`position-item ${pos.side.toLowerCase()}`}>
                        <img src={pos.image} alt="" className="position-image" />
                        <a href={`https://polymarket.com/event/${pos.eventSlug}/${pos.marketSlug}`} target="_blank" rel="noopener noreferrer">
                          {pos.market}
                        </a>
                        <span className={`position-side ${pos.side.toLowerCase()}`}>{pos.side}</span>
                        <span className="position-amount">{formatAmount(pos.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td className="shares-cell">{formatAmount(holder.totalShares)}</td>
              <td className="text-dim">{holder.positions.length}</td>
              <td>
                <button className="expand-btn" onClick={() => setExpandedWallet(isExpanded ? null : holder.wallet)}>
                  {isExpanded ? 'Hide' : 'Show'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [marketsRes, susRes] = await Promise.all([
          fetch('/api/markets'),
          fetch('/data/suspicious.json')
        ]);
        const marketsData = await marketsRes.json();
        const susData = await susRes.json();
        setMarkets(marketsData.markets || []);
        setLastUpdated(susData.updatedAt || null);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalVolume = markets.reduce((sum, m) => sum + m.volume, 0);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          Loading Tech Markets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="loading" style={{ color: '#cf222e' }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="logo">
          <h1>Polymarket Insider</h1>
          <p>Tech Markets Whale Tracker</p>
          {lastUpdated && (
            <p style={{fontSize:'11px',color:'var(--text-dim)',marginTop:'4px'}}>
              Updated: {new Date(lastUpdated).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })} KST
            </p>
          )}
        </div>
        <div className="stats-bar">
          <div className="stat-box">
            <span className="stat-label">Volume:</span>
            <span className="stat-value">{formatNumber(totalVolume)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Markets:</span>
            <span className="stat-value blue">{markets.length}</span>
          </div>
        </div>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'markets' ? 'active' : ''}`}
          onClick={() => setActiveTab('markets')}
        >
          Markets
        </button>
        <button 
          className={`tab ${activeTab === 'suspicious' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspicious')}
        >
          🔍 Top Suspicious
        </button>
        <button 
          className={`tab ${activeTab === 'holders' ? 'active' : ''}`}
          onClick={() => setActiveTab('holders')}
        >
          Top Holders
        </button>
        <button 
          className={`tab ${activeTab === 'ptj' ? 'active' : ''}`}
          onClick={() => setActiveTab('ptj')}
        >
          🛡️ PTJ
        </button>
        <button 
          className={`tab ${activeTab === 'kg' ? 'active' : ''}`}
          onClick={() => setActiveTab('kg')}
        >
          📊 Griffin
        </button>
        <button 
          className={`tab ${activeTab === 'thorp' ? 'active' : ''}`}
          onClick={() => setActiveTab('thorp')}
        >
          🎰 Thorp
        </button>
        <button 
          className={`tab ${activeTab === 'silver' ? 'active' : ''}`}
          onClick={() => setActiveTab('silver')}
        >
          📈 Silver
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder={activeTab === 'markets' ? 'Search markets...' : 'Search by wallet address or name...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {activeTab === 'markets' && (
        <MarketsTab markets={markets} searchQuery={searchQuery} />
      )}
      {activeTab === 'suspicious' && (
        <SuspiciousTab searchQuery={searchQuery} />
      )}
      {activeTab === 'holders' && (
        <HoldersTab markets={markets} searchQuery={searchQuery} />
      )}
      {activeTab === 'ptj' && (
        <PTJTab />
      )}
      {activeTab === 'kg' && (
        <KenGriffinTab />
      )}
      {activeTab === 'thorp' && (
        <EdThorpTab />
      )}
      {activeTab === 'silver' && (
        <NateSilverTab />
      )}
    </div>
  );
}

