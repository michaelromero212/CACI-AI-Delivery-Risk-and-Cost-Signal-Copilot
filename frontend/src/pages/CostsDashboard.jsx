import { useState, useEffect } from 'react';
import { costsApi, overridesApi } from '../services/api';

function CostsDashboard() {
    const [costSummary, setCostSummary] = useState(null);
    const [overrides, setOverrides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [costsRes, overridesRes] = await Promise.all([
                costsApi.summary(),
                overridesApi.list(),
            ]);
            setCostSummary(costsRes);
            setOverrides(overridesRes.overrides || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

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
            <h1 style={{ marginBottom: 'var(--space-6)' }}>Cost Transparency Dashboard</h1>

            {/* Summary Panel */}
            <div className="cost-panel" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="cost-panel-title">
                    💰 AI Usage & Cost Summary
                </div>
                {costSummary && costSummary.total_signals > 0 ? (
                    <div className="cost-grid">
                        <div className="cost-item">
                            <div className="cost-item-label">Total Cost</div>
                            <div className="cost-item-value">${costSummary.total_cost_usd.toFixed(4)}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Total Tokens Used</div>
                            <div className="cost-item-value">{costSummary.total_tokens.toLocaleString()}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Signals Generated</div>
                            <div className="cost-item-value">{costSummary.total_signals}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Avg Cost/Signal</div>
                            <div className="cost-item-value">${costSummary.avg_cost_per_signal.toFixed(6)}</div>
                        </div>
                        <div className="cost-item">
                            <div className="cost-item-label">Avg Tokens/Signal</div>
                            <div className="cost-item-value">{costSummary.avg_tokens_per_signal.toLocaleString()}</div>
                        </div>
                    </div>
                ) : (
                    <p style={{ opacity: 0.8 }}>No AI usage data yet. Generate signals to see cost metrics.</p>
                )}
            </div>

            {/* Model Breakdown */}
            {costSummary && Object.keys(costSummary.model_breakdown || {}).length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Cost by Model</h3>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th>Invocations</th>
                                    <th>Tokens</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(costSummary.model_breakdown).map(([model, data]) => (
                                    <tr key={model}>
                                        <td><code>{model}</code></td>
                                        <td>{data.invocations}</td>
                                        <td>{data.tokens.toLocaleString()}</td>
                                        <td>${data.cost_usd.toFixed(6)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Override History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Human Override History</h3>
                </div>
                {overrides.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-title">No overrides yet</div>
                        <div className="empty-state-text">
                            When analysts override AI-generated signals, they will appear here for audit purposes.
                        </div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Analyst</th>
                                    <th>Original</th>
                                    <th>Override</th>
                                    <th>Justification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overrides.map(override => (
                                    <tr key={override.id}>
                                        <td>{new Date(override.created_at).toLocaleString()}</td>
                                        <td>{override.analyst_name}</td>
                                        <td>
                                            <span className={`signal-badge ${override.original_value.toLowerCase()}`}>
                                                {override.original_value}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`signal-badge ${override.override_value.toLowerCase()}`}>
                                                {override.override_value}
                                            </span>
                                        </td>
                                        <td style={{ maxWidth: '400px' }}>{override.justification}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ESF Principles */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">ESF Cost Transparency Principles</h3>
                </div>
                <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-6)' }}>
                    <li style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>Full Visibility:</strong> Every AI invocation is logged with token counts and estimated costs
                    </li>
                    <li style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>Human Control:</strong> All AI outputs are clearly labeled and can be overridden with mandatory justification
                    </li>
                    <li style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>Audit Trail:</strong> Override history is preserved for accountability and learning
                    </li>
                    <li style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>Cost Awareness:</strong> Leaders can make informed decisions about AI usage vs. value delivered
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default CostsDashboard;
