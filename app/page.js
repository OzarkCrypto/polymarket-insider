'use client';

import { useState, useEffect } from 'react';

function formatNumber(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function formatAmount(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(2);
}

// Markets Tab Component
function MarketsTab({ markets }) {
  const [sortKey, setSortKey] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [holdersCache, setHoldersCache] = useState({});
  const [loadingHolders, setLoadingHolders] = useState({});

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const loadHolders = async (conditionId) => {
    if (holdersCache[conditionId]) return;
    setLoadingHolders(prev => ({ ...prev, [conditionId]: true }));
    try {
      const res = await fetch(`/api/holders?market=${conditionId}`);
      const data = await res.json();
      setHoldersCache(prev => ({ ...prev, [conditionId]: data }));
    } catch (err) {
      setHoldersCache(prev => ({ ...prev, [conditionId]: { yes: [], no: [] } }));
    }
    setLoadingHolders(prev => ({ ...prev, [conditionId]: false }));
  };

  const toggleExpand = (conditionId) => {
    if (expandedId === conditionId) {
      setExpandedId(null);
    } else {
      setExpandedId(conditionId);
      loadHolders(conditionId);
    }
  };

  const sortedMarkets = [...markets].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'yes': aVal = parseFloat(a.outcomePrices[0]); bVal = parseFloat(b.outcomePrices[0]); break;
      case 'no': aVal = parseFloat(a.outcomePrices[1]); bVal = parseFloat(b.outcomePrices[1]); break;
      case 'volume': aVal = a.volume; bVal = b.volume; break;
      case 'liquidity': aVal = a.liquidity; bVal = b.liquidity; break;
      case 'endDate': aVal = a.endDate ? new Date(a.endDate).getTime() : 0; bVal = b.endDate ? new Date(b.endDate).getTime() : 0; break;
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

  return (
    <table className="markets-table">
      <thead>
        <tr>
          <th style={{ cursor: 'default' }}>Market</th>
          <SortHeader label="Yes" keyName="yes" />
          <SortHeader label="No" keyName="no" />
          <SortHeader label="Volume" keyName="volume" />
          <SortHeader label="Liquidity" keyName="liquidity" />
          <SortHeader label="Ends" keyName="endDate" />
          <th style={{ cursor: 'default' }}>Holders</th>
        </tr>
      </thead>
      <tbody>
        {sortedMarkets.map(market => {
          const yesPrice = (parseFloat(market.outcomePrices[0]) * 100).toFixed(1);
          const noPrice = (parseFloat(market.outcomePrices[1]) * 100).toFixed(1);
          const marketUrl = `https://polymarket.com/event/${market.eventSlug}/${market.slug}`;
          const isExpanded = expandedId === market.conditionId;
          const holders = holdersCache[market.conditionId];
          const isLoading = loadingHolders[market.conditionId];

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
                      <div className="holders-loading">Loading...</div>
                    ) : holders ? (
                      <div className="holders-grid">
                        <div className="holders-column yes">
                          <h4>YES HOLDERS</h4>
                          {holders.yes.length > 0 ? holders.yes.map((h, i) => (
                            <div key={h.wallet} className="holder-item">
                              <span className="holder-rank">#{i + 1}</span>
                              <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                                {h.name || `${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)}`}
                              </a>
                              <span className="holder-amount">{formatAmount(h.amount)}</span>
                            </div>
                          )) : <div className="no-holders">No holders</div>}
                        </div>
                        <div className="holders-column no">
                          <h4>NO HOLDERS</h4>
                          {holders.no.length > 0 ? holders.no.map((h, i) => (
                            <div key={h.wallet} className="holder-item">
                              <span className="holder-rank">#{i + 1}</span>
                              <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                                {h.name || `${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)}`}
                              </a>
                              <span className="holder-amount">{formatAmount(h.amount)}</span>
                            </div>
                          )) : <div className="no-holders">No holders</div>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </td>
              <td className="price-yes">{yesPrice}¢</td>
              <td className="price-no">{noPrice}¢</td>
              <td className="volume-cell">{formatNumber(market.volume)}</td>
              <td className="text-dim">{formatNumber(market.liquidity)}</td>
              <td className="text-dim">{market.endDate ? new Date(market.endDate).toLocaleDateString() : '-'}</td>
              <td>
                <button className="expand-btn" onClick={() => toggleExpand(market.conditionId)}>
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

// Holders Tab Component
function HoldersTab({ markets }) {
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

      const holdersList = Object.values(holdersMap);
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

  const sortedHolders = [...allHolders].sort((a, b) => {
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
                    {holder.name || `${holder.wallet.slice(0, 6)}...${holder.wallet.slice(-4)}`}
                  </a>
                  <span className="wallet-address">{holder.wallet.slice(0, 10)}...{holder.wallet.slice(-6)}</span>
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

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch('/api/markets');
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    fetchMarkets();
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
          className={`tab ${activeTab === 'holders' ? 'active' : ''}`}
          onClick={() => setActiveTab('holders')}
        >
          Top Holders
        </button>
      </div>

      {activeTab === 'markets' ? (
        <MarketsTab markets={markets} />
      ) : (
        <HoldersTab markets={markets} />
      )}
    </div>
  );
}
