import { elements } from './main.js';

let editorInstance = null;

// Shows the content of a file in the CodeMirror viewer
export function showFile(fileNode, content) {
    elements.viewerFileTitle.textContent = fileNode.path;
    
    // Lazy-init CodeMirror instance
    if (!editorInstance) {
        editorInstance = CodeMirror(elements.viewerContent, {
            value: content,
            mode: getCodeMirrorMode(fileNode.name),
            theme: 'material-darker',
            lineNumbers: true,
            readOnly: true, // This is crucial for the Cartographer vision
            lineWrapping: true,
        });
    } else {
        elements.viewerContent.style.display = 'block';
        editorInstance.setValue(content);
        editorInstance.setOption("mode", getCodeMirrorMode(fileNode.name));
    }
    
    setTimeout(() => editorInstance.refresh(), 1);
}

// Shows an error message in the viewer pane
export function showError(message) {
    if (editorInstance) {
        editorInstance.setValue(message);
    } else {
        elements.viewerContent.innerHTML = `<div class="empty-notice">${message}</div>`;
    }
}

// Clears the viewer, showing a prompt
export function clear() {
    elements.viewerFileTitle.textContent = "FILE VIEWER";
    if (editorInstance) {
       elements.viewerContent.style.display = 'none'; // Hide editor to show placeholder
    }
     // Re-create the placeholder if it was removed
    if (!elements.viewerContent.querySelector('.empty-notice')) {
        elements.viewerContent.innerHTML = '<div class="empty-notice">Select a file to view.</div>';
    }
}

function getCodeMirrorMode(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const modeMap = {
        'js': 'javascript', 'ts': 'javascript', 'json': {name: 'javascript', json: true},
        'py': 'python', 'rs': 'rust', 'go': 'go', 'html': 'htmlmixed', 'css': 'css'
    };
    return modeMap[extension] || 'text/plain';
}