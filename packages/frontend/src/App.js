import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useAnalysis } from './hooks/use_analysis';
import { RepoInput } from './components/repo_input';
import { ProjectSummary } from './components/project_summary';
import { ArchitectureGraph } from './components/architecture_graph';
import { GraphLegend } from './components/graph_legend';
import { ModulePanel } from './components/module_panel';
import { ErrorBanner } from './components/error_banner';
import './App.css';
// Componente raíz de la aplicación TrazIA — orquesta el flujo completo
const App = () => {
    const { status, result, error, generatingSpec, specErrorModules, analyzeRepo, generateSpec, clearSpecError, clearError, reset } = useAnalysis();
    // Guardamos el nodo seleccionado completo para poder mostrarlo en el panel
    const [selectedNode, setSelectedNode] = useState(null);
    // Ref imperativa para controlar el centrado del grafo
    const graphRef = useRef(null);
    // Sincroniza el nodo seleccionado con los datos frescos de result.modules
    useEffect(() => {
        if (selectedNode && selectedNode.type === 'module' && result) {
            const freshModule = result.modules.find((m) => m.id === selectedNode.id);
            if (freshModule && freshModule !== selectedNode) {
                setSelectedNode(freshModule);
            }
        }
    }, [result, selectedNode]);
    const handleAnalyze = (repoUrl) => {
        setSelectedNode(null);
        analyzeRepo(repoUrl);
    };
    const handleGenerateSpec = async (moduleId) => {
        await generateSpec(moduleId);
        // Actualizamos el nodo seleccionado con los datos frescos del result
        // (se recalcula en el siguiente render si hace falta)
    };
    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };
    const handleClosePanel = () => {
        setSelectedNode(null);
    };
    // Navega a una subcarpeta: actualiza la selección y centra el grafo
    const handleFolderNavigate = (folderId) => {
        const targetFolder = result?.folders.find(f => f.id === folderId);
        if (targetFolder) {
            setSelectedNode(targetFolder);
        }
        graphRef.current?.fitToNode(folderId);
    };
    const showDashboard = status === 'success' && result;
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: "app__header", children: _jsx(RepoInput, { onAnalyze: handleAnalyze, status: status, onReset: reset }) }), error && (_jsx("div", { className: "app__error-container", children: _jsx(ErrorBanner, { message: error, onDismiss: clearError }) })), showDashboard && (_jsxs("main", { className: "app__main", children: [_jsxs("aside", { className: "app__sidebar", children: [_jsx(ProjectSummary, { result: result }), _jsx(GraphLegend, {})] }), _jsx("section", { className: "app__graph-container", children: _jsx(ArchitectureGraph, { ref: graphRef, modules: result.modules, folders: result.folders, integrations: result.integrations, edges: result.edges, onNodeClick: handleNodeClick, selectedNodeId: selectedNode?.id }) }), _jsx(ModulePanel, { node: selectedNode, onClose: handleClosePanel, onGenerateSpec: handleGenerateSpec, generatingSpec: generatingSpec, specError: error, specErrorModules: specErrorModules, clearSpecError: clearSpecError, allFolders: result.folders, allModules: result.modules, onFolderNavigate: handleFolderNavigate })] }))] }));
};
export default App;
