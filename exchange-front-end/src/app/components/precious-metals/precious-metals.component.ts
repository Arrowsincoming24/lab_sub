// Watermark: Aarav Joshi
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface MetalQuote {
  symbol: string;
  name: string;
  type: 'spot' | 'futures' | 'etf';
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume: number;
  prevClose: number;
  lastUpdate: Date;
  unit: string;
  color: string;
}

interface MetalNews {
  id: number;
  title: string;
  source: string;
  time: Date;
  impact: 'positive' | 'negative' | 'neutral';
}

interface MarketCorrelation {
  name: string;
  correlation: number;
  trend: 'positive' | 'negative' | 'neutral';
}

interface PriceLevel {
  type: 'support' | 'resistance';
  price: number;
  strength: number;
}

@Component({
  selector: 'app-precious-metals',
  templateUrl: './precious-metals.component.html',
  styleUrls: ['./precious-metals.component.scss']
})
export class PreciousMetalsComponent implements OnInit, OnDestroy {
  @Output() metalSelect = new EventEmitter<{ symbol: string; price: number }>();

  metals: MetalQuote[] = [];
  etfs: MetalQuote[] = [];
  futures: MetalQuote[] = [];
  selectedMetal: MetalQuote | null = null;
  activeTab: 'spot' | 'futures' | 'etf' = 'spot';
  
  // Trading form
  orderForm = {
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: 1,
    unit: 'oz',
    orderType: 'LIMIT' as 'LIMIT' | 'MARKET' | 'STOP',
    price: 0,
    stopPrice: 0
  };

  // Market overview with more indicators
  marketOverview = {
    goldSentiment: 65,
    dollarIndex: 104.25,
    bondYield: 4.12,
    inflationExpectation: 2.8,
    goldSilverRatio: 87.2,
    vix: 14.5,
    realYield: 1.85
  };

  // Market correlations
  correlations: MarketCorrelation[] = [
    { name: 'S&P 500', correlation: -0.35, trend: 'negative' },
    { name: 'US Dollar', correlation: -0.78, trend: 'negative' },
    { name: 'Bond Prices', correlation: 0.65, trend: 'positive' },
    { name: 'Oil', correlation: 0.42, trend: 'positive' }
  ];

  // Key price levels for selected metal
  priceLevels: PriceLevel[] = [];

  // Historical performance
  historicalReturns = {
    day: 0.61,
    week: 1.24,
    month: 3.85,
    ytd: 8.42,
    year: 12.15
  };

  // Recent news
  news: MetalNews[] = [];

  // Quick amount presets (in USD)
  quickAmounts = [1000, 5000, 10000, 25000, 50000];

  // Price alerts
  priceAlerts: { symbol: string; price: number; type: 'above' | 'below' }[] = [];

  // Comparison mode
  compareMode = false;
  compareSymbol: string | null = null;

  submittingOrder = false;
  submitSuccess: string | null = null;
  submitError: string | null = null;

  private updateInterval: any;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.initializeMetals();
    this.initializeNews();
    this.startRealTimeUpdates();
    if (this.metals.length) {
      this.selectMetal(this.metals[0]);
    }
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private initializeMetals(): void {
    // Spot Prices
    this.metals = [
      this.createMetal('XAUUSD', 'Gold', 'spot', 2045.80, 2045.50, 2046.10, 12.40, 'oz', '#ffd700'),
      this.createMetal('XAGUSD', 'Silver', 'spot', 23.45, 23.42, 23.48, -0.18, 'oz', '#c0c0c0'),
      this.createMetal('XPTUSD', 'Platinum', 'spot', 985.60, 985.20, 986.00, 8.25, 'oz', '#e5e4e2'),
      this.createMetal('XPDUSD', 'Palladium', 'spot', 1025.40, 1024.80, 1026.00, -15.60, 'oz', '#cec8c8'),
      this.createMetal('XRHUSD', 'Rhodium', 'spot', 4850.00, 4840.00, 4860.00, 45.00, 'oz', '#d4af37'),
    ];

    // Futures
    this.futures = [
      this.createMetal('GC', 'Gold Futures (Apr)', 'futures', 2048.50, 2048.20, 2048.80, 13.80, 'oz', '#ffd700'),
      this.createMetal('SI', 'Silver Futures (May)', 'futures', 23.52, 23.49, 23.55, -0.12, 'oz', '#c0c0c0'),
      this.createMetal('PL', 'Platinum Futures (Jul)', 'futures', 988.40, 988.00, 988.80, 9.60, 'oz', '#e5e4e2'),
      this.createMetal('PA', 'Palladium Futures (Jun)', 'futures', 1028.50, 1028.00, 1029.00, -12.30, 'oz', '#cec8c8'),
    ];

    // ETFs
    this.etfs = [
      this.createMetal('GLD', 'SPDR Gold Trust', 'etf', 188.45, 188.40, 188.50, 1.15, 'share', '#ffd700'),
      this.createMetal('SLV', 'iShares Silver Trust', 'etf', 21.58, 21.55, 21.61, -0.12, 'share', '#c0c0c0'),
      this.createMetal('PPLT', 'abrdn Platinum ETF', 'etf', 86.90, 86.85, 86.95, 0.72, 'share', '#e5e4e2'),
      this.createMetal('PALL', 'Aberdeen Palladium ETF', 'etf', 92.30, 92.25, 92.35, -1.45, 'share', '#cec8c8'),
      this.createMetal('IAU', 'iShares Gold Trust', 'etf', 38.42, 38.40, 38.44, 0.24, 'share', '#ffd700'),
      this.createMetal('SGOL', 'Aberdeen Gold ETF', 'etf', 19.85, 19.83, 19.87, 0.12, 'share', '#ffd700'),
      this.createMetal('PHYS', 'Sprott Physical Gold', 'etf', 16.28, 16.25, 16.31, 0.10, 'share', '#ffd700'),
      this.createMetal('SIVR', 'Aberdeen Silver ETF', 'etf', 23.15, 23.12, 23.18, -0.08, 'share', '#c0c0c0'),
    ];
  }

  private createMetal(symbol: string, name: string, type: 'spot' | 'futures' | 'etf', price: number, bid: number, ask: number, change: number, unit: string, color: string): MetalQuote {
    const changePercent = (change / (price - change)) * 100;
    return {
      symbol,
      name,
      type,
      price,
      bid,
      ask,
      change,
      changePercent,
      high24h: price * (1 + Math.random() * 0.015),
      low24h: price * (1 - Math.random() * 0.015),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      prevClose: price - change,
      lastUpdate: new Date(),
      unit,
      color
    };
  }

  private initializeNews(): void {
    this.news = [
      { id: 1, title: 'Fed maintains dovish stance, gold rallies to 3-week high', source: 'Reuters', time: new Date(Date.now() - 3600000), impact: 'positive' },
      { id: 2, title: 'Silver demand surges on solar panel manufacturing growth', source: 'Bloomberg', time: new Date(Date.now() - 7200000), impact: 'positive' },
      { id: 3, title: 'Dollar weakens amid Treasury yield drop, metals benefit', source: 'CNBC', time: new Date(Date.now() - 10800000), impact: 'positive' },
      { id: 4, title: 'Platinum group metals face supply constraints from SA mines', source: 'Kitco', time: new Date(Date.now() - 14400000), impact: 'positive' },
      { id: 5, title: 'Central bank gold purchases hit record Q4 levels', source: 'WGC', time: new Date(Date.now() - 18000000), impact: 'positive' },
      { id: 6, title: 'Palladium drops on EV adoption concerns for auto sector', source: 'MarketWatch', time: new Date(Date.now() - 21600000), impact: 'negative' },
    ];
  }

  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updatePrices(this.metals);
      this.updatePrices(this.futures);
      this.updatePrices(this.etfs);
      
      // Update market indicators
      this.marketOverview.goldSentiment = Math.max(0, Math.min(100, this.marketOverview.goldSentiment + (Math.random() - 0.5) * 3));
      this.marketOverview.dollarIndex += (Math.random() - 0.5) * 0.08;
      this.marketOverview.bondYield += (Math.random() - 0.5) * 0.02;
      this.marketOverview.vix += (Math.random() - 0.5) * 0.3;
      this.marketOverview.realYield += (Math.random() - 0.5) * 0.01;
      
      // Update gold-silver ratio
      const gold = this.metals.find(m => m.symbol === 'XAUUSD');
      const silver = this.metals.find(m => m.symbol === 'XAGUSD');
      if (gold && silver) {
        this.marketOverview.goldSilverRatio = gold.price / silver.price;
      }
      
      // Update correlations
      this.correlations.forEach(c => {
        c.correlation = Math.max(-1, Math.min(1, c.correlation + (Math.random() - 0.5) * 0.05));
        c.trend = c.correlation > 0.1 ? 'positive' : c.correlation < -0.1 ? 'negative' : 'neutral';
      });
      
      if (this.selectedMetal) {
        this.orderForm.price = this.selectedMetal.price;
        this.updatePriceLevels();
      }
    }, 1500);
  }

  private updatePrices(items: MetalQuote[]): void {
    items.forEach(metal => {
      const priceChange = (Math.random() - 0.5) * 0.002 * metal.price;
      metal.price = Math.max(0.01, metal.price + priceChange);
      metal.bid = metal.price * 0.9998;
      metal.ask = metal.price * 1.0002;
      metal.change += priceChange * 0.2;
      metal.changePercent = (metal.change / metal.prevClose) * 100;
      
      if (metal.price > metal.high24h) metal.high24h = metal.price;
      if (metal.price < metal.low24h) metal.low24h = metal.price;
      
      metal.volume += Math.floor(Math.random() * 500);
      metal.lastUpdate = new Date();
    });
  }

  private updatePriceLevels(): void {
    if (!this.selectedMetal) return;
    const price = this.selectedMetal.price;
    this.priceLevels = [
      { type: 'resistance', price: price * 1.025, strength: 85 },
      { type: 'resistance', price: price * 1.015, strength: 70 },
      { type: 'support', price: price * 0.985, strength: 75 },
      { type: 'support', price: price * 0.975, strength: 90 },
    ];
  }

  setActiveTab(tab: 'spot' | 'futures' | 'etf'): void {
    this.activeTab = tab;
  }

  getActiveItems(): MetalQuote[] {
    switch (this.activeTab) {
      case 'spot': return this.metals;
      case 'futures': return this.futures;
      case 'etf': return this.etfs;
    }
  }

  selectMetal(metal: MetalQuote): void {
    this.selectedMetal = metal;
    this.orderForm.price = metal.price;
    this.orderForm.unit = metal.unit;
    this.updatePriceLevels();
    this.updateHistoricalReturns();
    this.metalSelect.emit({ symbol: metal.symbol, price: metal.price });
  }

  private updateHistoricalReturns(): void {
    // Simulate historical returns based on current change
    if (this.selectedMetal) {
      const baseChange = this.selectedMetal.changePercent;
      this.historicalReturns = {
        day: baseChange,
        week: baseChange * (2 + Math.random()),
        month: baseChange * (5 + Math.random() * 3),
        ytd: baseChange * (12 + Math.random() * 5),
        year: baseChange * (18 + Math.random() * 8)
      };
    }
  }

  setSide(side: 'BUY' | 'SELL'): void {
    this.orderForm.side = side;
  }

  setQuickAmount(amount: number): void {
    if (this.selectedMetal) {
      this.orderForm.quantity = Math.floor(amount / this.selectedMetal.price * 100) / 100;
    }
  }

  // Expose Math for template usage
  Math = Math;

  getEstimatedTotal(): number {
    if (!this.selectedMetal) return 0;
    const price = this.orderForm.orderType === 'MARKET'
      ? (this.orderForm.side === 'BUY' ? this.selectedMetal.ask : this.selectedMetal.bid)
      : this.orderForm.price;
    return this.orderForm.quantity * price;
  }

  getSpread(): number {
    if (!this.selectedMetal) return 0;
    return this.selectedMetal.ask - this.selectedMetal.bid;
  }

  getSpreadPercent(): number {
    if (!this.selectedMetal) return 0;
    return (this.getSpread() / this.selectedMetal.bid) * 100;
  }

  submitOrder(): void {
    if (!this.selectedMetal) {
      return;
    }

    if (this.submittingOrder) {
      return;
    }

    this.submitSuccess = null;
    this.submitError = null;

    const executionPrice = this.orderForm.orderType === 'MARKET'
      ? (this.orderForm.side === 'BUY' ? this.selectedMetal.ask : this.selectedMetal.bid)
      : this.orderForm.price;

    const payload = {
      clOrdId: `PM-${Date.now()}`,
      symbol: this.selectedMetal.symbol,
      side: this.orderForm.side === 'BUY' ? '1' : '2',
      quantity: Math.max(1, Math.floor(this.orderForm.quantity)),
      price: executionPrice,
      orderType: this.orderForm.orderType,
      timeInForce: 'DAY',
      status: 'NEW'
    };

    this.submittingOrder = true;
    this.http.post<any>('/api/orders', payload).subscribe({
      next: (result) => {
        const ref = result?.orderRefNumber || result?.clOrdId || payload.clOrdId;
        this.submitSuccess = `Order submitted: ${ref}`;
        this.orderForm.quantity = 1;
        this.orderForm.price = this.selectedMetal?.price || this.orderForm.price;
        this.submittingOrder = false;
      },
      error: (err) => {
        this.submitError = err?.error?.message || err?.error?.error || 'Failed to submit precious metals order';
        this.submittingOrder = false;
      }
    });
  }

  formatPrice(price: number): string {
    if (price >= 100) return price.toFixed(2);
    return price.toFixed(4);
  }

  formatVolume(volume: number): string {
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';
    if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
    return volume.toString();
  }

  getTimeAgo(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  getMetalIcon(symbol: string): string {
    if (symbol.includes('AU') || symbol.includes('GOLD') || symbol === 'GC' || symbol === 'GLD' || symbol === 'IAU' || symbol === 'SGOL' || symbol === 'PHYS') return '🥇';
    if (symbol.includes('AG') || symbol.includes('SILVER') || symbol === 'SI' || symbol === 'SLV' || symbol === 'SIVR') return '🥈';
    if (symbol.includes('PT') || symbol.includes('PLAT') || symbol === 'PL' || symbol === 'PPLT') return '⚪';
    if (symbol.includes('PD') || symbol.includes('PALL') || symbol === 'PA') return '🔘';
    if (symbol.includes('RH')) return '✨';
    return '💎';
  }
}
