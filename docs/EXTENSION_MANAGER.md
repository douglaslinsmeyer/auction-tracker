# Chrome Extension Manager

A cross-platform bash script to manage the Nellis Auction Helper Chrome extension installation, updates, and removal.

## Usage

From the project root directory:

```bash
# Check extension status
./manage-extension status

# Install the extension
./manage-extension install

# Refresh/reload the extension
./manage-extension refresh

# Remove the extension
./manage-extension remove

# Show help
./manage-extension help
```

## Direct Script Execution

You can also run the script directly:

```bash
# From project root
./scripts/manage-extension.sh status

# Or with explicit bash
bash scripts/manage-extension.sh status
```

## Platform Support

The unified bash script (`manage-extension.sh`) automatically detects and supports:
- macOS
- Windows (Git Bash, WSL, Cygwin)
- Linux

## Features

- **Status Check**: Verifies extension files and displays current version
- **Install Guide**: Opens Chrome extensions page and provides installation steps
- **Refresh**: Helps reload the extension after code changes
- **Remove**: Guides through the extension removal process

## Requirements

- Google Chrome installed
- Bash shell (Git Bash on Windows)
- Optional: jq or Python for better JSON parsing

## Troubleshooting

If Chrome is not found:
1. Ensure Google Chrome is installed in the default location
2. For custom installations, update the Chrome paths in the script
3. On Windows, ensure Git Bash or WSL is properly installed