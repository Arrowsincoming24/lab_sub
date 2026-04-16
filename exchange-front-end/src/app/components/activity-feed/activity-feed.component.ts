// Watermark: Aarav Joshi
import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

interface ActivityItem {
  id: string;
  type: 'order' | 'fill' | 'cancel' | 'system' | 'price';
  message: string;
  symbol?: string;
  details?: string;
  timestamp: Date;
  severity: 'info' | 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-activity-feed',
  template: `
    <div class="activity-container">
      <div class="activity-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Live Activity
          <span class="live-dot"></span>
        </h3>
        <div class="activity-filters">
          <button [class.active]="filter === 'all'" (click)="setFilter('all')">All</button>
          <button [class.active]="filter === 'orders'" (click)="setFilter('orders')">Orders</button>
          <button [class.active]="filter === 'system'" (click)="setFilter('system')">System</button>
        </div>
      </div>
      
      <div class="activity-list">
        <div class="activity-item" 
             *ngFor="let item of filteredActivities"
             [class]="'severity-' + item.severity"
             [@fadeSlide]>
          <div class="activity-icon">
            <ng-container [ngSwitch]="item.type">
              <svg *ngSwitchCase="'order'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <svg *ngSwitchCase="'fill'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <svg *ngSwitchCase="'cancel'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <svg *ngSwitchCase="'system'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <svg *ngSwitchDefault width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </ng-container>
          </div>
          <div class="activity-content">
            <div class="activity-message">
              <span class="symbol-tag" *ngIf="item.symbol">{{ item.symbol }}</span>
              {{ item.message }}
            </div>
            <div class="activity-details" *ngIf="item.details">{{ item.details }}</div>
          </div>
          <div class="activity-time">{{ formatTime(item.timestamp) }}</div>
        </div>
      </div>
      
      <div class="activity-footer">
        <span class="event-count">{{ activities.length }} events</span>
        <button class="btn-clear" (click)="clearActivities()">Clear</button>
      </div>
    </div>
  `,
  styles: [`
    .activity-container {
      background: #0d1117;
      border-radius: 12px;
      border: 1px solid #21262d;
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
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 4px rgba(63, 185, 80, 0.4); }
      50% { opacity: 0.6; transform: scale(1.15); box-shadow: 0 0 12px rgba(63, 185, 80, 0.8); }
    }
    
    @keyframes shimmer {
      0% { background-position: -100% 0; }
      100% { background-position: 100% 0; }
    }
    
    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #21262d;
      transition: background 0.2s ease;
      
      &:hover {
        background: rgba(33, 38, 45, 0.5);
      }
      
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #e6edf3;
        display: flex;
        align-items: center;
        gap: 10px;
        
        svg { 
          color: #f0883e;
          transition: transform 0.3s ease;
        }
        
        &:hover svg {
          transform: rotate(10deg) scale(1.1);
        }
      }
    }
    
    .live-dot {
      width: 8px;
      height: 8px;
      background: #3fb950;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    .activity-filters {
      display: flex;
      gap: 4px;
      background: #161b22;
      padding: 4px;
      border-radius: 8px;
      
      button {
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: #8b949e;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        
        &:hover { 
          color: #e6edf3;
          background: rgba(255, 255, 255, 0.05);
        }
        
        &.active { 
          background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);
        }
      }
    }
    
    .activity-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    
    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 20px;
      border-left: 3px solid transparent;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      animation: slideIn 0.3s ease-out backwards;
      
      &:nth-child(1) { animation-delay: 0.02s; }
      &:nth-child(2) { animation-delay: 0.04s; }
      &:nth-child(3) { animation-delay: 0.06s; }
      
      &:hover { 
        background: rgba(88, 166, 255, 0.05);
        transform: translateX(4px);
        
        .activity-icon {
          transform: scale(1.1);
        }
      }
      
      &.severity-info { 
        border-color: #58a6ff; 
        .activity-icon { 
          color: #58a6ff;
          background: rgba(88, 166, 255, 0.1);
        } 
      }
      &.severity-success { 
        border-color: #3fb950; 
        .activity-icon { 
          color: #3fb950;
          background: rgba(63, 185, 80, 0.1);
        } 
      }
      &.severity-warning { 
        border-color: #f0883e; 
        .activity-icon { 
          color: #f0883e;
          background: rgba(240, 136, 62, 0.1);
        } 
      }
      &.severity-error { 
        border-color: #f85149; 
        .activity-icon { 
          color: #f85149;
          background: rgba(248, 81, 73, 0.1);
        } 
      }
    }
    
    .activity-icon {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #161b22;
      transition: all 0.25s ease;
    }
    
    .activity-content {
      flex: 1;
      min-width: 0;
    }
    
    .activity-message {
      font-size: 13px;
      color: #e6edf3;
      line-height: 1.4;
    }
    
    .symbol-tag {
      display: inline-block;
      padding: 2px 6px;
      background: #238636;
      color: white;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-right: 6px;
    }
    
    .activity-details {
      font-size: 12px;
      color: #8b949e;
      margin-top: 4px;
    }
    
    .activity-time {
      font-size: 11px;
      color: #8b949e;
      white-space: nowrap;
    }
    
    .activity-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #161b22;
      border-top: 1px solid #21262d;
    }
    
    .event-count {
      font-size: 12px;
      color: #8b949e;
    }
    
    .btn-clear {
      padding: 6px 12px;
      border: 1px solid #30363d;
      background: transparent;
      color: #8b949e;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:hover {
        border-color: #f85149;
        color: #f85149;
        background: rgba(248, 81, 73, 0.1);
        transform: translateY(-1px);
      }
      
      &:active {
        transform: translateY(0);
      }
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { 
      background: #30363d; 
      border-radius: 3px;
      
      &:hover { background: #484f58; }
    }
  `]
})
export class ActivityFeedComponent implements OnInit, OnDestroy, OnChanges {
  @Input() orders: any[] = [];
  
  activities: ActivityItem[] = [];
  filteredActivities: ActivityItem[] = [];
  filter: 'all' | 'orders' | 'system' = 'all';
  
  private readonly destroy$ = new Subject<void>();
  private activityCounter = 0;
  private readonly processedOrderIds = new Set<string>();
  
  constructor(private readonly http: HttpClient) {}
  
  ngOnInit(): void {
    // Generate initial system activities
    this.addSystemActivity('FIX Session initialized', 'Exchange ready to accept orders', 'success');
    this.addSystemActivity('Market data feed connected', 'Real-time quotes streaming', 'info');
    
    // Poll for real orders from backend
    this.fetchOrders();
    interval(3000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.fetchOrders());
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']?.currentValue) {
      this.processOrders(changes['orders'].currentValue);
    }
  }
  
  private fetchOrders(): void {
    this.http.get<any[]>('/api/orders').subscribe({
      next: (orders) => this.processOrders(orders),
      error: (err) => console.error('Failed to fetch orders:', err)
    });
  }
  
  private processOrders(orders: any[]): void {
    if (!orders || !Array.isArray(orders)) return;
    
    orders.forEach(order => {
      const orderId = order.clOrdId || order.orderRefNumber;
      const orderKey = `${orderId}-${order.status}`;
      
      if (!this.processedOrderIds.has(orderKey)) {
        this.processedOrderIds.add(orderKey);
        this.addOrderActivity(order);
      }
    });
  }
  
  private addOrderActivity(order: any): void {
    const symbol = order.symbol;
    const qty = order.quantity || order.filledQty || 0;
    const price = order.price ? order.price.toFixed(2) : '0.00';
    const side = order.side === '1' || order.side?.toUpperCase() === 'BUY' ? 'Buy' : 'Sell';
    const status = order.status?.toUpperCase() || 'NEW';
    
    switch (status) {
      case 'NEW':
        this.addActivity({
          type: 'order',
          message: `New ${side} order received`,
          symbol,
          details: `${qty} shares @ $${price}`,
          severity: 'info'
        });
        break;
      case 'FILLED':
        this.addActivity({
          type: 'fill',
          message: `Order filled`,
          symbol,
          details: `${order.filledQty || qty} shares executed @ $${order.avgPrice?.toFixed(2) || price}`,
          severity: 'success'
        });
        break;
      case 'PARTIALLY_FILLED':
        this.addActivity({
          type: 'fill',
          message: `Order partially filled`,
          symbol,
          details: `${order.filledQty || 0} of ${qty} shares filled @ $${order.avgPrice?.toFixed(2) || price}`,
          severity: 'success'
        });
        break;
      case 'CANCELED':
      case 'CANCELLED':
        this.addActivity({
          type: 'cancel',
          message: `Order cancelled`,
          symbol,
          details: `${qty} shares @ $${price}`,
          severity: 'warning'
        });
        break;
      case 'REJECTED':
        this.addActivity({
          type: 'cancel',
          message: `Order rejected`,
          symbol,
          details: order.rejectReason || `${qty} shares @ $${price}`,
          severity: 'error'
        });
        break;
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private addActivity(config: Omit<ActivityItem, 'id' | 'timestamp'>): void {
    const activity: ActivityItem = {
      id: `ACT${++this.activityCounter}`,
      ...config,
      timestamp: new Date()
    };
    
    this.activities.unshift(activity);
    if (this.activities.length > 100) {
      this.activities.pop();
    }
    this.applyFilter();
  }
  
  private addSystemActivity(message: string, details: string, severity: 'info' | 'success' | 'warning' | 'error'): void {
    this.addActivity({
      type: 'system',
      message,
      details,
      severity
    });
  }
  
  setFilter(filter: 'all' | 'orders' | 'system'): void {
    this.filter = filter;
    this.applyFilter();
  }
  
  private applyFilter(): void {
    switch (this.filter) {
      case 'orders':
        this.filteredActivities = this.activities.filter(a => 
          ['order', 'fill', 'cancel'].includes(a.type)
        );
        break;
      case 'system':
        this.filteredActivities = this.activities.filter(a => a.type === 'system');
        break;
      default:
        this.filteredActivities = [...this.activities];
    }
  }
  
  clearActivities(): void {
    this.activities = [];
    this.filteredActivities = [];
  }
  
  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
