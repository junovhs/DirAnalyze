// --- FILE: diranalyze/js/aiPatcher.js --- //
import * as fileSystem from 'fileSystem';
import * as fileEditor from 'fileEditor';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as utils from 'utils';
import * as treeView from 'treeView';
import { DMP } from './lib-wrappers/dmp-wrapper.js';
import { appState } from './main.js';

let _elements;

let patchQueue = [];
let currentPatchBeingReviewed = null;

// *** THIS IS THE CORRECTED, FULL TEMPLATE ***
const CAPCA_PROMPT_TEMPLATE = `
You are an AI code assistant. Your goal is to help me modify my project files by generating a JSON array of "Contextual Anchor Patching and Creation Array" (CAPCA) operations.

If you have already been debriefed on the project's structure and content, use that knowledge. If I provide specific file content now, use that as the most current version for the given file.

Generate CAPCA JSON based on my change request.

Supported CAPCA operations:
- {"file": "path/to/file.ext", "operation": "create_file_with_content", "newText": "content..."}
- {"file": "path/to/file.ext", "operation": "replace_segment_after_anchor", "anchorText": "anchor...", "segmentToAffect": "old_text...", "newText": "new_text...", "originalLineOfAnchor": <line_num_optional>}
- {"file": "path/to/file.ext", "operation": "insert_text_after_anchor", "anchorText": "anchor...", "newText": "text_to_insert...", "originalLineOfAnchor": <line_num_optional>}
- {"file": "path/to/file.ext", "operation": "delete_segment_after_anchor", "anchorText": "anchor...", "segmentToAffect": "text_to_delete...", "originalLineOfAnchor": <line_num_optional>}

Key guidelines:
- 'filePath' is always project-relative.
- Use concise but unique 'anchorText'.
- 'segmentToAffect' must be exact. For "replace" with empty "segmentToAffect", it acts as an insert.
- Ensure newlines are '\\n'.

My Change Request:
[USER: PASTE YOUR DETAILED CHANGE REQUEST HERE, REFERENCING FILE PATHS AS NEEDED. IF PROVIDING CURRENT FILE CONTENT FOR A SPECIFIC FILE, CLEARLY INDICATE IT.]

Your CAPCA JSON response (provide ONLY the JSON array):
`;


async function triggerSubsequentSnapshot(description) {
    if (!appState.currentVersionId) {
        notificationSystem.showNotification("Cannot create new version: No parent version ID available.", { duration: 3500 });
        console.error("Attempted to create subsequent snapshot, but appState.currentVersionId is null.");
        return;
    }

    if (!appState.fullScanData) {
        notificationSystem.showNotification("Cannot create new version: No project data loaded.", { duration: 3500 });
        return;
    }

    if (_elements.loader) {
        _elements.loader.textContent = `Creating new version: ${description}...`;
        _elements.loader.classList.add('visible');
    }

    try {
        const encoder = new TextEncoder();
        const filePromises = appState.fullScanData.allFilesList.map(async (fileInfo) => {
            try {
                const content = await fileSystem.readFileContent(fileInfo.entryHandle, fileInfo.path, false);
                
                let buffer;
                if (typeof content === 'string') {
                    buffer = encoder.encode(content);
                } else if (content instanceof Blob) {
                    buffer = await content.arrayBuffer();
                } else if (content instanceof ArrayBuffer) {
                    buffer = content;
                } else {
                     console.warn(`Could not determine content type for hashing file ${fileInfo.path}, skipping hash.`);
                     return { path: fileInfo.path, hash: 'unknown_content_type', size: fileInfo.size };
                }

                const hash = await utils.calculateSHA256(buffer);
                return { path: fileInfo.path, hash: hash, size: buffer.byteLength };

            } catch (error) {
                console.error(`Could not process file for new snapshot: ${fileInfo.path}`, error);
                return null;
            }
        });

        const updatedFiles = (await Promise.all(filePromises)).filter(f => f !== null);

        const snapshotPayload = {
            parent_version_id: appState.currentVersionId,
            description: description,
            files: updatedFiles,
        };

        const response = await fetch('/api/snapshot/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshotPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend snapshot creation failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        appState.currentVersionId = result.version_id;
        notificationSystem.showNotification(`New version saved! Version ID: ${result.version_id}`, { duration: 4000 });
        console.log("Subsequent snapshot created:", result);

    } catch (error) {
        errorHandler.showError({ name: "SnapshotError", message: `Failed to create subsequent project snapshot: ${error.message}`, stack: error.stack });
    } finally {
        if (_elements.loader) {
            _elements.loader.classList.remove('visible');
            _elements.loader.textContent = 'ANALYSING...';
        }
    }
}


function parsePatchInstructions(patchJsonString) {
    try {
        const patches = JSON.parse(patchJsonString);
        if (!Array.isArray(patches)) {
            throw new Error("Patch instructions should be a JSON array.");
        }
        patches.forEach(op => {
            if (typeof op.file !== 'string' || typeof op.operation !== 'string') {
                throw new Error("Each patch must have 'file' and 'operation' string properties.");
            }
            switch (op.operation) {
                case 'create_file_with_content':
                    if (typeof op.newText !== 'string') {
                        throw new Error("'create_file_with_content' operation requires 'newText' property.");
                    }
                    break;
                case 'replace_segment_after_anchor':
                case 'insert_text_after_anchor':
                case 'delete_segment_after_anchor':
                    if (typeof op.anchorText !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'anchorText'.`);
                    }
                    if (op.operation !== 'insert_text_after_anchor' && typeof op.segmentToAffect !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'segmentToAffect'.`);
                    }
                    if (op.operation !== 'delete_segment_after_anchor' && typeof op.newText !== 'string' && op.operation !== 'replace_segment_after_anchor' ) {
                        if (op.operation === 'replace_segment_after_anchor' && op.segmentToAffect === '' && typeof op.newText !== 'string') {
                             throw new Error(`Operation '${op.operation}' with empty segmentToAffect requires 'newText'.`);
                        } else if (op.operation !== 'replace_segment_after_anchor') {
                             throw new Error(`Operation '${op.operation}' requires 'newText'.`);
                        }
                    }
                    break;
                default:
                    break; // Allow other operations, they just won't be processed by calculateProposedChange
            }
        });
        return patches;
    } catch (error) {
        console.error("Error parsing CAPCA patch JSON:", error);
        errorHandler.showError({
            name: "PatchParseError", message: `Invalid CAPCA patch JSON: ${error.message}`, stack: error.stack
        });
        return null;
    }
}

function findRobustAnchorIndex(content, anchorText, originalLineHint = 1, windowLines = 10) {
    if (!anchorText || anchorText.length === 0) return 0;
    const normalizedContent = content.replace(/\r\n/g, "\n");
    const normalizedAnchorText = anchorText.replace(/\r\n/g, "\n");
    const contentLines = normalizedContent.split('\n');
    const anchorLines = normalizedAnchorText.split('\n');
    const firstAnchorLine = anchorLines[0];
    const hintLineIndex = originalLineHint > 0 ? originalLineHint - 1 : 0;

    const searchStartLine = Math.max(0, hintLineIndex - windowLines);
    const searchEndLine = Math.min(contentLines.length - anchorLines.length + 1, hintLineIndex + windowLines + 1);

    for (let i = searchStartLine; i < searchEndLine; i++) {
        if (contentLines[i] !== undefined && contentLines[i].includes(firstAnchorLine)) {
            if (anchorLines.length === 1) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
            let fullMatch = true;
            for (let j = 1; j < anchorLines.length; j++) {
                if ((i + j) >= contentLines.length || contentLines[i + j] !== anchorLines[j]) {
                    fullMatch = false;
                    break;
                }
            }
            if (fullMatch) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
        }
    }
    const globalIndex = normalizedContent.indexOf(normalizedAnchorText);
    return globalIndex;
}

async function calculateProposedChange(filePath, patchOp, currentBatchFileStates = new Map()) {
    let rawOriginalContent = "";
    let contentToProcess = "";
    let isNewFile = false;
    let logEntry = "";
    const basePathForState = filePath;

    if (patchOp.operation === 'create_file_with_content') {
        const existingFile = appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (existingFile || currentBatchFileStates.has(basePathForState)) {
            return { success: false, log: `  - Op: create_file. Error: File '${basePathForState}' already exists (or was created in this batch).`, originalContent: "", patchedContent: "" };
        }
        isNewFile = true;
        const normalizedNewText = patchOp.newText.replace(/\r\n/g, "\n");
        logEntry = `  - Op: create_file. Proposed content for new file '${basePathForState}'.`;
        const proposed = { success: true, log: logEntry, originalContent: "", patchedContent: normalizedNewText, isNewFile };
        currentBatchFileStates.set(basePathForState, proposed.patchedContent);
        return proposed;
    }

    if (currentBatchFileStates.has(basePathForState)) {
        contentToProcess = currentBatchFileStates.get(basePathForState);
        rawOriginalContent = contentToProcess; // For diff, use this potentially modified version
    } else if (fileEditor.getEditedContent(basePathForState) !== undefined) {
        rawOriginalContent = fileEditor.getEditedContent(basePathForState);
        contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
    } else {
        const fileData = appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (!fileData) {
            return { success: false, log: `  - Op: ${patchOp.operation}. Error: File '${basePathForState}' not found in project scan.`, originalContent: "", patchedContent: "" };
        }
        if (!fileData.entryHandle && !isNewFile) {
            return { success: false, log: `  - Op: ${patchOp.operation}. Error: No file handle for existing file '${basePathForState}' (likely scaffolded, not saved).`, originalContent: "", patchedContent: "" };
        }
        try {
            rawOriginalContent = await fileSystem.readFileContent(fileData.entryHandle, basePathForState);
            contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
        } catch (e) {
            return { success: false, log: `  - Error reading original content for '${basePathForState}': ${e.message}`, originalContent: "", patchedContent: "" };
        }
    }

    const originalContentForDiff = contentToProcess; // Base for diff is the current state
    let proposedContentNormalized = contentToProcess; // Start with current content

    const normalizedAnchorText = patchOp.anchorText.replace(/\r\n/g, "\n");
    const normalizedSegmentToAffect = patchOp.segmentToAffect ? patchOp.segmentToAffect.replace(/\r\n/g, "\n") : "";
    const normalizedNewText = patchOp.newText ? patchOp.newText.replace(/\r\n/g, "\n") : "";

    if (patchOp.operation === 'replace_segment_after_anchor' ||
        patchOp.operation === 'insert_text_after_anchor' ||
        patchOp.operation === 'delete_segment_after_anchor') {

        let anchorIndex = findRobustAnchorIndex(contentToProcess, normalizedAnchorText, patchOp.originalLineOfAnchor || 1);
        if (anchorIndex === -1) {
            logEntry = `  - Op: ${patchOp.operation}. Error: Anchor text "${shorten(normalizedAnchorText)}" not found in '${basePathForState}'.`;
            return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
        }
        const afterAnchorIndex = anchorIndex + normalizedAnchorText.length;

        if (patchOp.operation === 'insert_text_after_anchor') {
            proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                        normalizedNewText +
                                        contentToProcess.substring(afterAnchorIndex);
            logEntry = `  - Op: insert_text_after_anchor. Success: Inserted text after anchor "${shorten(normalizedAnchorText)}".`;
        } else { // replace or delete
            const segmentStartIndex = contentToProcess.indexOf(normalizedSegmentToAffect, afterAnchorIndex);
            const leniencyChars = patchOp.leniencyChars === undefined ? 5 : patchOp.leniencyChars;

            if (normalizedSegmentToAffect.length > 0 && (segmentStartIndex === -1 || segmentStartIndex > afterAnchorIndex + leniencyChars )) {
                const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                logEntry = `  - Op: ${patchOp.operation}. Error: Segment "${shorten(normalizedSegmentToAffect)}" not found sufficiently close after anchor "${shorten(normalizedAnchorText)}". Expected around index ${afterAnchorIndex} (within ${leniencyChars} chars), first match at ${segmentStartIndex}. Content after anchor: "${shorten(foundInstead, 40)}..."`;
                return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
            }

            if (patchOp.operation === 'replace_segment_after_anchor') {
                 if (normalizedSegmentToAffect.length === 0 && normalizedNewText.length > 0) { // Treat as insert
                    proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(afterAnchorIndex);
                    logEntry = `  - Op: replace_segment_after_anchor (as insert). Success: Inserted text as 'segmentToAffect' was empty.`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: replace_segment_after_anchor. Success: Replaced segment "${shorten(normalizedSegmentToAffect)}".`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) { // Segment not found after all
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead, 40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                 } else { // segmentToAffect and newText both empty
                    logEntry = `  - Op: replace_segment_after_anchor. Info: 'segmentToAffect' and 'newText' were empty. No change.`;
                 }
            } else if (patchOp.operation === 'delete_segment_after_anchor') {
                if (normalizedSegmentToAffect.length === 0) {
                    logEntry = `  - Op: delete_segment_after_anchor. Info: 'segmentToAffect' was empty, no change made.`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: delete_segment_after_anchor. Success: Deleted segment "${shorten(normalizedSegmentToAffect)}".`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) { // Segment not found
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead,40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                }
            }
        }
    } else {
        logEntry = `  - Op: ${patchOp.operation}. Error: Unknown CAPCA operation type for existing file.`;
        return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
    }

    if (proposedContentNormalized !== originalContentForDiff) {
        currentBatchFileStates.set(basePathForState, proposedContentNormalized);
    }
    return { success: true, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized, isNewFile: isNewFile };
}

function showNextPatchInModal() {
    if (patchQueue.length === 0) {
        _elements.aiPatchOutputLog.textContent += "\n\nAll patches reviewed.";
        notificationSystem.showNotification("All patches reviewed.", { duration: 3000 });
        currentPatchBeingReviewed = null;
        // Trigger snapshot AFTER the last patch is reviewed (handled in closeDiffModalAndProceed)
        return;
    }
    currentPatchBeingReviewed = patchQueue.shift();
    const { filePath, originalContent, patchedContent, patchOp, isNewFile } = currentPatchBeingReviewed;
    const dmp = new DMP();
    _elements.diffFilePath.textContent = `${filePath} (${patchOp.operation})`;

    if (isNewFile) {
        _elements.diffOutputContainer.innerHTML = `<p><b>PROPOSED NEW FILE CONTENT:</b></p><pre style="background:#e6ffe6; padding:5px;">${utils.escapeHtml(patchedContent)}</pre>`;
    } else {
        const diff = dmp.diff_main(originalContent, patchedContent);
        dmp.diff_cleanupSemantic(diff);
        _elements.diffOutputContainer.innerHTML = dmp.diff_prettyHtml(diff);
    }
    _elements.aiPatchDiffModal.style.display = 'flex';
}

async function closeDiffModalAndProceed(applyChange) {
    if (!currentPatchBeingReviewed) return;
    const { filePath, patchedContent, patchOp, isNewFile, log } = currentPatchBeingReviewed;

    if (applyChange) {
        try {
            if (!appState.directoryHandle && isNewFile) {
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Staged for new file - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Staged new file: ${filePath}`, { duration: 2000 });
            } else if (!appState.directoryHandle && !isNewFile) {
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Staged change for - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Staged change for: ${filePath}`, { duration: 2000 });
            } else if (appState.directoryHandle) { // Only write if a real directory is loaded
                await fileSystem.writeFileContent(appState.directoryHandle, filePath, patchedContent);
                _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Applied & Saved - ${filePath}\n  Details: ${log || "Content set."}\n`;
                notificationSystem.showNotification(`Applied and saved: ${filePath}`, { duration: 2000 });
            } else { // This case means it's a scaffolded project, no directoryHandle
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Applied to scaffold - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Applied to scaffold: ${filePath}`, { duration: 2000 });
            }


            if (isNewFile) {
                const newFileEntry = {
                    name: filePath.substring(filePath.lastIndexOf('/') + 1),
                    path: filePath,
                    type: 'file',
                    size: patchedContent.length,
                    extension: utils.getFileExtension(filePath),
                    depth: (filePath.split('/').length -1) - (appState.fullScanData.directoryData.path.split('/').length -1),
                    entryHandle: appState.directoryHandle ? await fileSystem.getFileHandleFromPath(appState.directoryHandle, filePath) : null // May be null for scaffold
                };

                if (appState.fullScanData) {
                    appState.fullScanData.allFilesList.push(newFileEntry);
                    if (typeof treeView.addFileToTree === 'function') {
                        treeView.addFileToTree(newFileEntry);
                    }
                }
            }
            fileEditor.updateFileInEditorCache(filePath, patchedContent, patchedContent, true);

        } catch (err) {
            notificationSystem.showNotification(`ERROR: Failed to process patch for ${filePath}. Patch not applied. See console.`, { duration: 4000 });
            console.error(`Error applying/saving patch for ${filePath}:`, err);
            // Don't immediately bail, let user decide on next patches
        }
    } else {
        _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Skipped - ${filePath} for operation ${patchOp.operation}.\n`;
    }

    _elements.aiPatchDiffModal.style.display = 'none';
    currentPatchBeingReviewed = null;

    if (patchQueue.length > 0) {
        showNextPatchInModal();
    } else {
        notificationSystem.showNotification("All patches reviewed. Creating new version...", { duration: 2000 });
        // Check if directoryHandle exists for "Applied AI patches to disk project"
        // vs "Applied AI patches to scaffolded project"
        let snapshotDescription = "Applied AI patches";
        if (appState.directoryHandle && appState.directoryHandle.name) {
            snapshotDescription += ` to ${appState.directoryHandle.name}`;
        } else if (appState.fullScanData && appState.fullScanData.directoryData && appState.fullScanData.directoryData.name) {
            snapshotDescription += ` to scaffolded project ${appState.fullScanData.directoryData.name}`;
        }
        await triggerSubsequentSnapshot(snapshotDescription);
    }
}

export async function processPatches(patchInstructions) {
    if (!patchInstructions || patchInstructions.length === 0) {
        _elements.aiPatchOutputLog.textContent = "No patch instructions provided."; return;
    }
    if (!appState.fullScanData || !appState.fullScanData.allFilesList) {
        _elements.aiPatchOutputLog.textContent = "Error: No project loaded or file list unavailable. Load a project first.";
        return;
    }
    _elements.aiPatchOutputLog.textContent = "Preparing patches for review...\n";
    patchQueue = [];
    let initialLog = "";
    let successfullyPreparedCount = 0;
    let currentBatchFileStates = new Map();

    for (const patchOp of patchInstructions) {
        const filePath = patchOp.file;
        const result = await calculateProposedChange(filePath, patchOp, currentBatchFileStates);
        initialLog += `\nFile: ${filePath} (${patchOp.operation})\n${result.log}\n`;
        if (result.success) {
            if (patchOp.operation === 'create_file_with_content' || result.originalContent !== result.patchedContent) {
                patchQueue.push({ ...result, filePath, patchOp });
                successfullyPreparedCount++;
            } else {
                 initialLog += "  - Info: No effective change proposed by this operation (content identical).\n";
            }
        }
    }
    _elements.aiPatchOutputLog.textContent = initialLog + `\n--- Prepared ${successfullyPreparedCount} patches for review. ---\n`;
    if (patchQueue.length > 0) {
        showNextPatchInModal();
    } else {
        notificationSystem.showNotification("No changes to review or all patches failed.", { duration: 4000 });
        // Even if no patches to review, if some succeeded but made no change, or some failed,
        // we might still want to snapshot the state if any initial calculations changed currentBatchFileStates.
        // For now, we only snapshot if there was something in the queue that got processed.
        // If needed, this else block could also call triggerSubsequentSnapshot with a relevant message.
    }
}

function shorten(text, maxLength = 30) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}


export function initAiPatcher(mainAppState, mainElements) {
    _elements = mainElements; // appState is now imported directly

    _elements.applyAiPatchBtn?.addEventListener('click', () => {
        const patchJson = _elements.aiPatchInput.value;
        if (!patchJson.trim()) {
            notificationSystem.showNotification("Patch input is empty.", {duration: 3000});
            _elements.aiPatchOutputLog.textContent = "Patch input empty.";
            return;
        }
        const parsedInstructions = parsePatchInstructions(patchJson);
        if (parsedInstructions) {
            processPatches(parsedInstructions);
        } else {
             _elements.aiPatchOutputLog.textContent = "Failed to parse CAPCA patches. Check format/errors.";
        }
    });
    _elements.closeAiPatchDiffModal?.addEventListener('click', () => closeDiffModalAndProceed(false));
    _elements.confirmApplyPatchChanges?.addEventListener('click', () => closeDiffModalAndProceed(true));
    _elements.skipPatchChanges?.addEventListener('click', () => closeDiffModalAndProceed(false));
    
    _elements.cancelAllPatchChanges?.addEventListener('click', async () => {
        const remainingCount = patchQueue.length + (currentPatchBeingReviewed ? 1 : 0);
        patchQueue = []; // Clear the queue
        _elements.aiPatchDiffModal.style.display = 'none';
        currentPatchBeingReviewed = null;
        if (remainingCount > 0) {
            _elements.aiPatchOutputLog.textContent += `\n\nUser ACTION: Cancelled ${remainingCount} remaining patches.\n`;
             // Snapshot the state *before* cancellation if any patches were already applied.
            let snapshotDescription = "Applied some patches";
             if (appState.directoryHandle && appState.directoryHandle.name) {
                snapshotDescription += ` to ${appState.directoryHandle.name}`;
            } else if (appState.fullScanData && appState.fullScanData.directoryData && appState.fullScanData.directoryData.name) {
                snapshotDescription += ` to scaffolded project ${appState.fullScanData.directoryData.name}`;
            }
             snapshotDescription += ` and cancelled ${remainingCount} operations.`;
            await triggerSubsequentSnapshot(snapshotDescription);
        } else {
            _elements.aiPatchOutputLog.textContent += `\n\nUser ACTION: No patches to cancel.\n`;
        }
    });
    
    _elements.copyPatchPromptBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(CAPCA_PROMPT_TEMPLATE.trim())
            .then(() => notificationSystem.showNotification("CAPCA Patch Prompt copied to clipboard!", { duration: 3000 }))
            .catch(err => {
                console.error("Failed to copy patch prompt:", err);
                notificationSystem.showNotification("Error copying prompt. See console.", { duration: 3000 });
            });
    });
}
// --- ENDFILE: diranalyze/js/aiPatcher.js --- //