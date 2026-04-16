// Watermark: Aarav Joshi
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { switchMap, startWith, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
  change: number;
  changePercent: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private marketDataSubject = new BehaviorSubject<Map<string, MarketData>>(new Map());
  private securitiesSubject = new BehaviorSubject<Security[]>([]);

  marketData$ = this.marketDataSubject.asObservable();
  securities$ = this.securitiesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSecurities();
    this.startPolling();
  }

  private loadSecurities(): void {
    // Broker frontend fetches from exchange backend via CORS or directly
    this.http.get<Security[]>('/api/securities').pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (securities) => this.securitiesSubject.next(securities),
      error: () => console.error('Failed to load securities')
    });
  }

  private startPolling(): void {
    interval(3000).pipe(
      startWith(0),
      switchMap(() => this.http.get<MarketData[]>('/api/marketdata').pipe(
        catchError(() => of([]))
      ))
    ).subscribe({
      next: (data) => {
        const map = new Map<string, MarketData>();
        data.forEach(md => map.set(md.symbol, md));
        this.marketDataSubject.next(map);
      }
    });
  }

  getSecurities(): Observable<Security[]> {
    return this.http.get<Security[]>('/api/securities');
  }

  getMarketData(): Observable<MarketData[]> {
    return this.http.get<MarketData[]>('/api/marketdata');
  }

  getQuote(symbol: string): MarketData | undefined {
    return this.marketDataSubject.value.get(symbol);
  }
}
