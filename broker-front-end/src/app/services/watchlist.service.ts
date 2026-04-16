// Watermark: Aarav Joshi
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';

export interface PriceAlert {
  id: number;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private watchlist: string[] = [];
  private watchlistSubject = new BehaviorSubject<string[]>([]);
  public watchlist$ = this.watchlistSubject.asObservable();

  private alerts: PriceAlert[] = [];
  private alertsSubject = new BehaviorSubject<PriceAlert[]>([]);
  public alerts$ = this.alertsSubject.asObservable();
  private alertIdCounter = 0;

  constructor(private notificationService: NotificationService) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const savedWatchlist = localStorage.getItem('watchlist');
    if (savedWatchlist) {
      this.watchlist = JSON.parse(savedWatchlist);
      this.watchlistSubject.next([...this.watchlist]);
    }

    const savedAlerts = localStorage.getItem('priceAlerts');
    if (savedAlerts) {
      this.alerts = JSON.parse(savedAlerts).map((a: any) => ({
        ...a,
        createdAt: new Date(a.createdAt)
      }));
      this.alertIdCounter = this.alerts.length > 0 ? Math.max(...this.alerts.map(a => a.id)) : 0;
      this.alertsSubject.next([...this.alerts]);
    }
  }

  private saveToStorage(): void {
    localStorage.setItem('watchlist', JSON.stringify(this.watchlist));
    localStorage.setItem('priceAlerts', JSON.stringify(this.alerts));
  }

  // Watchlist Methods
  addToWatchlist(symbol: string): boolean {
    if (!this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
      this.watchlistSubject.next([...this.watchlist]);
      this.saveToStorage();
      this.notificationService.success('Watchlist', `${symbol} added to watchlist`);
      return true;
    }
    return false;
  }

  removeFromWatchlist(symbol: string): void {
    this.watchlist = this.watchlist.filter(s => s !== symbol);
    this.watchlistSubject.next([...this.watchlist]);
    this.saveToStorage();
    this.notificationService.info('Watchlist', `${symbol} removed from watchlist`);
  }

  isInWatchlist(symbol: string): boolean {
    return this.watchlist.includes(symbol);
  }

  toggleWatchlist(symbol: string): void {
    if (this.isInWatchlist(symbol)) {
      this.removeFromWatchlist(symbol);
    } else {
      this.addToWatchlist(symbol);
    }
  }

  // Price Alert Methods
  addAlert(symbol: string, targetPrice: number, condition: 'above' | 'below'): PriceAlert {
    const alert: PriceAlert = {
      id: ++this.alertIdCounter,
      symbol,
      targetPrice,
      condition,
      triggered: false,
      createdAt: new Date()
    };
    this.alerts.push(alert);
    this.alertsSubject.next([...this.alerts]);
    this.saveToStorage();
    this.notificationService.success('Price Alert', `Alert set for ${symbol} ${condition} $${targetPrice.toFixed(2)}`);
    return alert;
  }

  removeAlert(id: number): void {
    this.alerts = this.alerts.filter(a => a.id !== id);
    this.alertsSubject.next([...this.alerts]);
    this.saveToStorage();
  }

  clearTriggeredAlerts(): void {
    this.alerts = this.alerts.filter(a => !a.triggered);
    this.alertsSubject.next([...this.alerts]);
    this.saveToStorage();
  }

  checkAlerts(marketData: { symbol: string; lastPrice: number }[]): void {
    const triggered: PriceAlert[] = [];

    this.alerts.forEach(alert => {
      if (alert.triggered) return;

      const data = marketData.find(m => m.symbol === alert.symbol);
      if (!data) return;

      const shouldTrigger = 
        (alert.condition === 'above' && data.lastPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && data.lastPrice <= alert.targetPrice);

      if (shouldTrigger) {
        alert.triggered = true;
        triggered.push(alert);
      }
    });

    if (triggered.length > 0) {
      this.alertsSubject.next([...this.alerts]);
      this.saveToStorage();

      triggered.forEach(alert => {
        const marketItem = marketData.find(m => m.symbol === alert.symbol);
        this.notificationService.warning(
          'Price Alert Triggered!',
          `${alert.symbol} is now ${alert.condition} $${alert.targetPrice.toFixed(2)} (Current: $${marketItem?.lastPrice.toFixed(2)})`,
          10000
        );
      });
    }
  }

  getActiveAlerts(): PriceAlert[] {
    return this.alerts.filter(a => !a.triggered);
  }

  getTriggeredAlerts(): PriceAlert[] {
    return this.alerts.filter(a => a.triggered);
  }
}
