import { useState, useCallback } from 'react';
import apiClient from '../services/api_client';
import { SAMPLE_ANALYSIS } from '../mocks/sample_analysis';
// Activa datos mock cuando el backend no está disponible
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
// Simula un delay de red realista en modo mock
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Hook principal que gestiona el ciclo de vida del análisis de un repo
export function useAnalysis() {
    const [status, setStatus] = useState('idle');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    // Dispara el análisis completo del repo (pipeline: Analizador → Integraciones → Orquestador)
    const analyzeRepo = useCallback(async (repoUrl) => {
        setStatus('loading');
        setError(null);
        setResult(null);
        // Modo mock: simula respuesta del backend con datos de ejemplo
        if (USE_MOCK) {
            await sleep(1800); // simula latencia del pipeline de agentes
            setResult({ ...SAMPLE_ANALYSIS, repoUrl });
            setStatus('success');
            return;
        }
        try {
            const response = await apiClient.post('/api/analyze', { repoUrl });
            setResult(response.data);
            setStatus('success');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido al analizar el repositorio';
            setError(message);
            setStatus('error');
        }
    }, []);
    // Resetea el estado para analizar un nuevo repo
    const reset = useCallback(() => {
        setStatus('idle');
        setResult(null);
        setError(null);
    }, []);
    return {
        status,
        result,
        error,
        analyzeRepo,
        reset,
    };
}
