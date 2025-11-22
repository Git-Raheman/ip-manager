const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangeinproduction';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
};

// Seed Admin User
const seedAdmin = async () => {
  try {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (res.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
      console.log('Admin user created: admin / admin123');
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Auth Routes ---

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, role: user.role, username: user.username });
    } else {
      res.status(403).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- User Management Routes (Admin Only) ---

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  if (!['admin', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error or username exists' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- IP Routes ---

app.get('/api/ips', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ips ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ips', authenticateToken, requireAdmin, async (req, res) => {
  const { ip, hostname, ports, status, note } = req.body;

  // Strict IP Validation (IPv4)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ip || !ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });

  try {
    const result = await pool.query(
      'INSERT INTO ips (ip, hostname, ports, status, note) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ip, hostname || '', ports || '', status || 'active', note || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/ips/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { ip, hostname, ports, status, note } = req.body;

  if (ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });
  }

  try {
    const result = await pool.query(
      'UPDATE ips SET ip = COALESCE($1, ip), hostname = COALESCE($2, hostname), ports = COALESCE($3, ports), status = COALESCE($4, status), note = COALESCE($5, note) WHERE id = $6 RETURNING *',
      [ip, hostname, ports, status, note, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/ips/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ips WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Bulk delete IPs
app.post('/api/ips/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty IDs array' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `DELETE FROM ips WHERE id IN (${placeholders}) RETURNING id`,
      ids
    );
    res.json({ message: `Deleted ${result.rows.length} records`, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ping', authenticateToken, (req, res) => {
  const { ip } = req.body;

  // Basic validation: Hostname or IP
  const isValid = /^[a-zA-Z0-9.-]+$/.test(ip);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid IP/Hostname format' });
  }

  execFile('ping', ['-c', '3', ip], (error, stdout, stderr) => {
    const raw = stdout + stderr;
    const alive = !error;

    const lossMatch = raw.match(/(\d+)% packet loss/);
    const packetLoss = lossMatch ? parseInt(lossMatch[1]) : 100;

    const rttMatch = raw.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
    const avgLatencyMs = rttMatch ? parseFloat(rttMatch[1]) : null;

    res.json({
      ip,
      alive,
      packetLoss,
      avgLatencyMs,
      raw
    });
  });
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'readonly')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create IPs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ips (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        hostname VARCHAR(255),
        ports VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if missing (Migration)
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS ports VARCHAR(255)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS note TEXT`);

    // Fix bad admin hash from previous init.sql if exists
    await client.query(`DELETE FROM users WHERE username = 'admin' AND password LIKE '$2a$10$x.pb%'`);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Init DB error', e);
  } finally {
    client.release();
  }
};

const server = app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  // Give DB a moment to be fully ready
  setTimeout(async () => {
    await initDB();
    await seedAdmin();
  }, 2000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
    });
  });
});
