import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { programsApi, signalsApi, costsApi } from '../services/api';

function Dashboard() {
    const [programs, setPrograms] = useState([]);
    const [signals, setSignals] = useState([]);
    const [costSummary, setCostSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [programsRes, signalsRes, costsRes] = await Promise.all([
                programsApi.list(),
                signalsApi.list(),
                costsApi.summary(),
            ]);
            setPrograms(programsRes.programs || []);
            setSignals(signalsRes.signals || []);
            setCostSummary(costsRes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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
                <Link to="/programs/new" className="btn btn-primary">
                    + New Program
                </Link>
            </div>

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
                    <div className="stat-label">Medium Risk Signals</div>
                    <div className="stat-value" style={{ color: 'var(--signal-medium)' }}>{signalCounts.medium}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Low Risk Signals</div>
                    <div className="stat-value" style={{ color: 'var(--signal-low)' }}>{signalCounts.low}</div>
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
                    <Link to="/programs/new" className="btn btn-primary">
                        + Create Program
                    </Link>
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
                                        <td style={{ maxWidth: '400px' }}>
                                            <span className="signal-explanation">{signal.explanation}</span>
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
