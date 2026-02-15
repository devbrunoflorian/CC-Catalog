# 🛠️ CC Catalog - Service Handbook

This handbook details the internal logic of each primary service, common failure points, and troubleshooting steps.

---

## 📌 Table of Contents
1. [ZipScanner (Core Logic)](#zipscanner)
2. [Database Service (SQLite/Drizzle)](#database-service)
3. [ReportGenerator (Output Engine)](#reportgenerator)
4. [Logger & Error Handling](#logger-error-handling)
5. [AutoUpdater (Lifecycle)](#autoupdater)

---

## 🔍 ZipScanner
The heart of the application. It extracts metadata from `.zip` files and maps them to creators and sets.

### How it works:
- Uses `yauzl` for lazy entry reading (low memory footprint).
- **Heuristic**: It assumes the first folder in the zip is the **Creator**, and subfolders are **Sets**.
- **Hinting**: If the folder structure is flat, it tries to extract the Creator name from the zip filename (e.g., `CreatorName_Set.zip`).

### Common Breakages:
- **Malformed Zips**: If a `.zip` is corrupted, `yauzl` will emit an `error` event.
- **Unexpected Structure**: If a zip contains only files without folders, it defaults to "Unknown" creator unless naming follows the `CreatorName - SetName` pattern.
- **Deep Nesting**: Extremely deep folder structures might confuse the set hierarchy logic.

### Troubleshooting:
- **"Unknown" everywhere**: Check if the zip file follows the expected naming convention or has internal folders.
- **Duplicate Detection**: Defined in `src/main/index.ts`. It flags a duplicate ONLY if the exact `fileName` already exists in the `cc_items` table.

---

## 🗄️ Database Service
Centralized data storage using SQLite (via `sql.js` in WASM mode for compatibility).

### How it works:
- **Storage**: The file is saved at `%AppData%/cccc/sims-cc.db`.
- **Initialization**: Every launch checks for schema updates through manual `ALTER TABLE` blocks in `initDatabase()`.
- **Syncing**: The database is held in memory for performance and exported to disk (`saveDatabase()`) after any mutation.

### Common Breakages:
- **Migration Error**: If a column add fails (e.g., name conflict), it might stall initialization.
- **Write Failure**: If the disk is full or permissions are locked, the `.db` file won't update.
- **Constraint Violation**: `idx_cc_sets_hierarchy` prevents multiple sets with the same name under the same creator.

### Troubleshooting:
- **App won't start**: Try moving/renaming the `sims-cc.db` file (backup first). If the app starts, the DB was corrupted or a migration failed.
- **Missing Data on Restart**: Ensure `saveDatabase()` was called. Check the console for "Database initialized successfully" logs.

---

## 📄 ReportGenerator
Converts library data into Markdown or HTML.

### How it works:
- **Modes**: Supports "Library Report" (full export) or "Scan Report" (filtered by last scan).
- **Hierarchy**: Recursively traverses `cc_sets` using `parentId` to build nested lists.

### Common Breakages:
- **SQLite Parameter Limit**: Generating reports for thousands of items might hit the `inArray` limit (usually 999 parameters).
- **JSON Parsing**: `extraLinks` are stored as JSON strings. If they get corrupted, the report will simply skip those links.

---

## 📝 Logger & Error Handling
Centralized logging for both Main and Renderer processes.

### How it works:
- Logs are saved to `AppData/Roaming/cccc/logs/main.log`.
- **Uncaught Exceptions**: Both `uncaughtException` and `unhandledRejection` are caught in `index.ts` to show a user-friendly error dialog instead of a silent crash.

### Troubleshooting:
- **Empty Logs**: Check if the user has write permissions for the AppData directory.
- **Renderer Errors**: Check the Chrome DevTools console (Ctrl+Shift+I in dev) for frontend-only bugs.

---

## 🔄 AutoUpdater
Handles GitHub-based releases.

### Common Breakages:
- **SSL Issues**: Some networks/VPNs block the GitHub API calls.
- **Permission Denial**: On Windows, the installer might fail if the app is running with restricted permissions.
- **Dev Mode**: Auto-update is explicitly disabled in development to prevent accidental production overwrite.

---
*Last Updated: February 2026*
