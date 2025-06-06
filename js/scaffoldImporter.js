// --- FILE: loomdir/js/scaffoldImporter.js ---
import { appState, elements, resetUIForProcessing, enableUIControls, showFailedUI } from './main.js';
import * as treeView from './treeView.js';
import * as uiManager from './uiManager.js';
import * as notificationSystem from './notificationSystem.js';
import * as fileEditor from './fileEditor.js';
import * as errorHandler from './errorHandler.js';
import { getFileExtension } from './utils.js';
import * as fileSystem from './fileSystem.js';

export function initScaffoldImporter() {
    if (elements.importAiScaffoldBtn) {
        elements.importAiScaffoldBtn.addEventListener('click', openScaffoldModal);
    }
    if (elements.closeScaffoldModalBtn) {
        elements.closeScaffoldModalBtn.addEventListener('click', closeScaffoldModal);
    }
    if (elements.createProjectFromScaffoldBtn) {
        elements.createProjectFromScaffoldBtn.addEventListener('click', processScaffoldJsonInput);
    }
    if (elements.cancelScaffoldImportBtn) {
        elements.cancelScaffoldImportBtn.addEventListener('click', closeScaffoldModal);
    }
}

function openScaffoldModal() {
    if (elements.aiScaffoldJsonInput) elements.aiScaffoldJsonInput.value = '';
    if (elements.scaffoldImportModal) elements.scaffoldImportModal.style.display = 'flex'; // Changed to flex for centering
}

function closeScaffoldModal() {
    if (elements.scaffoldImportModal) elements.scaffoldImportModal.style.display = 'none';
}

async function processScaffoldJsonInput() {
    const jsonString = elements.aiScaffoldJsonInput ? elements.aiScaffoldJsonInput.value.trim() : '';
    if (!jsonString) {
        notificationSystem.showNotification("Scaffold JSON input is empty.", { duration: 3000 });
        return;
    }

    let scaffoldData;
    try {
        scaffoldData = JSON.parse(jsonString);
        if (typeof scaffoldData !== 'object' || scaffoldData === null ||
            typeof scaffoldData.structureString !== 'string' || !scaffoldData.structureString.trim() ||
            !Array.isArray(scaffoldData.fileContents) ||
            scaffoldData.fileContents.some(fc => typeof fc.filePath !== 'string' || typeof fc.content !== 'string')) {
            throw new Error("Invalid scaffold format. Expects a JSON object with 'structureString' (string) and 'fileContents' (array of {filePath, content} objects).");
        }
    } catch (error) {
        errorHandler.showError({
            name: "ScaffoldParseError",
            message: `Invalid Scaffold JSON: ${error.message}`,
            stack: error.stack
        });
        notificationSystem.showNotification("Error parsing scaffold JSON. See error report.", { duration: 4000 });
        return;
    }

    notificationSystem.showNotification("Creating project from AI scaffold...", { duration: 2000 });
    closeScaffoldModal();
    resetUIForProcessing("Building project from AI scaffold...");

    if (fileEditor.getAllEditedFiles && typeof fileEditor.getAllEditedFiles === 'function') {
        const editedFilesMap = fileEditor.getAllEditedFiles();
        if (editedFilesMap && typeof editedFilesMap.clear === 'function') {
            editedFilesMap.clear();
        }
    }
    appState.currentEditingFile = null;

    try {
        const { rootNode, allFilesList, allFoldersList, maxDepthVal, projectName } = parseStructureString(scaffoldData.structureString);

        // Populate file content and update sizes
        const fileContentsMap = new Map(scaffoldData.fileContents.map(f => [f.filePath, f.content]));

        allFilesList.forEach(fileInfo => {
            const content = fileContentsMap.get(fileInfo.path);
            if (content !== undefined) {
                fileInfo.size = content.length; // Update size based on actual content
                fileEditor.updateFileInEditorCache(fileInfo.path, content, content, false); // Store content
            } else {
                // This case means a file was in structureString but not in fileContents.
                // It will be treated as an empty file.
                console.warn(`[Scaffold] File "${fileInfo.path}" was in structure string but not in fileContents. Creating as empty.`);
                fileInfo.size = 0;
                fileEditor.updateFileInEditorCache(fileInfo.path, "", "", false);
            }
        });

        // Recalculate folder stats after file sizes are known
        function calculateStatsRecursive(folder) {
            folder.fileCount = 0; folder.dirCount = 0; folder.totalSize = 0; folder.fileTypes = {};
            folder.children.forEach(child => {
                if (child.type === 'folder') {
                    calculateStatsRecursive(child);
                    folder.dirCount++;
                    folder.dirCount += child.dirCount;
                    folder.fileCount += child.fileCount;
                    folder.totalSize += child.totalSize;
                    Object.entries(child.fileTypes).forEach(([ext, data]) => {
                        if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
                        folder.fileTypes[ext].count += data.count;
                        folder.fileTypes[ext].size += data.size;
                    });
                } else { // File
                    folder.fileCount++;
                    folder.totalSize += child.size; // Use the updated size
                    const ext = child.extension;
                    if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
                    folder.fileTypes[ext].count++;
                    folder.fileTypes[ext].size += child.size;
                }
            });
        }
        calculateStatsRecursive(rootNode);

        appState.fullScanData = {
            directoryData: rootNode,
            allFilesList: allFilesList,
            allFoldersList: allFoldersList,
            maxDepth: maxDepthVal,
            deepestPathExample: rootNode.path,
            emptyDirCount: countEmptyDirsInParsedStructure(rootNode)
        };

        appState.selectionCommitted = false;
        appState.committedScanData = null;

        if (elements.treeContainer) elements.treeContainer.innerHTML = '';
        treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        treeView.setAllSelections(true); // Select all by default for new scaffold

        // Commit all selections by default for a new scaffold
        const allPaths = new Set([...allFilesList.map(f => f.path), ...allFoldersList.map(f => f.path)]);
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allPaths);
        appState.selectionCommitted = true;


        if (elements.rightStatsPanel) elements.rightStatsPanel.style.display = 'flex';
        if (elements.visualOutputContainer && elements.visualOutputContainer.closest('#leftSidebar')) {
             elements.visualOutputContainer.style.display = 'flex';
        }
        if (elements.mainView) elements.mainView.style.display = 'flex';
        if (elements.treeViewControls) elements.treeViewControls.style.display = 'flex';
        if (elements.generalActions) elements.generalActions.style.display = 'flex';


        uiManager.activateTab('textReportTab'); // Default to text report view
        uiManager.refreshAllUI();
        enableUIControls();
        if (elements.loader) elements.loader.classList.remove('visible');
        notificationSystem.showNotification(`Project '${projectName}' created from AI scaffold!`, { duration: 3000 });

    } catch (e) {
        console.error("Error processing scaffold input:", e);
        errorHandler.showError({ name: "ScaffoldProcessError", message: e.message, stack: e.stack });
        if (elements.loader) elements.loader.classList.remove('visible');
        showFailedUI("Failed to create project from scaffold. Check console.");
    }
}


function parseStructureString(structureStr) {
    let str = structureStr.trim();
    const rootNameMatch = str.match(/^([^(]+)\((.*)\)$/);
    if (!rootNameMatch) {
        throw new Error("Invalid structure string format: Does not match RootName(...). String: " + structureStr);
    }
    const projectName = rootNameMatch[1].trim();
    let currentContent = rootNameMatch[2];

    const rootNode = {
        name: projectName,
        path: projectName,
        type: 'folder',
        depth: 0,
        children: [],
        fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, // These will be calculated later
        entryHandle: null
    };

    const allFiles = [];
    const allFolders = [{ name: rootNode.name, path: rootNode.path, depth: 0, entryHandle: null }];
    let maxDepth = 0;

    function parseChildren(parentPath, parentDepth, childrenString, parentNode) {
        let unprocessed = childrenString.trim();
        let currentSegment = "";
        let nestingLevel = 0;

        if (!unprocessed) return; // Empty folder case like "folder()"

        for (let i = 0; i < unprocessed.length; i++) {
            const char = unprocessed[i];
            currentSegment += char;

            if (char === '(') {
                nestingLevel++;
            } else if (char === ')') {
                nestingLevel--;
            }

            if (nestingLevel === 0 && (char === ',' || i === unprocessed.length - 1)) {
                // Found a complete item (file or folder block)
                let itemStr = (char === ',') ? currentSegment.slice(0, -1).trim() : currentSegment.trim();
                currentSegment = ""; // Reset for next segment

                const folderMatch = itemStr.match(/^([^(]+)\((.*)\)$/);
                const currentDepth = parentDepth + 1;
                if (currentDepth > maxDepth) maxDepth = currentDepth;

                if (folderMatch) { // It's a folder
                    const folderName = folderMatch[1].trim();
                    const folderPath = `${parentPath}/${folderName}`;
                    const folderNode = {
                        name: folderName,
                        path: folderPath,
                        type: 'folder',
                        depth: currentDepth,
                        children: [],
                        entryHandle: null
                        // Stats will be calculated later
                    };
                    parentNode.children.push(folderNode);
                    allFolders.push({ name: folderName, path: folderPath, depth: currentDepth, entryHandle: null });
                    parseChildren(folderPath, currentDepth, folderMatch[2], folderNode); // Recurs
                } else { // It's a file
                    const fileName = itemStr.trim();
                    if (fileName) { // Ensure it's not an empty string (e.g. from "folder(,) " )
                        const filePath = `${parentPath}/${fileName}`;
                        const fileNode = {
                            name: fileName,
                            path: filePath,
                            type: 'file',
                            size: 0, // Placeholder, will be updated from fileContents
                            extension: getFileExtension(fileName),
                            depth: currentDepth,
                            entryHandle: null
                        };
                        parentNode.children.push(fileNode);
                        allFiles.push(fileNode); // Add placeholder to allFiles list
                    }
                }
            }
        }
         // Sort children: folders first, then alphabetically
        parentNode.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    }

    parseChildren(projectName, 0, currentContent, rootNode);

    return {
        projectName: projectName,
        rootNode: rootNode,
        allFilesList: allFiles,
        allFoldersList: allFolders,
        maxDepthVal: maxDepth
    };
}


function countEmptyDirsInParsedStructure(node) {
    let count = 0;
    if (node.type === 'folder') {
        if (node.children.length === 0) {
            count = 1;
        } else {
            for (const child of node.children) {
                count += countEmptyDirsInParsedStructure(child);
            }
        }
    }
    return count;
}

// --- ENDFILE: loomdir/js/scaffoldImporter.js ---