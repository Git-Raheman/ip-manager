import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import {
  pingHost,
  resolveDns,
  getArpTable,
  scanPorts,
  inferDeviceType,
  scanIpsBatch,
  isValidIPv4,
} from './server/networkUtils.js';
import { authenticateLdapUser, testLdapDirectory } from './server/ldapUtils.js';
import { verifyPassword, hashPassword, sanitizeUser, sanitizeUsers } from './server/authUtils.js';
import { LdapConfig } from './src/types.js';
import { snmpEngine } from './server/snmpEngine.js';

async function startServer() {
  const app = express();
  // Unique server instance boot token (changes whenever Docker container restarts or rebuilds)
  const SERVER_BOOT_ID = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  // Use APP_PORT (e.g. 80 in Docker) or default to 3000 for local development
  const PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000;

  // Security & Body Parser Middlewares (Supports large enterprise IP databases)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Standard Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Anti-cache headers for all API requests to ensure live updates without Chrome cache
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // ==========================================
  // REST API Endpoints
  // ==========================================

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      serverBootId: SERVER_BOOT_ID,
      database: 'connected',
      databaseEngine: db.isPostgresConnected() ? 'PostgreSQL (2-Tier)' : 'Persistent Disk Storage',
      version: '3.2.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Get full IPAM state from database (sanitized)
  app.get('/api/ipam/state', (req, res) => {
    try {
      const state = db.getState();
      const sanitizedState = {
        ...state,
        users: sanitizeUsers(state.users),
      };
      res.json({ success: true, serverBootId: SERVER_BOOT_ID, data: sanitizedState });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch database state' });
    }
  });

  // Sync client state into database
  app.post('/api/ipam/sync', (req, res) => {
    try {
      const payload = req.body || {};
      const currentState = db.getState();

      // Preserve existing hashed passwords for users if client omitted them & enforce admin preservation
      if (Array.isArray(payload.users)) {
        const hasAdmin = payload.users.some(
          (u: any) => u && (u.username?.toLowerCase() === 'admin' || u.id === 'usr-admin')
        );
        if (!hasAdmin) {
          // If a client tried to sync without admin, restore the existing admin from database
          const existingAdmin = currentState.users.find(
            (u) => u.username.toLowerCase() === 'admin' || u.id === 'usr-admin'
          );
          if (existingAdmin) {
            payload.users.unshift(existingAdmin);
          }
        }

        payload.users = payload.users.map((incomingUser: any) => {
          const existing = currentState.users.find((u) => u.id === incomingUser.id);
          const isRoot = incomingUser.username?.toLowerCase() === 'admin' || incomingUser.id === 'usr-admin';

          let processed = { ...incomingUser };
          if (existing && existing.localPassword && !incomingUser.localPassword) {
            processed.localPassword = existing.localPassword;
          }

          // Enforce root admin invariant
          if (isRoot) {
            processed.role = 'super_admin';
            processed.status = 'active';
          }

          return processed;
        });
      }

      const updated = db.updateState(payload);
      res.json({ success: true, message: 'Database state updated', updatedAt: updated.updatedAt });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to sync database state' });
    }
  });

  // Server-side Authentication endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
      }

      const trimmedUser = String(username).trim().toLowerCase();
      const state = db.getState();
      const user = state.users.find(
        (u) =>
          u.username.toLowerCase() === trimmedUser ||
          (u.email && u.email.toLowerCase() === trimmedUser) ||
          (u.ldapUpn && u.ldapUpn.toLowerCase() === trimmedUser)
      );

      if (!user) {
        return res.status(401).json({ success: false, message: `User '${username}' not found in database.` });
      }

      if (user.status === 'disabled') {
        return res.status(403).json({ success: false, message: 'Account has been deactivated by administrator.' });
      }

      // Branch 1: Local Account Authentication (Bcrypt verified)
      if (user.authType === 'local') {
        const { isValid, needsUpgrade } = await verifyPassword(password, user.localPassword);

        if (!isValid) {
          return res.status(401).json({ success: false, message: 'Invalid username or password provided.' });
        }

        let updatedUser = { ...user, lastLoginAt: new Date().toISOString() };

        // Automatically upgrade legacy plaintext password to secure bcrypt hash
        if (needsUpgrade) {
          const hashedPassword = await hashPassword(password);
          updatedUser.localPassword = hashedPassword;
        }

        db.updateState({
          users: state.users.map((u) => (u.id === user.id ? updatedUser : u)),
        });

        return res.json({
          success: true,
          message: 'Local authentication successful',
          serverBootId: SERVER_BOOT_ID,
          user: sanitizeUser(updatedUser),
        });
      }

      // Branch 2: Active Directory / LDAP Bind Authentication
      if (user.authType === 'ldap_ad') {
        if (!state.ldapConfig || !state.ldapConfig.enabled) {
          return res.status(403).json({
            success: false,
            message: 'Active Directory / LDAP authentication is currently disabled in system settings.',
          });
        }

        const ldapIdentifier = user.ldapUpn || user.username;
        const ldapAuthResult = await authenticateLdapUser(state.ldapConfig, ldapIdentifier, password);

        if (!ldapAuthResult.success) {
          return res.status(401).json({
            success: false,
            message: ldapAuthResult.message || 'Active Directory authentication failed: Invalid credentials.',
          });
        }

        const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };
        db.updateState({
          users: state.users.map((u) => (u.id === user.id ? updatedUser : u)),
        });

        return res.json({
          success: true,
          message: `Active Directory bind succeeded (${user.ldapUpn || user.username})`,
          serverBootId: SERVER_BOOT_ID,
          user: sanitizeUser(updatedUser),
        });
      }

      return res.status(400).json({ success: false, message: 'Unknown authentication type.' });
    } catch (err: any) {
      console.error('[Auth Error]:', err);
      return res.status(500).json({ success: false, message: err.message || 'Authentication error occurred' });
    }
  });

  // Reset database to initial defaults
  app.post('/api/ipam/reset', (req, res) => {
    try {
      const resetState = db.resetToDefaults();
      res.json({ success: true, message: 'Database reset to default baseline', data: resetState });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to reset database' });
    }
  });

  // ==========================================
  // Real Network Diagnostic & Discovery APIs
  // ==========================================

  // Ping single host with real OS ICMP and TCP fallback probe
  app.post('/api/network/ping', async (req, res) => {
    try {
      const { ip, timeoutMs = 700, probePorts = true, resolveDns: shouldResolveDns = true } = req.body || {};
      if (!ip || typeof ip !== 'string' || !isValidIPv4(ip.trim())) {
        return res.status(400).json({ success: false, message: 'Valid IPv4 address string is required (e.g. 192.168.1.1)' });
      }

      const cleanIp = ip.trim();
      const ping = await pingHost(cleanIp, timeoutMs);
      const arpTable = await getArpTable();
      const macAddress = arpTable.get(cleanIp) || undefined;

      let hostname: string | undefined;
      if (shouldResolveDns) {
        const resolved = await resolveDns(cleanIp);
        if (resolved) hostname = resolved;
      }

      let openPorts: string[] = [];
      if (ping.online && probePorts) {
        openPorts = await scanPorts(cleanIp);
      }

      const deviceType = ping.online ? inferDeviceType(cleanIp, hostname, openPorts, macAddress) : undefined;

      return res.json({
        success: true,
        ip: cleanIp,
        online: ping.online,
        latencyMs: ping.latencyMs,
        hostname,
        macAddress,
        openPorts,
        deviceType,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error executing ping probe' });
    }
  });

  // Batch scan multiple IPs concurrently with real network probes
  app.post('/api/network/scan-batch', async (req, res) => {
    try {
      const { ips, probePorts = true, resolveDns: shouldResolveDns = true } = req.body || {};
      if (!Array.isArray(ips) || ips.length === 0) {
        return res.status(400).json({ success: false, message: 'Array of IP addresses is required' });
      }

      // Filter and cap batch at 256 for network buffer stability
      const validIps = ips.filter((item) => typeof item === 'string' && isValidIPv4(item.trim())).slice(0, 256);
      if (validIps.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid IPv4 addresses provided in batch' });
      }

      const results = await scanIpsBatch(validIps, {
        probePorts,
        resolveDns: shouldResolveDns,
      });

      return res.json({
        success: true,
        scannedCount: validIps.length,
        results,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error executing batch scan' });
    }
  });

  // Fetch current system ARP cache table
  app.get('/api/network/arp-table', async (req, res) => {
    try {
      const arpTable = await getArpTable();
      const entries = Array.from(arpTable.entries()).map(([ip, mac]) => ({ ip, mac }));
      return res.json({ success: true, count: entries.length, entries });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching ARP table' });
    }
  });

  // Diagnostic connection test to Active Directory / LDAP server
  app.post('/api/network/ldap-test', async (req, res) => {
    try {
      const config: LdapConfig = req.body || {};
      const result = await testLdapDirectory(config);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        diagnostics: ['[!] Internal server error during LDAP test: ' + err.message],
        responseTimeMs: 0,
        error: err.message || 'Failed to execute LDAP connection test',
      });
    }
  });

  // ==========================================
  // SNMP Telemetry & Health Monitoring API
  // ==========================================

  // Get current SNMP config
  app.get('/api/snmp/config', (req, res) => {
    try {
      const state = db.getState();
      return res.json({ success: true, config: state.snmpConfig });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching SNMP config' });
    }
  });

  // Update SNMP config & restart/stop background loop
  app.post('/api/snmp/config', (req, res) => {
    try {
      const incoming = req.body || {};
      const currentState = db.getState();
      const updatedConfig = {
        ...currentState.snmpConfig,
        ...incoming,
      };

      db.updateState({ snmpConfig: updatedConfig });
      snmpEngine.restart();

      return res.json({
        success: true,
        message: updatedConfig.enabled ? 'SNMP monitoring active' : 'SNMP monitoring paused',
        config: updatedConfig,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error saving SNMP config' });
    }
  });

  // Trigger an on-demand probe cycle immediately
  app.post('/api/snmp/probe', async (req, res) => {
    try {
      const summary = await snmpEngine.runProbeCycle();
      const state = db.getState();
      return res.json({
        success: true,
        summary,
        config: state.snmpConfig,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error executing SNMP probe' });
    }
  });

  // Fast lightweight endpoint for client polling (health status of IPs and config)
  app.get('/api/snmp/status', (req, res) => {
    try {
      const state = db.getState();
      const ipStatuses = (state.ips || []).map((i) => ({
        id: i.id,
        ip: i.ip,
        lastPingStatus: i.lastPingStatus,
        lastPingAt: i.lastPingAt,
        lastPingLatencyMs: i.lastPingLatencyMs,
      }));

      return res.json({
        success: true,
        config: state.snmpConfig,
        ips: ipStatuses,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching SNMP status' });
    }
  });

  // Start background SNMP telemetry daemon
  snmpEngine.init();

  // ==========================================
  // Vite / Static Assets Middleware
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve hashed assets with long immutable caching
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    // Serve other static files, ensuring HTML is NEVER cached
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    }));
    // Fallback SPA routing - always fresh, no-store
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IPAM Server] Listening on http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
