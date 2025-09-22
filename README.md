# Multi-LLM Chat

A desktop application for chatting with multiple Large Language Models simultaneously.

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the application in development mode with hot reload:

```bash
npm run dev
```

This will:
- Start the webpack dev server for the renderer process
- Compile the main process with TypeScript watch mode
- Launch the Electron application

### Building

To build the application for production:

```bash
npm run build
```

To create distributable packages:

```bash
npm run dist
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Main application entry point
│   └── preload.ts  # Preload script for secure IPC
└── renderer/       # React renderer process
    ├── index.tsx   # React entry point
    ├── App.tsx     # Main App component
    ├── App.css     # App styles
    └── types/      # TypeScript type definitions
```

## Features (Planned)

- Multi-LLM conversation interface
- Support for API-based providers (OpenAI, Anthropic, etc.)
- Local model support (Ollama, LM Studio)
- Shared memory system for persistent context
- LLM-to-LLM communication
- Conversation export and management