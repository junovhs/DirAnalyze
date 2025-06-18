import { getFileExtension } from './utils.js';

// Analyze all files, calculating complexity and mapping dependencies.
export async function analyze(scanData) {
    const { fileList } = scanData;
    // The dependencyMap tracks connections: path -> { imports: [...], importedBy: [...] }
    const dependencyMap = new Map();

    for (const file of fileList) {
        // Only analyze file types we can parse for dependencies
        if (!isAnalyzable(file.name)) {
            file.complexity = { loc: 0, score: 0 };
            file.dependencies = [];
            continue;
        }

        try {
            const content = await file.handle.getFile().then(f => f.text());
            
            // 1. Calculate complexity and attach it to the file node
            file.complexity = calculateComplexity(content);
            
            // 2. Find dependencies (import/require statements)
            file.dependencies = findDependencies(content);

            // 3. Populate the master dependency map
            // Initialize entry for the current file if it doesn't exist
            if (!dependencyMap.has(file.path)) {
                dependencyMap.set(file.path, { imports: new Set(), importedBy: new Set() });
            }
            
            // For each dependency found in this file...
            for (const imp of file.dependencies) {
                const resolvedPath = resolveImportPath(file.path, imp, fileList);
                if (resolvedPath) {
                    // Add to the current file's 'imports' set
                    dependencyMap.get(file.path).imports.add(resolvedPath);

                    // Add a back-reference to the imported file's 'importedBy' set
                    if (!dependencyMap.has(resolvedPath)) {
                        dependencyMap.set(resolvedPath, { imports: new Set(), importedBy: new Set() });
                    }
                    dependencyMap.get(resolvedPath).importedBy.add(file.path);
                }
            }
        } catch (e) {
            console.warn(`Could not analyze file ${file.path}: ${e.message}`);
            file.complexity = { loc: 0, score: 0 };
            file.dependencies = [];
        }
    }
    
    // Convert sets to arrays for easier consumption by UI
    for (const [key, value] of dependencyMap.entries()) {
        value.imports = Array.from(value.imports).sort();
        value.importedBy = Array.from(value.importedBy).sort();
    }
    
    scanData.dependencyMap = dependencyMap;
    return scanData;
}

// --- Helper Functions ---

function isAnalyzable(fileName) {
    // We can only parse dependencies from text-based script files
    return /\.(js|ts|jsx|tsx|mjs)$/i.test(fileName);
}

function calculateComplexity(content) {
    const lines = content.split('\n');
    const loc = lines.length;
    
    // Simple complexity score based on Lines of Code
    let score = 0; // 0: low, 1: medium, 2: high
    if (loc > 500) score = 2;
    else if (loc > 200) score = 1;

    return { loc, score };
}

function findDependencies(content) {
    // Regex to find 'import' and 'require' statements for relative paths
    const importRegex = /import(?:.|\n)*?from\s*['"](\..*?)['"]/g;
    const requireRegex = /require\(['"](\..*?)['"]\)/g;
    const dependencies = new Set();
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        dependencies.add(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
        dependencies.add(match[1]);
    }

    return Array.from(dependencies);
}

// Resolves a relative import path to a full project path
function resolveImportPath(currentFilePath, importPath, allFiles) {
    const pathParts = currentFilePath.split('/');
    pathParts.pop(); // Go to containing directory

    const importParts = importPath.split('/');
    for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
            if (pathParts.length > 1) pathParts.pop();
        } else {
            pathParts.push(part);
        }
    }

    let resolvedBase = pathParts.join('/');
    
    // Attempt to resolve file with various extensions
    const potentialExtensions = ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
    for (const ext of potentialExtensions) {
        const potentialPath = resolvedBase + ext;
        if (allFiles.some(f => f.path === potentialPath)) {
            return potentialPath;
        }
    }

    return null; // Could not resolve
}