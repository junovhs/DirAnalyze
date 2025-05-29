// --- FILE: diranalyze/js/aiDebriefingAssistant.js --- //
import { elements, appState } from './main.js';
import * as notificationSystem from './notificationSystem.js';
import * as uiManager from './uiManager.js';
import * as fileSystem from './fileSystem.js';
import * as reportGenerator from './reportGenerator.js';
import * as combineMode from './combineMode.js';
import * as utils from './utils.js';
import * as fileEditor from './fileEditor.js';

let currentProjectName = '';
let standardProfileActive = false; // Module-level state for standard profile

function showModal() {
    if (!appState.fullScanData || !appState.fullScanData.directoryData) {
        notificationSystem.showNotification("Please load a project first.", { duration: 3000 });
        return;
    }
    currentProjectName = appState.fullScanData.directoryData.name;
    standardProfileActive = false; // Reset on modal open

    if (elements.aiDebriefingAssistantModal) {
        const projectNameDisplay = elements.aiDebriefingAssistantModal.querySelector('#debriefProjectName');
        const metadataCheckboxLabel = elements.aiDebriefingAssistantModal.querySelector('#metadataCheckboxLabel');
        const commandsText = elements.aiDebriefingAssistantModal.querySelector('#debriefScriptCommands');
        const standardProfileButton = elements.aiDebriefingAssistantModal.querySelector('#useStandardDebriefProfileBtn');

        if (projectNameDisplay) projectNameDisplay.textContent = currentProjectName;
        if (metadataCheckboxLabel) metadataCheckboxLabel.textContent = ` I have run the metadata update script for ${currentProjectName}.`;
        if (commandsText) commandsText.innerHTML = `<code>cd /path/to/${currentProjectName}</code><br><code>./update_github_meta.sh</code>`;
        
        const metadataCheckbox = elements.aiDebriefingAssistantModal.querySelector('#debriefMetadataCheckbox');
        const assembleButton = elements.aiDebriefingAssistantModal.querySelector('#assembleDebriefPackageBtn');
        if (metadataCheckbox) metadataCheckbox.checked = false;
        if (assembleButton) assembleButton.disabled = true;
        if (standardProfileButton) standardProfileButton.classList.remove('active-profile'); 

        elements.aiDebriefingAssistantModal.style.display = 'flex';
    } else {
        console.error("AI Debriefing Assistant modal element not found.");
    }
}

function closeModal() {
    if (elements.aiDebriefingAssistantModal) {
        elements.aiDebriefingAssistantModal.style.display = 'none';
        standardProfileActive = false; 
    }
}

function handleMetadataCheckboxChange(event) {
    const assembleButton = elements.aiDebriefingAssistantModal.querySelector('#assembleDebriefPackageBtn');
    if (assembleButton) {
        assembleButton.disabled = !event.target.checked;
    }
}

function toggleStandardProfile(buttonElement) {
    standardProfileActive = !standardProfileActive;
    if (standardProfileActive) {
        notificationSystem.showNotification("Standard Debriefing Profile ACTIVE. Click 'Assemble & Copy'.", { duration: 3500 });
        buttonElement.classList.add('active-profile');
        buttonElement.textContent = "Using Standard Profile";
    } else {
        notificationSystem.showNotification("Standard Debriefing Profile DEACTIVATED. Using committed selections.", { duration: 3500 });
        buttonElement.classList.remove('active-profile');
        buttonElement.textContent = "Use Standard Debriefing Profile";
    }
}

async function assembleAndCopyPackage() {
    if (!elements.aiDebriefingAssistantModal) return;
    
    let scopeForDebrief;

    if (standardProfileActive) {
        notificationSystem.showNotification("Assembling with Standard Debriefing Profile...", { duration: 2000});
        const standardProfilePaths = new Set();
        const root = currentProjectName;

        const pathsToInclude = [
            `${root}/README.md`,
            `${root}/docs/`,      
            `${root}/js/`,        
            `${root}/index.html`,
            `${root}/css/`,       
            `${root}/.github_meta/` 
        ];

        appState.fullScanData.allFilesList.forEach(file => {
            if (pathsToInclude.some(p => file.path === p || (p.endsWith('/') && file.path.startsWith(p)))) {
                standardProfilePaths.add(file.path);
            }
        });
        appState.fullScanData.allFoldersList.forEach(folder => {
             if (pathsToInclude.some(p => folder.path === p || (p.endsWith('/') && folder.path.startsWith(p)) || (p.endsWith('/') && p.startsWith(folder.path)) )) {
                standardProfilePaths.add(folder.path);
            }
        });
        
        standardProfilePaths.add(`${root}/docs/roadmap.md`);
        standardProfilePaths.add(`${root}/docs/git_conventions.md`);

        scopeForDebrief = fileSystem.filterScanData(appState.fullScanData, standardProfilePaths);

    } else if (appState.selectionCommitted && appState.committedScanData && appState.committedScanData.allFilesList.length > 0) {
        scopeForDebrief = appState.committedScanData;
        notificationSystem.showNotification("Assembling with current committed selections...", { duration: 2000});
    } else {
        notificationSystem.showNotification("No standard profile chosen and no selections committed. Assembling with full project scan.", { duration: 3500 });
        const allPaths = new Set();
        appState.fullScanData.allFilesList.forEach(f => allPaths.add(f.path));
        appState.fullScanData.allFoldersList.forEach(f => allPaths.add(f.path));
        scopeForDebrief = fileSystem.filterScanData(appState.fullScanData, allPaths);
    }

    if (!scopeForDebrief || !scopeForDebrief.directoryData || scopeForDebrief.allFilesList.length === 0) {
        notificationSystem.showNotification("Selected scope is empty or invalid. Nothing to debrief.", { duration: 3000});
        return;
    }

    elements.loader.classList.add('visible');
    elements.loader.textContent = 'ASSEMBLING DEBRIEF...';

    try {
        let masterPrompt = `--- AI DEBRIEFING PACKAGE for ${currentProjectName} ---\n\n`;
        masterPrompt += `Project Name: ${currentProjectName}\n`;
        masterPrompt += `Timestamp: ${new Date().toISOString()}\n\n`;

        masterPrompt += "--- KEY DOCUMENTS ---\n";
        const keyDocs = [
            { name: "README.md", path: `${currentProjectName}/README.md` },
            { name: "ROADMAP.md", path: `${currentProjectName}/docs/roadmap.md` },
            { name: "GIT_CONVENTIONS.md", path: `${currentProjectName}/docs/git_conventions.md` },
            { name: "issues.md", path: `${currentProjectName}/.github_meta/issues.md` },
            { name: "milestones.md", path: `${currentProjectName}/.github_meta/milestones.md` },
        ];

        for (const doc of keyDocs) {
            const fileNodeInFullScan = appState.fullScanData.allFilesList.find(f => f.path === doc.path);
            if (fileNodeInFullScan && fileNodeInFullScan.entryHandle) {
                try {
                    const content = await fileSystem.readFileContent(fileNodeInFullScan.entryHandle, fileNodeInFullScan.path, true); 
                    masterPrompt += `\n// Document: ${doc.name} (Path: ${doc.path})\n`;
                    masterPrompt += content + "\n";
                    masterPrompt += `// End Document: ${doc.name}\n---\n`;
                } catch (e) {
                    masterPrompt += `\n// Document: ${doc.name} (Path: ${doc.path}) - ERROR: Could not read file: ${e.message}\n---\n`;
                }
            } else {
                 masterPrompt += `\n// Document: ${doc.name} (Path: ${doc.path}) - SKIPPED: File not found in project scan.\n---\n`;
            }
        }
        masterPrompt += "\n";

        masterPrompt += "--- DIRECTORY TREE REPORT (Scope: Debriefing Selection) ---\n";
        if (typeof reportGenerator.generateTextReport_revised === 'function') {
             masterPrompt += reportGenerator.generateTextReport_revised(scopeForDebrief) + "\n\n";
        } else if (typeof reportGenerator.generateTextReport === 'function') {
            masterPrompt += reportGenerator.generateTextReport(scopeForDebrief) + "\n\n";
        } else {
            masterPrompt += "// Tree report generation unavailable.\n\n";
        }

        masterPrompt += "--- COMBINED CODE (Scope: Debriefing Selection - Text Files Only) ---\n";
        const textFilesInScope = scopeForDebrief.allFilesList.filter(file => utils.isLikelyTextFile(file.path));
        let combinedCodeContent = `// COMBINED CONTENT (${textFilesInScope.length} files) - ${new Date().toISOString()}\n`;
        const binarySkippedCount = scopeForDebrief.allFilesList.length - textFilesInScope.length;
        if (binarySkippedCount > 0) {
            combinedCodeContent += `// NOTE: ${binarySkippedCount} binary files were skipped.\n`;
        }
        combinedCodeContent += "\n";

        for (const file of textFilesInScope) {
            try {
                const content = await fileSystem.readFileContent(file.entryHandle, file.path, false); 
                let sourceInfo = "";
                if (fileEditor && typeof fileEditor.hasEditedContent === 'function' && fileEditor.hasEditedContent(file.path)) {
                     sourceInfo = (typeof fileEditor.isPatched === 'function' && fileEditor.isPatched(file.path)) ? "(EDITED & PATCHED)" : "(EDITED)";
                }
                combinedCodeContent += `// ===== FILE: ${file.path} ${sourceInfo} ===== //\n${content}\n// ===== END ${file.path} ===== //\n\n`;
            } catch (e) {
                combinedCodeContent += `// ERROR reading ${file.path}: ${e.message}\n\n`;
                 console.error(`Error processing file for combined code: ${file.path}`, e);
            }
        }
        masterPrompt += combinedCodeContent + "\n";
        masterPrompt += "--- END OF DEBRIEFING PACKAGE ---\n";

        await navigator.clipboard.writeText(masterPrompt);
        notificationSystem.showNotification("AI Debriefing Package assembled and copied to clipboard!", { duration: 4000 });
        closeModal(); // Also resets standardProfileActive

    } catch (error) {
        console.error("Error assembling debriefing package:", error);
        errorHandler.showError({
            name: "DebriefingError",
            message: "Failed to assemble AI Debriefing Package.",
            stack: error.stack,
            cause: error
        });
        notificationSystem.showNotification("Error assembling package. See console/error report.", { duration: 4000 });
    } finally {
        elements.loader.classList.remove('visible');
        elements.loader.textContent = 'ANALYSING...';
        // standardProfileActive is reset in closeModal or at the start of showModal
    }
}

export function initAiDebriefingAssistant() {
    const debriefButton = document.getElementById('aiDebriefingAssistantBtn');
    const closeModalButton = document.getElementById('closeAiDebriefingAssistantModalBtn');
    const metadataCheckbox = document.getElementById('debriefMetadataCheckbox');
    const assembleButton = document.getElementById('assembleDebriefPackageBtn');
    const useStandardProfileButton = document.getElementById('useStandardDebriefProfileBtn');

    if (debriefButton) {
        debriefButton.addEventListener('click', showModal);
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }
    if (metadataCheckbox) {
        metadataCheckbox.addEventListener('click', handleMetadataCheckboxChange);
    }
    if (assembleButton) {
        assembleButton.addEventListener('click', assembleAndCopyPackage);
    }
    if (useStandardProfileButton) {
        useStandardProfileButton.addEventListener('click', () => {
            toggleStandardProfile(useStandardProfileButton);
        });
    }
    console.log("AI Debriefing Assistant Initialized.");
}
// --- ENDFILE: diranalyze/js/aiDebriefingAssistant.js --- //