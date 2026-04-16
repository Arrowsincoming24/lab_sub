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

export interface Trade {
  id: number;
  tradeId: string;
  orderId: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  executedAt: Date;
}

export interface ExecutionReport {
  clOrdId: string;
  orderId: string;
  ordStatus: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  filledQty: number;
  leavesQty: number;
  avgPrice: number;
  executionId: string;
  transactTime: string;
}

export interface SessionStatus {
  sessionId: string;
  isLoggedOn: boolean;
  connected: boolean;
  senderCompId: string;
  targetCompId: string;
  lastMessageTime: Date;
}

export interface QuickFixResponseRequest {
  clOrdId: string;
  responseType: 'ACK' | 'STATUS' | 'CANCEL' | 'REJECT';
  text?: string;
}

export interface QuickFixResponseResult {
  success: boolean;
  responseType: string;
  clOrdId: string;
  message: string;
}

export interface SessionEvent {
  type: string;
  message: string;
  timestamp: number;
}
