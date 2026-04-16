// Watermark: Aarav Joshi
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { PriceChartComponent } from './components/price-chart/price-chart.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { TradeBlotterComponent } from './components/trade-blotter/trade-blotter.component';
import { MarketHeatmapComponent } from './components/market-heatmap/market-heatmap.component';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { CommoditiesTradingComponent } from './components/commodities-trading/commodities-trading.component';
import { PreciousMetalsComponent } from './components/precious-metals/precious-metals.component';

@NgModule({
  declarations: [
    AppComponent,
    PriceChartComponent,
    OrderBookComponent,
    TradeBlotterComponent,
    MarketHeatmapComponent,
    ActivityFeedComponent,
    CommoditiesTradingComponent,
    PreciousMetalsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    CommonModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
