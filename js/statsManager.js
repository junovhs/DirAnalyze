import { elements } from './main.js';
import { formatBytes } from './utils.js';

export function update(analyzedData, selectedNode = null) {
    const { fileList, folderList, dependencyMap } = analyzedData;

    // --- Global Stats ---
    const totalFiles = fileList.length;
    const totalFolders = folderList.length;
    const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);
    const totalLOC = fileList.reduce((sum, f) => sum + (f.complexity?.loc || 0), 0);

    elements.statsContainer.innerHTML = `
        <h4>Global Project Stats</h4>
        <p><strong>Total Files:</strong> ${totalFiles}</p>
        <p><strong>Total Folders:</strong> ${totalFolders}</p>
        <p><strong>Total Size:</strong> ${formatBytes(totalSize)}</p>
        <p><strong>Total Lines of Code:</strong> ~${totalLOC.toLocaleString()}</p>
    `;

    // --- Selected Item Stats & Dependencies ---
    if (selectedNode) {
        let depsHtml = `<h4>${selectedNode.type === 'folder' ? 'Folder' : 'File'}: ${selectedNode.name}</h4>`;
        
        if (selectedNode.type === 'file') {
            depsHtml += `<p><strong>Size:</strong> ${formatBytes(selectedNode.size)}</p>`;
            depsHtml += `<p><strong>Complexity:</strong> ${selectedNode.complexity.loc} LOC (Score: ${selectedNode.complexity.score})</p>`;
            
            const deps = dependencyMap.get(selectedNode.path);
            if (deps) {
                depsHtml += `<h4>Imports (${deps.imports.length})</h4>
                             <ul>${deps.imports.map(i => `<li>${i.replace(analyzedData.tree.name + '/', '')}</li>`).join('') || '<li>None</li>'}</ul>
                             <h4>Imported By (${deps.importedBy.length})</h4>
                             <ul>${deps.importedBy.map(i => `<li>${i.replace(analyzedData.tree.name + '/', '')}</li>`).join('') || '<li>None</li>'}</ul>`;
            } else {
                depsHtml += `<p>No dependency data for this file type.</p>`;
            }
        } else { // It's a folder
            // Recursively count stats for the folder
            const folderStats = calculateFolderStats(selectedNode, fileList);
            depsHtml += `<p><strong>Files in Folder:</strong> ${folderStats.fileCount}</p>`;
            depsHtml += `<p><strong>Total Size:</strong> ${formatBytes(folderStats.totalSize)}</p>`;
            depsHtml += `<p><strong>Total LOC:</strong> ~${folderStats.locCount.toLocaleString()}</p>`;
        }
        elements.depsContent.innerHTML = depsHtml;
    } else {
        elements.depsContent.innerHTML = '<div class="empty-notice">Select a file or folder to see details.</div>';
    }
}

function calculateFolderStats(folderNode, allFiles) {
    let fileCount = 0;
    let totalSize = 0;
    let locCount = 0;
    
    for(const file of allFiles) {
        if (file.path.startsWith(folderNode.path + '/')) {
            fileCount++;
            totalSize += file.size;
            locCount += file.complexity?.loc || 0;
        }
    }
    return { fileCount, totalSize, locCount };
}