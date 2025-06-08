import * as fileSystem from './fileSystem.js';
import * as uiManager from './uiManager.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import { initAiPatcher } from 'aiPatcher'; // Use named import
import * as zipManager from 'zipManager';
import * as utils from 'utils';
import * as scaffoldImporter from 'scaffoldImporter';
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
    directoryHandle: null, // Will be null for scaffolded projects until saved
    saveState: null,
};

export let elements = {}; // populated by populateElements

function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader', dropZone: 'dropZone', folderInput: 'folderInput',
        treeContainer: 'treeContainer', globalStatsDiv: 'globalStats', selectionSummaryDiv: 'selectionSummary',
        appContainer: 'appContainer', leftSidebar: 'leftSidebar', sidebarResizer: 'sidebarResizer',
        mainView: 'mainView', mainViewTabs: 'mainViewTabs', tabContentArea: 'tabContentArea',
        rightStatsPanel: 'rightStatsPanel', treeViewControls: 'treeViewControls', generalActions: 'generalActions',
        loader: 'loader', textOutputEl: 'textOutput', copyReportButton: 'copyReportButton',
        selectAllBtn: 'selectAllBtn', deselectAllBtn: 'deselectAllBtn', commitSelectionsBtn: 'commitSelectionsBtn',
        expandAllBtn: 'expandAllBtn', collapseAllBtn: 'collapseAllBtn',
        downloadProjectBtn: 'downloadProjectBtn', clearProjectBtn: 'clearProjectBtn',
        restoreStateBtn: 'restoreStateBtn', saveStateStatus: 'saveStateStatus',
        filePreview: 'filePreview', filePreviewTitle: 'filePreviewTitle',
        filePreviewContentWrapper: 'filePreviewContentWrapper', filePreviewContent: 'filePreviewContent',
        closePreview: 'closePreview', textOutputContainerOuter: 'textOutputContainerOuter',
        visualOutputContainer: 'visualOutputContainer', notification: 'notification', errorReport: 'errorReport',
        fileEditor: 'fileEditor', editorFileTitle: 'editorFileTitle', editorContent: 'editorContent',
        closeEditorBtn: 'closeEditorBtn', aiPatchPanel: 'aiPatchPanel', aiPatchInput: 'aiPatchInput',
        applyAiPatchBtn: 'applyAiPatchBtn', aiPatchOutputLog: 'aiPatchOutputLog',
        aiPatchDiffModal: 'aiPatchDiffModal', diffFilePath: 'diffFilePath', diffOutputContainer: 'diffOutputContainer',
        closeAiPatchDiffModal: 'closeAiPatchDiffModal', confirmApplyPatchChanges: 'confirmApplyPatchChanges',
        skipPatchChanges: 'skipPatchChanges', cancelAllPatchChanges: 'cancelAllPatchChanges',
        mainActionDiv: 'mainAction', importAiScaffoldBtn: 'importAiScaffoldBtn',
        copyScaffoldPromptBtn: 'copyScaffoldPromptBtn', scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn', aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn', cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        textReportTab: 'textReportTab', aiPatcherTab: 'aiPatcherTab',
        aiDebriefingAssistantBtn: 'aiDebriefingAssistantBtn', aiDebriefingAssistantModal: 'aiDebriefingAssistantModal',
        closeAiDebriefingAssistantModalBtn: 'closeAiDebriefingAssistantModalBtn',
        debriefMetadataCheckbox: 'debriefMetadataCheckbox', assembleDebriefPackageBtn: 'assembleDebriefPackageBtn',
        useStandardDebriefProfileBtn: 'useStandardDebriefProfileBtn',
    };
    for (const key in elementIds) elements[key] = document.getElementById(elementIds[key]);
    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
}

function setupEventListeners() {
    elements.dropZone?.addEventListener('dragover', (e) => e.preventDefault());
    elements.dropZone?.addEventListener('drop', handleFileDrop);
    elements.folderInput?.addEventListener('change', handleFolderSelect);
    elements.commitSelectionsBtn?.addEventListener('click', commitSelections);
    elements.downloadProjectBtn?.addEventListener('click', zipManager.downloadProjectAsZip);
    elements.clearProjectBtn?.addEventListener('click', clearProjectData);
    // More listeners can be added here...
}

async function handleFileDrop(event) {
    event.preventDefault();
    if (appState.processingInProgress) return;
    const items = event.dataTransfer.items;
    if (items && items.length > 0 && items[0].getAsFileSystemHandle) {
        const handle = await items[0].getAsFileSystemHandle();
        if (handle.kind === 'directory') {
            appState.directoryHandle = handle; // Store for real projects
            await verifyAndProcessDirectory(handle);
        } else {
            errorHandler.showError({ name: "InvalidTargetError", message: "Please drop a folder." });
        }
    }
}

async function handleFolderSelect() {
    if (appState.processingInProgress) return;
    try {
        const handle = await window.showDirectoryPicker();
        appState.directoryHandle = handle; // Store for real projects
        await verifyAndProcessDirectory(handle);
    } catch (err) {
        // User likely cancelled
    }
}

async function verifyAndProcessDirectory(directoryHandle) {
    if (await directoryHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        if (await directoryHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
            errorHandler.showError({ name: "PermissionError", message: "Write permission denied." });
            return;
        }
    }
    resetUIForProcessing(`Processing '${directoryHandle.name}'...`);
    try {
        appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(directoryHandle, directoryHandle.name, 0);
        appState.committedScanData = appState.fullScanData; // Commit all initially
        appState.selectionCommitted = true;
        treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        uiManager.refreshAllUI();
        enableUIControls();
    } catch (err) {
        showFailedUI("Directory processing failed.");
    } finally {
        appState.processingInProgress = false;
        if(elements.loader) elements.loader.classList.remove('visible');
    }
}

export function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    appState.processingInProgress = true;
    if (elements.loader) {
        elements.loader.textContent = loaderMsg;
        elements.loader.classList.add('visible');
    }
    fileEditor.closeEditor();
    appState.fullScanData = null;
    appState.committedScanData = null;
    appState.selectionCommitted = false;
    appState.directoryHandle = null; // Clear handle for scaffolded projects mainly
    fileEditor.clearEditedFilesCache();
    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP FOLDER OR IMPORT SCAFFOLD</div>';
    disableUIControls();
    uiManager.activateTab('textReportTab'); // Default to text report
}

export function enableUIControls() {
    const hasData = !!appState.fullScanData;
    elements.commitSelectionsBtn.disabled = !hasData;
    elements.downloadProjectBtn.disabled = !hasData;
    elements.clearProjectBtn.disabled = !hasData;
    elements.aiDebriefingAssistantBtn.disabled = !hasData;
    // Other buttons like selectAll, expandAll also depend on hasData implicitly through treeView
}

function disableUIControls() {
    elements.commitSelectionsBtn.disabled = true;
    elements.downloadProjectBtn.disabled = true;
    elements.clearProjectBtn.disabled = true;
    elements.aiDebriefingAssistantBtn.disabled = true;
}

export function showFailedUI(message = "OPERATION FAILED") {
    if (elements.textOutputEl) elements.textOutputEl.textContent = message;
    uiManager.activateTab('textReportTab');
    if(elements.loader) elements.loader.classList.remove('visible');
    appState.processingInProgress = false;
}

function commitSelections() {
    if (!appState.fullScanData) return;
    const selectedPaths = new Set();
    elements.treeContainer.querySelectorAll('li[data-selected="true"]').forEach(li => selectedPaths.add(li.dataset.path));
    appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, selectedPaths);
    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
}

function clearProjectData() {
    resetUIForProcessing("DROP FOLDER OR IMPORT SCAFFOLD");
    if(elements.loader) elements.loader.classList.remove('visible');
}

function initApp() {
    populateElements();
    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers();
    fileEditor.initFileEditor();
    initAiPatcher(appState, elements); // Pass dependencies
    scaffoldImporter.initScaffoldImporter(appState, elements, resetUIForProcessing, verifyAndProcessDirectory, enableUIControls, showFailedUI);
    aiDebriefingAssistant.initAiDebriefingAssistant(appState, elements); // Pass dependencies
    uiManager.initTabs(appState, elements); // Pass dependencies
    sidebarResizer.initResizer(elements.leftSidebar, elements.sidebarResizer, elements.mainView);
    setupEventListeners();

    elements.pageLoader.classList.add('hidden');
    document.body.classList.add('loaded');
    appState.initialLoadComplete = true;
    console.log("DirAnalyse Matrix Initialized (v. Full Replacement).");
    disableUIControls(); // Start with most controls disabled
    elements.importAiScaffoldBtn.disabled = false; // Ensure scaffold import is enabled
    elements.folderInput.disabled = false; // Ensure folder select is enabled
}

document.addEventListener('DOMContentLoaded', initApp);