import { appState, elements } from './main.js';
import * as fileSystem from 'fileSystem';
import { formatBytes, isLikelyTextFile } from './utils.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';

// Update the list display in combine mode
export function updateCombineModeListDisplay() {
    elements.selectedFilesContainer.innerHTML = '';
    const filesToDisplay = (appState.selectionCommitted && appState.committedScanData)
        ? appState.committedScanData.allFilesList
        : [];

    if (filesToDisplay.length === 0) {
        elements.selectedFilesContainer.innerHTML = `<div class="empty-notice">${appState.selectionCommitted ? 'NO FILES IN COMMITTED SELECTION.' : 'COMMIT SELECTIONS TO POPULATE THIS LIST.'}</div>`;
        elements.copySelectedBtn.disabled = true;
        return;
    }

    // Count text files for button state
    const textFileCount = filesToDisplay.filter(file => isLikelyTextFile(file.path)).length;
    elements.copySelectedBtn.disabled = textFileCount === 0;

    filesToDisplay.forEach(file => {
        const div = document.createElement('div');
        div.className = 'selected-file';
        const isTextFile = isLikelyTextFile(file.path);

        if (!isTextFile) {
            div.classList.add('binary-file');
        }

        div.innerHTML = `
            <div class="selected-file-name">${file.path} (${formatBytes(file.size)})${!isTextFile ? ' <span class="binary-badge" title="Binary file - will be skipped when combining">BINARY</span>' : ''}</div>
            <div class="selected-file-actions">
                ${isTextFile ? '<span class="edit-btn" title="Edit file">✏️</span>' : ''}
                <span class="preview-btn" title="Preview">👁️</span>
            </div>
        `;

        // Add event listeners
        if (isTextFile) {
            div.querySelector('.edit-btn').addEventListener('click', () => fileEditor.openFileInEditor(file));
        }
        div.querySelector('.preview-btn').addEventListener('click', () => fileSystem.previewFile(file.entryHandle, file.path));

        elements.selectedFilesContainer.appendChild(div);
    });

    // Show summary of binary files if any are present
    const binaryFileCount = filesToDisplay.length - textFileCount;
    if (binaryFileCount > 0 && textFileCount > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'binary-summary';
        summaryDiv.textContent = `Note: ${binaryFileCount} binary files (images, media, etc.) will be skipped when combining.`;
        elements.selectedFilesContainer.appendChild(summaryDiv);
    } else if (binaryFileCount > 0 && textFileCount === 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'binary-summary warning';
        summaryDiv.textContent = `Warning: All ${binaryFileCount} selected files are binary (images, media, etc.) and cannot be combined.`;
        elements.selectedFilesContainer.appendChild(summaryDiv);
    }
}

// Trigger browser download for a text string
function triggerTextFileDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Combine selected text files and trigger a download
export async function copySelectedFiles() { // Function name remains for wiring, behavior changes
    const filesToProcess = (appState.selectionCommitted && appState.committedScanData)
        ? appState.committedScanData.allFilesList
        : [];

    if (filesToProcess.length === 0) {
        notificationSystem.showNotification('No files in the committed selection to process.');
        return;
    }

    // Filter to only include text files
    const textFiles = filesToProcess.filter(file => isLikelyTextFile(file.path));
    const skippedCount = filesToProcess.length - textFiles.length;

    if (textFiles.length === 0) {
        notificationSystem.showNotification('No text files found in selection. Binary files were skipped.');
        return;
    }

    let combined = `// COMBINED CONTENT (${textFiles.length} files) - ${new Date().toISOString()}\n`;
    if (skippedCount > 0) {
        combined += `// NOTE: ${skippedCount} binary files were skipped (images, videos, etc.)\n`;
    }
    combined += `\n`;

    elements.loader.classList.add('visible');
    elements.loader.textContent = `PREPARING ${textFiles.length} FILES FOR DOWNLOAD...`;

    try {
        for (const file of textFiles) {
            try {
                let content;
                let sourceInfo = "";
                if (fileEditor.hasEditedContent(file.path)) {
                    content = fileEditor.getEditedContent(file.path);
                    sourceInfo = fileEditor.isPatched(file.path) ? "(EDITED & PATCHED)" : "(EDITED)";
                } else {
                    content = await fileSystem.readFileContent(file.entryHandle, file.path); // Pass path for consistency
                }
                combined += `// ===== FILE: ${file.path} ${sourceInfo} ===== //\n${content}\n// ===== END ${file.path} ===== //\n\n`;
            } catch (e) {
                combined += `// ERROR reading ${file.path}: ${e.message}\n\n`;
                 console.error(`Error reading content for ${file.path} during combine:`, e);
            }
        }

        const rootDirName = appState.fullScanData?.directoryData?.name || 'combined_files';
        const filename = `${rootDirName}_codebase.txt`;

        triggerTextFileDownload(combined, filename);
        notificationSystem.showNotification(`Combined ${textFiles.length} text files downloaded as ${filename}${skippedCount > 0 ? ` (${skippedCount} binary files skipped)` : ''}!`);

    } catch (e) {
        console.error('Combine and download process failed:', e);
        errorHandler.showError({
            name: "CombineDownloadError",
            message: "Failed to combine and download files.",
            stack: e.stack,
            cause: e
        });
        notificationSystem.showNotification('Error during file combination for download. See console/error report.', { duration: 4000 });
    } finally {
        elements.loader.classList.remove('visible');
        elements.loader.textContent = 'ANALYSING...'; // Reset loader text
    }
}