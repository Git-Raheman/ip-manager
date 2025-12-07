const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangeinproduction';

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

// File Upload Config
const upload = multer({ dest: '/tmp/uploads/' });

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000
});
app.use(limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Logging Disabled
const logSystemEvent = async (type, message, userId = null) => {
  // Logs removed per user request
};

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

const requireSuperAdmin = (req, res, next) => {
  if (req.user.username !== 'admin') return res.sendStatus(403);
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
      logSystemEvent('SYSTEM', 'Admin user seeded');
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
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, allowed_tabs: user.allowed_tabs }, JWT_SECRET, { expiresIn: '24h' });
      logSystemEvent('AUTH', `User ${username} logged in`, user.id);
      res.json({ token, role: user.role, username: user.username, allowed_tabs: user.allowed_tabs });
    } else {
      logSystemEvent('AUTH', `Failed login attempt for ${username}`);
      res.status(403).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- User Management Routes (Super Admin Only) ---

app.get('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, is_active, allowed_tabs, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  if (!['admin', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role, allowed_tabs) VALUES ($1, $2, $3, $4) RETURNING id, username, role, allowed_tabs',
      [username, hash, role, req.body.allowed_tabs || null]
    );
    logSystemEvent('USER_MGMT', `Created user ${username}`, req.user.id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error or username exists' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    logSystemEvent('USER_MGMT', `Deleted user ID ${id}`, req.user.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id/password', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Verify user exists first
    const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash the new password with proper salt rounds
    const hash = await bcrypt.hash(password, 10);

    // Update the password
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username',
      [hash, id]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Password update failed' });
    }

    logSystemEvent('USER_MGMT', `Updated password for user ${result.rows[0].username} (ID: ${id})`, req.user.id);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id/tabs', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { allowed_tabs } = req.body; // Expects array of integers or null

  try {
    const result = await pool.query(
      'UPDATE users SET allowed_tabs = $1 WHERE id = $2 RETURNING id, username, allowed_tabs',
      [allowed_tabs, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    logSystemEvent('USER_MGMT', `Updated allowed tabs for user ${result.rows[0].username}`, req.user.id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id/status', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (parseInt(id) === req.user.id && !is_active) {
    return res.status(400).json({ error: 'Cannot disable your own account' });
  }

  try {
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
    logSystemEvent('USER_MGMT', `${is_active ? 'Enabled' : 'Disabled'} user ID ${id}`, req.user.id);
    res.json({ message: `User ${is_active ? 'enabled' : 'disabled'} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id/role', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });

  try {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    logSystemEvent('USER_MGMT', `Changed role of user ID ${id} to ${role}`, req.user.id);
    res.json({ message: 'Role updated successfully' });
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
    logSystemEvent('PROFILE', 'Updated own password', userId);

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
    logSystemEvent('TAB', `Created tab ${name}`, req.user.id);
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
    logSystemEvent('TAB', `Deleted tab ID ${id}`, req.user.id);
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

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        ip ILIKE $${params.length} OR 
        hostname ILIKE $${params.length} OR 
        note ILIKE $${params.length} OR 
        status ILIKE $${params.length} OR
        cidr ILIKE $${params.length} OR
        ports ILIKE $${params.length} OR
        last_updated_by ILIKE $${params.length} OR
        last_status ILIKE $${params.length}
      )`);
    }

    if (tab_id !== 'all') {
      params.push(tab_id);
      conditions.push(`tab_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    const { sort = 'ip', order = 'asc' } = req.query;
    let orderBy = 'ORDER BY created_at DESC';

    if (sort) {
      const dir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      if (sort === 'ip') {
        // Use INET cast for correct IP sorting
        orderBy = `ORDER BY CASE WHEN ip ~ '^[0-9.]+$' THEN ip::inet ELSE NULL END ${dir} NULLS LAST`;
      } else {
        // Safe column allow-list to prevent SQL injection
        const allowedColumns = ['hostname', 'status', 'cidr', 'last_updated_by', 'last_status', 'created_at'];
        if (allowedColumns.includes(sort)) {
          orderBy = `ORDER BY ${sort} ${dir} NULLS LAST`;
        }
      }
    }

    query += ` ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const countResult = await pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

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

  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ip || !ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });

  if (req.body.subnet && !ipRegex.test(req.body.subnet)) {
    return res.status(400).json({ error: 'Invalid Subnet format' });
  }

  if (req.body.cidr) {
    const cidrRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!cidrRegex.test(req.body.cidr)) {
      return res.status(400).json({ error: 'Invalid CIDR format (e.g. /24)' });
    }
  }

  // Auto-Ping on Create
  let last_status = null;
  try {
    const isAlive = await pingHost(ip);
    last_status = isAlive ? 'UP' : 'DOWN';
  } catch (e) {
    console.error('Ping check failed during creation', e);
  }

  try {
    const result = await pool.query(
      'INSERT INTO ips (ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_status, last_checked) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *',
      [ip, hostname || '', ports || '', status || 'Available', note || '', tab_id || null, username, username, req.body.subnet || '', req.body.cidr || '', last_status]
    );
    logSystemEvent('IP', `Added IP ${ip}`, req.user.id);
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

  // Validation logic...
  if (ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });
  }

  try {
    const safeTabId = tab_id === '' ? null : tab_id;
    const safeSubnet = req.body.subnet === undefined ? null : req.body.subnet;
    const safeCidr = req.body.cidr === undefined ? null : req.body.cidr;

    const result = await pool.query(
      'UPDATE ips SET ip = COALESCE($1, ip), hostname = COALESCE($2, hostname), ports = COALESCE($3, ports), status = COALESCE($4, status), note = COALESCE($5, note), tab_id = COALESCE($6, tab_id), last_updated_by = $7, subnet = COALESCE($8, subnet), cidr = COALESCE($9, cidr) WHERE id = $10 RETURNING *',
      [ip, hostname, ports, status, note, safeTabId, username, safeSubnet, safeCidr, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    logSystemEvent('IP', `Updated IP ${result.rows[0].ip}`, req.user.id);

    // Trigger ping if IP or Hostname changed, or just always on update
    pingHost(result.rows[0].ip).then(async (isAlive) => {
      const newStatus = isAlive ? 'UP' : 'DOWN';
      await pool.query('UPDATE ips SET last_status = $1, last_checked = NOW() WHERE id = $2', [newStatus, id]);
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'IP already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/ips/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ips WHERE id = $1 RETURNING ip', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logSystemEvent('IP', `Deleted IP ${result.rows[0].ip}`, req.user.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

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
    logSystemEvent('IP', `Bulk deleted ${result.rows.length} IPs`, req.user.id);
    res.json({ message: `Deleted ${result.rows.length} records`, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/ips/export-excel', authenticateToken, async (req, res) => {
  const { search = '', tab_id = 'all' } = req.query;

  try {
    let query = `
      SELECT i.ip, i.hostname, i.ports, i.status, i.note, t.name as tab_name, 
             i.subnet, i.cidr, i.last_status, i.last_checked, i.last_updated_by
      FROM ips i
      LEFT JOIN tabs t ON i.tab_id = t.id
    `;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        i.ip ILIKE $${params.length} OR 
        i.hostname ILIKE $${params.length} OR 
        i.note ILIKE $${params.length} OR 
        i.status ILIKE $${params.length} OR
        i.cidr ILIKE $${params.length} OR
        i.ports ILIKE $${params.length} OR
        i.last_updated_by ILIKE $${params.length} OR
        i.last_status ILIKE $${params.length}
      )`);
    }

    if (tab_id !== 'all') {
      params.push(tab_id);
      conditions.push(`i.tab_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY i.created_at DESC';

    const result = await pool.query(query, params);

    // Transform for Excel
    const data = result.rows.map(row => ({
      IP: row.ip,
      Hostname: row.hostname,
      Ports: row.ports,
      Status: row.status,
      Note: row.note,
      Tab: row.tab_name || 'Unassigned',
      Subnet: row.subnet,
      CIDR: row.cidr,
      'Live Status': row.last_status || 'Unknown',
      'Last Checked': row.last_checked ? new Date(row.last_checked).toLocaleString() : '',
      'Updated By': row.last_updated_by
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "IPs");

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=ips_export_${tab_id}_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

app.post('/api/ping', authenticateToken, (req, res) => {
  const { ip } = req.body;
  const isValid = /^[a-zA-Z0-9.-]+$/.test(ip);
  if (!isValid) return res.status(400).json({ error: 'Invalid IP/Hostname format' });

  execFile('ping', ['-c', '3', ip], (error, stdout, stderr) => {
    const raw = stdout + stderr;
    const alive = !error;
    const lossMatch = raw.match(/(\d+)% packet loss/);
    const packetLoss = lossMatch ? parseInt(lossMatch[1]) : 100;
    const rttMatch = raw.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
    const avgLatencyMs = rttMatch ? parseFloat(rttMatch[1]) : null;

    res.json({ ip, alive, packetLoss, avgLatencyMs, raw });
  });
});

// --- Backup & Import Routes ---

app.get('/api/backup/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Fetch all data from existing tables only
    const users = await pool.query('SELECT * FROM users ORDER BY id');
    const ips = await pool.query('SELECT * FROM ips ORDER BY id');
    const tabs = await pool.query('SELECT * FROM tabs ORDER BY id');
    const settings = await pool.query('SELECT * FROM settings');

    // Enhanced sanitization to handle all PostgreSQL data types
    const sanitizeRow = (row) => {
      const sanitized = {};
      Object.keys(row).forEach(key => {
        const value = row[key];

        // Handle null and undefined
        if (value === null || value === undefined) {
          sanitized[key] = null;
        }
        // Handle Date objects
        else if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        }
        // Handle BigInt (PostgreSQL BIGINT/BIGSERIAL)
        else if (typeof value === 'bigint') {
          sanitized[key] = value.toString();
        }
        // Handle Buffer (PostgreSQL BYTEA)
        else if (Buffer.isBuffer(value)) {
          sanitized[key] = value.toString('base64');
        }
        // Handle objects (nested JSON)
        else if (typeof value === 'object' && !Array.isArray(value)) {
          try {
            sanitized[key] = JSON.parse(JSON.stringify(value));
          } catch (e) {
            sanitized[key] = String(value);
          }
        }
        // Handle arrays
        else if (Array.isArray(value)) {
          sanitized[key] = value.map(item => {
            if (item instanceof Date) return item.toISOString();
            if (typeof item === 'bigint') return item.toString();
            return item;
          });
        }
        // Handle primitives (string, number, boolean)
        else {
          sanitized[key] = value;
        }
      });
      return sanitized;
    };

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      users: users.rows.map(sanitizeRow),
      ips: ips.rows.map(sanitizeRow),
      tabs: tabs.rows.map(sanitizeRow),
      settings: settings.rows.map(sanitizeRow)
    };

    // Safely stringify with error handling and custom replacer
    let jsonString;
    try {
      jsonString = JSON.stringify(backupData, (key, value) => {
        // Additional safety check during stringify
        if (typeof value === 'bigint') {
          return value.toString();
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }, 2);
    } catch (stringifyErr) {
      console.error('JSON stringify error:', stringifyErr);
      return res.status(500).json({ error: 'Failed to serialize backup data: ' + stringifyErr.message });
    }

    logSystemEvent('BACKUP', 'Exported system backup', req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename=backup-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: 'Backup export failed: ' + err.message });
  }
});

app.post('/api/backup/import', authenticateToken, requireAdmin, async (req, res) => {
  const { data, mode } = req.body;
  if (!data || !['merge', 'replace'].includes(mode)) return res.status(400).json({ error: 'Invalid data or mode' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Handle Replace Mode (Truncate)
    if (mode === 'replace') {
      // Truncate all relevant tables (only tables that exist in schema)
      // Note: We truncate users too, but the current request context (req.user) remains valid for the response.
      await client.query('TRUNCATE TABLE ips, tabs, settings RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }

    // 2. Import Users
    if (data.users) {
      for (const user of data.users) {
        if (mode === 'replace') {
          await client.query(
            `INSERT INTO users (id, username, password, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.id, user.username, user.password, user.role, user.is_active, user.created_at]
          );
        } else {
          // Merge: Upsert based on username
          await client.query(
            `INSERT INTO users (username, password, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password, role=EXCLUDED.role, is_active=EXCLUDED.is_active`,
            [user.username, user.password, user.role, user.is_active, user.created_at]
          );
        }
      }
    }

    // 3. Import Tabs & Build Map
    const tabIdMap = new Map(); // old_id -> new_id
    if (data.tabs) {
      for (const tab of data.tabs) {
        if (mode === 'replace') {
          await client.query(
            `INSERT INTO tabs (id, name, created_at) VALUES ($1, $2, $3)`,
            [tab.id, tab.name, tab.created_at]
          );
          tabIdMap.set(tab.id, tab.id);
        } else {
          // Merge: Check if exists by name
          // We use a trick: INSERT ... ON CONFLICT DO UPDATE ... RETURNING id
          const res = await client.query(
            `INSERT INTO tabs (name, created_at) VALUES ($1, $2) 
              ON CONFLICT (name) DO UPDATE SET created_at=EXCLUDED.created_at 
              RETURNING id`,
            [tab.name, tab.created_at]
          );
          tabIdMap.set(tab.id, res.rows[0].id);
        }
      }
    }

    // 4. Import IPs
    if (data.ips) {
      for (const ip of data.ips) {
        // Resolve Tab ID
        let newTabId = ip.tab_id;
        if (ip.tab_id && tabIdMap.has(ip.tab_id)) {
          newTabId = tabIdMap.get(ip.tab_id);
        } else if (mode === 'merge' && ip.tab_id) {
          // If merging and tab not found in backup map, set to null to avoid FK error
          newTabId = null;
        }

        if (mode === 'replace') {
          await client.query(
            `INSERT INTO ips (id, ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_checked, last_status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [ip.id, ip.ip, ip.hostname, ip.ports, ip.status, ip.note, newTabId, ip.created_by, ip.last_updated_by, ip.subnet || '', ip.cidr || '', ip.last_checked, ip.last_status, ip.created_at]
          );
        } else {
          // Merge
          await client.query(
            `INSERT INTO ips (ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_checked, last_status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (ip, subnet, cidr) DO UPDATE SET 
                  hostname=EXCLUDED.hostname, ports=EXCLUDED.ports, status=EXCLUDED.status, note=EXCLUDED.note, tab_id=EXCLUDED.tab_id, last_updated_by=EXCLUDED.last_updated_by`,
            [ip.ip, ip.hostname, ip.ports, ip.status, ip.note, newTabId, ip.created_by, ip.last_updated_by, ip.subnet || '', ip.cidr || '', ip.last_checked, ip.last_status, ip.created_at]
          );
        }
      }
    }

    // 5. Import Settings
    if (data.settings) {
      for (const s of data.settings) {
        await client.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [s.key, s.value]);
      }
    }

    // 6. Reset Sequences
    await client.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))`);
    await client.query(`SELECT setval('tabs_id_seq', COALESCE((SELECT MAX(id) FROM tabs), 1))`);
    await client.query(`SELECT setval('ips_id_seq', COALESCE((SELECT MAX(id) FROM ips), 1))`);

    await client.query('COMMIT');

    // 7. Ensure Admin (Safety Net)
    await seedAdmin();

    logSystemEvent('BACKUP', `Imported backup (Mode: ${mode})`, req.user.id);
    res.json({ message: 'Backup imported successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
});

// Excel/CSV Import
app.post('/api/backup/import-excel', authenticateToken, requireSuperAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let rawData = [];

    // Handle CSV files specifically or fallback to xlsx for everything
    if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      const workbook = xlsx.readFile(req.file.path, { type: 'file', raw: true });
      const sheetName = workbook.SheetNames[0];
      rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    } else {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    // Determine if first row is header
    const firstRow = rawData[0];
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    let headers = [];
    let dataRows = [];

    // Check if first cell of first row is an IP -> Headerless mode
    if (firstRow.length > 0 && typeof firstRow[0] === 'string' && ipRegex.test(firstRow[0].trim())) {
      // Headerless: Assume Col 0 is IP
      headers = ['ip'];
      dataRows = rawData;
    } else {
      // Header mode: Normalize headers
      headers = firstRow.map(h => (h ? String(h).trim().toLowerCase().replace(/[\s_-]+/g, '') : ''));
      dataRows = rawData.slice(1);
    }

    const errors = [];
    const validRows = [];
    let processedCount = 0;

    // Validate and Map
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length === 0) continue; // Skip empty rows

      processedCount++;

      // Map row array to object based on headers (or default for headerless)
      const rowObj = {};
      if (headers.length === 1 && headers[0] === 'ip') {
        // Headerless mapping
        rowObj['ip'] = row[0];
      } else {
        // Header mapping
        headers.forEach((header, index) => {
          if (header) rowObj[header] = row[index];
        });
      }

      // Find IP value - normalized keys: ip, ipaddress, address
      const ip = rowObj['ip'] || rowObj['ipaddress'] || rowObj['address'];

      if (!ip || !ipRegex.test(ip)) {
        // Only log error if row has some data
        if (row.some(v => v)) {
          errors.push(`Row ${i + (headers.length === 1 && headers[0] === 'ip' ? 1 : 2)}: Invalid or missing IP Address (${ip || 'Empty'})`);
        }
        continue;
      }

      validRows.push({
        ip,
        hostname: rowObj['hostname'] || rowObj['host'] || '',
        ports: rowObj['ports'] || rowObj['port'] || '',
        status: rowObj['status'] || 'Available',
        note: rowObj['note'] || rowObj['notes'] || rowObj['description'] || '',
        subnet: rowObj['subnet'] || '',
        cidr: rowObj['cidr'] || ''
      });
    }

    console.log(`Excel Import: Found ${validRows.length} valid rows out of ${processedCount} processed`);
    if (validRows.length > 0) {
      console.log('Sample row:', validRows[0]);
    }

    const client = await pool.connect();
    let insertedCount = 0;
    try {
      await client.query('BEGIN');
      for (const row of validRows) {
        try {
          // Ensure empty strings for subnet/cidr to match unique index
          const subnet = row.subnet || '';
          const cidr = row.cidr || '';

          const result = await client.query(
            `INSERT INTO ips (ip, hostname, ports, status, note, created_by, last_updated_by, subnet, cidr, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                     ON CONFLICT (ip, COALESCE(subnet, ''), COALESCE(cidr, '')) DO NOTHING
                     RETURNING id`,
            [row.ip, row.hostname, row.ports, row.status, row.note, req.user.username, req.user.username, subnet, cidr]
          );
          // Only increment if row was actually inserted
          if (result.rowCount > 0) {
            insertedCount++;
          }
        } catch (e) {
          console.error('Insert error for IP', row.ip, ':', e.message);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Cleanup file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    logSystemEvent('IMPORT', `Imported ${insertedCount} IPs from Excel/CSV`, req.user.id);

    res.json({
      message: `Processed ${processedCount} rows. Successfully created ${insertedCount} IPs.`,
      errors,
      summary: {
        processed: processedCount,
        created: insertedCount,
        errorCount: errors.length
      }
    });

  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

app.get('/api/backup/template', (req, res) => {
  // Create a simple workbook
  const wb = xlsx.utils.book_new();
  const ws_data = [
    ['IP', 'Hostname', 'Ports', 'Status', 'Note', 'Subnet', 'CIDR'],
    ['192.168.1.10', 'server-01', '80, 443', 'Available', 'Main Web Server', '255.255.255.0', '/24']
  ];
  const ws = xlsx.utils.aoa_to_sheet(ws_data);
  xlsx.utils.book_append_sheet(wb, ws, "Template");

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=ip_import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// --- Monitoring System ---

let pingIntervalId = null;

const pingHost = (ip) => {
  return new Promise((resolve) => {
    execFile('ping', ['-c', '1', '-W', '1', ip], (error) => {
      resolve(!error);
    });
  });
};

const pingHostDetailed = (ip) => {
  return new Promise((resolve) => {
    const cmd = 'ping';
    const args = ['-c', '3', ip];
    execFile(cmd, args, (error, stdout, stderr) => {
      const raw = stdout + stderr;
      const alive = !error;

      // Parse Linux ping output
      const lossMatch = raw.match(/(\d+)% packet loss/);
      const packetLoss = lossMatch ? parseInt(lossMatch[1]) : (alive ? 0 : 100);

      const rttMatch = raw.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
      const avgLatencyMs = rttMatch ? parseFloat(rttMatch[1]) : null;

      const txMatch = raw.match(/(\d+) packets? transmitted/);
      const rxMatch = raw.match(/(\d+) (?:packets? )?received/);
      const sent = txMatch ? parseInt(txMatch[1]) : 3;
      const received = rxMatch ? parseInt(rxMatch[1]) : (alive ? 3 : 0);

      resolve({
        alive,
        packetLoss,
        avgLatencyMs,
        raw,
        command: `${cmd} ${args.join(' ')}`,
        sent,
        received
      });
    });
  });
};

const runPingJob = async () => {
  try {
    const res = await pool.query('SELECT id, ip, hostname FROM ips');
    const ips = res.rows;
    console.log(`Starting ping job for ${ips.length} IPs...`);

    for (const ipRecord of ips) {
      try {
        const isAlive = await pingHost(ipRecord.ip);
        let newStatus = 'DOWN';
        if (isAlive) {
          newStatus = 'UP';
        } else if (ipRecord.hostname && ipRecord.hostname.trim() !== '') {
          newStatus = 'RESERVED';
        }

        await pool.query('UPDATE ips SET last_status = $1, last_checked = NOW() WHERE id = $2', [newStatus, ipRecord.id]);
        // Small delay to be "stable and low-resource"
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error pinging ${ipRecord.ip}:`, err);
      }
    }
    console.log('Ping job completed');

    // Schedule next run
    const settingsRes = await pool.query("SELECT value FROM settings WHERE key = 'ping_interval'");
    const interval = settingsRes.rows.length > 0 ? parseInt(settingsRes.rows[0].value) : 180;
    const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'auto_ping_enabled'");
    const enabled = enabledRes.rows.length > 0 ? enabledRes.rows[0].value === 'true' : false;

    if (enabled) {
      setTimeout(runPingJob, interval * 60 * 1000);
    }
  } catch (err) {
    console.error('Ping job error:', err);
  }
};

const startAutoPing = async () => {
  // Initial run or schedule is handled by runPingJob's recursive setTimeout logic, 
  // but we need a trigger on startup or config change.
  // For simplicity, we'll just check if enabled and run immediately or schedule.
  // Actually, runPingJob schedules itself. We just need to kick it off if not running.
  // But to avoid double scheduling, we can just run it once.

  // A better approach for this simple script:
  const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'auto_ping_enabled'");
  const enabled = enabledRes.rows.length > 0 ? enabledRes.rows[0].value === 'true' : false;
  if (enabled) {
    runPingJob();
  }
};

app.get('/api/monitor/status', authenticateToken, async (req, res) => {
  try {
    const intervalRes = await pool.query("SELECT value FROM settings WHERE key = 'ping_interval'");
    const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'auto_ping_enabled'");
    const lastRunRes = await pool.query("SELECT MAX(last_checked) as last_run FROM ips");

    const interval = parseInt(intervalRes.rows[0]?.value || '180');
    const enabled = enabledRes.rows[0]?.value === 'true';
    const lastRun = lastRunRes.rows[0]?.last_run;

    let nextRun = null;
    if (enabled && lastRun) {
      const lastDate = new Date(lastRun);
      nextRun = new Date(lastDate.getTime() + interval * 60 * 1000);
    }

    res.json({ interval, enabled, lastRun, nextRun });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});



app.post('/api/monitor/config', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { interval, enabled } = req.body; // interval in minutes
  try {
    await pool.query("INSERT INTO settings (key, value) VALUES ('ping_interval', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [interval.toString()]);
    await pool.query("INSERT INTO settings (key, value) VALUES ('auto_ping_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [enabled.toString()]);

    // If enabled, we might want to trigger a run or ensure it's scheduled. 
    // For this simple implementation, we can just let the next scheduled run happen or restart the loop.
    // If we just enabled it, we should probably kick it off.
    if (enabled) {
      runPingJob();
    }

    logSystemEvent('MONITOR', `Updated monitor config: ${enabled ? 'ON' : 'OFF'}, ${interval} mins`, req.user.id);
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/monitor/ping-all', authenticateToken, requireSuperAdmin, async (req, res) => {
  runPingJob();
  res.json({ message: 'Ping job started in background' });
});

app.post('/api/monitor/ping-one', authenticateToken, async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });

  try {
    // Find ID and Hostname
    const ipRes = await pool.query('SELECT id, hostname FROM ips WHERE ip = $1', [ip]);
    if (ipRes.rows.length === 0) return res.status(404).json({ error: 'IP not found in database' });

    const { id, hostname } = ipRes.rows[0];
    const details = await pingHostDetailed(ip);

    let newStatus = 'DOWN';
    if (details.alive) {
      newStatus = 'UP';
    } else if (hostname && hostname.trim() !== '') {
      newStatus = 'RESERVED';
    }

    await pool.query('UPDATE ips SET last_status = $1, last_checked = NOW() WHERE id = $2', [newStatus, id]);
    res.json({
      message: 'Ping check completed',
      status: newStatus,
      details: details
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ping check failed' });
  }
});

app.post('/api/monitor/ping/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, ip, hostname FROM ips WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'IP not found' });

    const { ip, hostname } = result.rows[0];
    const isAlive = await pingHost(ip);

    let newStatus = 'DOWN';
    if (isAlive) {
      newStatus = 'UP';
    } else if (hostname && hostname.trim() !== '') {
      newStatus = 'RESERVED';
    }

    await pool.query('UPDATE ips SET last_status = $1, last_checked = NOW() WHERE id = $2', [newStatus, id]);
    res.json({ status: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ping failed' });
  }
});
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);

    // IPs
    await client.query(`
      CREATE TABLE IF NOT EXISTS ips (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        hostname VARCHAR(255),
        ports VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Available',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS ports VARCHAR(255)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Available'`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS note TEXT`);

    // Tabs
    await client.query(`
      CREATE TABLE IF NOT EXISTS tabs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS tab_id INTEGER REFERENCES tabs(id) ON DELETE SET NULL`);

    // Extra IP Columns
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(50)`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS subnet VARCHAR(45) DEFAULT ''`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS cidr VARCHAR(10) DEFAULT ''`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ips_unique_idx ON ips (ip, COALESCE(subnet, ''), COALESCE(cidr, ''))`);

    // Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
      );
    `);
    await client.query(`
      INSERT INTO settings (key, value) VALUES 
      ('ping_interval', '180'),
      ('auto_ping_enabled', 'false'),
      ('logs_enabled', 'true')
      ON CONFLICT DO NOTHING;
    `);

    // Monitoring
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP`);
    await client.query(`ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_status VARCHAR(20)`);

    // State Logs
    await client.query(`
        CREATE TABLE IF NOT EXISTS state_logs (
            id SERIAL PRIMARY KEY,
            ip_id INTEGER REFERENCES ips(id) ON DELETE CASCADE,
            old_status VARCHAR(20),
            new_status VARCHAR(20),
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // System Logs
    await client.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50),
            message TEXT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

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
  setTimeout(async () => {
    await initDB();
    await seedAdmin();

    // Load Log Settings
    try {
      const res = await pool.query("SELECT value FROM settings WHERE key = 'logs_enabled'");
      if (res.rows.length > 0) {
        SYSTEM_LOGS_ENABLED = res.rows[0].value === 'true';
      }
    } catch (e) {
      console.error('Failed to load log settings', e);
    }
  }, 2000);
});
