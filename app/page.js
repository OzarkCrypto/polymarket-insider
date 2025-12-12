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

function MarketCard({ market }) {
  const [expanded, setExpanded] = useState(false);
  const [holders, setHolders] = useState(null);
  const [loadingHolders, setLoadingHolders] = useState(false);

  const loadHolders = async () => {
    if (holders) return;
    setLoadingHolders(true);
    try {
      const res = await fetch(`/api/holders?market=${market.conditionId}`);
      const data = await res.json();
      setHolders(data);
    } catch (err) {
      console.error('Error loading holders:', err);
      setHolders({ yes: [], no: [] });
    }
    setLoadingHolders(false);
  };

  const handleToggle = () => {
    if (!expanded) {
      loadHolders();
    }
    setExpanded(!expanded);
  };

  const yesPrice = parseFloat(market.outcomePrices[0]) * 100;
  const noPrice = parseFloat(market.outcomePrices[1]) * 100;
  const marketUrl = `https://polymarket.com/event/${market.eventSlug}/${market.slug}`;

  return (
    <div className="market-card">
      <div className="market-header">
        {market.image && (
          <img src={market.image} alt="" className="market-image" />
        )}
        <div className="market-info">
          <h3 className="market-question">
            <a href={marketUrl} target="_blank" rel="noopener noreferrer">
              {market.question}
            </a>
          </h3>
          <div className="market-meta">
            <span className="market-tag volume">Vol: {formatNumber(market.volume)}</span>
            <span className="market-tag">Liq: {formatNumber(market.liquidity)}</span>
            {market.endDate && (
              <span className="market-tag">
                Ends: {new Date(market.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="market-prices">
          <div className="price-box yes">
            <div className="price-label">Yes</div>
            <div className="price-value">{yesPrice.toFixed(1)}¢</div>
          </div>
          <div className="price-box no">
            <div className="price-label">No</div>
            <div className="price-value">{noPrice.toFixed(1)}¢</div>
          </div>
        </div>
      </div>
      
      <div className="holders-section">
        <div className="holders-toggle" onClick={handleToggle}>
          <div className={`holders-toggle-icon ${expanded ? 'open' : ''}`}>
            ▶
          </div>
          <span className="holders-toggle-text">
            TOP 10 Holders (Click to {expanded ? 'hide' : 'show'})
          </span>
        </div>
        
        <div className={`holders-content ${expanded ? 'open' : ''}`}>
          {loadingHolders ? (
            <div className="holders-loading">Loading holders...</div>
          ) : holders ? (
            <div className="holders-grid">
              <div className="holders-column yes">
                <div className="holders-column-title">
                  <span>🟢</span> YES HOLDERS
                </div>
                {holders.yes.length > 0 ? (
                  holders.yes.map((holder, idx) => (
                    <HolderItem key={holder.wallet} holder={holder} rank={idx + 1} />
                  ))
                ) : (
                  <div className="no-holders">No YES holders found</div>
                )}
              </div>
              <div className="holders-column no">
                <div className="holders-column-title">
                  <span>🔴</span> NO HOLDERS
                </div>
                {holders.no.length > 0 ? (
                  holders.no.map((holder, idx) => (
                    <HolderItem key={holder.wallet} holder={holder} rank={idx + 1} />
                  ))
                ) : (
                  <div className="no-holders">No NO holders found</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HolderItem({ holder, rank }) {
  const profileUrl = `https://polymarket.com/profile/${holder.wallet}`;
  const initials = holder.name ? holder.name.slice(0, 2).toUpperCase() : '??';
  
  return (
    <div className="holder-item">
      <div className="holder-rank">#{rank}</div>
      <div className="holder-avatar">
        {holder.profileImage ? (
          <img src={holder.profileImage} alt="" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      <div className="holder-info">
        <div className="holder-name">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            {holder.name || 'Anonymous'}
          </a>
        </div>
        <div className="holder-wallet">
          {holder.wallet.slice(0, 6)}...{holder.wallet.slice(-4)}
        </div>
      </div>
      <div className="holder-amount">{formatAmount(holder.amount)}</div>
    </div>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <div className="loading-text">Loading Tech Markets...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="loading-text" style={{ color: '#ff3b5c' }}>
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">PM</div>
          <div>
            <h1>POLYMARKET INSIDER</h1>
            <p>Tech Markets • Whale Tracker</p>
          </div>
        </div>
        <div className="stats-bar">
          <div className="stat-box">
            <div className="stat-label">Total Volume</div>
            <div className="stat-value">{formatNumber(totalVolume)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Active Markets</div>
            <div className="stat-value blue">{markets.length}</div>
          </div>
        </div>
      </header>

      <div className="markets-list">
        {markets.map(market => (
          <MarketCard key={market.conditionId} market={market} />
        ))}
      </div>
    </div>
  );
}
