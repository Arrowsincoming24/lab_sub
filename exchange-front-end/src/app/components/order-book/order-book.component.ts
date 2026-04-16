// Watermark: Aarav Joshi
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subject, of } from 'rxjs';
import { takeUntil, catchError, switchMap } from 'rxjs/operators';

interface PriceLevel {
  price: number;
  totalQuantity: number;
  orderCount: number;
}

interface OrderBookResponse {
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

interface OrderBookEntry {
  price: number;
  size: number;
  orders: number;
  total: number;
  depth: number;
}

@Component({
  selector: 'app-order-book',
  template: `
    <div class="order-book-panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          <h3>Order Book</h3>
        </div>
        <div class="header-right">
          <span class="live-indicator" [class.active]="isLive">
            <span class="dot"></span>
            {{ isLive ? 'LIVE' : 'CONNECTING' }}
          </span>
          <span class="symbol-badge">{{ symbol }}</span>
        </div>
      </div>
      
      <!-- Column Headers -->
      <div class="column-headers">
        <span class="col-price">PRICE (USD)</span>
        <span class="col-size">SIZE</span>
        <span class="col-orders">ORDERS</span>
      </div>
      
      <!-- Asks Section (Sell Orders) -->
      <div class="asks-container">
        <ng-container *ngIf="asks.length > 0; else noAsks">
          <div class="order-entry ask" *ngFor="let ask of asks; let i = index; trackBy: trackByPrice">
            <div class="depth-fill ask" [style.width.%]="ask.depth"></div>
            <span class="entry-price ask">\${{ ask.price | number:'1.2-2' }}</span>
            <span class="entry-size">{{ ask.size | number:'1.0-0' }}</span>
            <span class="entry-orders">{{ ask.orders }}</span>
          </div>
        </ng-container>
        <ng-template #noAsks>
          <div class="empty-side">No sell orders</div>
        </ng-template>
      </div>
      
      <!-- Spread Bar -->
      <div class="spread-section">
        <div class="spread-info">
          <span class="spread-label">SPREAD</span>
          <span class="spread-amount">\${{ spread | number:'1.2-2' }}</span>
          <span class="spread-pct">({{ spreadPercent | number:'1.3-3' }}%)</span>
        </div>
        <div class="mid-info">
          <span class="mid-label">MID</span>
          <span class="mid-price">\${{ midPrice | number:'1.2-2' }}</span>
        </div>
      </div>
      
      <!-- Bids Section (Buy Orders) -->
      <div class="bids-container">
        <ng-container *ngIf="bids.length > 0; else noBids">
          <div class="order-entry bid" *ngFor="let bid of bids; let i = index; trackBy: trackByPrice">
            <div class="depth-fill bid" [style.width.%]="bid.depth"></div>
            <span class="entry-price bid">\${{ bid.price | number:'1.2-2' }}</span>
            <span class="entry-size">{{ bid.size | number:'1.0-0' }}</span>
            <span class="entry-orders">{{ bid.orders }}</span>
          </div>
        </ng-container>
        <ng-template #noBids>
          <div class="empty-side">No buy orders</div>
        </ng-template>
      </div>
      
      <!-- Imbalance Footer -->
      <div class="imbalance-section">
        <span class="imbalance-title">ORDER IMBALANCE</span>
        <div class="imbalance-bar">
          <div class="bar-bid" [style.width.%]="bidPercent"></div>
          <div class="bar-ask" [style.width.%]="askPercent"></div>
        </div>
        <div class="imbalance-labels">
          <span class="label-bid">{{ bidPercent | number:'1.0-0' }}% Buy</span>
          <span class="label-ask">{{ askPercent | number:'1.0-0' }}% Sell</span>
        </div>
      </div>
      
      <!-- Pagination -->
      <div class="pagination" *ngIf="totalLevels > displayLevels">
        <span class="page-info">Showing {{ displayLevels }} of {{ totalLevels }} levels</span>
        <div class="page-controls">
          <button class="page-btn" (click)="decreaseLevels()" [disabled]="displayLevels <= 5">−</button>
          <button class="page-btn" (click)="increaseLevels()" [disabled]="displayLevels >= totalLevels">+</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .order-book-panel {
      background: #0d1117;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 500px;
      overflow: hidden;
      animation: fadeIn 0.4s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: translateX(-8px);
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
    
    /* Header */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #21262d;
      transition: background 0.2s ease;
      
      &:hover {
        background: rgba(33, 38, 45, 0.5);
      }
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      
      svg {
        color: #8b949e;
        transition: all 0.3s ease;
      }
      
      &:hover svg {
        color: #58a6ff;
        transform: rotate(5deg);
      }
      
      h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #e6edf3;
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
    
    .symbol-badge {
      font-size: 10px;
      font-weight: 600;
      color: #58a6ff;
      background: rgba(88, 166, 255, 0.1);
      padding: 3px 8px;
      border-radius: 4px;
    }
    
    /* Column Headers */
    .column-headers {
      display: grid;
      grid-template-columns: 1fr 1fr 60px;
      padding: 8px 14px;
      font-size: 10px;
      font-weight: 600;
      color: #6e7681;
      letter-spacing: 0.3px;
      border-bottom: 1px solid #21262d;
    }
    
    .col-price { text-align: left; }
    .col-size { text-align: right; }
    .col-orders { text-align: right; }
    
    /* Order Containers */
    .asks-container, .bids-container {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    
    .asks-container {
      display: flex;
      flex-direction: column-reverse;
    }
    
    /* Order Entry */
    .order-entry {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr 60px;
      padding: 5px 14px;
      font-size: 12px;
      font-family: 'SF Mono', 'Consolas', monospace;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideIn 0.3s ease-out backwards;
      
      &:nth-child(1) { animation-delay: 0.02s; }
      &:nth-child(2) { animation-delay: 0.04s; }
      &:nth-child(3) { animation-delay: 0.06s; }
      &:nth-child(4) { animation-delay: 0.08s; }
      &:nth-child(5) { animation-delay: 0.1s; }
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        transform: translateX(3px);
        
        .depth-fill {
          opacity: 0.2;
        }
        
        .entry-price {
          transform: scale(1.02);
        }
      }
    }
    
    .depth-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      opacity: 0.12;
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      
      &.bid { 
        background: linear-gradient(90deg, #3fb950, transparent);
      }
      &.ask { 
        background: linear-gradient(90deg, #f85149, transparent);
      }
    }
    
    .entry-price {
      position: relative;
      font-weight: 600;
      transition: all 0.2s ease;
      
      &.bid { color: #3fb950; }
      &.ask { color: #f85149; }
    }
    
    .entry-size {
      position: relative;
      text-align: right;
      color: #e6edf3;
      transition: color 0.2s ease;
    }
    
    .entry-orders {
      position: relative;
      text-align: right;
      color: #8b949e;
      font-size: 11px;
    }
    
    .empty-side {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 60px;
      font-size: 12px;
      color: #6e7681;
      font-style: italic;
    }
    
    /* Spread Section */
    .spread-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: linear-gradient(180deg, #161b22 0%, #0d1117 100%);
      border-top: 1px solid #21262d;
      border-bottom: 1px solid #21262d;
      transition: all 0.3s ease;
      
      &:hover {
        background: linear-gradient(180deg, #1c2128 0%, #161b22 100%);
      }
    }
    
    .spread-info, .mid-info {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .spread-label, .mid-label {
      font-size: 9px;
      font-weight: 600;
      color: #6e7681;
      letter-spacing: 0.3px;
    }
    
    .spread-amount {
      font-size: 12px;
      font-weight: 600;
      color: #58a6ff;
      font-family: 'SF Mono', 'Consolas', monospace;
      transition: all 0.3s ease;
      
      &:hover {
        color: #79b8ff;
        text-shadow: 0 0 8px rgba(88, 166, 255, 0.5);
      }
    }
    
    .spread-pct {
      font-size: 10px;
      color: #6e7681;
    }
    
    .mid-price {
      font-size: 12px;
      font-weight: 600;
      color: #e6edf3;
      font-family: 'SF Mono', 'Consolas', monospace;
      transition: all 0.3s ease;
      
      &:hover {
        color: #ffffff;
      }
    }
    
    /* Imbalance Section */
    .imbalance-section {
      padding: 10px 14px;
      background: #0d1117;
      margin-top: auto;
    }
    
    .imbalance-title {
      display: block;
      font-size: 9px;
      font-weight: 600;
      color: #6e7681;
      letter-spacing: 0.3px;
      margin-bottom: 6px;
    }
    
    .imbalance-bar {
      display: flex;
      height: 5px;
      border-radius: 3px;
      overflow: hidden;
      background: #21262d;
      margin-bottom: 6px;
    }
    
    .bar-bid {
      background: #3fb950;
      transition: width 0.3s ease;
    }
    
    .bar-ask {
      background: #f85149;
      transition: width 0.3s ease;
    }
    
    .imbalance-labels {
      display: flex;
      justify-content: space-between;
    }
    
    .label-bid {
      font-size: 10px;
      font-weight: 500;
      color: #3fb950;
    }
    
    .label-ask {
      font-size: 10px;
      font-weight: 500;
      color: #f85149;
    }
    
    /* Pagination */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      border-top: 1px solid #21262d;
      background: #0d1117;
    }
    
    .page-info {
      font-size: 10px;
      color: #6e7681;
    }
    
    .page-controls {
      display: flex;
      gap: 6px;
    }
    
    .page-btn {
      width: 24px;
      height: 24px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #e6edf3;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:hover:not(:disabled) {
        background: #30363d;
        border-color: #58a6ff;
        color: #58a6ff;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }
      
      &:active:not(:disabled) {
        transform: translateY(0);
      }
      
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 4px;
    }
    
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #30363d;
      border-radius: 2px;
      
      &:hover {
        background: #484f58;
      }
    }
  `]
})
export class OrderBookComponent implements OnInit, OnDestroy {
  @Input() symbol = 'AAPL';
  
  private readonly destroy$ = new Subject<void>();
  
  asks: OrderBookEntry[] = [];
  bids: OrderBookEntry[] = [];
  spread = 0;
  spreadPercent = 0;
  midPrice = 0;
  bidPercent = 50;
  askPercent = 50;
  isLive = false;
  displayLevels = 15;
  totalLevels = 0;
  
  private allAsks: OrderBookEntry[] = [];
  private allBids: OrderBookEntry[] = [];

  constructor(private readonly http: HttpClient) {}
  
  ngOnInit(): void {
    this.fetchOrderBook();
    
    // Poll every 800ms for live updates
    interval(800).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.getOrderBook())
    ).subscribe({
      next: (data) => this.processOrderBook(data),
      error: () => this.isLive = false
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  fetchOrderBook(): void {
    this.getOrderBook().subscribe({
      next: (data) => this.processOrderBook(data),
      error: () => this.isLive = false
    });
  }
  
  private getOrderBook() {
    return this.http.get<OrderBookResponse>(`/api/orderbook/${this.symbol}?depth=30`).pipe(
      catchError(() => of(null))
    );
  }
  
  processOrderBook(data: OrderBookResponse | null): void {
    if (!data) {
      this.isLive = false;
      return;
    }
    
    this.isLive = true;
    
    // Process asks
    let askTotal = 0;
    this.allAsks = (data.asks || []).map(level => {
      askTotal += level.totalQuantity;
      return {
        price: level.price,
        size: level.totalQuantity,
        orders: level.orderCount,
        total: askTotal,
        depth: 0
      };
    });
    
    // Process bids
    let bidTotal = 0;
    this.allBids = (data.bids || []).map(level => {
      bidTotal += level.totalQuantity;
      return {
        price: level.price,
        size: level.totalQuantity,
        orders: level.orderCount,
        total: bidTotal,
        depth: 0
      };
    });
    
    // Calculate depths
    const maxTotal = Math.max(askTotal, bidTotal, 1);
    this.allAsks.forEach(a => a.depth = (a.total / maxTotal) * 100);
    this.allBids.forEach(b => b.depth = (b.total / maxTotal) * 100);
    
    // Store total levels for pagination
    this.totalLevels = Math.max(this.allAsks.length, this.allBids.length);
    
    // Apply pagination
    this.asks = this.allAsks.slice(0, this.displayLevels).sort((a, b) => b.price - a.price);
    this.bids = this.allBids.slice(0, this.displayLevels);
    
    // Calculate spread metrics
    if (this.allAsks.length > 0 && this.allBids.length > 0) {
      const bestAsk = Math.min(...this.allAsks.map(a => a.price));
      const bestBid = Math.max(...this.allBids.map(b => b.price));
      this.spread = bestAsk - bestBid;
      this.midPrice = (bestAsk + bestBid) / 2;
      this.spreadPercent = this.midPrice > 0 ? (this.spread / this.midPrice) * 100 : 0;
    } else {
      this.spread = 0;
      this.midPrice = 0;
      this.spreadPercent = 0;
    }
    
    // Calculate imbalance
    const totalBidSize = this.allBids.reduce((sum, b) => sum + b.size, 0);
    const totalAskSize = this.allAsks.reduce((sum, a) => sum + a.size, 0);
    const totalSize = totalBidSize + totalAskSize;
    if (totalSize > 0) {
      this.bidPercent = (totalBidSize / totalSize) * 100;
      this.askPercent = (totalAskSize / totalSize) * 100;
    } else {
      this.bidPercent = 50;
      this.askPercent = 50;
    }
  }
  
  trackByPrice(_index: number, entry: OrderBookEntry): number {
    return entry.price;
  }
  
  increaseLevels(): void {
    if (this.displayLevels < this.totalLevels) {
      this.displayLevels = Math.min(this.displayLevels + 5, this.totalLevels);
      this.asks = this.allAsks.slice(0, this.displayLevels).sort((a, b) => b.price - a.price);
      this.bids = this.allBids.slice(0, this.displayLevels);
    }
  }
  
  decreaseLevels(): void {
    if (this.displayLevels > 5) {
      this.displayLevels = Math.max(this.displayLevels - 5, 5);
      this.asks = this.allAsks.slice(0, this.displayLevels).sort((a, b) => b.price - a.price);
      this.bids = this.allBids.slice(0, this.displayLevels);
    }
  }
}
