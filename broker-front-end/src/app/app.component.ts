// Watermark: Aarav Joshi
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './services/order.service';
import { AuthService, User, LoginRequest, RegisterRequest } from './services/auth.service';
import { NotificationService, Toast } from './services/notification.service';
import { WatchlistService, PriceAlert } from './services/watchlist.service';
import { Order, SessionInfo } from './models/order.model';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

interface MarketData {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface SecurityInfo {
  symbol: string;
  securityType: string;
  tradeable: boolean;
}

interface ParsedOptionContract {
  symbol: string;
  underlying: string;
  expiry: string;
  optionType: 'C' | 'P';
  strike: number;
}

interface OptionChainRow {
  strike: number;
  callSymbol?: string;
  putSymbol?: string;
  callQuote?: MarketData;
  putQuote?: MarketData;
}

interface OptionHeatmapCell {
  expiry: string;
  intensity: number;
  volume: number;
  absMove: number;
  hasData: boolean;
}

interface OptionHeatmapRow {
  strike: number;
  cells: OptionHeatmapCell[];
}

interface StagedOptionOrder {
  symbol: string;
  side: '1' | '2';
  quantity: number;
  price: number;
  underlying: string;
  strike: number;
  expiry: string;
  optionType: 'CALL' | 'PUT';
  stagedAt: Date;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relatedSymbols: string[];
}

interface SectorPerformance {
  name: string;
  change: number;
  volume: number;
  leaders: string[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Broker Platform';
  orders: Order[] = [];
  sessionInfo: SessionInfo | null = null;
  loading = false;
  error: string | null = null;
  
  // Authentication
  currentUser: User | null = null;
  showLoginForm = false;
  isRegistering = false;
  loginForm = {
    username: '',
    password: '',
    email: '',
    displayName: ''
  };
  authError: string | null = null;
  
  // Market data from exchange
  marketData: MarketData[] = [];
  
  // Position tracking
  positions: Position[] = [];
  totalPortfolioValue = 0;
  totalUnrealizedPnL = 0;
  
  // Extended stock symbols - Tech, Finance, Healthcare, Energy, Consumer
  quickSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD'];
  allSymbols = [
    // Tech Giants
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD', 'INTC', 'NFLX',
    'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AVGO', 'NOW', 'SNOW',
    // Finance
    'JPM', 'BAC', 'GS', 'V', 'MA', 'WFC', 'C', 'MS', 'AXP', 'BLK',
    // Healthcare
    'JNJ', 'PFE', 'UNH', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'BMY', 'AMGN',
    // Energy
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PXD', 'MPC', 'VLO', 'PSX', 'OXY',
    // Consumer & Retail
    'WMT', 'HD', 'NKE', 'MCD', 'SBUX', 'TGT', 'COST', 'LOW', 'DIS', 'CMCSA'
  ];
  optionSymbols: string[] = [];
  optionUnderlyingChoices: string[] = [];
  optionExpiryChoices: string[] = [];
  optionChainRows: OptionChainRow[] = [];
  selectedOptionUnderlying = '';
  selectedOptionExpiry = 'ALL';
  selectedOptionStrike: number | null = null;
  optionQuickQuantity = 10;
  optionStrikeWindow = 2;
  optionChainSort: 'strike' | 'change' | 'volume' = 'strike';
  optionHeatmapExpiries: string[] = [];
  optionHeatmapRows: OptionHeatmapRow[] = [];
  stagedOptionOrder: StagedOptionOrder | null = null;

  readonly optionStrikeWindowChoices = [
    { label: 'All strikes', value: 0 },
    { label: 'ATM +/- 1', value: 1 },
    { label: 'ATM +/- 2', value: 2 },
    { label: 'ATM +/- 3', value: 3 }
  ];
  
  // Live news articles
  newsArticles: NewsArticle[] = [];
  
  // Sector Performance
  sectorPerformance: SectorPerformance[] = [];
  
  // Market indices
  marketIndices = [
    { symbol: 'SPY', name: 'S&P 500', price: 4785.50, change: 0.85 },
    { symbol: 'QQQ', name: 'NASDAQ', price: 16543.20, change: 1.23 },
    { symbol: 'DIA', name: 'DOW', price: 38450.80, change: 0.42 },
    { symbol: 'IWM', name: 'Russell 2K', price: 2015.75, change: -0.32 }
  ];
  
  // Top movers
  topGainers: {symbol: string, change: number, price: number}[] = [];
  topLosers: {symbol: string, change: number, price: number}[] = [];
  
  // New order form
  newOrder = {
    symbol: 'AAPL',
    side: '1',
    quantity: 100,
    price: 178.50,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  // Toast notifications
  toasts: Toast[] = [];
  
  // Watchlist
  watchlist: string[] = [];
  showWatchlistPanel = false;
  
  // Price Alerts
  priceAlerts: PriceAlert[] = [];
  showAlertsPanel = false;
  newAlert = {
    symbol: 'AAPL',
    targetPrice: 180.00,
    condition: 'above' as 'above' | 'below'
  };

  // Orders controls
  orderSearchQuery = '';
  orderStatusFilter = 'ALL';

  readonly orderStatusOptions = [
    'ALL',
    'NEW',
    'PARTIALLY_FILLED',
    'FILLED',
    'CANCELED',
    'REJECTED'
  ];
  
  private pollingSubscription?: Subscription;
  private marketDataSubscription?: Subscription;
  private toastSubscription?: Subscription;
  private watchlistSubscription?: Subscription;
  private alertsSubscription?: Subscription;
  
  constructor(
    private orderService: OrderService, 
    private http: HttpClient,
    private authService: AuthService,
    public notificationService: NotificationService,
    public watchlistService: WatchlistService
  ) {}
  
  ngOnInit(): void {
    // Subscribe to toast notifications
    this.toastSubscription = this.notificationService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
    
    // Subscribe to watchlist
    this.watchlistSubscription = this.watchlistService.watchlist$.subscribe(watchlist => {
      this.watchlist = watchlist;
    });
    
    // Subscribe to price alerts
    this.alertsSubscription = this.watchlistService.alerts$.subscribe(alerts => {
      this.priceAlerts = alerts;
    });
    
    // Set default user (no login required)
    this.currentUser = {
      id: 1,
      username: 'trader',
      email: 'trader@broker.local',
      displayName: 'Trader',
      accountId: 'ACC-001',
      balance: 100000,
      isAdmin: true
    };
    
    // Load everything immediately
    this.loadOrders();
    this.loadSessionInfo();
    this.loadTradableSymbols();
    this.loadMarketData();
    this.loadNewsArticles();
    this.loadSectorPerformance();
    this.startPolling();
    this.startMarketDataPolling();
    
    // Update time and market data every second
    setInterval(() => {
      this.currentTime = new Date();
      this.updateMarketIndices();
      this.updateTopMovers();
    }, 1000);
  }
  
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.marketDataSubscription) {
      this.marketDataSubscription.unsubscribe();
    }
    if (this.toastSubscription) {
      this.toastSubscription.unsubscribe();
    }
    if (this.watchlistSubscription) {
      this.watchlistSubscription.unsubscribe();
    }
    if (this.alertsSubscription) {
      this.alertsSubscription.unsubscribe();
    }
  }
  
  // Authentication methods
  showLogin(): void {
    this.showLoginForm = true;
    this.isRegistering = false;
    this.authError = null;
    this.resetLoginForm();
  }
  
  showRegister(): void {
    this.showLoginForm = true;
    this.isRegistering = true;
    this.authError = null;
    this.resetLoginForm();
  }
  
  cancelLogin(): void {
    this.showLoginForm = false;
    this.authError = null;
    this.resetLoginForm();
  }
  
  resetLoginForm(): void {
    this.loginForm = {
      username: '',
      password: '',
      email: '',
      displayName: ''
    };
  }
  
  submitLogin(): void {
    this.authError = null;
    
    if (this.isRegistering) {
      const request: RegisterRequest = {
        username: this.loginForm.username,
        password: this.loginForm.password,
        email: this.loginForm.email,
        displayName: this.loginForm.displayName || this.loginForm.username
      };
      
      this.authService.register(request).pipe(
        catchError(err => {
          this.authError = err.error?.error || 'Registration failed';
          return of(null);
        })
      ).subscribe(user => {
        if (user) {
          this.showLoginForm = false;
          this.resetLoginForm();
        }
      });
    } else {
      const request: LoginRequest = {
        username: this.loginForm.username,
        password: this.loginForm.password
      };
      
      this.authService.login(request).pipe(
        catchError(err => {
          this.authError = err.error?.error || 'Invalid username or password';
          return of(null);
        })
      ).subscribe(user => {
        if (user) {
          this.showLoginForm = false;
          this.resetLoginForm();
        }
      });
    }
  }
  
  userLogout(): void {
    this.authService.logout();
    this.orders = [];
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }
  
  loadMarketData(): void {
    // Load market data from exchange backend
    this.http.get<MarketData[]>('/api/marketdata').pipe(
      catchError(() => of([]))
    ).subscribe(data => {
      this.marketData = data;
      this.buildOptionChainRows();
      this.calculatePositions();
      this.updateTopMovers();
    });
  }

  loadTradableSymbols(): void {
    this.http.get<SecurityInfo[]>('/api/securities').pipe(
      catchError(() => of([]))
    ).subscribe(securities => {
      if (!securities.length) {
        return;
      }

      const equities = securities
        .filter(s => s.tradeable && s.securityType !== 'OPTION')
        .map(s => s.symbol)
        .sort((a, b) => a.localeCompare(b));
      const options = securities
        .filter(s => s.tradeable && s.securityType === 'OPTION')
        .map(s => s.symbol)
        .sort((a, b) => a.localeCompare(b));

      if (equities.length) {
        this.allSymbols = [...equities, ...options];
        this.quickSymbols = equities.slice(0, 8);
      }
      this.optionSymbols = options;
      this.buildOptionChainRows();
    });
  }
  
  startMarketDataPolling(): void {
    this.marketDataSubscription = interval(5000).pipe(
      switchMap(() => this.http.get<MarketData[]>('/api/marketdata').pipe(
        catchError(() => of([]))
      ))
    ).subscribe(data => {
      this.marketData = data;
      this.buildOptionChainRows();
      this.calculatePositions();
      this.updateTopMovers();
      // Check price alerts
      this.watchlistService.checkAlerts(this.marketData);
    });
  }
  
  loadOrders(): void {
    this.loading = true;
    this.error = null;
    this.orderService.getOrders().pipe(
      catchError(err => {
        this.error = 'Failed to load orders: ' + (err.message || 'Unknown error');
        return of([]);
      })
    ).subscribe(orders => {
      this.orders = orders;
      this.loading = false;
      this.calculatePositions();
    });
  }
  
  loadSessionInfo(): void {
    this.orderService.getSessionInfo().pipe(
      catchError(err => {
        console.error('Failed to load session info', err);
        return of(null);
      })
    ).subscribe(info => {
      this.sessionInfo = info;
    });
  }
  
  startPolling(): void {
    this.pollingSubscription = interval(5000).pipe(
      switchMap(() => this.orderService.getOrders().pipe(
        catchError(() => of([]))
      ))
    ).subscribe(orders => {
      this.orders = orders;
      this.calculatePositions();
    });
  }
  
  submitOrder(): void {
    this.error = null;
    const order: any = {
      clOrdId: 'ORD-' + Date.now(),
      symbol: this.newOrder.symbol,
      side: this.newOrder.side,
      quantity: this.newOrder.quantity,
      price: this.newOrder.price,
      orderType: this.newOrder.orderType,
      timeInForce: this.newOrder.timeInForce,
      clientId: 'BROKER_UI',
      status: 'NEW'
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.error = 'Failed to submit order: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.loadOrders();
      }
    });
  }
  
  cancelOrder(clOrdId: string): void {
    this.orderService.cancelOrder(clOrdId).pipe(
      catchError(err => {
        this.error = 'Failed to cancel order: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadOrders();
    });
  }
  
  logon(): void {
    this.orderService.logon().pipe(
      catchError(err => {
        this.error = 'Failed to logon: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadSessionInfo();
    });
  }
  
  logout(): void {
    this.orderService.logout().pipe(
      catchError(err => {
        this.error = 'Failed to logout: ' + (err.message || 'Unknown error');
        return of(null);
      })
    ).subscribe(() => {
      this.loadSessionInfo();
    });
  }
  
  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'NEW': return 'status-new';
      case 'PARTIALLY_FILLED': return 'status-partial';
      case 'FILLED': return 'status-filled';
      case 'CANCELED': return 'status-canceled';
      case 'REJECTED': return 'status-rejected';
      default: return 'status-unknown';
    }
  }
  
  getSideLabel(side: string): string {
    return side === '1' ? 'BUY' : side === '2' ? 'SELL' : side;
  }
  
  getSideClass(side: string): string {
    return side === '1' ? 'side-buy' : side === '2' ? 'side-sell' : '';
  }
  
  refreshOrders(): void {
    this.loadOrders();
    this.loadSessionInfo();
  }
  
  calculatePositions(): void {
    const positionMap = new Map<string, { qty: number; totalCost: number }>();
    
    // Process filled orders
    const filledOrders = this.orders.filter(o => 
      o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED'
    );
    
    filledOrders.forEach(order => {
      const symbol = order.symbol;
      const qty = order.filledQty || order.quantity;
      const price = order.price;
      const isBuy = order.side === '1';
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, { qty: 0, totalCost: 0 });
      }
      
      const pos = positionMap.get(symbol)!;
      
      if (isBuy) {
        pos.qty += qty;
        pos.totalCost += qty * price;
      } else {
        const avgCost = pos.qty > 0 ? pos.totalCost / pos.qty : 0;
        const sellQty = Math.min(qty, pos.qty);
        pos.totalCost -= sellQty * avgCost;
        pos.qty -= sellQty;
      }
    });
    
    // Convert to Position array
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    
    positionMap.forEach((pos, symbol) => {
      if (pos.qty > 0) {
        const md = this.marketData.find(m => m.symbol === symbol);
        const currentPrice = md?.lastPrice || pos.totalCost / pos.qty;
        const avgPrice = pos.totalCost / pos.qty;
        const marketValue = pos.qty * currentPrice;
        const unrealizedPnL = (currentPrice - avgPrice) * pos.qty;
        const unrealizedPnLPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        
        this.positions.push({
          symbol,
          quantity: pos.qty,
          avgPrice,
          currentPrice,
          marketValue,
          unrealizedPnL,
          unrealizedPnLPercent
        });
        
        this.totalPortfolioValue += marketValue;
        this.totalUnrealizedPnL += unrealizedPnL;
      }
    });
    
    this.positions.sort((a, b) => b.marketValue - a.marketValue);
  }
  
  getFilledCount(): number {
    return this.orders.filter(o => o.status?.toUpperCase() === 'FILLED').length;
  }
  
  getOpenCount(): number {
    return this.orders.filter(o => ['NEW', 'PARTIALLY_FILLED'].includes(o.status?.toUpperCase() || '')).length;
  }

  get filteredOrders(): Order[] {
    const query = this.orderSearchQuery.trim().toLowerCase();

    return this.orders.filter(order => {
      const status = (order.status || '').toUpperCase();
      const normalizedStatus = status === 'CANCELLED' ? 'CANCELED' : status;
      const statusMatches = this.orderStatusFilter === 'ALL' || normalizedStatus === this.orderStatusFilter;

      if (!statusMatches) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        order.clOrdId || '',
        order.orderRefNumber || '',
        order.symbol || '',
        this.getSideLabel(order.side),
        normalizedStatus
      ].some(value => value.toLowerCase().includes(query));
    });
  }

  clearOrderFilters(): void {
    this.orderSearchQuery = '';
    this.orderStatusFilter = 'ALL';
  }
  
  // Toast notification methods
  dismissToast(id: number): void {
    this.notificationService.dismiss(id);
  }
  
  // Watchlist methods
  toggleWatchlistPanel(): void {
    this.showWatchlistPanel = !this.showWatchlistPanel;
    if (this.showWatchlistPanel) {
      this.showAlertsPanel = false;
    }
  }
  
  toggleWatchlist(symbol: string): void {
    this.watchlistService.toggleWatchlist(symbol);
  }
  
  isInWatchlist(symbol: string): boolean {
    return this.watchlistService.isInWatchlist(symbol);
  }
  
  getWatchlistData(): MarketData[] {
    return this.marketData.filter(m => this.watchlist.includes(m.symbol));
  }
  
  // Price Alert methods
  toggleAlertsPanel(): void {
    this.showAlertsPanel = !this.showAlertsPanel;
    if (this.showAlertsPanel) {
      this.showWatchlistPanel = false;
    }
  }
  
  addPriceAlert(): void {
    this.watchlistService.addAlert(
      this.newAlert.symbol,
      this.newAlert.targetPrice,
      this.newAlert.condition
    );
  }
  
  removeAlert(id: number): void {
    this.watchlistService.removeAlert(id);
  }
  
  clearTriggeredAlerts(): void {
    this.watchlistService.clearTriggeredAlerts();
  }
  
  getActiveAlerts(): PriceAlert[] {
    return this.watchlistService.getActiveAlerts();
  }
  
  getTriggeredAlerts(): PriceAlert[] {
    return this.watchlistService.getTriggeredAlerts();
  }
  
  // CSV Export
  exportTradesToCSV(): void {
    if (this.orders.length === 0) {
      this.notificationService.warning('Export', 'No trades to export');
      return;
    }
    
    const headers = ['Order ID', 'Symbol', 'Side', 'Quantity', 'Price', 'Status', 'Filled Qty', 'Created At'];
    const rows = this.orders.map(order => [
      order.clOrdId,
      order.symbol,
      order.side === '1' ? 'BUY' : 'SELL',
      order.quantity.toString(),
      order.price.toFixed(2),
      order.status,
      (order.filledQty || 0).toString(),
      order.createdAt ? new Date(order.createdAt).toISOString() : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `trades_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.notificationService.success('Export', `Exported ${this.orders.length} trades to CSV`);
  }
  
  // Keyboard shortcuts
  // Analytics and new features
  depthSymbol = 'AAPL';
  showHotkeysPanel = false;
  currentTime = new Date();
  sparklineData: Map<string, number[]> = new Map();
  
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Don't trigger shortcuts when typing in inputs
    if (this.isTypingTarget(event)) {
      return;
    }

    if (this.handleGeneralShortcuts(event)) {
      return;
    }

    if (this.handleOptionShortcuts(event)) {
      return;
    }
    
    // Escape = Close panels
    if (event.key === 'Escape') {
      this.showWatchlistPanel = false;
      this.showAlertsPanel = false;
      this.showLoginForm = false;
      this.showHotkeysPanel = false;
    }
  }

  private isTypingTarget(event: KeyboardEvent): boolean {
    return event.target instanceof HTMLInputElement
      || event.target instanceof HTMLSelectElement
      || event.target instanceof HTMLTextAreaElement;
  }

  private handleGeneralShortcuts(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === 'e') {
      event.preventDefault();
      this.exportTradesToCSV();
      return true;
    }

    if (event.ctrlKey && key === 'w') {
      event.preventDefault();
      this.toggleWatchlistPanel();
      return true;
    }

    if (event.ctrlKey && event.shiftKey && key === 'a') {
      event.preventDefault();
      this.toggleAlertsPanel();
      return true;
    }

    if (event.ctrlKey && key === 'b') {
      event.preventDefault();
      this.quickBuy(this.newOrder.symbol, this.newOrder.quantity);
      return true;
    }

    if (event.ctrlKey && key === 'r') {
      event.preventDefault();
      this.refreshOrders();
      return true;
    }

    return false;
  }

  private handleOptionShortcuts(event: KeyboardEvent): boolean {
    const shortcut = this.resolveOptionShortcut(event);
    if (!shortcut) {
      return false;
    }

    event.preventDefault();
    if (shortcut.mode === 'stage') {
      this.stageSelectedOptionOrder(shortcut.contractType, shortcut.side);
    } else {
      this.executeSelectedOptionOrder(shortcut.contractType, shortcut.side);
    }
    return true;
  }

  private resolveOptionShortcut(event: KeyboardEvent): {
    mode: 'stage' | 'execute';
    contractType: 'CALL' | 'PUT';
    side: '1' | '2';
  } | null {
    const shortcuts: Record<string, { contractType: 'CALL' | 'PUT'; side: '1' | '2' }> = {
      Digit1: { contractType: 'CALL', side: '1' },
      Digit2: { contractType: 'CALL', side: '2' },
      Digit3: { contractType: 'PUT', side: '1' },
      Digit4: { contractType: 'PUT', side: '2' }
    };

    const action = shortcuts[event.code];
    if (!action) {
      return null;
    }

    if (event.ctrlKey && event.shiftKey) {
      return { mode: 'stage', ...action };
    }

    if (event.altKey) {
      return { mode: 'execute', ...action };
    }

    return null;
  }
  
  // Performance Analytics Methods
  getWinRate(): number {
    const filled = this.orders.filter(o => o.status === 'FILLED');
    if (filled.length === 0) return 0;
    // Simulated win rate based on filled orders
    return Math.min(100, 50 + (filled.length * 5));
  }
  
  getTotalTrades(): number {
    return this.orders.filter(o => o.status === 'FILLED').length;
  }
  
  getAvgProfit(): number {
    const filled = this.orders.filter(o => o.status === 'FILLED');
    if (filled.length === 0) return 0;
    // Simulated avg profit
    return filled.reduce((sum, o) => sum + (o.quantity * 0.5), 0) / filled.length;
  }
  
  getBestTrade(): number {
    const filled = this.orders.filter(o => o.status === 'FILLED');
    if (filled.length === 0) return 0;
    return Math.max(...filled.map(o => o.quantity * 1.2));
  }
  
  // Sparkline chart points
  getSparklinePoints(symbol: string): string {
    if (!this.sparklineData.has(symbol)) {
      // Generate random sparkline data
      const data = [];
      let value = 50;
      for (let i = 0; i < 20; i++) {
        value += (Math.random() - 0.5) * 10;
        value = Math.max(10, Math.min(90, value));
        data.push(value);
      }
      this.sparklineData.set(symbol, data);
    }
    const data = this.sparklineData.get(symbol) || [];
    return data.map((v, i) => `${i * 5},${30 - (v / 100) * 30}`).join(' ');
  }
  
  // Quick Trade Methods
  quickBuy(symbol: string, qty: number, orderType: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT' = 'LIMIT', timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK' = 'DAY'): void {
    const price = this.getExecutablePrice(symbol, '1');
    const order: any = {
      clOrdId: 'ORD-' + Date.now() + '-QB',
      symbol: symbol,
      side: '1',
      quantity: qty,
      price: price,
      orderType,
      timeInForce,
      clientId: 'BROKER_UI',
      status: 'NEW'
    };
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.notificationService.error('Quick Buy Failed', err.message || 'Unable to reach broker API');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.notificationService.success('Quick Buy', `Bought ${qty} ${symbol} @ $${price.toFixed(2)}`);
        this.loadOrders();
      }
    });
  }
  
  quickSell(symbol: string, qty: number, orderType: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT' = 'LIMIT', timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK' = 'DAY'): void {
    const price = this.getExecutablePrice(symbol, '2');
    const order: any = {
      clOrdId: 'ORD-' + Date.now() + '-QS',
      symbol: symbol,
      side: '2',
      quantity: qty,
      price: price,
      orderType,
      timeInForce,
      clientId: 'BROKER_UI',
      status: 'NEW'
    };
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.notificationService.error('Quick Sell Failed', err.message || 'Unable to reach broker API');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.notificationService.success('Quick Sell', `Sold ${qty} ${symbol} @ $${price.toFixed(2)}`);
        this.loadOrders();
      }
    });
  }
  
  // Risk Management Methods
  getExposurePercent(): number {
    const maxExposure = this.currentUser?.balance || 100000;
    return Math.min(100, (this.totalPortfolioValue / maxExposure) * 100);
  }
  
  getDailyPnL(): number {
    return this.totalUnrealizedPnL;
  }
  
  getDailyPnLPercent(): number {
    const limit = 5000;
    return Math.min(100, (Math.abs(this.getDailyPnL()) / limit) * 100);
  }
  
  // Order Book Depth Methods
  onDepthSymbolChange(): void {
    this.newOrder.symbol = this.depthSymbol;
  }
  
  getBids(): {price: number, qty: number, percent: number}[] {
    const stock = this.marketData.find(s => s.symbol === this.depthSymbol);
    const basePrice = stock ? stock.bid : 175;
    return [
      { price: basePrice, qty: 500, percent: 100 },
      { price: basePrice - 0.05, qty: 350, percent: 70 },
      { price: basePrice - 0.10, qty: 280, percent: 56 },
      { price: basePrice - 0.15, qty: 420, percent: 84 },
      { price: basePrice - 0.20, qty: 150, percent: 30 },
    ];
  }
  
  getAsks(): {price: number, qty: number, percent: number}[] {
    const stock = this.marketData.find(s => s.symbol === this.depthSymbol);
    const basePrice = stock ? stock.ask : 175.50;
    return [
      { price: basePrice, qty: 450, percent: 90 },
      { price: basePrice + 0.05, qty: 320, percent: 64 },
      { price: basePrice + 0.10, qty: 500, percent: 100 },
      { price: basePrice + 0.15, qty: 200, percent: 40 },
      { price: basePrice + 0.20, qty: 380, percent: 76 },
    ];
  }
  
  getSpread(): number {
    const stock = this.marketData.find(s => s.symbol === this.depthSymbol);
    return stock ? (stock.ask - stock.bid) : 0.05;
  }

  onOptionUnderlyingChange(): void {
    this.selectedOptionExpiry = 'ALL';
    this.selectedOptionStrike = null;
    this.buildOptionChainRows();
  }

  onOptionExpiryChange(): void {
    this.selectedOptionStrike = null;
    this.buildOptionChainRows();
  }

  onOptionStrikeWindowChange(): void {
    this.selectedOptionStrike = null;
    this.buildOptionChainRows();
  }

  onOptionChainSortChange(): void {
    this.buildOptionChainRows();
  }

  incrementOptionQuantity(step: number): void {
    this.optionQuickQuantity = Math.max(1, Math.min(200, this.optionQuickQuantity + step));
  }

  selectOptionStrike(strike: number): void {
    this.selectedOptionStrike = strike;
  }

  selectOptionSymbol(symbol?: string): void {
    if (!symbol) {
      return;
    }
    this.newOrder.symbol = symbol;
  }

  stageOptionOrder(symbol: string | undefined, side: '1' | '2'): void {
    if (!symbol) {
      return;
    }

    const executablePrice = this.getExecutablePrice(symbol, side);
    const parsed = this.parseOptionSymbol(symbol);

    this.newOrder.symbol = symbol;
    this.newOrder.side = side;
    this.newOrder.quantity = this.optionQuickQuantity;
    this.newOrder.price = executablePrice;

    if (parsed) {
      this.depthSymbol = parsed.underlying;
      this.stagedOptionOrder = {
        symbol,
        side,
        quantity: this.optionQuickQuantity,
        price: executablePrice,
        underlying: parsed.underlying,
        strike: parsed.strike,
        expiry: parsed.expiry,
        optionType: parsed.optionType === 'C' ? 'CALL' : 'PUT',
        stagedAt: new Date()
      };
    } else {
      this.stagedOptionOrder = null;
    }

    const sideLabel = side === '1' ? 'BUY' : 'SELL';
    this.notificationService.info(
      'Order Staged',
      `${sideLabel} ${this.optionQuickQuantity} ${symbol} @ $${this.newOrder.price.toFixed(2)}`
    );
  }

  applyStagedOptionToForm(): void {
    if (!this.stagedOptionOrder) {
      return;
    }

    this.newOrder.symbol = this.stagedOptionOrder.symbol;
    this.newOrder.side = this.stagedOptionOrder.side;
    this.newOrder.quantity = this.stagedOptionOrder.quantity;
    this.newOrder.price = this.stagedOptionOrder.price;
    this.depthSymbol = this.stagedOptionOrder.underlying;
  }

  submitStagedOptionOrder(): void {
    if (!this.stagedOptionOrder) {
      return;
    }

    const { symbol, side, quantity } = this.stagedOptionOrder;
    if (side === '1') {
      this.quickBuy(symbol, quantity);
    } else {
      this.quickSell(symbol, quantity);
    }
  }

  clearStagedOptionOrder(): void {
    this.stagedOptionOrder = null;
  }

  getOptionHeatmapCellStyle(cell: OptionHeatmapCell): string {
    if (!cell.hasData) {
      return 'rgba(148, 163, 184, 0.08)';
    }
    const boosted = Math.pow(this.clamp(cell.intensity, 0, 1), 0.82);
    return `rgba(14, 116, 144, ${0.1 + boosted * 0.6})`;
  }

  private stageSelectedOptionOrder(contractType: 'CALL' | 'PUT', side: '1' | '2'): void {
    const row = this.getSelectedOptionRow();
    if (!row) {
      return;
    }

    const symbol = contractType === 'CALL' ? row.callSymbol : row.putSymbol;
    this.stageOptionOrder(symbol, side);
  }

  private executeSelectedOptionOrder(contractType: 'CALL' | 'PUT', side: '1' | '2'): void {
    const row = this.getSelectedOptionRow();
    if (!row) {
      return;
    }

    const symbol = contractType === 'CALL' ? row.callSymbol : row.putSymbol;
    if (!symbol) {
      return;
    }

    if (side === '1') {
      this.quickBuyOption(symbol);
    } else {
      this.quickSellOption(symbol);
    }
  }

  quickBuyOption(symbol?: string): void {
    if (!symbol) {
      return;
    }
    this.newOrder.symbol = symbol;
    this.newOrder.price = this.getExecutablePrice(symbol, '1');
    this.quickBuy(symbol, this.optionQuickQuantity);
  }

  quickSellOption(symbol?: string): void {
    if (!symbol) {
      return;
    }
    this.newOrder.symbol = symbol;
    this.newOrder.price = this.getExecutablePrice(symbol, '2');
    this.quickSell(symbol, this.optionQuickQuantity);
  }

  getOptionMid(quote?: MarketData): number {
    if (!quote) {
      return 0;
    }
    return (quote.bid + quote.ask) / 2;
  }

  getOptionSpreadFromQuote(quote?: MarketData): number {
    if (!quote) {
      return 0;
    }
    return Math.max(0, quote.ask - quote.bid);
  }

  getOptionDelta(symbol?: string): number {
    const contract = symbol ? this.parseOptionSymbol(symbol) : null;
    if (!contract) {
      return 0;
    }

    const spot = this.getMarketPrice(contract.underlying);
    if (spot <= 0 || contract.strike <= 0) {
      return 0;
    }

    const moneyness = Math.log(spot / contract.strike);
    const days = this.getDaysToOptionExpiry(contract.expiry);
    const timeBoost = Math.min(0.25, 30 / Math.max(1, days) * 0.03);

    if (contract.optionType === 'C') {
      const callDelta = 0.5 + moneyness * 2.1 + timeBoost;
      return this.clamp(callDelta, 0.02, 0.98);
    }

    const putDelta = -0.5 + moneyness * 2.1 - timeBoost;
    return this.clamp(putDelta, -0.98, -0.02);
  }

  getOptionTheta(symbol?: string): number {
    const contract = symbol ? this.parseOptionSymbol(symbol) : null;
    if (!contract) {
      return 0;
    }

    const spot = this.getMarketPrice(contract.underlying);
    if (spot <= 0 || contract.strike <= 0) {
      return 0;
    }

    const quote = this.marketData.find(m => m.symbol === contract.symbol);
    const premium = quote?.lastPrice ?? Math.max(0.1, Math.abs(spot - contract.strike) * 0.1);
    const days = this.getDaysToOptionExpiry(contract.expiry);

    // Approximate daily time-decay for demo UI: larger as expiry approaches.
    const thetaMagnitude = premium / Math.max(5, days * 0.7);
    return -thetaMagnitude;
  }

  isOptionStrikeInTheMoney(strike: number, optionType: 'CALL' | 'PUT'): boolean {
    const spot = this.getMarketPrice(this.selectedOptionUnderlying);
    if (spot <= 0) {
      return false;
    }
    return optionType === 'CALL' ? strike < spot : strike > spot;
  }

  formatOptionExpiry(expiry: string): string {
    if (!/^\d{6}$/.test(expiry)) {
      return expiry;
    }

    const year = Number(expiry.slice(0, 2));
    const month = Number(expiry.slice(2, 4));
    const day = Number(expiry.slice(4, 6));
    const fullYear = 2000 + year;
    const dt = new Date(fullYear, month - 1, day);

    if (Number.isNaN(dt.getTime())) {
      return expiry;
    }

    return dt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getOptionContractLabel(symbol?: string): string {
    if (!symbol) {
      return 'N/A';
    }

    const parsed = this.parseOptionSymbol(symbol);
    if (!parsed) {
      return symbol;
    }

    const typeLabel = parsed.optionType === 'C' ? 'Call' : 'Put';
    return `${typeLabel} ${parsed.strike.toFixed(0)}`;
  }

  private buildOptionChainRows(): void {
    const parsedContracts = this.optionSymbols
      .map(symbol => this.parseOptionSymbol(symbol))
      .filter((contract): contract is ParsedOptionContract => contract !== null);

    const underlyingChoices = Array.from(new Set(parsedContracts.map(c => c.underlying)))
      .sort((a, b) => a.localeCompare(b));
    this.optionUnderlyingChoices = underlyingChoices;

    if (!underlyingChoices.length) {
      this.selectedOptionUnderlying = '';
      this.optionExpiryChoices = [];
      this.optionChainRows = [];
      this.selectedOptionStrike = null;
      return;
    }

    if (!this.selectedOptionUnderlying || !underlyingChoices.includes(this.selectedOptionUnderlying)) {
      this.selectedOptionUnderlying = underlyingChoices[0];
    }

    const forUnderlying = parsedContracts.filter(c => c.underlying === this.selectedOptionUnderlying);
    const expiryChoices = Array.from(new Set(forUnderlying.map(c => c.expiry)))
      .sort((a, b) => a.localeCompare(b));
    this.optionExpiryChoices = expiryChoices;

    const validExpiryValues = new Set(['ALL', ...expiryChoices]);
    if (!validExpiryValues.has(this.selectedOptionExpiry)) {
      this.selectedOptionExpiry = 'ALL';
    }

    const filteredContracts = this.selectedOptionExpiry === 'ALL'
      ? forUnderlying
      : forUnderlying.filter(c => c.expiry === this.selectedOptionExpiry);

    const quoteBySymbol = new Map(this.marketData.map(quote => [quote.symbol, quote]));
    const spot = this.getMarketPrice(this.selectedOptionUnderlying);
    this.buildOptionHeatmap(forUnderlying, quoteBySymbol, spot);
    const rowMap = new Map<number, OptionChainRow>();

    for (const contract of filteredContracts) {
      const row = rowMap.get(contract.strike) ?? { strike: contract.strike };

      if (contract.optionType === 'C') {
        row.callSymbol = contract.symbol;
        row.callQuote = quoteBySymbol.get(contract.symbol);
      } else {
        row.putSymbol = contract.symbol;
        row.putQuote = quoteBySymbol.get(contract.symbol);
      }

      rowMap.set(contract.strike, row);
    }

    const allRows = Array.from(rowMap.values()).sort((a, b) => a.strike - b.strike);

    const nearest = allRows.length
      ? allRows.reduce((best, row) => Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best, allRows[0])
      : null;

    const nearestStrike = nearest?.strike ?? null;
    const nearestIndex = nearestStrike === null ? -1 : allRows.findIndex(row => row.strike === nearestStrike);

    const filteredRows = this.optionStrikeWindow > 0 && nearestIndex >= 0
      ? allRows.filter((_, index) => Math.abs(index - nearestIndex) <= this.optionStrikeWindow)
      : allRows;

    const sortedRows = [...filteredRows].sort((a, b) => {
      if (this.optionChainSort === 'change') {
        const aChange = Math.max(
          Math.abs(a.callQuote?.changePercent ?? 0),
          Math.abs(a.putQuote?.changePercent ?? 0)
        );
        const bChange = Math.max(
          Math.abs(b.callQuote?.changePercent ?? 0),
          Math.abs(b.putQuote?.changePercent ?? 0)
        );
        return bChange - aChange;
      }

      if (this.optionChainSort === 'volume') {
        const aVol = (a.callQuote?.volume ?? 0) + (a.putQuote?.volume ?? 0);
        const bVol = (b.callQuote?.volume ?? 0) + (b.putQuote?.volume ?? 0);
        return bVol - aVol;
      }

      return a.strike - b.strike;
    });

    this.optionChainRows = sortedRows;

    if (!this.optionChainRows.length) {
      this.selectedOptionStrike = null;
      return;
    }

    const hasCurrentSelection = this.selectedOptionStrike !== null
      && this.optionChainRows.some(row => row.strike === this.selectedOptionStrike);
    if (hasCurrentSelection) {
      return;
    }

    this.selectedOptionStrike = nearestStrike ?? this.optionChainRows[0].strike;
  }

  private buildOptionHeatmap(
    contracts: ParsedOptionContract[],
    quoteBySymbol: Map<string, MarketData>,
    spot: number
  ): void {
    const scopedContracts = this.selectedOptionExpiry === 'ALL'
      ? contracts
      : contracts.filter(contract => contract.expiry === this.selectedOptionExpiry);

    const expiries = Array.from(new Set(scopedContracts.map(contract => contract.expiry)))
      .sort((a, b) => a.localeCompare(b));

    const allStrikes = Array.from(new Set(scopedContracts.map(contract => contract.strike)))
      .sort((a, b) => a - b);

    if (!expiries.length || !allStrikes.length) {
      this.optionHeatmapExpiries = [];
      this.optionHeatmapRows = [];
      return;
    }

    const nearestStrike = allStrikes.reduce((best, strike) =>
      Math.abs(strike - spot) < Math.abs(best - spot) ? strike : best,
      allStrikes[0]
    );

    const nearestIndex = allStrikes.indexOf(nearestStrike);
    const strikes = this.optionStrikeWindow > 0 && nearestIndex >= 0
      ? allStrikes.filter((_, index) => Math.abs(index - nearestIndex) <= this.optionStrikeWindow + 1)
      : allStrikes;

    type Pair = { callSymbol?: string; putSymbol?: string };
    const pairByExpiryStrike = new Map<string, Pair>();

    for (const contract of scopedContracts) {
      const key = `${contract.expiry}|${contract.strike}`;
      const pair = pairByExpiryStrike.get(key) ?? {};
      if (contract.optionType === 'C') {
        pair.callSymbol = contract.symbol;
      } else {
        pair.putSymbol = contract.symbol;
      }
      pairByExpiryStrike.set(key, pair);
    }

    const rowsWithRaw = strikes.map(strike => {
      const cells = expiries.map(expiry => {
        const key = `${expiry}|${strike}`;
        const pair = pairByExpiryStrike.get(key);
        const callQuote = pair?.callSymbol ? quoteBySymbol.get(pair.callSymbol) : undefined;
        const putQuote = pair?.putSymbol ? quoteBySymbol.get(pair.putSymbol) : undefined;

        const volume = (callQuote?.volume ?? 0) + (putQuote?.volume ?? 0);
        const absMove = Math.max(
          Math.abs(callQuote?.changePercent ?? 0),
          Math.abs(putQuote?.changePercent ?? 0)
        );
        const moveScore = this.clamp(absMove / 4.5, 0, 1);
        const flowScore = this.clamp(Math.log10(volume + 1) / 4, 0, 1);
        const rawIntensity = moveScore * 0.72 + flowScore * 0.28;
        const hasData = !!callQuote || !!putQuote;

        return {
          expiry,
          intensity: rawIntensity,
          volume,
          absMove,
          hasData
        } as OptionHeatmapCell;
      });

      return { strike, cells };
    });

    const intensitySamples = rowsWithRaw
      .flatMap(row => row.cells)
      .filter(cell => cell.hasData)
      .map(cell => cell.intensity)
      .sort((a, b) => a - b);

    const percentile90 = intensitySamples.length
      ? intensitySamples[Math.floor((intensitySamples.length - 1) * 0.9)]
      : 0;
    const normalizer = Math.max(percentile90, 0.0001);

    this.optionHeatmapExpiries = expiries;
    this.optionHeatmapRows = rowsWithRaw.map(row => ({
      strike: row.strike,
      cells: row.cells.map(cell => ({
        ...cell,
        intensity: cell.hasData ? Math.pow(this.clamp(cell.intensity / normalizer, 0, 1), 0.78) : 0
      }))
    }));
  }

  private parseOptionSymbol(symbol: string): ParsedOptionContract | null {
    const match = /^([A-Z]+)(\d{6})([CP])(\d{8})$/.exec(symbol);
    if (!match) {
      return null;
    }

    const strike = Number(match[4]) / 1000;
    return {
      symbol,
      underlying: match[1],
      expiry: match[2],
      optionType: match[3] as 'C' | 'P',
      strike
    };
  }

  private getSelectedOptionRow(): OptionChainRow | undefined {
    if (this.selectedOptionStrike === null) {
      return undefined;
    }
    return this.optionChainRows.find(row => row.strike === this.selectedOptionStrike);
  }

  private getExecutablePrice(symbol: string, side: '1' | '2'): number {
    const quote = this.marketData.find(s => s.symbol === symbol);
    if (!quote) {
      return 100;
    }

    const preferred = side === '1' ? quote.ask : quote.bid;
    if (preferred > 0) {
      return preferred;
    }
    if (quote.lastPrice > 0) {
      return quote.lastPrice;
    }
    return 100;
  }

  private getDaysToOptionExpiry(expiry: string): number {
    const dt = this.parseOptionExpiry(expiry);
    if (!dt) {
      return 30;
    }

    const ms = dt.getTime() - Date.now();
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  private parseOptionExpiry(expiry: string): Date | null {
    if (!/^\d{6}$/.test(expiry)) {
      return null;
    }

    const year = Number(expiry.slice(0, 2));
    const month = Number(expiry.slice(2, 4));
    const day = Number(expiry.slice(4, 6));
    const fullYear = 2000 + year;
    const dt = new Date(fullYear, month - 1, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // News and Market Data Methods
  loadNewsArticles(): void {
    const sources = ['Reuters', 'Bloomberg', 'CNBC', 'MarketWatch', 'WSJ', 'Financial Times'];
    
    const headlines = [
      { title: 'Tech Stocks Rally as AI Demand Surges', symbols: ['NVDA', 'GOOGL', 'MSFT'], sentiment: 'bullish' as const },
      { title: 'Fed Signals Potential Rate Cut in Q2', symbols: ['SPY', 'JPM', 'BAC'], sentiment: 'bullish' as const },
      { title: 'Apple Unveils New AI Features for iPhone', symbols: ['AAPL'], sentiment: 'bullish' as const },
      { title: 'Oil Prices Drop on Increased Supply', symbols: ['XOM', 'CVX', 'COP'], sentiment: 'bearish' as const },
      { title: 'Retail Sales Disappoint in February', symbols: ['WMT', 'TGT', 'COST'], sentiment: 'bearish' as const },
      { title: 'Tesla Expands Charging Network Globally', symbols: ['TSLA'], sentiment: 'bullish' as const },
      { title: 'Healthcare Stocks Steady Amid Policy Uncertainty', symbols: ['JNJ', 'UNH', 'PFE'], sentiment: 'neutral' as const },
      { title: 'Amazon Cloud Revenue Beats Expectations', symbols: ['AMZN'], sentiment: 'bullish' as const },
      { title: 'Banking Sector Faces Regulatory Pressure', symbols: ['GS', 'MS', 'JPM'], sentiment: 'bearish' as const },
      { title: 'Semiconductor Shortage Eases, Intel Benefits', symbols: ['INTC', 'AMD'], sentiment: 'bullish' as const },
    ];

    this.newsArticles = headlines.map((h, i) => ({
      title: h.title,
      source: sources[i % sources.length],
      url: `https://www.${sources[i % sources.length].toLowerCase().replace(' ', '')}.com/markets/${Date.now()}`,
      publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
      sentiment: h.sentiment,
      relatedSymbols: h.symbols
    }));
  }

  loadSectorPerformance(): void {
    this.sectorPerformance = [
      { name: 'Technology', change: 2.45, volume: 125000000, leaders: ['NVDA', 'MSFT', 'AAPL'] },
      { name: 'Healthcare', change: 0.82, volume: 45000000, leaders: ['UNH', 'LLY', 'JNJ'] },
      { name: 'Finance', change: -0.35, volume: 78000000, leaders: ['JPM', 'V', 'MA'] },
      { name: 'Energy', change: -1.25, volume: 52000000, leaders: ['XOM', 'CVX', 'COP'] },
      { name: 'Consumer', change: 1.12, volume: 67000000, leaders: ['AMZN', 'TSLA', 'HD'] },
    ];
  }

  updateMarketIndices(): void {
    this.marketIndices = this.marketIndices.map(idx => ({
      ...idx,
      price: idx.price * (1 + (Math.random() - 0.5) * 0.0002),
      change: idx.change + (Math.random() - 0.5) * 0.01
    }));
  }

  updateTopMovers(): void {
    if (this.marketData.length === 0) return;
    
    const sorted = [...this.marketData].sort((a, b) => b.changePercent - a.changePercent);
    this.topGainers = sorted.slice(0, 5).map(s => ({
      symbol: s.symbol,
      price: s.lastPrice,
      change: s.changePercent
    }));
    this.topLosers = sorted.slice(-5).reverse().map(s => ({
      symbol: s.symbol,
      price: s.lastPrice,
      change: s.changePercent
    }));
  }

  // Helper methods for template
  getMarketPrice(symbol: string): number {
    const stock = this.marketData.find(s => s.symbol === symbol);
    return stock?.lastPrice || 100;
  }

  getMarketChangePercent(symbol: string): number {
    const stock = this.marketData.find(s => s.symbol === symbol);
    return stock?.changePercent || 0;
  }

  getStockPrice(symbol: string): number {
    const stock = this.marketData.find(s => s.symbol === symbol);
    return stock?.lastPrice || 0;
  }

  getStockChange(symbol: string): number {
    const stock = this.marketData.find(s => s.symbol === symbol);
    return stock?.changePercent || 0;
  }

  onOrderSubmit(formData: any): void {
    const order: any = {
      clOrdId: 'ORD-' + Date.now(),
      symbol: formData.symbol,
      side: formData.side === 'BUY' ? '1' : '2',
      quantity: formData.quantity,
      price: formData.price,
      orderType: formData.orderType,
      timeInForce: formData.timeInForce,
      clientId: 'BROKER_UI',
      status: 'NEW'
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        this.notificationService.error('Order Failed', err.message || 'Failed to submit order');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.notificationService.success('Order Placed', `${formData.side} ${formData.quantity} ${formData.symbol} @ $${formData.price.toFixed(2)}`);
        this.loadOrders();
      }
    });
  }
}
