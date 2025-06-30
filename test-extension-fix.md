# Extension Cookie Sync Fix

## Problem
The extension was failing to sync cookies with the backend because it was sending the authentication token in the request body instead of the Authorization header.

## Error Message
```
backend-client.js:413 Cookie sync failed: 400 {"success":false,"error":"\"token\" is not allowed","code":"VALIDATION_ERROR","field":"token"}
```

## Root Cause
The backend API validation was rejecting the request because:
1. The `/api/auth` endpoint only accepts `cookies` in the request body
2. The authentication token should be sent in the `Authorization` header
3. The extension was incorrectly sending `token` in the request body

## Fix Applied
Updated `backend-client.js` to:
1. Remove `token` from request body in `syncCookies()` method
2. Add `Authorization` header with the auth token
3. Fixed all other API calls to use Authorization header instead of including token in body or query params

## Changes Made
1. `/api/auth` - Now sends token in Authorization header
2. `/api/auctions/:id/config` - Now sends token in Authorization header
3. `/api/auctions/:id/bid` - Now sends token in Authorization header  
4. `/api/auctions` - Now sends token in Authorization header (removed from query params)

## Testing
To test the fix:
1. Reload the extension in Chrome
2. Check the background service worker console
3. The cookie sync error should no longer appear
4. You should see "Cookie sync successful" or similar message

## Expected Behavior
After the fix, the extension should:
- Successfully sync cookies without validation errors
- Properly authenticate all API requests
- Show connected status in the popup