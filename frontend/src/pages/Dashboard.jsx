import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { programsApi, signalsApi, costsApi, inputsApi } from '../services/api';

// Sample files available for quick loading
const SAMPLE_FILES = [
    { name: 'weekly_status_report.txt', description: 'Weekly status with milestones and blockers' },
    { name: 'program_risk_register.csv', description: 'Risk tracking with likelihood/impact' },
    { name: 'cost_burn_summary.csv', description: 'Budget vs actual spend by month' },
    { name: 'delivery_milestones.csv', description: 'Schedule tracking with status' },
    { name: 'ai_usage_log.csv', description: 'AI model invocation history' },
    { name: 'analyst_notes.txt', description: 'Free-form analyst observations' },
];

function Dashboard() {
    const [programs, setPrograms] = useState([]);
    const [signals, setSignals] = useState([]);
    const [costSummary, setCostSummary] = useState(null);
    const [llmStatus, setLlmStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Quick upload state
    const [showUploadPanel, setShowUploadPanel] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
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

    // Load a sample file from the sample_data directory
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

    // Upload sample file to a program
    async function uploadSampleToProgram(programId, filename) {
        setUploading(true);
        setUploadStatus({ type: 'loading', message: `Uploading ${filename}...` });

        try {
            const sample = await loadSampleFile(filename);
            if (!sample) {
                throw new Error('Could not load sample file');
            }

            // Create a File object from the content
            const file = new File([sample.content], filename, {
                type: filename.endsWith('.csv') ? 'text/csv' : 'text/plain'
            });

            await inputsApi.uploadFile(programId, file);
            setUploadStatus({ type: 'success', message: `✓ Uploaded ${filename}` });
            await loadData();
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 3000);
        }
    }

    // Create a new program with sample data
    async function createDemoProgram() {
        setUploading(true);
        setUploadStatus({ type: 'loading', message: 'Creating demo program...' });

        try {
            // Create the program
            const program = await programsApi.create({
                name: 'Demo: Enterprise Modernization',
                description: 'Sample program loaded with test data for demonstration'
            });

            // Load a couple sample files
            const filesToLoad = ['weekly_status_report.txt', 'program_risk_register.csv', 'cost_burn_summary.csv'];

            for (const filename of filesToLoad) {
                setUploadStatus({ type: 'loading', message: `Loading ${filename}...` });
                const sample = await loadSampleFile(filename);
                if (sample) {
                    const file = new File([sample.content], filename, {
                        type: filename.endsWith('.csv') ? 'text/csv' : 'text/plain'
                    });
                    await inputsApi.uploadFile(program.id, file);
                }
            }

            // Analyze the program
            setUploadStatus({ type: 'loading', message: 'Analyzing inputs...' });
            await signalsApi.analyzeProgram(program.id);

            setUploadStatus({ type: 'success', message: '✓ Demo program created with signals!' });
            await loadData();
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 4000);
        }
    }

    // Handle custom file upload
    async function handleFileUpload(files) {
        if (!files || files.length === 0 || !selectedProgram) return;

        setUploading(true);
        try {
            for (const file of files) {
                setUploadStatus({ type: 'loading', message: `Uploading ${file.name}...` });
                await inputsApi.uploadFile(selectedProgram, file);
            }
            setUploadStatus({ type: 'success', message: `✓ Uploaded ${files.length} file(s)` });
            await loadData();
        } catch (err) {
            setUploadStatus({ type: 'error', message: `Failed: ${err.message}` });
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(null), 3000);
        }
    }

    // Count signals by value
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
                <p style={{ color: 'var(--color-danger)' }}>Error loading data: {error}</p>
                <button className="btn btn-primary" onClick={loadData}>Retry</button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h1>Dashboard</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowUploadPanel(!showUploadPanel)}
                    >
                        📁 {showUploadPanel ? 'Hide Upload' : 'Upload Data'}
                    </button>
                    <Link to="/programs/new" className="btn btn-primary">
                        + New Program
                    </Link>
                </div>
            </div>

            {/* Quick Upload Panel */}
            {showUploadPanel && (
                <div className="card" style={{ marginBottom: 'var(--space-6)', background: 'var(--color-bg-alt)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <h3 style={{ marginBottom: 'var(--space-1)' }}>Quick Data Upload</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                Load sample files or upload your own to test signal generation
                            </p>
                        </div>
                        {programs.length === 0 && (
                            <button
                                className="btn btn-primary"
                                onClick={createDemoProgram}
                                disabled={uploading}
                            >
                                {uploading ? 'Creating...' : '🚀 Create Demo Program'}
                            </button>
                        )}
                    </div>

                    {/* Status message */}
                    {uploadStatus && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            background: uploadStatus.type === 'success' ? 'rgba(22, 163, 74, 0.1)' :
                                uploadStatus.type === 'error' ? 'rgba(220, 38, 38, 0.1)' :
                                    'rgba(37, 99, 235, 0.1)',
                            color: uploadStatus.type === 'success' ? 'var(--color-success)' :
                                uploadStatus.type === 'error' ? 'var(--color-danger)' :
                                    'var(--color-info)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500
                        }}>
                            {uploadStatus.message}
                        </div>
                    )}

                    {programs.length > 0 && (
                        <>
                            {/* Program selector */}
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label">Select Program</label>
                                <select
                                    className="form-select"
                                    value={selectedProgram}
                                    onChange={(e) => setSelectedProgram(e.target.value)}
                                    style={{ maxWidth: '300px' }}
                                >
                                    <option value="">Choose a program...</option>
                                    {programs.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedProgram && (
                                <>
                                    {/* Sample files grid */}
                                    <div style={{ marginBottom: 'var(--space-5)' }}>
                                        <label className="form-label">Load Sample Files</label>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                            gap: 'var(--space-3)'
                                        }}>
                                            {SAMPLE_FILES.map(file => (
                                                <button
                                                    key={file.name}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        justifyContent: 'flex-start',
                                                        textAlign: 'left',
                                                        padding: 'var(--space-3)',
                                                        height: 'auto',
                                                        flexDirection: 'column',
                                                        alignItems: 'flex-start',
                                                        gap: 'var(--space-1)'
                                                    }}
                                                    onClick={() => uploadSampleToProgram(selectedProgram, file.name)}
                                                    disabled={uploading}
                                                >
                                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                        📄 {file.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: 'var(--font-size-xs)',
                                                        color: 'var(--color-text-muted)',
                                                        fontWeight: 400
                                                    }}>
                                                        {file.description}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom file upload */}
                                    <div>
                                        <label className="form-label">Or Upload Your Own</label>
                                        <div
                                            className="file-upload"
                                            style={{ padding: 'var(--space-6)' }}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>📁</div>
                                            <div className="file-upload-text">
                                                Click to upload CSV or TXT files
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".csv,.txt"
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={(e) => handleFileUpload(e.target.files)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Programs</div>
                    <div className="stat-value">{programs.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">High Risk Signals</div>
                    <div className="stat-value accent">{signalCounts.high}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">System Mode</div>
                    <div className="stat-value" style={{
                        fontSize: 'var(--font-size-lg)',
                        color: llmStatus?.llm_mode === 'real' ? 'var(--color-success)' : 'var(--color-warning)'
                    }}>
                        {llmStatus?.llm_mode === 'real' ? '🚀 Real AI' : '🚧 Demo Mode'}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active Model</div>
                    <div className="stat-value" style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>
                        {llmStatus?.model?.split('/')[1] || 'Mistral-7B'}
                    </div>
                </div>
            </div>

            {/* Cost Transparency Panel */}
            {costSummary && costSummary.total_signals > 0 && (
                <div className="cost-panel" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="cost-panel-title">
                        💰 AI Cost Transparency
                    </div>
                    <div className="cost-grid">
                        <div className="cost-item">
                            <div className="cost-item-label">Total Cost</div>
                            <div className="cost-item-value">${costSummary.total_cost_usd.toFixed(4)}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Total Tokens</div>
                            <div className="cost-item-value">{costSummary.total_tokens.toLocaleString()}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Signals Generated</div>
                            <div className="cost-item-value">{costSummary.total_signals}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Avg Cost/Signal</div>
                            <div className="cost-item-value">${costSummary.avg_cost_per_signal.toFixed(4)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Programs Grid */}
            <h2 style={{ marginBottom: 'var(--space-4)' }}>Programs</h2>

            {programs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No programs yet</div>
                    <div className="empty-state-text">
                        Create your first program to start tracking delivery risk and cost signals.
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={createDemoProgram}
                            disabled={uploading}
                        >
                            🚀 Create Demo Program
                        </button>
                        <Link to="/programs/new" className="btn btn-secondary">
                            + Create Empty Program
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="programs-grid">
                    {programs.map(program => {
                        const programSignals = signals.filter(s => s.program_id === program.id);
                        const highRisk = programSignals.some(s => s.signal_value === 'HIGH' || s.signal_value === 'ANOMALOUS');

                        return (
                            <Link to={`/programs/${program.id}`} key={program.id} style={{ textDecoration: 'none' }}>
                                <div className="program-card">
                                    <div className="program-name">{program.name}</div>
                                    <div className="program-description">
                                        {program.description || 'No description provided'}
                                    </div>
                                    <div className="program-stats">
                                        <span>📄 {program.input_count} inputs</span>
                                        <span>📊 {program.signal_count} signals</span>
                                        {highRisk && (
                                            <span className="signal-badge high">⚠️ High Risk</span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Recent Signals */}
            {signals.length > 0 && (
                <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Recent Signals</h3>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Confidence</th>
                                    <th>Explanation</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {signals.slice(0, 10).map(signal => (
                                    <tr key={signal.id}>
                                        <td>
                                            <span className="signal-type">{signal.signal_type.replace('_', ' ')}</span>
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
                                        <td>
                                            {signal.current_override ? (
                                                <span className="override-badge">Overridden</span>
                                            ) : (
                                                <span className="ai-label">AI Assisted</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
