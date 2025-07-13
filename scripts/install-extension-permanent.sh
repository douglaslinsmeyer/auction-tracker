#!/usr/bin/env bash

# Permanent Chrome Extension Installation Helper
# This script helps install the extension permanently using Chrome's external extensions feature

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")/extension"
MANIFEST_PATH="$EXTENSION_DIR/manifest.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Get extension ID based on the directory path
get_extension_id() {
    # Chrome generates IDs based on the public key or directory path
    # For unpacked extensions, we'll use a hash of the path
    local id=$(echo -n "$EXTENSION_DIR" | shasum -a 256 | cut -c1-32 | tr '0-9' 'a-j')
    echo "$id"
}

# macOS installation
install_macos() {
    echo -e "${CYAN}Installing extension on macOS...${NC}"
    
    # Chrome external extensions directory
    local ext_dir="$HOME/Library/Application Support/Google/Chrome/External Extensions"
    mkdir -p "$ext_dir"
    
    local ext_id=$(get_extension_id)
    local json_file="$ext_dir/${ext_id}.json"
    
    # Create JSON file pointing to our extension
    cat > "$json_file" <<EOF
{
  "external_update_url": "file://${EXTENSION_DIR}/updates.xml"
}
EOF
    
    # Create updates.xml for the extension
    cat > "$EXTENSION_DIR/updates.xml" <<EOF
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${ext_id}'>
    <updatecheck codebase='file://${EXTENSION_DIR}' version='1.0.0' />
  </app>
</gupdate>
EOF
    
    echo -e "${GREEN}✅ Extension registered for installation${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Restart Chrome completely"
    echo -e "2. Chrome will prompt to install the extension"
    echo -e "3. Click 'Add extension' when prompted"
    
    # Alternative method - copy to Chrome's extensions directory
    echo -e "\n${CYAN}Alternative: Direct installation...${NC}"
    local chrome_ext_dir="$HOME/Library/Application Support/Google/Chrome/Default/Extensions"
    mkdir -p "$chrome_ext_dir"
    
    # Note: This requires Chrome to be closed and may need admin permissions
    echo -e "${YELLOW}To install directly (requires Chrome to be closed):${NC}"
    echo -e "cp -r '$EXTENSION_DIR' '$chrome_ext_dir/$ext_id'"
}

# Windows installation
install_windows() {
    echo -e "${CYAN}Installing extension on Windows...${NC}"
    
    local ext_id=$(get_extension_id)
    
    # Create registry entry for the extension
    echo -e "${YELLOW}Creating registry entry...${NC}"
    
    # Create a .reg file
    cat > "$EXTENSION_DIR/install-extension.reg" <<EOF
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Google\Chrome\Extensions\${ext_id}]
"path"="${EXTENSION_DIR//\//\\}"
"version"="1.0.0"
EOF
    
    echo -e "${GREEN}✅ Registry file created${NC}"
    echo -e "${YELLOW}To complete installation:${NC}"
    echo -e "1. Close Chrome completely"
    echo -e "2. Double-click: $EXTENSION_DIR/install-extension.reg"
    echo -e "3. Confirm the registry changes"
    echo -e "4. Restart Chrome"
}

# Linux installation
install_linux() {
    echo -e "${CYAN}Installing extension on Linux...${NC}"
    
    local ext_id=$(get_extension_id)
    local json_dir="/opt/google/chrome/extensions"
    
    # Check if we need sudo
    if [[ -w "$json_dir" ]]; then
        local sudo_cmd=""
    else
        local sudo_cmd="sudo"
        echo -e "${YELLOW}This may require sudo permissions...${NC}"
    fi
    
    # Create JSON file for the extension
    local json_content=$(cat <<EOF
{
  "external_crx": "${EXTENSION_DIR}",
  "external_version": "1.0.0"
}
EOF
)
    
    echo -e "${YELLOW}To install:${NC}"
    echo -e "1. Close Chrome"
    echo -e "2. Run: $sudo_cmd mkdir -p $json_dir"
    echo -e "3. Run: echo '$json_content' | $sudo_cmd tee $json_dir/${ext_id}.json"
    echo -e "4. Restart Chrome"
}

# Detect OS and install
case "$OSTYPE" in
    darwin*)
        install_macos
        ;;
    msys*|cygwin*|win32)
        install_windows
        ;;
    linux*)
        install_linux
        ;;
    *)
        echo -e "${RED}Unsupported OS: $OSTYPE${NC}"
        exit 1
        ;;
esac

echo -e "\n${BOLD}Manual Installation Alternative:${NC}"
echo -e "1. Open Chrome and go to: chrome://extensions/"
echo -e "2. Enable 'Developer mode'"
echo -e "3. Click 'Load unpacked'"
echo -e "4. Select: $EXTENSION_DIR"
echo -e "5. The extension will be permanently installed"