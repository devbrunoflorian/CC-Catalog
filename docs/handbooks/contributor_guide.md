# 🚀 CC Catalog - Contributor Handbook

Welcome to the CC Catalog development team! This handbook covers the technical architecture and common workflows to get you (and AI collaborators) up to speed.

---

## 🏗️ Project Architecture

### 1. Main Process (`src/main/`)
- **`index.ts`**: The brain. Handles Electron lifecycle, IPC registration, and database initialization.
- **`db/`**: Contains the SQLite schema and database logic.
- **`lib/`**: Business logic (Zip scanning, Report generation, etc.).

### 2. Renderer Process (`src/renderer/`)
- **`App.tsx`**: Main entry point, routing, and global state management.
- **`components/`**: Modular views (History, Creators, FAQ).
- **`context/`**: React Context providers (Theme, etc.).

---

## 🛠️ Common Tasks

### How to add a new IPC Handler
1. Define the logic in a service or lib file in `src/main/`.
2. Register the handler in `src/main/index.ts` using `ipcMain.handle`.
3. In the frontend, invoke it using `(window as any).electron.invoke('your-handler-name', args)`.

### How to add a new View
1. Create a new component in `src/renderer/components/`.
2. Add a new state value to the `currentView` in `App.tsx`.
3. Add a navigation button to the Sidebar in `App.tsx`.
4. Conditionaly render your component in the `<main>` section of `App.tsx`.

### How to perform visual adjustments
- **Stop!** Read the [Visual Style Guide](./visual_style_guide.md) first.
- Most visual logic is centralized in `src/renderer/index.css`.

---

## 📦 Database Workflow
The app uses **SQLite** via `better-sqlite3` (main) and `sql.js` (dev fallback/WASM).
- Schema is defined in `src/main/db/schema.ts`.
- Migrations are handled manually in `src/main/index.ts` during the `initDatabase` sequence. Always check for table existence before running `CREATE TABLE`.

---

## 🧪 Testing & Verification
- **Type Checking**: Run `npm exec tsc --noEmit` before pushing.
- **Hot Reload**: The project uses Vite for instant UI updates during development.
- **Error Reporting**: Global errors are caught and logged to the Electron log file. Check the `AppData/Roaming/cccc/logs` folder for debugging.

---

## 🤝 Collaboration Guidelines
- **AI Pairing**: When working with an AI, always point to these handbooks so the AI understands the "source of truth".
- **Commit Messages**: Use descriptive messages like `feat: add health metrics` or `fix: subtle glow intensity`.
- **UI First**: Every new feature must follow the Mica/Acrylic visual patterns defined in the Style Guide.
