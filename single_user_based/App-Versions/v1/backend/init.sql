-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'readonly')),
    is_active BOOLEAN DEFAULT TRUE,
    allowed_tabs INTEGER[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabs table
CREATE TABLE IF NOT EXISTS tabs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IPs table
CREATE TABLE IF NOT EXISTS ips (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    ports VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    note TEXT,
    tab_id INTEGER REFERENCES tabs(id) ON DELETE SET NULL,
    created_by VARCHAR(50),
    last_updated_by VARCHAR(50),
    subnet VARCHAR(45) DEFAULT '',
    cidr VARCHAR(10) DEFAULT '',
    last_checked TIMESTAMP,
    last_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index for IPs to prevent duplicates (IP + Subnet + CIDR)
CREATE UNIQUE INDEX IF NOT EXISTS ips_unique_idx ON ips (ip, COALESCE(subnet, ''), COALESCE(cidr, ''));

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- System logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Settings
INSERT INTO settings (key, value) VALUES 
('ping_interval', '3'),
('auto_ping_enabled', 'false')
ON CONFLICT DO NOTHING;
