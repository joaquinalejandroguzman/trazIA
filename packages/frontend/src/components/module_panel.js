import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { getTraceabilityColor, getEffectiveScore } from '../constants/theme';
import { countDirectChildren, formatChildLabel, getSortedSubfolders, truncateFolderName } from '../utils/folder_panel_helpers';
// Panel lateral que muestra detalles de un nodo seleccionado (módulo, carpeta o integración)
export const ModulePanel = ({ node, onClose, onGenerateSpec, generatingSpec, specError, specErrorModules, clearSpecError, allFolders, allModules, onFolderNavigate }) => {
    // Auto-trigger: genera spec EARS on-demand al seleccionar un módulo sin spec
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!node || node.type !== 'module')
            return;
        const module = node;
        // Guards: no disparar si ya tiene spec, si no hay sourceContent, si ya falló, o si ya está generando
        if (module.earsSpec)
            return;
        if (!module.sourceContent)
            return;
        if (specErrorModules.has(module.id))
            return;
        if (generatingSpec === module.id)
            return;
        onGenerateSpec(module.id);
    }, [node?.id]); // keyeado SOLO al node.id — disparar una vez por selección de módulo
    if (!node)
        return null;
    const isModule = node.type === 'module';
    const isFolder = node.type === 'folder';
    const isIntegration = node.type === 'database' || node.type === 'external_api';
    return (_jsxs("aside", { className: `module-panel ${node ? 'module-panel--open' : ''}`, role: "complementary", "aria-label": "Detalles del nodo", children: [_jsxs("div", { className: "module-panel__header", children: [_jsx("h2", { className: "module-panel__title", children: node.name }), _jsx("button", { className: "module-panel__close", onClick: onClose, "aria-label": "Cerrar panel", title: "Cerrar", children: "\u2715" })] }), _jsxs("div", { className: "module-panel__body", children: [_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Tipo" }), _jsxs("span", { className: `module-panel__badge module-panel__badge--${node.type}`, children: [node.type === 'module' && '📄 Archivo', node.type === 'folder' && '📁 Carpeta', node.type === 'database' && '🗄️ Base de datos', node.type === 'external_api' && '🌐 API externa'] })] }), isModule && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Ruta" }), _jsx("p", { className: "module-panel__code", children: node.path })] }), node.linesOfCode !== undefined && (_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "L\u00EDneas de c\u00F3digo" }), _jsx("p", { className: "module-panel__text", children: node.linesOfCode?.toLocaleString() })] })), node.lastModified && (_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "\u00DAltima modificaci\u00F3n" }), _jsx("p", { className: "module-panel__text", children: new Date(node.lastModified).toLocaleDateString('es-AR', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        }) })] })), node.dependencies.length > 0 && (_jsxs("section", { className: "module-panel__section", children: [_jsxs("h3", { className: "module-panel__section-title", children: ["Dependencias (", node.dependencies.length, ")"] }), _jsx("ul", { className: "module-panel__list", children: node.dependencies.map((dep) => (_jsx("li", { className: "module-panel__list-item", children: _jsx("code", { className: "module-panel__code-inline", children: dep }) }, dep))) })] })), (() => {
                                const module = node;
                                const specStatus = module.specStatus;
                                const specHealthScore = module.specHealthScore;
                                const effectiveScore = getEffectiveScore(specStatus, specHealthScore);
                                const traceabilityColor = getTraceabilityColor(effectiveScore);
                                const hasScore = specHealthScore !== undefined;
                                const scoreDisplay = hasScore ? `${Math.floor(specHealthScore)}%` : '0%';
                                const isGenerating = generatingSpec === module.id;
                                // Badge de estado: texto y color según specStatus
                                const badgeText = specStatus === 'traced' ? 'Trazado'
                                    : specStatus === 'drift' ? 'Drift'
                                        : 'Sin spec';
                                const badgeColor = specStatus === 'traced' ? '#43a047'
                                    : specStatus === 'drift' ? '#fdd835'
                                        : '#e53935';
                                // Botón condicional según la zona efectiva
                                // Zona roja (0–33): "Generar Spec", zona amarilla (34–66): "Mejorar Spec", zona verde (67–100) + traced: sin botón
                                const showButton = !(specStatus === 'traced' && effectiveScore >= 67);
                                const buttonLabel = effectiveScore <= 33 ? 'Generar Spec' : 'Mejorar Spec';
                                return (_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Trazabilidad" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: '0.95rem', fontWeight: 500 }, children: hasScore ? scoreDisplay : 'Sin trazabilidad' }), _jsx("span", { style: {
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 4,
                                                        color: '#fff',
                                                        backgroundColor: badgeColor,
                                                    }, children: badgeText })] }), !hasScore && (_jsx("span", { style: { fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: 4 }, children: "0%" })), _jsx("div", { style: {
                                                width: '100%',
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: '#e0e0e0',
                                                overflow: 'hidden',
                                                marginBottom: 12,
                                            }, children: _jsx("div", { style: {
                                                    width: `${hasScore ? Math.floor(specHealthScore) : 0}%`,
                                                    height: '100%',
                                                    borderRadius: 4,
                                                    backgroundColor: traceabilityColor,
                                                    transition: 'width 300ms, background-color 300ms',
                                                } }) }), showButton && (_jsx("button", { className: "module-panel__generate-btn", onClick: () => !isGenerating && onGenerateSpec(module.id), "aria-disabled": isGenerating, style: {
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                border: 'none',
                                                backgroundColor: isGenerating ? '#bdbdbd' : '#1976d2',
                                                color: '#fff',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                                opacity: isGenerating ? 0.7 : 1,
                                                marginBottom: 8,
                                            }, children: isGenerating ? 'Generando...' : buttonLabel })), specError && (_jsx("p", { style: {
                                                fontSize: '0.75rem',
                                                color: '#d32f2f',
                                                marginTop: 4,
                                                wordBreak: 'break-word',
                                            }, children: specError.length > 200 ? `${specError.slice(0, 200)}…` : specError }))] }));
                            })(), (() => {
                                const module = node;
                                const isGenerating = generatingSpec === module.id;
                                const hasSpec = !!module.earsSpec;
                                const hasError = specErrorModules.has(module.id);
                                const noSource = !module.sourceContent;
                                const handleRetry = () => {
                                    clearSpecError(module.id);
                                    onGenerateSpec(module.id);
                                };
                                return (_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Spec EARS" }), noSource && !hasSpec && (_jsx("p", { style: { fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }, children: "No hay c\u00F3digo fuente disponible para generar la spec" })), isGenerating && !hasSpec && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { className: "module-panel__spinner", style: {
                                                        display: 'inline-block',
                                                        width: 16,
                                                        height: 16,
                                                        border: '2px solid #e0e0e0',
                                                        borderTop: '2px solid #1976d2',
                                                        borderRadius: '50%',
                                                        animation: 'spin 0.8s linear infinite',
                                                    } }), _jsx("span", { style: { fontSize: '0.85rem', color: '#666' }, children: "Generando spec..." })] })), hasError && !hasSpec && (_jsxs("div", { children: [specError && (_jsx("p", { style: {
                                                        fontSize: '0.75rem',
                                                        color: '#d32f2f',
                                                        marginBottom: 8,
                                                        wordBreak: 'break-word',
                                                    }, children: specError.length > 200 ? `${specError.slice(0, 200)}…` : specError })), _jsx("button", { className: "module-panel__retry-btn", onClick: handleRetry, style: {
                                                        padding: '6px 12px',
                                                        borderRadius: 4,
                                                        border: '1px solid #d32f2f',
                                                        backgroundColor: 'transparent',
                                                        color: '#d32f2f',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                    }, children: "Reintentar" })] })), hasSpec && (_jsx("pre", { style: {
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                fontSize: '0.8rem',
                                                lineHeight: 1.5,
                                                backgroundColor: '#f5f5f5',
                                                padding: 12,
                                                borderRadius: 6,
                                                maxHeight: 400,
                                                overflow: 'auto',
                                                margin: 0,
                                            }, children: module.earsSpec }))] }));
                            })()] })), isFolder && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Ruta" }), _jsx("p", { className: "module-panel__code", children: node.path })] }), _jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Contenido" }), (() => {
                                        const counts = countDirectChildren(node.id, allFolders ?? [], allModules ?? []);
                                        return (_jsxs(_Fragment, { children: [_jsx("p", { className: "module-panel__text", children: formatChildLabel(counts.folders, 'folder') }), _jsx("p", { className: "module-panel__text", children: formatChildLabel(counts.files, 'file') })] }));
                                    })()] }), (() => {
                                const sortedSubfolders = getSortedSubfolders(node.id, allFolders ?? []);
                                if (sortedSubfolders.length === 0)
                                    return null;
                                return (_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Subcarpetas" }), _jsx("div", { className: "module-panel__folder-buttons", children: sortedSubfolders.map((sub) => (_jsxs("button", { className: "module-panel__folder-btn", onClick: () => onFolderNavigate?.(sub.id), title: sub.name, children: ["\uD83D\uDCC1 ", truncateFolderName(sub.name)] }, sub.id))) })] }));
                            })()] })), isIntegration && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "module-panel__section", children: [_jsx("h3", { className: "module-panel__section-title", children: "Descripci\u00F3n" }), _jsx("p", { className: "module-panel__text", children: node.description })] }), _jsxs("section", { className: "module-panel__section", children: [_jsxs("h3", { className: "module-panel__section-title", children: ["Detectada en (", node.detectedIn.length, " m\u00F3dulos)"] }), _jsx("ul", { className: "module-panel__list", children: node.detectedIn.map((file) => (_jsx("li", { className: "module-panel__list-item", children: _jsx("code", { className: "module-panel__code-inline", children: file }) }, file))) })] })] }))] })] }));
};
