import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Tarjetas de resumen del proyecto: módulos, integraciones, stack
export const ProjectSummary = ({ result }) => {
    const { totalModules, totalIntegrations, primaryLanguage, integrations, repoUrl, analyzedAt, } = result;
    // Extrae el nombre del repo de la URL para mostrarlo
    const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    // Contar por tipo de integración
    const dbCount = integrations.filter((i) => i.type === 'database').length;
    const apiCount = integrations.filter((i) => i.type === 'external_api').length;
    return (_jsxs("div", { className: "project-summary", children: [_jsx("div", { className: "project-summary__header", children: _jsxs("div", { children: [_jsx("h2", { className: "project-summary__repo-name", children: repoName }), _jsxs("p", { className: "project-summary__date", children: ["Analizado el", ' ', new Date(analyzedAt).toLocaleDateString('es-AR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })] })] }) }), _jsxs("div", { className: "project-summary__cards", children: [_jsxs("div", { className: "project-summary__card", children: [_jsx("span", { className: "project-summary__card-value", children: totalModules }), _jsx("span", { className: "project-summary__card-label", children: "\uD83D\uDCC1 M\u00F3dulos" })] }), _jsxs("div", { className: "project-summary__card project-summary__card--integrations", children: [_jsx("span", { className: "project-summary__card-value", children: totalIntegrations }), _jsx("span", { className: "project-summary__card-label", children: "\uD83D\uDD0C Integraciones" })] }), _jsxs("div", { className: "project-summary__card project-summary__card--db", children: [_jsx("span", { className: "project-summary__card-value", children: dbCount }), _jsx("span", { className: "project-summary__card-label", children: "\uD83D\uDDC4\uFE0F Bases de datos" })] }), _jsxs("div", { className: "project-summary__card project-summary__card--api", children: [_jsx("span", { className: "project-summary__card-value", children: apiCount }), _jsx("span", { className: "project-summary__card-label", children: "\uD83C\uDF10 APIs externas" })] })] }), _jsx("div", { className: "project-summary__meta", children: _jsxs("p", { className: "project-summary__language", children: ["Stack predominante: ", _jsx("strong", { children: primaryLanguage })] }) }), _jsxs("div", { className: "project-summary__agents-info", children: [_jsx("h3", { className: "project-summary__agents-title", children: "Pipeline de agentes" }), _jsxs("ul", { className: "project-summary__agents-list", children: [_jsx("li", { children: "\uD83D\uDD0D Analizador \u2014 mapea m\u00F3dulos y dependencias internas" }), _jsx("li", { children: "\uD83D\uDD0C Integraciones \u2014 detecta BD y APIs externas" }), _jsx("li", { children: "\uD83E\uDDE9 Orquestador \u2014 arma el grafo final" })] })] })] }));
};
