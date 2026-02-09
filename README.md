<p align="center">
  <img src="src/renderer/assets/logo.png" width="128" alt="Simscredit Logo">
</p>

# CC Catalog

CC Catalog is a specialized tool for The Sims content creators and curators to manage Custom Content (CC) credits efficiently. It automates the process of identifying creators and items from ZIP files and generates formatted markdown reports.

## Features

- 📂 **Smart ZIP Scanning**: Automatically identifies creators, CC sets, and items based on the folder structure within ZIP files.
- 👤 **Creator Management**: Maintain a database of creators with their Patreon, website, and social media links.
- 📝 **Markdown Reports**: Generate ready-to-use markdown credit lists for your blog, Patreon, or social media.
- 🎨 **Modern Interface**: A sleek, dark-themed dashboard built with React and Tailwind CSS.
- 🧠 **Smart Matching**: Uses Levenshtein distance to detect similar creator names and avoid duplicates.
- 🗃️ **Persistent Database**: All data is stored locally using SQLite for fast access and portability.

## Technology Stack

- **Framework**: Electron + Vite
- **Frontend**: React, Tailwind CSS, Lucide React
- **Database**: SQLite (via `better-sqlite3`)
- **Utilities**: `adm-zip` for archive processing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/devbrunoflorian/CCCC.git
   cd CCCC
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

## How it Works

The tool expects ZIP files to have a specific structure for optimal identification:
- `Creator/SetName/ItemName.package`
- `Mods/Creator/SetName/ItemName.package`

When a ZIP is scanned, CC Catalog analyzes the creators found. If a name is similar to one already in your database (e.g., "Felixand" vs "Felixandre"), the app will prompt you to confirm if it should use the existing record or create a new one.

## Completed Features

- [x] **Fuzzy Matching**: Automated Levenshtein distance check to prevent duplicate creators.
- [x] **Confirmation UI**: Interactive prompts to confirm new creator registrations during the scanning process.

