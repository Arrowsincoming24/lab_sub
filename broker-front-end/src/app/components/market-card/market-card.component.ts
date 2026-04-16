// Watermark: Aarav Joshi
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { LiveQuote } from '../../services/live-market.service';

@Component({
  selector: 'app-market-card',
  template: `
    <div class="market-card" [class.selected]="selected" (click)="onSelect()">
      <div class="card-header">
        <div class="symbol-info">
          <div class="symbol-icon" [style.background]="getIconColor()">
            {{ symbol.charAt(0) }}
          </div>
          <div class="symbol-details">
            <span class="symbol">{{ symbol }}</span>
            <span class="company-name">{{ getCompanyName() }}</span>
          </div>
        </div>
        <button class="watchlist-btn" 
                [class.active]="inWatchlist"
                (click)="onToggleWatchlist($event)">
          <svg width="16" height="16" viewBox="0 0 24 24" [attr.fill]="inWatchlist ? '#fbbf24' : 'none'" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
      
      <div class="card-body">
        <div class="price-section">
          <span class="price">\${{ quote?.price | number:'1.2-2' }}</span>
          <div class="change-badge" [class.positive]="(quote?.changePercent || 0) >= 0" [class.negative]="(quote?.changePercent || 0) < 0">
            <svg *ngIf="(quote?.changePercent || 0) >= 0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
            <svg *ngIf="(quote?.changePercent || 0) < 0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            {{ (quote?.changePercent || 0) >= 0 ? '+' : '' }}{{ quote?.changePercent | number:'1.2-2' }}%
          </div>
        </div>
        
        <div class="mini-chart">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline 
              [attr.points]="getSparklinePoints()"
              fill="none"
              [attr.stroke]="(quote?.changePercent || 0) >= 0 ? '#10b981' : '#ef4444'"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      
      <div class="card-footer">
        <div class="stat">
          <span class="label">Bid</span>
          <span class="value">\${{ quote?.bid | number:'1.2-2' }}</span>
        </div>
        <div class="stat">
          <span class="label">Ask</span>
          <span class="value">\${{ quote?.ask | number:'1.2-2' }}</span>
        </div>
        <div class="stat">
          <span class="label">Vol</span>
          <span class="value">{{ formatVolume(quote?.volume || 0) }}</span>
        </div>
      </div>
      
      <div class="card-actions" *ngIf="showActions">
        <button class="btn-buy" (click)="onBuy($event)">Buy</button>
        <button class="btn-sell" (click)="onSell($event)">Sell</button>
      </div>
    </div>
  `,
  styles: [`
    .market-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    
    .market-card:hover {
      border-color: #c4b5fd;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
      transform: translateY(-2px);
    }
    
    .market-card.selected {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    
    .symbol-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .symbol-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: white;
    }
    
    .symbol-details {
      display: flex;
      flex-direction: column;
    }
    
    .symbol {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    
    .company-name {
      font-size: 11px;
      color: #9ca3af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }
    
    .watchlist-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.2s;
    }
    
    .watchlist-btn:hover, .watchlist-btn.active {
      color: #fbbf24;
    }
    
    .card-body {
      margin-bottom: 12px;
    }
    
    .price-section {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .price {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .change-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .change-badge.positive {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .change-badge.negative {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .mini-chart {
      height: 30px;
      margin-top: 8px;
    }
    
    .mini-chart svg {
      width: 100%;
      height: 100%;
    }
    
    .card-footer {
      display: flex;
      gap: 16px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }
    
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .stat .label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .stat .value {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }
    
    .card-actions button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-buy {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    
    .btn-buy:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
    }
    
    .btn-sell {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }
    
    .btn-sell:hover {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      transform: translateY(-1px);
    }
  `]
})
export class MarketCardComponent {
  @Input() symbol: string = '';
  @Input() quote: LiveQuote | null = null;
  @Input() inWatchlist: boolean = false;
  @Input() selected: boolean = false;
  @Input() showActions: boolean = false;
  @Input() sparklineData: number[] = [];
  
  @Output() select = new EventEmitter<string>();
  @Output() toggleWatchlist = new EventEmitter<string>();
  @Output() buy = new EventEmitter<string>();
  @Output() sell = new EventEmitter<string>();
  
  private companyNames: { [key: string]: string } = {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft',
    'GOOGL': 'Alphabet',
    'AMZN': 'Amazon.com',
    'NVDA': 'NVIDIA Corp',
    'TSLA': 'Tesla Inc',
    'META': 'Meta Platforms',
    'AMD': 'AMD Inc',
    'JPM': 'JPMorgan',
    'V': 'Visa Inc',
    'JNJ': 'Johnson & Johnson',
    'WMT': 'Walmart',
    'XOM': 'Exxon Mobil',
    'DIS': 'Walt Disney',
    'NFLX': 'Netflix',
    'PYPL': 'PayPal',
    'INTC': 'Intel Corp',
    'CRM': 'Salesforce',
    'ORCL': 'Oracle',
    'ADBE': 'Adobe',
    'BAC': 'Bank of America',
    'GS': 'Goldman Sachs',
    'MA': 'Mastercard',
    'PFE': 'Pfizer',
    'UNH': 'UnitedHealth',
    'HD': 'Home Depot',
    'NKE': 'Nike Inc',
    'MCD': 'McDonald\'s',
    'SBUX': 'Starbucks',
    'COST': 'Costco',
  };
  
  getCompanyName(): string {
    return this.companyNames[this.symbol] || this.symbol;
  }
  
  getIconColor(): string {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    ];
    const index = this.symbol.charCodeAt(0) % colors.length;
    return colors[index];
  }
  
  getSparklinePoints(): string {
    if (!this.sparklineData.length) {
      // Generate random data if none provided
      const points = [];
      let value = 50;
      for (let i = 0; i < 20; i++) {
        value += (Math.random() - 0.5) * 10;
        value = Math.max(5, Math.min(95, value));
        points.push(`${(i / 19) * 100},${100 - ((value / 100) * 80 + 10)}`);
      }
      return points.join(' ');
    }
    
    const min = Math.min(...this.sparklineData);
    const max = Math.max(...this.sparklineData);
    const range = max - min || 1;
    
    return this.sparklineData.map((v, i) => {
      const x = (i / (this.sparklineData.length - 1)) * 100;
      const y = 100 - ((v - min) / range * 80 + 10);
      return `${x},${y}`;
    }).join(' ');
  }
  
  formatVolume(vol: number): string {
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(1) + 'B';
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(1) + 'K';
    return vol.toString();
  }
  
  onSelect(): void {
    this.select.emit(this.symbol);
  }
  
  onToggleWatchlist(event: Event): void {
    event.stopPropagation();
    this.toggleWatchlist.emit(this.symbol);
  }
  
  onBuy(event: Event): void {
    event.stopPropagation();
    this.buy.emit(this.symbol);
  }
  
  onSell(event: Event): void {
    event.stopPropagation();
    this.sell.emit(this.symbol);
  }
}
