import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ZONE_COLORS, INTEGRATION_COLORS } from '../constants/theme';
// Leyenda visual del grafo: colores por zona del proyecto y tipo de integración
export const GraphLegend = () => {
    const zoneItems = [
        { key: 'frontend', color: ZONE_COLORS.frontend.border, label: 'Frontend' },
        { key: 'backend', color: ZONE_COLORS.backend.border, label: 'Backend' },
        { key: 'shared', color: ZONE_COLORS.shared.border, label: 'Shared / Utils' },
        { key: 'config', color: ZONE_COLORS.config.border, label: 'Configuración' },
    ];
    const integrationItems = [
        { key: 'database', color: INTEGRATION_COLORS.database.border, label: '🗄️ Base de datos' },
        { key: 'external_api', color: INTEGRATION_COLORS.external_api.border, label: '🌐 API externa' },
    ];
    return (_jsxs("div", { className: "graph-legend", role: "list", "aria-label": "Leyenda del grafo", children: [_jsxs("div", { className: "graph-legend__section", children: [_jsx("span", { className: "graph-legend__section-title", children: "Zonas" }), zoneItems.map((item) => (_jsxs("div", { className: "graph-legend__item", role: "listitem", children: [_jsx("span", { className: "graph-legend__dot", style: { backgroundColor: item.color }, "aria-hidden": "true" }), _jsx("span", { className: "graph-legend__label", children: item.label })] }, item.key)))] }), _jsxs("div", { className: "graph-legend__section", children: [_jsx("span", { className: "graph-legend__section-title", children: "Integraciones" }), integrationItems.map((item) => (_jsxs("div", { className: "graph-legend__item", role: "listitem", children: [_jsx("span", { className: "graph-legend__dot", style: { backgroundColor: item.color }, "aria-hidden": "true" }), _jsx("span", { className: "graph-legend__label", children: item.label })] }, item.key)))] })] }));
};
