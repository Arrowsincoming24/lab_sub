// Watermark: Aarav Joshi
export interface Order {
  id: number;
  orderRefNumber: string;
  clOrdId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  orderType: string;
  timeInForce: string;
  status: string;
  clientId: string;
  filledQty: number;
  leavesQty: number;
  avgPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionInfo {
  isConnected: boolean;
  acceptorLog: string;
}
