#!/usr/bin/env bash

# Nellis Auction Helper - Chrome Extension Manager
# Cross-platform script for macOS and Windows (Git Bash/WSL/Cygwin)

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")/extension"
MANIFEST_PATH="$EXTENSION_DIR/manifest.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Detect OS
detect_os() {
    case "$OSTYPE" in
        darwin*)  OS="macos" ;;
        linux*)   OS="linux" ;;
        msys*|cygwin*|win32) OS="windows" ;;
        *)        OS="unknown" ;;
    esac
    
    # Additional check for Windows
    if [[ -n "$WINDIR" ]] || [[ -n "$SYSTEMROOT" ]]; then
        OS="windows"
    fi
}

# Find Chrome executable
find_chrome() {
    local chrome_path=""
    
    case "$OS" in
        macos)
            local paths=(
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
                "/Applications/Chromium.app/Contents/MacOS/Chromium"
            )
            ;;
        windows)
            local paths=(
                "/c/Program Files/Google/Chrome/Application/chrome.exe"
                "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
                "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe"
                "$PROGRAMFILES/Google/Chrome/Application/chrome.exe"
            )
            # Convert Windows paths for Git Bash
            if command -v cygpath >/dev/null 2>&1; then
                paths+=("$(cygpath -u "$PROGRAMFILES/Google/Chrome/Application/chrome.exe" 2>/dev/null || true)")
                paths+=("$(cygpath -u "$PROGRAMFILES (x86)/Google/Chrome/Application/chrome.exe" 2>/dev/null || true)")
                paths+=("$(cygpath -u "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe" 2>/dev/null || true)")
            fi
            ;;
        linux)
            local paths=(
                "/usr/bin/google-chrome"
                "/usr/bin/google-chrome-stable"
                "/usr/bin/chromium"
                "/usr/bin/chromium-browser"
                "/snap/bin/chromium"
            )
            ;;
    esac
    
    for path in "${paths[@]}"; do
        if [[ -f "$path" ]] || [[ -x "$path" ]]; then
            chrome_path="$path"
            break
        fi
    done
    
    if [[ -z "$chrome_path" ]]; then
        echo -e "${RED}Chrome not found. Please ensure Google Chrome is installed.${NC}"
        exit 1
    fi
    
    echo "$chrome_path"
}

# Get extension info from manifest
get_extension_info() {
    if [[ ! -f "$MANIFEST_PATH" ]]; then
        echo -e "${RED}Manifest file not found: $MANIFEST_PATH${NC}"
        exit 1
    fi
    
    # Use different JSON parsing based on what's available
    if command -v jq >/dev/null 2>&1; then
        NAME=$(jq -r '.name' "$MANIFEST_PATH")
        VERSION=$(jq -r '.version' "$MANIFEST_PATH")
        DESCRIPTION=$(jq -r '.description' "$MANIFEST_PATH")
        PERMISSIONS=$(jq -r '.permissions[]?' "$MANIFEST_PATH" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    elif command -v python3 >/dev/null 2>&1; then
        NAME=$(python3 -c "import json; print(json.load(open('$MANIFEST_PATH'))['name'])")
        VERSION=$(python3 -c "import json; print(json.load(open('$MANIFEST_PATH'))['version'])")
        DESCRIPTION=$(python3 -c "import json; print(json.load(open('$MANIFEST_PATH'))['description'])")
        PERMISSIONS=$(python3 -c "import json; perms=json.load(open('$MANIFEST_PATH')).get('permissions',[]); print(','.join(perms))")
    elif command -v python >/dev/null 2>&1; then
        NAME=$(python -c "import json; print(json.load(open('$MANIFEST_PATH'))['name'])")
        VERSION=$(python -c "import json; print(json.load(open('$MANIFEST_PATH'))['version'])")
        DESCRIPTION=$(python -c "import json; print(json.load(open('$MANIFEST_PATH'))['description'])")
        PERMISSIONS=$(python -c "import json; perms=json.load(open('$MANIFEST_PATH')).get('permissions',[]); print(','.join(perms))")
    else
        # Basic grep fallback
        NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST_PATH" | cut -d'"' -f4)
        VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST_PATH" | cut -d'"' -f4)
        DESCRIPTION=$(grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST_PATH" | cut -d'"' -f4)
        PERMISSIONS="storage,alarms,notifications,cookies"
    fi
}

# Open Chrome extensions page
open_chrome_extensions() {
    local chrome_path=$(find_chrome)
    echo -e "${CYAN}Opening Chrome extensions page...${NC}"
    
    case "$OS" in
        macos)
            open -a "$chrome_path" "chrome://extensions/" 2>/dev/null || {
                echo -e "${RED}Failed to open Chrome${NC}"
                return 1
            }
            ;;
        windows)
            if command -v cmd.exe >/dev/null 2>&1; then
                cmd.exe /c start "" "$chrome_path" "chrome://extensions/" 2>/dev/null || {
                    echo -e "${RED}Failed to open Chrome${NC}"
                    return 1
                }
            else
                "$chrome_path" "chrome://extensions/" &
            fi
            ;;
        linux)
            "$chrome_path" "chrome://extensions/" > /dev/null 2>&1 &
            ;;
    esac
    
    echo -e "${GREEN}Chrome extensions page opened${NC}"
}

# Install extension
install_extension() {
    echo -e "${CYAN}Installing Nellis Auction Helper extension...${NC}"
    
    if [[ ! -d "$EXTENSION_DIR" ]]; then
        echo -e "${RED}Extension directory not found: $EXTENSION_DIR${NC}"
        exit 1
    fi
    
    get_extension_info
    
    echo -e "\n${BOLD}Extension Details:${NC}"
    echo -e "  Name: $NAME"
    echo -e "  Version: $VERSION"
    echo -e "  Description: $DESCRIPTION"
    echo -e "  Path: $EXTENSION_DIR"
    
    # Open Chrome extensions page in existing or new window
    echo -e "\n${CYAN}Opening Chrome extensions page...${NC}"
    
    case "$OS" in
        macos)
            # Use AppleScript to open URL in Chrome
            osascript -e 'tell application "Google Chrome"
                activate
                if (count of windows) = 0 then
                    make new window
                end if
                set URL of active tab of front window to "chrome://extensions/"
            end tell' 2>/dev/null || {
                # Fallback: try opening with open command
                open -a "Google Chrome" "chrome://extensions/" 2>/dev/null || {
                    echo -e "${RED}Failed to open Chrome${NC}"
                    return 1
                }
            }
            ;;
        windows)
            # Try to open in existing Chrome
            if command -v cmd.exe >/dev/null 2>&1; then
                cmd.exe /c start chrome "chrome://extensions/" 2>/dev/null || {
                    # Fallback: launch Chrome with URL
                    local chrome_path=$(find_chrome)
                    cmd.exe /c start "" "$chrome_path" "chrome://extensions/"
                }
            else
                # For Git Bash/WSL
                start chrome "chrome://extensions/" 2>/dev/null || {
                    local chrome_path=$(find_chrome)
                    "$chrome_path" "chrome://extensions/" &
                }
            fi
            ;;
        linux)
            # Use xdg-open or direct Chrome command
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "chrome://extensions/" 2>/dev/null || {
                    local chrome_path=$(find_chrome)
                    "$chrome_path" "chrome://extensions/" > /dev/null 2>&1 &
                }
            else
                local chrome_path=$(find_chrome)
                "$chrome_path" "chrome://extensions/" > /dev/null 2>&1 &
            fi
            ;;
    esac
    
    # Give Chrome a moment to open the page
    sleep 1
    
    echo -e "${GREEN}✅ Chrome extensions page opened${NC}"
    
    # Copy extension path to clipboard if possible
    if [[ "$OS" == "macos" ]]; then
        echo -n "$EXTENSION_DIR" | pbcopy 2>/dev/null && {
            echo -e "${GREEN}✅ Extension path copied to clipboard${NC}"
        }
    elif command -v xclip >/dev/null 2>&1; then
        echo -n "$EXTENSION_DIR" | xclip -selection clipboard 2>/dev/null && {
            echo -e "${GREEN}✅ Extension path copied to clipboard${NC}"
        }
    fi
    
    echo -e "\n${BOLD}Steps to complete installation:${NC}"
    echo -e "1. ${YELLOW}Enable 'Developer mode'${NC} toggle in the top right corner"
    echo -e "2. Click the ${YELLOW}'Load unpacked'${NC} button"
    echo -e "3. Navigate to and select this folder:"
    echo -e "   ${CYAN}$EXTENSION_DIR${NC}"
    if [[ "$OS" == "macos" ]] || command -v xclip >/dev/null 2>&1; then
        echo -e "   ${GREEN}(Path has been copied to your clipboard - just paste it!)${NC}"
    fi
    echo -e "4. Click 'Select' to install the extension"
    echo -e "5. The extension '${NAME}' will appear in the list"
    echo -e "6. Click the puzzle piece icon (🧩) in toolbar and pin the extension"
    
    echo -e "\n${GREEN}✅ Installation guide complete!${NC}"
}

# Refresh extension
refresh_extension() {
    echo -e "${CYAN}Refreshing Nellis Auction Helper extension...${NC}"
    
    if [[ ! -d "$EXTENSION_DIR" ]]; then
        echo -e "${RED}Extension directory not found: $EXTENSION_DIR${NC}"
        exit 1
    fi
    
    get_extension_info
    
    echo -e "\n${BOLD}Current Version: $VERSION${NC}"
    echo -e "\n${YELLOW}To refresh the extension:${NC}"
    echo -e "1. Go to Chrome extensions page"
    echo -e "2. Find 'Nellis Auction Helper'"
    echo -e "3. Click the refresh icon (circular arrow)"
    echo -e "4. Or use Ctrl+R (Cmd+R on Mac) on the extensions page"
    
    open_chrome_extensions
}

# Remove extension
remove_extension() {
    echo -e "${CYAN}Removing Nellis Auction Helper extension...${NC}"
    
    get_extension_info
    
    echo -e "\n${BOLD}Extension to remove: $NAME v$VERSION${NC}"
    echo -e "\n${YELLOW}To remove the extension:${NC}"
    echo -e "1. Go to Chrome extensions page"
    echo -e "2. Find 'Nellis Auction Helper'"
    echo -e "3. Click 'Remove'"
    echo -e "4. Confirm the removal"
    
    open_chrome_extensions
}

# Check status
check_status() {
    echo -e "${CYAN}Checking Nellis Auction Helper extension status...${NC}"
    
    if [[ ! -d "$EXTENSION_DIR" ]]; then
        echo -e "\n${RED}❌ Extension directory not found${NC}"
        return
    fi
    
    if [[ ! -f "$MANIFEST_PATH" ]]; then
        echo -e "\n${RED}❌ Manifest file not found${NC}"
        return
    fi
    
    get_extension_info
    
    echo -e "\n${GREEN}✅ Extension files found${NC}"
    echo -e "\n${BOLD}Extension Information:${NC}"
    echo -e "  Name: $NAME"
    echo -e "  Version: $VERSION"
    echo -e "  Description: $DESCRIPTION"
    echo -e "  Directory: $EXTENSION_DIR"
    echo -e "  OS: $OS"
    
    if [[ -n "$PERMISSIONS" ]]; then
        echo -e "\n${BOLD}  Permissions:${NC}"
        IFS=',' read -ra PERMS <<< "$PERMISSIONS"
        for perm in "${PERMS[@]}"; do
            echo -e "    - $perm"
        done
    fi
    
    # Check required files
    echo -e "\n${BOLD}  Required Files:${NC}"
    local required_files=(
        "manifest.json"
        "src/background.js"
        "src/content-isolated.js"
        "popup/popup.html"
        "popup/popup.js"
    )
    
    local all_files_present=true
    for file in "${required_files[@]}"; do
        if [[ -f "$EXTENSION_DIR/$file" ]]; then
            echo -e "    ${GREEN}✅ $file${NC}"
        else
            echo -e "    ${RED}❌ $file${NC}"
            all_files_present=false
        fi
    done
    
    if [[ "$all_files_present" == true ]]; then
        echo -e "\n${GREEN}✅ Extension is ready to install${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Some required files are missing${NC}"
    fi
    
    echo -e "\n${YELLOW}To check if installed in Chrome:${NC}"
    echo -e "1. Open Chrome extensions page"
    echo -e "2. Look for 'Nellis Auction Helper'"
    echo -e "3. Check if it's enabled"
}

# Show help
show_help() {
    echo -e "\n${BOLD}Nellis Auction Helper - Chrome Extension Manager${NC}"
    echo -e "================================================\n"
    echo -e "Usage: $0 [command]\n"
    echo -e "Commands:"
    echo -e "  ${GREEN}install${NC}    - Install the extension in Chrome"
    echo -e "  ${GREEN}refresh${NC}    - Refresh/reload the extension"
    echo -e "  ${GREEN}remove${NC}     - Remove the extension from Chrome"
    echo -e "  ${GREEN}status${NC}     - Check extension status"
    echo -e "  ${GREEN}help${NC}       - Show this help message\n"
    echo -e "Example:"
    echo -e "  $0 install"
}

# Main execution
detect_os

if [[ "$OS" == "unknown" ]]; then
    echo -e "${RED}Unsupported operating system${NC}"
    exit 1
fi

COMMAND="${1:-help}"

case "$COMMAND" in
    install)
        install_extension
        ;;
    refresh|reload)
        refresh_extension
        ;;
    remove|uninstall)
        remove_extension
        ;;
    status|check)
        check_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac