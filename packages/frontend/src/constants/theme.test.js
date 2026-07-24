// Tests de property-based y unitarios para las funciones de trazabilidad en theme.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTraceabilityColor, getEffectiveScore, TRACEABILITY_ANCHORS, ZONE_COLORS, detectZone, } from './theme';
// ============================================================
// Property 1: Piecewise linear interpolation correctness
// Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.4, 6.5
// ============================================================
describe('Property 1: Piecewise linear interpolation correctness', () => {
    it('cada canal RGB coincide con la fórmula de interpolación lineal por segmentos', () => {
        const { red, yellow, green } = TRACEABILITY_ANCHORS;
        fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
            const result = getTraceabilityColor(score);
            // Calcular valor esperado por la fórmula
            let expectedR, expectedG, expectedB;
            if (score <= 50) {
                const t = score / 50;
                expectedR = Math.round(red.r + (yellow.r - red.r) * t);
                expectedG = Math.round(red.g + (yellow.g - red.g) * t);
                expectedB = Math.round(red.b + (yellow.b - red.b) * t);
            }
            else {
                const t = (score - 50) / 50;
                expectedR = Math.round(yellow.r + (green.r - yellow.r) * t);
                expectedG = Math.round(yellow.g + (green.g - yellow.g) * t);
                expectedB = Math.round(yellow.b + (green.b - yellow.b) * t);
            }
            const hex = (n) => n.toString(16).padStart(2, '0');
            const expectedColor = `#${hex(expectedR)}${hex(expectedG)}${hex(expectedB)}`;
            expect(result).toBe(expectedColor);
        }), { numRuns: 100 });
    });
});
// ============================================================
// Property 2: Input clamping and output format
// Validates: Requirements 6.2, 6.3
// ============================================================
describe('Property 2: Input clamping and output format', () => {
    it('la salida siempre es un hex válido y equivale a getTraceabilityColor(clamp(n))', () => {
        // Generador que incluye NaN, Infinity, -Infinity, negativos y >100
        const arbitraryNumber = fc.oneof(fc.double({ min: -1000, max: 1000, noNaN: false }), fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity), fc.integer({ min: -500, max: 500 }));
        fc.assert(fc.property(arbitraryNumber, (n) => {
            const result = getTraceabilityColor(n);
            // Verificar formato hex válido
            expect(result).toMatch(/^#[0-9a-f]{6}$/);
            // Verificar equivalencia con clamp
            const clamped = !Number.isFinite(n) ? 0 : n < 0 ? 0 : n > 100 ? 100 : n;
            const expected = getTraceabilityColor(clamped);
            expect(result).toBe(expected);
        }), { numRuns: 100 });
    });
});
// ============================================================
// Property 3: Effective score override rules
// Validates: Requirements 1.6, 1.7, 1.8, 1.9
// ============================================================
describe('Property 3: Effective score override rules', () => {
    it('aplica correctamente las reglas de override según specStatus', () => {
        const specStatusArb = fc.oneof(fc.constant(undefined), fc.constant('traced'), fc.constant('untraced'), fc.constant('drift'));
        const scoreArb = fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 100 }));
        fc.assert(fc.property(specStatusArb, scoreArb, (specStatus, specHealthScore) => {
            const result = getEffectiveScore(specStatus, specHealthScore);
            const baseScore = specHealthScore ?? 0;
            if (specStatus === undefined || specStatus === 'untraced') {
                expect(result).toBe(0);
            }
            else if (specStatus === 'drift') {
                expect(result).toBe(Math.min(baseScore, 50));
            }
            else {
                // specStatus === 'traced'
                expect(result).toBe(baseScore);
            }
        }), { numRuns: 100 });
    });
});
// ============================================================
// Tests unitarios (example-based)
// ============================================================
describe('getTraceabilityColor — anchors exactos', () => {
    it('score 0 retorna exactamente #e53935', () => {
        expect(getTraceabilityColor(0)).toBe('#e53935');
    });
    it('score 50 retorna exactamente #fdd835', () => {
        expect(getTraceabilityColor(50)).toBe('#fdd835');
    });
    it('score 100 retorna exactamente #43a047', () => {
        expect(getTraceabilityColor(100)).toBe('#43a047');
    });
});
describe('detectZone + ZONE_COLORS — no interfieren con trazabilidad', () => {
    it('detectZone retorna siempre una zona válida y ZONE_COLORS tiene colores para ella', () => {
        const paths = [
            'packages/frontend/src/App.tsx',
            'packages/backend/src/app.ts',
            'shared/utils/index.ts',
            '.eslintrc.json',
            'some/random/file.py',
        ];
        for (const path of paths) {
            const zone = detectZone(path);
            const colors = ZONE_COLORS[zone];
            expect(colors).toBeDefined();
            expect(colors.bg).toBeDefined();
            expect(colors.border).toBeDefined();
            expect(colors.text).toBeDefined();
        }
    });
});
