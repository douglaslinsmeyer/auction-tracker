# Nellis Auction Helper

A Chrome extension to help monitor and bid on auctions at nellisauction.com

## Features

- Automatic auction detection on browse pages
- Real-time bid monitoring
- Support for the 30-second rule (bid in last 30 seconds resets timer)
- Visual indicators on auction items
- Popup interface to view all monitored auctions
- Configurable bid strategies

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top right
3. Click "Load unpacked"
4. Select the `nellis-auction-helper` folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the extension icon to open the popup
2. Toggle the extension on/off using the main switch
3. Visit nellisauction.com
4. Look for the blue "Monitor" buttons on auction items
5. Click to start monitoring any auction
6. On individual auction pages, use the detailed monitoring panel

## Settings

- **Default Max Bid**: Set a default maximum bid amount
- **Bid Strategy**: 
  - Manual Only: Just monitor, no automatic bidding
  - Incremental: Automatically bid in small increments
  - Snipe: Bid in the last 30 seconds
- **Notifications**: Enable/disable outbid notifications

## Development Status

Phase 1 Complete ✅
- Basic extension structure
- Content script for page interaction  
- Background service worker
- Popup UI
- Settings storage

## Next Steps

- Phase 2: Enhanced auction detection and real-time updates
- Phase 3: Implement bidding strategies
- Phase 4: Advanced UI and analytics