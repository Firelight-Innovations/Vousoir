# Workspace Trust

Vousoir can open any folder, but not all code should be allowed to run automatically. Workspace Trust lets you decide whether the code in a folder is allowed to execute tasks, debuggers, and certain extension features.

## Trusted vs. Restricted Mode

- **Trusted** — full functionality. Tasks, debugging, and workspace-scoped settings run normally. Use this for folders whose contents you wrote or otherwise trust.
- **Restricted Mode** — Vousoir opens the folder for browsing and editing but does not automatically run potentially harmful code. Some features are limited until you grant trust.

When you open a folder for the first time, Vousoir asks whether you trust the authors. You can change the decision later from the Command Palette with **Workspaces: Manage Workspace Trust**.

## Granting trust

1. Run **Workspaces: Manage Workspace Trust** from the Command Palette.
2. Choose **Trust** to enable full functionality, or keep the folder in Restricted Mode.
3. You can also mark parent folders as trusted so their subfolders inherit the decision.

## Configuration

The `security.workspace.trust.*` settings control whether Workspace Trust is enabled, what happens for empty windows, and how untrusted files are handled. Disabling Workspace Trust removes this safety prompt for every folder you open, so change it only if you understand the implications.
