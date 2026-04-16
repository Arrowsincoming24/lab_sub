-- PostgreSQL Database Schema for FIX Trading Simulator

-- Create database
CREATE DATABASE IF NOT EXISTS fix_trading_simulator;

-- Use the database
\c fix_trading_simulator;

-- Security Master table
CREATE TABLE IF NOT EXISTS security_master (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    security_name VARCHAR(255),
    security_type VARCHAR(50),
    exchange VARCHAR(50),
    currency VARCHAR(3),
    tick_size NUMERIC(10, 4),
    lot_size BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Master table
CREATE TABLE IF NOT EXISTS customer_master (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_ref_number VARCHAR(50) NOT NULL UNIQUE,
    cl_ord_id VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(10) NOT NULL,
    side CHAR(1) NOT NULL,
    quantity BIGINT NOT NULL,
    price NUMERIC(15, 4),
    order_type VARCHAR(10),
    time_in_force VARCHAR(10),
    status VARCHAR(50),
    client_id VARCHAR(50),
    filled_qty BIGINT DEFAULT 0,
    leaves_qty BIGINT,
    avg_price NUMERIC(15, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES security_master(symbol),
    FOREIGN KEY (client_id) REFERENCES customer_master(customer_id)
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(50) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    side CHAR(1),
    quantity BIGINT,
    price NUMERIC(15, 4),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (symbol) REFERENCES security_master(symbol)
);

-- Event Log table
CREATE TABLE IF NOT EXISTS event_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_message TEXT,
    order_ref_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_ref_number) REFERENCES orders(order_ref_number)
);

-- Messages table (for FIX message logging)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    msg_type VARCHAR(10),
    sender_comp_id VARCHAR(50),
    target_comp_id VARCHAR(50),
    msg_seq_num BIGINT,
    msg_content TEXT,
    direction VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
CREATE INDEX idx_event_log_order_ref ON event_log(order_ref_number);
CREATE INDEX idx_event_log_created_at ON event_log(created_at);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_direction ON messages(direction);
