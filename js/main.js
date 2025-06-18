import * as fileSystem from './fileSystem.js';
import * as uiManager from './uiManager.js';
import * as analysisEngine from './analysisEngine.js';

export const appState = {
    analyzedData: null,
    processing: false,
};

export const elements = {};

function populateElements() {
    const ids = ['pageLoader', 'appContainer', 'leftSidebar', 'sidebarResizer', 'mainView', 'rightStatsPanel', 'dropZone', 'folderInput', 'loader', 'treeContainer', 'fileViewer', 'viewerFileTitle', 'viewerContent', 'statsContainer', 'dependencyContainer', 'depsContent', 'visualOutputContainer'];
    ids.forEach(id => elements[id] = document.getElementById(id));
}

function setupEventListeners() {
    elements.dropZone.addEventListener('dragover', e => e.preventDefault());
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.folderInput.addEventListener('change', handleFolderSelect);
}

async function handleFileDrop(e) {
    e.preventDefault();
    if (appState.processing) return;
    const handle = await e.dataTransfer.items[0].getAsFileSystemHandle();
    if (handle.kind === 'directory') {
        processDirectory(handle);
    }
}

async function handleFolderSelect(e) {
    if (appState.processing) return;
    const handle = await window.showDirectoryPicker();
    if (handle) {
        processDirectory(handle);
    }
}

async function processDirectory(dirHandle) {
    appState.processing = true;
    uiManager.showLoadingState(`Scanning '${dirHandle.name}'...`);

    try {
        const scanData = await fileSystem.scanDirectory(dirHandle);
        uiManager.showLoadingState(`Analyzing ${scanData.fileList.length} files...`);

        appState.analyzedData = await analysisEngine.analyze(scanData);
        uiManager.showAnalysisState(appState.analyzedData);

    } catch (err) {
        console.error("Processing failed:", err);
        uiManager.showErrorState(`Failed to process directory. ${err.message}`);
    } finally {
        appState.processing = false;
    }
}

function init() {
    populateElements();
    setupEventListeners();
    uiManager.showInitialState();
    elements.pageLoader.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);