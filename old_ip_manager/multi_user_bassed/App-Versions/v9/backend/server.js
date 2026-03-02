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
app.set('trust proxy', 1); // Trust first proxy (Nginx)
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000 // Increased to prevent lockout on rapid refresh
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
      if (user.is_active === false) {
        return res.status(403).json({ error: 'Your account has been disabled by admin.' });
      }
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
    const result = await pool.query('SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC');
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

// Admin: Update User Password
app.put('/api/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin: Enable/Disable User
app.put('/api/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Prevent disabling self
  if (parseInt(id) === req.user.id && !is_active) {
    return res.status(400).json({ error: 'Cannot disable your own account' });
  }

  try {
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
    res.json({ message: `User ${is_active ? 'enabled' : 'disabled'} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Authenticated User: Update Own Password
app.put('/api/profile/password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(403).json({ error: 'Incorrect old password' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Tab Routes ---

app.get('/api/tabs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tabs ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tabs', authenticateToken, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Tab name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO tabs (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Tab name already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/tabs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tabs WHERE id = $1', [id]);
    res.json({ message: 'Tab deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- IP Routes ---

app.get('/api/ips', authenticateToken, async (req, res) => {
  const { page = 1, limit = 50, search = '', tab_id = 'all' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = 'SELECT * FROM ips';
    let countQuery = 'SELECT COUNT(*) FROM ips';
    const params = [];
    const conditions = [];

    // Search Filter
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ip ILIKE $${params.length} OR hostname ILIKE $${params.length} OR note ILIKE $${params.length} OR status ILIKE $${params.length})`);
    }

    // Tab Filter
    if (tab_id !== 'all') {
      params.push(tab_id);
      conditions.push(`tab_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    // Execute Count
    const countResult = await pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    // Execute Data Query
    const result = await pool.query(query, [...params, limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ips', authenticateToken, requireAdmin, async (req, res) => {
  let { ip, hostname, ports, status, note, tab_id } = req.body;
  const username = req.user.username;

  // Strict IP Validation (IPv4)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ip || !ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });

  // Subnet Validation (Optional)
  if (req.body.subnet && !ipRegex.test(req.body.subnet)) {
    return res.status(400).json({ error: 'Invalid Subnet format' });
  }

  // CIDR Validation (Optional)
  if (req.body.cidr) {
    const cidrRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!cidrRegex.test(req.body.cidr)) {
      return res.status(400).json({ error: 'Invalid CIDR format (e.g. /24)' });
    }
  }

  // Auto-Ping Logic
  let last_status = null;
  // If status is not explicitly provided or is default, we determine it via ping
  // Even if provided, we should populate last_status and last_checked
  try {
    const isAlive = await pingHost(ip);
    last_status = isAlive ? 'UP' : 'DOWN';

    // If user didn't specify status (or sent empty/null), set based on ping
    if (!status || status === 'active') { // 'active' is default in schema but maybe we want to be smart
      status = isAlive ? 'active' : 'inactive';
    }
  } catch (e) {
    console.error('Ping check failed during creation', e);
    // Fallback if ping fails to run
    if (!status) status = 'inactive';
  }

  try {
    const result = await pool.query(
      'INSERT INTO ips (ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_status, last_checked) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *',
      [ip, hostname || '', ports || '', status, note || '', tab_id || null, username, username, req.body.subnet || '', req.body.cidr || '', last_status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'IP already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/ips/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { ip, hostname, ports, status, note, tab_id } = req.body;
  const username = req.user.username;

  if (ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ip) {
      if (!ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });
    }
    if (req.body.subnet && !ipRegex.test(req.body.subnet)) {
      return res.status(400).json({ error: 'Invalid Subnet format' });
    }
    if (req.body.cidr) {
      const cidrRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;
      if (!cidrRegex.test(req.body.cidr)) {
        return res.status(400).json({ error: 'Invalid CIDR format (e.g. /24)' });
      }
    }

    try {
      const result = await pool.query(
        'UPDATE ips SET ip = COALESCE($1, ip), hostname = COALESCE($2, hostname), ports = COALESCE($3, ports), status = COALESCE($4, status), note = COALESCE($5, note), tab_id = COALESCE($6, tab_id), last_updated_by = $7, subnet = COALESCE($8, subnet), cidr = COALESCE($9, cidr) WHERE id = $10 RETURNING *',
        [ip, hostname, ports, status, note, tab_id, username, req.body.subnet, req.body.cidr, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'IP already exists' });
      }
      res.status(500).json({ error: 'Database error' });
    }
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

// --- Backup Routes ---

app.get('/api/backup/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM users');
    const ips = await pool.query('SELECT * FROM ips');
    const tabs = await pool.query('SELECT * FROM tabs');
    const settings = await pool.query('SELECT * FROM settings');

    const backupData = {
      timestamp: new Date().toISOString(),
      users: users.rows,
      ips: ips.rows,
      tabs: tabs.rows,
      settings: settings.rows
    };

    res.setHeader('Content-Disposition', `attachment; filename=backup-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backupData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backup export failed' });
  }
});

app.post('/api/backup/import', authenticateToken, requireAdmin, async (req, res) => {
  const { data, mode } = req.body; // mode: 'merge' | 'replace'
  if (!data || !['merge', 'replace'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid data or mode' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (mode === 'replace') {
      // Truncate tables (Cascade to handle foreign keys)
      await client.query('TRUNCATE TABLE ips, tabs, settings RESTART IDENTITY CASCADE');
      // We keep users to avoid lockout, or we can replace them if we are sure.
      // Let's replace users but ensure we don't break the current session immediately (though it might).
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }

    // Import Users
    if (data.users && data.users.length > 0) {
      for (const user of data.users) {
        await client.query(
          `INSERT INTO users (id, username, password, role, is_active, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE SET 
           password = EXCLUDED.password, role = EXCLUDED.role, is_active = EXCLUDED.is_active`,
          [user.id, user.username, user.password, user.role, user.is_active, user.created_at]
        );
        await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
      }
    }

    // Import Tabs
    if (data.tabs && data.tabs.length > 0) {
      for (const tab of data.tabs) {
        await client.query(
          `INSERT INTO tabs (id, name, created_at) VALUES ($1, $2, $3)
           ON CONFLICT (name) DO NOTHING`,
          [tab.id, tab.name, tab.created_at]
        );
        await client.query(`SELECT setval('tabs_id_seq', (SELECT MAX(id) FROM tabs))`);
      }
    }

    // Import IPs
    if (data.ips && data.ips.length > 0) {
      for (const ip of data.ips) {
        // Handle potential missing columns in old backups if any
        const subnet = ip.subnet || '';
        const cidr = ip.cidr || '';
        const last_checked = ip.last_checked || null;
        const last_status = ip.last_status || null;

        await client.query(
          `INSERT INTO ips (ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_checked, last_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (ip, subnet, cidr) DO UPDATE SET
           hostname = EXCLUDED.hostname, ports = EXCLUDED.ports, status = EXCLUDED.status, 
           note = EXCLUDED.note, tab_id = EXCLUDED.tab_id, last_updated_by = EXCLUDED.last_updated_by`,
          [ip.ip, ip.hostname, ip.ports, ip.status, ip.note, ip.tab_id, ip.created_by, ip.last_updated_by, subnet, cidr, last_checked, last_status, ip.created_at]
        );
        await client.query(`SELECT setval('ips_id_seq', (SELECT MAX(id) FROM ips))`);
      }
    }

    // Import Settings
    if (data.settings && data.settings.length > 0) {
      for (const setting of data.settings) {
        await client.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [setting.key, setting.value]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Backup imported successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
});

// --- Monitoring System ---

let pingIntervalId = null;

const pingHost = (ip) => {
  return new Promise((resolve) => {
    execFile('ping', ['-c', '1', '-W', '1', ip], (error) => {
      resolve(!error); // true if alive, false if dead
    });
  });
};

const runPingJob = async () => {
  console.log('Running auto-ping job...');
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, ip FROM ips');
    const ips = res.rows;

    // Process in chunks to avoid overwhelming system
    const chunkSize = 10;
    for (let i = 0; i < ips.length; i += chunkSize) {
      const chunk = ips.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (record) => {
        const isAlive = await pingHost(record.ip);
        const status = isAlive ? 'UP' : 'DOWN';
        const mainStatus = isAlive ? 'active' : 'inactive';

        // Update both last_status AND the main status to reflect real-time state
        await client.query(
          'UPDATE ips SET last_status = $1, status = $2, last_checked = NOW() WHERE id = $3',
          [status, mainStatus, record.id]
        );
      }));
    }
    console.log('Auto-ping job completed.');
  } catch (err) {
    console.error('Auto-ping job failed:', err);
  } finally {
    client.release();
  }
};

const startAutoPing = async () => {
  if (pingIntervalId) clearInterval(pingIntervalId);

  try {
    const res = await pool.query("SELECT value FROM settings WHERE key = 'ping_interval'");
    const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'auto_ping_enabled'");

    const intervalHours = parseInt(res.rows[0]?.value || '3');
    const isEnabled = enabledRes.rows[0]?.value === 'true';

    if (isEnabled) {
      console.log(`Starting auto-ping every ${intervalHours} hours.`);
      pingIntervalId = setInterval(runPingJob, intervalHours * 60 * 60 * 1000);
    } else {
      console.log('Auto-ping is disabled.');
    }
  } catch (err) {
    console.error('Error starting auto-ping:', err);
  }
};

app.get('/api/monitor/status', authenticateToken, async (req, res) => {
  try {
    const intervalRes = await pool.query("SELECT value FROM settings WHERE key = 'ping_interval'");
    const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'auto_ping_enabled'");
    const lastRunRes = await pool.query("SELECT MAX(last_checked) as last_run FROM ips");

    const interval = parseInt(intervalRes.rows[0]?.value || '3');
    const enabled = enabledRes.rows[0]?.value === 'true';
    const lastRun = lastRunRes.rows[0]?.last_run;

    let nextRun = null;
    if (enabled && lastRun) {
      const lastDate = new Date(lastRun);
      nextRun = new Date(lastDate.getTime() + interval * 60 * 60 * 1000);
    }

    res.json({
      interval,
      enabled,
      lastRun,
      nextRun
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/monitor/config', authenticateToken, requireAdmin, async (req, res) => {
  const { interval, enabled } = req.body;

  try {
    await pool.query("INSERT INTO settings (key, value) VALUES ('ping_interval', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [interval.toString()]);
    await pool.query("INSERT INTO settings (key, value) VALUES ('auto_ping_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [enabled.toString()]);

    startAutoPing(); // Restart with new settings
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/monitor/ping-all', authenticateToken, requireAdmin, async (req, res) => {
  // Run asynchronously
  runPingJob();
  res.json({ message: 'Ping job started in background' });
});

app.post('/api/monitor/ping/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT ip FROM ips WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'IP not found' });

    const ip = result.rows[0].ip;
    const isAlive = await pingHost(ip);
    const status = isAlive ? 'UP' : 'DOWN';
    const mainStatus = isAlive ? 'active' : 'inactive';

    await pool.query('UPDATE ips SET last_status = $1, status = $2, last_checked = NOW() WHERE id = $3', [status, mainStatus, id]);

    res.json({ id, ip, status, last_checked: new Date() });
  } catch (err) {
    res.status(500).json({ error: 'Ping failed' });
  }
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
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add is_active column if missing
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);

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

    // Create Tabs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tabs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add tab_id to IPs
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS tab_id INTEGER REFERENCES tabs(id) ON DELETE SET NULL`);

    // Add user tracking columns
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(50)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS subnet VARCHAR(45) DEFAULT ''`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS cidr VARCHAR(10) DEFAULT ''`);

    // Unique constraint on IP + Subnet + CIDR
    // We use COALESCE to handle potential NULLs if they were inserted that way, though we default to ''
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ips_unique_idx ON ips (ip, COALESCE(subnet, ''), COALESCE(cidr, ''))`);

    // Create Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
      );
    `);

    // Initialize default settings if not exists
    await client.query(`
      INSERT INTO settings (key, value) VALUES 
      ('ping_interval', '3'),
      ('auto_ping_enabled', 'false')
      ON CONFLICT DO NOTHING;
    `);

    // Add monitoring columns to IPs
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_status VARCHAR(20)`);
    // next_run_time is dynamic based on interval, but we can store it if needed. 
    // Actually, we can just calculate it or store the last run time of the global job.

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
