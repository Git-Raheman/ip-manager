import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Subnet, IPStatus, DeviceType } from '../types';
import { useIPAM } from '../context/IPAMContext';
import { isValidIPv4, isIpInSubnet, formatMAC, parseCIDR, ipToLong } from '../utils/ipUtils';
import {
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Square,
  CheckSquare,
  RefreshCw,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SubnetBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnet: Subnet;
  onImportSuccess?: (count: number) => void;
}

interface ParsedImportRow {
  id: string;
  ip: string;
  hostname: string;
  macAddress: string;
  deviceType: DeviceType;
  status: IPStatus;
  owner: string;
  department: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
  isConflict: boolean;
  isSelected: boolean;
}

export const SubnetBulkImportModal: React.FC<SubnetBulkImportModalProps> = ({
  isOpen,
  onClose,
  subnet,
  onImportSuccess,
}) => {
  const { ips, bulkAllocateIPs, deviceClassifications } = useIPAM();

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [conflictMode, setConflictMode] = useState<'skip_existing' | 'overwrite_existing'>('skip_existing');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const pageSize = 50;

  // Subnet gateway parts for template generation
  const ipPrefix = useMemo(() => {
    const parts = subnet.gateway.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }, [subnet.gateway]);

  // Existing IPs in this subnet
  const existingIps = useMemo(() => {
    return new Set(ips.filter((i) => i.subnetId === subnet.id).map((i) => i.ip));
  }, [ips, subnet.id]);

  // Download Excel (.xlsx) Template
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      ['IP Address', 'Hostname', 'MAC Address', 'Device Type', 'Status', 'Owner', 'Department', 'Notes'],
      [`${ipPrefix}.50`, 'web-app-01', '00:1A:2B:3C:4D:5E', 'server', 'allocated', 'DevOps Team', 'IT Infrastructure', 'Main web node'],
      [`${ipPrefix}.51`, 'db-postgres-primary', '00:50:56:A1:B2:C3', 'server', 'allocated', 'DBA Team', 'Data Engineering', 'Primary DB server'],
      [`${ipPrefix}.52`, 'sw-access-rack2', '00:24:14:8A:9B:0C', 'switch', 'allocated', 'Network Ops', 'Networking', 'Access Switch Rack 2'],
      [`${ipPrefix}.55`, 'printer-finance-dept', '00:1E:0B:11:22:33', 'printer', 'allocated', 'Finance Ops', 'Finance', 'LaserJet MFP'],
      [`${ipPrefix}.60`, 'dhcp-pool-start', '', 'workstation', 'reserved', 'Network Ops', 'IT Operations', 'DHCP pool start mark'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 16 }, // IP
      { wch: 22 }, // Hostname
      { wch: 20 }, // MAC
      { wch: 14 }, // Device Type
      { wch: 12 }, // Status
      { wch: 16 }, // Owner
      { wch: 18 }, // Department
      { wch: 30 }, // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'IP_Allocations');
    const safeCidr = subnet.cidr.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `IPAM_Template_${safeCidr}.xlsx`);
  };

  // Download CSV (.csv) Template
  const handleDownloadCSVTemplate = () => {
    const headers = ['IP Address', 'Hostname', 'MAC Address', 'Device Type', 'Status', 'Owner', 'Department', 'Notes'];
    const rows = [
      [`${ipPrefix}.50`, 'web-app-01', '00:1A:2B:3C:4D:5E', 'server', 'allocated', 'DevOps Team', 'IT Infrastructure', 'Main web node'],
      [`${ipPrefix}.51`, 'db-postgres-primary', '00:50:56:A1:B2:C3', 'server', 'allocated', 'DBA Team', 'Data Engineering', 'Primary DB server'],
      [`${ipPrefix}.52`, 'sw-access-rack2', '00:24:14:8A:9B:0C', 'switch', 'allocated', 'Network Ops', 'Networking', 'Access Switch Rack 2'],
      [`${ipPrefix}.55`, 'printer-finance-dept', '00:1E:0B:11:22:33', 'printer', 'allocated', 'Finance Ops', 'Finance', 'LaserJet MFP'],
      [`${ipPrefix}.60`, 'dhcp-pool-start', '', 'workstation', 'reserved', 'Network Ops', 'IT Operations', 'DHCP pool start mark'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    const safeCidr = subnet.cidr.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `IPAM_Template_${safeCidr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse 2D raw array of cells into structured records
  const processRawGrid = (grid: any[][]) => {
    setParseError(null);
    setImportResult(null);

    if (!grid || grid.length === 0) {
      setParseError('The file appears empty.');
      setIsParsing(false);
      return;
    }

    // Header index mapping
    const headerRow = grid[0].map((h) => String(h || '').trim().toLowerCase());
    
    let ipIdx = headerRow.findIndex((h) => h.includes('ip') || h.includes('address'));
    let hostIdx = headerRow.findIndex((h) => h.includes('host') || h.includes('name'));
    let macIdx = headerRow.findIndex((h) => h.includes('mac') || h.includes('hardware') || h.includes('ethernet'));
    let typeIdx = headerRow.findIndex((h) => h.includes('type') || h.includes('device') || h.includes('class'));
    let statusIdx = headerRow.findIndex((h) => h.includes('status') || h.includes('state'));
    let ownerIdx = headerRow.findIndex((h) => h.includes('owner') || h.includes('assigned'));
    let deptIdx = headerRow.findIndex((h) => h.includes('dept') || h.includes('department'));
    let notesIdx = headerRow.findIndex((h) => h.includes('note') || h.includes('comment') || h.includes('desc'));

    // If no header found, fallback to positional
    let startRow = 1;
    if (ipIdx === -1) {
      if (isValidIPv4(String(grid[0][0] || '').trim())) {
        ipIdx = 0;
        hostIdx = 1;
        macIdx = 2;
        typeIdx = 3;
        statusIdx = 4;
        ownerIdx = 5;
        deptIdx = 6;
        notesIdx = 7;
        startRow = 0;
      } else {
        setParseError('Could not locate an "IP Address" column header. Please use the template.');
        setIsParsing(false);
        return;
      }
    }

    // Pre-calculate subnet CIDR numeric bounds once outside the loop
    const cidrInfo = parseCIDR(subnet.cidr);
    const netLong = cidrInfo ? ipToLong(cidrInfo.networkAddress) : 0;
    const bcastLong = cidrInfo ? ipToLong(cidrInfo.broadcastAddress) : 0;
    const netAddr = cidrInfo?.networkAddress || '';
    const bcastAddr = cidrInfo?.broadcastAddress || '';

    const rows: ParsedImportRow[] = [];
    const typeMap = new Map<string, string>();
    ['server', 'router', 'switch', 'workstation', 'firewall', 'printer', 'iot', 'storage', 'vm', 'other'].forEach((t) =>
      typeMap.set(t, t)
    );
    if (deviceClassifications && deviceClassifications.length > 0) {
      deviceClassifications.forEach((dc) => {
        typeMap.set(dc.code.toLowerCase().trim(), dc.code);
        typeMap.set(dc.name.toLowerCase().trim(), dc.code);
      });
    }
    const defaultType = deviceClassifications[0]?.code || 'server';
    const validStatuses = new Set<string>(['allocated', 'reserved', 'dhcp', 'available']);

    for (let i = startRow; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.length === 0) continue;

      const rawIp = String(row[ipIdx] || '').trim();
      if (!rawIp) continue; // Skip blank lines

      const hostname = hostIdx !== -1 ? String(row[hostIdx] || '').trim() : '';
      const rawMac = macIdx !== -1 ? String(row[macIdx] || '').trim() : '';
      const formattedMac = rawMac ? formatMAC(rawMac) : '';
      
      const rawType = typeIdx !== -1 ? String(row[typeIdx] || '').toLowerCase().trim() : defaultType;
      const deviceType = (typeMap.get(rawType) || (typeIdx !== -1 ? String(row[typeIdx] || '').trim() : defaultType)) as DeviceType;

      const rawStatus = statusIdx !== -1 ? String(row[statusIdx] || '').toLowerCase().trim() : 'allocated';
      const status = (validStatuses.has(rawStatus) ? rawStatus : 'allocated') as IPStatus;

      const owner = ownerIdx !== -1 ? String(row[ownerIdx] || '').trim() : '';
      const department = deptIdx !== -1 ? String(row[deptIdx] || '').trim() : '';
      const notes = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';

      // Fast numeric bounds validation
      let isValid = true;
      let validationError = '';

      const ipLong = ipToLong(rawIp);
      if (!ipLong || !isValidIPv4(rawIp)) {
        isValid = false;
        validationError = 'Invalid IPv4 address format.';
      } else if (ipLong < netLong || ipLong > bcastLong) {
        isValid = false;
        validationError = `IP is outside subnet CIDR (${subnet.cidr}).`;
      } else if (rawIp === netAddr || rawIp === bcastAddr) {
        isValid = false;
        validationError = 'Cannot allocate network or broadcast address.';
      }

      const isConflict = existingIps.has(rawIp);

      rows.push({
        id: `row-${i}-${rawIp}`,
        ip: rawIp,
        hostname,
        macAddress: formattedMac,
        deviceType,
        status,
        owner,
        department,
        notes,
        isValid,
        validationError,
        isConflict,
        isSelected: isValid && (!isConflict || conflictMode === 'overwrite_existing'),
      });
    }

    if (rows.length === 0) {
      setParseError('No data rows could be parsed from the file.');
      setIsParsing(false);
      return;
    }

    setParsedRows(rows);
    setPreviewPage(1);
    setIsParsing(false);
  };

  // Handle uploaded file with async loader and specialized CSV fast-path
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    setParseError(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type.includes('text');

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTimeout(() => {
          try {
            const text = (e.target?.result as string) || '';
            const lines = text.split(/\r?\n/);
            const grid: string[][] = [];
            const delimiter = lines[0] && lines[0].includes('\t') ? '\t' : ',';

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
              grid.push(cols);
            }

            processRawGrid(grid);
          } catch (err: any) {
            setParseError(`Failed to parse CSV: ${err.message || 'Unknown error'}`);
            setIsParsing(false);
          }
        }, 10);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTimeout(() => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            processRawGrid(grid);
          } catch (err: any) {
            setParseError(`Failed to parse file: ${err.message || 'Unknown format'}`);
            setIsParsing(false);
          }
        }, 10);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Handle manual paste parse
  const handleParsePastedText = () => {
    if (!pasteText.trim()) {
      setParseError('Please paste some CSV or table data first.');
      return;
    }

    setIsParsing(true);
    setTimeout(() => {
      const lines = pasteText.trim().split(/\r?\n/);
      const firstLine = lines[0] || '';
      const delimiter = firstLine.includes('\t') ? '\t' : ',';

      const grid = lines.map((line) => line.split(delimiter).map((col) => col.trim().replace(/^"|"$/g, '')));
      processRawGrid(grid);
    }, 30);
  };

  // Toggle single row selection
  const toggleRowSelect = (id: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
    );
  };

  // Single-pass counts computation for fast preview of 50k+ rows
  const { validCount, selectedCount, conflictCount, invalidCount, allValidSelected } = useMemo(() => {
    let valid = 0;
    let selected = 0;
    let conflict = 0;
    let invalid = 0;
    let selectedAndValid = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const r = parsedRows[i];
      if (r.isValid) valid++;
      else invalid++;
      if (r.isSelected) selected++;
      if (r.isConflict) conflict++;
      if (r.isValid && r.isSelected) selectedAndValid++;
    }

    return {
      validCount: valid,
      selectedCount: selected,
      conflictCount: conflict,
      invalidCount: invalid,
      allValidSelected: valid > 0 && selectedAndValid === valid,
    };
  }, [parsedRows]);

  const toggleSelectAllValid = () => {
    const nextVal = !allValidSelected;
    setParsedRows((prev) =>
      prev.map((r) => (r.isValid ? { ...r, isSelected: nextVal } : r))
    );
  };

  // Paginated Preview Rows to keep DOM super light (<50 rows) for 50k+ records
  const totalPages = Math.ceil(parsedRows.length / pageSize) || 1;
  const pagedPreviewRows = useMemo(() => {
    const start = (previewPage - 1) * pageSize;
    return parsedRows.slice(start, start + pageSize);
  }, [parsedRows, previewPage, pageSize]);

  // Execute Bulk Import
  const handleExecuteImport = () => {
    setIsImporting(true);
    setParseError(null);

    setTimeout(() => {
      const toImport = parsedRows
        .filter((r) => r.isSelected && r.isValid)
        .map((r) => ({
          ip: r.ip,
          hostname: r.hostname,
          macAddress: r.macAddress,
          deviceType: r.deviceType,
          status: r.status,
          owner: r.owner,
          department: r.department,
          notes: r.notes || `Imported via spreadsheet bulk import (${fileName || 'Text Paste'})`,
        }));

      if (toImport.length === 0) {
        setParseError('No valid rows selected for import.');
        setIsImporting(false);
        return;
      }

      const res = bulkAllocateIPs(subnet.id, toImport, conflictMode);
      setIsImporting(false);
      if (res.success) {
        setImportResult(`Successfully imported ${res.count.toLocaleString()} IP records into ${subnet.cidr} instantly!`);
        if (onImportSuccess) {
          onImportSuccess(res.count);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setParseError(res.message);
      }
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#171717] dark:text-white">Bulk Import IP Addresses</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                  {subnet.cidr}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                High-performance bulk importer supporting up to 100,000+ records from Excel (.xlsx, .xls) and CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Template Banner */}
        <div className="shrink-0 px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Need the official IPAM template with columns pre-filled for this subnet?</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCSVTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Upload vs Paste) */}
        <div className="shrink-0 px-6 pt-3 flex items-center justify-between border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-[#171717] dark:text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File (.xlsx, .xls, .csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-blue-500 text-[#171717] dark:text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Spreadsheet Data</span>
            </button>
          </div>

          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setParsedRows([]);
                setFileName(null);
                setParseError(null);
                setPreviewPage(1);
              }}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 pb-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset &amp; Upload New</span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Loading Spinner during Parsing */}
          {isParsing && (
            <div className="py-16 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-white">Parsing and Validating IP Records...</p>
              <p className="text-xs text-slate-400">Processing file rows with instant high-speed validation...</p>
            </div>
          )}

          {/* Step 1: Input (Only if rows not parsed yet and not parsing) */}
          {!isParsing && parsedRows.length === 0 && (
            activeTab === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${
                  dragActive
                    ? 'border-blue-500 bg-blue-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 mb-1">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#171717] dark:text-white">Drag &amp; drop your Excel or CSV file here</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports 50k+ records smoothly with instant in-memory processing
                  </p>
                </div>
                <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors mt-2">
                  Browse Computer
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Copy and paste table cells directly from Microsoft Excel, Google Sheets, or CSV text:
                </p>
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`IP Address, Hostname, MAC Address, Device Type, Status, Owner, Department, Notes\n${ipPrefix}.50, web-node-01, 00:1A:2B:3C:4D:5E, server, allocated, DevOps, IT, Main node\n${ipPrefix}.51, db-node-01, 00:50:56:A1:B2:C3, server, allocated, DBA, IT, Main db`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer"
                >
                  Parse Pasted Data
                </button>
              </div>
            )
          )}

          {/* Step 2: Parsed Table Preview & Validation */}
          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Conflict Mode Selection & Summary Stats */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-medium">Analysis Summary:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">
                    Total: {parsedRows.length.toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800">
                    Valid: {validCount.toLocaleString()}
                  </span>
                  {conflictCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-semibold border border-amber-800">
                      Conflicts: {conflictCount.toLocaleString()}
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-semibold border border-rose-800">
                      Invalid: {invalidCount.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">When IP already exists:</span>
                  <select
                    value={conflictMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'skip_existing' | 'overwrite_existing';
                      setConflictMode(mode);
                      setParsedRows((prev) =>
                        prev.map((r) => ({
                          ...r,
                          isSelected: r.isValid && (!r.isConflict || mode === 'overwrite_existing'),
                        }))
                      );
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="skip_existing">Skip existing (Keep current record)</option>
                    <option value="overwrite_existing">Overwrite existing allocation</option>
                  </select>
                </div>
              </div>

              {/* Fast Preview Notice & Pagination Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Previewing rows{' '}
                    <strong className="text-slate-200">
                      {(previewPage - 1) * pageSize + 1} - {Math.min(previewPage * pageSize, parsedRows.length).toLocaleString()}
                    </strong>{' '}
                    of <strong className="text-slate-200">{parsedRows.length.toLocaleString()}</strong> parsed records.
                  </span>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={previewPage === 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-slate-300 font-mono text-[11px]">
                      Page {previewPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={previewPage === totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Table Preview */}
              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAllValid}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            title="Select / Deselect all valid rows"
                          >
                            {allValidSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">IP Address</th>
                        <th className="py-2.5 px-3">Hostname</th>
                        <th className="py-2.5 px-3">MAC Address</th>
                        <th className="py-2.5 px-3">Device Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Owner / Dept</th>
                        <th className="py-2.5 px-3">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {pagedPreviewRows.map((row) => {
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              !row.isValid
                                ? 'bg-rose-950/20 text-rose-300'
                                : row.isConflict
                                ? 'bg-amber-950/20 text-amber-200'
                                : row.isSelected
                                ? 'bg-blue-950/30 text-slate-200'
                                : 'hover:bg-slate-800/30 text-slate-300'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              {row.isValid ? (
                                <input
                                  type="checkbox"
                                  checked={row.isSelected}
                                  onChange={() => toggleRowSelect(row.id)}
                                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-rose-400 mx-auto" />
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold font-mono text-blue-400">{row.ip}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-white truncate max-w-[140px]">
                              {row.hostname || <span className="text-slate-500 italic">None</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{row.macAddress || '-'}</td>
                            <td className="py-2.5 px-3 font-sans capitalize">{row.deviceType}</td>
                            <td className="py-2.5 px-3 font-sans capitalize">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  row.status === 'allocated'
                                    ? 'bg-emerald-950 text-emerald-300'
                                    : 'bg-indigo-950 text-indigo-300'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400 truncate max-w-[130px]">
                              {row.owner || row.department ? `${row.owner} ${row.department ? `(${row.department})` : ''}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {!row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-medium">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{row.validationError}</span>
                                </span>
                              ) : row.isConflict ? (
                                <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Exists ({conflictMode === 'overwrite_existing' ? 'Will Overwrite' : 'Will Skip'})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Ready to Allocate</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Feedback & Error display */}
          {parseError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{parseError}</span>
            </div>
          )}

          {importResult && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{importResult}</span>
            </div>
          )}

        </div>

        {/* Modal Sticky Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {parsedRows.length > 0 ? (
              <span>
                <strong className="text-blue-400 font-semibold">{selectedCount.toLocaleString()} IP record(s)</strong> selected for import.
              </span>
            ) : (
              <span>Upload an Excel/CSV file or paste table rows to begin validation.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isImporting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors border border-slate-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isImporting || selectedCount === 0 || !parsedRows.some((r) => r.isSelected && r.isValid)}
              onClick={handleExecuteImport}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing {selectedCount.toLocaleString()} IPs...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import {selectedCount.toLocaleString()} IPs</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
