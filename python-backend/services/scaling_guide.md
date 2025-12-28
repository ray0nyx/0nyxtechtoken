# Horizontal Scaling Guide

## Architecture Overview

The system is designed for horizontal scaling with Redis as shared memory and stateless services.

## Key Principles

1. **Stateless Services**: All FastAPI services are stateless - no in-memory state between requests
2. **Redis as Shared Memory**: All state stored in Redis (candles, quotes, subscriptions)
3. **WebSocket Fan-out**: Single WebSocket manager per instance, Redis pub/sub for coordination
4. **Load Balancing**: Use sticky sessions for WebSocket connections

## Scaling Strategy

### Backend Services

- **FastAPI Instances**: Scale horizontally behind load balancer
- **WebSocket Connections**: Each instance handles its own connections
- **Redis Pub/Sub**: Coordinates between instances

### Redis Configuration

- **Single Redis Instance**: For pub/sub coordination
- **Redis Cluster**: For high availability (optional)
- **Key Sharding**: Not needed (Redis handles internally)

### WebSocket Load Balancing

- **Sticky Sessions**: Required (WebSocket connections are stateful)
- **Session Affinity**: Use cookie-based or IP-based affinity
- **Health Checks**: Monitor WebSocket connection health

## Deployment

### Docker Compose Example

```yaml
services:
  api:
    image: wagyu-backend
    replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
```

### Kubernetes Deployment

- Use StatefulSet for Redis (if not using managed service)
- Use Deployment for FastAPI (stateless)
- Use Service with sessionAffinity for WebSocket connections

## Monitoring

- **Connection Count**: Per instance WebSocket connections
- **Redis Memory**: Monitor Redis memory usage
- **Message Queue Sizes**: Track backpressure queue sizes
- **Latency**: Monitor WebSocket message latency
