// --- FILE: js/fileSystem.js --- //
import { elements, appState } from './main.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import { getFileExtension } from './utils.js'; // For CodeMirror mode

// Process a directory entry recursively and build directory data structure
export async function processDirectoryEntryRecursive(dirHandle, currentPath, depth, parentAggregator = null) {
    try {
        const dirData = {
            name: dirHandle.name, path: currentPath, type: 'folder', depth,
            children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {},
            entryHandle: dirHandle
        };

        let aggregator = parentAggregator || {
            allFilesList: [], allFoldersList: [], maxDepth: depth,
            deepestPathExample: currentPath, emptyDirCount: 0
        };

        if (depth > aggregator.maxDepth) {
            aggregator.maxDepth = depth;
            aggregator.deepestPathExample = currentPath;
        }
        aggregator.allFoldersList.push({ name: dirData.name, path: dirData.path, entryHandle: dirData.entryHandle });

        const entries = [];
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }

        if (entries.length === 0 && depth > 0) aggregator.emptyDirCount++;

        for (const entry of entries) {
            const entryPath = `${currentPath}/${entry.name}`;
            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    const fileInfo = {
                        name: file.name, type: 'file', size: file.size, path: entryPath,
                        extension: getFileExtension(file.name), depth: depth + 1, entryHandle: entry
                    };
                    dirData.children.push(fileInfo);
                    dirData.fileCount++;
                    dirData.totalSize += file.size;
                    aggregator.allFilesList.push({ ...fileInfo }); // Use a copy
                    const ext = fileInfo.extension;
                    if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                    dirData.fileTypes[ext].count++;
                    dirData.fileTypes[ext].size += file.size;
                } catch (err) {
                    console.warn(`Skipping file ${entry.name}: ${err.message}`);
                }
            } else if (entry.kind === 'directory') {
                try {
                    const subResults = await processDirectoryEntryRecursive(entry, entryPath, depth + 1, aggregator);
                    dirData.children.push(subResults.directoryData);
                    dirData.dirCount++;
                    dirData.fileCount += subResults.directoryData.fileCount;
                    dirData.dirCount += subResults.directoryData.dirCount;
                    dirData.totalSize += subResults.directoryData.totalSize;
                    Object.entries(subResults.directoryData.fileTypes).forEach(([ext, data]) => {
                        if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                        dirData.fileTypes[ext].count += data.count;
                        dirData.fileTypes[ext].size += data.size;
                    });
                } catch (err) {
                    console.warn(`Skipping directory ${entry.name}: ${err.message}`);
                }
            }
        }
        return depth === 0 ? { directoryData: dirData, ...aggregator } : { directoryData: dirData };
    } catch (err) {
        err.path = currentPath;
        throw err;
    }
}

export function filterScanData(fullData, selectedPathsSet) {
    if (!fullData || !fullData.directoryData) {
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
    function filterNodeRecursive(node) {
        if (node.type === 'file') {
            return selectedPathsSet.has(node.path) ? { ...node } : null;
        }

        const filteredChildren = node.children
            .map(child => filterNodeRecursive(child))
            .filter(child => child !== null);

        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) {
            return null;
        }

        const filteredFolder = { ...node, children: filteredChildren };
        filteredFolder.fileCount = 0;
        filteredFolder.dirCount = 0;
        filteredFolder.totalSize = 0;
        filteredFolder.fileTypes = {};
        filteredChildren.forEach(fc => {
            if (fc.type === 'file') {
                filteredFolder.fileCount++;
                filteredFolder.totalSize += fc.size;
                if (!filteredFolder.fileTypes[fc.extension]) filteredFolder.fileTypes[fc.extension] = { count: 0, size: 0 };
                filteredFolder.fileTypes[fc.extension].count++;
                filteredFolder.fileTypes[fc.extension].size += fc.size;
            } else { 
                filteredFolder.dirCount++;
                filteredFolder.dirCount += fc.dirCount;
                filteredFolder.fileCount += fc.fileCount;
                filteredFolder.totalSize += fc.totalSize;
                Object.entries(fc.fileTypes).forEach(([ext, data]) => {
                    if (!filteredFolder.fileTypes[ext]) filteredFolder.fileTypes[ext] = { count: 0, size: 0 };
                    filteredFolder.fileTypes[ext].count += data.count;
                    filteredFolder.fileTypes[ext].size += data.size;
                });
            }
        });
        return filteredFolder;
    }

    const filteredDirectoryData = filterNodeRecursive(fullData.directoryData);
    if (!filteredDirectoryData) { 
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
    const filteredAllFiles = [];
    const filteredAllFolders = [];
    function collectFiltered(node, filesArr, foldersArr) {
        if (!node) return;
        if (node.type === 'file') {
            filesArr.push({ ...node }); 
        } else { 
            foldersArr.push({ name: node.name, path: node.path, entryHandle: node.entryHandle });
            if (node.children) node.children.forEach(child => collectFiltered(child, filesArr, foldersArr));
        }
    }
    collectFiltered(filteredDirectoryData, filteredAllFiles, filteredAllFolders);

    return {
        directoryData: filteredDirectoryData,
        allFilesList: filteredAllFiles,
        allFoldersList: filteredAllFolders,
        maxDepth: fullData.maxDepth,
        deepestPathExample: fullData.deepestPathExample,
        emptyDirCount: fullData.emptyDirCount 
    };
}

// Read file content.
// Pass `forceOriginal = true` to bypass edited content and read from handle,
// used when needing the true original for comparison or reset.
export async function readFileContent(fileEntryOrHandle, filePathForEditedCheck = null, forceOriginal = false) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;

    try {
        if (!forceOriginal && pathKey && fileEditor.hasEditedContent(pathKey)) {
            return fileEditor.getEditedContent(pathKey);
        }

        if (!fileEntryOrHandle) {
            throw new Error(`Invalid file entry or handle provided for '${pathKey}' (it's null/undefined and not in editor, or original read forced).`);
        }

        // NEW: Handle modern FileSystemFileHandle from showDirectoryPicker()
        if (fileEntryOrHandle.kind === 'file' && typeof fileEntryOrHandle.getFile === 'function') {
            const file = await fileEntryOrHandle.getFile();
            return await file.text();
        }

        // Handle File objects (from <input> or a scaffold)
        if (fileEntryOrHandle instanceof File) {
            return await fileEntryOrHandle.text();
        }

        // Handle legacy FileEntry (from old drag-and-drop)
        if (typeof fileEntryOrHandle.file === 'function') {
            return new Promise((resolve, reject) => {
                fileEntryOrHandle.file(
                    async (fileObject) => {
                        try {
                            const text = await fileObject.text();
                            resolve(text);
                        } catch (err) { reject(err); }
                    },
                    (err) => { reject(err); }
                );
            });
        }

        // If none of the above match, it's an unsupported type.
        throw new Error("Unsupported file entry or handle type.");

    } catch (err) {
        console.error(`Error in readFileContent for ${pathKey}:`, err);
        if (!err.path) err.path = pathKey;
        throw err;
    }
}

// Helper to get CodeMirror mode from file extension for preview
function getCodeMirrorModeForPreview(filePath) {
    const extension = getFileExtension(filePath);
     switch (extension) {
        case '.js': case '.mjs': case '.json': return { name: "javascript", json: extension === '.json' };
        case '.ts': case '.tsx': return "text/typescript";
        case '.css': return "text/css";
        case '.html': case '.htm': case '.xml': return "htmlmixed";
        case '.md': return "text/markdown";
        case '.py': return "text/x-python";
        case '.java': return "text/x-java";
        case '.c': case '.h': case '.cpp': case '.hpp': return "text/x-c++src";
        case '.cs': return "text/x-csharp";
        default: return "text/plain"; // Fallback for unknown types
    }
}


// Preview a file by showing its content in a modal with CodeMirror
export async function previewFile(fileEntryOrHandle, filePathForEditedCheck = null) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;
    const displayName = fileEntryOrHandle?.name || (pathKey ? pathKey.substring(pathKey.lastIndexOf('/') + 1) : "File");
    
    try {
        const content = await readFileContent(fileEntryOrHandle, pathKey);
        elements.filePreviewTitle.textContent = `PREVIEW: ${displayName}`;
        elements.filePreview.style.display = 'block';

        if (typeof CodeMirror !== 'undefined') {
            if (!appState.previewEditorInstance) {
                appState.previewEditorInstance = CodeMirror(elements.filePreviewContent, { // Attach to the div
                    value: content,
                    mode: getCodeMirrorModeForPreview(pathKey),
                    lineNumbers: true,
                    theme: "material-darker", // Match editor theme or choose another
                    readOnly: true, // Important for preview
                    lineWrapping: true,
                });
            } else {
                appState.previewEditorInstance.setValue(content);
                appState.previewEditorInstance.setOption("mode", getCodeMirrorModeForPreview(pathKey));
            }
            // Ensure CodeMirror refreshes if the modal was hidden
            setTimeout(() => {
                if (appState.previewEditorInstance) appState.previewEditorInstance.refresh();
            }, 50);
        } else {
            // Fallback if CodeMirror is not loaded
            elements.filePreviewContent.innerHTML = `<pre>${content.replace(/</g, "<").replace(/>/g, ">")}</pre>`;
        }

    } catch (err) {
        console.error(`Error previewing file ${displayName}:`, err);
        elements.filePreviewContent.textContent = `Error previewing file: ${err.message}`;
        errorHandler.showError({
            name: err.name || "PreviewError",
            message: `Failed to preview file: ${displayName}. ${err.message}`,
            stack: err.stack,
            cause: err
        });
    }
}

export async function writeFileContent(directoryHandle, fullPath, content) {
    try {
        const rootName = directoryHandle.name;
        if (!fullPath.startsWith(rootName + '/')) {
            // If the path is just the root name itself (a file dropped in the root)
            if (fullPath === rootName) {
                 // This case is ambiguous. Let's assume the user means a file with the same name as the root folder.
                 // A better approach is to ensure paths are always relative.
                 // For now, let's treat it as an error or handle it as a file in the root.
                 // Let's assume it's a file in the root
                 const fileHandle = await directoryHandle.getFileHandle(fullPath, { create: true });
                 const writable = await fileHandle.createWritable();
                 await writable.write(content);
                 await writable.close();
                 return;
            }
             throw new Error(`Path "${fullPath}" does not belong to the root directory "${rootName}".`);
        }

        const relativePath = fullPath.substring(rootName.length + 1);
        const pathParts = relativePath.split('/');
        const fileName = pathParts.pop();

        let currentHandle = directoryHandle;
        for (const part of pathParts) {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }

        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (err) {
        console.error(`Error writing to local file ${fullPath}:`, err);
        errorHandler.showError({ name: "FileWriteError", message: `Could not write to file: ${err.message}` });
        throw err; // Re-throw so the caller knows it failed
    }
}
// --- ENDFILE: js/fileSystem.js --- //