# Multi-LLM Chat - Installation Guide

**Note:** Multi-LLM Chat is a cross-platform application and runs on Windows, macOS, and Linux.

## System Requirements

### Minimum Requirements
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Network**: Internet connection for LLM provider access

### Recommended Requirements
- **RAM**: 8GB or more for better performance with multiple models
- **Storage**: 1GB free space for conversation history and embeddings
- **CPU**: Multi-core processor for concurrent LLM requests

## Installation Methods

### Method 1: Pre-built Releases (Recommended for most users)

This is the easiest way to install Multi-LLM Chat. We provide pre-built packages for Windows, macOS, and Linux.

1.  Go to the [GitHub releases page](https://github.com/your-username/multi-llm-chat/releases).
2.  Download the appropriate file for your operating system:
    -   **Windows:** `Multi-LLM-Chat-Setup-x.y.z.exe`
    -   **macOS:** `Multi-LLM-Chat-x.y.z.dmg`
    -   **Linux:** `Multi-LLM-Chat-x.y.z.AppImage`
3.  Follow the installation instructions for your operating system below.

#### Windows
1. Download the latest release from the GitHub releases page
2. Extract the ZIP file to your desired location
3. Ensure Node.js 18+ is installed on your system
4. Navigate to the extracted folder
5. Double-click `start.bat` to launch the application

#### macOS
1. Download the `.dmg` file from the GitHub releases page
2. Open the `.dmg` file
3. Drag the Multi-LLM Chat app to your Applications folder
4. Launch from Applications or Spotlight

#### Linux
1. Download the `.AppImage` file from the GitHub releases page
2. Make it executable: `chmod +x Multi-LLM-Chat-*.AppImage`
3. Run the application: `./Multi-LLM-Chat-*.AppImage`

### Method 2: Build from Source

#### Prerequisites
- Node.js 18+ and npm
- Git (for cloning the repository)

#### Steps
```bash
# Clone the repository
git clone https://github.com/your-username/multi-llm-chat.git
cd multi-llm-chat

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## First-Time Setup

### 1. Launch the Application
- The application will create a local database on first run
- No internet connection required for initial setup

### 2. Configure LLM Providers
The application supports multiple LLM providers:

#### API-Based Providers (OpenAI, Anthropic, etc.)
1. Click "Add Provider" in the sidebar
2. Select "API Provider"
3. Enter your API key and endpoint
4. Test the connection
5. Save the configuration

#### Local Ollama
1. Install Ollama on your system (https://ollama.ai)
2. Start Ollama service
3. In Multi-LLM Chat, click "Add Provider"
4. Select "Ollama"
5. Configure the local endpoint (usually http://localhost:11434)
6. Select available models

#### LM Studio
1. Install and run LM Studio
2. Load a model in LM Studio
3. Enable the API server in LM Studio
4. In Multi-LLM Chat, click "Add Provider"
5. Select "LM Studio"
6. Configure the endpoint (usually http://localhost:1234)

### 3. Start Your First Conversation
1. Add at least one LLM provider
2. Click "New Conversation"
3. Type your message and press Enter
4. Watch as multiple LLMs respond simultaneously

## Configuration

### Data Storage
- **Conversations**: Stored locally in SQLite database
- **Settings**: Saved in application data directory
- **API Keys**: Securely stored in OS credential manager

### File Locations

#### Windows
- Application Data: `%APPDATA%\multi-llm-chat\`
- Database: `%APPDATA%\multi-llm-chat\conversations.db`
- Logs: `%APPDATA%\multi-llm-chat\logs\`

#### macOS
- Application Data: `~/Library/Application Support/multi-llm-chat/`
- Database: `~/Library/Application Support/multi-llm-chat/conversations.db`
- Logs: `~/Library/Logs/multi-llm-chat/`

#### Linux
- Application Data: `~/.config/multi-llm-chat/`
- Database: `~/.config/multi-llm-chat/conversations.db`
- Logs: `~/.config/multi-llm-chat/logs/`

## Troubleshooting

### Application Won't Start

#### Windows
- Ensure Node.js is installed and in PATH
- Try running as administrator
- Check Windows Defender isn't blocking the application

#### macOS
- If you see "App can't be opened because it's from an unidentified developer":
  - Right-click the app and select "Open"
  - Click "Open" in the security dialog
- Check System Preferences > Security & Privacy

#### Linux
- Ensure the AppImage has execute permissions
- Install required system libraries: `sudo apt-get install libgtk-3-0 libxss1 libasound2`

### Database Issues
- If the database becomes corrupted, delete the database file (see locations above)
- The application will create a new database on next startup
- Conversations will be lost but settings will be preserved

### Network Connection Problems
- Check your internet connection
- Verify API keys are correct and have sufficient credits
- For local providers (Ollama, LM Studio), ensure they're running and accessible

### Performance Issues
- Close unnecessary applications to free up RAM
- Reduce the number of active LLM providers
- Clear old conversation history if the database becomes large

## Security and Privacy

### Data Privacy
- All conversations are stored locally on your device
- No data is sent to external servers except to configured LLM providers
- API keys are encrypted and stored securely

### Network Security
- All API communications use HTTPS
- Local providers communicate over HTTP (localhost only)
- No telemetry or usage data is collected

## Getting Help

### Documentation
- Check the README.md for feature overview
- Review the DEPLOYMENT.md for technical details
- Browse the source code for implementation details

### Support Channels
- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share tips
- Wiki: Community-maintained guides and tutorials

### Common Solutions
1. **Restart the application** - Fixes most temporary issues
2. **Clear application data** - Resets all settings and conversations
3. **Update providers** - Ensure LLM services are running and accessible
4. **Check logs** - Look for error messages in the log files

## Uninstallation

### Windows
1. Delete the application folder
2. Remove application data folder (optional, contains conversations)
3. Remove from Windows credential manager (optional, removes saved API keys)

### macOS
1. Move the app from Applications to Trash
2. Delete application data folder (optional)
3. Remove from Keychain Access (optional)

### Linux
1. Delete the AppImage file
2. Remove application data folder (optional)
3. Clear any desktop integration files

## Updates

### Automatic Updates
- Currently not implemented
- Check GitHub releases page for new versions

### Manual Updates
1. Download the latest release
2. Replace the old application files
3. Restart the application
4. Your conversations and settings will be preserved