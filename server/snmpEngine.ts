import { db } from './db.js';
import { scanIpsBatch } from './networkUtils.js';
import { SnmpMonitoringConfig, AuditLog } from '../src/types.js';

class SnmpEngine {
  private timer: NodeJS.Timeout | null = null;
  private isProbing = false;

  public init() {
    console.log('[SNMP Engine] Initializing background telemetry engine...');
    this.restart();
  }

  public restart() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const state = db.getState();
    const config = state.snmpConfig;
    if (!config || !config.enabled) {
      console.log('[SNMP Engine] Telemetry monitoring is currently paused (disabled).');
      return;
    }

    const intervalSec = Math.max(3, config.intervalSeconds || 30);
    console.log(`[SNMP Engine] Background telemetry monitoring active: polling every ${intervalSec}s.`);

    // Run first cycle shortly after start (1.5 seconds)
    setTimeout(() => {
      this.runProbeCycle().catch((err) => {
        console.error('[SNMP Engine Startup Probe Error]:', err);
      });
    }, 1500);

    // Continue ticking reliably on the server
    this.timer = setInterval(() => {
      this.runProbeCycle().catch((err) => {
        console.error('[SNMP Engine Cycle Error]:', err);
      });
    }, intervalSec * 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SNMP Engine] Background timer cleared.');
    }
  }

  public async runProbeCycle(): Promise<{ scannedCount: number; onlineCount: number; offlineCount: number }> {
    if (this.isProbing) {
      return { scannedCount: 0, onlineCount: 0, offlineCount: 0 };
    }
    this.isProbing = true;

    try {
      const state = db.getState();
      const config = state.snmpConfig;
      if (!config) {
        return { scannedCount: 0, onlineCount: 0, offlineCount: 0 };
      }

      // Collect classifications where SNMP/monitoring is enabled
      const monitoredClassCodes = new Set(
        (state.deviceClassifications || [])
          .filter((d) => d.snmpEnabled)
          .map((d) => d.code.toLowerCase())
      );

      // Find non-available IPs belonging to monitored classifications
      const targetIps = (state.ips || [])
        .filter(
          (i) =>
            i.status !== 'available' &&
            i.deviceType &&
            monitoredClassCodes.has(i.deviceType.toLowerCase())
        )
        .map((i) => i.ip);

      if (targetIps.length === 0) {
        const updatedConfig: SnmpMonitoringConfig = {
          ...config,
          lastPolledAt: new Date().toISOString(),
          totalPollCycles: (config.totalPollCycles || 0) + 1,
        };
        db.updateState({ snmpConfig: updatedConfig });
        return { scannedCount: 0, onlineCount: 0, offlineCount: 0 };
      }

      // Execute network reachability probe
      const scanResults = await scanIpsBatch(targetIps, { probePorts: false, resolveDns: false });
      const resultMap = new Map(scanResults.map((r) => [r.ip, r]));

      const onlineResults = scanResults.filter((r) => r.online);
      const onlineCount = onlineResults.length;
      const offlineCount = targetIps.length - onlineCount;

      const avgLatency =
        onlineResults.length > 0
          ? Math.round(
              onlineResults.reduce((acc, r) => acc + (r.latencyMs || 0), 0) / onlineResults.length
            )
          : 0;

      let statusTransitionsCount = 0;
      const updatedIps = (state.ips || []).map((rec) => {
        const probe = resultMap.get(rec.ip);
        if (!probe) return rec;

        const newStatus = probe.online ? ('online' as const) : ('offline' as const);
        if (rec.lastPingStatus !== newStatus) {
          statusTransitionsCount++;
        }

        return {
          ...rec,
          lastPingStatus: newStatus,
          lastPingAt: new Date().toISOString(),
          lastPingLatencyMs: probe.latencyMs,
        };
      });

      const updatedConfig: SnmpMonitoringConfig = {
        ...config,
        lastPolledAt: new Date().toISOString(),
        totalPollCycles: (config.totalPollCycles || 0) + 1,
        lastLatencyMs: avgLatency,
      };

      db.updateState({
        ips: updatedIps,
        snmpConfig: updatedConfig,
      });

      // Log status transition event to audit logs if any device flipped
      if (statusTransitionsCount > 0) {
        const currentAuditLogs = state.auditLogs || [];
        const newLog: AuditLog = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          actorUsername: 'system',
          actorAuthType: 'local',
          actorRole: 'super_admin',
          category: 'system',
          action: 'Telemetry State Transition',
          target: `${statusTransitionsCount} IP(s) changed health state`,
          details: `Background poll: ${onlineCount} online, ${offlineCount} unreachable (${avgLatency}ms latency).`,
          severity: 'info',
        };
        db.updateState({ auditLogs: [newLog, ...currentAuditLogs].slice(0, 1000) });
      }

      return { scannedCount: targetIps.length, onlineCount, offlineCount };
    } catch (err: any) {
      console.error('[SNMP Engine Execution Error]:', err?.message || err);
      return { scannedCount: 0, onlineCount: 0, offlineCount: 0 };
    } finally {
      this.isProbing = false;
    }
  }
}

export const snmpEngine = new SnmpEngine();
