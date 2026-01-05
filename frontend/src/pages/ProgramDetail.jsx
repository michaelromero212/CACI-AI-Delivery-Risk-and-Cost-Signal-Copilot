import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { programsApi, inputsApi, signalsApi, overridesApi } from '../services/api';

function ProgramDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [program, setProgram] = useState(null);
    const [inputs, setInputs] = useState([]);
    const [signals, setSignals] = useState([]);
    const [llmStatus, setLlmStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('signals');

    // Manual input state
    const [manualText, setManualText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Override modal state
    const [overrideModal, setOverrideModal] = useState(null);
    const [overrideForm, setOverrideForm] = useState({
        override_value: '',
        justification: '',
        analyst_name: '',
    });

    // File upload
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    async function loadData() {
        try {
            setLoading(true);
            const [programRes, inputsRes, signalsRes, healthRes] = await Promise.all([
                programsApi.get(id),
                inputsApi.listForProgram(id),
                signalsApi.list({ program_id: id }),
                fetch('http://localhost:8000/api/health').then(r => r.json()).catch(() => null)
            ]);
            setProgram(programRes);
            setInputs(inputsRes || []);
            setSignals(signalsRes.signals || []);
            setLlmStatus(healthRes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleFileUpload(files) {
        if (!files || files.length === 0) return;

        try {
            setSubmitting(true);
            for (const file of files) {
                await inputsApi.uploadFile(id, file);
            }
            await loadData();
        } catch (err) {
            alert('Error uploading file: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleManualSubmit(e) {
        e.preventDefault();
        if (!manualText.trim()) return;

        try {
            setSubmitting(true);
            await inputsApi.createManual(id, manualText);
            setManualText('');
            await loadData();
        } catch (err) {
            alert('Error submitting input: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function analyzeProgram() {
        try {
            setAnalyzing(true);
            await signalsApi.analyzeProgram(id);
            await loadData();
        } catch (err) {
            alert('Error analyzing: ' + err.message);
        } finally {
            setAnalyzing(false);
        }
    }

    async function handleOverrideSubmit(e) {
        e.preventDefault();
        if (!overrideForm.justification || !overrideForm.analyst_name || !overrideForm.override_value) {
            alert('All fields are required');
            return;
        }

        try {
            await overridesApi.create(overrideModal.id, overrideForm);
            setOverrideModal(null);
            setOverrideForm({ override_value: '', justification: '', analyst_name: '' });
            await loadData();
        } catch (err) {
            alert('Error submitting override: ' + err.message);
        }
    }

    async function deleteInput(inputId) {
        if (!confirm('Delete this input and its signals?')) return;

        try {
            await inputsApi.delete(inputId);
            await loadData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    }

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error || !program) {
        return (
            <div className="card">
                <p style={{ color: 'var(--color-danger)' }}>Error: {error || 'Program not found'}</p>
                <Link to="/" className="btn btn-secondary">Back to Dashboard</Link>
            </div>
        );
    }

    const signalOptions = program ?
        signals[0]?.signal_type === 'cost_risk'
            ? ['NORMAL', 'ANOMALOUS']
            : ['LOW', 'MEDIUM', 'HIGH']
        : ['LOW', 'MEDIUM', 'HIGH'];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-4) var(--space-6)' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Link to="/" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                    textDecoration: 'none',
                    fontWeight: 500
                }}>
                    ← Back to Dashboard
                </Link>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    padding: 'var(--space-6)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--color-border-light)'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)' }}>{program.name}</h1>
                            {signals.some(s => s.signal_value === 'HIGH') && (
                                <span className="signal-badge high">⚠️ Attention Required</span>
                            )}
                        </div>
                        {program.description && (
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', maxWidth: '600px', fontSize: 'var(--font-size-base)' }}>
                                {program.description}
                            </p>
                        )}
                    </div>

                    {llmStatus && (
                        <div style={{
                            paddingLeft: 'var(--space-6)',
                            borderLeft: '1px solid var(--color-border-light)',
                            minWidth: '200px'
                        }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 'var(--space-2)', letterSpacing: '0.05em' }}>
                                AI SYSTEM STATUS
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
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
                                {llmStatus?.model?.split('/').pop() || 'Loading...'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions & Tabs */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                borderBottom: '1px solid var(--color-border-light)'
            }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        onClick={() => setActiveTab('signals')}
                        style={{
                            padding: 'var(--space-4) var(--space-6)',
                            border: 'none',
                            background: 'none',
                            fontWeight: 600,
                            fontSize: 'var(--font-size-base)',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'signals' ? '3px solid var(--color-primary)' : '3px solid transparent',
                            color: activeTab === 'signals' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            transition: 'all 0.2s ease',
                            marginBottom: '-1px'
                        }}
                    >
                        Signals ({signals.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('inputs')}
                        style={{
                            padding: 'var(--space-4) var(--space-6)',
                            border: 'none',
                            background: 'none',
                            fontWeight: 600,
                            fontSize: 'var(--font-size-base)',
                            cursor: 'pointer',
                            borderBottom: activeTab === 'inputs' ? '3px solid var(--color-primary)' : '3px solid transparent',
                            color: activeTab === 'inputs' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            transition: 'all 0.2s ease',
                            marginBottom: '-1px'
                        }}
                    >
                        Inputs ({inputs.length})
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-2)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setActiveTab('upload')}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                        <span>➕</span> Add Data
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={analyzeProgram}
                        disabled={analyzing || inputs.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                        {analyzing ? '⌛ Analyzing...' : '⚡ Re-analyze Program'}
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'signals' && (
                <div>
                    {signals.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-title">No signals yet</div>
                            <div className="empty-state-text">
                                Upload inputs and run analysis to generate risk and cost signals.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                            {signals.map(signal => (
                                <div key={signal.id} className="card" style={{ padding: 'var(--space-5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <span style={{
                                                textTransform: 'uppercase',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                color: 'var(--color-text-secondary)',
                                                backgroundColor: 'var(--color-bg-light)',
                                                padding: '2px 8px',
                                                borderRadius: '4px'
                                            }}>
                                                {signal.signal_type.replace('_', ' ')}
                                            </span>
                                            <span className={`signal-badge ${signal.signal_value.toLowerCase()}`}>
                                                {signal.current_override ? signal.current_override.override_value : signal.signal_value}
                                            </span>
                                            {signal.current_override && (
                                                <span className="override-badge">
                                                    Overridden by {signal.current_override.analyst_name}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                setOverrideModal(signal);
                                                setOverrideForm({
                                                    override_value: signal.signal_value,
                                                    justification: '',
                                                    analyst_name: '',
                                                });
                                            }}
                                        >
                                            Override
                                        </button>
                                    </div>

                                    <div style={{
                                        backgroundColor: 'var(--color-bg-light)',
                                        padding: 'var(--space-4)',
                                        borderRadius: '8px',
                                        marginBottom: 'var(--space-4)',
                                        borderLeft: `4px solid var(--color-${signal.signal_value === 'HIGH' || signal.signal_value === 'ANOMALOUS' ? 'danger' : (signal.signal_value === 'MEDIUM' ? 'warning' : 'success')})`
                                    }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                                            AI EXPLANATION
                                        </div>
                                        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>{signal.explanation}</p>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            <span>📊 Confidence: <strong>{(signal.confidence_score * 100).toFixed(0)}%</strong></span>
                                            <span>⚙️ Source: {inputs.find(i => i.id === signal.input_id)?.filename || 'Manual Input'}</span>
                                            {signal.cost_metric && (
                                                <span>💰 Cost: ${signal.cost_metric.estimated_cost_usd.toFixed(4)}</span>
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: 'var(--color-primary)',
                                            textTransform: 'uppercase',
                                            opacity: 0.6
                                        }}>
                                            AI ASSISTED SIGNAL
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'inputs' && (
                <div>
                    {inputs.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-title">No inputs yet</div>
                            <div className="empty-state-text">
                                Upload CSV or TXT files, or enter manual text to get started.
                            </div>
                            <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
                                Add Input
                            </button>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="col-100">Type</th>
                                        <th className="col-flex">Filename</th>
                                        <th className="col-100">Status</th>
                                        <th className="col-150">Content Type</th>
                                        <th className="col-150">Created</th>
                                        <th className="col-100">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inputs.map(input => (
                                        <tr key={input.id}>
                                            <td className="col-100">{input.input_type.toUpperCase()}</td>
                                            <td className="col-flex">
                                                <span className="text-truncate" title={input.filename || 'Manual Input'}>
                                                    {input.filename || 'Manual Input'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`signal-badge ${input.status === 'processed' ? 'low' : 'medium'}`}>
                                                    {input.status}
                                                </span>
                                            </td>
                                            <td>{input.metadata_json?.content_type || 'N/A'}</td>
                                            <td>{new Date(input.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => deleteInput(input.id)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'upload' && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>Add Input</h3>

                    {/* File Upload */}
                    <div
                        className={`file-upload ${dragOver ? 'drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleFileUpload(e.dataTransfer.files);
                        }}
                    >
                        <div className="file-upload-icon">📁</div>
                        <div className="file-upload-text">
                            <strong>Click to upload</strong> or drag and drop
                        </div>
                        <div className="file-upload-hint">
                            CSV or TXT files (risk registers, status reports, cost summaries)
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

                    <div style={{ textAlign: 'center', margin: 'var(--space-4) 0', color: 'var(--color-text-muted)' }}>
                        — or —
                    </div>

                    {/* Manual Input */}
                    <form onSubmit={handleManualSubmit}>
                        <div className="form-group">
                            <label className="form-label">Manual Text Input</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Paste status updates, analyst notes, or any relevant program information..."
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                rows={8}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || !manualText.trim()}
                        >
                            {submitting ? 'Submitting...' : 'Submit Manual Input'}
                        </button>
                    </form>
                </div>
            )}

            {/* Override Modal */}
            {overrideModal && (
                <div className="modal-backdrop" onClick={() => setOverrideModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Override Signal</h3>
                            <button className="modal-close" onClick={() => setOverrideModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleOverrideSubmit}>
                            <div className="modal-body">
                                <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                                    Original value: <strong>{overrideModal.signal_value}</strong>
                                </p>

                                <div className="form-group">
                                    <label className="form-label">New Value *</label>
                                    <select
                                        className="form-select"
                                        value={overrideForm.override_value}
                                        onChange={(e) => setOverrideForm(f => ({ ...f, override_value: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select...</option>
                                        {signalOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Analyst Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Your name"
                                        value={overrideForm.analyst_name}
                                        onChange={(e) => setOverrideForm(f => ({ ...f, analyst_name: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Justification * (min 10 characters)</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="Explain why you are overriding this AI-generated signal..."
                                        value={overrideForm.justification}
                                        onChange={(e) => setOverrideForm(f => ({ ...f, justification: e.target.value }))}
                                        required
                                        minLength={10}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setOverrideModal(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-accent">
                                    Submit Override
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProgramDetail;
