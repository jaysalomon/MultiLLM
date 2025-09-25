# Multi-LLM Chat - Installation Guide

**Note:** Multi-LLM Chat is a cross-platform application and runs on Windows, macOS, and Linux.

## For Users (Recommended)

This is the easiest way to install Multi-LLM Chat. We provide pre-built packages for Windows, macOS, and Linux that you can install with a single click.

1.  Go to the [**GitHub releases page**](https://github.com/your-username/multi-llm-chat/releases).
2.  Download the appropriate file for your operating system:
    -   **Windows:** `Multi-LLM-Chat-Setup-x.y.z.exe`
    -   **macOS:** `Multi-LLM-Chat-x.y.z.dmg`
    -   **Linux:** `Multi-LLM-Chat-x.y.z.AppImage`
3.  Once downloaded, simply run the installer and follow the on-screen instructions.

## For Developers

If you want to build the application from source, you will need to have Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/multi-llm-chat.git
    ```
2.  **Install dependencies:**
    ```bash
    cd multi-llm-chat
    npm install
    ```
3.  **Run in development mode:**
    ```bash
    npm run dev
    ```
4.  **Build distributable packages:**
    ```bash
    npm run dist
    ```
    This will create the installers in the `release` directory.

## First-Time Setup

After installing and launching the application, you will be guided through a first-time setup process to configure your LLM providers.

## Troubleshooting

If you encounter any issues during installation or use, please refer to the [Troubleshooting](#troubleshooting) section in this guide or open an issue on our [GitHub repository](https://github.com/your-username/multi-llm-chat/issues).