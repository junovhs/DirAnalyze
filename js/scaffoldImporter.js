// --- FILE: loomdir/js/scaffoldImporter.js ---
import { appState, elements, resetUIForProcessing, enableUIControls } from './main.js';
import * as treeView from './treeView.js';
import * as uiManager from './uiManager.js';
import * as notificationSystem from './notificationSystem.js';
import * as fileEditor from './fileEditor.js';
import * as errorHandler from './errorHandler.js';
import { getFileExtension } from './utils.js';
import * as fileSystem from './fileSystem.js'; // For filterScanData

export function initScaffoldImporter() {
    if (elements.importAiScaffoldBtn) {
        elements.importAiScaffoldBtn.addEventListener('click', openScaffoldModal);
    } else {
        console.warn('[ScaffoldImporter] importAiScaffoldBtn not found.');
    }
    if (elements.closeScaffoldModalBtn) {
        elements.closeScaffoldModalBtn.addEventListener('click', closeScaffoldModal);
    }
    if (elements.createProjectFromScaffoldBtn) {
        elements.createProjectFromScaffoldBtn.addEventListener('click', processScaffoldJson);
    }
    if (elements.cancelScaffoldImportBtn) {
        elements.cancelScaffoldImportBtn.addEventListener('click', closeScaffoldModal);
    }
}

function openScaffoldModal() {
    if (elements.aiScaffoldJsonInput) elements.aiScaffoldJsonInput.value = '';
    if (elements.scaffoldImportModal) elements.scaffoldImportModal.style.display = 'block';
}

function closeScaffoldModal() {
    if (elements.scaffoldImportModal) elements.scaffoldImportModal.style.display = 'none';
}

async function processScaffoldJson() {
    const jsonString = elements.aiScaffoldJsonInput ? elements.aiScaffoldJsonInput.value.trim() : '';
    if (!jsonString) {
        notificationSystem.showNotification("Scaffold JSON input is empty.", { duration: 3000 });
        return;
    }

    let scaffoldOperations;
    try {
        scaffoldOperations = JSON.parse(jsonString);
        if (!Array.isArray(scaffoldOperations) || scaffoldOperations.some(op => op.operation !== 'create_scaffold_file' || typeof op.filePath !== 'string' || typeof op.content !== 'string')) {
            throw new Error("Invalid scaffold format. Expects an array of 'create_scaffold_file' operations with 'filePath' and 'content'.");
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

    if (scaffoldOperations.length === 0) {
        notificationSystem.showNotification("Scaffold JSON contains no operations.", { duration: 3000 });
        return;
    }

    notificationSystem.showNotification("Creating project from scaffold...", { duration: 2000 });
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
        let projectName = 'AI_Scaffolded_Project'; // Default
        const firstPathDirs = scaffoldOperations[0].filePath.split('/');
        if (firstPathDirs.length > 0 && firstPathDirs[0] !== "") { // Check if first part is not empty (e.g. not absolute path)
             // If the path is like "my-app/index.html", projectName is "my-app"
             // If path is "index.html", projectName remains default or could be taken from user input later
            if (firstPathDirs.length > 1 || (firstPathDirs.length === 1 && scaffoldOperations[0].filePath.includes('/'))) {
                 projectName = firstPathDirs[0];
            }
        }


        const rootNode = {
            name: projectName,
            path: projectName,
            type: 'folder',
            depth: 0,
            children: [],
            fileCount: 0,
            dirCount: 0,
            totalSize: 0,
            fileTypes: {},
            entryHandle: null
        };
        const allFilesList = [];
        const folderMap = new Map([[projectName, rootNode]]);
        // Initialize allFoldersList with the root node details including depth
        const allFoldersList = [{ name: rootNode.name, path: rootNode.path, depth: 0, entryHandle: null }];


        for (const op of scaffoldOperations) {
            const fullFilePath = op.filePath;
            const content = op.content;
            const pathParts = fullFilePath.split('/');
            const fileName = pathParts.pop();

            let currentParentNode = rootNode;
            let currentPathForChildBuild = ""; // Start from empty to build absolute-like paths for map keys

            // If the scaffold paths already include the root project name,
            // we need to handle it gracefully.
            if (pathParts.length > 0 && pathParts[0] === projectName) {
                currentPathForChildBuild = projectName; // Start with the root name
                // currentParentNode is already rootNode
                for (let i = 1; i < pathParts.length; i++) { // Start from 1 to skip root name already handled
                    const part = pathParts[i];
                    const folderPath = currentPathForChildBuild + '/' + part;
                    if (!folderMap.has(folderPath)) {
                        const newFolder = {
                            name: part,
                            path: folderPath,
                            type: 'folder',
                            depth: i +1, // Depth from root
                            children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: null
                        };
                        folderMap.set(folderPath, newFolder);
                        currentParentNode.children.push(newFolder);
                        allFoldersList.push({ name: newFolder.name, path: newFolder.path, depth: newFolder.depth, entryHandle: null });
                        currentParentNode = newFolder;
                    } else {
                        currentParentNode = folderMap.get(folderPath);
                    }
                    currentPathForChildBuild = folderPath;
                }
            } else { // Paths are relative to the implied project root (e.g. "css/style.css")
                currentPathForChildBuild = projectName; // Base it on the determined project name
                for (let i = 0; i < pathParts.length; i++) {
                    const part = pathParts[i];
                    const folderPath = currentPathForChildBuild + '/' + part;
                    if (!folderMap.has(folderPath)) {
                        const newFolder = {
                            name: part,
                            path: folderPath,
                            type: 'folder',
                            depth: i + 1, // Depth from root
                            children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: null
                        };
                        folderMap.set(folderPath, newFolder);
                        currentParentNode.children.push(newFolder);
                        allFoldersList.push({ name: newFolder.name, path: newFolder.path, depth: newFolder.depth, entryHandle: null });
                        currentParentNode = newFolder;
                    } else {
                        currentParentNode = folderMap.get(folderPath);
                    }
                    currentPathForChildBuild = folderPath;
                }
            }
            
            // The final path for the file should be prefixed with the rootNode.name if not already
            let finalFilePathForAppState = fullFilePath;
            if (!fullFilePath.startsWith(projectName + '/')) {
                finalFilePathForAppState = projectName + '/' + fullFilePath;
                 // Handle case where fullFilePath might be "index.html" (no leading slash needed)
                if (fullFilePath.split('/').length === 1 && !fullFilePath.includes('/')) {
                     finalFilePathForAppState = projectName + '/' + fullFilePath;
                }
            }
             // If fullFilePath was "my-project/src/file.js", and projectName is "my-project", final path is correct
             // If fullFilePath was "src/file.js", and projectName is "my-project", final path becomes "my-project/src/file.js"


            const fileInfo = {
                name: fileName,
                path: finalFilePathForAppState,
                type: 'file',
                size: content.length,
                extension: getFileExtension(fileName),
                depth: finalFilePathForAppState.split('/').length -1,
                entryHandle: null
            };
            currentParentNode.children.push(fileInfo);
            allFilesList.push(fileInfo);
            fileEditor.setEditedContent(finalFilePathForAppState, content, false);
        }

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
                } else {
                    folder.fileCount++;
                    folder.totalSize += child.size;
                    const ext = child.extension;
                    if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
                    folder.fileTypes[ext].count++;
                    folder.fileTypes[ext].size += child.size;
                }
            });
        }
        calculateStatsRecursive(rootNode);

        let maxDepthVal = 0;
        allFilesList.forEach(f => { if(f.depth > maxDepthVal) maxDepthVal = f.depth; });
        allFoldersList.forEach(f => { if(f.depth > maxDepthVal) maxDepthVal = f.depth; });


        appState.fullScanData = {
            directoryData: rootNode,
            allFilesList: allFilesList,
            allFoldersList: allFoldersList,
            maxDepth: maxDepthVal,
            deepestPathExample: rootNode.path, // Placeholder, can be improved
            emptyDirCount: 0 // Placeholder, can be improved
        };

        appState.selectionCommitted = false;
        appState.committedScanData = null;

        if (elements.treeContainer) elements.treeContainer.innerHTML = '';
        treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        treeView.setAllSelections(true);

        const allPaths = new Set([...allFilesList.map(f => f.path), ...allFoldersList.map(f => f.path)]);
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allPaths); // Use fileSystem
        appState.selectionCommitted = true;

        if(elements.globalStatsPanel) elements.globalStatsPanel.style.display = 'block';
        if(elements.sidebarToolsContainer) elements.sidebarToolsContainer.style.display = 'flex';
        if(elements.visualOutputContainer) elements.visualOutputContainer.style.display = 'flex';
        if(elements.textOutputContainerOuter) elements.textOutputContainerOuter.style.display = 'flex';
        if(elements.aiPatchPanel) elements.aiPatchPanel.style.display = 'block';

        uiManager.refreshAllUI();
        enableUIControls();
        if (elements.loader) elements.loader.classList.remove('visible');
        notificationSystem.showNotification(`Project '${projectName}' created from scaffold!`, { duration: 3000 });

    } catch (e) {
        console.error("Error processing scaffold operations:", e);
        errorHandler.showError({ name: "ScaffoldProcessError", message: e.message, stack: e.stack });
        if (elements.loader) elements.loader.classList.remove('visible');
        // Potentially revert to a clean state or show a specific error UI for failed scaffold
        showFailedUI("Failed to create project from scaffold. Check console.");
    }
}
// --- ENDFILE: loomdir/js/scaffoldImporter.js ---