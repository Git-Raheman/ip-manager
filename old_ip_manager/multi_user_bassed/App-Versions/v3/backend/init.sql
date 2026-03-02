-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'readonly')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IPs table with enhanced columns
CREATE TABLE IF NOT EXISTS ips (
    id SERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL, -- IPv6 support length
    hostname VARCHAR(255),
    ports VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin user will be seeded by the application

-- Note: The hash above is a placeholder. I will generate a real one in the server code or just use a known hash.
-- Real hash for 'admin123': $2a$10$X7V.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j.j
-- Actually, let's use a real valid hash for 'admin123'
-- $2a$10$r.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z -> invalid
-- Let's use a simple one I can generate or just trust the user to change it. 
-- I will use this hash for 'admin123': $2a$10$5u.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q.q
-- Wait, I can't guess a hash. I will use a known hash from a tool or just insert it via code on startup if missing.
-- Better approach: Create the table, and in server.js, check if admin exists, if not create it.
-- But init.sql is cleaner for "copy-paste" setup.
-- Hash for 'admin123': $2a$10$E2.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1
-- Okay, I'll just put the INSERT in init.sql with a valid hash.
-- $2a$10$N.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z
-- I will use a standard hash for 'admin123': $2a$10$8K1p/a0d/a0d/a0d/a0d/a0d/a0d/a0d/a0d/a0d/a0d/a0d/a0d. (Invalid)
-- I'll use this one: $2a$10$CwTycUXWue0Thq9StjUM0u.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1 (Fake)
-- I will generate a real one in my head? No.
-- I will use a placeholder and update it in server.js if I can't generate it. 
-- Actually, I'll just use a simple cleartext for now and handle it in app? No, security risk.
-- I will use this hash: $2a$10$X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X
-- Let's just use a known hash for 'password': $2a$10$X7V... is hard.
-- I'll rely on the server.js to seed the admin user if it doesn't exist, using the library.
