// Watermark: Aarav Joshi
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Order, Trade, SessionStatus, QuickFixResponseRequest, QuickFixResponseResult, SessionEvent } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  private apiUrl = '/api/orders';
  private orderUpdates = new Subject<Order>();

  constructor(private http: HttpClient) {
    this.initWebSocket();
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  getOrder(clOrdId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${clOrdId}`);
  }

  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, order);
  }

  cancelOrder(clOrdId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${clOrdId}`);
  }

  getTrades(): Observable<Trade[]> {
    return this.http.get<Trade[]>('/api/trades');
  }

  getSessionStatus(): Observable<SessionStatus> {
    return this.http.get<SessionStatus>('/api/session');
  }

  sendQuickFixResponse(request: QuickFixResponseRequest): Observable<QuickFixResponseResult> {
    return this.http.post<QuickFixResponseResult>('/api/session/respond', request);
  }

  getSessionEvents(limit = 20): Observable<SessionEvent[]> {
    return this.http.get<SessionEvent[]>(`/api/session/events?limit=${limit}`);
  }

  orderUpdates$(): Observable<Order> {
    return this.orderUpdates.asObservable();
  }

  private initWebSocket(): void {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/socket/order`);

      ws.onmessage = (event) => {
        const order = JSON.parse(event.data);
        this.orderUpdates.next(order);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket closed, attempting to reconnect...');
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (error) {
      console.error('WebSocket initialization error:', error);
    }
  }
}
