const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Routes
app.get('/api/ips', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ips ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ips', async (req, res) => {
  const { ip, label } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  
  try {
    const result = await pool.query(
      'INSERT INTO ips (ip, label) VALUES ($1, $2) RETURNING *',
      [ip, label || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/ips/:id', async (req, res) => {
  const { id } = req.params;
  const { ip, label } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE ips SET ip = COALESCE($1, ip), label = COALESCE($2, label) WHERE id = $3 RETURNING *',
      [ip, label, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/ips/:id', async (req, res) => {
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

app.post('/api/ping', (req, res) => {
  const { ip } = req.body;
  
  // Basic validation: Hostname or IP
  const isValid = /^[a-zA-Z0-9.-]+$/.test(ip);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid IP/Hostname format' });
  }

  execFile('ping', ['-c', '3', ip], (error, stdout, stderr) => {
    const raw = stdout + stderr;
    const alive = !error;
    
    // Parse packet loss
    const lossMatch = raw.match(/(\d+)% packet loss/);
    const packetLoss = lossMatch ? parseInt(lossMatch[1]) : 100;

    // Parse latency (min/avg/max/mdev)
    // Output format varies by distro, usually: rtt min/avg/max/mdev = 14.212/14.354/14.512/0.124 ms
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
