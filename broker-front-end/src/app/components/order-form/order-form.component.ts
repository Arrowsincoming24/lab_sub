// Watermark: Aarav Joshi
import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { LiveQuote } from '../../services/live-market.service';

export interface OrderFormData {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  stopPrice?: number;
}

@Component({
  selector: 'app-order-form',
  template: `
    <div class="order-form-container">
      <div class="form-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Place Order
        </h3>
        <div class="symbol-badge" *ngIf="symbol">
          {{ symbol }}
          <span class="live-price" [class.positive]="(quote?.changePercent || 0) >= 0" [class.negative]="(quote?.changePercent || 0) < 0">
            \${{ quote?.price | number:'1.2-2' }}
          </span>
        </div>
      </div>

      <div class="side-toggle">
        <button class="side-btn buy" [class.active]="formData.side === 'BUY'" (click)="setSide('BUY')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          Buy
        </button>
        <button class="side-btn sell" [class.active]="formData.side === 'SELL'" (click)="setSide('SELL')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          Sell
        </button>
      </div>

      <div class="form-group">
        <label>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
          Order Type
        </label>
        <div class="order-type-grid">
          <button *ngFor="let type of orderTypes" 
                  [class.active]="formData.orderType === type.value"
                  (click)="setOrderType(type.value)"
                  [title]="type.description">
            {{ type.label }}
          </button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Symbol
          </label>
          <div class="input-with-icon">
            <select
              [(ngModel)]="formData.symbol"
              (ngModelChange)="onSymbolSelect($event)"
              [class.error]="symbolError"
              class="symbol-select"
            >
              <option *ngFor="let option of symbolOptions" [value]="option">
                {{ option }}
              </option>
            </select>
            <span class="input-icon" *ngIf="symbolValid">✓</span>
          </div>
          <span class="helper-text">Scroll and select a stock symbol</span>
          <span class="error-text" *ngIf="symbolError">{{ symbolError }}</span>
        </div>
        
        <div class="form-group">
          <label>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Quantity
          </label>
          <div class="quantity-input">
            <button class="qty-btn" (click)="adjustQuantity(-10)">-10</button>
            <button class="qty-btn" (click)="adjustQuantity(-1)">-</button>
            <input type="number" [(ngModel)]="formData.quantity" min="1">
            <button class="qty-btn" (click)="adjustQuantity(1)">+</button>
            <button class="qty-btn" (click)="adjustQuantity(10)">+10</button>
          </div>
        </div>
      </div>

      <div class="form-row" *ngIf="formData.orderType !== 'MARKET'">
        <div class="form-group" *ngIf="formData.orderType === 'LIMIT' || formData.orderType === 'STOP_LIMIT'">
          <label>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Limit Price
          </label>
          <div class="price-input">
            <span class="currency">$</span>
            <input type="number" [(ngModel)]="formData.price" step="0.01" min="0.01">
            <button class="set-market" (click)="setMarketPrice()">MKT</button>
          </div>
        </div>
        
        <div class="form-group" *ngIf="formData.orderType === 'STOP' || formData.orderType === 'STOP_LIMIT'">
          <label>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Stop Price
          </label>
          <div class="price-input">
            <span class="currency">$</span>
            <input type="number" [(ngModel)]="formData.stopPrice" step="0.01" min="0.01">
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Time in Force
        </label>
        <div class="tif-grid">
          <button *ngFor="let tif of timeInForceOptions"
                  [class.active]="formData.timeInForce === tif.value"
                  (click)="setTimeInForce(tif.value)"
                  [title]="tif.description">
            {{ tif.label }}
          </button>
        </div>
      </div>

      <div class="order-summary">
        <div class="summary-header">Order Summary</div>
        <div class="summary-row">
          <span>Action</span>
          <span class="value" [class.buy]="formData.side === 'BUY'" [class.sell]="formData.side === 'SELL'">
            {{ formData.side }} {{ formData.symbol }}
          </span>
        </div>
        <div class="summary-row">
          <span>Quantity</span>
          <span class="value">{{ formData.quantity }} shares</span>
        </div>
        <div class="summary-row">
          <span>Order Type</span>
          <span class="value">{{ getOrderTypeLabel() }}</span>
        </div>
        <div class="summary-row" *ngIf="formData.orderType !== 'MARKET'">
          <span>Price</span>
          <span class="value">\${{ formData.price | number:'1.2-2' }}</span>
        </div>
        <div class="summary-row total">
          <span>Est. Total</span>
          <span class="value">\${{ getEstimatedTotal() | number:'1.2-2' }}</span>
        </div>
      </div>

      <button class="submit-btn" 
              [class.buy]="formData.side === 'BUY'" 
              [class.sell]="formData.side === 'SELL'"
              [disabled]="!isFormValid() || submitting"
              (click)="submitOrder()">
        <span *ngIf="!submitting">
          {{ formData.side === 'BUY' ? 'Buy' : 'Sell' }} {{ formData.symbol }}
        </span>
        <span *ngIf="submitting" class="loading">
          <svg class="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="0"/>
          </svg>
          Processing...
        </span>
      </button>
    </div>
  `,
  styles: [`
    .order-form-container {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid #f3f4f6;
    }

    .form-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-header h3 svg {
      color: #8b5cf6;
    }

    .symbol-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #374151;
    }

    .live-price {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-weight: 600;
    }

    .live-price.positive { color: #10b981; }
    .live-price.negative { color: #ef4444; }

    .side-toggle {
      display: flex;
      gap: 8px;
      padding: 4px;
      background: #f3f4f6;
      border-radius: 10px;
    }

    .side-btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
      background: transparent;
      color: #6b7280;
    }

    .side-btn.buy.active {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .side-btn.sell.active {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .form-group label svg {
      color: #9ca3af;
    }

    .form-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      align-items: end;
    }

    .order-type-grid, .tif-grid {
      display: flex;
      gap: 6px;
    }

    .order-type-grid button, .tif-grid button {
      flex: 1;
      padding: 10px 8px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }

    .order-type-grid button:hover, .tif-grid button:hover {
      border-color: #c4b5fd;
      color: #8b5cf6;
    }

    .order-type-grid button.active, .tif-grid button.active {
      background: #f3e8ff;
      border-color: #8b5cf6;
      color: #8b5cf6;
    }

    .input-with-icon {
      position: relative;
    }

    .input-with-icon input,
    .input-with-icon select {
      width: 100%;
      padding: 10px 12px;
      padding-right: 32px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s;
      background: white;
      color: #111827;
    }

    .input-with-icon input:focus,
    .input-with-icon select:focus {
      outline: none;
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }

    .input-with-icon input.error,
    .input-with-icon select.error {
      border-color: #ef4444;
    }

    .symbol-select {
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
    }

    .helper-text {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .input-icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #10b981;
      font-weight: bold;
    }

    .error-text {
      font-size: 11px;
      color: #ef4444;
    }

    .quantity-input {
      display: grid;
      grid-template-columns: auto auto minmax(80px, 1fr) auto auto;
      gap: 4px;
    }

    .quantity-input input {
      flex: 1;
      min-width: 0;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      text-align: center;
      font-weight: 600;
    }

    .quantity-input input:focus {
      outline: none;
      border-color: #8b5cf6;
    }

    .qty-btn {
      padding: 8px 9px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .qty-btn:hover {
      background: #f3f4f6;
      border-color: #8b5cf6;
      color: #8b5cf6;
    }

    .price-input {
      display: flex;
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s;
    }

    .price-input:focus-within {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }

    .price-input .currency {
      padding: 10px 12px;
      background: #f9fafb;
      border-right: 1px solid #e5e7eb;
      font-weight: 600;
      color: #6b7280;
    }

    .price-input input {
      flex: 1;
      padding: 10px 12px;
      border: none;
      font-size: 14px;
      font-weight: 600;
    }

    .price-input input:focus {
      outline: none;
    }

    .set-market {
      padding: 8px 12px;
      border: none;
      background: #f3e8ff;
      color: #8b5cf6;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }

    .set-market:hover {
      background: #8b5cf6;
      color: white;
    }

    .order-summary {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-header {
      font-size: 12px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #6b7280;
    }

    .summary-row .value {
      font-weight: 600;
      color: #374151;
    }

    .summary-row .value.buy { color: #10b981; }
    .summary-row .value.sell { color: #ef4444; }

    .summary-row.total {
      padding-top: 8px;
      margin-top: 4px;
      border-top: 1px dashed #e5e7eb;
      font-weight: 600;
    }

    .summary-row.total .value {
      font-size: 16px;
      color: #111827;
    }

    .submit-btn {
      padding: 14px 24px;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .submit-btn.buy {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .submit-btn.buy:hover:not(:disabled) {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    }

    .submit-btn.sell {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .submit-btn.sell:hover:not(:disabled) {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .spinner {
      width: 18px;
      height: 18px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .order-form-container {
        padding: 16px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .quantity-input {
        grid-template-columns: 1fr 1fr 1fr 1fr;
      }

      .quantity-input input {
        grid-column: 1 / -1;
      }
    }
  `]
})
export class OrderFormComponent implements OnInit, OnChanges {
  @Input() symbol: string = 'AAPL';
  @Input() quote: LiveQuote | null = null;
  @Input() balance: number = 100000;
  @Input() allowedSymbols: string[] = [];
  
  @Output() orderSubmit = new EventEmitter<OrderFormData>();
  
  formData: OrderFormData = {
    symbol: 'AAPL',
    side: 'BUY',
    quantity: 100,
    price: 0,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  submitting = false;
  symbolValid = false;
  symbolError: string | null = null;
  symbolOptions: string[] = [];

  private readonly defaultSymbolOptions = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX',
    'INTC', 'AMD', 'ORCL', 'CRM', 'IBM', 'JPM', 'BAC', 'V', 'MA', 'WMT',
    'DIS', 'KO', 'PEP', 'MCD', 'NKE', 'SPY', 'QQQ', 'DIA'
  ];
  
  orderTypes = [
    { value: 'MARKET', label: 'Market', description: 'Execute immediately at current market price' },
    { value: 'LIMIT', label: 'Limit', description: 'Execute at specified price or better' },
    { value: 'STOP', label: 'Stop', description: 'Trigger market order when price reaches stop' },
    { value: 'STOP_LIMIT', label: 'Stop Lmt', description: 'Trigger limit order when price reaches stop' }
  ];
  
  timeInForceOptions = [
    { value: 'DAY', label: 'Day', description: 'Valid for current trading day only' },
    { value: 'GTC', label: 'GTC', description: 'Good til cancelled' },
    { value: 'IOC', label: 'IOC', description: 'Immediate or cancel - fill immediately or cancel' },
    { value: 'FOK', label: 'FOK', description: 'Fill or kill - complete fill or cancel entire order' }
  ];

  ngOnInit(): void {
    this.syncSymbolOptions();
    this.formData.symbol = this.pickInitialSymbol();
    this.validateSymbol();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allowedSymbols']) {
      this.syncSymbolOptions();
    }

    if (changes['symbol'] && this.symbol) {
      this.formData.symbol = this.symbol;
      this.validateSymbol();
    }
    if (changes['quote'] && this.quote) {
      this.formData.price = this.quote.price;
    }
  }
  
  setSide(side: 'BUY' | 'SELL'): void {
    this.formData.side = side;
  }
  
  setOrderType(type: any): void {
    this.formData.orderType = type;
  }
  
  setTimeInForce(tif: any): void {
    this.formData.timeInForce = tif;
  }
  
  adjustQuantity(delta: number): void {
    const newQty = this.formData.quantity + delta;
    if (newQty >= 1) {
      this.formData.quantity = newQty;
    }
  }
  
  setMarketPrice(): void {
    if (this.quote) {
      this.formData.price = this.quote.price;
    }
  }
  
  onSymbolSelect(value: string): void {
    this.formData.symbol = (value || '').toUpperCase();
    this.validateSymbol();
  }

  private syncSymbolOptions(): void {
    const options = this.allowedSymbols && this.allowedSymbols.length > 0
      ? this.allowedSymbols
      : this.defaultSymbolOptions;

    this.symbolOptions = Array.from(new Set(options.map(s => (s || '').toUpperCase().trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

    if (this.symbolOptions.length === 0) {
      this.symbolOptions = ['AAPL'];
    }
  }

  private pickInitialSymbol(): string {
    const current = (this.formData.symbol || '').toUpperCase();
    if (this.symbolOptions.includes(current)) {
      return current;
    }

    const incoming = (this.symbol || '').toUpperCase();
    if (incoming && this.symbolOptions.includes(incoming)) {
      return incoming;
    }

    return this.symbolOptions[0];
  }
  
  validateSymbol(): void {
    const symbol = (this.formData.symbol || '').trim().toUpperCase();
    this.formData.symbol = symbol;

    const equityPattern = /^[A-Z][A-Z0-9.-]{0,14}$/;
    const optionPattern = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;
    const formatValid = equityPattern.test(symbol) || optionPattern.test(symbol);

    // Prefer live symbol universe provided by parent app, but do not block
    // manually entered symbols that are syntactically valid.
    if (this.symbolOptions && this.symbolOptions.length > 0) {
      this.symbolValid = this.symbolOptions.includes(symbol) || formatValid;
    } else {
      this.symbolValid = formatValid;
    }

    this.symbolError = this.symbolValid ? null : 'Invalid symbol';
  }
  
  getOrderTypeLabel(): string {
    const type = this.orderTypes.find(t => t.value === this.formData.orderType);
    return type ? type.label : this.formData.orderType;
  }
  
  getEstimatedTotal(): number {
    const price = this.formData.orderType === 'MARKET' ? (this.quote?.price || 0) : this.formData.price;
    return this.formData.quantity * price;
  }
  
  isFormValid(): boolean {
    if (!this.formData.symbol || !this.symbolValid) return false;
    if (this.formData.quantity < 1) return false;
    if (this.formData.orderType !== 'MARKET' && this.formData.price <= 0) return false;
    if ((this.formData.orderType === 'STOP' || this.formData.orderType === 'STOP_LIMIT') && (!this.formData.stopPrice || this.formData.stopPrice <= 0)) return false;
    return true;
  }
  
  submitOrder(): void {
    if (!this.isFormValid()) return;
    
    this.submitting = true;
    this.orderSubmit.emit({ ...this.formData });
    
    setTimeout(() => {
      this.submitting = false;
    }, 1000);
  }
}
