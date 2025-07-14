# CI/CD Setup Guide

This guide explains how to set up and configure the CI/CD pipeline for the Auction Tracker project.

## Overview

The CI/CD pipeline consists of:
- **CI Pipeline**: Automated testing, linting, and security scanning
- **CD Pipeline**: Manual deployment to production (Rackspace Spot Kubernetes)
- **Security Audits**: Scheduled vulnerability scanning
- **Local Development**: Docker Compose for local testing

## Architecture

```
Local Development (Docker) → Push to GitHub → CI Pipeline → Manual Deploy → Production (Rackspace)
```

## Prerequisites

### GitHub Secrets Required

Navigate to Settings → Secrets and variables → Actions, and add:

#### Production Environment (Rackspace Spot)
- `RACKSPACE_KUBECONFIG`: Base64-encoded kubeconfig for Rackspace cluster
- `AUTH_TOKEN`: Authentication token for production API
- `ENCRYPTION_SECRET`: Encryption secret for sensitive data
- `REDIS_PASSWORD`: Redis password for production

### Obtaining Rackspace Kubeconfig

1. Log into Rackspace Spot console
2. Navigate to your Kubernetes cluster
3. Download the kubeconfig file
4. Base64 encode it: `base64 -w 0 kubeconfig.yaml`
5. Add as GitHub secret

## Local Development

### Running Locally with Docker

```bash
# Start all services locally
docker-compose up

# Or run specific services
docker-compose up backend dashboard redis

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Local Testing

```bash
# Backend
cd backend
npm run dev          # Development with hot-reload
npm test            # Run all tests
npm run lint        # Check code quality
npm run format      # Check formatting

# Dashboard
cd dashboard
npm run dev          # Development server
npm test            # Run tests
npm run lint        # Check code quality
```

## CI Pipeline Features

### Automated Checks on Every Push
- **Linting**: ESLint for code quality
- **Formatting**: Prettier for consistent style
- **Unit Tests**: Jest unit tests with coverage
- **Integration Tests**: Tests with Redis
- **E2E Tests**: Puppeteer browser tests
- **Security Scanning**: Trivy for container vulnerabilities
- **Dependency Audit**: npm audit for packages
- **Docker Build**: Validates Dockerfiles build correctly

### CI Pipeline Triggers
- **Push to main**: Full CI pipeline runs
- **Pull Request**: CI runs with results posted to PR
- **Manual**: Can be triggered manually from Actions tab

## CD Pipeline Features

### Production Deployment (Manual)
- **Environment**: Rackspace Spot Kubernetes cluster
- **Trigger**: Manual workflow dispatch only
- **Approval**: Requires GitHub environment approval
- **Rollback**: Automatic on failure

### Deployment Process
1. Pre-deployment checks and image verification
2. Create/update Kubernetes secrets
3. Deploy using Kustomize overlays
4. Health checks and smoke tests
5. Automatic rollback if deployment fails

### Manual Deployment Commands

```bash
# Deploy to production
gh workflow run cd.yml

# Deploy with dry run (preview only)
gh workflow run cd.yml -f dry_run=true

# Deploy without smoke tests
gh workflow run cd.yml -f skip_tests=true
```

## First-Time Setup

### 1. Install Dependencies

```bash
# Backend
cd backend
npm ci
npm run lint:fix  # Fix any existing issues
npm run format:fix # Format code

# Dashboard
cd ../dashboard
npm ci
npm run lint:fix
npm run format:fix
```

### 2. Configure Rackspace Production Cluster

```bash
# Create namespace
kubectl create namespace auction-tracker

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 3. Set Up Container Registry

The pipeline uses GitHub Container Registry (ghcr.io) by default. Images are automatically pushed with these tags:
- `commit-<sha>`: For commit-based deployments
- `v1.2.3`: For tagged releases (recommended for production)
- `latest`: Latest build from main branch

### 4. Configure Monitoring

```bash
# Deploy Prometheus and Grafana (optional)
kubectl apply -f k8s/monitoring/
```

## Troubleshooting

### CI Pipeline Issues

**Linting Failures**
```bash
# Auto-fix linting issues
npm run lint:fix
```

**Test Failures**
```bash
# Run tests locally with debugging
npm test -- --verbose
```

**Coverage Too Low**
```bash
# Check coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

### CD Pipeline Issues

**Kubeconfig Issues**
```bash
# Test kubeconfig locally
export KUBECONFIG=~/.kube/rackspace-config
kubectl cluster-info
```

**Image Pull Errors**
```bash
# Check image pull secret
kubectl get secret ghcr-secret -n auction-tracker -o yaml

# Recreate if needed
kubectl delete secret ghcr-secret -n auction-tracker
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --namespace=auction-tracker
```

**Deployment Stuck**
```bash
# Check pod events
kubectl describe pod -n auction-tracker
kubectl logs -n auction-tracker deployment/backend
kubectl logs -n auction-tracker deployment/dashboard
```

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Update GitHub secrets quarterly
   - Rotate kubeconfig after team changes

2. **Limit Permissions**
   - Use least-privilege service accounts
   - Restrict namespace access

3. **Monitor Vulnerabilities**
   - Review security audit results weekly
   - Update dependencies promptly

4. **Audit Access**
   ```bash
   # Check cluster access
   kubectl auth can-i create deployments -n auction-tracker
   kubectl auth can-i get secrets -n auction-tracker
   ```

## Rollback Procedures

### Automatic Rollback
The CD pipeline automatically rolls back on deployment failure.

### Manual Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n auction-tracker
kubectl rollout undo deployment/dashboard -n auction-tracker

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=3 -n auction-tracker
```

### Emergency Procedures
```bash
# Scale down problematic deployment
kubectl scale deployment/backend --replicas=0 -n auction-tracker

# Switch to backup
kubectl apply -f k8s/emergency/backup-deployment.yaml
```

## Monitoring Deployments

### GitHub Actions Dashboard
- View runs: Actions tab in GitHub
- Check logs: Click on workflow run
- Download artifacts: Available for 30 days

### Kubernetes Monitoring
```bash
# Watch deployment progress
kubectl get events -n auction-tracker -w

# Check resource usage
kubectl top pods -n auction-tracker

# View deployment history
kubectl rollout history deployment/backend -n auction-tracker
kubectl rollout history deployment/dashboard -n auction-tracker

# Monitor real-time logs
kubectl logs -f deployment/backend -n auction-tracker
kubectl logs -f deployment/dashboard -n auction-tracker
```

## Cost Optimization

1. **Resource Management**: Configure appropriate resource requests/limits
2. **Auto-scaling**: HPA configured for production traffic
3. **Image Cleanup**: GitHub retention policy for old images
4. **Monitoring**: Track resource usage to right-size deployments

## Next Steps

1. **Set up GitHub Secrets**: Add all required secrets
2. **Test CI Pipeline**: Create a test PR
3. **Configure Alerts**: Set up deployment notifications
4. **Document Runbooks**: Create operational procedures
5. **Train Team**: Ensure everyone understands the pipeline

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Check Kubernetes events and logs
4. Contact DevOps team

Remember: Always test in development before production!