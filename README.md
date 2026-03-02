<p align="center">
  <img src="src/renderer/assets/logo.png" width="128" alt="Simscredit Logo">
</p>

# CC Catalog (CCCC)

[![English](https://img.shields.io/badge/EN--US-blue?style=for-the-badge)](README.md)
[![Português](https://img.shields.io/badge/PT--BR-green?style=for-the-badge)](README.pt-br.md)

CC Catalog is a specialized tool for The Sims content creators and curators to manage Custom Content (CC) credits efficiently. It automates identifying creators and items from ZIP files and generates formatted markdown reports.

## 💝 A Special Dedication (Why I built this)

This project was born entirely out of love. I built CC Catalog specifically to help my amazing girlfriend manage her Custom Content with ease. Seeing her spend so much time organizing files and finding creator credits inspired me to code a solution just for her.

Everything here—every feature, every click, every line of code—was made to make her life a little bit easier and her game a little more fun. I love you very much! ❤️

If this tool happens to help someone else in the Sims community organize their library, that is wonderful! Enjoy it. But its true purpose and greatest achievement will always be the smile it brought to the person it was made for.

## 🚀 Key Features

- 📂 **Hierarchical Organization**: Support for nested sets (subfolders). Organize your library by year, theme, or collection with parent/child relationships. Easily move sets between creators via drag-and-drop.
- 📁 **Enhanced ZIP Scanning**: Intelligent import logic that identifies creators and sets. 
    - **Duplicate Prevention**: Checks across the entire creator library to avoid importing the same item twice.
    - **Smart Sorting**: Files in root or unknown structures are automatically moved to an "Unsorted" category.
- 📝 **Social-Ready Reports**: Generate credit lists formatted specifically for **Patreon** and **X (Twitter)**.
    - **Auto-Hyperlinks**: Set names are automatically converted to clickable links if Patreon/Website URLs are available.
    - **Patreon HTML Mode**: New "Copy HTML" button that generates rich-text links ready for direct paste into the Patreon editor.
    - **Link Prioritization**: Patreon URLs now automatically take precedence over general Website URLs for both creators and sets.
- 🕒 **History Management**: Organize your past scans into custom folders. Drag and drop history items to keep your workspace clean.
- 🛡️ **Stability & Safety**: Built-in crash reporting system.
    - **File Logging**: Automatic error logging to the local filesystem.
    - **Error Boundary**: A dedicated "Panic" screen if the UI crashes, allowing you to save a report to your Desktop or restart the app.
- 🎨 **Premium Glass UI**: A stunning "glassy" interface with Windows native **Acrylic/Mica** support and customizable accent colors.
- 🧠 **Fuzzy Creator Matching**: Uses Levenshtein distance to detect similar creator names to prevent redundant entries.
- 🗃️ **Robust Persistence**: SQLite with **Drizzle ORM**. The CSV Export/Import system now fully supports and preserves set hierarchies.

## 💻 Technology Stack

- **Framework**: Electron + Vite
- **Frontend**: React, Tailwind CSS 4, Lucide React
- **Database**: SQLite (via `better-sqlite3`) + **Drizzle ORM**
- **Utilities**: `adm-zip` for archive processing, `fuse.js` for selection

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/devbrunoflorian/CC-Catalog.git
   cd CC-Catalog
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

### Building for Production

To create a Windows installer:
```bash
npm run dist
```

## 🛠️ How it Works

The tool analyzes ZIP files looking for creator signatures and folder patterns:
- `Creator/SetName/ItemName.package`
- `Mods/Creator/SetName/ItemName.package`

During scanning, if a name is similar to one already in your database, CC Catalog will prompt you to confirm if it's a new creator or a variation of an existing one.

## 🔮 Roadmap & Future Vision

We are constantly evolving. Check out our [Future Implementations](FUTURE_IMPLEMENTATIONS.md) page for upcoming technical proposals, including our **Content Hash Identity System** (Deterministic SHA-256 Identification).


## ✅ Completed & Recent Updates

- [x] **Crash Reporting**: File-based logging and UI Error Boundary with "Save to Desktop" support.
- [x] **History Folders**: Organize scan history into a logical folder structure.
- [x] **Nested Sets**: Drag and drop support to create folder hierarchies and reassign sets to different creators.
- [x] **Report V2**: Visual-first markdown & HTML generation with prioritized Patreon links.
- [x] **Rich Clipboard API**: Support for `text/html` copying to bypass Patreon editor limitations.
- [x] **Hierarchy-Aware CSV**: Export and Import now preserve nested folder structures.
- [x] **Glass Theme**: Native Windows transparency effects and custom tinting.
