import { useState, useEffect, useRef } from 'react';
import { programsApi, signalsApi, costsApi, inputsApi } from '../services/api';

// Sample files available for quick loading
const SAMPLE_FILES = [
    { name: 'weekly_status_report.txt', description: 'Weekly status with blockers' },
    { name: 'program_risk_register.csv', description: 'Risk tracking register' },
    { name: 'cost_burn_summary.csv', description: 'Budget vs actual' },
];

function Dashboard() {
    const [programs, setPrograms] = useState([]);
    const [signals, setSignals] = useState([]);
    const [costSummary, setCostSummary] = useState(null);
    const [llmStatus, setLlmStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Expanded program state
    const [expandedProgram, setExpandedProgram] = useState(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [newProgramName, setNewProgramName] = useState('');
    const [showNewProgram, setShowNewProgram] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [programsRes, signalsRes, costsRes, healthRes] = await Promise.all([
                programsApi.list(),
                signalsApi.list(),
                costsApi.summary(),
                fetch('http://localhost:8000/api/health').then(r => r.json()).catch(() => null)
            ]);
            setPrograms(programsRes.programs || []);
            setSignals(signalsRes.signals || []);
            setCostSummary(costsRes);
            setLlmStatus(healthRes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Load a sample file
    async function loadSampleFile(filename) {
        try {
            const response = await fetch(`/sample_data/${filename}`);
            if (!response.ok) throw new Error('Failed to load sample file');
            const text = await response.text();
            return { filename, content: text };
        } catch (err) {
            console.error('Error loading sample file:', err);
            return null;
        }
    }

    // Upload sample file to a program (auto-analyzes on backend)
    async function uploadSampleToProgram(programId, filename) {
        setUploading(true);
        setUploadStatus({ type: 'loading', message: `Uploading & analyzing ${filename}...` });

        try {
            const sample = await loadSampleFile(filename);
            if (!sample) throw new Error('Could not load sample file');

            const file = new File([sample.content], filename, {
                type: filename.endsWith('.csv') ? 'text/csv' : 'text/plain'
            });

            await inputsApi.uploadFile(programId, file);
            setUploadStatus({ type: 'success', message: `✓ ${filename} uploaded & analyzed` });
            await loadData();
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 3000);
        }
    }

    // Create a new program
    async function createProgram() {
        if (!newProgramName.trim()) return;
        setUploading(true);
        try {
            const program = await programsApi.create({
                name: newProgramName.trim(),
                description: 'New program'
            });
            setNewProgramName('');
            setShowNewProgram(false);
            await loadData();
            setExpandedProgram(program.id);
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
        }
    }

    // Quick demo program with sample data
    async function createDemoProgram() {
        setUploading(true);
        setUploadStatus({ type: 'loading', message: 'Creating demo program...' });

        try {
            const program = await programsApi.create({
                name: 'Demo: Enterprise Modernization',
                description: 'Sample program with test data'
            });

            for (const { name } of SAMPLE_FILES) {
                setUploadStatus({ type: 'loading', message: `Uploading ${name}...` });
                const sample = await loadSampleFile(name);
                if (sample) {
                    const file = new File([sample.content], name, {
                        type: name.endsWith('.csv') ? 'text/csv' : 'text/plain'
                    });
                    await inputsApi.uploadFile(program.id, file);
                }
            }

            setUploadStatus({ type: 'success', message: '✓ Demo program ready with signals!' });
            await loadData();
            setExpandedProgram(program.id);
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 4000);
        }
    }

    // Handle file upload
    async function handleFileUpload(files, programId) {
        if (!files || files.length === 0) return;

        setUploading(true);
        for (const file of files) {
            setUploadStatus({ type: 'loading', message: `Analyzing ${file.name}...` });
            try {
                await inputsApi.uploadFile(programId, file);
            } catch (err) {
                setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
            }
        }
        setUploadStatus({ type: 'success', message: `✓ ${files.length} file(s) analyzed` });
        await loadData();
        setUploading(false);
        setTimeout(() => setUploadStatus(null), 3000);
    }

    // Count signals
    const signalCounts = {
        high: signals.filter(s => s.signal_value === 'HIGH' || s.signal_value === 'ANOMALOUS').length,
        medium: signals.filter(s => s.signal_value === 'MEDIUM' || s.signal_value === 'MODERATE').length,
        low: signals.filter(s => s.signal_value === 'LOW' || s.signal_value === 'NORMAL').length,
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>
                <button className="btn btn-primary" onClick={loadData}>Retry</button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <h1>Dashboard</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    {programs.length === 0 ? (
                        <button className="btn btn-primary" onClick={createDemoProgram} disabled={uploading}>
                            🚀 Create Demo Program
                        </button>
                    ) : (
                        <button className="btn btn-secondary" onClick={() => setShowNewProgram(!showNewProgram)}>
                            + New Program
                        </button>
                    )}
                </div>
            </div>

            {/* Status message */}
            {uploadStatus && (
                <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    background: uploadStatus.type === 'success' ? 'rgba(22, 163, 74, 0.1)' :
                        uploadStatus.type === 'error' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                    color: uploadStatus.type === 'success' ? 'var(--color-success)' :
                        uploadStatus.type === 'error' ? 'var(--color-danger)' : 'var(--color-info)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500
                }}>
                    {uploadStatus.message}
                </div>
            )}

            {/* New Program form */}
            {showNewProgram && (
                <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Program name..."
                            value={newProgramName}
                            onChange={(e) => setNewProgramName(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={createProgram} disabled={!newProgramName.trim()}>
                            Create
                        </button>
                        <button className="btn btn-secondary" onClick={() => setShowNewProgram(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="stat-card">
                    <div className="stat-label">Programs</div>
                    <div className="stat-value">{programs.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">High Risk</div>
                    <div className="stat-value accent">{signalCounts.high}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Medium Risk</div>
                    <div className="stat-value" style={{ color: 'var(--signal-medium)' }}>{signalCounts.medium}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">AI System</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span className={`status-dot ${llmStatus?.ai_status?.connected ? 'online' : (llmStatus?.ai_status?.status === 'loading' ? 'loading' : 'offline')}`}></span>
                            <span style={{
                                fontWeight: 700,
                                fontSize: 'var(--font-size-base)',
                                color: llmStatus?.ai_status?.connected ? 'var(--color-success)' : 'var(--color-warning)'
                            }}>
                                {llmStatus?.ai_status?.connected ? 'CONNECTED' : (llmStatus?.llm_mode === 'real' ? 'OFFLINE' : 'FALLBACK')}
                            </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            HF: {llmStatus?.model?.split('/').pop() || 'Loading...'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty state */}
            {programs.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No programs yet</div>
                    <div className="empty-state-text">
                        Click "Create Demo Program" to get started with sample data
                    </div>
                </div>
            )}

            {/* Programs List */}
            {programs.map(program => {
                const programSignals = signals.filter(s => s.program_id === program.id);
                const isExpanded = expandedProgram === program.id;
                const highRisk = programSignals.some(s => s.signal_value === 'HIGH' || s.signal_value === 'ANOMALOUS');

                return (
                    <div key={program.id} className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        {/* Program Header - Clickable */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: 'var(--space-4)'
                            }}
                            onClick={() => setExpandedProgram(isExpanded ? null : program.id)}
                        >
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{program.name}</span>
                                    {highRisk && <span className="signal-badge high">⚠️ High Risk</span>}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                                    {program.input_count} inputs • {programSignals.length} signals
                                </div>
                            </div>
                            <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>{isExpanded ? '▼' : '▶'}</span>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div style={{ borderTop: '1px solid var(--color-border-light)', padding: 'var(--space-4)' }}>
                                {/* Quick Upload */}
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                        ADD DATA
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {SAMPLE_FILES.map(file => (
                                            <button
                                                key={file.name}
                                                className="btn btn-secondary"
                                                style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-3)' }}
                                                onClick={() => uploadSampleToProgram(program.id, file.name)}
                                                disabled={uploading}
                                            >
                                                📄 {file.name.replace('.csv', '').replace('.txt', '').replace(/_/g, ' ')}
                                            </button>
                                        ))}
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-3)' }}
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                        >
                                            📁 Upload file...
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.txt"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileUpload(e.target.files, program.id)}
                                        />
                                    </div>
                                </div>

                                {/* Signals Table */}
                                {programSignals.length > 0 ? (
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                            SIGNALS ({programSignals.length})
                                        </div>
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '120px' }}>Type</th>
                                                        <th style={{ width: '80px' }}>Risk</th>
                                                        <th style={{ width: '70px' }}>Conf.</th>
                                                        <th>Explanation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {programSignals.map(signal => (
                                                        <tr key={signal.id}>
                                                            <td>
                                                                <span style={{ fontSize: 'var(--font-size-xs)', textTransform: 'capitalize' }}>
                                                                    {signal.signal_type.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`signal-badge ${signal.signal_value.toLowerCase()}`}>
                                                                    {signal.signal_value}
                                                                </span>
                                                            </td>
                                                            <td>{(signal.confidence_score * 100).toFixed(0)}%</td>
                                                            <td>
                                                                <span className="text-truncate">{signal.explanation}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
                                        No signals yet. Add data above to generate signals automatically.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Cost Transparency */}
            {costSummary && costSummary.total_signals > 0 && (
                <div className="cost-panel" style={{ marginTop: 'var(--space-5)' }}>
                    <div className="cost-panel-title">💰 AI Cost Transparency</div>
                    <div className="cost-grid">
                        <div className="cost-item">
                            <div className="cost-item-label">Total Cost</div>
                            <div className="cost-item-value">${costSummary.total_cost_usd.toFixed(4)}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Tokens Used</div>
                            <div className="cost-item-value">{costSummary.total_tokens.toLocaleString()}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Signals</div>
                            <div className="cost-item-value">{costSummary.total_signals}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Avg/Signal</div>
                            <div className="cost-item-value">${costSummary.avg_cost_per_signal.toFixed(4)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
