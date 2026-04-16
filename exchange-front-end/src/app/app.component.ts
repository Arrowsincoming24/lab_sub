// Watermark: Aarav Joshi
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './services/order.service';
import { Order, SessionStatus, SessionEvent } from './models/order.model';
import { Subscription, interval, of, forkJoin, Subject } from 'rxjs';
import { switchMap, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface StockCategory {
  name: string;
  stocks: StockQuote[];
  expanded: boolean;
}

interface Security {
  symbol: string;
  name: string;
  sector: string;
  securityType: string;
}

interface MarketData {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
}

interface Execution {
  execId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  time: Date;
  orderId: string;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  symbol?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  isBreaking: boolean;
  impact: 'high' | 'medium' | 'low';
}

interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  triggered: boolean;
  createdAt: Date;
}

interface CurrencyPair {
  pair: string;
  base: string;
  quote: string;
  rate: number;
  previousRate: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume: number;
  lastUpdated: Date;
  flag1: string;
  flag2: string;
}

interface ExportFormat {
  type: 'csv' | 'json' | 'xlsx';
  label: string;
  icon: string;
}

interface StockOptionSnapshot {
  symbol: string;
  name: string;
  sector: string;
  spot: number;
  strike: number;
  call: {
    theoreticalPrice: number;
    greeks: {
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
      rho: number;
    };
  };
  put: {
    theoreticalPrice: number;
    greeks: {
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
      rho: number;
    };
  };
  timeToExpiry: number;
  riskFreeRate: number;
  volatility: number;
  timestamp: number;
}

interface AllOptionsResponse {
  count: number;
  items: StockOptionSnapshot[];
}

type OptionsSortKey = 'symbol' | 'callDesc' | 'putDesc' | 'deltaDesc';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Exchange Platform';
  orders: Order[] = [];
  sessionStatus: SessionStatus | null = null;
  sessionEvents: SessionEvent[] = [];
  loading = false;
  sessionEventsLoading = false;
  sessionEventFilter: 'ALL' | 'ERRORS' | 'ORDERS' | 'SESSION' = 'ALL';
  sessionEventsLimit = 20;
  sessionEventsLive = true;
  error: string | null = null;
  success: string | null = null;
  
  // Navigation
  currentView = 'dashboard';
  
  // Expose Math for template
  Math = Math;
  
  // Market Data - Categorized
  stockCategories: StockCategory[] = [];
  filteredCategories: StockCategory[] = [];
  allStocks: StockQuote[] = [];
  securities: Security[] = [];
  searchQuery = '';
  orderSearchQuery = '';
  orderStatusFilter = 'ALL';
  showFixResponseControls = false;
  readonly orderStatusOptions = [
    'ALL',
    'NEW',
    'PARTIALLY_FILLED',
    'FILLED',
    'CANCELED',
    'REJECTED'
  ];
  private readonly responseInFlightKeys = new Set<string>();
  readonly sessionEventLimits = [20, 50, 100];
  
  // Position Tracking
  positions: Position[] = [];
  totalPortfolioValue = 0;
  totalUnrealizedPnL = 0;
  totalRealizedPnL = 0;
  
  // Trade History Blotter
  executions: Execution[] = [];
  
  // New feature properties
  currentTime = new Date();
  selectedOrderBookSymbol = 'AAPL';
  systemHealth = { healthy: true };
  
  // Cached Order Book Data (fixes flickering)
  cachedOrderBook: { bids: any[], asks: any[] } = { bids: [], asks: [] };
  orderBookLoading = false;
  
  // Real-time Trade Ticker
  recentTrades: { symbol: string, price: number, qty: number, side: string, time: Date }[] = [];
  
  // Volume Profile
  volumeProfile: { price: number, buyVolume: number, sellVolume: number }[] = [];
  
  // Quick Trade Sizes
  quickSizes = [100, 500, 1000, 5000];
  
  // Time & Sales
  timeSales: { time: Date, price: number, size: number, side: string }[] = [];
  
  // Market Depth (for chart)
  depthData: { bids: {price: number, total: number}[], asks: {price: number, total: number}[] } = { bids: [], asks: [] };
  
  // Arbitrage & Spread Analysis
  spreadOpportunities: {symbol: string, spread: number, spreadBps: number, opportunity: string}[] = [];
  correlatedPairs: {pair: string, correlation: number, divergence: number, signal: string}[] = [];
  marketInefficiencies: {symbol: string, type: string, magnitude: number, confidence: number}[] = [];
  historicalSpreads: Map<string, number[]> = new Map();
  
  // Technical Indicators
  vwapData: Map<string, number> = new Map();
  rsiData: Map<string, number> = new Map();
  volatilityData: Map<string, number> = new Map();
  
  // Current symbol indicators (for change detection)
  currentVwap = 0;
  currentRsi = 50;
  currentVolatility = 0;
  currentSpread = 0;
  
  // Market Statistics
  totalMarketVolume = 0;
  marketBreadth = { advancers: 0, decliners: 0, unchanged: 0 };
  sectorPerformance: {sector: string, change: number, volume: number}[] = [];
  
  // News Feed
  newsItems: NewsItem[] = [];
  newsCategories = ['All', 'Markets', 'Earnings', 'Tech', 'Economy', 'Crypto'];
  selectedNewsCategory = 'All';
  
  // Watchlist
  watchlist: string[] = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX',
    'JPM', 'BAC', 'XOM', 'CVX', 'V', 'MA', 'KO', 'PEP', 'WMT', 'DIS'
  ];
  
  // Alerts
  priceAlerts: PriceAlert[] = [];
  
  // Currency Market Monitor
  currencyPairs: CurrencyPair[] = [];
  selectedCurrencyPair: string = 'EUR/USD';
  currencyCategories = ['Major', 'Minor', 'Exotic'];
  selectedCurrencyCategory = 'Major';
  
  // Export Options
  exportFormats: ExportFormat[] = [
    { type: 'csv', label: 'CSV', icon: '📄' },
    { type: 'json', label: 'JSON', icon: '📋' },
    { type: 'xlsx', label: 'Excel', icon: '📊' }
  ];
  
  // Market Sentiment
  marketSentiment = {
    bullish: 65,
    bearish: 25,
    neutral: 10,
    fearGreedIndex: 68,
    trend: 'bullish' as 'bullish' | 'bearish' | 'neutral'
  };
  
  // Portfolio Allocation
  portfolioAllocation: { sector: string; value: number; percent: number; color: string }[] = [];

  private basePrices: Map<string, number> = new Map();
  
  // New order form
  newOrder = {
    symbol: 'AAPL',
    side: '1',
    quantity: 100,
    price: 178.50,
    orderType: 'LIMIT',
    timeInForce: 'DAY'
  };
  
  // G4-M4: Options Pricing UI
  optionsPricing = {
    symbol: 'AAPL',
    optionType: 'CALL',
    spotPrice: 178.50,
    strikePrice: 180,
    daysToExpiry: 30,
    volatility: 25,
    riskFreeRate: 5,
    fairPrice: 0,
    greeks: {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    }
  };
  optionsChain: {type: string, strike: number, price: number, delta: number, iv: number}[] = [];
  allOptionsSnapshots: StockOptionSnapshot[] = [];
  optionsSearchQuery = '';
  optionsSectorFilter = 'ALL';
  optionsSortKey: OptionsSortKey = 'callDesc';
  optionsBoardLoading = false;
  optionsBoardError: string | null = null;
  optionsAssumptions = {
    daysToExpiry: 30,
    riskFreeRatePct: 5,
    volatilityPct: 25
  };
  optionsPage = 1;
  readonly optionsPageSize = 20;
  optionsCompactMode = false;
  optionsRequireQuickTradeConfirm = true;
  private readonly optionsBoardPrefsKey = 'exchange.optionsBoardPrefs.v1';
  private readonly optionsSearchInput$ = new Subject<string>();
  
  private pollingSubscription?: Subscription;
  private marketDataSubscription?: Subscription;
  private optionsSearchSubscription?: Subscription;
  
  constructor(private orderService: OrderService, private http: HttpClient) {}
  
  ngOnInit(): void {
    this.restoreOptionsBoardPrefs();
    this.setupOptionsSearchDebounce();
    this.loadMarketData();
    this.loadOrders();
    this.loadSessionStatus();
    this.loadSessionEvents(this.sessionEventsLimit);
    this.startPolling();
    this.startMarketDataPolling();
    
    // Update time every second
    setInterval(() => {
      this.currentTime = new Date();
      this.updateAnalytics();
    }, 1000);
    
    // Refresh order book every 500ms 
    setInterval(() => {
      this.refreshOrderBook();
    }, 500);
    
    // Initialize correlated pairs for arbitrage monitoring
    this.initializeCorrelatedPairs();

    // Initialize news feed from backend (website-backed + cached)
    this.loadNewsFromApi();

    // Initialize currency market
    this.initializeCurrencyPairs();

    // Update currencies every 3 seconds
    setInterval(() => {
      this.updateCurrencyPrices();
      this.updateMarketSentiment();
    }, 3000);

    // Refresh news from backend every 60 seconds
    setInterval(() => {
      this.loadNewsFromApi();
    }, 60000);
    
    // Initialize order book
    setTimeout(() => {
      this.refreshOrderBook();
      this.loadRecentTrades();
    }, 500);
    
    // Initialize options pricing after a short delay for market data to load
    setTimeout(() => {
      this.updateOptionPrice();
      this.loadOptionsChain();
      this.refreshAllOptionsPricing();
      this.updateMarketSentiment();
    }, 1500);
  }
  
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.marketDataSubscription) {
      this.marketDataSubscription.unsubscribe();
    }
    if (this.optionsSearchSubscription) {
      this.optionsSearchSubscription.unsubscribe();
    }
  }
  
  loadMarketData(): void {
    // Load both securities and market data from API
    forkJoin({
      securities: this.http.get<Security[]>('/api/securities').pipe(catchError(() => of([]))),
      marketData: this.http.get<MarketData[]>('/api/marketdata').pipe(catchError(() => of([])))
    }).subscribe(({ securities, marketData }) => {
      this.securities = securities.filter(s => s.securityType === 'EQUITY');
      
      // Create a map of market data
      const mdMap = new Map<string, MarketData>();
      marketData.forEach(md => mdMap.set(md.symbol, md));
      
      // Convert to StockQuote format
      this.allStocks = this.securities.map(s => {
        const md = mdMap.get(s.symbol);
        const basePrice = md?.lastPrice || 100;
        this.basePrices.set(s.symbol, basePrice);
        
        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          price: md?.lastPrice || basePrice,
          bid: md?.bid || basePrice - 0.05,
          ask: md?.ask || basePrice + 0.05,
          change: md?.change || 0,
          changePercent: md?.changePercent || 0,
          volume: md?.volume || 0
        };
      });
      
      this.organizeByCategory();
      
      // Set initial price for order form
      if (this.allStocks.length > 0) {
        const selected = this.getSelectedStock() || this.allStocks[0];
        this.newOrder.symbol = selected.symbol;
        this.selectedOrderBookSymbol = selected.symbol;
        this.optionsPricing.symbol = selected.symbol;
        this.optionsPricing.spotPrice = selected.price;
        this.newOrder.price = Math.round(selected.price * 100) / 100;
      }
    });
  }
  
  startMarketDataPolling(): void {
    this.marketDataSubscription = interval(2000).pipe(
      switchMap(() => this.http.get<MarketData[]>('/api/marketdata').pipe(catchError(() => of([]))))
    ).subscribe(marketData => {
      const mdMap = new Map<string, MarketData>();
      marketData.forEach(md => mdMap.set(md.symbol, md));
      
      // Update stocks with new prices
      this.allStocks = this.allStocks.map(stock => {
        const md = mdMap.get(stock.symbol);
        if (md) {
          return {
            ...stock,
            price: md.lastPrice,
            bid: md.bid,
            ask: md.ask,
            change: md.change,
            changePercent: md.changePercent,
            volume: md.volume
          };
        }
        return stock;
      });
      
      // Update categories
      this.stockCategories.forEach(cat => {
        cat.stocks = this.allStocks.filter(s => s.sector === cat.name);
      });

      const selected = this.getSelectedStock();
      if (selected) {
        this.selectedOrderBookSymbol = selected.symbol;
        this.optionsPricing.symbol = selected.symbol;
        this.optionsPricing.spotPrice = selected.price;
        this.newOrder.price = Math.round(selected.price * 100) / 100;
      }

      // Keep all-stock options panel in sync with latest market prices
      this.refreshAllOptionsPricing();
    });
  }
  
  organizeByCategory(): void {
    const sectors = [...new Set(this.allStocks.map(s => s.sector))];
    this.stockCategories = sectors.map(sector => ({
      name: sector,
      stocks: this.allStocks.filter(s => s.sector === sector),
      expanded: sector === 'TECHNOLOGY' || sector === 'Technology'
    }));
    
    // Expand first category if none are expanded
    if (this.stockCategories.length > 0 && !this.stockCategories.some(c => c.expanded)) {
      this.stockCategories[0].expanded = true;
    }
    
    this.filteredCategories = [...this.stockCategories];
  }
  
  filterStocks(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCategories = [...this.stockCategories];
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredCategories = this.stockCategories
      .map(cat => ({
        ...cat,
        stocks: cat.stocks.filter(s => 
          s.symbol.toLowerCase().includes(query) || 
          s.name.toLowerCase().includes(query)
        ),
        expanded: true
      }))
      .filter(cat => cat.stocks.length > 0);
  }
  
  getSelectedStock(): StockQuote | undefined {
    return this.allStocks.find(s => s.symbol === this.newOrder.symbol);
  }
  
  onSymbolChange(): void {
    const stock = this.getSelectedStock();
    this.selectedOrderBookSymbol = this.newOrder.symbol;
    this.optionsPricing.symbol = this.newOrder.symbol;
    if (stock) {
      this.newOrder.price = Math.round(stock.price * 100) / 100;
    }
    this.refreshOrderBook();
    this.loadRecentTrades();
  }
  
  getTotalVolume(): number {
    return this.allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
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

  toggleFixResponseControls(): void {
    this.showFixResponseControls = !this.showFixResponseControls;
  }

  sendOrderResponse(order: Order, responseType: 'ACK' | 'STATUS' | 'CANCEL' | 'REJECT'): void {
    const clOrdId = order.clOrdId;
    if (!clOrdId) {
      this.error = 'Cannot send FIX response: missing clOrdId on selected order';
      return;
    }

    const requestKey = `${clOrdId}:${responseType}`;
    if (this.responseInFlightKeys.has(requestKey)) {
      return;
    }

    this.responseInFlightKeys.add(requestKey);
    this.error = null;

    this.orderService.sendQuickFixResponse({
      clOrdId,
      responseType,
      text: `Triggered from Exchange UI (${responseType})`
    }).pipe(
      catchError(err => {
        this.error = err?.error?.message || `Failed to send ${responseType} response for ${clOrdId}`;
        return of(null);
      })
    ).subscribe(result => {
      this.responseInFlightKeys.delete(requestKey);

      if (result?.success) {
        this.success = `${result.responseType} response sent for ${result.clOrdId}`;
        this.loadSessionStatus();
        this.loadSessionEvents(this.sessionEventsLimit);
      }
    });
  }

  isOrderResponseSending(order: Order, responseType: 'ACK' | 'STATUS' | 'CANCEL' | 'REJECT'): boolean {
    const clOrdId = order.clOrdId;
    if (!clOrdId) {
      return false;
    }
    return this.responseInFlightKeys.has(`${clOrdId}:${responseType}`);
  }
  
  toggleCategory(category: StockCategory): void {
    category.expanded = !category.expanded;
  }
  
  selectStock(stock: StockQuote): void {
    this.newOrder.symbol = stock.symbol;
    this.newOrder.price = Math.round(stock.price * 100) / 100;
  }
  
  getStockPrice(symbol: string): number {
    const stock = this.allStocks.find(s => s.symbol === symbol);
    return stock ? stock.price : 0;
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
  
  loadSessionStatus(): void {
    this.orderService.getSessionStatus().pipe(
      catchError(err => {
        console.error('Failed to load session status', err);
        return of(null);
      })
    ).subscribe(status => {
      this.sessionStatus = status;
    });
  }

  get filteredSessionEvents(): SessionEvent[] {
    if (this.sessionEventFilter === 'ALL') {
      return this.sessionEvents;
    }

    return this.sessionEvents.filter(event => {
      const type = (event.type || '').toUpperCase();

      if (this.sessionEventFilter === 'ERRORS') {
        return type.includes('REJECT') || type.includes('ERROR');
      }

      if (this.sessionEventFilter === 'ORDERS') {
        return type.includes('ORDER') || type.includes('FILL') || type.includes('TRADE') || type.includes('CANCEL');
      }

      if (this.sessionEventFilter === 'SESSION') {
        return type.includes('SESSION') || type.includes('LOGON') || type.includes('LOGOUT') || type.includes('HEARTBEAT');
      }

      return true;
    });
  }

  loadSessionEvents(limit = this.sessionEventsLimit): void {
    this.sessionEventsLimit = limit;
    this.sessionEventsLoading = true;
    this.orderService.getSessionEvents(limit).pipe(
      catchError(err => {
        console.error('Failed to load session events', err);
        return of([]);
      })
    ).subscribe(events => {
      this.sessionEvents = events;
      this.sessionEventsLoading = false;
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
      this.loadSessionStatus();
      if (this.sessionEventsLive) {
        this.loadSessionEvents(this.sessionEventsLimit);
      }
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

  getSessionEventClass(type: string): string {
    const normalizedType = (type || '').toUpperCase();

    if (normalizedType.includes('REJECT')) {
      return 'event-chip event-chip--reject';
    }

    if (normalizedType.includes('CANCEL') || normalizedType.includes('LOGOUT')) {
      return 'event-chip event-chip--cancel';
    }

    if (normalizedType.includes('FILL') || normalizedType.includes('TRADE')) {
      return 'event-chip event-chip--fill';
    }

    if (normalizedType.includes('ORDER')) {
      return 'event-chip event-chip--order';
    }

    if (normalizedType.includes('LOGON') || normalizedType.includes('SESSION')) {
      return 'event-chip event-chip--session';
    }

    return 'event-chip event-chip--default';
  }
  
  getSideLabel(side: string): string {
    return side === '1' ? 'BUY' : side === '2' ? 'SELL' : side;
  }
  
  getSideClass(side: string): string {
    return side === '1' ? 'side-buy' : side === '2' ? 'side-sell' : '';
  }
  
  refreshOrders(): void {
    this.loadOrders();
    this.loadSessionStatus();
    this.loadSessionEvents(this.sessionEventsLimit);
  }

  submitOrder(): void {
    this.error = null;
    this.success = null;
    const order: any = {
      clOrdId: 'EXC-' + Date.now(),
      symbol: this.newOrder.symbol,
      side: this.newOrder.side,
      quantity: this.newOrder.quantity,
      price: this.newOrder.price,
      orderType: this.newOrder.orderType,
      timeInForce: this.newOrder.timeInForce,
      clientId: 'EXCHANGE_UI',
      matchWaitMs: 750,
      status: 'NEW'
    };
    
    this.orderService.createOrder(order).pipe(
      catchError(err => {
        const backendMessage = err?.error?.message || err?.error?.error || err?.error?.rejectReason || err?.error?.rejectCode;
        this.error = 'Failed to submit order: ' + (backendMessage || err.message || err.statusText || 'Unknown error');
        return of(null);
      })
    ).subscribe((result: any) => {
      if (result) {
        const status = (result.status || '').toUpperCase();
        const addedToBook = !!result.addedToBook;
        if (status === 'NEW' && addedToBook) {
          this.success = `Order accepted and queued on book: ${result.clOrdId}. It will match only when opposite-side liquidity arrives.`;
        } else if (status === 'PARTIALLY_FILLED') {
          this.success = `Order partially filled: ${result.clOrdId} (filled ${result.filledQty}, leaves ${result.leavesQty}).`;
        } else {
          this.success = 'Order submitted successfully: ' + result.clOrdId;
        }
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
  
  // Position Tracking Methods
  calculatePositions(): void {
    const positionMap = new Map<string, { qty: number; totalCost: number; realizedPnL: number }>();
    
    // Process filled orders to calculate positions
    const filledOrders = this.orders.filter(o => 
      o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED'
    );
    
    filledOrders.forEach(order => {
      const symbol = order.symbol;
      const qty = order.filledQty || order.quantity;
      const price = order.price;
      const isBuy = order.side === '1';
      
      if (!positionMap.has(symbol)) {
        positionMap.set(symbol, { qty: 0, totalCost: 0, realizedPnL: 0 });
      }
      
      const pos = positionMap.get(symbol)!;
      
      if (isBuy) {
        pos.qty += qty;
        pos.totalCost += qty * price;
      } else {
        // Sell - realize P&L
        if (pos.qty > 0) {
          const avgCost = pos.totalCost / pos.qty;
          const sellQty = Math.min(qty, pos.qty);
          pos.realizedPnL += sellQty * (price - avgCost);
          pos.totalCost -= sellQty * avgCost;
          pos.qty -= sellQty;
        }
      }
    });
    
    // Convert to Position array with current prices
    this.positions = [];
    this.totalPortfolioValue = 0;
    this.totalUnrealizedPnL = 0;
    this.totalRealizedPnL = 0;
    
    positionMap.forEach((pos, symbol) => {
      if (pos.qty > 0) {
        const stock = this.allStocks.find(s => s.symbol === symbol);
        const currentPrice = stock?.price || this.basePrices.get(symbol) || 0;
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
          unrealizedPnLPercent,
          realizedPnL: pos.realizedPnL
        });
        
        this.totalPortfolioValue += marketValue;
        this.totalUnrealizedPnL += unrealizedPnL;
      }
      this.totalRealizedPnL += pos.realizedPnL;
    });
    
    // Sort by market value
    this.positions.sort((a, b) => b.marketValue - a.marketValue);
    
    // Build executions blotter
    this.buildExecutions();
  }
  
  buildExecutions(): void {
    // Generate execution records from filled orders
    this.executions = this.orders
      .filter(o => o.status?.toUpperCase() === 'FILLED' || o.status?.toUpperCase() === 'PARTIALLY_FILLED')
      .map((order, idx) => ({
        execId: `EXC-${idx + 1}`,
        symbol: order.symbol,
        side: order.side,
        quantity: order.filledQty || order.quantity,
        price: order.price,
        time: new Date(order.createdAt || Date.now()),
        orderId: order.clOrdId || order.orderRefNumber || ''
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 20); // Show last 20 executions
  }
  
  // New Analytics Methods
  getOrderVolume(): number {
    return this.orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  }
  
  getFillRate(): number {
    if (this.orders.length === 0) return 0;
    const filled = this.getFilledCount();
    return (filled / this.orders.length) * 100;
  }
  
  getAvgLatency(): number {
    // Simulated latency - in real system would track actual latency
    return Math.floor(Math.random() * 3) + 1;
  }
  
  getOrdersPerSecond(): number {
    // Simulated throughput
    return Math.floor(Math.random() * 500) + 100;
  }
  
  getQuotesPerSecond(): number {
    return Math.floor(Math.random() * 1000) + 500;
  }
  
  getMessagesIn(): number {
    return this.orders.length * 2 + Math.floor(Math.random() * 100);
  }
  
  getMessagesOut(): number {
    return this.orders.length * 3 + Math.floor(Math.random() * 100);
  }
  
  getLastUpdateTime(): string {
    return new Date().toLocaleTimeString();
  }
  
  // Order Book Methods
  onOrderBookSymbolChange(): void {
    // Update technical indicators for new symbol
    console.log('Order book symbol changed to:', this.selectedOrderBookSymbol);
    this.updateCurrentIndicators();
    // Also update new order form symbol
    this.newOrder.symbol = this.selectedOrderBookSymbol;
    // Refresh order book immediately
    this.refreshOrderBook();
    this.loadRecentTrades();
  }
  
  refreshOrderBook(): void {
    const symbol = this.selectedOrderBookSymbol;
    const stock = this.allStocks.find(s => s.symbol === symbol);
    const midPrice = stock?.price || 175;
    
    // Try to fetch real order book from API
    this.http.get<any>(`/api/orderbook/${symbol}?depth=10`)
      .pipe(catchError(() => of(null)))
      .subscribe(response => {
        if (response && response.bids && response.bids.length > 0) {
          // Use real order book data
          this.cachedOrderBook = this.formatApiOrderBook(response, midPrice);
        } else {
          // Generate simulated order book for this symbol
          this.cachedOrderBook = this.generateSimulatedOrderBook(symbol, midPrice);
        }
        this.updateDepthChart();
      });
  }
  
  formatApiOrderBook(response: any, _midPrice: number): { bids: any[], asks: any[] } {
    let cumBidSize = 0;
    let cumAskSize = 0;
    
    const bids = (response.bids || []).slice(0, 8).map((level: any) => {
      cumBidSize += level.totalQuantity || level.size || 0;
      return {
        price: level.price,
        size: level.totalQuantity || level.size || 0,
        total: cumBidSize * level.price,
        percent: Math.min(100, (level.totalQuantity || level.size || 0) / 5)
      };
    });
    
    const asks = (response.asks || []).slice(0, 8).map((level: any) => {
      cumAskSize += level.totalQuantity || level.size || 0;
      return {
        price: level.price,
        size: level.totalQuantity || level.size || 0,
        total: cumAskSize * level.price,
        percent: Math.min(100, (level.totalQuantity || level.size || 0) / 5)
      };
    });
    
    return { bids, asks };
  }
  
  generateSimulatedOrderBook(symbol: string, midPrice: number): { bids: any[], asks: any[] } {
    // Use symbol hash to generate consistent order book
    const hash = symbol.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const seed = Math.abs(hash) % 1000;
    
    const bids = [];
    const asks = [];
    let cumBidSize = 0;
    let cumAskSize = 0;
    
    for (let i = 0; i < 8; i++) {
      // Use seeded pseudo-random for consistent results per symbol
      const bidSize = ((seed * (i + 1) * 17) % 500) + 100;
      const askSize = ((seed * (i + 1) * 23) % 500) + 100;
      cumBidSize += bidSize;
      cumAskSize += askSize;
      
      bids.push({
        price: midPrice - (i + 1) * 0.05,
        size: bidSize,
        total: cumBidSize * (midPrice - (i + 1) * 0.05),
        percent: Math.min(100, bidSize / 5)
      });
      
      asks.push({
        price: midPrice + (i + 1) * 0.05,
        size: askSize,
        total: cumAskSize * (midPrice + (i + 1) * 0.05),
        percent: Math.min(100, askSize / 5)
      });
    }
    
    return { bids, asks };
  }
  
  updateDepthChart(): void {
    // Calculate cumulative depth for chart visualization
    let bidTotal = 0;
    let askTotal = 0;
    
    this.depthData.bids = this.cachedOrderBook.bids.map(b => {
      bidTotal += b.size;
      return { price: b.price, total: bidTotal };
    }).reverse();
    
    this.depthData.asks = this.cachedOrderBook.asks.map(a => {
      askTotal += a.size;
      return { price: a.price, total: askTotal };
    });
  }
  
  loadRecentTrades(): void {
    const symbol = this.selectedOrderBookSymbol;
    this.http.get<any[]>(`/api/marketdata/trades/${symbol}`)
      .pipe(catchError(() => of([])))
      .subscribe(trades => {
        this.recentTrades = (trades || []).slice(0, 20).map(t => ({
          symbol: t.symbol || symbol,
          price: t.price,
          qty: t.quantity,
          side: t.aggressorSide || 'BUY',
          time: new Date(t.createdAt || Date.now())
        }));
        
        // Also update time & sales
        this.timeSales = this.recentTrades.slice(0, 10).map(t => ({
          time: t.time,
          price: t.price,
          size: t.qty,
          side: t.side
        }));
      });
  }
  
  // Quick trade functions
  quickBuy(size: number): void {
    this.newOrder.side = '1';
    this.newOrder.quantity = size;
    this.submitOrder();
  }
  
  quickSell(size: number): void {
    this.newOrder.side = '2';
    this.newOrder.quantity = size;
    this.submitOrder();
  }
  
  updateCurrentIndicators(): void {
    const symbol = this.selectedOrderBookSymbol;
    this.currentVwap = this.vwapData.get(symbol) || 0;
    this.currentRsi = this.rsiData.get(symbol) || 50;
    this.currentVolatility = this.volatilityData.get(symbol) || 0;
    
    const stock = this.allStocks.find(s => s.symbol === symbol);
    if (stock && stock.bid > 0 && stock.ask > 0) {
      this.currentSpread = ((stock.ask - stock.bid) / stock.price) * 10000;
    } else {
      this.currentSpread = 0;
    }
  }

  getOrderBookCategories(): StockCategory[] {
    // Return categories with only EQUITY stocks for the order book dropdown
    return this.stockCategories.filter(cat => cat.stocks.length > 0);
  }
  
  generateOrderBook(): { bids: any[], asks: any[] } {
    // Return cached order book data (refreshed via refreshOrderBook)
    return this.cachedOrderBook;
  }
  
  getOrderBookSpread(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    return stock ? (stock.ask - stock.bid) : 0.10;
  }
  
  getSpreadPercent(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    if (!stock) return 0;
    return ((stock.ask - stock.bid) / stock.price) * 100;
  }
  
  getMidPrice(): number {
    const stock = this.allStocks.find(s => s.symbol === this.selectedOrderBookSymbol);
    return stock ? (stock.bid + stock.ask) / 2 : 175;
  }

  getAllStocks(): StockQuote[] {
    // Return top 12 stocks for the ticker display
    return this.allStocks.slice(0, 12);
  }

  // ============= ARBITRAGE & SPREAD ANALYSIS =============
  
  initializeCorrelatedPairs(): void {
    this.correlatedPairs = [
      { pair: 'AAPL/MSFT', correlation: 0.85, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'GOOGL/META', correlation: 0.78, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'JPM/BAC', correlation: 0.92, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'XOM/CVX', correlation: 0.95, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'V/MA', correlation: 0.88, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'KO/PEP', correlation: 0.82, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'NVDA/AMD', correlation: 0.75, divergence: 0, signal: 'NEUTRAL' },
      { pair: 'JNJ/PFE', correlation: 0.72, divergence: 0, signal: 'NEUTRAL' },
    ];
  }

  updateAnalytics(): void {
    if (this.allStocks.length === 0) return;
    
    this.updateSpreadOpportunities();
    this.updateCorrelatedPairs();
    this.updateMarketInefficiencies();
    this.updateMarketStatistics();
    this.updateTechnicalIndicators();
  }

  updateSpreadOpportunities(): void {
    this.spreadOpportunities = this.allStocks
      .filter(s => s.bid > 0 && s.ask > 0)
      .map(s => {
        const spread = s.ask - s.bid;
        const spreadBps = (spread / s.price) * 10000;
        let opportunity = 'LOW';
        if (spreadBps > 10) opportunity = 'MEDIUM';
        if (spreadBps > 25) opportunity = 'HIGH';
        return { symbol: s.symbol, spread, spreadBps, opportunity };
      })
      .sort((a, b) => b.spreadBps - a.spreadBps)
      .slice(0, 10);
  }

  updateCorrelatedPairs(): void {
    this.correlatedPairs = this.correlatedPairs.map(pair => {
      const [sym1, sym2] = pair.pair.split('/');
      const stock1 = this.allStocks.find(s => s.symbol === sym1);
      const stock2 = this.allStocks.find(s => s.symbol === sym2);
      
      if (!stock1 || !stock2) return pair;
      
      // Calculate divergence based on relative price changes
      const change1 = stock1.changePercent || 0;
      const change2 = stock2.changePercent || 0;
      const expectedChange2 = change1 * pair.correlation;
      const divergence = change2 - expectedChange2;
      
      let signal = 'NEUTRAL';
      if (divergence > 0.5) signal = 'SELL_' + sym2;
      if (divergence < -0.5) signal = 'BUY_' + sym2;
      if (Math.abs(divergence) > 1.0) signal = 'STRONG_' + signal;
      
      return { ...pair, divergence: Math.round(divergence * 100) / 100, signal };
    });
  }

  updateMarketInefficiencies(): void {
    this.marketInefficiencies = [];
    
    this.allStocks.forEach(stock => {
      // Check for momentum anomalies
      if (Math.abs(stock.changePercent) > 3) {
        this.marketInefficiencies.push({
          symbol: stock.symbol,
          type: stock.changePercent > 0 ? 'OVERBOUGHT' : 'OVERSOLD',
          magnitude: Math.abs(stock.changePercent),
          confidence: Math.min(95, 60 + Math.abs(stock.changePercent) * 5)
        });
      }
      
      // Check for unusual spread
      const spreadBps = ((stock.ask - stock.bid) / stock.price) * 10000;
      if (spreadBps > 20) {
        this.marketInefficiencies.push({
          symbol: stock.symbol,
          type: 'WIDE_SPREAD',
          magnitude: spreadBps,
          confidence: Math.min(90, 50 + spreadBps)
        });
      }
      
      // Track historical spreads for volatility detection
      if (!this.historicalSpreads.has(stock.symbol)) {
        this.historicalSpreads.set(stock.symbol, []);
      }
      const history = this.historicalSpreads.get(stock.symbol)!;
      history.push(spreadBps);
      if (history.length > 60) history.shift(); // Keep last 60 samples
    });
    
    // Sort by confidence
    this.marketInefficiencies.sort((a, b) => b.confidence - a.confidence);
    this.marketInefficiencies = this.marketInefficiencies.slice(0, 8);
  }

  updateMarketStatistics(): void {
    this.totalMarketVolume = this.allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
    
    this.marketBreadth = {
      advancers: this.allStocks.filter(s => s.change > 0).length,
      decliners: this.allStocks.filter(s => s.change < 0).length,
      unchanged: this.allStocks.filter(s => s.change === 0).length
    };
    
    // Calculate sector performance
    const sectorMap = new Map<string, {totalChange: number, count: number, volume: number}>();
    this.allStocks.forEach(s => {
      const current = sectorMap.get(s.sector) || {totalChange: 0, count: 0, volume: 0};
      current.totalChange += s.changePercent || 0;
      current.count++;
      current.volume += s.volume || 0;
      sectorMap.set(s.sector, current);
    });
    
    this.sectorPerformance = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        change: Math.round((data.totalChange / data.count) * 100) / 100,
        volume: data.volume
      }))
      .sort((a, b) => b.change - a.change);
  }

  updateTechnicalIndicators(): void {
    this.allStocks.forEach(stock => {
      // Simplified VWAP calculation (in real system would use tick data)
      const vwap = stock.price * 0.998 + (Math.random() - 0.5) * stock.price * 0.002;
      this.vwapData.set(stock.symbol, Math.round(vwap * 100) / 100);
      
      // Simplified RSI (random walk around 50)
      const currentRsi = this.rsiData.get(stock.symbol) || 50;
      const rsiChange = (Math.random() - 0.5) * 5 + (stock.changePercent || 0) * 2;
      const newRsi = Math.max(0, Math.min(100, currentRsi + rsiChange));
      this.rsiData.set(stock.symbol, Math.round(newRsi));
      
      // Volatility (implied from spread)
      const vol = ((stock.ask - stock.bid) / stock.price) * 100 * 16; // Annualized approximation
      this.volatilityData.set(stock.symbol, Math.round(vol * 100) / 100);
    });
    
    // Update current indicators for selected symbol
    this.updateCurrentIndicators();
  }

  getVwap(symbol: string): number {
    return this.vwapData.get(symbol) || 0;
  }

  getRsi(symbol: string): number {
    return this.rsiData.get(symbol) || 50;
  }

  getVolatility(symbol: string): number {
    return this.volatilityData.get(symbol) || 0;
  }

  getRsiClass(rsi: number): string {
    if (rsi >= 70) return 'rsi-overbought';
    if (rsi <= 30) return 'rsi-oversold';
    return 'rsi-neutral';
  }

  getSignalClass(signal: string): string {
    if (signal.includes('BUY')) return 'signal-buy';
    if (signal.includes('SELL')) return 'signal-sell';
    return 'signal-neutral';
  }

  getOpportunityClass(opportunity: string): string {
    if (opportunity === 'HIGH') return 'opportunity-high';
    if (opportunity === 'MEDIUM') return 'opportunity-medium';
    return 'opportunity-low';
  }

  formatVolume(vol: number): string {
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(1) + 'B';
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(1) + 'K';
    return vol.toString();
  }

  // ================== G4-M4: Options Pricing Methods ==================

  updateOptionPrice(): void {
    // Update spot price from market data
    const stock = this.allStocks.find(s => s.symbol === this.optionsPricing.symbol);
    if (stock) {
      this.optionsPricing.spotPrice = stock.price;
    }
    
    // Call API to get option price
    const params = {
      spot: this.optionsPricing.spotPrice,
      strike: this.optionsPricing.strikePrice,
      timeToExpiry: this.optionsPricing.daysToExpiry / 365,
      riskFreeRate: this.optionsPricing.riskFreeRate / 100,
      volatility: this.optionsPricing.volatility / 100,
      isCall: this.optionsPricing.optionType === 'CALL'
    };
    
    this.http.get<any>('/api/options/price', { params: params as any })
      .pipe(catchError(() => of(null)))
      .subscribe(result => {
        if (result) {
          this.optionsPricing.fairPrice = result.price || 0;
          if (result.greeks) {
            this.optionsPricing.greeks = {
              delta: result.greeks.delta || 0,
              gamma: result.greeks.gamma || 0,
              theta: result.greeks.theta || 0,
              vega: result.greeks.vega || 0,
              rho: result.greeks.rho || 0
            };
          }
        } else {
          // Calculate locally as fallback
          this.calculateOptionPriceLocally();
        }
      });
  }

  calculateOptionPriceLocally(): void {
    const S = this.optionsPricing.spotPrice;
    const K = this.optionsPricing.strikePrice;
    const T = this.optionsPricing.daysToExpiry / 365;
    const r = this.optionsPricing.riskFreeRate / 100;
    const sigma = this.optionsPricing.volatility / 100;
    const isCall = this.optionsPricing.optionType === 'CALL';
    
    // Black-Scholes calculation
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);
    const Nnd1 = this.normalCDF(-d1);
    const Nnd2 = this.normalCDF(-d2);
    
    if (isCall) {
      this.optionsPricing.fairPrice = S * Nd1 - K * Math.exp(-r * T) * Nd2;
      this.optionsPricing.greeks.delta = Nd1;
    } else {
      this.optionsPricing.fairPrice = K * Math.exp(-r * T) * Nnd2 - S * Nnd1;
      this.optionsPricing.greeks.delta = Nd1 - 1;
    }
    
    // Calculate other Greeks
    const sqrtT = Math.sqrt(T);
    const discount = Math.exp(-r * T);
    const npd1 = this.normalPDF(d1);
    
    this.optionsPricing.greeks.gamma = npd1 / (S * sigma * sqrtT);
    this.optionsPricing.greeks.vega = S * npd1 * sqrtT / 100;
    this.optionsPricing.greeks.theta = isCall
      ? (-S * npd1 * sigma / (2 * sqrtT) - r * K * discount * Nd2) / 365
      : (-S * npd1 * sigma / (2 * sqrtT) + r * K * discount * Nnd2) / 365;
    this.optionsPricing.greeks.rho = isCall
      ? K * T * discount * Nd2 / 100
      : -K * T * discount * Nnd2 / 100;
  }

  normalCDF(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  }

  normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  loadOptionsChain(): void {
    const stock = this.allStocks.find(s => s.symbol === this.optionsPricing.symbol);
    if (!stock) return;
    
    const spotPrice = stock.price;
    const chain: {type: string, strike: number, price: number, delta: number, iv: number}[] = [];
    
    // Generate strikes around spot price
    const strikeStep = Math.max(1, Math.round(spotPrice / 20));
    const minStrike = Math.floor(spotPrice * 0.85 / strikeStep) * strikeStep;
    const maxStrike = Math.ceil(spotPrice * 1.15 / strikeStep) * strikeStep;
    
    for (let strike = minStrike; strike <= maxStrike; strike += strikeStep) {
      for (const type of ['CALL', 'PUT']) {
        const isCall = type === 'CALL';
        const T = this.optionsPricing.daysToExpiry / 365;
        const r = this.optionsPricing.riskFreeRate / 100;
        const sigma = this.optionsPricing.volatility / 100;
        
        const d1 = (Math.log(spotPrice / strike) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        
        let price, delta;
        if (isCall) {
          price = spotPrice * this.normalCDF(d1) - strike * Math.exp(-r * T) * this.normalCDF(d2);
          delta = this.normalCDF(d1);
        } else {
          price = strike * Math.exp(-r * T) * this.normalCDF(-d2) - spotPrice * this.normalCDF(-d1);
          delta = this.normalCDF(d1) - 1;
        }
        
        chain.push({
          type: type,
          strike: strike,
          price: Math.max(0, price),
          delta: delta,
          iv: this.optionsPricing.volatility
        });
      }
    }
    
    this.optionsChain = chain.sort((a, b) => a.strike - b.strike || (a.type === 'CALL' ? -1 : 1));
  }

  refreshAllOptionsPricing(): void {
    this.optionsBoardLoading = true;
    this.optionsBoardError = null;
    this.persistOptionsBoardPrefs();
    const params = {
      timeToExpiry: this.optionsAssumptions.daysToExpiry / 365,
      riskFreeRate: this.optionsAssumptions.riskFreeRatePct / 100,
      volatility: this.optionsAssumptions.volatilityPct / 100
    };

    this.http.get<AllOptionsResponse>('/api/options/theoretical/all', { params: params as any })
      .pipe(catchError(() => {
        const fallback = this.buildLocalOptionsSnapshots(
          params.timeToExpiry,
          params.riskFreeRate,
          params.volatility,
        );
        this.allOptionsSnapshots = fallback;
        this.optionsPage = 1;
        this.optionsBoardError = fallback.length
          ? 'Using local Black-Scholes fallback (pricing API unavailable).'
          : 'Failed to load options pricing.';
        return of(null);
      }))
      .subscribe(response => {
        this.optionsBoardLoading = false;
        if (response?.items) {
          this.allOptionsSnapshots = response.items;
          this.optionsPage = 1;
        }
      });
  }

  private buildLocalOptionsSnapshots(timeToExpiry: number, riskFreeRate: number, volatility: number): StockOptionSnapshot[] {
    return this.allStocks
      .filter(stock => Number.isFinite(stock.price) && stock.price > 0)
      .map(stock => {
        const strike = this.deriveAtmStrike(stock.price);
        const call = this.priceOptionLocally(stock.price, strike, timeToExpiry, riskFreeRate, volatility, true);
        const put = this.priceOptionLocally(stock.price, strike, timeToExpiry, riskFreeRate, volatility, false);

        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          spot: stock.price,
          strike,
          call,
          put,
          timeToExpiry,
          riskFreeRate,
          volatility,
          timestamp: Date.now(),
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  private deriveAtmStrike(spot: number): number {
    if (spot < 25) {
      return Math.round(spot * 2) / 2;
    }
    if (spot < 200) {
      return Math.round(spot);
    }
    if (spot < 1000) {
      return Math.round(spot / 5) * 5;
    }
    return Math.round(spot / 10) * 10;
  }

  private priceOptionLocally(
    spot: number,
    strike: number,
    timeToExpiry: number,
    riskFreeRate: number,
    volatility: number,
    isCall: boolean,
  ): StockOptionSnapshot['call'] {
    const T = Math.max(timeToExpiry, 1 / 365);
    const sigma = Math.max(volatility, 0.0001);
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(spot / strike) + (riskFreeRate + sigma * sigma / 2) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);
    const Nnd1 = this.normalCDF(-d1);
    const Nnd2 = this.normalCDF(-d2);
    const npd1 = this.normalPDF(d1);
    const discount = Math.exp(-riskFreeRate * T);

    const theoreticalPrice = isCall
      ? spot * Nd1 - strike * discount * Nd2
      : strike * discount * Nnd2 - spot * Nnd1;
    return {
      theoreticalPrice: Math.max(0, theoreticalPrice),
      greeks: {
        delta: isCall ? Nd1 : Nd1 - 1,
        gamma: npd1 / (spot * sigma * sqrtT),
        theta: isCall
          ? (-spot * npd1 * sigma / (2 * sqrtT) - riskFreeRate * strike * discount * Nd2) / 365
          : (-spot * npd1 * sigma / (2 * sqrtT) + riskFreeRate * strike * discount * Nnd2) / 365,
        vega: spot * npd1 * sqrtT,
        rho: isCall ? strike * T * discount * Nd2 : -strike * T * discount * Nnd2,
      },
    };
  }

  get optionsSectorFilters(): string[] {
    const sectors = Array.from(new Set(this.allOptionsSnapshots.map(o => o.sector))).sort();
    return ['ALL', ...sectors];
  }

  get filteredOptionsSnapshots(): StockOptionSnapshot[] {
    const query = this.optionsSearchQuery.trim().toLowerCase();

    const filtered = this.allOptionsSnapshots.filter(option => {
      const matchesSector = this.optionsSectorFilter === 'ALL' || option.sector === this.optionsSectorFilter;
      if (!matchesSector) {
        return false;
      }
      if (!query) {
        return true;
      }
      return option.symbol.toLowerCase().includes(query) || option.name.toLowerCase().includes(query);
    });

    const sorted = [...filtered];
    switch (this.optionsSortKey) {
      case 'symbol':
        sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case 'putDesc':
        sorted.sort((a, b) => b.put.theoreticalPrice - a.put.theoreticalPrice);
        break;
      case 'deltaDesc':
        sorted.sort((a, b) => b.call.greeks.delta - a.call.greeks.delta);
        break;
      case 'callDesc':
      default:
        sorted.sort((a, b) => b.call.theoreticalPrice - a.call.theoreticalPrice);
        break;
    }
    return sorted;
  }

  get pagedOptionsSnapshots(): StockOptionSnapshot[] {
    const start = (this.optionsPage - 1) * this.optionsPageSize;
    return this.filteredOptionsSnapshots.slice(start, start + this.optionsPageSize);
  }

  get totalOptionsPages(): number {
    return Math.max(1, Math.ceil(this.filteredOptionsSnapshots.length / this.optionsPageSize));
  }

  prevOptionsPage(): void {
    if (this.optionsPage > 1) {
      this.optionsPage -= 1;
      this.persistOptionsBoardPrefs();
    }
  }

  nextOptionsPage(): void {
    if (this.optionsPage < this.totalOptionsPages) {
      this.optionsPage += 1;
      this.persistOptionsBoardPrefs();
    }
  }

  onOptionsBoardFiltersChanged(): void {
    this.optionsPage = 1;
    this.persistOptionsBoardPrefs();
  }

  onOptionsSearchQueryChange(value: string): void {
    this.optionsSearchInput$.next(value ?? '');
  }

  toggleOptionsCompactMode(): void {
    this.optionsCompactMode = !this.optionsCompactMode;
    this.persistOptionsBoardPrefs();
  }

  toggleQuickTradeConfirm(): void {
    this.optionsRequireQuickTradeConfirm = !this.optionsRequireQuickTradeConfirm;
    this.persistOptionsBoardPrefs();
  }

  clearOptionsFilters(): void {
    this.optionsSearchQuery = '';
    this.optionsSectorFilter = 'ALL';
    this.optionsSortKey = 'callDesc';
    this.optionsPage = 1;
    this.persistOptionsBoardPrefs();
  }

  private setupOptionsSearchDebounce(): void {
    this.optionsSearchSubscription = this.optionsSearchInput$
      .pipe(debounceTime(220), distinctUntilChanged())
      .subscribe(value => {
        this.optionsSearchQuery = value;
        this.onOptionsBoardFiltersChanged();
      });
  }

  private persistOptionsBoardPrefs(): void {
    try {
      localStorage.setItem(this.optionsBoardPrefsKey, JSON.stringify({
        searchQuery: this.optionsSearchQuery,
        sectorFilter: this.optionsSectorFilter,
        sortKey: this.optionsSortKey,
        assumptions: this.optionsAssumptions,
        page: this.optionsPage,
        compactMode: this.optionsCompactMode,
        requireQuickTradeConfirm: this.optionsRequireQuickTradeConfirm
      }));
    } catch {
      // Ignore storage issues (private mode, quota, unavailable storage).
    }
  }

  private restoreOptionsBoardPrefs(): void {
    try {
      const raw = localStorage.getItem(this.optionsBoardPrefsKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        searchQuery?: string;
        sectorFilter?: string;
        sortKey?: OptionsSortKey;
        assumptions?: {
          daysToExpiry?: number;
          riskFreeRatePct?: number;
          volatilityPct?: number;
        };
        page?: number;
        compactMode?: boolean;
        requireQuickTradeConfirm?: boolean;
      };

      this.optionsSearchQuery = typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '';
      this.optionsSectorFilter = typeof parsed.sectorFilter === 'string' ? parsed.sectorFilter : 'ALL';
      this.optionsSortKey = this.isValidOptionsSortKey(parsed.sortKey) ? parsed.sortKey : 'callDesc';
      this.optionsAssumptions.daysToExpiry = this.clampNumeric(parsed.assumptions?.daysToExpiry, 1, 3650, 30);
      this.optionsAssumptions.riskFreeRatePct = this.clampNumeric(parsed.assumptions?.riskFreeRatePct, 0, 50, 5);
      this.optionsAssumptions.volatilityPct = this.clampNumeric(parsed.assumptions?.volatilityPct, 1, 400, 25);
      this.optionsPage = Math.max(1, Math.floor(parsed.page ?? 1));
      this.optionsCompactMode = parsed.compactMode === true;
      this.optionsRequireQuickTradeConfirm = parsed.requireQuickTradeConfirm !== false;
    } catch {
      // Ignore invalid persisted payloads.
    }
  }

  private isValidOptionsSortKey(value: unknown): value is OptionsSortKey {
    return value === 'symbol' || value === 'callDesc' || value === 'putDesc' || value === 'deltaDesc';
  }

  private clampNumeric(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  trackByOptionSymbol(_index: number, option: StockOptionSnapshot): string {
    return option.symbol;
  }

  focusOptionSymbol(symbol: string): void {
    this.selectedOrderBookSymbol = symbol;
    this.newOrder.symbol = symbol;
    this.optionsPricing.symbol = symbol;
    this.onSymbolChange();
    this.updateOptionPrice();
    this.loadOptionsChain();
  }

  quickOptionTrade(symbol: string, side: '1' | '2', referencePrice: number): void {
    this.focusOptionSymbol(symbol);

    if (this.optionsRequireQuickTradeConfirm) {
      const action = side === '1' ? 'BUY' : 'SELL';
      const roundedPrice = Math.max(0.01, Math.round(referencePrice * 100) / 100);
      const shouldSubmit = globalThis.confirm(`Submit ${action} order for ${symbol} @ ${roundedPrice.toFixed(2)}?`);
      if (!shouldSubmit) {
        return;
      }
    }

    this.newOrder.side = side;
    this.newOrder.price = Math.max(0.01, Math.round(referencePrice * 100) / 100);
    this.submitOrder();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    const isTypingTarget = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;

    if (event.altKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.refreshAllOptionsPricing();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.toggleOptionsCompactMode();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.nextOptionsPage();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.prevOptionsPage();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      const searchInput = document.getElementById('optionsSearchInput') as HTMLInputElement | null;
      searchInput?.focus();
      searchInput?.select();
      return;
    }

    if (!isTypingTarget && event.key === '/') {
      event.preventDefault();
      const searchInput = document.getElementById('optionsSearchInput') as HTMLInputElement | null;
      searchInput?.focus();
      searchInput?.select();
    }
  }

  getMoneyness(): string {
    const ratio = this.optionsPricing.spotPrice / this.optionsPricing.strikePrice;
    const isCall = this.optionsPricing.optionType === 'CALL';
    
    if (Math.abs(ratio - 1) < 0.02) return 'ATM';
    if (isCall) {
      return ratio > 1 ? 'ITM' : 'OTM';
    } else {
      return ratio < 1 ? 'ITM' : 'OTM';
    }
  }

  getMoneyessClass(): string {
    const moneyness = this.getMoneyness();
    if (moneyness === 'ITM') return 'itm';
    if (moneyness === 'OTM') return 'otm';
    return 'atm';
  }

  // Track-by function for order list performance
  trackByOrderId(index: number, order: Order): string {
    return order.orderRefNumber || order.clOrdId || index.toString();
  }

  // Handle stock selection from heatmap component
  onHeatmapStockSelect(event: { symbol: string }): void {
    this.selectedOrderBookSymbol = event.symbol;
    this.newOrder.symbol = event.symbol;
    this.onSymbolChange();
  }

  // News Methods
  initializeNews(): void {
    this.newsItems = [
      {
        id: 'fallback-news-1',
        title: 'Live News Feed Reconnecting',
        summary: 'External news sources are temporarily unavailable. The feed will refresh automatically.',
        source: 'System',
        category: 'Markets',
        sentiment: 'neutral',
        timestamp: new Date(),
        isBreaking: false,
        impact: 'low'
      },
      {
        id: 'fallback-news-2',
        title: 'Watch Real-Time Market Data in Dashboard',
        summary: 'Order book, trade tape, and watchlist quotes continue to stream from exchange services.',
        source: 'System',
        category: 'Markets',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        isBreaking: false,
        impact: 'low'
      }
    ];
  }

  loadNewsFromApi(): void {
    this.http.get<Array<{
      id: string;
      title: string;
      summary: string;
      source: string;
      category: string;
      symbol?: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      timestamp: string;
      isBreaking: boolean;
      impact: 'high' | 'medium' | 'low';
    }>>('/api/news?limit=25')
      .pipe(catchError(() => of([])))
      .subscribe(items => {
        if (!items || items.length === 0) {
          this.initializeNews();
          return;
        }

        this.newsItems = items.map(item => ({
          id: item.id || `news-${Date.now()}-${Math.random()}`,
          title: item.title,
          summary: item.summary,
          source: item.source,
          category: item.category,
          symbol: item.symbol,
          sentiment: item.sentiment,
          timestamp: new Date(item.timestamp),
          isBreaking: item.isBreaking,
          impact: item.impact
        }));

        this.newsItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      });
  }

  getFilteredNews(): NewsItem[] {
    if (this.selectedNewsCategory === 'All') return this.newsItems;
    return this.newsItems.filter(n => n.category === this.selectedNewsCategory);
  }

  getNewsAge(timestamp: Date): string {
    const diff = Date.now() - timestamp.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // Watchlist Methods
  isInWatchlist(symbol: string): boolean {
    return this.watchlist.includes(symbol);
  }

  toggleWatchlist(symbol: string): void {
    const index = this.watchlist.indexOf(symbol);
    if (index >= 0) {
      this.watchlist.splice(index, 1);
    } else {
      this.watchlist.push(symbol);
    }
  }

  getWatchlistStocks(): StockQuote[] {
    return this.allStocks.filter(s => this.watchlist.includes(s.symbol));
  }

  // Alert Methods
  addPriceAlert(symbol: string, condition: 'above' | 'below', price: number): void {
    this.priceAlerts.push({
      id: `alert-${Date.now()}`,
      symbol,
      condition,
      price,
      triggered: false,
      createdAt: new Date()
    });
  }

  removeAlert(id: string): void {
    this.priceAlerts = this.priceAlerts.filter(a => a.id !== id);
  }

  checkPriceAlerts(): void {
    this.priceAlerts.forEach(alert => {
      if (alert.triggered) return;
      const stock = this.allStocks.find(s => s.symbol === alert.symbol);
      if (!stock) return;
      
      if (alert.condition === 'above' && stock.price >= alert.price) {
        alert.triggered = true;
      } else if (alert.condition === 'below' && stock.price <= alert.price) {
        alert.triggered = true;
      }
    });
  }

  // Currency Market Methods
  initializeCurrencyPairs(): void {
    const pairs = [
      // Major pairs
      { pair: 'EUR/USD', base: 'EUR', quote: 'USD', rate: 1.0876, flag1: '🇪🇺', flag2: '🇺🇸' },
      { pair: 'GBP/USD', base: 'GBP', quote: 'USD', rate: 1.2734, flag1: '🇬🇧', flag2: '🇺🇸' },
      { pair: 'USD/JPY', base: 'USD', quote: 'JPY', rate: 149.85, flag1: '🇺🇸', flag2: '🇯🇵' },
      { pair: 'USD/CHF', base: 'USD', quote: 'CHF', rate: 0.8825, flag1: '🇺🇸', flag2: '🇨🇭' },
      { pair: 'AUD/USD', base: 'AUD', quote: 'USD', rate: 0.6532, flag1: '🇦🇺', flag2: '🇺🇸' },
      { pair: 'USD/CAD', base: 'USD', quote: 'CAD', rate: 1.3542, flag1: '🇺🇸', flag2: '🇨🇦' },
      { pair: 'NZD/USD', base: 'NZD', quote: 'USD', rate: 0.6089, flag1: '🇳🇿', flag2: '🇺🇸' },
      // Minor pairs
      { pair: 'EUR/GBP', base: 'EUR', quote: 'GBP', rate: 0.8538, flag1: '🇪🇺', flag2: '🇬🇧' },
      { pair: 'EUR/JPY', base: 'EUR', quote: 'JPY', rate: 162.94, flag1: '🇪🇺', flag2: '🇯🇵' },
      { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY', rate: 190.77, flag1: '🇬🇧', flag2: '🇯🇵' },
      { pair: 'EUR/CHF', base: 'EUR', quote: 'CHF', rate: 0.9596, flag1: '🇪🇺', flag2: '🇨🇭' },
      { pair: 'AUD/JPY', base: 'AUD', quote: 'JPY', rate: 97.83, flag1: '🇦🇺', flag2: '🇯🇵' },
      // Exotic pairs
      { pair: 'USD/MXN', base: 'USD', quote: 'MXN', rate: 17.12, flag1: '🇺🇸', flag2: '🇲🇽' },
      { pair: 'USD/SGD', base: 'USD', quote: 'SGD', rate: 1.3412, flag1: '🇺🇸', flag2: '🇸🇬' },
      { pair: 'USD/HKD', base: 'USD', quote: 'HKD', rate: 7.8123, flag1: '🇺🇸', flag2: '🇭🇰' },
      { pair: 'EUR/TRY', base: 'EUR', quote: 'TRY', rate: 35.24, flag1: '🇪🇺', flag2: '🇹🇷' }
    ];

    this.currencyPairs = pairs.map(p => ({
      ...p,
      previousRate: p.rate,
      change: 0,
      changePercent: 0,
      bid: p.rate - (Math.random() * 0.0005),
      ask: p.rate + (Math.random() * 0.0005),
      high24h: p.rate * (1 + Math.random() * 0.02),
      low24h: p.rate * (1 - Math.random() * 0.02),
      volume: Math.floor(Math.random() * 1000000) + 500000,
      lastUpdated: new Date()
    }));
  }

  updateCurrencyPrices(): void {
    this.currencyPairs = this.currencyPairs.map(pair => {
      const volatility = pair.pair.includes('TRY') || pair.pair.includes('MXN') ? 0.002 : 0.0005;
      const change = (Math.random() - 0.5) * volatility * pair.rate;
      const newRate = Math.max(0.0001, pair.rate + change);
      const dailyChange = newRate - pair.previousRate;
      const spread = newRate * (Math.random() * 0.0003 + 0.0001);
      
      return {
        ...pair,
        rate: newRate,
        change: dailyChange,
        changePercent: (dailyChange / pair.previousRate) * 100,
        bid: newRate - spread,
        ask: newRate + spread,
        high24h: Math.max(pair.high24h, newRate),
        low24h: Math.min(pair.low24h, newRate),
        volume: pair.volume + Math.floor(Math.random() * 10000),
        lastUpdated: new Date()
      };
    });
  }

  getFilteredCurrencyPairs(): CurrencyPair[] {
    const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const minorPairs = ['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY'];
    
    if (this.selectedCurrencyCategory === 'Major') {
      return this.currencyPairs.filter(p => majorPairs.includes(p.pair));
    } else if (this.selectedCurrencyCategory === 'Minor') {
      return this.currencyPairs.filter(p => minorPairs.includes(p.pair));
    } else {
      return this.currencyPairs.filter(p => !majorPairs.includes(p.pair) && !minorPairs.includes(p.pair));
    }
  }

  getSelectedCurrency(): CurrencyPair | undefined {
    return this.currencyPairs.find(p => p.pair === this.selectedCurrencyPair);
  }

  // Export Methods
  exportData(type: 'orders' | 'positions' | 'executions' | 'watchlist' | 'currencies', format: 'csv' | 'json' | 'xlsx'): void {
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'orders':
        data = this.orders.map(o => ({
          OrderID: o.clOrdId || o.orderRefNumber,
          Symbol: o.symbol,
          Side: o.side === '1' ? 'BUY' : 'SELL',
          Quantity: o.quantity,
          Price: o.price,
          Status: o.status,
          FilledQty: o.filledQty || 0,
          CreatedAt: o.createdAt
        }));
        filename = 'orders_export';
        break;
      case 'positions':
        data = this.positions.map(p => ({
          Symbol: p.symbol,
          Quantity: p.quantity,
          AvgPrice: p.avgPrice.toFixed(2),
          CurrentPrice: p.currentPrice.toFixed(2),
          MarketValue: p.marketValue.toFixed(2),
          UnrealizedPnL: p.unrealizedPnL.toFixed(2),
          UnrealizedPnLPercent: p.unrealizedPnLPercent.toFixed(2) + '%',
          RealizedPnL: p.realizedPnL.toFixed(2)
        }));
        filename = 'positions_export';
        break;
      case 'executions':
        data = this.executions.map(e => ({
          ExecID: e.execId,
          Symbol: e.symbol,
          Side: e.side === '1' ? 'BUY' : 'SELL',
          Quantity: e.quantity,
          Price: e.price.toFixed(2),
          Time: e.time.toISOString(),
          OrderID: e.orderId
        }));
        filename = 'executions_export';
        break;
      case 'watchlist':
        data = this.getWatchlistStocks().map(s => ({
          Symbol: s.symbol,
          Name: s.name,
          Sector: s.sector,
          Price: s.price.toFixed(2),
          Change: s.change.toFixed(2),
          ChangePercent: s.changePercent.toFixed(2) + '%',
          Bid: s.bid.toFixed(2),
          Ask: s.ask.toFixed(2),
          Volume: s.volume
        }));
        filename = 'watchlist_export';
        break;
      case 'currencies':
        data = this.currencyPairs.map(c => ({
          Pair: c.pair,
          Rate: c.rate.toFixed(5),
          Change: c.change.toFixed(5),
          ChangePercent: c.changePercent.toFixed(4) + '%',
          Bid: c.bid.toFixed(5),
          Ask: c.ask.toFixed(5),
          High24h: c.high24h.toFixed(5),
          Low24h: c.low24h.toFixed(5),
          Volume: c.volume,
          LastUpdated: c.lastUpdated.toISOString()
        }));
        filename = 'currencies_export';
        break;
    }

    if (format === 'csv') {
      this.downloadCSV(data, filename);
    } else if (format === 'json') {
      this.downloadJSON(data, filename);
    } else if (format === 'xlsx') {
      this.downloadCSV(data, filename); // Fallback to CSV for xlsx
    }
  }

  private downloadCSV(data: any[], filename: string): void {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h];
        const strVal = String(val ?? '');
        return strVal.includes(',') ? `"${strVal}"` : strVal;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private downloadJSON(data: any[], filename: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Portfolio Allocation
  calculatePortfolioAllocation(): { sector: string; value: number; percent: number; color: string }[] {
    const sectorColors: Record<string, string> = {
      'Technology': '#3b82f6',
      'TECHNOLOGY': '#3b82f6',
      'Healthcare': '#10b981',
      'HEALTHCARE': '#10b981',
      'Finance': '#f59e0b',
      'FINANCE': '#f59e0b',
      'Consumer': '#ef4444',
      'CONSUMER': '#ef4444',
      'Energy': '#8b5cf6',
      'ENERGY': '#8b5cf6',
      'Other': '#6b7280'
    };

    const sectorTotals = new Map<string, number>();
    
    this.positions.forEach(pos => {
      const stock = this.allStocks.find(s => s.symbol === pos.symbol);
      const sector = stock?.sector || 'Other';
      const current = sectorTotals.get(sector) || 0;
      sectorTotals.set(sector, current + pos.marketValue);
    });

    const total = this.totalPortfolioValue || 1;
    const allocation: { sector: string; value: number; percent: number; color: string }[] = [];
    
    sectorTotals.forEach((value, sector) => {
      allocation.push({
        sector,
        value,
        percent: (value / total) * 100,
        color: sectorColors[sector] || sectorColors['Other']
      });
    });

    return allocation.sort((a, b) => b.value - a.value);
  }

  // Market Sentiment
  updateMarketSentiment(): void {
    const advancers = this.allStocks.filter(s => s.changePercent > 0).length;
    const decliners = this.allStocks.filter(s => s.changePercent < 0).length;
    const total = this.allStocks.length || 1;
    
    this.marketSentiment.bullish = Math.round((advancers / total) * 100);
    this.marketSentiment.bearish = Math.round((decliners / total) * 100);
    this.marketSentiment.neutral = 100 - this.marketSentiment.bullish - this.marketSentiment.bearish;
    
    this.marketSentiment.fearGreedIndex = Math.round(50 + (this.marketSentiment.bullish - this.marketSentiment.bearish) * 0.4);
    this.marketSentiment.trend = this.marketSentiment.bullish > 50 ? 'bullish' : this.marketSentiment.bearish > 50 ? 'bearish' : 'neutral';
  }

  getFearGreedLabel(): string {
    const index = this.marketSentiment.fearGreedIndex;
    if (index <= 20) return 'Extreme Fear';
    if (index <= 40) return 'Fear';
    if (index <= 60) return 'Neutral';
    if (index <= 80) return 'Greed';
    return 'Extreme Greed';
  }

  getFearGreedColor(): string {
    const index = this.marketSentiment.fearGreedIndex;
    if (index <= 25) return '#ef4444';
    if (index <= 45) return '#f97316';
    if (index <= 55) return '#eab308';
    if (index <= 75) return '#84cc16';
    return '#22c55e';
  }
}
