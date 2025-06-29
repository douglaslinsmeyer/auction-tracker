# Request Signing Documentation

## Overview

Request signing provides an additional layer of security for API requests by using HMAC-SHA256 signatures. This helps prevent:
- CSRF (Cross-Site Request Forgery) attacks
- Request tampering
- Replay attacks (with timestamp validation)

## Configuration

### Environment Variables

```bash
# Enable request signing (optional, defaults to false)
ENABLE_REQUEST_SIGNING=true

# Secret key for HMAC-SHA256 signatures (required if signing is enabled)
# Generate using: openssl rand -hex 32
API_SIGNING_SECRET=your-256-bit-secret-key-here
```

## How It Works

1. **Client** generates a signature using:
   - HTTP method (GET, POST, etc.)
   - Request path (e.g., /api/auction/123)
   - Timestamp (Unix timestamp in milliseconds)
   - Request body hash (SHA-256 of JSON body, if present)

2. **Client** includes signature headers:
   - `X-Signature`: Base64-encoded HMAC-SHA256 signature
   - `X-Timestamp`: Unix timestamp in milliseconds

3. **Server** verifies:
   - Signature is valid
   - Timestamp is within 5-minute window
   - Request hasn't been tampered with

## Implementation

### Server-Side (Automatic)

When `ENABLE_REQUEST_SIGNING=true`, the server automatically:
- Verifies signatures on requests with `X-Signature` header
- Requires signatures for sensitive endpoints (like `/bid`)
- Rejects requests with invalid or expired signatures

### Client-Side (Browser/Extension)

```javascript
// Include the request signer utility
const RequestSigner = require('./path/to/requestSigner.js');

// Initialize with your API secret
const signer = new RequestSigner('your-api-secret');

// Sign a GET request
const signedOptions = await signer.signRequest(
  'http://localhost:3000/api/auction/123',
  { method: 'GET' }
);
const response = await fetch('http://localhost:3000/api/auction/123', signedOptions);

// Sign a POST request with body
const body = JSON.stringify({ 
  maxBid: 100,
  strategy: 'increment'
});

const signedPostOptions = await signer.signRequest(
  'http://localhost:3000/api/auction/123/config',
  {
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'your-auth-token'
    }
  }
);

const postResponse = await fetch(
  'http://localhost:3000/api/auction/123/config', 
  signedPostOptions
);
```

### Client-Side (Node.js)

```javascript
const crypto = require('crypto');
const axios = require('axios');

function generateSignature(method, path, timestamp, body, secret) {
  const bodyHash = body 
    ? crypto.createHash('sha256').update(body).digest('hex') 
    : '';
  
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    timestamp,
    bodyHash
  ].join('\n');
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalRequest);
  return hmac.digest('base64');
}

// Example usage
const secret = 'your-api-secret';
const timestamp = Date.now();
const method = 'POST';
const path = '/api/auction/123/bid';
const body = JSON.stringify({ amount: 150 });

const signature = generateSignature(method, path, timestamp, body, secret);

const response = await axios({
  method: method,
  url: `http://localhost:3000${path}`,
  data: body,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'your-auth-token',
    'X-Signature': signature,
    'X-Timestamp': timestamp.toString()
  }
});
```

## Signature Algorithm

The signature is calculated as:

```
1. Create canonical request string:
   METHOD\n
   PATH\n
   TIMESTAMP\n
   BODY_HASH

2. Generate HMAC-SHA256:
   signature = HMAC-SHA256(canonical_request, secret)

3. Encode as Base64:
   encoded_signature = base64(signature)
```

## Security Considerations

1. **Secret Management**
   - Never expose the API signing secret in client-side code
   - Store securely and rotate periodically
   - Use different secrets for different environments

2. **Timestamp Window**
   - Default: 5 minutes (300,000ms)
   - Prevents replay attacks
   - Ensure client and server clocks are synchronized

3. **Optional vs Required**
   - Signing is optional by default
   - Automatically required for sensitive endpoints (bids)
   - Can be made globally required in production

## Response Headers

When request signing is enabled, responses include:
- `X-Signature-Supported: true` - Indicates server supports signing
- `X-Signature-Algorithm: HMAC-SHA256` - Algorithm used
- `X-Signature-Verified: true` - Present if request was signed and verified

## Error Responses

### Invalid Signature
```json
{
  "success": false,
  "error": "Invalid request signature",
  "code": "INVALID_SIGNATURE",
  "details": "Invalid signature"
}
```

### Expired Timestamp
```json
{
  "success": false,
  "error": "Invalid request signature",
  "code": "INVALID_SIGNATURE",
  "details": "Request timestamp too old or too far in future"
}
```

### Missing Required Signature
```json
{
  "success": false,
  "error": "Request signature required for this endpoint",
  "code": "SIGNATURE_REQUIRED",
  "instructions": {
    "headers": {
      "X-Signature": "HMAC-SHA256 signature of request",
      "X-Timestamp": "Unix timestamp in milliseconds"
    },
    "algorithm": "HMAC-SHA256",
    "format": "method\\npath\\ntimestamp\\nbody_hash"
  }
}
```

## Testing

### With cURL

```bash
# Generate signature using OpenSSL
SECRET="your-api-secret"
TIMESTAMP=$(date +%s000)
METHOD="GET"
PATH="/api/auction/123"

# Create canonical request
CANONICAL="$METHOD\n$PATH\n$TIMESTAMP\n"

# Generate signature
SIGNATURE=$(echo -n "$CANONICAL" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

# Make request
curl -H "X-Signature: $SIGNATURE" \
     -H "X-Timestamp: $TIMESTAMP" \
     -H "Authorization: your-auth-token" \
     http://localhost:3000/api/auction/123
```

### Verification Tool

The server includes a utility for generating signatures:

```javascript
const requestSigning = require('./utils/requestSigning');

// Generate signature for testing
const headers = requestSigning.generateHeaders(
  'POST',
  '/api/auction/123/bid',
  '{"amount":100}',
  'your-api-secret'
);

console.log(headers);
// Output: { 'X-Signature': '...', 'X-Timestamp': '...' }
```