<p align="center">
  <img src="src/renderer/assets/logo.png" width="128" alt="Simscredit Logo">
</p>

# CC Catalog (CCCC)

[![English](https://img.shields.io/badge/Language-EN-blue?style=for-the-badge)](README.md)
[![Português](https://img.shields.io/badge/Língua-PT--BR-green?style=for-the-badge)](README.pt-br.md)

O CC Catalog é uma ferramenta especializada para criadores e curadores de conteúdo de The Sims gerenciarem créditos de Custom Content (CC) de forma eficiente. Ele automatiza a identificação de criadores e itens a partir de arquivos ZIP e gera relatórios formatados em markdown.

## 🚀 Funcionalidades Principais

- 📂 **Organização Hierárquica**: Suporte para sets aninhados (subpastas). Organize sua biblioteca por ano, tema ou coleção com relações pai/filho.
- 📁 **Escaneamento de ZIP Aprimorado**: Lógica de importação inteligente que identifica criadores e sets. 
    - **Prevenção de Duplicatas**: Verifica toda a biblioteca do criador para evitar a importação do mesmo item duas vezes.
    - **Ordenação Inteligente**: Arquivos na raiz ou com estruturas desconhecidas são movidos automaticamente para uma categoria "Não Selecionados".
- 📝 **Relatórios Prontos para Redes Sociais**: Gera listas de créditos formatadas especificamente para **Patreon** e **X (Twitter)**.
    - **Links Automáticos**: Nomes de sets são convertidos em links clicáveis se as URLs de Patreon/Website estiverem disponíveis.
    - **Estética Rica**: Usa emojis (📁, 📦) e indentação Markdown limpa para um visual profissional.
- 👤 **Gerenciador de Biblioteca Avançado**: Edite metadados (Patreon, Website, Links Sociais) de criadores e sets individuais diretamente.
- 🎨 **Interface Glass Premium**: Uma interface "glassy" deslumbrante com suporte nativo a **Acrylic/Mica** do Windows e cores de destaque personalizáveis.
- 🧠 **Busca Difusa de Criadores**: Usa distância Levenshtein para detectar nomes de criadores similares (ex: "Felixand" vs "Felixandre") para evitar entradas redundantes.
- 🗃️ **Persistência Robusta**: Armazenamento local usando SQLite com **Drizzle ORM** para gerenciamento de dados de alta performance.

## 💻 Stack Tecnológica

- **Framework**: Electron + Vite
- **Frontend**: React, Vanilla CSS (Glassmorphism), Lucide React
- **Database**: SQLite (via `better-sqlite3`) + **Drizzle ORM**
- **Utilitários**: `adm-zip` para processamento de arquivos, `fuse.js` para seleção

## 🏁 Começando

### Pré-requisitos

- [Node.js](https://nodejs.org/) (Última versão LTS recomendada)
- [npm](https://www.npmjs.com/)

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/devbrunoflorian/CC-Catalog.git
   cd CC-Catalog
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Execute em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

### Build para Produção

Para criar um instalador Windows:
```bash
npm run dist
```

## 🛠️ Como Funciona

A ferramenta analisa arquivos ZIP procurando por assinaturas de criadores e padrões de pastas:
- `Criador/NomeDoSet/NomeDoItem.package`
- `Mods/Criador/NomeDoSet/NomeDoItem.package`

Durante o escaneamento, se um nome for similar a um já existente no banco de dados, o CC Catalog perguntará se é um novo criador ou uma variação de um existente.

## ✅ Atualizações Recentes

- [x] **Sets Aninhados**: Suporte a drag and drop para criar hierarquias de pastas.
- [x] **Relatório V2**: Geração de markdown visual com emojis e links.
- [x] **Sincronização de Metadados**: Salvamento persistente de URLs com auto-sync.
- [x] **Filtro Global de Duplicatas**: Evita a importação de arquivos repetidos entre diferentes sets de um mesmo criador.
- [x] **Tema Glass**: Efeitos de transparência nativos do Windows e tintura customizada.
