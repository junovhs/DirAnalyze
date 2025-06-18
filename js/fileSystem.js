import { getFileExtension } from './utils.js';

export async function scanDirectory(dirHandle) {
    const tree = { name: dirHandle.name, type: 'folder', path: dirHandle.name, children: [] };
    const fileList = [];
    const folderList = [tree];
    
    await processEntry(dirHandle, tree, fileList, folderList);
    
    return { tree, fileList, folderList };
}

async function processEntry(dirHandle, parentNode, fileList, folderList) {
    try {
        for await (const entry of dirHandle.values()) {
            const path = `${parentNode.path}/${entry.name}`;
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const fileNode = {
                    name: entry.name,
                    type: 'file',
                    path: path,
                    size: file.size,
                    extension: getFileExtension(entry.name),
                    handle: entry,
                };
                parentNode.children.push(fileNode);
                fileList.push(fileNode);
            } else if (entry.kind === 'directory') {
                const folderNode = {
                    name: entry.name,
                    type: 'folder',
                    path: path,
                    children: [],
                    handle: entry,
                };
                parentNode.children.push(folderNode);
                folderList.push(folderNode);
                await processEntry(entry, folderNode, fileList, folderList);
            }
        }
    } catch (err) {
        console.warn(`Could not read directory ${dirHandle.name}. Skipping.`, err);
    }
}