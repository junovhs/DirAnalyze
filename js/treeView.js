import { elements } from './main.js';
import * as fileViewer from './fileViewer.js';
import * as statsManager from './statsManager.js';

let appData = null; // To hold the full analyzedData object

export function render(analyzedData) {
    appData = analyzedData;
    elements.treeContainer.innerHTML = '';
    const ul = document.createElement('ul');
    ul.appendChild(createNodeElement(analyzedData.tree));
    elements.treeContainer.appendChild(ul);
}

function createNodeElement(node) {
    const li = document.createElement('li');
    li.classList.add(node.type);

    const itemLine = document.createElement('div');
    itemLine.className = 'item-line';

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = node.type === 'folder' ? '📁' : '📄';
    itemLine.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = node.name;
    itemLine.appendChild(name);

    // Apply complexity "heatmap" color to the left border
    if (node.type === 'file' && node.complexity) {
        const complexityClass = ['file-complexity-low', 'file-complexity-medium', 'file-complexity-high'][node.complexity.score];
        itemLine.classList.add(complexityClass);
        itemLine.title = `Complexity Score: ${node.complexity.score} (LOC: ${node.complexity.loc})`;
    }

    li.appendChild(itemLine);
    
    // Add click listener to the entire line
    itemLine.addEventListener('click', (e) => {
        e.stopPropagation();
        handleNodeClick(node);
        
        // Highlight the selected item
        document.querySelectorAll('.tree .item-line.selected').forEach(el => el.classList.remove('selected'));
        itemLine.classList.add('selected');
    });

    if (node.type === 'folder' && node.children.length > 0) {
        const ul = document.createElement('ul');
        // Sort children: folders first, then alphabetically
        node.children.sort((a,b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        }).forEach(child => ul.appendChild(createNodeElement(child)));
        li.appendChild(ul);
    }
    return li;
}

// This function handles what happens when a file or folder is clicked
async function handleNodeClick(node) {
    if (node.type === 'file') {
        try {
            // Read file content for the viewer
            const content = await node.handle.getFile().then(f => f.text());
            fileViewer.showFile(node, content);
            // Update the stats and dependency panels for the clicked file
            statsManager.update(appData, node);
        } catch (e) {
            console.error(`Error reading file for viewer: ${node.path}`, e);
            fileViewer.showError(`Error: Could not read file content. ${e.message}`);
        }
    } else { // A folder was clicked
        // When a folder is clicked, we just show its aggregate stats
        statsManager.update(appData, node);
        // Clear the file viewer
        fileViewer.clear();
    }
}