// Watermark: Aarav Joshi
import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

@Component({
  selector: 'app-position-card',
  template: `
    <div class="position-card" (click)="onSelect()">
      <div class="position-header">
        <div class="symbol-info">
          <div class="symbol-icon" [style.background]="getIconColor()">
            {{ position.symbol.charAt(0) }}
          </div>
          <div class="symbol-details">
            <span class="symbol">{{ position.symbol }}</span>
            <span class="quantity">{{ position.quantity }} shares</span>
          </div>
        </div>
        <div class="pnl" [class.positive]="position.unrealizedPnL >= 0" [class.negative]="position.unrealizedPnL < 0">
          <span class="pnl-amount">{{ position.unrealizedPnL >= 0 ? '+' : '' }}\${{ position.unrealizedPnL | number:'1.2-2' }}</span>
          <span class="pnl-percent">{{ position.unrealizedPnLPercent >= 0 ? '+' : '' }}{{ position.unrealizedPnLPercent | number:'1.2-2' }}%</span>
        </div>
      </div>
      
      <div class="position-details">
        <div class="detail-row">
          <div class="detail">
            <span class="label">Avg Cost</span>
            <span class="value">\${{ position.avgPrice | number:'1.2-2' }}</span>
          </div>
          <div class="detail">
            <span class="label">Current</span>
            <span class="value">\${{ position.currentPrice | number:'1.2-2' }}</span>
          </div>
          <div class="detail">
            <span class="label">Market Value</span>
            <span class="value highlight">\${{ position.marketValue | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>
      
      <div class="position-progress">
        <div class="progress-bar" 
             [class.positive]="position.unrealizedPnLPercent >= 0" 
             [class.negative]="position.unrealizedPnLPercent < 0"
             [style.width]="getProgressWidth() + '%'">
        </div>
      </div>
      
      <div class="position-actions">
        <button class="btn-action buy" (click)="onBuy($event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add
        </button>
        <button class="btn-action sell" (click)="onSell($event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Reduce
        </button>
        <button class="btn-action close" (click)="onClose($event)">
          Close
        </button>
      </div>
    </div>
  `,
  styles: [`
    .position-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .position-card:hover {
      border-color: #c4b5fd;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
    }
    
    .position-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    
    .symbol-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .symbol-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
      color: white;
    }
    
    .symbol-details {
      display: flex;
      flex-direction: column;
    }
    
    .symbol {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }
    
    .quantity {
      font-size: 12px;
      color: #6b7280;
    }
    
    .pnl {
      text-align: right;
    }
    
    .pnl-amount {
      display: block;
      font-size: 16px;
      font-weight: 700;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .pnl-percent {
      font-size: 12px;
      font-weight: 600;
    }
    
    .pnl.positive { color: #10b981; }
    .pnl.negative { color: #ef4444; }
    
    .position-details {
      margin-bottom: 12px;
    }
    
    .detail-row {
      display: flex;
      gap: 20px;
    }
    
    .detail {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .detail .label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .detail .value {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .detail .value.highlight {
      color: #111827;
      font-size: 14px;
    }
    
    .position-progress {
      height: 4px;
      background: #f3f4f6;
      border-radius: 2px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    
    .progress-bar.positive { background: linear-gradient(90deg, #10b981, #34d399); }
    .progress-bar.negative { background: linear-gradient(90deg, #ef4444, #f87171); }
    
    .position-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn-action {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }
    
    .btn-action:hover {
      transform: translateY(-1px);
    }
    
    .btn-action.buy {
      color: #10b981;
    }
    
    .btn-action.buy:hover {
      background: #dcfce7;
      border-color: #10b981;
    }
    
    .btn-action.sell {
      color: #f59e0b;
    }
    
    .btn-action.sell:hover {
      background: #fef3c7;
      border-color: #f59e0b;
    }
    
    .btn-action.close {
      color: #ef4444;
    }
    
    .btn-action.close:hover {
      background: #fee2e2;
      border-color: #ef4444;
    }
  `]
})
export class PositionCardComponent {
  @Input() position!: Position;
  
  @Output() select = new EventEmitter<string>();
  @Output() buy = new EventEmitter<string>();
  @Output() sell = new EventEmitter<string>();
  @Output() close = new EventEmitter<string>();
  
  getIconColor(): string {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    ];
    const index = this.position.symbol.charCodeAt(0) % colors.length;
    return colors[index];
  }
  
  getProgressWidth(): number {
    return Math.min(100, Math.abs(this.position.unrealizedPnLPercent) * 5);
  }
  
  onSelect(): void {
    this.select.emit(this.position.symbol);
  }
  
  onBuy(event: Event): void {
    event.stopPropagation();
    this.buy.emit(this.position.symbol);
  }
  
  onSell(event: Event): void {
    event.stopPropagation();
    this.sell.emit(this.position.symbol);
  }
  
  onClose(event: Event): void {
    event.stopPropagation();
    this.close.emit(this.position.symbol);
  }
}
