// --- FILE: diranalyze/js/fileEditor.js --- //
import { appState, elements, resetUIForProcessing, enableUIControls } from './main.js';
import * as fileSystem from './fileSystem.js';
import * as notificationSystem from './notificationSystem.js';
import * as errorHandler from './errorHandler.js';
import { getFileExtension } from './utils.js'; // For CodeMirror mode detection

const editedFiles = new Map(); // Stores { path: { content: "...", originalContent: "...", savedInSession: false, isPatched: false } }

// Function to get CodeMirror mode based on file extension
function getCodeMirrorMode(filePath) {
    const extension = getFileExtension(filePath);
    switch (extension) {
        case '.js': case '.mjs': case '.json': return { name: "javascript", json: extension === '.json' };
        case '.ts': case '.tsx': return "text/typescript";
        case '.css': return "text/css";
        case '.html': case '.htm': case '.xml': return "htmlmixed"; // Ensure xml is handled by htmlmixed or xml mode directly
        case '.md': return "text/markdown";
        case '.py': return "text/x-python";
        case '.java': return "text/x-java";
        case '.c': case '.h': case '.cpp': case '.hpp': return "text/x-c++src"; // For C and C++
        case '.cs': return "text/x-csharp"; // For C#
        // Add more language modes as needed
        default: return "text/plain"; // Fallback for unknown types
    }
}

export function initFileEditor() {
    if (elements.saveEditorBtn) {
        elements.saveEditorBtn.addEventListener('click', saveCurrentFile);
    }
    if (elements.closeEditorBtn) {
        elements.closeEditorBtn.addEventListener('click', closeEditor);
    }
     console.log("File Editor Initialized.");
}

export async function openFileInEditor(fileData) {
    if (appState.isLoadingFileContent) return;
    appState.isLoadingFileContent = true;
    setEditorStatus('loading');

    try {
        const filePath = fileData.path;
        let contentToLoad;
        let originalContentForComparison;

        if (editedFiles.has(filePath)) {
            contentToLoad = editedFiles.get(filePath).content;
            originalContentForComparison = editedFiles.get(filePath).originalContent;
        } else {
            if (!fileData.entryHandle) {
                // This might be a newly created (scaffolded) file not yet saved to an entryHandle
                // Or an error state. For now, assume it's new and has no original disk content.
                // This case should be handled carefully if we allow opening "virtual" files.
                // For the debriefing context, this file likely doesn't exist on disk if no entryHandle.
                setEditorStatus('error', `File ${filePath} has no handle and is not cached.`);
                notificationSystem.showNotification(`Error: Cannot open ${filePath}. No file handle and not in cache.`, {duration: 3000});
                appState.isLoadingFileContent = false;
                return;
            }
            contentToLoad = await fileSystem.readFileContent(fileData.entryHandle, filePath, true); // force original for first load
            originalContentForComparison = contentToLoad;
            editedFiles.set(filePath, { 
                content: contentToLoad, 
                originalContent: originalContentForComparison, 
                savedInSession: true, // Mark as "saved" initially as it matches disk
                isPatched: false 
            });
        }
        
        appState.currentEditingFile = { ...fileData, originalContent: originalContentForComparison };

        if (!appState.editorInstance) {
            appState.editorInstance = CodeMirror(elements.editorContent, {
                value: contentToLoad,
                mode: getCodeMirrorMode(filePath),
                lineNumbers: true,
                theme: "material-darker",
                autoCloseBrackets: true,
                matchBrackets: true,
                styleActiveLine: true,
                lineWrapping: true,
            });
            appState.editorInstance.on("change", handleEditorChange);
        } else {
            appState.editorInstance.off("change", handleEditorChange); // Remove old listener
            appState.editorInstance.setValue(contentToLoad);
            appState.editorInstance.setOption("mode", getCodeMirrorMode(filePath));
            appState.editorInstance.on("change", handleEditorChange); // Add new listener
        }

        elements.editorFileTitle.textContent = `EDITING: ${filePath}`;
        
        // Determine status after loading
        const currentFileState = editedFiles.get(filePath);
        if (currentFileState.savedInSession) {
            setEditorStatus(currentFileState.isPatched ? 'patched_saved' : 'saved');
        } else {
            setEditorStatus('unsaved'); // Should be unsaved if content differs or not savedInSession
        }

        if (elements.editorInfo) {
            elements.editorInfo.textContent = `Size: ${utils.formatBytes(contentToLoad.length)} | Mode: ${appState.editorInstance.getOption("mode").name || appState.editorInstance.getOption("mode")}`;
        }

        // Switch view to editor
        if (elements.mainViewTabs && elements.tabContentArea && elements.fileEditor) {
            appState.previousActiveTabId = appState.activeTabId;
            elements.mainViewTabs.style.display = 'none';
            elements.tabContentArea.style.display = 'none';
            elements.fileEditor.style.display = 'flex';
            appState.editorActiveAsMainView = true;
        }
        setTimeout(() => appState.editorInstance.refresh(), 10);


    } catch (err) {
        console.error(`Error opening file ${fileData.path}:`, err);
        setEditorStatus('error', `Error: ${err.message}`);
        errorHandler.showError({
            name: err.name || "FileOpenError",
            message: `Failed to open file: ${fileData.path}. ${err.message}`,
            stack: err.stack,
            cause: err
        });
    } finally {
        appState.isLoadingFileContent = false;
    }
}

function handleEditorChange(cmInstance) {
    if (!appState.currentEditingFile) return;
    const filePath = appState.currentEditingFile.path;
    const newContent = cmInstance.getValue();
    const fileState = editedFiles.get(filePath);

    if (fileState) {
        fileState.content = newContent;
        fileState.savedInSession = false; // Mark as unsaved due to change
        editedFiles.set(filePath, fileState);
    } else {
        // This case should ideally not happen if openFileInEditor initializes the map entry
        editedFiles.set(filePath, {
            content: newContent,
            originalContent: appState.currentEditingFile.originalContent, // Stored during open
            savedInSession: false,
            isPatched: false
        });
    }
    setEditorStatus('unsaved');
}

export function saveCurrentFile() {
    if (!appState.currentEditingFile || !appState.editorInstance) return;

    const filePath = appState.currentEditingFile.path;
    const currentContent = appState.editorInstance.getValue();
    
    const fileState = editedFiles.get(filePath);
    if (fileState) {
        fileState.content = currentContent;
        fileState.savedInSession = true; 
        // Note: 'isPatched' status is preserved. Saving doesn't unpatch.
        // 'originalContent' remains the content from the disk when first loaded or last 'true' save.
        editedFiles.set(filePath, fileState);
        setEditorStatus(fileState.isPatched ? 'patched_saved' : 'saved');
        notificationSystem.showNotification(`${filePath} saved (in browser session).`);
    } else {
        // Should not happen
        errorHandler.showError({name: "SaveError", message: `No file state found for ${filePath} during save.`});
    }
}

export function closeEditor() {
    if (elements.mainViewTabs && elements.tabContentArea && elements.fileEditor) {
        elements.fileEditor.style.display = 'none';
        elements.mainViewTabs.style.display = 'flex';
        elements.tabContentArea.style.display = 'flex';
        appState.editorActiveAsMainView = false;
        
        if (appState.previousActiveTabId) {
            uiManager.activateTab(appState.previousActiveTabId);
            appState.previousActiveTabId = null;
        } else {
            uiManager.activateTab('textReportTab'); // Default fallback
        }
        
        // Potentially refresh UI if closing editor might affect other views
        if (typeof uiManager.refreshAllUI === 'function') {
            uiManager.refreshAllUI();
        }
    }
    appState.currentEditingFile = null;
    // Do not clear editorInstance.setValue('') here, as it might be slow if editor is complex.
    // It will be repopulated on next open.
}

export function setEditorStatus(statusKey, message = '') {
    if (!elements.editorStatus) return;
    const statusMap = {
        'saved': { text: 'SAVED (In Session)', class: 'status-saved' },
        'patched_saved': { text: 'PATCHED & SAVED', class: 'status-saved' },
        'unsaved': { text: 'UNSAVED CHANGES', class: 'status-unsaved' },
        'loading': { text: 'LOADING...', class: 'status-loading' },
        'error': { text: message || 'ERROR', class: 'status-error' },
        'unchanged': { text: 'NO CHANGES', class: 'status-unchanged' }
    };
    elements.editorStatus.className = 'editor-status'; // Reset classes
    if (statusMap[statusKey]) {
        elements.editorStatus.textContent = statusMap[statusKey].text;
        elements.editorStatus.classList.add(statusMap[statusKey].class);
    } else {
        elements.editorStatus.textContent = message || statusKey;
    }
}


// --- Functions for external modules to query/update edited content ---
export function hasEditedContent(filePath) {
    const fileState = editedFiles.get(filePath);
    // Considered "edited" if it's in the map and not marked as 'savedInSession'
    // OR if its content differs from its originalContent (more robust for unsaved state)
    return fileState ? (!fileState.savedInSession || fileState.content !== fileState.originalContent) : false;
}

export function getEditedContent(filePath) {
    return editedFiles.get(filePath)?.content;
}

export function isPatched(filePath) {
    return editedFiles.get(filePath)?.isPatched || false;
}

export function updateFileInEditorCache(filePath, newContent, originalContentIfKnown, isPatchedStatus = false) {
    editedFiles.set(filePath, {
        content: newContent,
        originalContent: originalContentIfKnown !== undefined ? originalContentIfKnown : (editedFiles.get(filePath)?.originalContent || newContent),
        savedInSession: false, // Marking as unsaved since content is updated externally
        isPatched: isPatchedStatus
    });

    // If this file is currently open in the editor, update the editor instance
    if (appState.currentEditingFile && appState.currentEditingFile.path === filePath && appState.editorInstance) {
        const cursorPos = appState.editorInstance.getCursor();
        appState.editorInstance.setValue(newContent);
        appState.editorInstance.setCursor(cursorPos); // Try to restore cursor
        setEditorStatus(isPatchedStatus ? 'patched_saved' : 'unsaved'); // Reflect patched status
    }
}

export function getAllEditedFiles() {
    return editedFiles; // Expose the map for modules like main.js (reset) or zipManager
}

// When a project is cleared, clear the editor cache
export function clearEditedFilesCache() {
    editedFiles.clear();
    if (appState.editorInstance && appState.currentEditingFile) {
        // If editor was active, best to close it or reset its state
        // For simplicity, if project clears, we can simulate closing the editor
        //elements.editorFileTitle.textContent = "FILE EDITOR";
        //appState.editorInstance.setValue("");
        //setEditorStatus('unchanged');
    }
    // appState.currentEditingFile = null; // Done in main.js reset usually
}
// --- ENDFILE: js/fileEditor.js --- //