// Watermark: Aarav Joshi
import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, ColorType } from 'lightweight-charts';

@Component({
  selector: 'app-price-chart',
  template: `
    <div class="chart-container">
      <div class="chart-header">
        <div class="chart-symbol">
          <span class="symbol">{{ symbol }}</span>
          <span class="price" [class.positive]="priceChange >= 0" [class.negative]="priceChange < 0">
            \${{ currentPrice | number:'1.2-2' }}
          </span>
          <span class="change" [class.positive]="priceChange >= 0" [class.negative]="priceChange < 0">
            {{ priceChange >= 0 ? '+' : '' }}{{ priceChange | number:'1.2-2' }}%
          </span>
        </div>
        <div class="chart-controls">
          <div class="timeframe-selector">
            <button *ngFor="let tf of timeframes" 
                    [class.active]="selectedTimeframe === tf.value"
                    (click)="changeTimeframe(tf.value)">
              {{ tf.label }}
            </button>
          </div>
          <div class="chart-type-selector">
            <button [class.active]="chartType === 'candle'" (click)="setChartType('candle')" title="Candlestick">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="4" width="4" height="16" rx="1"/>
                <rect x="15" y="8" width="4" height="8" rx="1"/>
                <line x1="7" y1="2" x2="7" y2="4"/>
                <line x1="7" y1="20" x2="7" y2="22"/>
                <line x1="17" y1="6" x2="17" y2="8"/>
                <line x1="17" y1="16" x2="17" y2="18"/>
              </svg>
            </button>
            <button [class.active]="chartType === 'line'" (click)="setChartType('line')" title="Line">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div #chartContainer class="chart-canvas"></div>
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-dot high"></span>
          <span>High: \${{ high | number:'1.2-2' }}</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot low"></span>
          <span>Low: \${{ low | number:'1.2-2' }}</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot volume"></span>
          <span>Vol: {{ volume | number:'1.0-0' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      background: #0d1117;
      border-radius: 12px;
      border: 1px solid #21262d;
      overflow: hidden;
    }
    
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #21262d;
    }
    
    .chart-symbol {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .symbol {
      font-size: 20px;
      font-weight: 700;
      color: #e6edf3;
    }
    
    .price {
      font-size: 24px;
      font-weight: 700;
      font-family: 'SF Mono', monospace;
    }
    
    .change {
      font-size: 14px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
    }
    
    .positive {
      color: #3fb950;
      background: rgba(63, 185, 80, 0.15);
    }
    
    .negative {
      color: #f85149;
      background: rgba(248, 81, 73, 0.15);
    }
    
    .chart-controls {
      display: flex;
      gap: 16px;
    }
    
    .timeframe-selector, .chart-type-selector {
      display: flex;
      gap: 4px;
      background: #161b22;
      padding: 4px;
      border-radius: 8px;
    }
    
    .timeframe-selector button, .chart-type-selector button {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: #8b949e;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .chart-type-selector button {
      padding: 6px 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .timeframe-selector button:hover, .chart-type-selector button:hover {
      color: #e6edf3;
    }
    
    .timeframe-selector button.active, .chart-type-selector button.active {
      background: #238636;
      color: white;
    }
    
    .chart-canvas {
      height: 350px;
    }
    
    .chart-legend {
      display: flex;
      gap: 24px;
      padding: 12px 20px;
      border-top: 1px solid #21262d;
      background: #161b22;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #8b949e;
    }
    
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    .legend-dot.high { background: #3fb950; }
    .legend-dot.low { background: #f85149; }
    .legend-dot.volume { background: #58a6ff; }
  `]
})
export class PriceChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() symbol = 'AAPL';
  @Input() data: any[] = [];
  @Input() spotPrice = 0;
  @Input() spotChangePercent = 0;
  @Input() spotVolume = 0;
  
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  
  currentPrice = 0;
  priceChange = 0;
  high = 0;
  low = 0;
  volume = 0;
  
  chartType: 'candle' | 'line' = 'candle';
  selectedTimeframe = '1D';

  private readonly timeframeConfig: Record<string, { points: number; intervalMinutes: number; volatility: number }> = {
    '1H': { points: 60, intervalMinutes: 1, volatility: 0.004 },
    '4H': { points: 48, intervalMinutes: 5, volatility: 0.007 },
    '1D': { points: 78, intervalMinutes: 10, volatility: 0.012 },
    '1W': { points: 70, intervalMinutes: 60, volatility: 0.018 },
    '1M': { points: 60, intervalMinutes: 240, volatility: 0.025 },
  };
  
  timeframes = [
    { label: '1H', value: '1H' },
    { label: '4H', value: '4H' },
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' }
  ];
  
  ngOnInit(): void {
    this.initChart();
    this.generateMockData();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['symbol'] && !changes['symbol'].firstChange) ||
        (changes['spotPrice'] && !changes['spotPrice'].firstChange) ||
        (changes['spotChangePercent'] && !changes['spotChangePercent'].firstChange) ||
        (changes['spotVolume'] && !changes['spotVolume'].firstChange)) {
      this.generateMockData();
    }
  }
  
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
  
  private initChart(): void {
    this.chart = createChart(this.chartContainer.nativeElement, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#58a6ff', width: 1, style: 2 },
        horzLine: { color: '#58a6ff', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#21262d',
      },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149',
    });
    
    this.lineSeries = this.chart.addLineSeries({
      color: '#58a6ff',
      lineWidth: 2,
      visible: false,
    });
    
    this.volumeSeries = this.chart.addHistogramSeries({
      color: '#58a6ff',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    
    this.chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
  }
  
  private generateMockData(): void {
    const liveSpot = this.resolveLiveSpot();
    const liveVolume = this.resolveLiveVolume();
    const timeframe = this.getSelectedTimeframeConfig();
    const seed = this.hashSeed(`${this.symbol}:${this.selectedTimeframe}`);
    const { candleData, volumeData } = this.buildChartSeries(liveSpot, liveVolume, timeframe, seed);

    if (this.candleSeries) this.candleSeries.setData(candleData);
    if (this.lineSeries) {
      this.lineSeries.setData(candleData.map((c) => ({ time: c.time, value: c.close })));
    }
    if (this.volumeSeries) this.volumeSeries.setData(volumeData);

    const firstCandle = candleData[0];
    const lastCandle = candleData[candleData.length - 1];
    this.currentPrice = liveSpot > 0 ? liveSpot : lastCandle.close;
    this.priceChange = Math.abs(this.spotChangePercent) > Number.EPSILON
      ? this.spotChangePercent
      : ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
    this.high = Math.max(...candleData.map((c) => c.high));
    this.low = Math.min(...candleData.map((c) => c.low));
    this.volume = liveVolume > 0
      ? liveVolume
      : volumeData.reduce((sum, v) => sum + v.value, 0) / volumeData.length;

    this.chart?.timeScale().fitContent();
  }

  private resolveLiveSpot(): number {
    return this.spotPrice > 0 ? this.spotPrice : 150 + Math.random() * 50;
  }

  private resolveLiveVolume(): number {
    return this.spotVolume > 0 ? this.spotVolume : Math.floor(1000000 + Math.random() * 5000000);
  }

  private getSelectedTimeframeConfig(): { points: number; intervalMinutes: number; volatility: number } {
    return this.timeframeConfig[this.selectedTimeframe] || this.timeframeConfig['1D'];
  }

  private buildChartSeries(
    liveSpot: number,
    liveVolume: number,
    timeframe: { points: number; intervalMinutes: number; volatility: number },
    seed: number,
  ): { candleData: CandlestickData[]; volumeData: HistogramData[] } {
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];
    const now = Date.now();
    const drift = this.spotChangePercent / 100;
    const startPrice = liveSpot * (1 - drift);
    const pointCount = Math.max(12, timeframe.points);
    const intervalMs = timeframe.intervalMinutes * 60_000;

    for (let i = 0; i < pointCount; i++) {
      const time = Math.trunc((now - (pointCount - i - 1) * intervalMs) / 1000) as any;
      const progress = pointCount > 1 ? i / (pointCount - 1) : 1;
      const trendPrice = startPrice + (liveSpot - startPrice) * progress;
      const phase = (seed % 997) / 997 + i * 0.35;
      const wiggle = Math.sin(phase) * timeframe.volatility * trendPrice * 0.35;
      const open = trendPrice - wiggle * 0.45;
      const close = i === pointCount - 1 ? liveSpot : trendPrice + wiggle * 0.45;
      const high = Math.max(open, close) + Math.abs(wiggle) * 0.55;
      const low = Math.min(open, close) - Math.abs(wiggle) * 0.55;
      const volumeSwing = 0.65 + ((seed + i * 17) % 35) / 100;
      const vol = Math.max(1, Math.floor((liveVolume * volumeSwing / pointCount) * 4));

      candleData.push({ time, open, high, low, close });
      volumeData.push({
        time,
        value: vol,
        color: close >= open ? 'rgba(63, 185, 80, 0.5)' : 'rgba(248, 81, 73, 0.5)',
      });
    }

    if (candleData.length > 0) {
      const last = candleData[candleData.length - 1];
      candleData[candleData.length - 1] = {
        ...last,
        close: liveSpot,
        high: Math.max(last.high, last.open, liveSpot),
        low: Math.min(last.low, last.open, liveSpot),
      };
    }

    return { candleData, volumeData };
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (const character of value) {
      hash = Math.trunc(hash * 31 + (character.codePointAt(0) || 0));
    }
    return Math.abs(hash);
  }
  
  setChartType(type: 'candle' | 'line'): void {
    this.chartType = type;
    if (this.candleSeries) this.candleSeries.applyOptions({ visible: type === 'candle' });
    if (this.lineSeries) this.lineSeries.applyOptions({ visible: type === 'line' });
  }
  
  changeTimeframe(tf: string): void {
    this.selectedTimeframe = tf;
    this.generateMockData();
  }
}
