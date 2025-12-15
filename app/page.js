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

// Top Suspicious Accounts Tab Component
function SuspiciousTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWallet, setExpandedWallet] = useState(null);

  useEffect(() => {
    fetch('/data/suspicious.json')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading suspicious accounts...</div>;
  }

  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div className="empty-message">
        <p>🔄 데이터 준비 중...</p>
        <p style={{fontSize: '0.9rem', color: '#8b949e'}}>GitHub Actions에서 스캔이 완료되면 여기에 의심 계정이 표시됩니다.</p>
      </div>
    );
  }

  const getFlag = (score) => score >= 70 ? '🚨' : score >= 50 ? '⚠️' : '👀';
  
  const formatPnl = (pnl) => {
    if (pnl === undefined || pnl === null) return '?';
    const absVal = Math.abs(pnl);
    const formatted = absVal >= 1000 ? `${(absVal / 1000).toFixed(1)}K` : absVal.toString();
    return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };

  return (
    <div className="suspicious-tab">
      <table className="markets-table">
        <thead>
          <tr>
            <th style={{ cursor: 'default' }}>#</th>
            <th style={{ cursor: 'default' }}>Account</th>
            <th style={{ cursor: 'default' }}>Score</th>
            <th style={{ cursor: 'default' }}>Position</th>
            <th style={{ cursor: 'default' }}>All PnL</th>
            <th style={{ cursor: 'default' }}>30d PnL</th>
            <th style={{ cursor: 'default' }}>Mkts</th>
            <th style={{ cursor: 'default' }}>Age</th>
            <th style={{ cursor: 'default' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.map((acc, idx) => {
            const isExpanded = expandedWallet === acc.wallet;
            return (
              <tr key={acc.wallet} className={isExpanded ? 'expanded-row' : ''}>
                <td className="rank-col">{getFlag(acc.maxScore)} #{idx + 1}</td>
                <td className="name-col">
                  <a href={`https://polymarket.com/profile/${acc.wallet}`} target="_blank" rel="noopener noreferrer">
                    {acc.name || `${acc.wallet.slice(0, 10)}...`}
                  </a>
                  {acc.isCamouflage && <span className="camo-badge">🎭</span>}
                </td>
                <td className="score-col">{acc.maxScore}pt</td>
                <td className="value-col">${Math.round(acc.totalValue).toLocaleString()}</td>
                <td className={`pnl-col ${(acc.allTimePnl || 0) >= 0 ? 'positive' : 'negative'}`}>{formatPnl(acc.allTimePnl)}</td>
                <td className={`pnl-col ${(acc.monthPnl || 0) >= 0 ? 'positive' : 'negative'}`}>{formatPnl(acc.monthPnl)}</td>
                <td>{acc.markets?.length || 0}</td>
                <td className="age-col">{acc.accountAgeDays < 999 ? `${acc.accountAgeDays}d` : '?'}</td>
                <td>
                  <button className="expand-btn" onClick={() => setExpandedWallet(isExpanded ? null : acc.wallet)}>
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {expandedWallet && (() => {
        const acc = data.accounts.find(a => a.wallet === expandedWallet);
        if (!acc || !acc.markets) return null;
        return (
          <div className="expanded-markets">
            <h4>📊 {acc.name || acc.wallet.slice(0, 10)}의 포지션</h4>
            <table className="markets-detail-table">
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Value</th>
                  <th>Ratio</th>
                  <th>Entry</th>
                </tr>
              </thead>
              <tbody>
                {acc.markets.sort((a, b) => b.score - a.score).map((mkt, i) => (
                  <tr key={i}>
                    <td className="score-col">{mkt.score}pt</td>
                    <td>
                      <a href={`https://polymarket.com/event/${mkt.slug}`} target="_blank" rel="noopener noreferrer">
                        {mkt.question?.slice(0, 50) || mkt.slug}...
                      </a>
                    </td>
                    <td><span className={`side-badge ${mkt.side?.toLowerCase()}`}>{mkt.side}</span></td>
                    <td className="value-col">${Math.round(mkt.amount).toLocaleString()}</td>
                    <td>{mkt.marketRatio}%</td>
                    <td>{mkt.marketEntryDays}d ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
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
                                    <span>📊 {h.totalMarkets} mkt{h.totalMarkets !== 1 ? 's' : ''}{h.isCamouflage ? ' 🎭' : ''}</span>
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

      {activeTab === 'suspicious' && (
        <SuspiciousTab />
      )}
      {activeTab === 'markets' && (
        <MarketsTab markets={markets} searchQuery={searchQuery} />
      )}
      {activeTab === 'holders' && (
        <HoldersTab markets={markets} searchQuery={searchQuery} />
      )}
    </div>
  );
}

