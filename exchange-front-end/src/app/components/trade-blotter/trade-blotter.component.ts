// Watermark: Aarav Joshi
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subject, of } from 'rxjs';
import { takeUntil, catchError, switchMap } from 'rxjs/operators';

interface TradeResponse {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  aggressorSide: string;
  buyClientId: string;
  sellClientId: string;
  tradeStatus: string;
  createdAt: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  time: Date;
}

@Component({
  selector: 'app-trade-blotter',
  template: `
    <div class="blotter-container">
      <div class="blotter-header">
        <h3>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Recent Trades
        </h3>
        <div class="header-right">
          <span class="live-indicator" [class.active]="isLive">
            <span class="dot"></span>
            {{ isLive ? 'LIVE' : 'CONNECTING' }}
          </span>
        </div>
      </div>
      
      <div class="trade-stats">
        <div class="stat buy">
          <span class="stat-label">BUY</span>
          <span class="stat-value">{{ buyVolume | number:'1.0-0' }}</span>
        </div>
        <div class="stat sell">
          <span class="stat-label">SELL</span>
          <span class="stat-value">{{ sellVolume | number:'1.0-0' }}</span>
        </div>
        <div class="stat total">
          <span class="stat-label">TOTAL</span>
          <span class="stat-value">{{ totalVolume | number:'1.0-0' }}</span>
        </div>
      </div>
      
      <div class="blotter-columns">
        <span class="col-price">PRICE</span>
        <span class="col-size">SIZE</span>
        <span class="col-time">TIME</span>
      </div>
      
      <div class="trades-list">
        <ng-container *ngIf="trades.length > 0; else noTrades">
          <div class="trade-row" *ngFor="let trade of trades; trackBy: trackByTradeId"
               [class.buy]="trade.side === 'buy'"
               [class.sell]="trade.side === 'sell'"
               [class.large]="isLargeTrade(trade)">
            <span class="trade-price" [class.buy]="trade.side === 'buy'" [class.sell]="trade.side === 'sell'">
              \${{ trade.price | number:'1.2-2' }}
              <svg *ngIf="trade.side === 'buy'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12,2 22,22 2,22"/>
              </svg>
              <svg *ngIf="trade.side === 'sell'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(180deg)">
                <polygon points="12,2 22,22 2,22"/>
              </svg>
            </span>
            <span class="trade-size">{{ trade.size | number:'1.0-0' }}</span>
            <span class="trade-time">{{ formatTime(trade.time) }}</span>
          </div>
        </ng-container>
        <ng-template #noTrades>
          <div class="no-trades">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>No trades yet</span>
            <span class="hint">Place orders to see executed trades</span>
          </div>
        </ng-template>
      </div>
      
      <div class="blotter-footer">
        <div class="vwap">
          <span class="vwap-label">VWAP</span>
          <span class="vwap-value">\${{ vwap | number:'1.2-2' }}</span>
        </div>
        <div class="trade-count">
          <span class="count-label">TRADES</span>
          <span class="count-value">{{ trades.length }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .blotter-container {
      background: #0d1117;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100%;
      animation: fadeIn 0.4s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideInRight {
      from { 
        opacity: 0;
        transform: translateX(8px);
      }
      to { 
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.1); }
    }
    
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 4px rgba(63, 185, 80, 0.4); }
      50% { box-shadow: 0 0 12px rgba(63, 185, 80, 0.8); }
    }
    
    @keyframes flashIn {
      0% { background: rgba(88, 166, 255, 0.2); }
      100% { background: transparent; }
    }
    
    .blotter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #21262d;
      transition: background 0.2s ease;
      
      &:hover {
        background: rgba(33, 38, 45, 0.5);
      }
      
      h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #e6edf3;
        display: flex;
        align-items: center;
        gap: 8px;
        
        svg { 
          color: #f0883e;
          transition: transform 0.3s ease;
        }
        
        &:hover svg {
          transform: scale(1.15);
        }
      }
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 600;
      color: #6e7681;
      letter-spacing: 0.3px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(110, 118, 129, 0.1);
      transition: all 0.3s ease;
      
      &.active {
        color: #3fb950;
        background: rgba(63, 185, 80, 0.1);
        animation: glow 2s infinite;
      }
      
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6e7681;
        transition: all 0.3s ease;
      }
      
      &.active .dot {
        background: #3fb950;
        animation: pulse 2s infinite;
      }
    }
    
    .trade-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1px;
      background: #21262d;
      padding: 1px;
    }
    
    .stat {
      background: #161b22;
      padding: 8px 12px;
      text-align: center;
      transition: all 0.2s ease;
      
      &:hover {
        background: #1c2128;
      }
      
      .stat-label {
        display: block;
        font-size: 9px;
        font-weight: 600;
        color: #6e7681;
        letter-spacing: 0.3px;
        margin-bottom: 2px;
      }
      
      .stat-value {
        font-size: 12px;
        font-weight: 600;
        font-family: 'SF Mono', monospace;
        color: #e6edf3;
        transition: all 0.2s ease;
      }
      
      &.buy .stat-value { color: #3fb950; }
      &.sell .stat-value { color: #f85149; }
      &.total .stat-value { color: #58a6ff; }
      
      &.buy:hover .stat-value { text-shadow: 0 0 8px rgba(63, 185, 80, 0.5); }
      &.sell:hover .stat-value { text-shadow: 0 0 8px rgba(248, 81, 73, 0.5); }
      &.total:hover .stat-value { text-shadow: 0 0 8px rgba(88, 166, 255, 0.5); }
    }
    
    .blotter-columns {
      display: grid;
      grid-template-columns: 1fr 1fr 70px;
      padding: 8px 14px;
      border-bottom: 1px solid #21262d;
      
      span {
        font-size: 10px;
        font-weight: 600;
        color: #6e7681;
        letter-spacing: 0.3px;
      }
      
      .col-price { text-align: left; }
      .col-size { text-align: right; }
      .col-time { text-align: right; }
    }
    
    .trades-list {
      flex: 1;
      overflow-y: auto;
      min-height: 200px;
      max-height: 300px;
    }
    
    .trade-row {
      display: grid;
      grid-template-columns: 1fr 1fr 70px;
      padding: 6px 14px;
      font-family: 'SF Mono', monospace;
      font-size: 12px;
      border-bottom: 1px solid #161b22;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideInRight 0.3s ease-out backwards;
      
      &:nth-child(1) { animation-delay: 0.02s; }
      &:nth-child(2) { animation-delay: 0.04s; }
      &:nth-child(3) { animation-delay: 0.06s; }
      &:nth-child(4) { animation-delay: 0.08s; }
      &:nth-child(5) { animation-delay: 0.1s; }
      
      &:hover {
        background: rgba(255, 255, 255, 0.04);
        transform: translateX(3px);
      }
      
      &.large {
        background: rgba(240, 136, 62, 0.05);
        border-left: 2px solid #f0883e;
      }
      
      &.buy:hover {
        background: rgba(63, 185, 80, 0.05);
      }
      
      &.sell:hover {
        background: rgba(248, 81, 73, 0.05);
      }
    }
    
    .trade-price {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      transition: all 0.2s ease;
      
      &.buy { color: #3fb950; }
      &.sell { color: #f85149; }
      
      svg {
        transition: transform 0.2s ease;
      }
    }
    
    .trade-row:hover .trade-price svg {
      transform: scale(1.2);
    }
    
    .trade-size {
      text-align: right;
      color: #e6edf3;
      transition: color 0.2s ease;
    }
    
    .trade-time {
      text-align: right;
      font-size: 11px;
      color: #6e7681;
    }
    
    .no-trades {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #6e7681;
      
      svg {
        margin-bottom: 12px;
        opacity: 0.5;
      }
      
      span {
        font-size: 13px;
        font-weight: 500;
      }
      
      .hint {
        font-size: 11px;
        color: #484f58;
        margin-top: 4px;
      }
    }
    
    .blotter-footer {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      border-top: 1px solid #21262d;
      background: #0d1117;
    }
    
    .vwap, .trade-count {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .vwap-label, .count-label {
      font-size: 9px;
      font-weight: 600;
      color: #6e7681;
      letter-spacing: 0.3px;
    }
    
    .vwap-value {
      font-size: 13px;
      font-weight: 600;
      color: #f0883e;
      font-family: 'SF Mono', monospace;
    }
    
    .count-value {
      font-size: 13px;
      font-weight: 600;
      color: #58a6ff;
      font-family: 'SF Mono', monospace;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  `]
})
export class TradeBlotterComponent implements OnInit, OnDestroy {
  @Input() symbol = 'AAPL';
  
  private readonly destroy$ = new Subject<void>();
  
  trades: Trade[] = [];
  buyVolume = 0;
  sellVolume = 0;
  totalVolume = 0;
  vwap = 0;
  isLive = false;
  
  private readonly processedTradeIds = new Set<string>();

  constructor(private readonly http: HttpClient) {}
  
  ngOnInit(): void {
    this.fetchTrades();
    
    // Poll every 1.5 seconds for new trades
    interval(1500).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.getTrades())
    ).subscribe({
      next: (data) => this.processTrades(data),
      error: () => this.isLive = false
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  fetchTrades(): void {
    this.getTrades().subscribe({
      next: (data) => this.processTrades(data),
      error: () => this.isLive = false
    });
  }
  
  private getTrades() {
    return this.http.get<TradeResponse[]>(`/api/trades?limit=50`).pipe(
      catchError(() => of([]))
    );
  }
  
  processTrades(data: TradeResponse[]): void {
    if (!data) {
      this.isLive = false;
      return;
    }
    
    this.isLive = true;
    
    // Filter by symbol if specified
    const filteredTrades = this.symbol ? 
      data.filter(t => t.symbol === this.symbol) : data;
    
    // Convert to our Trade interface
    const newTrades: Trade[] = [];
    
    for (const trade of filteredTrades) {
      if (!this.processedTradeIds.has(trade.tradeId)) {
        this.processedTradeIds.add(trade.tradeId);
        
        // Determine side based on aggressorSide
        const side: 'buy' | 'sell' = 
          trade.aggressorSide === 'BUY' || trade.aggressorSide === '1' ? 'buy' : 'sell';
        
        newTrades.push({
          id: trade.tradeId,
          symbol: trade.symbol,
          side,
          price: trade.price,
          size: trade.quantity,
          time: new Date(trade.createdAt)
        });
      }
    }
    
    // Add new trades at the beginning
    if (newTrades.length > 0) {
      this.trades = [...newTrades, ...this.trades].slice(0, 50);
    }
    
    // If no trades yet, show all from API response
    if (this.trades.length === 0 && filteredTrades.length > 0) {
      this.trades = filteredTrades.map(trade => {
        const side: 'buy' | 'sell' = trade.aggressorSide === 'BUY' || trade.aggressorSide === '1' ? 'buy' : 'sell';
        return {
          id: trade.tradeId,
          symbol: trade.symbol,
          side,
          price: trade.price,
          size: trade.quantity,
          time: new Date(trade.createdAt)
        };
      }).slice(0, 50);
      
      // Mark all as processed
      this.trades.forEach(t => this.processedTradeIds.add(t.id));
    }
    
    this.calculateStats();
  }
  
  private calculateStats(): void {
    this.buyVolume = this.trades
      .filter(t => t.side === 'buy')
      .reduce((sum, t) => sum + t.size, 0);
    
    this.sellVolume = this.trades
      .filter(t => t.side === 'sell')
      .reduce((sum, t) => sum + t.size, 0);
    
    this.totalVolume = this.buyVolume + this.sellVolume;
    
    // Calculate VWAP
    const volumeWeightedSum = this.trades.reduce(
      (sum, t) => sum + t.price * t.size, 0
    );
    this.vwap = this.totalVolume > 0 ? volumeWeightedSum / this.totalVolume : 0;
  }
  
  isLargeTrade(trade: Trade): boolean {
    return trade.size > 300;
  }
  
  formatTime(time: Date): string {
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  trackByTradeId(_index: number, trade: Trade): string {
    return trade.id;
  }
}
