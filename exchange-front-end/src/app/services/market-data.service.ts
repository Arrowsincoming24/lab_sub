// Watermark: Aarav Joshi
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, interval } from 'rxjs';
import { map, catchError, switchMap, startWith } from 'rxjs/operators';

export interface Security {
  symbol: string;
  name: string;
  sector: string;
  securityType: string;
  currency: string;
  lotSize: number;
  tickSize: number;
  maxOrderSize: number;
  tradeable: boolean;
}

export interface MarketData {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface OptionPrice {
  symbol: string;
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  impliedVol: number;
  intrinsicValue: number;
  timeValue: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private marketDataSubject = new BehaviorSubject<Map<string, MarketData>>(new Map());
  private securitiesSubject = new BehaviorSubject<Security[]>([]);
  private wsConnection: WebSocket | null = null;

  marketData$ = this.marketDataSubject.asObservable();
  securities$ = this.securitiesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSecurities();
    this.startPolling();
    this.connectWebSocket();
  }

  private loadSecurities(): void {
    this.http.get<Security[]>('/api/securities').subscribe({
      next: (securities) => this.securitiesSubject.next(securities),
      error: (err) => console.error('Failed to load securities', err)
    });
  }

  private startPolling(): void {
    interval(2000).pipe(
      startWith(0),
      switchMap(() => this.http.get<MarketData[]>('/api/marketdata'))
    ).subscribe({
      next: (data) => {
        const map = new Map<string, MarketData>();
        data.forEach(md => map.set(md.symbol, md));
        this.marketDataSubject.next(map);
      },
      error: (err) => console.error('Market data poll failed', err)
    });
  }

  private connectWebSocket(): void {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      this.wsConnection = new WebSocket(`${protocol}//${host}:8090/ws/aggregator`);

      this.wsConnection.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'marketData' || update.symbol) {
            const currentData = this.marketDataSubject.value;
            currentData.set(update.symbol, update);
            this.marketDataSubject.next(new Map(currentData));
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.wsConnection.onerror = () => {
        console.log('WebSocket connection failed, using polling');
      };

      this.wsConnection.onclose = () => {
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (e) {
      console.log('WebSocket not available, using polling');
    }
  }

  getSecurities(): Observable<Security[]> {
    return this.http.get<Security[]>('/api/securities');
  }

  getAllMarketData(): Observable<MarketData[]> {
    return this.http.get<MarketData[]>('/api/marketdata');
  }

  getMarketDataForSymbol(symbol: string): Observable<MarketData> {
    return this.http.get<MarketData>(`/api/marketdata/${symbol}`);
  }

  getOptionPrice(symbol: string, strike: number, expiry: string, isCall: boolean): Observable<OptionPrice> {
    const optionType = isCall ? 'CALL' : 'PUT';
    return this.http.get<OptionPrice>(`/api/options/price?symbol=${symbol}&strike=${strike}&expiry=${expiry}&optionType=${optionType}`);
  }

  getSecuritiesBySector(sector: string): Observable<Security[]> {
    return this.http.get<Security[]>(`/api/securities/sector/${sector}`);
  }

  getSecuritiesByType(type: string): Observable<Security[]> {
    return this.http.get<Security[]>(`/api/securities/type/${type}`);
  }
}
