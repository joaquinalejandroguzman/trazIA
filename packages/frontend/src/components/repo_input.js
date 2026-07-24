import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
// Valida que la URL sea un repo de GitHub público con formato básico correcto
function isValidGitHubUrl(url) {
    return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(url.trim());
}
// Componente de entrada de URL — pantalla inicial y barra superior en modo análisis
export const RepoInput = ({ onAnalyze, status, onReset }) => {
    const [url, setUrl] = useState('');
    const [validationError, setValidationError] = useState(null);
    const isLoading = status === 'loading';
    const hasResult = status === 'success';
    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed) {
            setValidationError('Ingresá la URL del repositorio');
            return;
        }
        if (!isValidGitHubUrl(trimmed)) {
            setValidationError('La URL debe ser un repositorio público de GitHub (https://github.com/usuario/repo)');
            return;
        }
        setValidationError(null);
        onAnalyze(trimmed);
    };
    const handleReset = () => {
        setUrl('');
        setValidationError(null);
        onReset();
    };
    return (_jsxs("div", { className: `repo-input ${hasResult ? 'repo-input--compact' : 'repo-input--hero'}`, children: [!hasResult && (_jsxs("div", { className: "repo-input__hero-text", children: [_jsxs("h1", { className: "repo-input__title", children: ["Traz", _jsx("span", { className: "repo-input__title-accent", children: "IA" })] }), _jsx("p", { className: "repo-input__subtitle", children: "Visualizador de arquitectura con trazabilidad de intenci\u00F3n" })] })), _jsxs("form", { className: "repo-input__form", onSubmit: handleSubmit, noValidate: true, children: [_jsxs("div", { className: "repo-input__field-group", children: [_jsx("input", { type: "url", className: `repo-input__field ${validationError ? 'repo-input__field--error' : ''}`, placeholder: "https://github.com/usuario/repositorio", value: url, onChange: (e) => {
                                    setUrl(e.target.value);
                                    if (validationError)
                                        setValidationError(null);
                                }, disabled: isLoading, "aria-label": "URL del repositorio de GitHub", "aria-describedby": validationError ? 'url-error' : undefined }), _jsx("button", { type: "submit", className: "repo-input__btn", disabled: isLoading || !url.trim(), "aria-busy": isLoading, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "repo-input__spinner", "aria-hidden": "true" }), "Analizando\u2026"] })) : ('Analizar') }), hasResult && (_jsx("button", { type: "button", className: "repo-input__btn repo-input__btn--secondary", onClick: handleReset, children: "Nuevo repo" }))] }), validationError && (_jsx("p", { id: "url-error", className: "repo-input__error", role: "alert", children: validationError }))] }), !hasResult && (_jsxs(_Fragment, { children: [_jsx("p", { className: "repo-input__hint", children: "Solo repositorios p\u00FAblicos de GitHub \u00B7 TypeScript / JavaScript" }), _jsxs("div", { className: "repo-input__info-box", children: [_jsx("h3", { className: "repo-input__info-title", children: "\u00BFQu\u00E9 hace TrazIA?" }), _jsxs("ul", { className: "repo-input__info-list", children: [_jsx("li", { children: "\uD83D\uDCCA Analiza la arquitectura de tu c\u00F3digo sin ejecutarlo" }), _jsx("li", { children: "\uD83C\uDFA8 Colorea m\u00F3dulos seg\u00FAn su estado de trazabilidad" }), _jsx("li", { children: "\u270D\uFE0F Genera specs EARS retroactivas para c\u00F3digo sin documentar" }), _jsx("li", { children: "\uD83D\uDCC8 Calcula el Spec Health Score del proyecto" })] })] })] }))] }));
};
