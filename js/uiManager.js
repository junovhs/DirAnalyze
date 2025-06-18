import { elements } from './main.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';

export function showInitialState() {
    elements.loader.style.display = 'none';
    elements.treeContainer.innerHTML = '<div class="empty-notice">Drop a folder to begin analysis.</div>';
    elements.statsContainer.innerHTML = '<div class="empty-notice">Analysis will appear here.</div>';
    elements.depsContent.innerHTML = '<div class="empty-notice">Dependency info will appear here.</div>';
}

export function showLoadingState(message) {
    elements.loader.textContent = message;
    elements.loader.style.display = 'block';
    elements.treeContainer.innerHTML = '';
}

export function showErrorState(message) {
    elements.loader.style.display = 'none';
    elements.treeContainer.innerHTML = `<div class="empty-notice" style="color: #d9534f;">${message}</div>`;
}

export function showAnalysisState(analyzedData) {
    elements.loader.style.display = 'none';
    treeView.render(analyzedData);
    statsManager.update(analyzedData);
}