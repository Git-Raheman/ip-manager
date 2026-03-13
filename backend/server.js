const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { execFile, spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangeinproduction';

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100mb' }));

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

// Global Log Setting
let SYSTEM_LOGS_ENABLED = true;

// Discovery Jobs Tracking
const discoveryJobs = new Map();

// Logging Helper
const logSystemEvent = async (type, message, userId = null) => {
  if (!SYSTEM_LOGS_ENABLED) return;
  try {
    await pool.query(
      'INSERT INTO system_logs (type, message, user_id) VALUES ($1, $2, $3)',
      [type, message, userId]
    );
  } catch (err) {
    console.error('Failed to log system event:', err);
  }
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
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      logSystemEvent('AUTH', `User ${username} logged in`, user.id);
      res.json({ token, role: user.role, username: user.username });
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
    const result = await pool.query('SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC');
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
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role]
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
    const result = await pool.query('SELECT * FROM tabs ORDER BY is_default_public DESC, created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tabs', authenticateToken, requireAdmin, async (req, res) => {
  const { name, is_public } = req.body;
  if (!name) return res.status(400).json({ error: 'Tab name is required' });

  try {
    const shareToken = is_public ? crypto.randomBytes(24).toString('hex') : null;
    const result = await pool.query(
      'INSERT INTO tabs (name, is_public, share_token) VALUES ($1, $2, $3) RETURNING *',
      [name, !!is_public, shareToken]
    );
    logSystemEvent('TAB', `Created tab ${name}${is_public ? ' (public)' : ''}`, req.user.id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Tab name already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Rename a tab
app.put('/api/tabs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tab name is required' });
  }

  try {
    const checkTab = await pool.query('SELECT * FROM tabs WHERE id = $1', [id]);
    if (checkTab.rows.length === 0) return res.status(404).json({ error: 'Tab not found' });

    const result = await pool.query(
      'UPDATE tabs SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );
    logSystemEvent('TAB', `Renamed tab ID ${id} to "${name.trim()}"`, req.user.id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A tab with this name already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Toggle public sharing for a tab
app.put('/api/tabs/:id/sharing', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_public } = req.body;

  if (typeof is_public !== 'boolean') {
    return res.status(400).json({ error: 'is_public must be boolean' });
  }

  try {
    // Check if this is the default public tab
    const checkTab = await pool.query('SELECT is_default_public, name FROM tabs WHERE id = $1', [id]);
    if (checkTab.rows.length === 0) return res.status(404).json({ error: 'Tab not found' });
    if (checkTab.rows[0].is_default_public && !is_public) {
      return res.status(400).json({ error: 'The default Public Sharing tab cannot have sharing disabled' });
    }

    let shareToken = null;
    if (is_public) {
      // Get existing token or create a new one
      const existing = await pool.query('SELECT share_token FROM tabs WHERE id = $1', [id]);
      shareToken = existing.rows[0]?.share_token || crypto.randomBytes(24).toString('hex');
    }

    const result = await pool.query(
      'UPDATE tabs SET is_public = $1, share_token = $2 WHERE id = $3 RETURNING *',
      [is_public, shareToken, id]
    );
    logSystemEvent('TAB', `${is_public ? 'Enabled' : 'Disabled'} public sharing for tab: ${result.rows[0].name}`, req.user.id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/tabs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Prevent deletion of the default public tab
    const checkTab = await pool.query('SELECT is_default_public FROM tabs WHERE id = $1', [id]);
    if (checkTab.rows.length > 0 && checkTab.rows[0].is_default_public) {
      return res.status(400).json({ error: 'The default Public Sharing tab cannot be deleted' });
    }
    await pool.query('DELETE FROM tabs WHERE id = $1', [id]);
    logSystemEvent('TAB', `Deleted tab ID ${id}`, req.user.id);
    res.json({ message: 'Tab deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Public Sharing Routes (No Authentication Required) ---

// Get all publicly shared tabs (for the login page panel)
app.get('/api/public/tabs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, share_token, is_default_public, created_at FROM tabs WHERE is_public = TRUE AND share_token IS NOT NULL ORDER BY is_default_public DESC, name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get IPs for a specific public tab by token
app.get('/api/public/tab/:token', async (req, res) => {
  const { token } = req.params;
  const { search = '', page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const tabResult = await pool.query(
      'SELECT id, name, share_token, created_at FROM tabs WHERE share_token = $1 AND is_public = TRUE',
      [token]
    );
    if (tabResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shared tab not found or sharing has been disabled' });
    }
    const tab = tabResult.rows[0];

    let query = 'SELECT ip, hostname, ports, status, note, subnet, cidr, last_status, last_checked FROM ips WHERE tab_id = $1';
    const params = [tab.id];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (ip ILIKE $${params.length} OR hostname ILIKE $${params.length} OR note ILIKE $${params.length} OR status ILIKE $${params.length})`;
    }

    const countQuery = query.replace('SELECT ip, hostname, ports, status, note, subnet, cidr, last_status, last_checked', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    query += ` ORDER BY ip LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const ipsResult = await pool.query(query, params);

    res.json({
      tab: { name: tab.name, id: tab.id },
      ips: ipsResult.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
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

// --- Discovery Routes ---

app.post('/api/discovery/start', authenticateToken, requireAdmin, (req, res) => {
  const { range = '192.168.1.0/24' } = req.body;

  // Broader validation for targets (support ranges, commas, CIDR)
  const targets = range.trim();
  if (!targets) return res.status(400).json({ error: 'Targets required' });

  const jobId = Date.now().toString();
  const job = {
    id: jobId,
    range: targets,
    status: 'scanning',
    devices: [],
    startTime: new Date(),
    progress: 0,
    phase: 'Initializing',
    process: null
  };
  discoveryJobs.set(jobId, job);

  // -sn: Ping scan
  // -T4: Timing level
  // -n: Skip DNS
  // --host-timeout: Fix 95% hang
  // --stats-every: Real-time progress
  const nm = spawn('nmap', ['-sn', '-T4', '-n', '--host-timeout', '30s', '--stats-every', '5s', '-oG', '-', targets]);
  job.process = nm;

  nm.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n');

    lines.forEach(line => {
      if (line.startsWith('Host:')) {
        const parts = line.split('\t');
        const hostPart = parts[0].replace('Host: ', '').trim();
        const statusPart = parts[1] ? parts[1].replace('Status: ', '').trim() : 'Unknown';

        // Extract IP and Hostname
        const match = hostPart.match(/^([0-9.]+)\s*(\((.*)\))?$/);
        if (match) {
          const ip = match[1];
          const hostname = match[3] || '';

          // Only add if not already found in this job
          if (!job.devices.some(d => d.ip === ip)) {
            job.devices.push({ ip, hostname, status: statusPart });
          }
        }
      }
    });
  });

  nm.stderr.on('data', (data) => {
    const output = data.toString();
    // Parse stats: Stats: 0:00:08 elapsed; 0 hosts completed (0 up), 1 undergoing ARP Stealth Scan (45.00% done)
    const statsMatch = output.match(/Stats: .*? undergoing (.*?) \(([\d.]+)% done\)/);
    if (statsMatch) {
      job.phase = statsMatch[1];
      job.progress = parseFloat(statsMatch[2]);
    }
  });

  nm.on('close', (code) => {
    job.status = code === 0 ? 'completed' : (job.status === 'stopped' ? 'stopped' : 'failed');
    job.process = null;
    job.endTime = new Date();
    logSystemEvent('DISCOVERY', `Job ${jobId} finished with code ${code}. Found ${job.devices.length} devices`, req.user.id);
  });

  nm.on('error', (err) => {
    job.status = 'failed';
    job.error = err.message;
    console.error(`Discovery job ${jobId} failed:`, err);
  });

  logSystemEvent('DISCOVERY', `Started discovery job ${jobId} for range ${range}`, req.user.id);
  res.json({ jobId });
});

app.post('/api/discovery/stop/:jobId', authenticateToken, requireAdmin, (req, res) => {
  const { jobId } = req.params;
  const job = discoveryJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.process) {
    job.process.kill('SIGTERM');
    job.status = 'stopped';
    logSystemEvent('DISCOVERY', `Job ${jobId} manually stopped by user`, req.user.id);
    return res.json({ message: 'Scan stopping...' });
  }
  res.status(400).json({ error: 'Job not currently running' });
});

app.get('/api/discovery/status/:jobId', authenticateToken, requireAdmin, (req, res) => {
  const { jobId } = req.params;
  const job = discoveryJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Don't send the process object to client
  const { process, ...clientData } = job;
  res.json(clientData);
});

app.post('/api/ips/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { ips, tab_id } = req.body;
  if (!Array.isArray(ips) || ips.length === 0) {
    return res.status(400).json({ error: 'No IPs provided' });
  }

  const username = req.user.username;
  const client = await pool.connect();
  let count = 0;

  try {
    await client.query('BEGIN');
    for (const item of ips) {
      const { ip, hostname, status, note, subnet, cidr } = item;

      await client.query(`
        INSERT INTO ips (ip, hostname, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_status, last_checked)
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, 'UP', NOW())
        ON CONFLICT (ip, COALESCE(subnet, ''), COALESCE(cidr, '')) 
        DO UPDATE SET 
          last_status = 'UP',
          last_checked = NOW(),
          last_updated_by = $6,
          status = COALESCE($3, ips.status),
          hostname = CASE WHEN $2 != '' THEN $2 ELSE ips.hostname END
      `, [ip, hostname || '', status || 'Active', note || '', tab_id || null, username, subnet || '', cidr || '']);
      count++;
    }
    await client.query('COMMIT');
    logSystemEvent('IP_MGMT', `Bulk imported ${count} IPs`, req.user.id);
    res.json({ message: `Successfully processed ${count} IPs`, count });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Bulk import failed' });
  } finally {
    client.release();
  }
});

// --- Backup & Import Routes ---

// Ensure upload directory exists
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper: sanitize a DB row for safe JSON serialization
const sanitizeRow = (row) => {
  const sanitized = {};
  Object.keys(row).forEach(key => {
    const value = row[key];
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = value.toString('base64');
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      try { sanitized[key] = JSON.parse(JSON.stringify(value)); } catch (e) { sanitized[key] = String(value); }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (item instanceof Date) return item.toISOString();
        if (typeof item === 'bigint') return item.toString();
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

// --- JSON Full Backup Export ---
app.get('/api/backup/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users, ips, tabs, settings, logs] = await Promise.all([
      pool.query('SELECT * FROM users ORDER BY id'),
      pool.query('SELECT * FROM ips ORDER BY id'),
      pool.query('SELECT id, name, is_public, share_token, is_default_public, created_at FROM tabs ORDER BY id'),
      pool.query('SELECT * FROM settings'),
      pool.query('SELECT * FROM system_logs ORDER BY id')
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '2.0',
      summary: {
        users: users.rows.length,
        ips: ips.rows.length,
        tabs: tabs.rows.length,
        settings: settings.rows.length,
        logs: logs.rows.length
      },
      users: users.rows.map(sanitizeRow),
      ips: ips.rows.map(sanitizeRow),
      tabs: tabs.rows.map(sanitizeRow),
      settings: settings.rows.map(sanitizeRow),
      system_logs: logs.rows.map(sanitizeRow)
    };

    let jsonString;
    try {
      jsonString = JSON.stringify(backupData, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2);
    } catch (stringifyErr) {
      console.error('JSON stringify error:', stringifyErr);
      return res.status(500).json({ error: 'Failed to serialize backup data: ' + stringifyErr.message });
    }

    logSystemEvent('BACKUP', `Exported full system backup (${ips.rows.length} IPs, ${tabs.rows.length} tabs, ${users.rows.length} users)`, req.user.id);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename=ip-manager-backup-${dateStr}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: 'Backup export failed: ' + err.message });
  }
});

// --- JSON Full Backup Import ---
app.post('/api/backup/import', authenticateToken, requireAdmin, async (req, res) => {
  const { data, mode } = req.body;

  // Validate request
  if (!data) return res.status(400).json({ error: 'No backup data provided' });
  if (!mode || !['merge', 'replace'].includes(mode)) return res.status(400).json({ error: 'Invalid mode. Use "merge" or "replace".' });
  if (!data.tabs && !data.ips && !data.users && !data.settings) {
    return res.status(400).json({ error: 'Backup file appears empty — no tables found in data.' });
  }

  const summary = { users: 0, tabs: 0, ips: 0, settings: 0 };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Replace mode: truncate
    if (mode === 'replace') {
      await client.query('TRUNCATE TABLE system_logs RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE ips RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE tabs RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE settings');
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }

    // 2. Import Users
    if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        try {
          if (mode === 'replace') {
            await client.query(
              `INSERT INTO users (id, username, password, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
              [user.id, user.username, user.password, user.role, user.is_active !== false, user.created_at || new Date().toISOString()]
            );
          } else {
            await client.query(
              `INSERT INTO users (username, password, role, is_active, created_at) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password, role=EXCLUDED.role, is_active=EXCLUDED.is_active`,
              [user.username, user.password, user.role, user.is_active !== false, user.created_at || new Date().toISOString()]
            );
          }
          summary.users++;
        } catch (e) {
          console.error('User import error:', user.username, e.message);
        }
      }
    }

    // 3. Import Tabs & Build Map
    const tabIdMap = new Map();
    if (data.tabs && Array.isArray(data.tabs)) {
      for (const tab of data.tabs) {
        try {
          if (mode === 'replace') {
            await client.query(
              `INSERT INTO tabs (id, name, is_public, share_token, is_default_public, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
              [tab.id, tab.name, tab.is_public || false, tab.share_token || null, tab.is_default_public || false, tab.created_at || new Date().toISOString()]
            );
            tabIdMap.set(tab.id, tab.id);
          } else {
            const r = await client.query(
              `INSERT INTO tabs (name, is_public, share_token, is_default_public, created_at) VALUES ($1, $2, $3, $4, $5) 
               ON CONFLICT (name) DO UPDATE SET is_public=EXCLUDED.is_public, share_token=COALESCE(tabs.share_token, EXCLUDED.share_token), is_default_public=EXCLUDED.is_default_public, created_at=EXCLUDED.created_at 
               RETURNING id`,
              [tab.name, tab.is_public || false, tab.share_token || null, tab.is_default_public || false, tab.created_at || new Date().toISOString()]
            );
            tabIdMap.set(tab.id, r.rows[0].id);
          }
          summary.tabs++;
        } catch (e) {
          console.error('Tab import error:', tab.name, e.message);
        }
      }
    }

    // 4. Import IPs
    if (data.ips && Array.isArray(data.ips)) {
      for (const ip of data.ips) {
        try {
          let newTabId = ip.tab_id;
          if (ip.tab_id && tabIdMap.has(ip.tab_id)) {
            newTabId = tabIdMap.get(ip.tab_id);
          } else if (mode === 'merge' && ip.tab_id) {
            newTabId = null;
          }

          if (mode === 'replace') {
            await client.query(
              `INSERT INTO ips (id, ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_checked, last_status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [ip.id, ip.ip, ip.hostname, ip.ports, ip.status, ip.note, newTabId, ip.created_by, ip.last_updated_by, ip.subnet || '', ip.cidr || '', ip.last_checked, ip.last_status, ip.created_at || new Date().toISOString()]
            );
          } else {
            await client.query(
              `INSERT INTO ips (ip, hostname, ports, status, note, tab_id, created_by, last_updated_by, subnet, cidr, last_checked, last_status, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (ip, COALESCE(subnet, ''), COALESCE(cidr, '')) DO UPDATE SET 
                 hostname=EXCLUDED.hostname, ports=EXCLUDED.ports, status=EXCLUDED.status, note=EXCLUDED.note, tab_id=EXCLUDED.tab_id, last_updated_by=EXCLUDED.last_updated_by`,
              [ip.ip, ip.hostname, ip.ports, ip.status, ip.note, newTabId, ip.created_by, ip.last_updated_by, ip.subnet || '', ip.cidr || '', ip.last_checked, ip.last_status, ip.created_at || new Date().toISOString()]
            );
          }
          summary.ips++;
        } catch (e) {
          console.error('IP import error:', ip.ip, e.message);
        }
      }
    }

    // 5. Import Settings
    if (data.settings && Array.isArray(data.settings)) {
      for (const s of data.settings) {
        try {
          await client.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [s.key, s.value]);
          summary.settings++;
        } catch (e) {
          console.error('Setting import error:', s.key, e.message);
        }
      }
    }

    // 6. Reset Sequences safely
    try {
      await client.query(`SELECT setval('users_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1))`);
      await client.query(`SELECT setval('tabs_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM tabs), 1), 1))`);
      await client.query(`SELECT setval('ips_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM ips), 1), 1))`);
    } catch (seqErr) {
      console.error('Sequence reset warning:', seqErr.message);
    }

    await client.query('COMMIT');

    // 7. Ensure Admin safety net
    await seedAdmin();

    logSystemEvent('BACKUP', `Imported backup (Mode: ${mode}) — Users: ${summary.users}, Tabs: ${summary.tabs}, IPs: ${summary.ips}, Settings: ${summary.settings}`, req.user.id);
    res.json({
      message: 'Backup imported successfully',
      summary
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
});

// --- Excel Export (all IPs) ---
app.get('/api/backup/export-excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ips = await pool.query(`
      SELECT i.ip, i.hostname, i.ports, i.status, i.note, i.subnet, i.cidr, 
             i.last_status, i.last_checked, i.created_by, i.created_at,
             t.name as tab_name 
      FROM ips i LEFT JOIN tabs t ON i.tab_id = t.id 
      ORDER BY i.id
    `);

    const wb = xlsx.utils.book_new();
    const headers = ['IP', 'Hostname', 'Ports', 'Status', 'Ping Status', 'Last Checked', 'Note', 'Tab', 'Subnet', 'CIDR', 'Created By', 'Created At'];
    const wsData = [headers];

    for (const row of ips.rows) {
      wsData.push([
        row.ip,
        row.hostname || '',
        row.ports || '',
        row.status || '',
        row.last_status || '',
        row.last_checked ? new Date(row.last_checked).toLocaleString() : '',
        row.note || '',
        row.tab_name || '',
        row.subnet || '',
        row.cidr || '',
        row.created_by || '',
        row.created_at ? new Date(row.created_at).toLocaleString() : ''
      ]);
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    xlsx.utils.book_append_sheet(wb, ws, 'IP Records');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename=ip-records-${dateStr}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    logSystemEvent('EXPORT', `Exported ${ips.rows.length} IPs to Excel`, req.user.id);
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Excel export failed: ' + err.message });
  }
});

// --- Excel/CSV Import ---
app.post('/api/backup/import-excel', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let rawData = [];
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Excel file has no sheets' });
    }
    rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    if (rawData.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File is empty' });
    }

    const firstRow = rawData[0];
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    let headers = [];
    let dataRows = [];

    if (firstRow.length > 0 && typeof firstRow[0] === 'string' && ipRegex.test(firstRow[0].trim())) {
      headers = ['ip'];
      dataRows = rawData;
    } else {
      headers = firstRow.map(h => (h ? String(h).trim().toLowerCase().replace(/[\s_-]+/g, '') : ''));
      dataRows = rawData.slice(1);
    }

    const errors = [];
    const validRows = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0 || !row.some(v => v !== null && v !== undefined && String(v).trim() !== '')) {
        skippedCount++;
        continue;
      }

      processedCount++;

      const rowObj = {};
      if (headers.length === 1 && headers[0] === 'ip') {
        rowObj['ip'] = typeof row[0] === 'string' ? row[0].trim() : String(row[0] || '').trim();
      } else {
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            rowObj[header] = typeof row[index] === 'string' ? row[index].trim() : row[index];
          }
        });
      }

      const ip = String(rowObj['ip'] || rowObj['ipaddress'] || rowObj['address'] || '').trim();

      if (!ip || !ipRegex.test(ip)) {
        errors.push(`Row ${i + (headers[0] === 'ip' && headers.length === 1 ? 1 : 2)}: Invalid IP "${ip || '(empty)'}"`);
        continue;
      }

      validRows.push({
        ip,
        hostname: String(rowObj['hostname'] || rowObj['host'] || '').trim(),
        ports: String(rowObj['ports'] || rowObj['port'] || '').trim(),
        status: String(rowObj['status'] || 'Available').trim(),
        note: String(rowObj['note'] || rowObj['notes'] || rowObj['description'] || '').trim(),
        subnet: String(rowObj['subnet'] || '').trim(),
        cidr: String(rowObj['cidr'] || '').trim()
      });
    }

    console.log(`Excel Import: ${validRows.length} valid / ${processedCount} processed / ${skippedCount} skipped`);

    const client = await pool.connect();
    let insertedCount = 0;
    let duplicateCount = 0;
    try {
      await client.query('BEGIN');
      for (const row of validRows) {
        try {
          const subnet = row.subnet || '';
          const cidr = row.cidr || '';
          const result = await client.query(
            `INSERT INTO ips (ip, hostname, ports, status, note, created_by, last_updated_by, subnet, cidr, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (ip, COALESCE(subnet, ''), COALESCE(cidr, '')) DO NOTHING
             RETURNING id`,
            [row.ip, row.hostname, row.ports, row.status, row.note, req.user.username, req.user.username, subnet, cidr]
          );
          if (result.rowCount > 0) {
            insertedCount++;
          } else {
            duplicateCount++;
          }
        } catch (e) {
          errors.push(`IP ${row.ip}: ${e.message}`);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Cleanup
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    logSystemEvent('IMPORT', `Imported ${insertedCount} IPs from Excel/CSV (${duplicateCount} duplicates skipped)`, req.user.id);

    res.json({
      message: `Successfully imported ${insertedCount} IP records`,
      errors: errors.slice(0, 50),
      summary: {
        processed: processedCount,
        created: insertedCount,
        duplicates: duplicateCount,
        skipped: skippedCount,
        errorCount: errors.length
      }
    });

  } catch (err) {
    console.error('Excel import error:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// --- Download Excel Template ---
app.get('/api/backup/template', (req, res) => {
  const wb = xlsx.utils.book_new();
  const ws_data = [
    ['IP', 'Hostname', 'Ports', 'Status', 'Note', 'Subnet', 'CIDR'],
    ['192.168.1.10', 'server-01', '80, 443', 'Available', 'Main Web Server', '255.255.255.0', '/24'],
    ['10.0.0.1', 'gateway', '22', 'Up', 'Core Router', '255.255.255.0', '/24']
  ];
  const ws = xlsx.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 8 }];
  xlsx.utils.book_append_sheet(wb, ws, 'Template');

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

app.get('/api/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 500');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Clear all logs
app.delete('/api/logs/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM system_logs RETURNING id');
    logSystemEvent('LOGS', `Cleared all logs (${result.rows.length} entries)`, req.user.id);
    res.json({ message: `Cleared ${result.rows.length} log entries`, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Export logs as JSON
app.get('/api/logs/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_logs ORDER BY created_at DESC');
    const exportData = {
      exported_at: new Date().toISOString(),
      total_logs: result.rows.length,
      logs: result.rows
    };

    logSystemEvent('LOGS', `Exported ${result.rows.length} log entries`, req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename=system-logs-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get auto-delete configuration
app.get('/api/logs/auto-delete-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const enabledRes = await pool.query("SELECT value FROM settings WHERE key = 'logs_auto_delete_enabled'");
    const hoursRes = await pool.query("SELECT value FROM settings WHERE key = 'logs_auto_delete_hours'");
    const logsEnabledRes = await pool.query("SELECT value FROM settings WHERE key = 'logs_enabled'");

    const enabled = enabledRes.rows.length > 0 ? enabledRes.rows[0].value === 'true' : false;
    const hours = hoursRes.rows.length > 0 ? parseInt(hoursRes.rows[0].value) : 24;
    const logsEnabled = logsEnabledRes.rows.length > 0 ? logsEnabledRes.rows[0].value === 'true' : true;

    res.json({ enabled, hours, logsEnabled });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Set auto-delete configuration
app.post('/api/logs/auto-delete-config', authenticateToken, requireAdmin, async (req, res) => {
  const { enabled, hours, logsEnabled } = req.body;

  if (typeof enabled !== 'boolean' || !hours || hours < 1 || hours > 8760) {
    return res.status(400).json({ error: 'Invalid configuration. Hours must be between 1 and 8760.' });
  }

  try {
    await pool.query("INSERT INTO settings (key, value) VALUES ('logs_auto_delete_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [enabled.toString()]);
    await pool.query("INSERT INTO settings (key, value) VALUES ('logs_auto_delete_hours', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [hours.toString()]);

    if (typeof logsEnabled === 'boolean') {
      await pool.query("INSERT INTO settings (key, value) VALUES ('logs_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [logsEnabled.toString()]);
      SYSTEM_LOGS_ENABLED = logsEnabled;
    }

    logSystemEvent('LOGS', `Updated log config: Auto-Delete=${enabled}, Hours=${hours}, LogsEnabled=${logsEnabled}`, req.user.id);
    res.json({ message: 'Configuration updated', enabled, hours, logsEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Manual trigger for auto-delete (deletes logs older than configured hours)
app.post('/api/logs/auto-delete-run', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hoursRes = await pool.query("SELECT value FROM settings WHERE key = 'logs_auto_delete_hours'");
    const hours = hoursRes.rows.length > 0 ? parseInt(hoursRes.rows[0].value) : 24;

    const result = await pool.query(
      `DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '${hours} hours' RETURNING id`
    );

    logSystemEvent('LOGS', `Auto-deleted ${result.rows.length} old log entries (older than ${hours} hours)`, req.user.id);
    res.json({ message: `Deleted ${result.rows.length} old log entries`, count: result.rows.length, hours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Auto-delete failed' });
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
        is_public BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(64) UNIQUE,
        is_default_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE tabs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE tabs ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`);
    await client.query(`ALTER TABLE tabs ADD COLUMN IF NOT EXISTS is_default_public BOOLEAN DEFAULT FALSE`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS tabs_share_token_idx ON tabs (share_token) WHERE share_token IS NOT NULL`);
    // Ensure default public sharing tab exists
    await client.query(`
      INSERT INTO tabs (name, is_public, share_token, is_default_public)
      VALUES ('Public Sharing', TRUE, 'default-public-share-token-static', TRUE)
      ON CONFLICT (name) DO UPDATE SET is_public = TRUE, share_token = COALESCE(tabs.share_token, 'default-public-share-token-static'), is_default_public = TRUE
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
  server.timeout = 0;
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
