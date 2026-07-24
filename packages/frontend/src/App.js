import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
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
    const { status, result, error, analyzeRepo, reset } = useAnalysis();
    const [selectedNode, setSelectedNode] = useState(null);
    const handleAnalyze = (repoUrl) => {
        setSelectedNode(null);
        analyzeRepo(repoUrl);
    };
    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };
    const handleClosePanel = () => {
        setSelectedNode(null);
    };
    const showDashboard = status === 'success' && result;
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: "app__header", children: _jsx(RepoInput, { onAnalyze: handleAnalyze, status: status, onReset: reset }) }), error && (_jsx("div", { className: "app__error-container", children: _jsx(ErrorBanner, { message: error, onDismiss: reset }) })), showDashboard && (_jsxs("main", { className: "app__main", children: [_jsxs("aside", { className: "app__sidebar", children: [_jsx(ProjectSummary, { result: result }), _jsx(GraphLegend, {})] }), _jsx("section", { className: "app__graph-container", children: _jsx(ArchitectureGraph, { modules: result.modules, folders: result.folders, integrations: result.integrations, edges: result.edges, onNodeClick: handleNodeClick, selectedNodeId: selectedNode?.id }) }), _jsx(ModulePanel, { node: selectedNode, onClose: handleClosePanel })] }))] }));
};
export default App;
