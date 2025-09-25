# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-25

### Added
- **Multi-LLM Conversation**: Chat with multiple Large Language Models simultaneously in a unified interface
- **Provider Support**:
  - API-based providers (OpenAI, Anthropic, and others)
  - Local models through Ollama integration
  - Local models through LM Studio integration
- **Shared Memory System**: Enables LLMs to share context and learn from each other during conversations
- **LLM-to-LLM Communication**: Direct communication between different language models
- **Conversation Management**:
  - Save conversations for later reference
  - Load previous conversations
  - Delete unwanted conversations
  - Export conversations in various formats
- **Performance Dashboard**: Detailed performance metrics for each model including response times and token usage
- **Cost and Budget Management**: Track API costs and manage budget effectively
- **Tool Usage**: Extend LLM capabilities with custom tools and functions
- **Theming**: Customizable appearance with theme support
- **Cross-Platform Support**: Native applications for Windows, macOS, and Linux

### Features
- Modern Electron-based desktop application
- React-based user interface with TypeScript
- SQLite database for conversation persistence
- WebSocket support for streaming responses
- Comprehensive error handling and reporting
- Modular architecture for easy extension

### Known Issues
- Some tests are failing due to mock environment differences
- Windows build requires manual packaging due to symbolic link permission issues
- Performance metrics may need calibration for certain providers

### Technical Stack
- Electron 25.0.0
- React 18.2.0
- TypeScript 5.1.0
- Better-SQLite3 for data persistence
- Webpack for bundling
- Vitest for testing

[1.0.0]: https://github.com/jaysalomon/MultiLLM/releases/tag/v1.0.0