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

function HoldersRow({ market, isOpen, onToggle }) {
  const [holders, setHolders] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadHolders = async () => {
    if (holders) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/holders?market=${market.conditionId}`);
      const data = await res.json();
      setHolders(data);
    } catch (err) {
      setHolders({ yes: [], no: [] });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && !holders) {
      loadHolders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <tr className="holders-row">
      <td colSpan="7">
        <div className="holders-content">
          {loading ? (
            <div className="holders-loading">Loading holders...</div>
          ) : holders ? (
            <div className="holders-grid">
              <div className="holders-column yes">
                <h4>YES HOLDERS (Top 10)</h4>
                {holders.yes.length > 0 ? (
                  holders.yes.map((h, i) => (
                    <div key={h.wallet} className="holder-item">
                      <span className="holder-rank">#{i + 1}</span>
                      <div>
                        <div className="holder-name">
                          <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                            {h.name || 'Anonymous'}
                          </a>
                        </div>
                        <div className="holder-wallet">{h.wallet.slice(0, 6)}...{h.wallet.slice(-4)}</div>
                      </div>
                      <span className="holder-amount">{formatAmount(h.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-holders">No holders</div>
                )}
              </div>
              <div className="holders-column no">
                <h4>NO HOLDERS (Top 10)</h4>
                {holders.no.length > 0 ? (
                  holders.no.map((h, i) => (
                    <div key={h.wallet} className="holder-item">
                      <span className="holder-rank">#{i + 1}</span>
                      <div>
                        <div className="holder-name">
                          <a href={`https://polymarket.com/profile/${h.wallet}`} target="_blank" rel="noopener noreferrer">
                            {h.name || 'Anonymous'}
                          </a>
                        </div>
                        <div className="holder-wallet">{h.wallet.slice(0, 6)}...{h.wallet.slice(-4)}</div>
                      </div>
                      <span className="holder-amount">{formatAmount(h.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-holders">No holders</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedMarkets = [...markets].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortKey) {
      case 'yes':
        aVal = parseFloat(a.outcomePrices[0]);
        bVal = parseFloat(b.outcomePrices[0]);
        break;
      case 'no':
        aVal = parseFloat(a.outcomePrices[1]);
        bVal = parseFloat(b.outcomePrices[1]);
        break;
      case 'volume':
        aVal = a.volume;
        bVal = b.volume;
        break;
      case 'liquidity':
        aVal = a.liquidity;
        bVal = b.liquidity;
        break;
      case 'endDate':
        aVal = a.endDate ? new Date(a.endDate).getTime() : 0;
        bVal = b.endDate ? new Date(b.endDate).getTime() : 0;
        break;
      default:
        return 0;
    }
    
    if (sortDir === 'asc') {
      return aVal - bVal;
    }
    return bVal - aVal;
  });

  const totalVolume = markets.reduce((sum, m) => sum + m.volume, 0);

  const SortHeader = ({ label, keyName }) => (
    <th 
      onClick={() => handleSort(keyName)}
      className={sortKey === keyName ? 'sorted' : ''}
    >
      {label}
      <span className="sort-icon">
        {sortKey === keyName ? (sortDir === 'desc' ? '▼' : '▲') : ''}
      </span>
    </th>
  );

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
        <div className="loading" style={{ color: '#cf222e' }}>
          Error: {error}
        </div>
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

            return (
              <>
                <tr key={market.conditionId}>
                  <td>
                    <div className="market-cell">
                      {market.image && (
                        <img src={market.image} alt="" className="market-image" />
                      )}
                      <span className="market-question">
                        <a href={marketUrl} target="_blank" rel="noopener noreferrer">
                          {market.question}
                        </a>
                      </span>
                    </div>
                  </td>
                  <td className="price-yes">{yesPrice}¢</td>
                  <td className="price-no">{noPrice}¢</td>
                  <td className="volume-cell">{formatNumber(market.volume)}</td>
                  <td className="text-dim">{formatNumber(market.liquidity)}</td>
                  <td className="text-dim">
                    {market.endDate ? new Date(market.endDate).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <button 
                      className="expand-btn"
                      onClick={() => setExpandedId(isExpanded ? null : market.conditionId)}
                    >
                      {isExpanded ? 'Hide' : 'Show'}
                    </button>
                  </td>
                </tr>
                <HoldersRow 
                  key={`holders-${market.conditionId}`}
                  market={market} 
                  isOpen={isExpanded}
                />
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
