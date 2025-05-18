// --- FILE: js/fileEditor.js --- //
import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import { getFileExtension } from './utils.js';
import * as uiManager from 'uiManager'; // Import uiManager

const editedFiles = new Map();
let cmOnChangeHandler = null;

function getCodeMirrorMode(filePath) {
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
        default: return "text/plain";
    }
}

export function initFileEditor() {
    if (typeof CodeMirror !== 'undefined') {
        appState.editorInstance = CodeMirror(elements.editorContent, {
            lineNumbers: true,
            theme: "material-darker",
            mode: "text/plain",
            gutters: ["CodeMirror-linenumbers"],
            autoCloseBrackets: true,
            matchBrackets: true,
            styleActiveLine: true,
        });

        cmOnChangeHandler = (cmInstance, changeObj) => {
            if (changeObj.origin === 'setValue' && appState.isLoadingFileContent) {
                return;
            }
            if (appState.currentEditingFile) {
                const fileState = editedFiles.get(appState.currentEditingFile.path) || { content: '', isPatched: false, savedInSession: false };
                editedFiles.set(appState.currentEditingFile.path, {
                    ...fileState,
                    content: cmInstance.getValue(),
                    savedInSession: false
                });
                setEditorStatus('unsaved');
            }
        };

        appState.editorInstance.on('change', cmOnChangeHandler);
        appState.editorInstance.setOption("extraKeys", {
            "Ctrl-S": function(cm) { saveFileChanges(); },
            "Cmd-S": function(cm) { saveFileChanges(); }
        });

    } else {
        console.error("CodeMirror library not loaded. File editor will not function correctly.");
        elements.editorContent.textContent = "Error: Code editor library not loaded.";
    }

    elements.saveEditorBtn.addEventListener('click', saveFileChanges);
    elements.closeEditorBtn.addEventListener('click', closeEditor);
}

export async function openFileInEditor(file) {
    console.log(`[FileEditor] Attempting to open: ${file.path}, Type: ${file.entryHandle ? 'Existing File' : 'New/Virtual File'}`);
    appState.isLoadingFileContent = true;

    try {
        // Store previous tab and hide tab view
        if (!appState.editorActiveAsMainView) { // Only store if not already in editor view
            appState.previousActiveTabId = appState.activeTabId;
        }
        appState.editorActiveAsMainView = true;
        if (elements.mainViewTabs) elements.mainViewTabs.style.display = 'none';
        if (elements.tabContentArea) elements.tabContentArea.style.display = 'none';
        if (elements.fileEditor) elements.fileEditor.style.display = 'flex';


        appState.currentEditingFile = file;
        setEditorStatus('loading');
        elements.editorFileTitle.textContent = `EDITING: ${file.name}`;
        elements.editorInfo.textContent = `Path: ${file.path}`;
        // elements.fileEditor.style.display = 'flex'; // Already handled above

        if (appState.editorInstance) {
            appState.editorInstance.setValue('Loading file...');
        } else {
            elements.editorContent.textContent = 'Loading file...';
        }

        let contentToLoad = "// Content not loaded //";
        let statusToSet = 'error';

        if (editedFiles.has(file.path)) {
            const fileState = editedFiles.get(file.path);
            contentToLoad = fileState.content;
            if (fileState.savedInSession) {
                statusToSet = fileState.isPatched ? 'patched_saved' : 'saved';
            } else {
                if (file.entryHandle) {
                    const originalContent = await fileSystem.readFileContent(file.entryHandle, file.path, true);
                    if (contentToLoad === originalContent && !fileState.isPatched) {
                        statusToSet = 'unchanged';
                    } else {
                        statusToSet = fileState.isPatched ? 'patched_unsaved' : 'unsaved';
                    }
                } else {
                    statusToSet = fileState.isPatched ? 'patched_unsaved' : 'unsaved';
                }
            }
        } else if (file.entryHandle) {
            contentToLoad = await fileSystem.readFileContent(file.entryHandle, file.path, true);
            editedFiles.set(file.path, {
                content: contentToLoad,
                isPatched: false,
                savedInSession: false
            });
            statusToSet = 'unchanged';
        } else {
            contentToLoad = `// Error: Could not load content for new file ${file.path}.`;
            statusToSet = 'error';
            errorHandler.showError({
                name: "FileOpenConsistencyError",
                message: `Could not load content for ${file.path}. New file missing.`
            });
        }

        if (appState.editorInstance) {
            appState.editorInstance.setValue(contentToLoad || "// Error: Content empty.");
            const mode = getCodeMirrorMode(file.path);
            appState.editorInstance.setOption("mode", mode);
            setTimeout(() => {
                if (elements.fileEditor.style.display === 'flex' && appState.editorInstance) {
                    appState.editorInstance.refresh();
                    appState.editorInstance.focus();
                }
            }, 50); // Adjusted timeout for safety
        }
        setEditorStatus(statusToSet);

    } catch (err) {
        console.error(`[FileEditor] Error in openFileInEditor for '${file.path}':`, err);
        setEditorStatus('error', err.message);
        if (appState.editorInstance) appState.editorInstance.setValue(`Error loading file: ${err.message}`);
        errorHandler.showError({
            name: err.name || "FileOpenError",
            message: `Failed to open file: ${file.name || file.path}. ${err.message}`,
            stack: err.stack, cause: err, path: file.path
        });
        // If opening fails critically, restore tab view
        closeEditor();
    } finally {
        appState.isLoadingFileContent = false;
    }
}


function saveFileChanges() {
    if (!appState.currentEditingFile || !appState.editorInstance) return;

    const filePath = appState.currentEditingFile.path;
    const currentEditorContent = appState.editorInstance.getValue();

    const fileState = editedFiles.get(filePath) || { isPatched: false };
    editedFiles.set(filePath, {
        content: currentEditorContent,
        isPatched: fileState.isPatched,
        savedInSession: true
    });

    setEditorStatus(fileState.isPatched ? 'patched_saved' : 'saved');
    notificationSystem.showNotification(`Changes for ${appState.currentEditingFile.name} confirmed in browser memory.`);
}

function closeEditor() {
    if (elements.fileEditor) elements.fileEditor.style.display = 'none';
    if (appState.editorInstance) appState.editorInstance.setValue(''); // Clear editor content

    appState.currentEditingFile = null;
    appState.editorActiveAsMainView = false;

    // Restore tab view
    if (elements.mainViewTabs) elements.mainViewTabs.style.display = 'flex';
    if (elements.tabContentArea) elements.tabContentArea.style.display = 'flex'; // Re-show the container

    // Activate the previously active tab, or default to textReportTab
    uiManager.activateTab(appState.previousActiveTabId || 'textReportTab');
    appState.previousActiveTabId = null; // Clear stored previous tab
}

export function setEditorStatus(statusKey, message = '') {
    const statusEl = elements.editorStatus;
    statusEl.className = 'editor-status'; // Reset classes

    let textContent = '';
    let disableSave = true;

    switch (statusKey) {
        case 'loading': textContent = 'LOADING...'; statusEl.classList.add(`status-loading`); break;
        case 'unchanged': textContent = 'UNCHANGED'; statusEl.classList.add(`status-unchanged`); disableSave = true; break;
        case 'unsaved':
            const currentFile = appState.currentEditingFile ? editedFiles.get(appState.currentEditingFile.path) : null;
            textContent = (currentFile && currentFile.isPatched && !currentFile.savedInSession) ? 'PATCHED (Unsaved)' : 'UNSAVED (Manual)';
            statusEl.classList.add(`status-unsaved`); disableSave = false; break;
        case 'saved': textContent = 'SAVED (Manual)'; statusEl.classList.add(`status-saved`); disableSave = true; break;
        case 'patched_unsaved': textContent = 'PATCHED (Unsaved)'; statusEl.classList.add(`status-unsaved`); disableSave = false; break;
        case 'patched_saved': textContent = 'PATCHED (Saved)'; statusEl.classList.add(`status-saved`); disableSave = true; break;
        case 'error': textContent = `ERROR: ${message}`; statusEl.classList.add(`status-error`); break;
        default: textContent = statusKey;
    }
    statusEl.textContent = textContent;
    elements.saveEditorBtn.disabled = disableSave;
}

export function hasEditedContent(filePath) {
    return editedFiles.has(filePath);
}

export function getEditedContent(filePath) {
    return editedFiles.get(filePath)?.content;
}

export function getAllEditedFiles() {
    return editedFiles;
}

export function setEditedContent(filePath, content, wasPatched = false) {
    const existingState = editedFiles.get(filePath) || {};
    editedFiles.set(filePath, {
        content: content,
        isPatched: existingState.isPatched || wasPatched,
        savedInSession: false // New content or patch means it's unsaved relative to this action
    });

    // If this file is currently being edited, update the live editor instance
    if (appState.currentEditingFile && appState.currentEditingFile.path === filePath && appState.editorInstance) {
        appState.isLoadingFileContent = true; // Prevent CM change handler during this setValue
        appState.editorInstance.setValue(content);
        appState.editorInstance.setOption("mode", getCodeMirrorMode(filePath));
        appState.isLoadingFileContent = false;
        setEditorStatus(wasPatched ? 'patched_unsaved' : 'unsaved'); // Reflect new state
    }
}

export function isPatched(filePath) {
    return editedFiles.get(filePath)?.isPatched || false;
}
// --- ENDFILE: js/fileEditor.js --- //