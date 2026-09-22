import fs from 'fs';
import path from 'path';
import pg from 'pg';
import {
  INITIAL_USERS,
  INITIAL_SUBNETS,
  INITIAL_IPS,
  INITIAL_LDAP_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_DEVICE_CLASSIFICATIONS,
  INITIAL_AUDIT_SETTINGS,
  INITIAL_SNMP_CONFIG,
} from '../src/data/initialData.js';

export interface IPAMDatabase {
  version: string;
  updatedAt: string;
  users: typeof INITIAL_USERS;
  subnets: typeof INITIAL_SUBNETS;
  ips: typeof INITIAL_IPS;
  ldapConfig: typeof INITIAL_LDAP_CONFIG;
  auditLogs: typeof INITIAL_AUDIT_LOGS;
  deviceClassifications: typeof INITIAL_DEVICE_CLASSIFICATIONS;
  auditSettings: typeof INITIAL_AUDIT_SETTINGS;
  snmpConfig: typeof INITIAL_SNMP_CONFIG;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ipam-database.json');

// Ensure persistent data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getFreshBaselineDatabase(): IPAMDatabase {
  return {
    version: '3.2.0',
    updatedAt: new Date().toISOString(),
    users: INITIAL_USERS,
    subnets: INITIAL_SUBNETS,
    ips: INITIAL_IPS,
    ldapConfig: INITIAL_LDAP_CONFIG,
    auditLogs: INITIAL_AUDIT_LOGS,
    deviceClassifications: INITIAL_DEVICE_CLASSIFICATIONS,
    auditSettings: INITIAL_AUDIT_SETTINGS,
    snmpConfig: INITIAL_SNMP_CONFIG,
  };
}

/**
 * Older imports and database snapshots may omit optional-looking fields that
 * the UI relies on. Normalize them at the persistence boundary so one legacy
 * record cannot prevent the entire application from rendering.
 */
function normalizeState(data: IPAMDatabase): IPAMDatabase {
  const state = data as any;
  const subnets = Array.isArray(state.subnets) ? state.subnets : [];

  return {
    ...state,
    subnets: subnets.map((subnet: any) => ({
      ...subnet,
      name: typeof subnet?.name === 'string' ? subnet.name : 'Unnamed subnet',
      cidr: typeof subnet?.cidr === 'string' ? subnet.cidr : '',
      location: typeof subnet?.location === 'string' ? subnet.location : 'Unassigned location',
      description: typeof subnet?.description === 'string' ? subnet.description : '',
      tags: Array.isArray(subnet?.tags)
        ? subnet.tags.filter((tag: unknown) => typeof tag === 'string')
        : [],
      dnsServers: Array.isArray(subnet?.dnsServers)
        ? subnet.dnsServers.filter((server: unknown) => typeof server === 'string')
        : [],
    })),
    ips: Array.isArray(state.ips) ? state.ips : [],
    users: (() => {
      let userList: any[] = Array.isArray(state.users) ? [...state.users] : [];
      const adminIndex = userList.findIndex(
        (u: any) => u && (u.username?.toLowerCase() === 'admin' || u.id === 'usr-admin')
      );
      const defaultAdmin = INITIAL_USERS[0];

      if (adminIndex === -1) {
        // Admin was somehow deleted; restore baseline root admin account
        userList.unshift(defaultAdmin);
      } else {
        // Ensure admin retains root privileges and active status
        userList[adminIndex] = {
          ...userList[adminIndex],
          role: 'super_admin',
          status: 'active',
          permissions: {
            ...userList[adminIndex].permissions,
            manageUsers: true,
            manageAuthSettings: true,
            manageDeviceClassifications: true,
            manageAuditSettings: true,
            clearAuditLogs: true,
            createSubnet: true,
            editSubnet: true,
            deleteSubnet: true,
            allocateIP: true,
            releaseIP: true,
            editIP: true,
            viewAuditLogs: true,
            exportData: true,
          },
        };
      }
      return userList;
    })(),
    auditLogs: Array.isArray(state.auditLogs) ? state.auditLogs : [],
    deviceClassifications: (() => {
      const list = Array.isArray(state.deviceClassifications) ? state.deviceClassifications : [];
      return list.map((dc: any) => ({
        id: typeof dc?.id === 'string' ? dc.id : `devclass-${(dc?.code || 'custom').toLowerCase()}`,
        name: typeof dc?.name === 'string' ? dc.name : 'Unnamed Classification',
        code: typeof dc?.code === 'string' ? dc.code : 'custom',
        category: typeof dc?.category === 'string' ? dc.category : 'Custom Appliance',
        description: typeof dc?.description === 'string' ? dc.description : '',
        icon: typeof dc?.icon === 'string' ? dc.icon : 'server',
        color: typeof dc?.color === 'string' ? dc.color : 'blue',
        vendor: typeof dc?.vendor === 'string' ? dc.vendor : '',
        defaultPorts: typeof dc?.defaultPorts === 'string' ? dc.defaultPorts : '',
        snmpEnabled: dc?.snmpEnabled !== false,
        createdAt: dc?.createdAt || new Date().toISOString(),
        updatedAt: dc?.updatedAt || new Date().toISOString(),
      }));
    })(),
    snmpConfig: state.snmpConfig && typeof state.snmpConfig === 'object'
      ? { ...INITIAL_SNMP_CONFIG, ...state.snmpConfig }
      : INITIAL_SNMP_CONFIG,
  } as IPAMDatabase;
}

class DatabaseManager {
  private memoryCache: IPAMDatabase;
  private pgPool: pg.Pool | null = null;
  private isPgReady = false;

  constructor() {
    this.memoryCache = this.loadFromDisk();
    this.initializePostgres();
  }

  private async initializePostgres() {
    const connectionString =
      process.env.DATABASE_URL ||
      (process.env.POSTGRES_HOST
        ? `postgresql://${process.env.POSTGRES_USER || 'ipam_user'}:${process.env.POSTGRES_PASSWORD || 'ipam_password'}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'ipam_db'}`
        : null);

    if (!connectionString) {
      console.log('[Database Tier] No PostgreSQL connection string provided. Running embedded persistent storage.');
      return;
    }

    try {
      console.log('[Database Tier] Connecting to 2-Tier PostgreSQL server...');
      this.pgPool = new pg.Pool({
        connectionString,
        connectionTimeoutMillis: 5000,
      });

      // Create state persistence table in PostgreSQL
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS ipam_state (
          id VARCHAR(64) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      const res = await this.pgPool.query(`SELECT data FROM ipam_state WHERE id = 'active_state'`);
      if (res.rows.length > 0 && res.rows[0].data) {
        console.log('[Database Tier] Loaded existing state from PostgreSQL.');
        this.memoryCache = normalizeState(res.rows[0].data);
        this.saveToDisk(this.memoryCache);
      } else {
        console.log('[Database Tier] Initializing fresh state table in PostgreSQL...');
        await this.pgPool.query(
          `INSERT INTO ipam_state (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
          ['active_state', JSON.stringify(this.memoryCache)]
        );
      }
      this.isPgReady = true;
      console.log('[Database Tier] PostgreSQL 2-Tier connection established and synchronized.');
    } catch (err) {
      console.warn('[Database Tier] PostgreSQL connection unavailable, operating in standalone persistent disk mode:', (err as Error).message);
    }
  }

  private loadFromDisk(): IPAMDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.subnets) && Array.isArray(parsed.users)) {
          // If previous version had legacy demo subnets or users, reset to fresh clean state
          const hasLegacyDemo = parsed.users.some(
            (u: any) => u.username === 'sarah.ad' || u.username === 'mark.branch'
          ) || parsed.subnets.some((s: any) => s.id === 'subnet-hq' || s.id === 'subnet-prod');

          if (!hasLegacyDemo) {
            // Ensure admin password is 'admin'
            parsed.users = parsed.users.map((u: any) =>
              u.username === 'admin' ? { ...u, localPassword: 'admin' } : u
            );
            // Ensure baseline users exist
            for (const u of INITIAL_USERS) {
              if (!parsed.users.some((existing: any) => existing.username === u.username)) {
                parsed.users.push(u);
              }
            }
            parsed.version = '3.2.0';
            return normalizeState(parsed);
          }
        }
      }
    } catch (err) {
      console.error('[DB] Failed to read database from disk, using fresh baseline:', err);
    }

    const baseline = getFreshBaselineDatabase();
    this.saveToDisk(baseline);
    return baseline;
  }

  private saveToDisk(data: IPAMDatabase): void {
    try {
      data.updatedAt = new Date().toISOString();
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Error writing to disk:', err);
    }
  }

  private async syncToPostgres(data: IPAMDatabase) {
    if (!this.isPgReady || !this.pgPool) return;
    try {
      await this.pgPool.query(
        `INSERT INTO ipam_state (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
        ['active_state', JSON.stringify(data)]
      );
    } catch (err) {
      console.error('[Database Tier] Error syncing state to PostgreSQL:', err);
    }
  }

  public getState(): IPAMDatabase {
    return this.memoryCache;
  }

  public updateState(partial: Partial<IPAMDatabase>): IPAMDatabase {
    this.memoryCache = normalizeState({
      ...this.memoryCache,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
    this.saveToDisk(this.memoryCache);
    this.syncToPostgres(this.memoryCache);
    return this.memoryCache;
  }

  public resetToDefaults(): IPAMDatabase {
    const baseline = getFreshBaselineDatabase();
    this.memoryCache = baseline;
    this.saveToDisk(baseline);
    this.syncToPostgres(baseline);
    return this.memoryCache;
  }

  public isPostgresConnected(): boolean {
    return this.isPgReady;
  }
}

export const db = new DatabaseManager();
