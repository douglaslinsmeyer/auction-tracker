# Kubernetes Deployment Guide

This guide covers deploying the Auction Tracker application to Kubernetes using Kustomize.

## Overview

The Auction Tracker Kubernetes deployment uses:
- **Kustomize** for configuration management
- **Gateway API** with NGINX implementation for ingress
- **Local storage** for persistent volumes
- **Separate overlays** for development and production environments

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Gateway   │────▶│   Backend    │────▶│    Redis    │
│  (NGINX)    │     │ (Deployment) │     │(StatefulSet)│
└─────────────┘     └──────────────┘     └─────────────┘
       │                    ▲
       │                    │
       ▼                    │
┌─────────────┐            │
│  Dashboard  │────────────┘
│(Deployment) │
└─────────────┘
```

## Directory Structure

```
k8s/
├── base/                    # Base configurations
│   ├── backend/            # Backend deployment, service, configmap
│   ├── dashboard/          # Dashboard deployment, service, configmap  
│   ├── redis/              # Redis statefulset, service, configmap
│   ├── gateway/            # Gateway API resources
│   └── kustomization.yaml  # Base kustomization
├── overlays/               # Environment-specific configurations
│   ├── development/        # Development overlay
│   └── production/         # Production overlay with HPA, PDB, etc.
└── scripts/                # Deployment scripts
    ├── setup-local.sh      # Local development setup
    ├── deploy.sh           # General deployment script
    ├── migrate-data.sh     # Redis data migration
    └── cleanup-local.sh    # Cleanup script
```

## Prerequisites

1. **Kubernetes cluster** (Docker Desktop, Rackspace Spot, etc.)
2. **kubectl** configured to access your cluster
3. **kustomize** (or kubectl 1.14+)
4. **Docker** for building images
5. **Gateway API CRDs** installed

## Quick Start (Local Development)

1. **Run the setup script:**
   ```bash
   ./k8s/scripts/setup-local.sh
   ```

   This script will:
   - Install Gateway API CRDs
   - Install NGINX Gateway controller
   - Build Docker images
   - Deploy the development overlay
   - Set up port forwarding instructions

2. **Access the application:**
   ```bash
   # Backend API
   kubectl -n auction-tracker-dev port-forward service/dev-backend 3000:3000

   # Dashboard
   kubectl -n auction-tracker-dev port-forward service/dev-dashboard 3001:3001
   ```

3. **View logs:**
   ```bash
   kubectl -n auction-tracker-dev logs -f deployment/dev-backend
   kubectl -n auction-tracker-dev logs -f deployment/dev-dashboard
   ```

## Production Deployment

### 1. Prepare Secrets

Create secret files in `k8s/overlays/production/secrets/`:
```bash
mkdir -p k8s/overlays/production/secrets
echo "your-auth-token" > k8s/overlays/production/secrets/auth-token
echo "your-encryption-secret" > k8s/overlays/production/secrets/encryption-secret
echo "your-redis-password" > k8s/overlays/production/secrets/redis-password
# Add TLS certificates
cp /path/to/tls.crt k8s/overlays/production/secrets/
cp /path/to/tls.key k8s/overlays/production/secrets/
```

### 2. Update Production Configuration

Edit `k8s/overlays/production/kustomization.yaml` to set:
- Correct domain names in gateway-patch.yaml
- Resource limits based on your needs
- HPA thresholds

### 3. Deploy to Production

```bash
./k8s/scripts/deploy.sh -e production
```

## Configuration Management

### Base Configuration

Base manifests define the core application structure:
- Deployments with health checks
- Services for internal communication
- ConfigMaps for non-sensitive configuration
- Gateway API resources

### Environment Overlays

#### Development Overlay
- Relaxed resource limits
- Debug logging enabled
- No HTTPS (HTTP only)
- Single replicas
- Disabled rate limiting

#### Production Overlay
- Strict resource limits
- Multiple replicas with anti-affinity
- HTTPS with TLS termination
- Horizontal Pod Autoscaling (HPA)
- Pod Disruption Budgets (PDB)
- Network Policies
- Redis authentication

## Data Migration

To migrate Redis data from Docker Compose to Kubernetes:

```bash
./k8s/scripts/migrate-data.sh -n auction-tracker-dev
```

This will:
1. Export data from Docker Redis
2. Import data to Kubernetes Redis
3. Verify the migration

## Monitoring and Troubleshooting

### Check Deployment Status
```bash
kubectl -n auction-tracker get all
kubectl -n auction-tracker describe deployment backend
kubectl -n auction-tracker describe pod <pod-name>
```

### View Logs
```bash
# All backend logs
kubectl -n auction-tracker logs -l component=backend

# Follow specific pod logs
kubectl -n auction-tracker logs -f <pod-name>

# Previous container logs (after crash)
kubectl -n auction-tracker logs <pod-name> --previous
```

### Debug Pods
```bash
# Execute commands in pod
kubectl -n auction-tracker exec -it <pod-name> -- /bin/sh

# Check Redis connectivity
kubectl -n auction-tracker exec -it <backend-pod> -- redis-cli -h redis ping
```

### Common Issues

1. **Pods not starting:**
   - Check pod events: `kubectl describe pod <pod-name>`
   - Check resource limits and node capacity
   - Verify image pull secrets if using private registry

2. **Service not accessible:**
   - Check service endpoints: `kubectl get endpoints`
   - Verify Gateway configuration
   - Check Network Policies in production

3. **Redis connection issues:**
   - Verify Redis pod is running
   - Check Redis service DNS resolution
   - Validate Redis password in production

## Scaling

### Manual Scaling
```bash
# Scale backend
kubectl -n auction-tracker scale deployment backend --replicas=3

# Scale dashboard
kubectl -n auction-tracker scale deployment dashboard --replicas=2
```

### Automatic Scaling (Production)
HPA is configured in production to scale based on CPU and memory:
- Backend: 2-10 replicas (70% CPU, 80% memory)
- Dashboard: 2-5 replicas (80% CPU, 80% memory)

## Updates and Rollbacks

### Update Application
```bash
# Build new images
docker build -t auction-tracker-backend:v2 backend/
docker build -t auction-tracker-dashboard:v2 dashboard/

# Update deployment
kubectl -n auction-tracker set image deployment/backend backend=auction-tracker-backend:v2
kubectl -n auction-tracker set image deployment/dashboard dashboard=auction-tracker-dashboard:v2
```

### Rollback
```bash
# Check rollout history
kubectl -n auction-tracker rollout history deployment/backend

# Rollback to previous version
kubectl -n auction-tracker rollout undo deployment/backend

# Rollback to specific revision
kubectl -n auction-tracker rollout undo deployment/backend --to-revision=2
```

## Security Considerations

1. **Network Policies**: Production uses strict network policies
2. **Pod Security**: Containers run as non-root user (1001)
3. **Secrets Management**: Use Kubernetes secrets for sensitive data
4. **TLS**: Production requires HTTPS with valid certificates
5. **Resource Limits**: Prevent resource exhaustion attacks

## Cleanup

To remove the deployment:

```bash
# Development
./k8s/scripts/cleanup-local.sh

# Production
kustomize build k8s/overlays/production | kubectl delete -f -
kubectl delete namespace auction-tracker
```

## CI/CD Integration

For GitHub Actions integration, add these steps to your workflow:

```yaml
- name: Build and Deploy to Kubernetes
  run: |
    # Build images
    docker build -t auction-tracker-backend:${{ github.sha }} backend/
    docker build -t auction-tracker-dashboard:${{ github.sha }} dashboard/
    
    # Push to registry (configure your registry)
    # docker push ...
    
    # Deploy
    ./k8s/scripts/deploy.sh -e production --no-build
```

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [Gateway API Documentation](https://gateway-api.sigs.k8s.io/)
- [NGINX Gateway Fabric](https://docs.nginx.com/nginx-gateway-fabric/)