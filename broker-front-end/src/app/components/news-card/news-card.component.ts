// Watermark: Aarav Joshi
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MarketNews } from '../../services/live-market.service';

@Component({
  selector: 'app-news-card',
  template: `
    <div class="news-card" (click)="onClick()">
      <div class="news-sentiment" [class]="news.sentiment || 'neutral'">
        <svg *ngIf="news.sentiment === 'positive'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
        <svg *ngIf="news.sentiment === 'negative'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
          <polyline points="16 17 22 17 22 11"/>
        </svg>
        <svg *ngIf="news.sentiment === 'neutral' || !news.sentiment" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      
      <div class="news-content">
        <h4 class="news-headline">{{ news.headline }}</h4>
        <p class="news-summary">{{ news.summary }}</p>
        
        <div class="news-meta">
          <span class="news-source">{{ news.source }}</span>
          <span class="news-time">{{ getTimeAgo(news.datetime) }}</span>
        </div>
        
        <div class="related-symbols" *ngIf="news.related?.length">
          <span class="symbol-tag" *ngFor="let symbol of news.related.slice(0, 3)" (click)="onSymbolClick($event, symbol)">
            {{ symbol }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .news-card {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .news-card:hover {
      border-color: #c4b5fd;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
      transform: translateX(4px);
    }
    
    .news-sentiment {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .news-sentiment.positive {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .news-sentiment.negative {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .news-sentiment.neutral {
      background: #f3f4f6;
      color: #6b7280;
    }
    
    .news-content {
      flex: 1;
      min-width: 0;
    }
    
    .news-headline {
      margin: 0 0 6px 0;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .news-summary {
      margin: 0 0 10px 0;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .news-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    
    .news-source {
      font-weight: 600;
    }
    
    .related-symbols {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .symbol-tag {
      padding: 3px 8px;
      background: #f3e8ff;
      color: #7c3aed;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .symbol-tag:hover {
      background: #8b5cf6;
      color: white;
    }
  `]
})
export class NewsCardComponent {
  @Input() news!: MarketNews;
  @Output() click = new EventEmitter<MarketNews>();
  @Output() symbolSelect = new EventEmitter<string>();
  
  onClick(): void {
    this.click.emit(this.news);
  }
  
  onSymbolClick(event: Event, symbol: string): void {
    event.stopPropagation();
    this.symbolSelect.emit(symbol);
  }
  
  getTimeAgo(date: Date | string): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}
