import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Subnet, IPRecord, DeviceType } from '../types';
import { useIPAM } from '../context/IPAMContext';
import { parseCIDR, generateIPsForSubnet, getSubnetBlocks } from '../utils/ipUtils';
import { renderDeviceIcon as renderUnifiedDeviceIcon } from '../utils/deviceIcons';
import {
  Radar,
  X,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Server,
  Router,
  Monitor,
  Printer,
  Shield,
  Radio,
  Cpu,
  Download,
  Search,
  CheckSquare,
  Square,
  Zap,
  Activity,
  Globe,
  StopCircle,
  HardDrive,
  Info,
} from 'lucide-react';

interface DiscoveredHost {
  id: string;
  ip: string;
  hostname: string;
  macAddress: string;
  deviceType: DeviceType;
  latencyMs: number;
  openPorts: string[];
  isExistingInIPAM: boolean;
  isSelected: boolean;
}

interface SubnetScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnet: Subnet;
  onImportSuccess?: (count: number) => void;
}

export const SubnetScannerModal: React.FC<SubnetScannerModalProps> = ({
  isOpen,
  onClose,
  subnet,
  onImportSuccess,
}) => {
  const { ips, bulkAllocateIPs } = useIPAM();

  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'completed' | 'stopped'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanningIp, setCurrentScanningIp] = useState('');
  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredHost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unmanaged' | 'existing'>('all');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isScanningRef = useRef(false);

  // Subnet CIDR details
  const cidrInfo = useMemo(() => parseCIDR(subnet.cidr), [subnet.cidr]);

  // Handle multi-block subnets (e.g. /16 or /22)
  const blocks = useMemo(() => getSubnetBlocks(subnet.cidr, 256), [subnet.cidr]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);

  // Selected IP target range for scanning (up to 254 host IPs per block)
  const targetIpsToScan = useMemo(() => {
    if (!cidrInfo) return [];
    if (blocks.length > 1 && blocks[selectedBlockIndex]) {
      const blk = blocks[selectedBlockIndex];
      return generateIPsForSubnet(blk.startIp, blk.hostCount, 254);
    }
    return generateIPsForSubnet(cidrInfo.firstUsableIp, cidrInfo.usableHosts, 254);
  }, [cidrInfo, blocks, selectedBlockIndex]);

  // Existing IPs in this subnet
  const existingIpsMap = useMemo(() => {
    const map = new Map<string, IPRecord>();
    ips.filter((i) => i.subnetId === subnet.id).forEach((i) => {
      map.set(i.ip, i);
    });
    return map;
  }, [ips, subnet.id]);

  // Stop active scan
  const stopScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isScanningRef.current = false;
    setScanStatus('stopped');
  }, []);

  // Real Network Batch Scanner
  const runRealNetworkScan = async () => {
    if (targetIpsToScan.length === 0) {
      setErrorMessage('Invalid subnet range or 0 usable IP addresses found.');
      setScanStatus('completed');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isScanningRef.current = true;

    setScanStatus('scanning');
    setScanProgress(0);
    setDiscoveredHosts([]);
    setImportFeedback(null);
    setErrorMessage(null);

    const batchSize = 16;
    const totalIps = targetIpsToScan.length;
    const foundHosts: DiscoveredHost[] = [];

    try {
      for (let i = 0; i < totalIps; i += batchSize) {
        if (!isScanningRef.current || abortController.signal.aborted) {
          break;
        }

        const currentBatch = targetIpsToScan.slice(i, i + batchSize);
        const startIp = currentBatch[0];
        const endIp = currentBatch[currentBatch.length - 1];
        setCurrentScanningIp(currentBatch.length === 1 ? startIp : `${startIp} - ${endIp}`);

        try {
          const response = await fetch('/api/network/scan-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ips: currentBatch,
              probePorts: true,
              resolveDns: true,
            }),
            signal: abortController.signal,
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.results)) {
              for (const item of data.results) {
                if (item.online) {
                  const existing = existingIpsMap.get(item.ip);
                  const isExisting = Boolean(existing && existing.status !== 'available');
                  
                  const hostRecord: DiscoveredHost = {
                    id: `disc-${item.ip}`,
                    ip: item.ip,
                    hostname: item.hostname || existing?.hostname || '',
                    macAddress: item.macAddress || existing?.macAddress || 'Dynamic ARP',
                    deviceType: (item.deviceType || existing?.deviceType || 'server') as DeviceType,
                    latencyMs: item.latencyMs || 1.0,
                    openPorts: item.openPorts || [],
                    isExistingInIPAM: isExisting,
                    isSelected: !isExisting, // Auto-select unmanaged by default
                  };

                  if (!foundHosts.some((h) => h.ip === item.ip)) {
                    foundHosts.push(hostRecord);
                    setDiscoveredHosts([...foundHosts]);
                  }
                }
              }
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') {
            break;
          }
          console.warn(`Scan batch [${startIp}..] failed:`, fetchErr);
        }

        const progressPercent = Math.min(Math.round(((i + currentBatch.length) / totalIps) * 100), 100);
        setScanProgress(progressPercent);
      }

      if (isScanningRef.current && !abortController.signal.aborted) {
        setScanProgress(100);
        setScanStatus('completed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Error occurred during network auto-discovery scan.');
        setScanStatus('completed');
      }
    } finally {
      isScanningRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const startScan = () => {
    runRealNetworkScan();
  };

  // Initial trigger when modal opens
  useEffect(() => {
    if (isOpen && scanStatus === 'idle') {
      startScan();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen]);

  // Toggle single host selection
  const toggleSelect = (ip: string) => {
    setDiscoveredHosts((prev) =>
      prev.map((h) => (h.ip === ip ? { ...h, isSelected: !h.isSelected } : h))
    );
  };

  // Toggle select all unmanaged
  const unmanagedHosts = useMemo(
    () => discoveredHosts.filter((h) => !h.isExistingInIPAM),
    [discoveredHosts]
  );
  const allUnmanagedSelected =
    unmanagedHosts.length > 0 && unmanagedHosts.every((h) => h.isSelected);

  const toggleSelectAllUnmanaged = () => {
    const nextVal = !allUnmanagedSelected;
    setDiscoveredHosts((prev) =>
      prev.map((h) => (h.isExistingInIPAM ? h : { ...h, isSelected: nextVal }))
    );
  };

  // Filtered hosts
  const filteredHosts = useMemo(() => {
    return discoveredHosts.filter((h) => {
      const matchSearch =
        h.ip.includes(searchQuery) ||
        h.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.deviceType.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'unmanaged') return !h.isExistingInIPAM;
      if (filterType === 'existing') return h.isExistingInIPAM;
      return true;
    });
  }, [discoveredHosts, searchQuery, filterType]);

  const selectedCount = discoveredHosts.filter((h) => h.isSelected && !h.isExistingInIPAM).length;

  // Handle bulk import
  const handleImportSelected = () => {
    const toImport = discoveredHosts
      .filter((h) => h.isSelected && !h.isExistingInIPAM)
      .map((h) => ({
        ip: h.ip,
        hostname: h.hostname || `host-${h.ip.replace(/\./g, '-')}`,
        macAddress: h.macAddress !== 'Dynamic ARP' ? h.macAddress : undefined,
        deviceType: h.deviceType,
        status: 'allocated' as const,
        notes: `Discovered via Network Auto-Discovery (${h.latencyMs}ms ping, ports: ${h.openPorts.join(', ') || 'none'})`,
      }));

    if (toImport.length === 0) {
      setImportFeedback('No new unmanaged hosts selected for import.');
      return;
    }

    const res = bulkAllocateIPs(subnet.id, toImport, 'skip_existing');
    if (res.success) {
      // Mark as imported in local state
      setDiscoveredHosts((prev) =>
        prev.map((h) =>
          toImport.some((t) => t.ip === h.ip)
            ? { ...h, isExistingInIPAM: true, isSelected: false }
            : h
        )
      );
      setImportFeedback(`Successfully imported ${res.count} discovered hosts into ${subnet.cidr}!`);
      if (onImportSuccess) {
        onImportSuccess(res.count);
      }
    } else {
      setImportFeedback(res.message);
    }
  };

  // Export discovery results to CSV
  const handleExportResultsCSV = () => {
    const headers = ['IP Address', 'Hostname', 'MAC Address', 'Device Type', 'Latency (ms)', 'Open Ports', 'Status in IPAM'];
    const rows = discoveredHosts.map((h) => [
      h.ip,
      h.hostname,
      h.macAddress,
      h.deviceType,
      h.latencyMs,
      h.openPorts.join('; '),
      h.isExistingInIPAM ? 'Recorded in IPAM' : 'Unmanaged Host',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Subnet_Discovery_${subnet.cidr.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDeviceIcon = (type: DeviceType) => {
    return renderUnifiedDeviceIcon(type, 'w-3.5 h-3.5 text-blue-400');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5">
      <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0c0c0c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
              <Radar className={`w-5 h-5 ${scanStatus === 'scanning' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Subnet Auto-Discovery Scanner</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 font-mono font-medium">
                  {subnet.cidr}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-medium">
                  <Activity className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Live ICMP / ARP Probe</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Probing active physical responders, resolving MAC vendor cache &amp; reverse DNS hostnames
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScan();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Control Toolbar */}
        <div className="shrink-0 px-6 py-3 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {blocks.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Target Block:</span>
                <select
                  value={selectedBlockIndex}
                  disabled={scanStatus === 'scanning'}
                  onChange={(e) => setSelectedBlockIndex(Number(e.target.value))}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  {blocks.map((blk) => (
                    <option key={blk.blockIndex} value={blk.blockIndex}>
                      {blk.cidrLabel} ({blk.hostCount} hosts)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-slate-600 dark:text-slate-400">
              IP Range: <span className="text-slate-900 dark:text-slate-200 font-mono font-semibold">{targetIpsToScan[0] || '...'} – {targetIpsToScan[targetIpsToScan.length - 1] || '...'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {scanStatus === 'scanning' ? (
              <button
                type="button"
                onClick={stopScan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-xs font-medium text-rose-700 dark:text-rose-300 transition-colors border border-rose-200 dark:border-rose-800 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Stop Scan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startScan}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{scanStatus === 'idle' ? 'Start Scan' : 'Rescan Subnet'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportResultsCSV}
              disabled={discoveredHosts.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Scanner Radar & Progress Bar */}
        <div className="shrink-0 px-6 py-4 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                {scanStatus === 'scanning' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    scanStatus === 'scanning'
                      ? 'bg-blue-500'
                      : scanStatus === 'completed'
                      ? 'bg-emerald-500'
                      : scanStatus === 'stopped'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                ></span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {scanStatus === 'scanning'
                  ? `Active ICMP/ARP Probing: ${currentScanningIp || 'Scanning...'}`
                  : scanStatus === 'completed'
                  ? 'Discovery Scan Completed'
                  : scanStatus === 'stopped'
                  ? 'Scan Stopped by User'
                  : 'Scanner Ready'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">({scanProgress}%)</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                scanStatus === 'completed'
                  ? 'bg-emerald-500'
                  : scanStatus === 'stopped'
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${scanProgress}%` }}
            />
          </div>

          {/* Summary Stat Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Active Hosts Discovered: <strong className="text-white">{discoveredHosts.length}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300">
              Unmanaged (Ready to Add): <strong>{unmanagedHosts.length}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-blue-950/50 border border-blue-800/60 text-blue-300">
              Already in IPAM: <strong>{discoveredHosts.length - unmanagedHosts.length}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              Total Target IPs: <strong>{targetIpsToScan.length}</strong>
            </div>
          </div>
        </div>

        {/* Feedback / Error Alerts */}
        {importFeedback && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{importFeedback}</span>
            </div>
            <button
              onClick={() => setImportFeedback(null)}
              className="text-emerald-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Informative notice if real scan returned 0 hosts */}
        {scanStatus === 'completed' && discoveredHosts.length === 0 && (
          <div className="mx-6 mt-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white">0 active physical hosts responded on {subnet.cidr}</div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                No ICMP replies or open TCP ports were detected across the targeted {targetIpsToScan.length} IP addresses. 
                Ensure this server has direct layer 2/3 network routing to <code className="text-blue-600 dark:text-blue-300 font-mono font-semibold">{subnet.cidr}</code> and firewall rules allow ICMP/TCP probe packets.
              </p>
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="shrink-0 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IP, host, MAC..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All ({discoveredHosts.length})
              </button>
              <button
                onClick={() => setFilterType('unmanaged')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'unmanaged'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Unmanaged ({unmanagedHosts.length})
              </button>
              <button
                onClick={() => setFilterType('existing')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'existing'
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                In IPAM
              </button>
            </div>

            {unmanagedHosts.length > 0 && (
              <button
                onClick={toggleSelectAllUnmanaged}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
              >
                {allUnmanagedSelected ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select All New</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Host Results Table */}
        <div className="flex-1 overflow-y-auto min-h-[220px]">
          {filteredHosts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              {scanStatus === 'scanning' ? (
                <div className="flex flex-col items-center gap-3">
                  <Radar className="w-8 h-8 text-blue-500 animate-spin" />
                  <span>Probing subnet range ({currentScanningIp || '...'}) for live active hosts...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                  <span>No hosts matching the current filter.</span>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#0c0c0c] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold z-10 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-10 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-2.5 px-4">Discovered IP</th>
                  <th className="py-2.5 px-4">Hostname / Reverse DNS</th>
                  <th className="py-2.5 px-4">MAC Address</th>
                  <th className="py-2.5 px-4">Device Class</th>
                  <th className="py-2.5 px-4">Latency</th>
                  <th className="py-2.5 px-4">Open Ports</th>
                  <th className="py-2.5 px-4 text-right">Status in IPAM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredHosts.map((host) => {
                  return (
                    <tr
                      key={host.ip}
                      onClick={() => !host.isExistingInIPAM && toggleSelect(host.ip)}
                      className={`transition-colors cursor-pointer ${
                        host.isExistingInIPAM
                          ? 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-500 cursor-default'
                          : host.isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {host.isExistingInIPAM ? (
                          <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-slate-600 mx-auto" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={host.isSelected}
                            onChange={() => toggleSelect(host.ip)}
                            className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-blue-600 dark:text-blue-400">{host.ip}</td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {host.hostname || <span className="text-slate-400 dark:text-slate-500 font-normal italic">Unresolved</span>}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{host.macAddress}</td>
                      <td className="py-2.5 px-4 font-sans capitalize text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                          {getDeviceIcon(host.deviceType)}
                          <span>{host.deviceType}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{host.latencyMs}ms</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-sans">
                        {host.openPorts.length > 0 ? (
                          host.openPorts.map((p) => (
                            <span
                              key={p}
                              className="inline-block px-1.5 py-0.2 mr-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-mono border border-slate-200/60 dark:border-slate-700/50"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[10px]">ICMP Echo</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-sans font-medium">
                        {host.isExistingInIPAM ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>In IPAM</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 font-semibold">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>Unmanaged</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0c0c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {selectedCount > 0 ? (
              <span>
                <strong className="text-blue-600 dark:text-blue-400 font-semibold">{selectedCount} unmanaged host(s)</strong> selected for bulk allocation into {subnet.name}.
              </span>
            ) : (
              <span>Select discovered unmanaged hosts to automatically allocate and record them in IPAM.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                stopScan();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleImportSelected}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Import Selected ({selectedCount})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
