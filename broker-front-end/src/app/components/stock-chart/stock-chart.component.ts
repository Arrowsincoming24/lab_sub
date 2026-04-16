// Watermark: Aarav Joshi
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time, ColorType } from 'lightweight-charts';

export interface ChartDataPoint {
  time: Time;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  value?: number;
}

@Component({
  selector: 'app-stock-chart',
  template: `
    <div class="chart-wrapper">
      <div class="chart-header">
        <div class="chart-symbol">{{ symbol }}</div>
        <div class="chart-price" [class.positive]="priceChange >= 0" [class.negative]="priceChange < 0">
          <span class="current-price">\${{ currentPrice | number:'1.2-2' }}</span>
          <span class="price-change">
            {{ priceChange >= 0 ? '+' : '' }}{{ priceChange | number:'1.2-2' }} 
            ({{ priceChangePercent >= 0 ? '+' : '' }}{{ priceChangePercent | number:'1.2-2' }}%)
          </span>
        </div>
        <div class="time-controls">
          <button *ngFor="let tf of timeframes" 
                  [class.active]="selectedTimeframe === tf.value"
                  (click)="changeTimeframe(tf.value)">
            {{ tf.label }}
          </button>
        </div>
        <div class="chart-type-controls">
          <button [class.active]="chartType === 'candlestick'" (click)="setChartType('candlestick')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5v14M9 9h3M9 15h3M15 9h3M15 15h3M15 2v20"/>
            </svg>
          </button>
          <button [class.active]="chartType === 'line'" (click)="setChartType('line')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div #chartContainer class="chart-container"></div>
      <div class="chart-footer">
        <div class="chart-stats">
          <div class="stat">
            <span class="label">Open</span>
            <span class="value">\${{ dayOpen | number:'1.2-2' }}</span>
          </div>
          <div class="stat">
            <span class="label">High</span>
            <span class="value positive">\${{ dayHigh | number:'1.2-2' }}</span>
          </div>
          <div class="stat">
            <span class="label">Low</span>
            <span class="value negative">\${{ dayLow | number:'1.2-2' }}</span>
          </div>
          <div class="stat">
            <span class="label">Vol</span>
            <span class="value">{{ volume | number:'1.0-0' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-wrapper {
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .chart-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .chart-symbol {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }
    
    .chart-price {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    
    .current-price {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    
    .price-change {
      font-size: 14px;
      font-weight: 600;
    }
    
    .chart-price.positive .price-change { color: #10b981; }
    .chart-price.negative .price-change { color: #ef4444; }
    
    .time-controls {
      display: flex;
      gap: 4px;
      margin-left: auto;
    }
    
    .time-controls button, .chart-type-controls button {
      padding: 6px 12px;
      border: none;
      background: #f3f4f6;
      color: #6b7280;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .time-controls button:hover, .chart-type-controls button:hover {
      background: #e5e7eb;
      color: #374151;
    }
    
    .time-controls button.active, .chart-type-controls button.active {
      background: #8b5cf6;
      color: white;
    }
    
    .chart-type-controls {
      display: flex;
      gap: 4px;
    }
    
    .chart-type-controls button {
      padding: 6px 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .chart-container {
      flex: 1;
      min-height: 300px;
    }
    
    .chart-footer {
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
      background: #fafafa;
    }
    
    .chart-stats {
      display: flex;
      gap: 24px;
    }
    
    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .stat .label {
      font-size: 11px;
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .stat .value {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      font-family: 'SF Mono', 'Consolas', monospace;
    }
    
    .stat .value.positive { color: #10b981; }
    .stat .value.negative { color: #ef4444; }
  `]
})
export class StockChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  
  @Input() symbol: string = 'AAPL';
  @Input() data: ChartDataPoint[] = [];
  @Input() currentPrice: number = 0;
  @Input() priceChange: number = 0;
  @Input() priceChangePercent: number = 0;
  @Input() dayOpen: number = 0;
  @Input() dayHigh: number = 0;
  @Input() dayLow: number = 0;
  @Input() volume: number = 0;
  
  chartType: 'candlestick' | 'line' = 'candlestick';
  selectedTimeframe = '1D';
  
  timeframes = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '1Y', value: '1Y' },
    { label: 'ALL', value: 'ALL' }
  ];
  
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  
  ngOnInit(): void {
    this.initChart();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.chart) {
      this.updateChartData();
    }
  }
  
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
  
  private initChart(): void {
    const container = this.chartContainer.nativeElement;
    
    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#6b7280',
      },
      width: container.clientWidth,
      height: 300,
      grid: {
        vertLines: { color: '#f3f4f6' },
        horzLines: { color: '#f3f4f6' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#8b5cf6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#8b5cf6',
        },
        horzLine: {
          color: '#8b5cf6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#8b5cf6',
        },
      },
      timeScale: {
        borderColor: '#e5e7eb',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#e5e7eb',
      },
    });
    
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    
    this.lineSeries = this.chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 2,
      visible: false,
    });
    
    this.updateChartData();
    
    // Handle resize
    new ResizeObserver(() => {
      if (this.chart) {
        this.chart.applyOptions({ width: container.clientWidth });
      }
    }).observe(container);
  }
  
  private updateChartData(): void {
    if (!this.chart || !this.data.length) return;
    
    if (this.chartType === 'candlestick' && this.candleSeries) {
      const candleData: CandlestickData[] = this.data
        .filter(d => d.open !== undefined)
        .map(d => ({
          time: d.time,
          open: d.open!,
          high: d.high!,
          low: d.low!,
          close: d.close!,
        }));
      this.candleSeries.setData(candleData);
    }
    
    if (this.lineSeries) {
      const lineData: LineData[] = this.data.map(d => ({
        time: d.time,
        value: d.close || d.value || 0,
      }));
      this.lineSeries.setData(lineData);
    }
  }
  
  setChartType(type: 'candlestick' | 'line'): void {
    this.chartType = type;
    
    if (this.candleSeries) {
      this.candleSeries.applyOptions({ visible: type === 'candlestick' });
    }
    if (this.lineSeries) {
      this.lineSeries.applyOptions({ visible: type === 'line' });
    }
  }
  
  changeTimeframe(tf: string): void {
    this.selectedTimeframe = tf;
    // Emit event to parent to fetch new data
  }
}
