// Watermark: Aarav Joshi
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';

interface Commodity {
  symbol: string;
  name: string;
  category: 'energy' | 'agriculture' | 'metals' | 'precious';
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
  icon: string;
}

@Component({
  selector: 'app-broker-commodities',
  templateUrl: './broker-commodities.component.html',
  styleUrls: ['./broker-commodities.component.scss']
})
export class BrokerCommoditiesComponent implements OnInit, OnDestroy {
  @Output() commodityTrade = new EventEmitter<{symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number}>();

  commodities: Commodity[] = [];
  selectedCommodity: Commodity | null = null;
  activeCategory: 'all' | 'energy' | 'agriculture' | 'metals' | 'precious' = 'all';
  
  categories = [
    { id: 'all', name: 'All', icon: '📊' },
    { id: 'precious', name: 'Precious Metals', icon: '🥇' },
    { id: 'energy', name: 'Energy', icon: '⚡' },
    { id: 'agriculture', name: 'Agriculture', icon: '🌾' },
    { id: 'metals', name: 'Industrial Metals', icon: '🔧' }
  ];

  orderForm = {
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: 1,
    price: 0,
    orderType: 'LIMIT' as 'LIMIT' | 'MARKET'
  };

  private updateInterval: any;

  ngOnInit(): void {
    this.initializeCommodities();
    this.startRealTimeUpdates();
    if (this.commodities.length) {
      this.selectCommodity(this.commodities[0]);
    }
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private initializeCommodities(): void {
    this.commodities = [
      // Precious Metals
      { symbol: 'XAUUSD', name: 'Gold Spot', category: 'precious', price: 2045.80, bid: 2045.50, ask: 2046.10, change: 12.40, changePercent: 0.61, volume: 845000, icon: '🥇' },
      { symbol: 'XAGUSD', name: 'Silver Spot', category: 'precious', price: 23.45, bid: 23.42, ask: 23.48, change: -0.18, changePercent: -0.76, volume: 425000, icon: '🥈' },
      { symbol: 'XPTUSD', name: 'Platinum Spot', category: 'precious', price: 985.60, bid: 985.20, ask: 986.00, change: 8.25, changePercent: 0.84, volume: 125000, icon: '⚪' },
      { symbol: 'GLD', name: 'SPDR Gold Trust', category: 'precious', price: 188.45, bid: 188.40, ask: 188.50, change: 1.15, changePercent: 0.61, volume: 2850000, icon: '📊' },
      
      // Energy
      { symbol: 'CL', name: 'WTI Crude Oil', category: 'energy', price: 78.45, bid: 78.40, ask: 78.50, change: 1.25, changePercent: 1.62, volume: 1250000, icon: '🛢️' },
      { symbol: 'BZ', name: 'Brent Crude', category: 'energy', price: 82.30, bid: 82.25, ask: 82.35, change: 1.45, changePercent: 1.79, volume: 980000, icon: '🛢️' },
      { symbol: 'NG', name: 'Natural Gas', category: 'energy', price: 2.85, bid: 2.84, ask: 2.86, change: -0.08, changePercent: -2.73, volume: 850000, icon: '🔥' },
      { symbol: 'USO', name: 'US Oil Fund', category: 'energy', price: 72.15, bid: 72.10, ask: 72.20, change: 0.85, changePercent: 1.19, volume: 1850000, icon: '📊' },
      
      // Agriculture
      { symbol: 'ZC', name: 'Corn', category: 'agriculture', price: 485.50, bid: 485.25, ask: 485.75, change: 3.25, changePercent: 0.67, volume: 420000, icon: '🌽' },
      { symbol: 'ZW', name: 'Wheat', category: 'agriculture', price: 612.75, bid: 612.50, ask: 613.00, change: -5.80, changePercent: -0.94, volume: 380000, icon: '🌾' },
      { symbol: 'ZS', name: 'Soybeans', category: 'agriculture', price: 1245.00, bid: 1244.75, ask: 1245.25, change: 8.50, changePercent: 0.69, volume: 295000, icon: '🫘' },
      { symbol: 'KC', name: 'Coffee', category: 'agriculture', price: 185.40, bid: 185.20, ask: 185.60, change: 2.15, changePercent: 1.17, volume: 185000, icon: '☕' },
      
      // Industrial Metals
      { symbol: 'HG', name: 'Copper', category: 'metals', price: 3.92, bid: 3.91, ask: 3.93, change: 0.04, changePercent: 1.03, volume: 520000, icon: '🔶' },
      { symbol: 'ALI', name: 'Aluminum', category: 'metals', price: 2.28, bid: 2.27, ask: 2.29, change: -0.02, changePercent: -0.87, volume: 280000, icon: '🔷' },
      { symbol: 'CPER', name: 'Copper Index ETF', category: 'metals', price: 24.85, bid: 24.82, ask: 24.88, change: 0.25, changePercent: 1.02, volume: 145000, icon: '📊' }
    ];
  }

  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.commodities.forEach(commodity => {
        const priceChange = (Math.random() - 0.5) * 0.002 * commodity.price;
        commodity.price = Math.max(0.01, commodity.price + priceChange);
        commodity.bid = commodity.price * 0.9998;
        commodity.ask = commodity.price * 1.0002;
        commodity.change += priceChange * 0.2;
        commodity.changePercent = (commodity.change / (commodity.price - commodity.change)) * 100;
        commodity.volume += Math.floor(Math.random() * 500);
      });
      
      if (this.selectedCommodity) {
        this.orderForm.price = this.selectedCommodity.price;
      }
    }, 1500);
  }

  get filteredCommodities(): Commodity[] {
    if (this.activeCategory === 'all') return this.commodities;
    return this.commodities.filter(c => c.category === this.activeCategory);
  }

  selectCategory(categoryId: string): void {
    this.activeCategory = categoryId as any;
  }

  selectCommodity(commodity: Commodity): void {
    this.selectedCommodity = commodity;
    this.orderForm.price = commodity.price;
  }

  setSide(side: 'BUY' | 'SELL'): void {
    this.orderForm.side = side;
  }

  submitOrder(): void {
    if (!this.selectedCommodity) return;
    
    this.commodityTrade.emit({
      symbol: this.selectedCommodity.symbol,
      side: this.orderForm.side,
      quantity: this.orderForm.quantity,
      price: this.orderForm.orderType === 'MARKET' 
        ? (this.orderForm.side === 'BUY' ? this.selectedCommodity.ask : this.selectedCommodity.bid)
        : this.orderForm.price
    });
    
    console.log('Broker commodity order:', {
      symbol: this.selectedCommodity.symbol,
      side: this.orderForm.side,
      quantity: this.orderForm.quantity,
      price: this.orderForm.price,
      orderType: this.orderForm.orderType
    });
    
    this.orderForm.quantity = 1;
  }

  formatPrice(price: number): string {
    if (price >= 100) return price.toFixed(2);
    if (price >= 10) return price.toFixed(2);
    return price.toFixed(4);
  }

  formatVolume(volume: number): string {
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M';
    if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
    return volume.toString();
  }

  getEstimatedTotal(): number {
    if (!this.selectedCommodity) return 0;
    return this.orderForm.quantity * this.orderForm.price;
  }
}
