# AUTH_TOKEN Security Fix Migration Guide

## Breaking Change

As of version [current], the `AUTH_TOKEN` environment variable is now **required** and no longer has a default value. This is a critical security fix that prevents unauthorized access to the WebSocket API.

## Why This Change?

Previously, the system would fall back to a hardcoded token (`'dev-token'`) if `AUTH_TOKEN` was not set. This created a serious security vulnerability where production systems could be accessed with a known default token.

## Migration Steps

### 1. Generate a Secure Token

Generate a cryptographically secure token:

```bash
openssl rand -hex 32
```

Example output: `a7b9c3d5e8f2a1b4c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a2b5`

### 2. Update Your Environment

#### For Docker Users:
Update your `.env` file:
```env
AUTH_TOKEN=your-generated-token-here
```

#### For Direct Node.js:
Set the environment variable:
```bash
export AUTH_TOKEN=your-generated-token-here
# OR
AUTH_TOKEN=your-generated-token-here npm start
```

#### For Production:
Set the environment variable in your deployment platform (Kubernetes, Docker Swarm, etc.)

### 3. Update Client Applications

#### Chrome Extension:
The extension will need to be updated to include the auth token in WebSocket connections.

#### Web Dashboard:
- On first visit, you'll be prompted to enter your auth token
- The token is stored in browser localStorage
- To reset: Open browser console and run `localStorage.removeItem('authToken')`

#### Custom Integrations:
Update your WebSocket connection code:

```javascript
// Old (vulnerable)
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'dev-token'  // Hardcoded default
}));

// New (secure)
ws.send(JSON.stringify({
  type: 'authenticate',
  token: process.env.AUTH_TOKEN  // From environment
}));
```

## Troubleshooting

### Server Won't Start

**Error**: `AUTH_TOKEN environment variable is required. Please set it in your .env file or environment.`

**Solution**: Ensure AUTH_TOKEN is set in your environment before starting the server.

### WebSocket Authentication Fails

**Error**: `Invalid authentication token`

**Solution**: 
1. Verify the token matches between server and client
2. Check for typos or extra spaces
3. Ensure the token is being passed correctly

### Web Dashboard Keeps Prompting for Token

**Cause**: Authentication is failing with the provided token

**Solution**:
1. Clear browser localStorage: `localStorage.clear()`
2. Refresh the page
3. Enter the correct token from your `.env` file

## Security Best Practices

1. **Never commit tokens to version control**
   - Add `.env` to `.gitignore`
   - Use environment-specific configs

2. **Use different tokens per environment**
   - Development: `AUTH_TOKEN=dev-specific-token`
   - Staging: `AUTH_TOKEN=staging-specific-token`
   - Production: `AUTH_TOKEN=production-specific-token`

3. **Rotate tokens regularly**
   - Change tokens every 90 days
   - Update all clients when rotating

4. **Monitor for unauthorized access**
   - Check logs for failed authentication attempts
   - Set up alerts for suspicious activity

## Rollback Procedure

If you must temporarily rollback (NOT RECOMMENDED):

1. Revert the websocket.js changes
2. Restart the server

⚠️ **WARNING**: Rolling back reintroduces the security vulnerability. Only do this in isolated development environments.

## Timeline

- **Immediate**: Update all production systems
- **Within 24 hours**: Update all staging systems
- **Within 1 week**: Update all development systems
- **Within 2 weeks**: Ensure all clients are updated

## Questions?

If you encounter issues during migration, please:
1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Contact the development team with specific error details