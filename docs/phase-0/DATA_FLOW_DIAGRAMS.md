# Data Flow Diagrams - Current Architecture

## 1. Auction Monitoring Data Flow

```mermaid
graph TB
    subgraph "Chrome Extension"
        CE[Extension Content Script]
        BG[Background Service Worker]
    end
    
    subgraph "Backend Services"
        API[REST API<br/>api.js]
        WS[WebSocket Handler<br/>websocket.js]
        AM[AuctionMonitor<br/>Singleton]
        NA[NellisApi<br/>Singleton]
        ST[Storage<br/>Singleton]
    end
    
    subgraph "External"
        NAP[Nellis Auction API]
        RD[(Redis)]
        MF[(Memory Fallback)]
    end
    
    %% Extension to Backend
    CE -->|"POST /api/auctions/:id/monitor"| API
    BG -->|"WebSocket connect"| WS
    
    %% API Flow
    API -->|"addAuction()"| AM
    AM -->|"saveAuction()"| ST
    AM -->|"startPolling()"| AM
    
    %% Polling Flow
    AM -->|"setInterval 6s"| AM
    AM -->|"getAuctionData()"| NA
    NA -->|"HTTP GET"| NAP
    NAP -->|"Auction Data"| NA
    NA -->|"Transform Data"| AM
    
    %% Storage Flow
    ST -->|"Connected?"| RD
    ST -.->|"Fallback"| MF
    
    %% WebSocket Flow
    AM -->|"broadcastAuctionState()"| WS
    WS -->|"Send Updates"| BG
    BG -->|"Forward"| CE
    
    style AM fill:#f9f,stroke:#333,stroke-width:4px
    style RD fill:#f96,stroke:#333,stroke-width:2px
    style MF fill:#ff9,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

## 2. Bidding Flow

```mermaid
sequenceDiagram
    participant U as User/Extension
    participant API as REST API
    participant AM as AuctionMonitor
    participant NA as NellisApi
    participant NAP as Nellis Auction
    participant ST as Storage
    participant WS as WebSocket
    
    Note over AM: Polling detects outbid
    AM->>AM: executeAutoBid()
    AM->>AM: Check strategy & maxBid
    
    alt Auto-bid enabled
        AM->>NA: placeBid(auctionId, amount)
        NA->>NAP: POST /api/bids
        NAP-->>NA: Response
        
        alt Bid Successful
            NA-->>AM: {success: true}
            AM->>ST: saveBidHistory()
            AM->>WS: broadcastBidResult()
            WS-->>U: Bid notification
        else Bid Failed
            NA-->>AM: {success: false, error}
            AM->>AM: Check retry policy
            opt Retryable
                AM->>AM: Schedule retry
            end
        end
    end
```

## 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> NotMonitored
    NotMonitored --> Monitoring: addAuction()
    
    Monitoring --> Monitoring: updateAuction()
    Monitoring --> Bidding: executeAutoBid()
    Monitoring --> Error: API Error
    Monitoring --> Ending: timeRemaining <= 30s
    
    Bidding --> Monitoring: Bid Complete
    Bidding --> Error: Bid Failed
    
    Ending --> Ended: timeRemaining = 0
    Ending --> Ending: Soft Extension
    
    Error --> Monitoring: Retry Success
    Error --> Ended: Unrecoverable
    
    Ended --> Removed: After 60s
    Removed --> [*]
    
    note right of Monitoring
        Polls every 6 seconds
        Broadcasts updates
    end note
    
    note right of Ending
        Polls every 2 seconds
        Aggressive monitoring
    end note
```

## 4. WebSocket Message Flow

```mermaid
graph LR
    subgraph "Client Side"
        C1[Client 1]
        C2[Client 2]
        C3[Client N]
    end
    
    subgraph "Server"
        WSH[WebSocket Handler]
        CM[Clients Map]
        AM[AuctionMonitor]
    end
    
    %% Connection Flow
    C1 -->|"connect"| WSH
    WSH -->|"clientId"| CM
    WSH -->|"welcome + auctions"| C1
    
    %% Authentication
    C1 -->|"authenticate"| WSH
    WSH -->|"validate token"| WSH
    WSH -->|"authenticated=true"| CM
    
    %% Subscription
    C1 -->|"subscribe(auctionId)"| WSH
    WSH -->|"add to subscriptions"| CM
    
    %% Broadcasting
    AM -->|"state change"| WSH
    WSH -->|"check subscriptions"| CM
    WSH -->|"broadcast"| C1
    WSH -->|"broadcast"| C2
    
    style CM fill:#f9f,stroke:#333,stroke-width:2px
```

## 5. Error Propagation Flow

```mermaid
graph TB
    subgraph "Error Sources"
        E1[Nellis API Error]
        E2[Redis Connection Error]
        E3[WebSocket Error]
        E4[Validation Error]
    end
    
    subgraph "Error Handlers"
        NA[NellisApi<br/>catch & categorize]
        ST[Storage<br/>fallback to memory]
        WS[WebSocket<br/>log & continue]
        API[API Routes<br/>status codes]
    end
    
    subgraph "Error Responses"
        R1[HTTP 4xx/5xx]
        R2[WebSocket error message]
        R3[Console.error log]
        R4[Silent fallback]
    end
    
    E1 -->|"Categorized"| NA
    NA -->|"Retryable?"| NA
    NA -->|"Return error"| API
    API --> R1
    
    E2 --> ST
    ST -->|"Use memory"| R4
    ST --> R3
    
    E3 --> WS
    WS --> R2
    WS --> R3
    
    E4 --> API
    API -->|"400 Bad Request"| R1
    
    style R4 fill:#ff9,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

## 6. Initialization Sequence

```mermaid
sequenceDiagram
    participant M as Main (index.js)
    participant S as Storage
    participant N as NellisApi
    participant A as AuctionMonitor
    participant W as WebSocket
    participant H as HTTP Server
    
    M->>S: initialize()
    S->>S: Connect to Redis
    alt Redis Available
        S-->>M: Connected
    else Redis Unavailable
        S-->>M: Using memory fallback
    end
    
    M->>N: initialize()
    N->>S: getCookies()
    S-->>N: Saved cookies
    N->>N: Set cookies
    N-->>M: Initialized
    
    M->>A: initialize(wss, broadcastHandler)
    A->>S: getAllAuctions()
    S-->>A: Persisted auctions
    A->>A: Recover non-ended auctions
    A->>A: Start polling for each
    A-->>M: Initialized
    
    M->>H: listen(PORT)
    H-->>M: Server running
    
    Note over M: Ready for connections
```

## 7. Chrome Extension Integration

```mermaid
graph TB
    subgraph "Extension"
        CS[Content Script<br/>content-isolated.js]
        SW[Service Worker<br/>background.js]
        BC[Backend Client<br/>backend-client.js]
    end
    
    subgraph "Backend"
        WSSRV[WebSocket Server]
        RESTAPI[REST API]
    end
    
    CS -->|"Message: startMonitoring"| SW
    SW -->|"Create connection"| BC
    BC -->|"WebSocket connect"| WSSRV
    
    BC -->|"authenticate"| WSSRV
    WSSRV -->|"authenticated"| BC
    
    SW -->|"POST /api/auth"| RESTAPI
    RESTAPI -->|"Store cookies"| RESTAPI
    
    CS -->|"Detect auction page"| CS
    CS -->|"Extract auction data"| SW
    SW -->|"startMonitoring message"| BC
    BC -->|"WebSocket message"| WSSRV
    
    WSSRV -->|"Auction updates"| BC
    BC -->|"Forward updates"| SW
    SW -->|"Update badge/UI"| CS
    
    style BC fill:#9f9,stroke:#333,stroke-width:2px
```

## Key Data Flow Issues Identified

1. **No Request Queuing**: All operations happen immediately, can overwhelm systems
2. **Synchronous Broadcasts**: WebSocket broadcasts block other operations  
3. **No Backpressure**: Polling continues even if previous requests haven't completed
4. **State Scattered**: Auction state exists in multiple places without sync
5. **No Transaction Boundaries**: Multi-step operations have no rollback