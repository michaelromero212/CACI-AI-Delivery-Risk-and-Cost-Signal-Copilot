/**
 * API Service for CACI AI Delivery Risk & Cost Signal Copilot
 */

const API_BASE = 'http://localhost:8000/api';

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    // Remove Content-Type for FormData (file uploads)
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// ============ Programs ============

export const programsApi = {
    list: () => request('/programs'),

    get: (id) => request(`/programs/${id}`),

    create: (data) => request('/programs', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => request(`/programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    delete: (id) => request(`/programs/${id}`, {
        method: 'DELETE',
    }),
};

// ============ Inputs ============

export const inputsApi = {
    listForProgram: (programId) => request(`/inputs/program/${programId}`),

    get: (id) => request(`/inputs/${id}`),

    uploadFile: async (programId, file) => {
        const formData = new FormData();
        formData.append('file', file);

        return request(`/inputs/program/${programId}/upload`, {
            method: 'POST',
            body: formData,
        });
    },

    createManual: (programId, content) => request(`/inputs/program/${programId}/manual`, {
        method: 'POST',
        body: JSON.stringify({ content }),
    }),

    delete: (id) => request(`/inputs/${id}`, {
        method: 'DELETE',
    }),
};

// ============ Signals ============

export const signalsApi = {
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/signals${query ? `?${query}` : ''}`);
    },

    get: (id) => request(`/signals/${id}`),

    analyzeInput: (inputId) => request(`/signals/analyze/input/${inputId}`, {
        method: 'POST',
    }),

    analyzeProgram: (programId) => request(`/signals/analyze/program/${programId}`, {
        method: 'POST',
    }),
};

// ============ Costs ============

export const costsApi = {
    summary: (programId = null) => {
        const query = programId ? `?program_id=${programId}` : '';
        return request(`/costs/summary${query}`);
    },
};

// ============ Overrides ============

export const overridesApi = {
    create: (signalId, data) => request(`/overrides/signal/${signalId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    listForSignal: (signalId) => request(`/overrides/signal/${signalId}`),

    list: (programId = null) => {
        const query = programId ? `?program_id=${programId}` : '';
        return request(`/overrides${query}`);
    },
};

// ============ Health ============

export const healthApi = {
    check: () => request('/health'),
};
