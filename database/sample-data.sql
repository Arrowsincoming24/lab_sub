-- Sample data for testing

-- Insert sample securities
INSERT INTO security_master (symbol, security_name, security_type, exchange, currency, tick_size, lot_size) 
VALUES 
('AAPL', 'Apple Inc.', 'EQUITY', 'NASDAQ', 'USD', 0.01, 100),
('MSFT', 'Microsoft Corporation', 'EQUITY', 'NASDAQ', 'USD', 0.01, 100),
('GOOGL', 'Alphabet Inc.', 'EQUITY', 'NASDAQ', 'USD', 0.01, 100),
('AMZN', 'Amazon.com Inc.', 'EQUITY', 'NASDAQ', 'USD', 0.01, 100);

-- Insert sample customers
INSERT INTO customer_master (customer_id, customer_name, email, phone) 
VALUES 
('C001', 'John Doe', 'john@example.com', '555-0001'),
('C002', 'Jane Smith', 'jane@example.com', '555-0002'),
('C003', 'Bob Johnson', 'bob@example.com', '555-0003');
