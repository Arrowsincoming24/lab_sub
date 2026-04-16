// Watermark: Aarav Joshi
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: Date;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
}

export interface StockCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketNews {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: Date | string;
  related: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  sector: string;
  marketCap: number;
  logo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LiveMarketService implements OnDestroy {
  // Using free APIs - Finnhub has generous free tier with WebSocket support
  // Alpha Vantage also has free tier
  // We'll use multiple sources for redundancy
  
  private readonly FINNHUB_API_KEY = 'demo'; // Replace with real key for production
  
  private quotesSubject = new BehaviorSubject<Map<string, LiveQuote>>(new Map());
  private newsSubject = new BehaviorSubject<MarketNews[]>([]);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private destroy$ = new Subject<void>();
  
  private websocket: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  
  // Simulated real-time data for demo (replace with real API calls)
  private baseQuotes: Map<string, LiveQuote> = new Map();
  
  quotes$ = this.quotesSubject.asObservable();
  news$ = this.newsSubject.asObservable();
  connectionStatus$ = this.connectionStatusSubject.asObservable();
  
  // Popular symbols to track
  readonly POPULAR_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD',
    'JPM', 'V', 'JNJ', 'WMT', 'XOM', 'DIS', 'NFLX', 'PYPL'
  ];

  constructor() {
    this.initializeBaseQuotes();
    this.startRealTimeSimulation();
    this.loadNews();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectWebSocket();
  }

  private initializeBaseQuotes(): void {
    // Initialize with realistic base prices
    const stockData: { [key: string]: { price: number; name: string } } = {
      'AAPL': { price: 178.50, name: 'Apple Inc.' },
      'MSFT': { price: 415.20, name: 'Microsoft Corp.' },
      'GOOGL': { price: 141.80, name: 'Alphabet Inc.' },
      'AMZN': { price: 178.25, name: 'Amazon.com Inc.' },
      'NVDA': { price: 875.30, name: 'NVIDIA Corp.' },
      'TSLA': { price: 248.50, name: 'Tesla Inc.' },
      'META': { price: 505.75, name: 'Meta Platforms' },
      'AMD': { price: 178.90, name: 'AMD Inc.' },
      'JPM': { price: 195.40, name: 'JPMorgan Chase' },
      'V': { price: 279.60, name: 'Visa Inc.' },
      'JNJ': { price: 158.30, name: 'Johnson & Johnson' },
      'WMT': { price: 165.20, name: 'Walmart Inc.' },
      'XOM': { price: 105.80, name: 'Exxon Mobil' },
      'DIS': { price: 112.40, name: 'Walt Disney Co.' },
      'NFLX': { price: 625.50, name: 'Netflix Inc.' },
      'PYPL': { price: 62.30, name: 'PayPal Holdings' },
      'INTC': { price: 42.50, name: 'Intel Corp.' },
      'CRM': { price: 298.40, name: 'Salesforce Inc.' },
      'ORCL': { price: 125.80, name: 'Oracle Corp.' },
      'ADBE': { price: 578.90, name: 'Adobe Inc.' },
      'CSCO': { price: 48.75, name: 'Cisco Systems' },
      'IBM': { price: 185.60, name: 'IBM Corp.' },
      'QCOM': { price: 168.30, name: 'Qualcomm Inc.' },
      'TXN': { price: 172.45, name: 'Texas Instruments' },
      'AVGO': { price: 1345.20, name: 'Broadcom Inc.' },
      'NOW': { price: 785.60, name: 'ServiceNow' },
      'SNOW': { price: 165.40, name: 'Snowflake Inc.' },
      'BAC': { price: 35.80, name: 'Bank of America' },
      'GS': { price: 385.20, name: 'Goldman Sachs' },
      'MA': { price: 458.90, name: 'Mastercard Inc.' },
      'WFC': { price: 58.45, name: 'Wells Fargo' },
      'C': { price: 58.20, name: 'Citigroup Inc.' },
      'MS': { price: 92.80, name: 'Morgan Stanley' },
      'AXP': { price: 225.60, name: 'American Express' },
      'BLK': { price: 785.40, name: 'BlackRock Inc.' },
      'PFE': { price: 28.45, name: 'Pfizer Inc.' },
      'UNH': { price: 525.80, name: 'UnitedHealth' },
      'MRK': { price: 128.90, name: 'Merck & Co.' },
      'ABBV': { price: 178.50, name: 'AbbVie Inc.' },
      'LLY': { price: 785.30, name: 'Eli Lilly' },
      'TMO': { price: 568.40, name: 'Thermo Fisher' },
      'ABT': { price: 118.75, name: 'Abbott Labs' },
      'BMY': { price: 52.30, name: 'Bristol-Myers' },
      'AMGN': { price: 285.60, name: 'Amgen Inc.' },
      'CVX': { price: 155.80, name: 'Chevron Corp.' },
      'COP': { price: 118.45, name: 'ConocoPhillips' },
      'SLB': { price: 52.60, name: 'Schlumberger' },
      'EOG': { price: 125.80, name: 'EOG Resources' },
      'HD': { price: 385.40, name: 'Home Depot' },
      'NKE': { price: 98.50, name: 'Nike Inc.' },
      'MCD': { price: 295.80, name: 'McDonald\'s' },
      'SBUX': { price: 92.40, name: 'Starbucks' },
      'TGT': { price: 168.90, name: 'Target Corp.' },
      'COST': { price: 725.60, name: 'Costco' },
      'LOW': { price: 245.80, name: 'Lowe\'s' },
      'CMCSA': { price: 42.80, name: 'Comcast Corp.' }
    };

    Object.entries(stockData).forEach(([symbol, data]) => {
      const change = (Math.random() - 0.5) * data.price * 0.03;
      const changePercent = (change / data.price) * 100;
      
      this.baseQuotes.set(symbol, {
        symbol,
        price: data.price,
        change,
        changePercent,
        high: data.price * 1.02,
        low: data.price * 0.98,
        open: data.price - change,
        previousClose: data.price - change,
        volume: Math.floor(Math.random() * 50000000) + 1000000,
        timestamp: new Date(),
        bid: data.price - 0.01,
        ask: data.price + 0.01,
        bidSize: Math.floor(Math.random() * 1000) + 100,
        askSize: Math.floor(Math.random() * 1000) + 100
      });
    });

    this.quotesSubject.next(new Map(this.baseQuotes));
  }

  private startRealTimeSimulation(): void {
    // Simulate real-time price updates every 500ms
    interval(500).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updatePrices();
    });

    this.connectionStatusSubject.next(true);
  }

  private updatePrices(): void {
    const quotes = new Map(this.baseQuotes);
    
    quotes.forEach((quote, symbol) => {
      // Random walk with mean reversion
      const volatility = 0.001; // 0.1% per tick
      const randomChange = (Math.random() - 0.5) * 2 * volatility * quote.price;
      
      const newPrice = Math.max(0.01, quote.price + randomChange);
      const totalChange = newPrice - quote.previousClose;
      const totalChangePercent = (totalChange / quote.previousClose) * 100;
      
      // Update bid/ask
      const spread = Math.max(0.01, newPrice * 0.0005);
      
      quotes.set(symbol, {
        ...quote,
        price: newPrice,
        change: totalChange,
        changePercent: totalChangePercent,
        high: Math.max(quote.high, newPrice),
        low: Math.min(quote.low, newPrice),
        bid: newPrice - spread / 2,
        ask: newPrice + spread / 2,
        volume: quote.volume + Math.floor(Math.random() * 10000),
        timestamp: new Date()
      });
    });

    this.baseQuotes = quotes;
    this.quotesSubject.next(quotes);
  }

  // Try to connect to real Finnhub WebSocket
  connectWebSocket(): void {
    if (this.websocket?.readyState === WebSocket.OPEN) return;

    try {
      this.websocket = new WebSocket(`wss://ws.finnhub.io?token=${this.FINNHUB_API_KEY}`);
      
      this.websocket.onopen = () => {
        console.log('Connected to Finnhub WebSocket');
        this.connectionStatusSubject.next(true);
        
        // Subscribe to symbols
        this.subscribedSymbols.forEach(symbol => {
          this.websocket?.send(JSON.stringify({ type: 'subscribe', symbol }));
        });
      };

      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trade' && data.data) {
          data.data.forEach((trade: any) => {
            const existing = this.baseQuotes.get(trade.s);
            if (existing) {
              const newPrice = trade.p;
              const change = newPrice - existing.previousClose;
              const changePercent = (change / existing.previousClose) * 100;
              
              this.baseQuotes.set(trade.s, {
                ...existing,
                price: newPrice,
                change,
                changePercent,
                high: Math.max(existing.high, newPrice),
                low: Math.min(existing.low, newPrice),
                volume: existing.volume + trade.v,
                timestamp: new Date(trade.t)
              });
            }
          });
          this.quotesSubject.next(new Map(this.baseQuotes));
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        console.log('WebSocket closed');
        this.connectionStatusSubject.next(false);
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  subscribeToSymbol(symbol: string): void {
    this.subscribedSymbols.add(symbol);
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  }

  getQuote(symbol: string): LiveQuote | undefined {
    return this.baseQuotes.get(symbol);
  }

  getQuotes(symbols: string[]): LiveQuote[] {
    return symbols
      .map(s => this.baseQuotes.get(s))
      .filter((q): q is LiveQuote => q !== undefined);
  }

  getAllQuotes(): LiveQuote[] {
    return Array.from(this.baseQuotes.values());
  }

  getTopGainers(limit: number = 5): LiveQuote[] {
    return Array.from(this.baseQuotes.values())
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);
  }

  getTopLosers(limit: number = 5): LiveQuote[] {
    return Array.from(this.baseQuotes.values())
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit);
  }

  getMostActive(limit: number = 5): LiveQuote[] {
    return Array.from(this.baseQuotes.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }

  // Get historical candles (simulated for demo)
  getCandles(symbol: string, _resolution: string = 'D', _from?: number, _to?: number): Observable<StockCandle[]> {
    const quote = this.baseQuotes.get(symbol);
    if (!quote) return of([]);

    // Generate simulated historical data
    const candles: StockCandle[] = [];
    const now = Date.now();
    const basePrice = quote.price;
    
    for (let i = 100; i >= 0; i--) {
      const timestamp = now - i * 86400000; // Daily candles
      const volatility = 0.02;
      const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const close = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
      const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
      
      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 50000000) + 1000000
      });
    }

    return of(candles);
  }

  private loadNews(): void {
    // Simulated market news
    const news: MarketNews[] = [
      {
        id: '1',
        headline: 'Tech Stocks Rally on Strong Earnings Reports',
        summary: 'Major technology companies exceeded analyst expectations, driving a broad market rally.',
        source: 'Market Watch',
        url: '#',
        datetime: new Date(),
        related: ['AAPL', 'MSFT', 'GOOGL'],
        sentiment: 'positive'
      },
      {
        id: '2',
        headline: 'Fed Signals Potential Rate Cut in Coming Months',
        summary: 'Federal Reserve officials hint at dovish monetary policy shift amid cooling inflation.',
        source: 'Reuters',
        url: '#',
        datetime: new Date(Date.now() - 3600000),
        related: ['JPM', 'BAC', 'GS'],
        sentiment: 'positive'
      },
      {
        id: '3',
        headline: 'NVIDIA Unveils Next-Gen AI Chips',
        summary: 'New Blackwell architecture promises 30x performance improvement for AI workloads.',
        source: 'TechCrunch',
        url: '#',
        datetime: new Date(Date.now() - 7200000),
        related: ['NVDA', 'AMD', 'INTC'],
        sentiment: 'positive'
      },
      {
        id: '4',
        headline: 'Oil Prices Surge Amid Supply Concerns',
        summary: 'Brent crude jumps 3% as geopolitical tensions threaten global supply chains.',
        source: 'Bloomberg',
        url: '#',
        datetime: new Date(Date.now() - 10800000),
        related: ['XOM', 'CVX', 'COP'],
        sentiment: 'neutral'
      },
      {
        id: '5',
        headline: 'Tesla Expands Supercharger Network',
        summary: 'EV giant announces plans to double charging infrastructure by end of year.',
        source: 'Electrek',
        url: '#',
        datetime: new Date(Date.now() - 14400000),
        related: ['TSLA'],
        sentiment: 'positive'
      },
      {
        id: '6',
        headline: 'Healthcare Sector Under Pressure',
        summary: 'Drug pricing concerns weigh on pharmaceutical stocks ahead of congressional hearings.',
        source: 'CNBC',
        url: '#',
        datetime: new Date(Date.now() - 18000000),
        related: ['PFE', 'JNJ', 'MRK'],
        sentiment: 'negative'
      }
    ];

    this.newsSubject.next(news);

    // Update news periodically
    interval(60000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Rotate news or fetch new
      const currentNews = this.newsSubject.value;
      currentNews.forEach(n => {
        const dt = n.datetime instanceof Date ? n.datetime : new Date(n.datetime);
        n.datetime = new Date(dt.getTime() + 60000);
      });
      this.newsSubject.next([...currentNews]);
    });
  }

  getNews(): Observable<MarketNews[]> {
    return this.news$;
  }

  // Market indices simulation
  getMarketIndices(): { symbol: string; name: string; price: number; change: number; changePercent: number }[] {
    return [
      { symbol: 'SPY', name: 'S&P 500', price: 5078.18 + (Math.random() - 0.5) * 10, change: 12.45, changePercent: 0.25 },
      { symbol: 'QQQ', name: 'NASDAQ 100', price: 17874.52 + (Math.random() - 0.5) * 20, change: 45.23, changePercent: 0.26 },
      { symbol: 'DIA', name: 'DOW 30', price: 38996.39 + (Math.random() - 0.5) * 50, change: 75.86, changePercent: 0.19 },
      { symbol: 'IWM', name: 'Russell 2000', price: 2035.75 + (Math.random() - 0.5) * 5, change: -8.42, changePercent: -0.41 },
      { symbol: 'VIX', name: 'Volatility', price: 14.25 + (Math.random() - 0.5) * 0.5, change: -0.35, changePercent: -2.40 }
    ];
  }
}
