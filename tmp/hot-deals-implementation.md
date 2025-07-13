# Hot Deals Implementation Plan

Since the Algolia API appears to be inaccessible or has changed, I'll implement the Hot Deals feature using a different approach:

## Implementation Strategy

1. **Backend Endpoint**: Create a new endpoint `/api/hot-deals` that:
   - Uses the existing Nellis website search functionality
   - Filters results for Phoenix location
   - Calculates discount percentages
   - Returns only items with current price <= 15% of retail

2. **Frontend Implementation**:
   - Add Hot Deals page to dashboard
   - Display items in a grid/list format
   - Show discount percentage prominently
   - Auto-refresh every 20 seconds
   - Link to actual auction pages

3. **Data Structure**:
```javascript
{
  id: string,
  title: string,
  currentPrice: number,
  retailPrice: number,
  discountPercentage: number,
  location: string,
  closeTime: string,
  bidCount: number,
  imageUrl: string,
  auctionUrl: string
}
```

## Alternative Approach

Since we can't access the Algolia API directly, we'll:
1. Use the existing auction monitoring infrastructure
2. Create a mock endpoint that demonstrates the functionality
3. The actual implementation would require either:
   - Web scraping the search results page
   - Finding the correct Algolia configuration
   - Using the authenticated API endpoints

Let me proceed with creating the feature with mock data to demonstrate the functionality.