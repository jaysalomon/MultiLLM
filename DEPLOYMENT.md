# Multi-LLM Chat - Deployment Guide

## Build Process

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git (for development)

### Development Build
```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

### Production Build

#### Method 1: Manual Distribution (Recommended for Windows)
```bash
# Build the application
npm run build

# Create manual distribution
node scripts/build-dist.js

# Navigate to the distribution directory
cd release/manual-build

# Install production dependencies
npm install --production

# Test the build
npx electron dist/main.js
```

#### Method 2: Electron Builder (Linux/macOS)
```bash
# Build and package
npm run dist

# Or just package without installer
npm run pack
```

## Platform-Specific Instructions

### Windows
Due to Windows permissions issues with electron-builder, use the manual distribution method:

1. Run `npm run build` to compile the application
2. Run `node scripts/build-dist.js` to create the distribution
3. The distributable will be in `release/manual-build/`
4. Users can run `start.bat` to launch the application

### macOS
```bash
# Build for macOS
npm run dist

# Output will be in release/ directory as .dmg file
```

### Linux
```bash
# Build for Linux
npm run dist

# Output will be in release/ directory as .AppImage file
```

## Testing the Build

### Core Functionality Tests
1. **Application Startup**: Verify the app starts without errors
2. **Database Initialization**: Check that SQLite database is created
3. **UI Rendering**: Ensure the React interface loads properly
4. **Provider Configuration**: Test adding LLM providers
5. **Basic Chat**: Send a test message (if providers are configured)

### Test Commands
```bash
# Run unit tests
npm test

# Run specific test suites
npm run test:database
npm run test:ui
npm run test:providers
```

## Dependencies Verification

### Critical Dependencies
- **Electron**: Desktop application framework
- **React**: UI framework
- **SQLite (sql.js)**: Local database
- **TypeScript**: Type safety and compilation
- **Webpack**: Bundling for renderer process

### Production Dependencies Check
```bash
# Verify all production dependencies are included
npm ls --production

# Check for security vulnerabilities
npm audit
```

## Distribution Structure

```
release/manual-build/
├── dist/
│   ├── main.js          # Main Electron process
│   ├── renderer.js      # React UI bundle
│   └── index.html       # HTML entry point
├── node_modules/        # Production dependencies
├── package.json         # Package configuration
└── start.bat           # Windows startup script
```

## Installation Instructions for End Users

### Windows
1. Download the `manual-build` folder
2. Ensure Node.js is installed on the target system
3. Double-click `start.bat` to launch the application

### macOS/Linux
1. Download the appropriate installer (.dmg for macOS, .AppImage for Linux)
2. Install/run the application following standard OS procedures

## Troubleshooting

### Common Build Issues

#### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript compilation errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix any type errors before building
```

#### Electron-builder permission issues (Windows)
- Use the manual distribution method instead
- Ensure you have administrator privileges if using electron-builder

### Runtime Issues

#### Database initialization fails
- Check write permissions in the application directory
- Verify SQLite dependencies are properly bundled

#### UI doesn't load
- Check that renderer.js and index.html are in the dist/ directory
- Verify webpack build completed successfully

#### Provider connection issues
- Ensure network connectivity
- Check API keys and endpoints are correctly configured
- Verify provider-specific dependencies are included

## Performance Optimization

### Build Size Optimization
- Use `npm install --production` for distribution
- Exclude development dependencies from packaging
- Consider using webpack bundle analyzer to identify large dependencies

### Runtime Performance
- Monitor memory usage during long conversations
- Implement proper cleanup for database connections
- Use streaming responses for better perceived performance

## Security Considerations

### API Key Storage
- API keys are stored in OS keychain/credential manager
- Never include API keys in the distributed package
- Provide clear instructions for users to add their own keys

### Network Security
- All external communications use HTTPS
- Validate all user inputs before processing
- Implement proper error handling to avoid information leakage

## Automated Testing in CI/CD

### GitHub Actions Example
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm run pack
```

### Test Coverage
- Aim for >80% code coverage
- Include integration tests for critical paths
- Test on multiple platforms before release

## Release Process

1. **Version Bump**: Update version in package.json
2. **Build**: Create production builds for all platforms
3. **Test**: Run full test suite on built applications
4. **Documentation**: Update README and deployment docs
5. **Release**: Create GitHub release with binaries
6. **Verification**: Test downloads and installation process

## Support and Maintenance

### Log Files
- Application logs are stored in the user's app data directory
- Include log collection instructions for user support
- Implement proper log rotation to prevent disk space issues

### Update Mechanism
- Consider implementing auto-updater for future versions
- Provide manual update instructions
- Maintain backward compatibility for user data