# LoomDir

**LoomDir: The AI Dialogue Orchestrator & Workflow Assistant**

LoomDir is a web-based utility designed to empower "LLM Dialogue Masters" – expert developers and architects who engage in sophisticated, iterative conversations with their preferred Large Language Models (LLMs) like Gemini, Claude, and ChatGPT.

It streamlines the cumbersome process of preparing code context for these dialogues and applying AI-generated code modifications (CAPCA patches) efficiently and accurately.

## Core Problem Solved

The manual, time-consuming, and error-prone process of:
*   Preparing and managing code context for LLM dialogues, especially given context window limitations.
*   Handing off context between AI chat sessions or different AIs.
*   Applying small, precise AI-generated changes to a codebase without the AI regenerating entire files.

## Key Features (v1.0)

*   **Project Loading:** Load local codebases via Drag & Drop or Folder Input.
*   **Visual Directory Tree:** Interactive tree view with selection, filtering, stats, and file-type icons.
*   **File Preview & Editing:** Integrated CodeMirror-based editor for viewing and modifying files in-browser.
*   **Context Preparation for AI:**
    *   **Combine Mode:** Concatenate selected file contents for LLM context.
    *   **Text Report:** Generate a structural report of the codebase.
*   **CAPCA Patching:** Apply AI-generated "Contextual Anchor Patch Content Application" (CAPCA) instructions (JSON format) with a diff review for each change. Supports creating, replacing, inserting, and deleting code segments.
*   **Project Management:** Commit selections, download the modified project as a ZIP, and clear project data.

## Vision

LoomDir aims to be the premier LLM Dialogue Orchestrator. It focuses on managing the "before the prompt" and "between the prompts" parts of your AI-assisted development workflow, making you a more effective "director" of your AI coding partners.

*(Future roadmap highlights like "AI Briefing Package Generation" can be added here later)*

## Getting Started / Running LoomDir

LoomDir is a static web application. You can run it by:
1.  Cloning this repository.
2.  Opening the `index.html` file in a modern web browser.
    *   OR, access the live GitHub Pages deployment at: [https://junovhs.github.io/LoomDir/](https://junovhs.github.io/LoomDir/) *(Adjust this link if your username/repo name is different or once it's live)*

## Dogfooding Development

LoomDir v1.0 is being used to develop its own future enhancements. The workflow involves loading LoomDir's source code into itself, using its features to prepare context for an LLM, and then applying LLM-generated CAPCA patches to its own codebase.

*(More details on the dogfooding process can be added from the handoff document)*

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.