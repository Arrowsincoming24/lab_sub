// Watermark: Aarav Joshi
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface CommodityQuote {
  symbol: string;
  name: string;
  category: string;
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  openInterest: number;
  lastUpdate: Date;
  contractMonth?: string;
  unit: string;
}

interface CommodityCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  commodities: CommodityQuote[];
}

@Component({
  selector: 'app-commodities-trading',
  templateUrl: './commodities-trading.component.html',
  styleUrls: ['./commodities-trading.component.scss']
})
export class CommoditiesTradingComponent implements OnInit, OnDestroy {
  @Output() commoditySelect = new EventEmitter<{ symbol: string; price: number }>();

  categories: CommodityCategory[] = [];
  selectedCategory: string = 'all';
  selectedCommodity: CommodityQuote | null = null;
  searchQuery: string = '';
  sortBy: string = 'symbol';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Trading form
  tradeForm = {
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: 1,
    orderType: 'LIMIT' as 'LIMIT' | 'MARKET',
    price: 0
  };

  // Market summary
  marketSummary = {
    totalVolume: 0,
    gainers: 0,
    losers: 0,
    unchanged: 0,
    mostActive: null as CommodityQuote | null
  };

  tradeSubmitting = false;
  tradeSuccess: string | null = null;
  tradeError: string | null = null;

  private updateInterval: any;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.initializeCategories();
    this.calculateMarketSummary();
    this.startRealTimeUpdates();
    if (this.categories[0]?.commodities.length) {
      this.selectCommodity(this.categories[0].commodities[0]);
    }
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private initializeCategories(): void {
    this.categories = [
      {
        id: 'energy',
        name: 'Energy',
        icon: '⚡',
        color: '#f0883e',
        commodities: [
          this.createCommodity('CL', 'Crude Oil WTI', 'energy', 78.45, 78.42, 78.48, 1.25, 'barrel'),
          this.createCommodity('BZ', 'Brent Crude', 'energy', 82.30, 82.27, 82.33, 1.18, 'barrel'),
          this.createCommodity('NG', 'Natural Gas', 'energy', 2.285, 2.282, 2.288, -0.042, 'MMBtu'),
          this.createCommodity('HO', 'Heating Oil', 'energy', 2.6540, 2.6520, 2.6560, 0.0285, 'gallon'),
          this.createCommodity('RB', 'RBOB Gasoline', 'energy', 2.2180, 2.2160, 2.2200, 0.0145, 'gallon'),
          this.createCommodity('USO', 'US Oil Fund ETF', 'energy', 75.80, 75.77, 75.83, 0.92, 'share'),
          this.createCommodity('UNG', 'US Natural Gas Fund', 'energy', 12.45, 12.42, 12.48, -0.28, 'share'),
        ]
      },
      {
        id: 'agriculture',
        name: 'Agriculture',
        icon: '🌾',
        color: '#3fb950',
        commodities: [
          this.createCommodity('ZC', 'Corn', 'agriculture', 458.25, 458.00, 458.50, -2.75, 'bushel'),
          this.createCommodity('ZW', 'Wheat', 'agriculture', 612.50, 612.25, 612.75, 4.25, 'bushel'),
          this.createCommodity('ZS', 'Soybeans', 'agriculture', 1185.75, 1185.50, 1186.00, 8.50, 'bushel'),
          this.createCommodity('KC', 'Coffee', 'agriculture', 185.40, 185.30, 185.50, 2.85, 'lb'),
          this.createCommodity('SB', 'Sugar', 'agriculture', 21.85, 21.82, 21.88, -0.32, 'lb'),
          this.createCommodity('CC', 'Cocoa', 'agriculture', 5245.00, 5240.00, 5250.00, 125.00, 'metric ton'),
          this.createCommodity('CT', 'Cotton', 'agriculture', 82.45, 82.40, 82.50, 0.78, 'lb'),
          this.createCommodity('DBA', 'Agriculture ETF', 'agriculture', 22.85, 22.82, 22.88, 0.18, 'share'),
          this.createCommodity('WEAT', 'Wheat ETF', 'agriculture', 5.68, 5.66, 5.70, 0.04, 'share'),
          this.createCommodity('CORN', 'Corn ETF', 'agriculture', 22.15, 22.12, 22.18, -0.08, 'share'),
        ]
      },
      {
        id: 'metals',
        name: 'Industrial Metals',
        icon: '🔧',
        color: '#58a6ff',
        commodities: [
          this.createCommodity('HG', 'Copper', 'metals', 3.8540, 3.8520, 3.8560, 0.0245, 'lb'),
          this.createCommodity('ALI', 'Aluminum', 'metals', 2.4250, 2.4230, 2.4270, -0.0185, 'lb'),
          this.createCommodity('CPER', 'Copper ETF', 'metals', 22.45, 22.42, 22.48, 0.32, 'share'),
          this.createCommodity('JJC', 'Copper ETN', 'metals', 18.90, 18.87, 18.93, 0.25, 'share'),
        ]
      },
      {
        id: 'livestock',
        name: 'Livestock',
        icon: '🐄',
        color: '#db61a2',
        commodities: [
          this.createCommodity('LE', 'Live Cattle', 'livestock', 182.450, 182.425, 182.475, 1.125, 'lb'),
          this.createCommodity('HE', 'Lean Hogs', 'livestock', 85.625, 85.600, 85.650, -0.875, 'lb'),
          this.createCommodity('GF', 'Feeder Cattle', 'livestock', 252.875, 252.850, 252.900, 2.250, 'lb'),
          this.createCommodity('COW', 'Livestock ETN', 'livestock', 28.45, 28.42, 28.48, 0.18, 'share'),
        ]
      }
    ];
  }

  private createCommodity(symbol: string, name: string, category: string, price: number, bid: number, ask: number, change: number, unit: string): CommodityQuote {
    const changePercent = (change / (price - change)) * 100;
    return {
      symbol,
      name,
      category,
      price,
      bid,
      ask,
      change,
      changePercent,
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      volume: Math.floor(Math.random() * 500000) + 50000,
      openInterest: Math.floor(Math.random() * 200000) + 20000,
      lastUpdate: new Date(),
      unit
    };
  }

  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.categories.forEach(cat => {
        cat.commodities.forEach(commodity => {
          const priceChange = (Math.random() - 0.5) * 0.002 * commodity.price;
          commodity.price = Math.max(0.01, commodity.price + priceChange);
          commodity.bid = commodity.price * 0.9998;
          commodity.ask = commodity.price * 1.0002;
          commodity.change += priceChange * 0.1;
          commodity.changePercent = (commodity.change / (commodity.price - commodity.change)) * 100;
          
          if (commodity.price > commodity.high) commodity.high = commodity.price;
          if (commodity.price < commodity.low) commodity.low = commodity.price;
          
          commodity.volume += Math.floor(Math.random() * 100);
          commodity.lastUpdate = new Date();
        });
      });
      
      this.calculateMarketSummary();
      
      if (this.selectedCommodity) {
        this.tradeForm.price = this.selectedCommodity.price;
      }
    }, 1500);
  }

  private calculateMarketSummary(): void {
    const allCommodities = this.getAllCommodities();
    this.marketSummary = {
      totalVolume: allCommodities.reduce((sum, c) => sum + c.volume, 0),
      gainers: allCommodities.filter(c => c.change > 0).length,
      losers: allCommodities.filter(c => c.change < 0).length,
      unchanged: allCommodities.filter(c => c.change === 0).length,
      mostActive: allCommodities.reduce((max, c) => c.volume > (max?.volume || 0) ? c : max, null as CommodityQuote | null)
    };
  }

  getAllCommodities(): CommodityQuote[] {
    return this.categories.flatMap(cat => cat.commodities);
  }

  getFilteredCommodities(): CommodityQuote[] {
    let commodities = this.selectedCategory === 'all' 
      ? this.getAllCommodities()
      : this.categories.find(c => c.id === this.selectedCategory)?.commodities || [];
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      commodities = commodities.filter(c => 
        c.symbol.toLowerCase().includes(query) || 
        c.name.toLowerCase().includes(query)
      );
    }
    
    return this.sortCommodities(commodities);
  }

  private sortCommodities(commodities: CommodityQuote[]): CommodityQuote[] {
    return [...commodities].sort((a, b) => {
      let comparison = 0;
      switch (this.sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'change':
          comparison = a.changePercent - b.changePercent;
          break;
        case 'volume':
          comparison = a.volume - b.volume;
          break;
      }
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
  }

  selectCommodity(commodity: CommodityQuote): void {
    this.selectedCommodity = commodity;
    this.tradeForm.price = commodity.price;
    this.commoditySelect.emit({ symbol: commodity.symbol, price: commodity.price });
  }

  toggleSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
  }

  setSide(side: 'BUY' | 'SELL'): void {
    this.tradeForm.side = side;
  }

  getEstimatedTotal(): number {
    return this.tradeForm.quantity * (this.tradeForm.orderType === 'MARKET' && this.selectedCommodity 
      ? (this.tradeForm.side === 'BUY' ? this.selectedCommodity.ask : this.selectedCommodity.bid)
      : this.tradeForm.price);
  }

  submitTrade(): void {
    if (!this.selectedCommodity) {
      return;
    }

    if (this.tradeSubmitting) {
      return;
    }

    this.tradeSuccess = null;
    this.tradeError = null;

    const executionPrice = this.tradeForm.orderType === 'MARKET'
      ? (this.tradeForm.side === 'BUY' ? this.selectedCommodity.ask : this.selectedCommodity.bid)
      : this.tradeForm.price;

    const payload = {
      clOrdId: `CMDTY-${Date.now()}`,
      symbol: this.selectedCommodity.symbol,
      side: this.tradeForm.side === 'BUY' ? '1' : '2',
      quantity: Math.max(1, Math.floor(this.tradeForm.quantity)),
      price: executionPrice,
      orderType: this.tradeForm.orderType,
      timeInForce: 'DAY',
      status: 'NEW'
    };

    this.tradeSubmitting = true;
    this.http.post<any>('/api/orders', payload).subscribe({
      next: (result) => {
        const ref = result?.orderRefNumber || result?.clOrdId || payload.clOrdId;
        this.tradeSuccess = `Order submitted: ${ref}`;
        this.tradeForm.quantity = 1;
        this.tradeForm.price = this.selectedCommodity?.price || this.tradeForm.price;
        this.tradeSubmitting = false;
      },
      error: (err) => {
        this.tradeError = err?.error?.message || err?.error?.error || 'Failed to submit commodity order';
        this.tradeSubmitting = false;
      }
    });
  }

  formatPrice(price: number, symbol: string): string {
    if (['NG', 'HO', 'RB', 'HG', 'ALI'].includes(symbol)) {
      return price.toFixed(4);
    }
    if (['CC'].includes(symbol)) {
      return price.toFixed(0);
    }
    return price.toFixed(2);
  }

  formatVolume(volume: number): string {
    if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    }
    if (volume >= 1000) {
      return (volume / 1000).toFixed(1) + 'K';
    }
    return volume.toString();
  }

  getCategoryColor(categoryId: string): string {
    return this.categories.find(c => c.id === categoryId)?.color || '#58a6ff';
  }
}
