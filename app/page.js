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
function MarketsTab({ markets, searchQuery }) {
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
                                {h.name || h.wallet}
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
                                {h.name || h.wallet}
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

// Insider Score 탭 컴포넌트
function InsiderTab({ markets, searchQuery }) {
  const [insiderData, setInsiderData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWallet, setExpandedWallet] = useState(null);
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function analyzeInsiders() {
      setLoading(true);
      
      // 기업별 마켓 매핑
      const companyMarkets = {};
      markets.forEach(market => {
        const company = extractCompany(market.question);
        if (company) {
          if (!companyMarkets[company]) companyMarkets[company] = [];
          companyMarkets[company].push(market);
        }
      });

      // 홀더 데이터 수집
      const holdersMap = {};
      
      await Promise.all(
        markets.map(async (market) => {
          const company = extractCompany(market.question);
          
          try {
            const res = await fetch(`/api/holders?market=${market.conditionId}`);
            const data = await res.json();

            [...(data.yes || []), ...(data.no || [])].forEach(h => {
              if (BLACKLIST.includes(h.wallet.toLowerCase())) return;
              
              if (!holdersMap[h.wallet]) {
                holdersMap[h.wallet] = {
                  wallet: h.wallet,
                  name: h.name,
                  totalShares: 0,
                  positions: [],
                  companyPositions: {},
                };
              }
              
              if (h.name && !holdersMap[h.wallet].name) {
                holdersMap[h.wallet].name = h.name;
              }
              
              const side = data.yes?.includes(h) ? 'YES' : 'NO';
              
              holdersMap[h.wallet].totalShares += h.amount;
              
              holdersMap[h.wallet].positions.push({
                market: market.question,
                marketSlug: market.slug,
                eventSlug: market.eventSlug,
                company,
                side,
                amount: h.amount,
              });
              
              if (company) {
                if (!holdersMap[h.wallet].companyPositions[company]) {
                  holdersMap[h.wallet].companyPositions[company] = {
                    markets: [],
                    totalAmount: 0,
                    yesCount: 0,
                    noCount: 0,
                  };
                }
                holdersMap[h.wallet].companyPositions[company].markets.push({
                  question: market.question,
                  side,
                  amount: h.amount,
                });
                holdersMap[h.wallet].companyPositions[company].totalAmount += h.amount;
                if (side === 'YES') {
                  holdersMap[h.wallet].companyPositions[company].yesCount++;
                } else {
                  holdersMap[h.wallet].companyPositions[company].noCount++;
                }
              }
            });
          } catch (err) {
            console.error('Error:', err);
          }
        })
      );

      // Insider Score 계산
      const insiders = Object.values(holdersMap).map(holder => {
        const companies = Object.keys(holder.companyPositions);
        const totalPositions = holder.positions.length;
        
        // 가장 집중한 기업 찾기 (전체 포지션 대비 해당 기업 포지션 비율 기준)
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

        // 1. 포트폴리오 집중도 (45점)
        // 전체 포지션 대비 특정 기업 포지션 비율
        // 예: 8개 포지션 중 6개가 OpenAI = 75% = 0.75 * 45 = 33.75점
        const portfolioConcentration = maxPortfolioRatio;

        // 2. 기업 마켓 커버리지 (15점)
        // 해당 기업의 전체 마켓 중 몇 개에 참여했는지
        // 예: OpenAI 마켓 10개 중 6개 참여 = 60%
        let marketCoverage = 0;
        if (focusCompany && focusCompanyData) {
          const totalMarketsForCompany = companyMarkets[focusCompany]?.length || 1;
          marketCoverage = Math.min(1, focusCompanyData.markets.length / totalMarketsForCompany);
        }

        // 3. 방향 일관성 (10점)
        // 같은 기업에서 YES/NO 중 한 방향으로만 베팅
        let directionConsistency = 0;
        if (focusCompanyData) {
          const total = focusCompanyData.yesCount + focusCompanyData.noCount;
          const dominant = Math.max(focusCompanyData.yesCount, focusCompanyData.noCount);
          directionConsistency = total > 0 ? dominant / total : 0;
        }

        // 4. Position Value 점수 (30점)
        // $1K 이하: 0점, $50K 이상: 만점 (로그 스케일)
        const companyPositionValue = focusCompanyData?.totalAmount || 0;
        let positionValueScore = 0;
        if (companyPositionValue >= 50000) {
          positionValueScore = 1;
        } else if (companyPositionValue >= 1000) {
          // 로그 스케일: log(value/1000) / log(50) ≈ 0~1
          positionValueScore = Math.log10(companyPositionValue / 1000) / Math.log10(50);
        }

        // 최종 점수 계산 (100점 만점)
        // - 포트폴리오 집중도: 45점 (전체 포지션 대비 특정 기업 비율) ★핵심★
        // - Position Value: 30점 (베팅 규모)
        // - 기업 마켓 커버리지: 15점 (해당 기업 마켓 참여율)
        // - 방향 일관성: 10점 (한 방향으로만 베팅)
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

      // 점수가 20점 이상인 계정만 필터링 (너무 낮은 점수 제외)
      const filteredInsiders = insiders.filter(i => i.score >= 20 && i.focusCompany);
      setInsiderData(filteredInsiders);
      setLoading(false);
    }

    if (markets.length > 0) {
      analyzeInsiders();
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
  const filteredInsiders = insiderData.filter(insider => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      insider.wallet.toLowerCase().includes(query) ||
      (insider.name && insider.name.toLowerCase().includes(query)) ||
      (insider.focusCompany && insider.focusCompany.toLowerCase().includes(query))
    );
  });

  const sortedInsiders = [...filteredInsiders].sort((a, b) => {
    let aVal, bVal;
    switch (sortKey) {
      case 'score': aVal = a.score; bVal = b.score; break;
      case 'portfolioRatio': aVal = parseFloat(a.portfolioRatio); bVal = parseFloat(b.portfolioRatio); break;
      case 'positionValue': aVal = a.positionValue; bVal = b.positionValue; break;
      default: return 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const getScoreColor = (score) => {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Analyzing insider patterns...
      </div>
    );
  }

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
          <th style={{ cursor: 'default' }}>Focus</th>
          <th onClick={() => handleSort('portfolioRatio')} className={sortKey === 'portfolioRatio' ? 'sorted' : ''}>
            Focus %
            <span className="sort-icon">{sortKey === 'portfolioRatio' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th onClick={() => handleSort('positionValue')} className={sortKey === 'positionValue' ? 'sorted' : ''}>
            Position $
            <span className="sort-icon">{sortKey === 'positionValue' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</span>
          </th>
          <th style={{ cursor: 'default' }}>Dir</th>
          <th style={{ cursor: 'default' }}></th>
        </tr>
      </thead>
      <tbody>
        {sortedInsiders.map((insider, idx) => {
          const isExpanded = expandedWallet === insider.wallet;
          const profileUrl = `https://polymarket.com/profile/${insider.wallet}`;

          return (
            <tr key={insider.wallet} className={isExpanded ? 'expanded-row' : ''}>
              <td className="rank-cell">#{idx + 1}</td>
              <td>
                <div className="holder-cell">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="holder-link">
                    {insider.name || insider.wallet}
                  </a>
                  <span className="wallet-address">{insider.wallet}</span>
                </div>
                {isExpanded && (
                  <div className="positions-detail">
                    <div className="insider-breakdown">
                      <h4>Positions in {insider.focusCompany} ({insider.focusCompanyMarkets}/{insider.totalMarkets} positions):</h4>
                      {insider.companyPositions[insider.focusCompany]?.markets.map((pos, i) => (
                        <div key={i} className={`position-item ${pos.side.toLowerCase()}`}>
                          <span className={`position-side ${pos.side.toLowerCase()}`}>{pos.side}</span>
                          <span className="position-question">{pos.question}</span>
                          <span className="position-amount">{formatAmount(pos.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </td>
              <td>
                <span className={`insider-score ${getScoreColor(insider.score)}`}>
                  {insider.score}
                </span>
              </td>
              <td className="company-cell">{insider.focusCompany || '-'}</td>
              <td>
                <span className={`portfolio-ratio ${parseInt(insider.portfolioRatio) >= 50 ? 'high' : ''}`}>
                  {insider.portfolioRatio}%
                </span>
                <span className="position-count">({insider.focusCompanyMarkets}/{insider.totalMarkets})</span>
              </td>
              <td className={`position-value ${insider.positionValue >= 50000 ? 'high-value' : ''}`}>
                {formatNumber(insider.positionValue)}
              </td>
              <td>
                <span className={`direction ${insider.direction.toLowerCase()}`}>
                  {insider.direction}
                </span>
              </td>
              <td>
                <button className="expand-btn" onClick={() => setExpandedWallet(isExpanded ? null : insider.wallet)}>
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
          className={`tab ${activeTab === 'holders' ? 'active' : ''}`}
          onClick={() => setActiveTab('holders')}
        >
          Top Holders
        </button>
        <button 
          className={`tab ${activeTab === 'insider' ? 'active' : ''}`}
          onClick={() => setActiveTab('insider')}
        >
          🔍 Insider Score
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder={
            activeTab === 'markets' ? 'Search markets...' : 
            activeTab === 'insider' ? 'Search by wallet, name, or company...' :
            'Search by wallet address or name...'
          }
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
      {activeTab === 'holders' && (
        <HoldersTab markets={markets} searchQuery={searchQuery} />
      )}
      {activeTab === 'insider' && (
        <InsiderTab markets={markets} searchQuery={searchQuery} />
      )}
    </div>
  );
}
