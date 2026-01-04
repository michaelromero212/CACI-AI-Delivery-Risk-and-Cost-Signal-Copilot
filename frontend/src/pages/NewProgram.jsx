import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { programsApi } from '../services/api';

function NewProgram() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        description: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Program name is required');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            const program = await programsApi.create(form);
            navigate(`/programs/${program.id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <Link to="/" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                ← Back to Dashboard
            </Link>

            <h1 style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                Create New Program
            </h1>

            <div className="card" style={{ maxWidth: '600px' }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            background: 'rgba(211, 47, 47, 0.1)',
                            color: 'var(--color-danger)',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Program Name *</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., Enterprise Modernization Initiative"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Brief description of the program..."
                            value={form.description}
                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? 'Creating...' : 'Create Program'}
                        </button>
                        <Link to="/" className="btn btn-secondary">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewProgram;
