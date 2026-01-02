       ┌───────────────────────────────────────────────────────────────────┐
       │                       FRONTEND (React + Vite)                     │
       │  - 100+ Pages (Dashboard, Tokens, Backtesting, Copier)            │
       │  - Real-time UI updates via WebSockets & TanStack Query           │
       └─────┬──────────────────────────┬───────────────────────────┬──────┘
             │                          │                           │
  HTTP/WS Requests              Auth & Real-time Content      High-Frequency Data
             │                          │                           │
   ┌─────────▼─────────────┐    ┌───────▼────────────────┐   ┌──────▼────────────┐
   │    PYTHON BACKEND     │    │   SUPABASE (DB/BaaS)   │   │    RUST BACKEND   │
   │  (FastAPI / Uvicorn)  │    │  - PostgreSQL (15+)    │   │ (Tokio Async RT)  │
   │                       │    │  - Edge Functions      │   │                   │
   │ - Data Aggregation    ◄────►  - RLS Security        │   │ - Low-latency Exec│
   │ - AI/Sentiment        │    │  - Auth / Storage      │   │ - MEV Integration │
   │ - Signal Logic        │    │  - Real-time Hooks     │   │ - Tx Simulation   │
   └─────────┬─────────────┘    └────────────────────────┘   └──────┬────────────┘
             │                                                      │
             │           ┌──────────────────────────┐               │
             └───────────┤  EXTERNAL INTEGRATIONS   ├───────────────┘
                         └──────────────┬───────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             │                          │                          │
       BLOCKCHAIN (SOL)           DATA PROVIDERS             PAYMENTS/AUTH
       - Jupiter (Swaps)          - Birdeye / Helius         - Stripe
       - Jito (MEV Bundles)       - DexScreener              - Turnkey (Wallets)
       - RPC Nodes                - Polygon.io               - Google OAuth