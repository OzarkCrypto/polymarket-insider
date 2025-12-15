'use client';

import { useState, useEffect } from 'react';

function formatNumber(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${Math.round(num)}`;
}

function timeAgo(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getFlagEmoji(score) {
  if (score >= 70) return '🚨';
  if (score >= 50) return '⚠️';
  return '👀';
}

// ============ Top Suspicious Accounts Tab ============
function SuspiciousTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWallet, setExpandedWallet] = useState(null);
  const [filter, setFilter] = useState('all'); // all, high, camouflage

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading suspicious accounts data...</div>;
  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div className="empty-state">
        <h3>🔄 데이터 준비 중</h3>
        <p>첫 스캔이 아직 실행되지 않았습니다.</p>
        <p>GitHub Actions에서 수동으로 실행하거나 2시간 후 자동 실행을 기다려주세요.</p>
      </div>
    );
  }

  const filteredAccounts = data.accounts.filter(acc => {
    if (filter === 'high') return acc.maxScore >= 70;
    if (filter === 'camouflage') return acc.isCamouflage;
    return true;
  });

  return (
    <div className="suspicious-tab">
      <div className="suspicious-header">
        <div className="header-info">
          <h2>🏆 Top Suspicious Accounts</h2>
          <span className="update-time">Updated: {timeAgo(data.updatedAt)}</span>
        </div>
        <div className="header-stats">
          <span>📊 {data.totalMarketsScanned} markets scanned</span>
          <span>🔍 {data.totalSuspiciousAccounts} suspicious accounts</span>
        </div>
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All ({data.accounts.length})
          </button>
          <button 
            className={filter === 'high' ? 'active' : ''} 
            onClick={() => setFilter('high')}
          >
            🚨 High ({data.accounts.filter(a => a.maxScore >= 70).length})
          </button>
          <button 
            className={filter === 'camouflage' ? 'active' : ''} 
            onClick={() => setFilter('camouflage')}
          >
            🎭 Camouflage ({data.accounts.filter(a => a.isCamouflage).length})
          </button>
        </div>
      </div>

      <div className="accounts-list">
        {filteredAccounts.map((account, idx) => (
          <div 
            key={account.wallet} 
            className={`account-card ${expandedWallet === account.wallet ? 'expanded' : ''}`}
          >
            <div 
              className="account-row"
              onClick={() => setExpandedWallet(expandedWallet === account.wallet ? null : account.wallet)}
            >
              <div className="account-rank">#{idx + 1}</div>
              <div className="account-flag">{getFlagEmoji(account.maxScore)}</div>
              <div className="account-name">
                <a 
                  href={`https://polymarket.com/profile/${account.wallet}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {account.name || `${account.wallet.slice(0, 12)}...`}
                </a>
                {account.isCamouflage && <span className="camo-badge">🎭</span>}
              </div>
              <div className="account-score">Score: {account.maxScore}</div>
              <div className="account-value">{formatNumber(account.totalValue)}</div>
              <div className="account-markets">{account.markets.length} market{account.markets.length !== 1 ? 's' : ''}</div>
              <div className="account-age">
                {account.accountAgeDays < 999 ? `${account.accountAgeDays}d old` : '?'}
              </div>
              <div className="expand-icon">{expandedWallet === account.wallet ? '▼' : '▶'}</div>
            </div>

            {expandedWallet === account.wallet && (
              <div className="account-markets-detail">
                <h4>📊 Markets</h4>
                {account.markets
                  .sort((a, b) => b.score - a.score)
                  .map((mkt, i) => (
                    <div key={i} className="market-detail-row">
                      <span className="mkt-score">{getFlagEmoji(mkt.score)} {mkt.score}</span>
                      <a 
                        href={`https://polymarket.com/event/${mkt.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mkt-name"
                      >
                        {mkt.question?.slice(0, 60) || mkt.slug}...
                      </a>
                      <span className={`mkt-side ${mkt.side?.toLowerCase()}`}>{mkt.side}</span>
                      <span className="mkt-amount">{formatNumber(mkt.amount)}</span>
                      <span className="mkt-ratio">{mkt.marketRatio}% here</span>
                      <span className="mkt-entry">{mkt.marketEntryDays}d ago</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Markets Tab ============
function MarketsTab({ markets }) {
  const [sortKey, setSortKey] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [suspiciousCache, setSuspiciousCache] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

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
      const yesPrice = parseFloat(outcomePrices?.[0]) || 0.5;
      const noPrice = parseFloat(outcomePrices?.[1]) || 0.5;
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

  const filteredMarkets = markets.filter(market => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return market.question?.toLowerCase().includes(q) || 
           market.slug?.toLowerCase().includes(q);
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    let aVal, bVal;
    if (sortKey === 'volume') {
      aVal = a.volume || 0;
      bVal = b.volume || 0;
    } else if (sortKey === 'liquidity') {
      aVal = a.liquidity || 0;
      bVal = b.liquidity || 0;
    } else if (sortKey === 'endDate') {
      aVal = new Date(a.endDate || 0).getTime();
      bVal = new Date(b.endDate || 0).getTime();
    } else {
      aVal = a.question || '';
      bVal = b.question || '';
    }
    return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  return (
    <div className="markets-tab">
      <div className="markets-header">
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="sort-buttons">
          <button onClick={() => handleSort('volume')} className={sortKey === 'volume' ? 'active' : ''}>
            Volume {sortKey === 'volume' && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
          <button onClick={() => handleSort('liquidity')} className={sortKey === 'liquidity' ? 'active' : ''}>
            Liquidity {sortKey === 'liquidity' && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      <div className="markets-list">
        {sortedMarkets.map(market => (
          <div key={market.conditionId} className={`market-card ${expandedId === market.conditionId ? 'expanded' : ''}`}>
            <div className="market-row" onClick={() => toggleExpand(market.conditionId, market.outcomePrices)}>
              <div className="market-info">
                <a 
                  href={`https://polymarket.com/event/${market.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="market-title"
                >
                  {market.question}
                </a>
                <div className="market-meta">
                  <span>📊 {formatNumber(market.volume)}</span>
                  <span>💧 {formatNumber(market.liquidity)}</span>
                  <span>📅 {market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
              <div className="expand-btn">{expandedId === market.conditionId ? '▼' : '▶'}</div>
            </div>

            {expandedId === market.conditionId && (
              <div className="market-analysis">
                {loadingAnalysis[market.conditionId] ? (
                  <div className="loading-analysis">Analyzing holders...</div>
                ) : suspiciousCache[market.conditionId] ? (
                  <div className="analysis-results">
                    {suspiciousCache[market.conditionId].suspicious?.length > 0 ? (
                      <>
                        <h4>🔍 Suspicious Accounts ({suspiciousCache[market.conditionId].suspicious.length})</h4>
                        {suspiciousCache[market.conditionId].suspicious.map((h, i) => (
                          <div key={h.wallet} className="holder-row">
                            <span className="holder-flag">{getFlagEmoji(h.score)}</span>
                            <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                              {h.name || `${h.wallet.slice(0, 10)}...`}
                            </a>
                            <span className={`holder-side ${h.side?.toLowerCase()}`}>{h.side}</span>
                            <span>{formatNumber(h.amount)}</span>
                            <span>{h.totalMarkets} mkts</span>
                            <span>{h.marketEntryDays}d ago</span>
                            <span>Score: {h.score}</span>
                            {h.isCamouflage && <span>🎭</span>}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="no-suspicious">✅ No suspicious accounts detected</div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Main App ============
export default function Home() {
  const [activeTab, setActiveTab] = useState('suspicious');
  const [markets, setMarkets] = useState([]);
  const [stats, setStats] = useState({ count: 0, totalVolume: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets')
      .then(res => res.json())
      .then(data => {
        setMarkets(data.markets || []);
        setStats({ count: data.count, totalVolume: data.totalVolume });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container">
      <header className="header">
        <h1>🔍 Polymarket Insider Detector</h1>
        <p>Insider-possible markets: {stats.count} | Total Volume: {formatNumber(stats.totalVolume)}</p>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'suspicious' ? 'active' : ''} 
          onClick={() => setActiveTab('suspicious')}
        >
          🏆 Top Suspicious
        </button>
        <button 
          className={activeTab === 'markets' ? 'active' : ''} 
          onClick={() => setActiveTab('markets')}
        >
          📋 Markets ({stats.count})
        </button>
      </nav>

      <div className="tab-content">
        {activeTab === 'suspicious' && <SuspiciousTab />}
        {activeTab === 'markets' && !loading && <MarketsTab markets={markets} />}
        {activeTab === 'markets' && loading && <div className="loading">Loading markets...</div>}
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0d1117;
          color: #e6edf3;
          line-height: 1.5;
        }
        a { color: #58a6ff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 1.8rem; margin-bottom: 8px; }
        .header p { color: #8b949e; }
        
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
        .tabs button { 
          padding: 10px 20px; 
          border: none; 
          background: transparent; 
          color: #8b949e; 
          cursor: pointer; 
          font-size: 1rem;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tabs button:hover { background: #21262d; color: #e6edf3; }
        .tabs button.active { background: #238636; color: white; }
        
        .loading, .empty-state { text-align: center; padding: 60px 20px; color: #8b949e; }
        .empty-state h3 { margin-bottom: 10px; color: #e6edf3; }
        
        /* Suspicious Tab */
        .suspicious-header { margin-bottom: 20px; }
        .header-info { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; }
        .header-info h2 { font-size: 1.4rem; }
        .update-time { color: #8b949e; font-size: 0.9rem; }
        .header-stats { display: flex; gap: 20px; color: #8b949e; margin-bottom: 15px; }
        .filter-buttons { display: flex; gap: 8px; }
        .filter-buttons button {
          padding: 6px 12px;
          border: 1px solid #30363d;
          background: #21262d;
          color: #8b949e;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .filter-buttons button:hover { border-color: #58a6ff; }
        .filter-buttons button.active { background: #388bfd; color: white; border-color: #388bfd; }
        
        .accounts-list { display: flex; flex-direction: column; gap: 8px; }
        .account-card { 
          background: #161b22; 
          border: 1px solid #30363d; 
          border-radius: 8px; 
          overflow: hidden;
        }
        .account-card.expanded { border-color: #58a6ff; }
        .account-row {
          display: grid;
          grid-template-columns: 50px 40px 1fr 100px 100px 100px 80px 30px;
          align-items: center;
          padding: 12px 15px;
          cursor: pointer;
          gap: 10px;
        }
        .account-row:hover { background: #21262d; }
        .account-rank { color: #8b949e; font-weight: bold; }
        .account-flag { font-size: 1.2rem; }
        .account-name { display: flex; align-items: center; gap: 8px; }
        .account-name a { font-weight: 500; }
        .camo-badge { font-size: 0.9rem; }
        .account-score { color: #f0883e; font-weight: bold; }
        .account-value { color: #3fb950; }
        .account-markets { color: #8b949e; }
        .account-age { color: #8b949e; font-size: 0.85rem; }
        .expand-icon { color: #8b949e; }
        
        .account-markets-detail { 
          padding: 15px; 
          background: #0d1117; 
          border-top: 1px solid #30363d; 
        }
        .account-markets-detail h4 { margin-bottom: 10px; color: #8b949e; }
        .market-detail-row {
          display: grid;
          grid-template-columns: 60px 1fr 60px 80px 80px 70px;
          align-items: center;
          padding: 8px 10px;
          gap: 10px;
          border-radius: 4px;
        }
        .market-detail-row:hover { background: #161b22; }
        .mkt-score { color: #f0883e; }
        .mkt-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mkt-side { padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .mkt-side.yes { background: #238636; color: white; }
        .mkt-side.no { background: #da3633; color: white; }
        .mkt-amount { color: #3fb950; }
        .mkt-ratio, .mkt-entry { color: #8b949e; font-size: 0.85rem; }
        
        /* Markets Tab */
        .markets-header { display: flex; gap: 15px; margin-bottom: 15px; align-items: center; }
        .search-input {
          flex: 1;
          padding: 10px 15px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #e6edf3;
          font-size: 0.95rem;
        }
        .search-input:focus { outline: none; border-color: #58a6ff; }
        .sort-buttons { display: flex; gap: 8px; }
        .sort-buttons button {
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          color: #8b949e;
          border-radius: 6px;
          cursor: pointer;
        }
        .sort-buttons button:hover { border-color: #58a6ff; }
        .sort-buttons button.active { background: #388bfd; color: white; border-color: #388bfd; }
        
        .markets-list { display: flex; flex-direction: column; gap: 8px; }
        .market-card { 
          background: #161b22; 
          border: 1px solid #30363d; 
          border-radius: 8px;
        }
        .market-card.expanded { border-color: #58a6ff; }
        .market-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          cursor: pointer;
        }
        .market-row:hover { background: #21262d; }
        .market-info { flex: 1; }
        .market-title { font-weight: 500; display: block; margin-bottom: 5px; }
        .market-meta { display: flex; gap: 15px; color: #8b949e; font-size: 0.85rem; }
        .expand-btn { color: #8b949e; padding: 5px; }
        
        .market-analysis { padding: 15px; background: #0d1117; border-top: 1px solid #30363d; }
        .loading-analysis { color: #8b949e; }
        .analysis-results h4 { margin-bottom: 10px; }
        .holder-row {
          display: flex;
          gap: 15px;
          align-items: center;
          padding: 8px 10px;
          border-radius: 4px;
        }
        .holder-row:hover { background: #161b22; }
        .holder-flag { font-size: 1.1rem; }
        .holder-side { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
        .holder-side.yes { background: #238636; color: white; }
        .holder-side.no { background: #da3633; color: white; }
        .no-suspicious { color: #3fb950; padding: 10px; }
        
        @media (max-width: 900px) {
          .account-row { grid-template-columns: 40px 30px 1fr 70px 70px 30px; font-size: 0.9rem; }
          .account-markets, .account-age { display: none; }
          .market-detail-row { grid-template-columns: 50px 1fr 50px 60px; }
          .mkt-ratio, .mkt-entry { display: none; }
        }
      `}</style>
    </main>
  );
}
