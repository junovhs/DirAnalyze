// --- FILE: js/uiManager.js --- //
import { appState, elements } from './main.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as utils from './utils.js';
import * as fileEditor from './fileEditor.js';
import * as main from './main.js';


export function initTabs() {
    const tabButtons = document.querySelectorAll('#mainViewTabs .tab-button');

    if (!elements.mainViewTabs || !elements.tabContentArea) {
        console.warn("Main view tabs or content area not found. Tab system will not initialize.");
        return;
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            activateTab(button.dataset.tab);
        });
    });

    if (!appState.fullScanData) {
        activateTab('textReportTab');
    } else if (appState.activeTabId) {
        activateTab(appState.activeTabId);
    } else if (tabButtons.length > 0) {
        activateTab(tabButtons[0].dataset.tab);
    }
}

export function activateTab(tabIdToActivate) {
    const tabButtons = document.querySelectorAll('#mainViewTabs .tab-button');
    const tabContents = document.querySelectorAll('#tabContentArea .tab-content-item');

    let newActiveTabFound = false;

    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabIdToActivate) {
            btn.classList.add('active');
            newActiveTabFound = true;
        } else {
            btn.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === tabIdToActivate) {
            content.classList.add('active');
            content.style.display = 'flex';
        } else {
            content.classList.remove('active');
            content.style.display = 'none';
        }
    });

    if (newActiveTabFound) {
        appState.activeTabId = tabIdToActivate;
        if (tabIdToActivate === 'versionHistoryTab' && typeof main.fetchAndDisplayVersions === 'function') {
            main.fetchAndDisplayVersions();
        }
    } else if (tabButtons.length > 0 && !appState.fullScanData) {
        appState.activeTabId = 'textReportTab';
        document.querySelector('.tab-button[data-tab="textReportTab"]')?.classList.add('active');
        const textReportTabContent = document.getElementById('textReportTab');
        if (textReportTabContent) {
             textReportTabContent.classList.add('active');
             textReportTabContent.style.display = 'flex';
        }
    } else if (tabButtons.length > 0) {
        const firstTabButton = tabButtons[0];
        if (firstTabButton && firstTabButton.dataset && firstTabButton.dataset.tab) {
            activateTab(firstTabButton.dataset.tab);
        }
        return;
    }
    
    if (elements.copyReportButton) {
        elements.copyReportButton.disabled = !(appState.activeTabId === 'textReportTab' && appState.fullScanData);
    }
}


export function refreshAllUI() {
    if (!appState.fullScanData) {
        if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
        if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        if (elements.selectionSummaryDiv) elements.selectionSummaryDiv.style.display = 'none';
        if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        
        if (elements.textOutputEl && elements.textReportTab && elements.textReportTab.classList.contains('active')) {
            elements.textOutputEl.textContent = "// NO PROJECT LOADED //";
        }
        if (elements.aiPatchPanel && elements.aiPatcherTab && elements.aiPatcherTab.classList.contains('active')) {
            if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = "Load a project to use the AI Patcher.";
        }
        if (elements.versionHistoryList && elements.versionHistoryTab && elements.versionHistoryTab.classList.contains('active')) {
            elements.versionHistoryList.innerHTML = '<li class="empty-notice">No project loaded.</li>';
        }

        if (elements.copyReportButton) elements.copyReportButton.disabled = true;
        return;
    }

    const displayData = appState.selectionCommitted ? appState.committedScanData : appState.fullScanData;

    if (!displayData || !displayData.directoryData || (displayData.allFilesList.length === 0 && displayData.allFoldersList.length === 0 && (!displayData.directoryData.children || displayData.directoryData.children.length === 0)) ) {
        if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">NO ITEMS IN CURRENT VIEW / SELECTION.</div>';
        if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        if (elements.selectionSummaryDiv) elements.selectionSummaryDiv.style.display = 'none';
        if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';

        if (appState.activeTabId === 'textReportTab' && elements.textOutputEl) {
            elements.textOutputEl.textContent = "// NO ITEMS IN CURRENT VIEW / SELECTION //";
        }
        if (appState.activeTabId === 'aiPatcherTab' && elements.aiPatchOutputLog) {
            elements.aiPatchOutputLog.textContent = "No items in current view/selection for patching.";
        }
        if (appState.activeTabId === 'versionHistoryTab' && elements.versionHistoryList) {
            elements.versionHistoryList.innerHTML = '<li class="empty-notice">No versions available for the current project state or no project loaded.</li>';
        }

        if (elements.copyReportButton) elements.copyReportButton.disabled = true;
        return;
    }

    updateVisualTreeFiltering(); 
    statsManager.displayGlobalStats(displayData, appState.fullScanData); 

    if (appState.activeTabId === 'textReportTab' && elements.textOutputEl) {
        if (typeof reportGenerator.generateTextReport_revised === 'function') {
             elements.textOutputEl.textContent = reportGenerator.generateTextReport_revised(displayData);
        } else {
            elements.textOutputEl.textContent = reportGenerator.generateTextReport(displayData);
        }
    }
    if (appState.activeTabId === 'versionHistoryTab' && typeof main.fetchAndDisplayVersions === 'function') {
        main.fetchAndDisplayVersions();
    }

    if (elements.copyReportButton) {
        elements.copyReportButton.disabled = !(appState.activeTabId === 'textReportTab' && appState.fullScanData);
    }

    if (appState.currentEditingFile && elements.fileEditor.style.display === 'flex') {
        const currentFileState = fileEditor.getAllEditedFiles().get(appState.currentEditingFile.path);
        if (currentFileState) {
            // Call the correctly named function from fileEditor.js
            if (typeof fileEditor.updateEditorInfoUI === 'function') {
                 fileEditor.updateEditorInfoUI(appState.currentEditingFile.path, currentFileState.content, currentFileState.hasUnsavedChanges);
            } else {
                // Fallback or error if the function is not available for some reason
                console.warn("fileEditor.updateEditorInfoUI is not defined.");
            }
        }
    }
}

function updateVisualTreeFiltering() {
    if (!appState.fullScanData || !elements.treeContainer) return;
    const committedPaths = new Set();
    if (appState.selectionCommitted && appState.committedScanData?.directoryData) {
        function collectPathsRecursive(node, pathSet) {
            if (!node) return;
            pathSet.add(node.path);
            if (node.type === 'folder' && node.children) {
                node.children.forEach(child => collectPathsRecursive(child, pathSet));
            }
        }
        collectPathsRecursive(appState.committedScanData.directoryData, committedPaths);
    }
    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const path = li.dataset.path;
        li.classList.remove('dimmed-uncommitted', 'filtered-out');
        if (appState.selectionCommitted && committedPaths.size > 0) {
            if (!committedPaths.has(path)) {
                li.classList.add('dimmed-uncommitted');
            }
        }
    });
}
// --- ENDFILE: js/uiManager.js --- //