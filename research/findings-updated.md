# Nellis Auction Backend Communication Analysis - Updated

## Executive Summary

Nellis Auction uses **Server-Sent Events (SSE)** for real-time updates on individual auction pages. The SSE connection is product-specific and provides live updates for bids and auction status changes.

## Key Findings

### 1. **SSE Implementation Confirmed**
- **Endpoint**: `https://sse.nellisauction.com/live-products?productId={productId}`
- **Active on**: Individual product/auction pages only
- **Not active on**: Browse/listing pages

### 2. **Real-time Event Types**

#### Standard Events:
- **Connection**: Initial "connected" message with session ID
- **Keepalive**: Regular "ping" messages to maintain connection

#### Custom Events:
- **`ch_product_bids:{productId}`**: Bid update notifications
- **`ch_product_closed:{productId}`**: Auction closure notifications

### 3. **Communication Flow**
```
1. User navigates to auction page
2. JavaScript creates EventSource connection to SSE endpoint
3. Server confirms connection with session ID
4. Server sends periodic "ping" messages
5. When bids occur, server sends events on ch_product_bids channel
6. When auction closes, server sends event on ch_product_closed channel
```

### 4. **Technical Details**

#### SSE Connection Example:
```javascript
// Actual connection observed:
const eventSource = new EventSource('https://sse.nellisauction.com/live-products?productId=58040119');

// Custom event listeners registered:
eventSource.addEventListener('ch_product_bids:58040119', handleBidUpdate);
eventSource.addEventListener('ch_product_closed:58040119', handleAuctionClosed);
```

#### Message Examples:
- Connection: `connected e1e9792f-0711-4222-9bac-9bf1ceab265b,0xc0036d33b0-0xc0036d3420`
- Keepalive: `ping`
- Bid updates: (sent via custom event channel)

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────────┐
│                 │         │                      │
│  Auction Page   │ ──SSE──►│ sse.nellisauction.com│
│  (Browser)      │         │  /live-products      │
│                 │         │                      │
└─────────────────┘         └──────────────────────┘
        │                            │
        │                            │ Event: ch_product_bids:12345
        │                            │ Event: ch_product_closed:12345
        ▼                            ▼
┌─────────────────┐         ┌──────────────────────┐
│  Update UI      │         │   Auction Backend    │
│  - Timer        │         │   - Bid Processing   │
│  - Current Bid  │         │   - Timer Management │
│  - Bid Count    │         │                      │
└─────────────────┘         └──────────────────────┘
```

## Implementation Recommendations

### For Our Auction Helper:

1. **Connection Strategy**:
   - Establish SSE connection when monitoring specific auction
   - Use product ID from URL to construct SSE endpoint
   - Handle reconnection on connection loss

2. **Event Handling**:
   ```javascript
   const productId = extractProductId(auctionUrl);
   const sseUrl = `https://sse.nellisauction.com/live-products?productId=${productId}`;
   
   const eventSource = new EventSource(sseUrl);
   
   // Handle bid updates
   eventSource.addEventListener(`ch_product_bids:${productId}`, (event) => {
     const bidData = JSON.parse(event.data);
     updateBidInformation(bidData);
   });
   
   // Handle auction closure
   eventSource.addEventListener(`ch_product_closed:${productId}`, (event) => {
     handleAuctionEnd(event.data);
   });
   ```

3. **Fallback Strategy**:
   - Primary: SSE for real-time updates
   - Secondary: Periodic API polling if SSE fails
   - Tertiary: Page scraping as last resort

4. **Security Considerations**:
   - SSE connection doesn't require authentication
   - Bid placement still requires authenticated API calls
   - Monitor for rate limiting or connection restrictions

## Comparison: Expected vs Actual

| Feature | Expected | Actual |
|---------|----------|---------|
| Technology | WebSocket or Polling | Server-Sent Events |
| Scope | Site-wide | Product-specific |
| Authentication | Required | Not required for SSE |
| Events | Generic updates | Specific event channels |
| Keepalive | Not expected | Regular ping messages |

## Next Steps

1. Test SSE connection with active bidding to capture bid update format
2. Analyze the data structure of bid update events
3. Implement SSE client in the backend service
4. Test connection stability and reconnection logic
5. Monitor for any authentication requirements during high-activity periods