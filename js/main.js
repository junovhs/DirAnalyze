// --- FILE: diranalyze/js/main.js --- //
import * as fileSystem from './fileSystem.js';
import * as uiManager from './uiManager.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import { initAiPatcher } from 'aiPatcher';
import * as zipManager from 'zipManager';
import { calculateSHA256, getFileExtension } from './utils.js';
import * as scaffoldImporter from './scaffoldImporter.js';
import * as sidebarResizer from './sidebarResizer.js';
import * as aiDebriefingAssistant from 'aiDebriefingAssistant';

export const appState = {
    activeTabId: 'textReportTab',
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentEditingFile: null,
    initialLoadComplete: false,
    editorInstance: null,
    previewEditorInstance: null,
    isLoadingFileContent: false,
    editorActiveAsMainView: false,
    previousActiveTabId: null,
    directoryHandle: null,
    saveState: null,
    currentVersionId: null,
};

export let elements = {};
window.diranalyze = { elements: elements };

// Inside main.js
function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader',
        appContainer: 'appContainer',
        leftSidebar: 'leftSidebar',
        sidebarResizer: 'sidebarResizer',
        mainView: 'mainView',
        rightStatsPanel: 'rightStatsPanel',
        loader: 'loader',
        notification: 'notification',
        errorReport: 'errorReport',
        mainActionDiv: 'mainAction',
        dropZone: 'dropZone',
        folderInput: 'folderInput',
        importAiScaffoldBtn: 'importAiScaffoldBtn',
        copyScaffoldPromptBtn: 'copyScaffoldPromptBtn',
        treeViewControls: 'treeViewControls',
        selectAllBtn: 'selectAllBtn',
        deselectAllBtn: 'deselectAllBtn',
        commitSelectionsBtn: 'commitSelectionsBtn',
        expandAllBtn: 'expandAllBtn',
        collapseAllBtn: 'collapseAllBtn',
        visualOutputContainer: 'visualOutputContainer',
        treeContainer: 'treeContainer',
        generalActions: 'generalActions',
        aiDebriefingAssistantBtn: 'aiDebriefingAssistantBtn',
        downloadProjectBtn: 'downloadProjectBtn',
        clearProjectBtn: 'clearProjectBtn',
        mainViewTabs: 'mainViewTabs',
        tabContentArea: 'tabContentArea',
        textReportTab: 'textReportTab',
        textOutputContainerOuter: 'textOutputContainerOuter',
        textOutputEl: 'textOutput',
        copyReportButton: 'copyReportButton',
        aiPatcherTab: 'aiPatcherTab',
        aiPatchPanel: 'aiPatchPanel',
        copyPatchPromptBtn: 'copyPatchPromptBtn', // Note: This ID is duplicated, one for scaffold, one for patcher. Ensure HTML is unique if they are different buttons.
        aiPatchInput: 'aiPatchInput',
        applyAiPatchBtn: 'applyAiPatchBtn',
        aiPatchOutputLog: 'aiPatchOutputLog',
        versionHistoryTab: 'versionHistoryTab',
        versionHistoryPanel: 'versionHistoryPanel',
        refreshVersionsBtn: 'refreshVersionsBtn',
        versionHistoryList: 'versionHistoryList',
        restoreVersionActions: 'restoreVersionActions',
        restoreSelectedVersionBtn: 'restoreSelectedVersionBtn',
        fileEditor: 'fileEditor',
        editorFileTitle: 'editorFileTitle',
        editorContent: 'editorContent',
        saveFileBtn: 'saveFileBtn',
        closeEditorBtn: 'closeEditorBtn',
        editorInfo: 'editorInfo',
        aiDebriefingAssistantModal: 'aiDebriefingAssistantModal',
        closeAiDebriefingAssistantModalBtn: 'closeAiDebriefingAssistantModalBtn',
        debriefProjectName: 'debriefProjectName',
        debriefScriptCommands: 'debriefScriptCommands',
        debriefMetadataCheckbox: 'debriefMetadataCheckbox',
        metadataCheckboxLabel: 'metadataCheckboxLabel',
        useStandardDebriefProfileBtn: 'useStandardDebriefProfileBtn',
        assembleDebriefPackageBtn: 'assembleDebriefPackageBtn',
        cancelAiDebriefBtn: 'cancelAiDebriefBtn',
        scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn',
        aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn',
        cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        aiPatchDiffModal: 'aiPatchDiffModal',
        closeAiPatchDiffModal: 'closeAiPatchDiffModal',
        diffFilePath: 'diffFilePath',
        diffOutputContainer: 'diffOutputContainer',
        confirmApplyPatchChanges: 'confirmApplyPatchChanges',
        skipPatchChanges: 'skipPatchChanges',
        cancelAllPatchChanges: 'cancelAllPatchChanges',
        filePreview: 'filePreview',
        closePreview: 'closePreview',
        filePreviewTitle: 'filePreviewTitle',
        filePreviewContentWrapper: 'filePreviewContentWrapper',
        filePreviewContent: 'filePreviewContent',
        selectionSummaryDiv: 'selectionSummary',
        globalStatsDiv: 'globalStats',
    };

    console.log("--- Starting populateElements ---");
    let allFound = true;
    for (const key in elementIds) {
        const idToFind = elementIds[key];
        const foundElement = document.getElementById(idToFind);
        window.diranalyze.elements[key] = foundElement;

        if (!foundElement) {
            console.warn(`[populateElements] FAILED to find element. Key: '${key}', Expected ID: '${idToFind}'.`);
            allFound = false;
        } else {
            // console.log(`[populateElements] Successfully found element. Key: '${key}', ID: '${idToFind}'.`);
        }
    }

    window.diranalyze.elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
    if (!window.diranalyze.elements.fileTypeTableBody) {
        console.warn("[populateElements] FAILED to find element: #fileTypeTable tbody (using querySelector).");
        allFound = false;
    } else {
        // console.log("[populateElements] Successfully found element: #fileTypeTable tbody.");
    }

    if (allFound) {
        console.log("--- populateElements completed: All expected base elements found. ---");
    } else {
        console.error("--- populateElements completed: CRITICAL - One or more base UI elements were NOT found. Check HTML IDs and the elementIds map in main.js. ---");
    }
}


export async function fetchAndDisplayVersions() {
    const els = window.diranalyze.elements;
    if (!els.versionHistoryList) {
        console.warn("Version history list element not found. Cannot display versions.");
        return;
    }
    els.versionHistoryList.innerHTML = '<li>Loading versions...</li>';

    try {
        const response = await fetch('/api/versions');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch versions: ${response.status} ${errorText}`);
        }
        const versions = await response.json();

        if (versions.length === 0) {
            els.versionHistoryList.innerHTML = '<li class="empty-notice">No versions found for this project yet.</li>';
            return;
        }

        els.versionHistoryList.innerHTML = '';
        versions.forEach(version => {
            const listItem = document.createElement('li');
            listItem.dataset.versionId = version.version_id;
            
            const parentText = version.parent_version_id ? ` (Parent: ${version.parent_version_id})` : ' (Initial Version)';
            
            let formattedTimestamp = 'Invalid Date';
            try {
                formattedTimestamp = new Date(version.timestamp).toLocaleString();
            } catch(e) { console.error("Error parsing version timestamp:", version.timestamp, e); }

            listItem.innerHTML = `
                <span class="version-id">Version ID: ${version.version_id}</span>${parentText}<br>
                <span class="version-desc">${version.description || 'No description'}</span>
                <span class="version-time">Timestamp: ${formattedTimestamp}</span>
            `;
            els.versionHistoryList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error fetching or displaying versions:", error);
        if (els.versionHistoryList) {
             els.versionHistoryList.innerHTML = `<li class="empty-notice" style="color: var(--error-color);">Error loading versions: ${error.message}</li>`;
        }
        notificationSystem.showNotification("Could not load version history.", { duration: 3000 });
    }
}


function setupEventListeners() {
    const els = window.diranalyze.elements;

    els.dropZone?.addEventListener('dragover', (e) => e.preventDefault());
    els.dropZone?.addEventListener('drop', handleFileDrop);
    els.folderInput?.addEventListener('change', handleFolderSelect);
    els.commitSelectionsBtn?.addEventListener('click', commitSelections);
    els.downloadProjectBtn?.addEventListener('click', zipManager.downloadProjectAsZip);
    els.clearProjectBtn?.addEventListener('click', clearProjectData);

    els.selectAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.setAllSelections(true);
    });
    els.deselectAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.setAllSelections(false);
    });
    els.expandAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.toggleAllFolders(false);
    });
    els.collapseAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.toggleAllFolders(true);
    });

    els.copyReportButton?.addEventListener('click', () => {
        if (els.textOutputEl && els.textOutputEl.textContent && appState.activeTabId === 'textReportTab') {
            navigator.clipboard.writeText(els.textOutputEl.textContent)
                .then(() => notificationSystem.showNotification("Report copied to clipboard!", { duration: 2000 }))
                .catch(err => {
                    console.error("Failed to copy report:", err);
                    notificationSystem.showNotification("Failed to copy report. See console.", { duration: 3000 });
                });
        } else {
            notificationSystem.showNotification("No report content to copy or not on report tab.", { duration: 3000 });
        }
    });

    els.closePreview?.addEventListener('click', () => {
        if (els.filePreview) els.filePreview.style.display = 'none';
    });
    
    const cancelAiDebriefBtn = document.getElementById('cancelAiDebriefBtn');
    if (cancelAiDebriefBtn && els.closeAiDebriefingAssistantModalBtn) {
        cancelAiDebriefBtn.addEventListener('click', () => {
            els.closeAiDebriefingAssistantModalBtn.click();
        });
    }

    if (els.refreshVersionsBtn) {
        els.refreshVersionsBtn.addEventListener('click', fetchAndDisplayVersions);
    }
}

async function handleFileDrop(event) {
    event.preventDefault(); if (appState.processingInProgress) return;
    const items = event.dataTransfer.items;
    if (items && items.length > 0 && items[0].getAsFileSystemHandle) {
        const handle = await items[0].getAsFileSystemHandle();
        if (handle.kind === 'directory') { await verifyAndProcessDirectory(handle); }
        else { errorHandler.showError({ name: "InvalidTargetError", message: "Please drop a folder." }); }
    }
}

async function handleFolderSelect() {
    if (appState.processingInProgress) return;
    try { const handle = await window.showDirectoryPicker(); await verifyAndProcessDirectory(handle); }
    catch (err) { if (err.name !== 'AbortError') { errorHandler.showError({ name: err.name, message: `Could not select folder: ${err.message}`}); } console.log("Folder selection aborted or failed:", err); }
}

async function createInitialSnapshot(directoryData, allFilesList) {
    const els = window.diranalyze.elements;
    if (!directoryData || !allFilesList) { console.error("Snapshot requires valid dir data and file list."); return; }
    if (els.loader) { els.loader.textContent = `Creating Version 0 for '${directoryData.name}'...`; els.loader.classList.add('visible'); }
    try {
        const filesToProcess = allFilesList.filter(f => f.entryHandle);
        const filePromises = filesToProcess.map(async (fileInfo) => {
            try {
                const file = await fileInfo.entryHandle.getFile();
                const buffer = await file.arrayBuffer();
                const hash = await calculateSHA256(buffer);
                return { path: fileInfo.path, hash: hash, size: fileInfo.size, };
            } catch (error) {
                console.error("Error processing file for initial snapshot:", fileInfo.path, error);
                return null;
            }
        });
        const scannedFiles = (await Promise.all(filePromises)).filter(f => f !== null);
        const snapshotPayload = { project_root_name: directoryData.name, files: scannedFiles, };
        const response = await fetch('/api/snapshot/initial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshotPayload), });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend snapshot creation failed: ${response.status}. ${errorText}`);
        }
        const result = await response.json();
        appState.currentVersionId = result.version_id;
        notificationSystem.showNotification(`Project snapshot created! Version ID: ${result.version_id}`, { duration: 4000 });
        console.log("Initial snapshot success:", result);
    } catch (error) {
        errorHandler.showError({ name: "SnapshotError", message: `Failed to create initial project snapshot: ${error.message}`, stack: error.stack });
        notificationSystem.showNotification("Failed to create initial snapshot. Check console.", { duration: 3000 });
    }
}

async function verifyAndProcessDirectory(passedDirectoryHandle) {
    const els = window.diranalyze.elements;
    if (!passedDirectoryHandle) { errorHandler.showError({ name: "InternalError", message: "No dir handle."}); return; }
    try {
        if (await passedDirectoryHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
            if (await passedDirectoryHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                if (await passedDirectoryHandle.queryPermission({ mode: 'read' }) !== 'granted') {
                    if (await passedDirectoryHandle.requestPermission({ mode: 'read' }) !== 'granted') {
                        throw new Error("Read permission denied for the folder.");
                    }
                }
                notificationSystem.showNotification("Write permission denied. Proceeding in read-only mode.", { duration: 3000 });
            }
        }
    }
    catch (err) { errorHandler.showError({ name: "PermissionError", message: `Permissions error: ${err.message}`}); return; }
    
    resetUIForProcessing(`Processing '${passedDirectoryHandle.name}'...`);
    appState.directoryHandle = passedDirectoryHandle;
    try {
        appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(appState.directoryHandle, appState.directoryHandle.name, 0);
        appState.committedScanData = appState.fullScanData; appState.selectionCommitted = true;
        if (els.treeContainer) els.treeContainer.innerHTML = '';
        treeView.renderTree(appState.fullScanData.directoryData, els.treeContainer);
        uiManager.refreshAllUI();
        enableUIControls();
        if (appState.fullScanData) {
            await createInitialSnapshot(appState.fullScanData.directoryData, appState.fullScanData.allFilesList);
            if (appState.activeTabId === 'versionHistoryTab') { fetchAndDisplayVersions(); }
        }
    } catch (err) {
        showFailedUI("Directory processing failed.");
        errorHandler.showError(err);
        appState.directoryHandle = null;
    }
    finally {
        appState.processingInProgress = false;
        if(els.loader) els.loader.classList.remove('visible');
    }
}

export function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    const els = window.diranalyze.elements;
    console.trace("resetUIForProcessing called.");
    appState.processingInProgress = true;
    if (els.loader) { els.loader.textContent = loaderMsg; els.loader.classList.add('visible'); }
    fileEditor.closeEditor();
    appState.fullScanData = null; appState.committedScanData = null; appState.selectionCommitted = false;
    appState.directoryHandle = null; appState.currentVersionId = null;
    fileEditor.clearEditedFilesCache();
    if (els.treeContainer) els.treeContainer.innerHTML = '<div class="empty-notice">DROP FOLDER OR IMPORT SCAFFOLD</div>';
    disableUIControls();
    uiManager.activateTab('textReportTab');
    if (els.versionHistoryList) els.versionHistoryList.innerHTML = '<li class="empty-notice">Load a project to see version history.</li>';
}

export function enableUIControls() {
    const els = window.diranalyze.elements;
    const hasData = !!appState.fullScanData;
    if (els.commitSelectionsBtn) els.commitSelectionsBtn.disabled = !hasData;
    if (els.downloadProjectBtn) els.downloadProjectBtn.disabled = !hasData;
    if (els.clearProjectBtn) els.clearProjectBtn.disabled = !hasData;
    if (els.aiDebriefingAssistantBtn) els.aiDebriefingAssistantBtn.disabled = !hasData;
    if (els.selectAllBtn) els.selectAllBtn.disabled = !hasData;
    if (els.deselectAllBtn) els.deselectAllBtn.disabled = !hasData;
    if (els.expandAllBtn) els.expandAllBtn.disabled = !hasData;
    if (els.collapseAllBtn) els.collapseAllBtn.disabled = !hasData;
    if (els.copyReportButton) els.copyReportButton.disabled = !(hasData && appState.activeTabId === 'textReportTab');
    if (els.copyPatchPromptBtn) els.copyPatchPromptBtn.disabled = !hasData;
    if (els.refreshVersionsBtn) els.refreshVersionsBtn.disabled = !hasData;
}

function disableUIControls() {
    const els = window.diranalyze.elements;
    if (els.commitSelectionsBtn) els.commitSelectionsBtn.disabled = true;
    if (els.downloadProjectBtn) els.downloadProjectBtn.disabled = true;
    if (els.clearProjectBtn) els.clearProjectBtn.disabled = true;
    if (els.aiDebriefingAssistantBtn) els.aiDebriefingAssistantBtn.disabled = true;
    if (els.selectAllBtn) els.selectAllBtn.disabled = true;
    if (els.deselectAllBtn) els.deselectAllBtn.disabled = true;
    if (els.expandAllBtn) els.expandAllBtn.disabled = true;
    if (els.collapseAllBtn) els.collapseAllBtn.disabled = true;
    if (els.copyReportButton) els.copyReportButton.disabled = true;
    if (els.copyPatchPromptBtn) els.copyPatchPromptBtn.disabled = true;
    if (els.refreshVersionsBtn) els.refreshVersionsBtn.disabled = true;
}

export function showFailedUI(message = "OPERATION FAILED") {
    const els = window.diranalyze.elements;
    if (els.textOutputEl) els.textOutputEl.textContent = message;
    uiManager.activateTab('textReportTab');
    if(els.loader) els.loader.classList.remove('visible');
    appState.processingInProgress = false;
    enableUIControls();
    if (els.importAiScaffoldBtn) els.importAiScaffoldBtn.disabled = false;
    if (els.folderInput) els.folderInput.disabled = false;
}

function commitSelections() {
    const els = window.diranalyze.elements;
    if (!appState.fullScanData || !els.treeContainer) return;
    const selectedPaths = new Set();
    els.treeContainer.querySelectorAll('li[data-selected="true"]').forEach(li => { if (li.dataset.path) selectedPaths.add(li.dataset.path); });
    if (selectedPaths.size === 0 && appState.fullScanData.allFilesList.length > 0) {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, new Set());
        notificationSystem.showNotification("Committed an empty selection.", { duration: 2000 });
    }  else if (selectedPaths.size === 0 && appState.fullScanData.allFilesList.length === 0) {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, new Set());
        notificationSystem.showNotification("No items to commit in the current project.", { duration: 2000 });
    }
    else {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, selectedPaths);
        notificationSystem.showNotification("Selections committed.", { duration: 1500 });
    }
    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
}

function clearProjectData() {
    const els = window.diranalyze.elements;
    resetUIForProcessing("DROP FOLDER OR IMPORT SCAFFOLD");
    if(els.loader) els.loader.classList.remove('visible');
    enableUIControls();
    if (els.importAiScaffoldBtn) els.importAiScaffoldBtn.disabled = false;
    if (els.folderInput) els.folderInput.disabled = false;
    if (els.copyScaffoldPromptBtn) els.copyScaffoldPromptBtn.disabled = false;
}

function initApp() {
    populateElements();
    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers(window.diranalyze.elements);
    fileEditor.initFileEditor();
    initAiPatcher(appState, window.diranalyze.elements);
    scaffoldImporter.initScaffoldImporter(window.diranalyze.elements);
    aiDebriefingAssistant.initAiDebriefingAssistant(appState, window.diranalyze.elements);
    uiManager.initTabs(appState, window.diranalyze.elements);
    sidebarResizer.initResizer(window.diranalyze.elements.leftSidebar, window.diranalyze.elements.sidebarResizer, window.diranalyze.elements.mainView);
    setupEventListeners();

    if (window.diranalyze.elements.pageLoader) {
        window.diranalyze.elements.pageLoader.classList.add('hidden');
    }
    document.body.classList.add('loaded');
    appState.initialLoadComplete = true;
    console.log("DirAnalyse Matrix Initialized.");
    disableUIControls();
    if (window.diranalyze.elements.importAiScaffoldBtn) window.diranalyze.elements.importAiScaffoldBtn.disabled = false;
    if (window.diranalyze.elements.folderInput) window.diranalyze.elements.folderInput.disabled = false;
    if (window.diranalyze.elements.copyScaffoldPromptBtn) window.diranalyze.elements.copyScaffoldPromptBtn.disabled = false;
    if (window.diranalyze.elements.versionHistoryList) {
        window.diranalyze.elements.versionHistoryList.innerHTML = '<li class="empty-notice">Load a project to see version history.</li>';
    }
}

document.addEventListener('DOMContentLoaded', initApp);
// --- ENDFILE: diranalyze/js/main.js --- //