// Watermark: Aarav Joshi
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { StockChartComponent } from './components/stock-chart/stock-chart.component';
import { MarketCardComponent } from './components/market-card/market-card.component';
import { OrderFormComponent } from './components/order-form/order-form.component';
import { NewsCardComponent } from './components/news-card/news-card.component';
import { PositionCardComponent } from './components/position-card/position-card.component';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { BrokerCommoditiesComponent } from './components/broker-commodities/broker-commodities.component';

@NgModule({
  declarations: [
    AppComponent,
    StockChartComponent,
    MarketCardComponent,
    OrderFormComponent,
    NewsCardComponent,
    PositionCardComponent,
    OrdersTableComponent,
    BrokerCommoditiesComponent
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
