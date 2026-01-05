import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { programsApi, signalsApi, costsApi, inputsApi, samplesApi } from '../services/api';


function Dashboard() {
    const navigate = useNavigate();
    const [programs, setPrograms] = useState([]);
    const [signals, setSignals] = useState([]);
    const [inputs, setInputs] = useState([]);
    const [costSummary, setCostSummary] = useState(null);
    const [llmStatus, setLlmStatus] = useState(null);
    const [availableSamples, setAvailableSamples] = useState({});
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
            const [programsRes, signalsRes, costsRes, healthRes, samplesRes] = await Promise.all([
                programsApi.list(),
                signalsApi.list(),
                costsApi.summary(),
                fetch('http://localhost:8000/api/health').then(r => r.json()).catch(() => null),
                samplesApi.list()
            ]);
            setPrograms(programsRes.programs || []);
            setSignals(signalsRes.signals || []);
            setCostSummary(costsRes);
            setLlmStatus(healthRes);
            setAvailableSamples(samplesRes.samples || {});

            // Fetch inputs for all programs to show source in signals table
            const allInputs = [];
            for (const program of (programsRes.programs || [])) {
                try {
                    const programInputs = await inputsApi.listForProgram(program.id);
                    allInputs.push(...programInputs);
                } catch (e) {
                    console.error('Failed to fetch inputs for program', program.id);
                }
            }
            setInputs(allInputs);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Load a sample file from backend
    async function loadSampleFile(programDir, filename) {
        try {
            const response = await samplesApi.get(programDir, filename);
            return { filename, content: response.content };
        } catch (err) {
            console.error('Error loading sample file:', err);
            return null;
        }
    }

    // Upload sample file to a program (auto-analyzes on backend)
    async function uploadSampleToProgram(programId, programDir, filename) {
        // Check for duplicate
        const programInputs = inputs.filter(i => i.program_id === programId);
        if (programInputs.some(i => i.filename === filename)) {
            setUploadStatus({ type: 'error', message: `⚠️ "${filename}" already exists in this program` });
            setTimeout(() => setUploadStatus(null), 3000);
            return;
        }

        setUploading(true);
        setUploadStatus({ type: 'loading', message: `Uploading & analyzing ${filename}...` });

        try {
            const sample = await loadSampleFile(programDir, filename);
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

    // Handle program re-analysis
    async function handleReanalyze(programId) {
        try {
            setUploading(true);
            setUploadStatus({ type: 'loading', message: 'Analyzing all program data...' });
            await signalsApi.analyzeProgram(programId);
            setUploadStatus({ type: 'success', message: '✓ Analysis complete' });
            await loadData();
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 3000);
        }
    }

    // Handle file upload
    async function handleFileUpload(files, programId) {
        if (!files || files.length === 0) return;

        // Check for duplicates
        const programInputs = inputs.filter(i => i.program_id === programId);
        const duplicates = Array.from(files).filter(f => programInputs.some(i => i.filename === f.name));
        if (duplicates.length > 0) {
            setUploadStatus({ type: 'error', message: `⚠️ "${duplicates[0].name}" already exists in this program` });
            setTimeout(() => setUploadStatus(null), 3000);
            return;
        }

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-3)' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/programs/${program.id}`);
                                    }}
                                >
                                    View Details
                                </button>
                                <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>{isExpanded ? '▼' : '▶'}</span>
                            </div>
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
                                        {/* Show samples based on program index as a simple mapping */}
                                        {availableSamples[`program_${program.id}`]?.map(sample => (
                                            <button
                                                key={sample.name}
                                                className="btn btn-secondary"
                                                style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-3)' }}
                                                onClick={() => uploadSampleToProgram(program.id, `program_${program.id}`, sample.name)}
                                                disabled={uploading}
                                            >
                                                📄 {sample.name.replace('.csv', '').replace('.txt', '').replace(/_/g, ' ')}
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
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-primary-dark)' }}
                                            onClick={() => handleReanalyze(program.id)}
                                            disabled={uploading}
                                        >
                                            ⚡ Re-analyze Program
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

                                {/* Signals Breakdown */}
                                {programSignals.length > 0 ? (
                                    <div style={{ marginTop: 'var(--space-4)' }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                            DETECTED SIGNALS
                                        </div>
                                        <div className="table-container">
                                            <table className="table" style={{ fontSize: 'var(--font-size-sm)' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '150px' }}>Source</th>
                                                        <th style={{ width: '100px' }}>Risk Level</th>
                                                        <th style={{ width: '80px', textAlign: 'center' }}>Conf.</th>
                                                        <th>Explanation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {programSignals.map(signal => {
                                                        const sourceInput = inputs.find(i => i.id === signal.input_id);
                                                        const sourceName = sourceInput ? (sourceInput.filename ? sourceInput.filename.replace('.csv', '').replace('.txt', '').replace(/_/g, ' ') : 'Manual') : 'Unknown';

                                                        return (
                                                            <tr key={signal.id}>
                                                                <td style={{ verticalAlign: 'top', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                                    <div className="text-truncate" style={{ maxWidth: '140px' }} title={sourceName}>
                                                                        {sourceName}
                                                                    </div>
                                                                </td>
                                                                <td style={{ verticalAlign: 'top' }}>
                                                                    <span className={`signal-badge ${signal.signal_value.toLowerCase()}`}>
                                                                        {signal.signal_value}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{(signal.confidence_score * 100).toFixed(0)}%</td>
                                                                <td style={{
                                                                    fontSize: 'var(--font-size-sm)',
                                                                    lineHeight: '1.5',
                                                                    color: 'var(--color-text-secondary)',
                                                                    wordBreak: 'break-word'
                                                                }}>
                                                                    {signal.explanation}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
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
