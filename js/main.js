// --- FILE: loomdir/js/main.js --- //
import * as fileSystem from './fileSystem.js';
import * as uiManager from './uiManager.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as combineMode from './combineMode.js';
import * as notificationSystem from './notificationSystem.js';
import * as errorHandler from './errorHandler.js';
import * as fileEditor from './fileEditor.js';
import * as aiPatcher from './aiPatcher.js';
import * as zipManager from './zipManager.js';
import * as utils from './utils.js';
import * as aiBriefingStudio from './aiBriefingStudio.js';
import * as scaffoldImporter from './scaffoldImporter.js';

export const appState = {
    // isCombineMode: false, // Replaced by activeTab logic
    activeTabId: 'textReportTab', // Default active tab
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentEditingFile: null,
    initialLoadComplete: false,
    editorInstance: null,
    previewEditorInstance: null,
    isLoadingFileContent: false,
};

export let elements = {}; // Will be populated by populateElements

function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader',
        dropZone: 'dropZone',
        folderInput: 'folderInput',
        treeContainer: 'treeContainer',
        globalStatsDiv: 'globalStats',
        selectionSummaryDiv: 'selectionSummary',
        appContainer: 'appContainer',
        // sidebar: 'sidebar', // Renamed
        leftSidebar: 'leftSidebar',
        mainView: 'mainView',
        mainViewTabs: 'mainViewTabs',
        tabContentArea: 'tabContentArea',
        rightStatsPanel: 'rightStatsPanel',
        // globalStatsPanel: 'globalStatsPanel', // Renamed/Replaced
        // sidebarToolsContainer: 'sidebarToolsContainer', // Restructured
        treeViewControls: 'treeViewControls',
        generalActions: 'generalActions',
        loader: 'loader',
        textOutputEl: 'textOutput',
        copyReportButton: 'copyReportButton',
        combineModePanel: 'combineModePanel', // Now inside a tab
        selectedFilesContainer: 'selectedFilesContainer',
        copySelectedBtn: 'copySelectedBtn',
        selectAllBtn: 'selectAllBtn',
        deselectAllBtn: 'deselectAllBtn',
        commitSelectionsBtn: 'commitSelectionsBtn',
        // viewModeToggleBtn: 'viewModeToggleBtn', // Removed
        expandAllBtn: 'expandAllBtn',
        collapseAllBtn: 'collapseAllBtn',
        downloadProjectBtn: 'downloadProjectBtn',
        clearProjectBtn: 'clearProjectBtn',
        filePreview: 'filePreview',
        filePreviewTitle: 'filePreviewTitle',
        filePreviewContentWrapper: 'filePreviewContentWrapper',
        filePreviewContent: 'filePreviewContent',
        closePreview: 'closePreview',
        textOutputContainerOuter: 'textOutputContainerOuter', // Inside a tab
        visualOutputContainer: 'visualOutputContainer', // Moved to left sidebar
        notification: 'notification',
        errorReport: 'errorReport',
        fileEditor: 'fileEditor',
        editorFileTitle: 'editorFileTitle',
        editorContent: 'editorContent',
        saveEditorBtn: 'saveEditorBtn',
        closeEditorBtn: 'closeEditorBtn',
        editorStatus: 'editorStatus',
        editorInfo: 'editorInfo',
        aiPatchPanel: 'aiPatchPanel', // Inside a tab
        aiPatchInput: 'aiPatchInput',
        applyAiPatchBtn: 'applyAiPatchBtn',
        aiPatchOutputLog: 'aiPatchOutputLog',
        aiPatchDiffModal: 'aiPatchDiffModal',
        diffFilePath: 'diffFilePath',
        diffOutputContainer: 'diffOutputContainer',
        closeAiPatchDiffModal: 'closeAiPatchDiffModal',
        confirmApplyPatchChanges: 'confirmApplyPatchChanges',
        skipPatchChanges: 'skipPatchChanges',
        cancelAllPatchChanges: 'cancelAllPatchChanges',
        mainActionDiv: 'mainAction',
        createAiBriefBtn: 'createAiBriefBtn',
        aiBriefingStudioModal: 'aiBriefingStudioModal',
        closeAiBriefingStudioModal: 'closeAiBriefingStudioModal',
        aiBriefTaskInput: 'aiBriefTaskInput',
        aiBriefGoalSelect: 'aiBriefGoalSelect',
        aiBriefFileSelectionContainer: 'aiBriefFileSelectionContainer',
        aiBriefHtmlIdsContainerWrapper: 'aiBriefHtmlIdsContainerWrapper',
        aiBriefHtmlIdsContainer: 'aiBriefHtmlIdsContainer',
        aiBriefSpecificInstructionsInput: 'aiBriefSpecificInstructionsInput',
        aiBriefTokenCountDisplay: 'aiBriefTokenCountDisplay',
        generateAiBriefPackageBtn: 'generateAiBriefPackageBtn',
        cancelAiBriefBtn: 'cancelAiBriefBtn',
        importAiScaffoldBtn: 'importAiScaffoldBtn',
        scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn',
        aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn',
        cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        // Tab content IDs
        textReportTab: 'textReportTab',
        combineModeTab: 'combineModeTab',
        aiPatcherTab: 'aiPatcherTab',
    };

    for (const key in elementIds) {
        elements[key] = document.getElementById(elementIds[key]);
        if (!elements[key] && !['cancelScaffoldImportBtn', 'cancelAiBriefBtn', 'closeAiBriefingStudioModal', 'generateAiBriefPackageBtn', 'createProjectFromScaffoldBtn', 'closeScaffoldModalBtn', 'sidebarToolsContainer', 'viewModeToggleBtn', 'globalStatsPanel'].includes(key) ) {
             // console.warn(`[populateElements] Element with ID '${elementIds[key]}' not found for key '${key}'.`);
        }
    }

    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
    if (!elements.fileTypeTableBody) {
        console.warn("[populateElements] Element '#fileTypeTable tbody' not found.");
    }
}


function setupEventListeners() {
    const safeAddEventListener = (element, event, handler, elementName) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            // console.warn(`[setupEventListeners] Element '${elementName}' not found for '${event}'. Listener not attached.`);
        }
    };

    safeAddEventListener(elements.dropZone, 'dragover', handleDragOver, 'dropZone');
    safeAddEventListener(elements.dropZone, 'dragleave', handleDragLeave, 'dropZone');
    safeAddEventListener(elements.dropZone, 'drop', handleFileDrop, 'dropZone');
    safeAddEventListener(elements.dropZone, 'click', () => { if (elements.folderInput) elements.folderInput.click(); }, 'dropZone (for folderInput click)');
    safeAddEventListener(elements.folderInput, 'change', handleFolderSelect, 'folderInput');

    safeAddEventListener(elements.selectAllBtn, 'click', () => treeView.setAllSelections(true), 'selectAllBtn');
    safeAddEventListener(elements.deselectAllBtn, 'click', () => treeView.setAllSelections(false), 'deselectAllBtn');
    safeAddEventListener(elements.commitSelectionsBtn, 'click', commitSelections, 'commitSelectionsBtn');
    // safeAddEventListener(elements.viewModeToggleBtn, 'click', () => uiManager.setViewModeUI(!appState.isCombineMode), 'viewModeToggleBtn'); // REMOVED
    safeAddEventListener(elements.downloadProjectBtn, 'click', zipManager.downloadProjectAsZip, 'downloadProjectBtn');
    safeAddEventListener(elements.clearProjectBtn, 'click', clearProjectData, 'clearProjectBtn');

    safeAddEventListener(elements.expandAllBtn, 'click', () => treeView.toggleAllFolders(false), 'expandAllBtn');
    safeAddEventListener(elements.collapseAllBtn, 'click', () => treeView.toggleAllFolders(true), 'collapseAllBtn');

    safeAddEventListener(elements.closePreview, 'click', () => {
        if (elements.filePreview) elements.filePreview.style.display = 'none';
        if (appState.previewEditorInstance) {
            appState.previewEditorInstance.setValue('');
        }
    }, 'closePreview');

    safeAddEventListener(elements.copyReportButton, 'click', copyReport, 'copyReportButton');
    safeAddEventListener(elements.copySelectedBtn, 'click', combineMode.copySelectedFiles, 'copySelectedBtn');
}

function handleDragOver(e) { e.preventDefault(); if (elements.dropZone) elements.dropZone.classList.add('dragover'); }
function handleDragLeave() { if (elements.dropZone) elements.dropZone.classList.remove('dragover'); }

async function handleFolderSelect(event) {
    if (appState.processingInProgress) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const firstFileRelativePath = files[0].webkitRelativePath;
    const rootDirName = firstFileRelativePath.split('/')[0] || 'selected_folder';
    await processSelectedFolderViaInput(files, rootDirName);
    if (elements.folderInput) elements.folderInput.value = '';
}

async function processSelectedFolderViaInput(files, rootDirName) {
    resetUIForProcessing(`Processing '${rootDirName}'...`);
    appState.processingInProgress = true;
    try {
        const virtualDirData = createVirtualDirectoryFromFiles(files, rootDirName);
        appState.fullScanData = virtualDirData;
        if (appState.fullScanData.directoryData && elements.treeContainer) {
             treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        } else {
            throw new Error("Failed to construct directory data from selected files or treeContainer is missing.");
        }

        const allInitiallySelectedPaths = new Set();
        if (appState.fullScanData.allFilesList) {
            appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
        }
        if (appState.fullScanData.allFoldersList) {
            appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));
        }
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
        appState.selectionCommitted = true;

        // Show relevant UI sections for the new layout
        if (elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'flex';
        if (elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) {
            elements.visualOutputContainer.style.display = 'flex';
        }
        if (elements.mainView) elements.mainView.style.display = 'flex';
        if (elements.treeViewControls) elements.treeViewControls.style.display = 'flex';
        if (elements.generalActions) elements.generalActions.style.display = 'flex';


        uiManager.activateTab(appState.activeTabId || 'textReportTab'); // Activate default or last active tab
        uiManager.refreshAllUI();
        enableUIControls();

    } catch (err) {
        console.error("ERROR PROCESSING FOLDER INPUT:", err);
        errorHandler.showError(err);
        showFailedUI("Folder processing failed.");
    } finally {
        if(elements.loader) elements.loader.classList.remove('visible');
        appState.processingInProgress = false;
    }
}

function createVirtualDirectoryFromFiles(fileList, rootName) {
    const root = {
        name: rootName, path: rootName, type: 'folder', depth: 0, children: [],
        fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: null
    };
    const allFilesList = [];
    const allFoldersList = [{ name: root.name, path: root.path, depth: 0, entryHandle: null }];
    const folderMap = new Map([[rootName, root]]);

    for (const file of fileList) {
        const pathParts = file.webkitRelativePath.split('/');
        const fileName = pathParts.pop();
        let currentParent = root;
        let currentPathForFolderConstruction = rootName;

        for (let i = 0; i < pathParts.length; i++) {
            const folderNamePart = pathParts[i];
            if (i === 0 && folderNamePart === rootName && pathParts.length > 1) continue;
            if(pathParts.length === 1 && folderNamePart === rootName) { /* file directly in root dir */ }
            else {currentPathForFolderConstruction += '/' + folderNamePart;}

            if (!folderMap.has(currentPathForFolderConstruction)) {
                const newFolder = {
                    name: folderNamePart, path: currentPathForFolderConstruction, type: 'folder',
                    depth: i + 1, children: [], fileCount: 0, dirCount: 0, totalSize: 0,
                    fileTypes: {}, entryHandle: null
                };
                folderMap.set(currentPathForFolderConstruction, newFolder);
                if (currentParent.path !== newFolder.path) {
                   currentParent.children.push(newFolder);
                }
                allFoldersList.push({ name: newFolder.name, path: newFolder.path, depth: newFolder.depth, entryHandle: null });
                currentParent = newFolder;
            } else {
                currentParent = folderMap.get(currentPathForFolderConstruction);
            }
        }

        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '(no ext)';
        const filePath = file.webkitRelativePath;
        const fileInfo = {
            name: fileName, type: 'file', size: file.size, path: filePath,
            extension: ext, depth: pathParts.length + 1,
            entryHandle: file
        };
        currentParent.children.push(fileInfo);
        allFilesList.push({ ...fileInfo });
    }

    function calculateFolderStats(folder) {
        folder.fileCount = 0; folder.dirCount = 0; folder.totalSize = 0; folder.fileTypes = {};
        for (const child of folder.children) {
            if (child.type === 'folder') {
                calculateFolderStats(child);
                folder.dirCount++; folder.dirCount += child.dirCount;
                folder.fileCount += child.fileCount; folder.totalSize += child.totalSize;
                Object.entries(child.fileTypes).forEach(([ext, data]) => {
                    if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
                    folder.fileTypes[ext].count += data.count;
                    folder.fileTypes[ext].size += data.size;
                });
            } else {
                folder.fileCount++; folder.totalSize += child.size;
                if (!folder.fileTypes[child.extension]) folder.fileTypes[child.extension] = { count: 0, size: 0 };
                folder.fileTypes[child.extension].count++;
                folder.fileTypes[child.extension].size += child.size;
            }
        }
    }
    calculateFolderStats(root);

    let maxDepthVal = 0;
    allFilesList.forEach(f => { if(f.depth > maxDepthVal) maxDepthVal = f.depth; });
    allFoldersList.forEach(f => { if(f.depth > maxDepthVal) maxDepthVal = f.depth; });

    return {
        directoryData: root, allFilesList, allFoldersList,
        maxDepth: maxDepthVal,
        deepestPathExample: root.path,
        emptyDirCount: countEmptyDirs(root, root.name)
    };
}

function countEmptyDirs(node, rootName) {
    let count = 0;
    if (node.type === 'folder') {
        if (node.children.length === 0 && node.name !== rootName) {
            count = 1;
        }
        else { for (const child of node.children) { count += countEmptyDirs(child, rootName); } }
    } return count;
}

async function handleFileDrop(event) {
    event.preventDefault();
    if (appState.processingInProgress) return;
    if (elements.dropZone) elements.dropZone.classList.remove('dragover');
    resetUIForProcessing("Processing dropped folder...");
    appState.processingInProgress = true;
    const items = event.dataTransfer.items;
    if (items && items.length) {
        const entry = items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
            try {
                appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(entry, entry.name, 0);
                if (appState.fullScanData.directoryData && elements.treeContainer) {
                     treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
                } else {
                     throw new Error("processDirectoryEntryRecursive failed to return directoryData or treeContainer missing.");
                }
                const allInitiallySelectedPaths = new Set();
                if(appState.fullScanData.allFilesList) appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
                if(appState.fullScanData.allFoldersList) appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));

                appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
                appState.selectionCommitted = true;

                if (elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'flex';
                if (elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) {
                    elements.visualOutputContainer.style.display = 'flex';
                }
                if (elements.mainView) elements.mainView.style.display = 'flex';
                if (elements.treeViewControls) elements.treeViewControls.style.display = 'flex';
                if (elements.generalActions) elements.generalActions.style.display = 'flex';


                uiManager.activateTab(appState.activeTabId || 'textReportTab');
                uiManager.refreshAllUI();
                enableUIControls();

            } catch (err) {
                console.error("ERROR PROCESSING DIRECTORY (DROP):", err);
                errorHandler.showError(err);
                showFailedUI("Directory processing failed. Check console and error report.");
            } finally {
                if(elements.loader) elements.loader.classList.remove('visible');
                appState.processingInProgress = false;
            }
        } else {
            errorHandler.showError({ name: "InvalidTargetError", message: "Please drop a folder, not an individual file(s)." });
            if(elements.loader) elements.loader.classList.remove('visible');
            appState.processingInProgress = false;
        }
    } else {
        if(elements.loader) elements.loader.classList.remove('visible');
        appState.processingInProgress = false;
    }
}

export function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    if (elements.loader) {
        elements.loader.textContent = loaderMsg;
        elements.loader.classList.add('visible');
    }

    // Hide main layout sections or their content
    if (elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'none';
    if (elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) {
        elements.visualOutputContainer.style.display = 'none';
    }
    if (elements.treeViewControls) elements.treeViewControls.style.display = 'none';
    if (elements.generalActions) elements.generalActions.style.display = 'none';


    // Hide all tab contents and deactivate tabs
    if (elements.tabContentArea) {
        elements.tabContentArea.querySelectorAll('.tab-content-item').forEach(tc => {
            tc.classList.remove('active');
            tc.style.display = 'none';
        });
    }
    if (elements.mainViewTabs) {
      elements.mainViewTabs.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    }
    // Keep mainView and mainViewTabs visible, but content within is cleared/hidden
    if (elements.mainView) elements.mainView.style.display = 'flex';


    const modalsToHide = [
        elements.fileEditor, elements.aiBriefingStudioModal, elements.scaffoldImportModal, elements.aiPatchDiffModal, elements.filePreview, elements.errorReport
    ];
    modalsToHide.forEach(panel => { if (panel && panel.style) panel.style.display = 'none'; });


    if(elements.aiPatchInput) elements.aiPatchInput.value = '';
    if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = 'Awaiting patch application...';
    if(elements.diffOutputContainer) elements.diffOutputContainer.innerHTML = '';

    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
    if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '';
    if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '';
    if (elements.textOutputEl) elements.textOutputEl.textContent = '';
    if (elements.selectedFilesContainer) elements.selectedFilesContainer.innerHTML = '<div class="empty-notice">NO FILES IN COMMITTED SELECTION.<br>USE TREE AND \'COMMIT SELECTIONS\'.</div>';
    if (elements.selectionSummaryDiv && elements.selectionSummaryDiv.style) elements.selectionSummaryDiv.style.display = 'none';


    if(appState.editorInstance) appState.editorInstance.setValue('');
    if(appState.previewEditorInstance) appState.previewEditorInstance.setValue('');

    appState.fullScanData = null; appState.committedScanData = null;
    appState.selectionCommitted = false; appState.currentEditingFile = null;
    appState.activeTabId = 'textReportTab'; // Reset to default tab

    if (fileEditor.getAllEditedFiles && typeof fileEditor.getAllEditedFiles === 'function') {
        const editedFilesMap = fileEditor.getAllEditedFiles();
        if (editedFilesMap && typeof editedFilesMap.clear === 'function') {
            editedFilesMap.clear();
        }
    }

    // uiManager.setViewModeUI(false); // Replaced by tab logic

    disableUIControls();
    if (elements.mainActionDiv && elements.mainActionDiv.style) elements.mainActionDiv.style.display = 'flex';
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
    if (elements.clearProjectBtn) elements.clearProjectBtn.disabled = true;
}

export function enableUIControls() {
    const buttonsToEnable = [
        elements.selectAllBtn, elements.deselectAllBtn, elements.commitSelectionsBtn,
        elements.expandAllBtn, elements.collapseAllBtn, /*elements.viewModeToggleBtn,*/ // Removed
        elements.downloadProjectBtn, elements.clearProjectBtn, elements.copyReportButton,
        elements.applyAiPatchBtn
    ];
    buttonsToEnable.forEach(btn => { if (btn) btn.disabled = false; });

    if (elements.createAiBriefBtn) {
        elements.createAiBriefBtn.disabled = !appState.fullScanData;
    }
    if (elements.importAiScaffoldBtn) {
        elements.importAiScaffoldBtn.disabled = appState.processingInProgress;
    }
    if (elements.copySelectedBtn) {
        const currentTabIsCombine = document.querySelector('.tab-button[data-tab="combineModeTab"]')?.classList.contains('active');
        elements.copySelectedBtn.disabled = !(currentTabIsCombine && appState.selectionCommitted && appState.committedScanData?.allFilesList.some(f => utils.isLikelyTextFile(f.path)));
    }
     if (elements.clearProjectBtn) {
        elements.clearProjectBtn.disabled = !appState.fullScanData;
    }
    // Enable tab buttons
    if(elements.mainViewTabs) elements.mainViewTabs.querySelectorAll('.tab-button').forEach(btn => btn.disabled = !appState.fullScanData);

}

function disableUIControls() {
     const buttonsToDisable = [
        elements.selectAllBtn, elements.deselectAllBtn, elements.commitSelectionsBtn,
        elements.expandAllBtn, elements.collapseAllBtn, /*elements.viewModeToggleBtn,*/ // Removed
        elements.downloadProjectBtn, elements.clearProjectBtn, elements.copyReportButton,
        elements.copySelectedBtn,
        elements.createAiBriefBtn,
        elements.applyAiPatchBtn
    ];
    buttonsToDisable.forEach(btn => { if (btn) btn.disabled = true; });
    // Disable tab buttons
    if(elements.mainViewTabs) elements.mainViewTabs.querySelectorAll('.tab-button').forEach(btn => btn.disabled = true);
}

function showFailedUI(message = "SCAN FAILED - SEE ERROR REPORT") {
    if(elements.textOutputEl && elements.textReportTab && elements.textReportTab.contains(elements.textOutputEl)) {
        elements.textOutputEl.textContent = message;
        uiManager.activateTab('textReportTab'); // Show the tab with the error message
    } else if (elements.textReportTab) { // If textOutputEl isn't there but tab is
        const errorNotice = document.createElement('div');
        errorNotice.className = 'empty-notice';
        errorNotice.textContent = message;
        elements.textReportTab.innerHTML = ''; // Clear previous content
        elements.textReportTab.appendChild(errorNotice);
        uiManager.activateTab('textReportTab');
    }


    if(elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) elements.visualOutputContainer.style.display = 'none';
    if(elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'none';
    if (elements.treeViewControls) elements.treeViewControls.style.display = 'none';
    if (elements.generalActions) elements.generalActions.style.display = 'none';


    if(elements.loader) elements.loader.classList.remove('visible');
    if(elements.mainActionDiv && elements.mainActionDiv.style) elements.mainActionDiv.style.display = 'flex';
    if(elements.clearProjectBtn) elements.clearProjectBtn.disabled = true;
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
}


function commitSelections() {
    if (!appState.fullScanData) {
        errorHandler.showError({ name: "NoDataError", message: "No directory scanned yet." });
        return;
    }

    const currentSelectedPaths = new Set();
    if (elements.treeContainer) {
        elements.treeContainer.querySelectorAll('li').forEach(li => {
            if (li.dataset.selected === "true") {
                currentSelectedPaths.add(li.dataset.path);
            }
        });
    }

    if (currentSelectedPaths.size === 0 && appState.fullScanData.allFilesList && appState.fullScanData.allFilesList.length > 0) {
        notificationSystem.showNotification("Cannot commit: No files or folders are selected in the tree.", { duration: 3500 });
        return;
    }

    appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, currentSelectedPaths);

    if (appState.fullScanData && appState.fullScanData.allFilesList && appState.committedScanData && appState.fullScanData.directoryData) {
        const editedFileMap = fileEditor.getAllEditedFiles();
        editedFileMap.forEach((fileState, filePath) => {
            const originalFileFromFullScan = appState.fullScanData.allFilesList.find(f => f.path === filePath);
            if ((!originalFileFromFullScan || !originalFileFromFullScan.entryHandle) && currentSelectedPaths.has(filePath)) {
                if (!appState.committedScanData.allFilesList.find(committedFile => committedFile.path === filePath)) {
                    const name = filePath.substring(filePath.lastIndexOf('/') + 1);
                    const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '(no ext)';
                    let depth = 0;
                    const rootPath = appState.fullScanData.directoryData.path;
                    if (filePath.startsWith(rootPath + '/')) {
                        depth = (filePath.substring(rootPath.length + 1).match(/\//g) || []).length +1;
                    } else if (filePath.startsWith(rootPath) && !filePath.includes('/')) {
                         depth = 1;
                    } else {
                        const rootPartsCount = (rootPath.match(/\//g) || []).length;
                        const filePartsCount = (filePath.match(/\//g) || []).length;
                        depth = Math.max(1, filePartsCount - rootPartsCount + (rootPath.includes('/') ? 0:1) );
                    }
                    appState.committedScanData.allFilesList.push({
                        name: name, path: filePath, size: fileState.content.length,
                        extension: extension, type: 'file', depth: depth, entryHandle: null
                    });
                }
            }
        });
        if (appState.committedScanData.allFilesList) {
           appState.committedScanData.allFilesList.sort((a,b) => a.path.localeCompare(b.path));
        }
    }

    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
    if(currentSelectedPaths.size > 0) {
        notificationSystem.showNotification("Selections committed successfully");
    } else if (appState.fullScanData.allFilesList && appState.fullScanData.allFilesList.length === 0) {
        notificationSystem.showNotification("No items to commit (project might be empty or selection is empty).");
    }
}

function clearProjectData() {
    notificationSystem.showNotification("Project data cleared.", {duration: 2000});
    resetUIForProcessing("DROP A FOLDER OR SELECT ONE TO BEGIN.");
    if(elements.loader) elements.loader.classList.remove('visible');
    if(elements.mainActionDiv && elements.mainActionDiv.style) elements.mainActionDiv.style.display = 'flex';
}

function copyReport() {
    if (elements.textOutputEl && elements.textOutputEl.textContent && elements.textOutputEl.textContent.trim() !== "" && !elements.textOutputEl.textContent.startsWith("// NO DATA AVAILABLE") && !elements.textOutputEl.textContent.startsWith("// NO ITEMS IN CURRENT VIEW")) {
        navigator.clipboard.writeText(elements.textOutputEl.textContent)
            .then(() => notificationSystem.showNotification('Report copied to clipboard!'))
            .catch(err => { console.error('Failed to copy report: ', err); errorHandler.showError({ name: "ClipboardError", message: "Failed to copy to clipboard.", stack: err.stack }); });
    } else { notificationSystem.showNotification('No report generated or report is empty.'); }
}


function initApp() {
    populateElements();

    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers();
    fileEditor.initFileEditor();
    aiPatcher.initAiPatcher();
    aiBriefingStudio.initAiBriefingStudio();
    scaffoldImporter.initScaffoldImporter();
    uiManager.initTabs(); // Initialize tab functionality

    document.body.className = '';

    // Initial UI state for the new layout
    if (elements.leftSidebar) elements.leftSidebar.style.display = 'flex';
    if (elements.mainActionDiv) elements.mainActionDiv.style.display = 'flex';
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.style.display = 'block'; // Ensure it's visible

    if (elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) {
        elements.visualOutputContainer.style.display = 'none'; // Hide tree panel initially
    }
    if (elements.treeViewControls) elements.treeViewControls.style.display = 'none';
    if (elements.generalActions) elements.generalActions.style.display = 'none';


    if (elements.mainView) elements.mainView.style.display = 'flex'; // Show main view area (tabs + content)
    if (elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'none'; // Hide stats initially

    // Deactivate all tabs and hide their content initially
    if (elements.tabContentArea) {
        elements.tabContentArea.querySelectorAll('.tab-content-item').forEach(tc => {
             tc.classList.remove('active');
             tc.style.display = 'none';
        });
    }
    if (elements.mainViewTabs) {
        elements.mainViewTabs.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    }
    appState.activeTabId = null; // No tab active initially

    const modalsToHideOnInit = [
        elements.fileEditor, elements.filePreview, elements.errorReport,
        elements.aiPatchDiffModal, elements.aiBriefingStudioModal, elements.scaffoldImportModal
    ];
    modalsToHideOnInit.forEach(panel => { if (panel && panel.style) panel.style.display = 'none'; });

    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
    if (elements.loader) elements.loader.classList.remove('visible');


    disableUIControls();
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
    if (elements.clearProjectBtn) elements.clearProjectBtn.disabled = true;


    setupEventListeners();

    if (elements.pageLoader) elements.pageLoader.classList.add('hidden');
    document.body.classList.add('loaded');

    appState.initialLoadComplete = true;
    console.log("DirAnalyse Matrix Initialized with new UI structure. CodeMirror integration started.");
}
document.addEventListener('DOMContentLoaded', initApp);
// --- ENDFILE: js/main.js --- //