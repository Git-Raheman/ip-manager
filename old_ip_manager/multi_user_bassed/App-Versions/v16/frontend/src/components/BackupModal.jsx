import React, { useState } from 'react';
import { X, Download, Upload, FileText } from 'lucide-react';

const BackupModal = ({ isOpen, onClose }) => {
    const [file, setFile] = useState(null);
    const [excelFile, setExcelFile] = useState(null);
    const [msg, setMsg] = useState('');
    const [tab, setTab] = useState('json');
    const [importMode, setImportMode] = useState('replace');

    if (!isOpen) return null;

    const handleExport = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/backup/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setMsg('Export successful');
            } else {
                setMsg('Export failed');
            }
        } catch (err) {
            setMsg('Export failed');
        }
    };

    const handleImportJson = async () => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = JSON.parse(e.target.result);
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/backup/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ data, mode: importMode })
                });
                if (res.ok) {
                    setMsg('Import successful! Refreshing...');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    setMsg('Import failed');
                }
            } catch (err) {
                setMsg('Import failed');
            }
        };
        reader.readAsText(file);
    };

    const handleImportExcel = async () => {
        if (!excelFile) return;
        const formData = new FormData();
        formData.append('file', excelFile);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/backup/import-excel', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                let message = `${data.message}\n\nSummary:\n- Processed: ${data.summary.processed}\n- Created: ${data.summary.created}\n- Errors: ${data.summary.errorCount}`;
                if (data.errors && data.errors.length > 0) {
                    message += '\n\nErrors:\n' + data.errors.join('\n');
                }
                alert(message);
                setMsg('Import successful! Refreshing...');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setMsg('Import failed: ' + data.error);
            }
        } catch (err) {
            setMsg('Import failed');
        }
    };

    const downloadTemplate = async () => {
        window.open('/api/backup/template', '_blank');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>System Backup & Import</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <div className="backup-tabs">
                        <button className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>JSON Backup</button>
                        <button className={tab === 'excel' ? 'active' : ''} onClick={() => setTab('excel')}>Excel Import</button>
                    </div>

                    {msg && <div className="info-msg">{msg}</div>}

                    {tab === 'json' && (
                        <div className="backup-section">
                            <h4>Full System Backup</h4>
                            <div className="action-row">
                                <button onClick={handleExport} className="btn-save"><Download size={16} /> Export JSON</button>
                            </div>
                            <div className="action-row">
                                <div className="import-controls">
                                    <select value={importMode} onChange={e => setImportMode(e.target.value)} className="mode-select">
                                        <option value="replace">Replace (Overwrite All)</option>
                                        <option value="merge">Merge (Keep Existing)</option>
                                    </select>
                                    <input type="file" accept=".json" onChange={e => setFile(e.target.files[0])} />
                                    <button onClick={handleImportJson} className="btn-primary"><Upload size={16} /> Restore JSON</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'excel' && (
                        <div className="backup-section">
                            <h4>Bulk Import IPs</h4>
                            <p>Upload an Excel file to add multiple IPs at once.</p>
                            <div className="action-row">
                                <button onClick={downloadTemplate} className="btn-link"><FileText size={16} /> Download Template</button>
                            </div>
                            <div className="action-row">
                                <input type="file" accept=".xlsx, .xls" onChange={e => setExcelFile(e.target.files[0])} />
                                <button onClick={handleImportExcel} className="btn-primary"><Upload size={16} /> Import Excel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupModal;
