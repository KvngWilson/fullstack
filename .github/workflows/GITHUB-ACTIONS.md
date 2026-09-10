# 🤖 GitHub Actions CI/CD Documentation

## 📋 Overview

Complete automation suite with 6 GitHub Actions workflows for continuous integration, deployment, and maintenance:

1. **CI Pipeline** - Build, test, and security scanning
2. **CD to GCP** - Automated deployment to Google Kubernetes Engine
3. **Terraform** - Infrastructure as Code management
4. **Docker Compose Test** - Integration testing
5. **Dependency Updates** - Automated dependency management
6. **Release Management** - Version tagging and release automation

---

## 🔧 Setup Instructions

### 1. Configure GitHub Secrets

Navigate to **Repository Settings → Secrets and variables → Actions** and add:

#### Required Secrets

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `GCP_PROJECT_ID` | Your GCP Project ID | `gcloud config get-value project` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider | See Workload Identity Setup below |
| `GCP_SERVICE_ACCOUNT` | Service Account Email | See Service Account Setup below |

#### Optional Secrets

| Secret Name | Description | Used For |
|------------|-------------|----------|
| `SLACK_WEBHOOK_URL` | Slack notification webhook | Deployment notifications |
| `DISCORD_WEBHOOK_URL` | Discord notification webhook | Deployment notifications |

---

### 2. Set Up GCP Workload Identity

This enables secure authentication from GitHub Actions to GCP without storing service account keys.

```bash
# Set variables
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export REPO="your-username/Smart-Grocery"
export SERVICE_ACCOUNT_NAME="github-actions-sa"

# Create service account
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub Actions to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO"

# Get Workload Identity Provider (save this as GCP_WORKLOAD_IDENTITY_PROVIDER secret)
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"

# Get Service Account Email (save this as GCP_SERVICE_ACCOUNT secret)
echo "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
```

---

### 3. Configure GitHub Environments

Create environments for deployment protection:

1. Go to **Repository Settings → Environments**
2. Create environments:
   - `dev` - Development environment
   - `prod` - Production environment
   - `dev-destroy` - For Terraform destroy approval
   - `prod-destroy` - For Terraform destroy approval

3. For **prod** environment, add:
   - ✅ **Required reviewers** (1-2 people)
   - ✅ **Wait timer** (optional, e.g., 5 minutes)
   - ✅ **Deployment branches** (only `main`)

---

## 📦 Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Jobs:**
- ✅ Frontend linting and build
- ✅ Backend linting and tests
- ✅ Docker image build test
- ✅ Security vulnerability scanning

**What it does:**
```yaml
1. Lint frontend code
2. Build React application
3. Test backend with Redis
4. Build Docker images (no push)
5. Scan for security vulnerabilities
6. Upload results to GitHub Security
```

**Status:** Runs on every commit

---

### 2. CD to GCP (`cd-gcp.yml`)

**Triggers:**
- Push to `main` (automatic)
- Manual workflow dispatch (choose environment)

**Jobs:**
- 🏗️ Build and push Docker images to GCR
- 🚀 Deploy to GKE cluster
- 🧪 Smoke tests
- 📢 Deployment notifications

**What it does:**
```yaml
1. Build server and client Docker images
2. Push to Google Container Registry
3. Update Kubernetes manifests with new image tags
4. Deploy to GKE cluster
5. Wait for rollout to complete
6. Run smoke tests
7. Display application URL
```

**Environment Variables:**
- `GCP_REGION`: us-central1
- `GKE_CLUSTER`: smart-grocery-{env}-cluster
- `ENVIRONMENT`: dev or prod

**Manual Deploy:**
```bash
# Go to Actions tab → "CD - Deploy to GCP" → Run workflow
# Select environment: dev or prod
```

---

### 3. Terraform (`terraform.yml`)

**Triggers:**
- Push to `main` (if terraform files changed)
- Pull requests (plan only)
- Manual workflow dispatch (plan/apply/destroy)

**Jobs:**
- ✅ Validate Terraform syntax
- 📋 Generate Terraform plan
- ✅ Apply infrastructure changes (main branch only)
- 🗑️ Destroy infrastructure (manual only)

**What it does:**
```yaml
1. Validate Terraform configuration
2. Check formatting
3. Generate execution plan
4. Comment plan on PRs
5. Apply changes on main branch
6. Upload outputs as artifacts
```

**Manual Operations:**
```bash
# Plan infrastructure changes
Actions → "Terraform - Infrastructure Management" → Run workflow
Action: plan
Environment: dev

# Apply changes
Actions → "Terraform - Infrastructure Management" → Run workflow
Action: apply
Environment: dev

# Destroy infrastructure
Actions → "Terraform - Infrastructure Management" → Run workflow
Action: destroy
Environment: dev
```

---

### 4. Docker Compose Test (`docker-compose-test.yml`)

**Triggers:**
- Push/PR with changes to Docker files
- Changes to application code

**Jobs:**
- 🐳 Start all services with Docker Compose
- ✅ Health checks for all containers
- 🧪 Integration tests

**What it does:**
```yaml
1. Start Redis, server, and client
2. Wait for healthy status
3. Test Redis connection
4. Test API endpoints
5. Test frontend availability
6. Run integration tests (add/get items)
7. Clean up containers
```

---

### 5. Dependency Updates (`dependency-update.yml`)

**Triggers:**
- Weekly schedule (Monday 9 AM UTC)
- Manual workflow dispatch

**Jobs:**
- 📦 Check for outdated packages
- 🎫 Create GitHub issue with updates
- 🤖 Auto-merge Dependabot PRs (minor/patch)

**What it does:**
```yaml
1. Check npm outdated for frontend
2. Check npm outdated for backend
3. Create issue with update list
4. Label issue for tracking
```

**Dependabot Configuration:**
- Frontend NPM packages (weekly)
- Backend NPM packages (weekly)
- Docker base images (weekly)
- GitHub Actions versions (weekly)

---

### 6. Release Management (`release.yml`)

**Triggers:**
- Push tags matching `v*.*.*`
- Manual workflow dispatch

**Jobs:**
- 📝 Generate changelog
- 🎉 Create GitHub release
- 🏗️ Build release Docker images
- 🏷️ Tag images with version

**What it does:**
```yaml
1. Extract version from tag
2. Generate changelog from commits
3. Create GitHub release
4. Build Docker images
5. Tag with version and latest
6. Push to GCR
```

**Usage:**
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# Or use GitHub UI
# Releases → Create new release → Choose tag
```

---

## 🚀 Usage Examples

### Deploying to Development

```bash
# Method 1: Push to main (automatic)
git push origin main

# Method 2: Manual deployment
# GitHub → Actions → "CD - Deploy to GCP" → Run workflow
# Select: environment = dev
```

### Deploying to Production

```bash
# Method 1: Create release tag
git tag v1.0.0
git push origin v1.0.0

# Method 2: Manual deployment (requires approval)
# GitHub → Actions → "CD - Deploy to GCP" → Run workflow
# Select: environment = prod
# Wait for reviewer approval
```

### Updating Infrastructure

```bash
# 1. Make changes to terraform files
# 2. Create PR
# 3. GitHub Actions runs terraform plan
# 4. Review plan in PR comment
# 5. Merge PR
# 6. Terraform automatically applies changes
```

### Rolling Back a Deployment

```bash
# Method 1: Revert commit
git revert <commit-hash>
git push origin main

# Method 2: Deploy previous image
kubectl set image deployment/server \
  server=gcr.io/PROJECT_ID/smart-grocery-server:PREVIOUS_SHA \
  -n smart-grocery

# Method 3: Use previous release tag
# GitHub → Actions → "CD - Deploy to GCP" → Run workflow
# Manually update manifests to use previous tag
```

---

## 📊 Monitoring Workflows

### View Workflow Status

```bash
# GitHub UI
Repository → Actions tab

# Filter by workflow
Click on workflow name in left sidebar

# Filter by branch
Use branch dropdown

# View logs
Click on workflow run → Click on job → Expand step
```

### Workflow Badges

Add to README.md:

```markdown
![CI](https://github.com/USERNAME/Smart-Grocery/workflows/CI%20-%20Build%20and%20Test/badge.svg)
![CD](https://github.com/USERNAME/Smart-Grocery/workflows/CD%20-%20Deploy%20to%20GCP/badge.svg)
![Terraform](https://github.com/USERNAME/Smart-Grocery/workflows/Terraform%20-%20Infrastructure%20Management/badge.svg)
```

### Email Notifications

Configure in **Settings → Notifications**:
- ✅ Failed workflows
- ✅ Required review
- ✅ Deployment status

---

## 🔒 Security Best Practices

### Secrets Management
- ✅ Use Workload Identity (no long-lived keys)
- ✅ Rotate service account keys regularly
- ✅ Limit service account permissions
- ✅ Use environment protection rules
- ✅ Enable audit logging

### Code Scanning
- ✅ Trivy vulnerability scanning
- ✅ Dependabot security updates
- ✅ GitHub Security tab alerts
- ✅ Automatic dependency updates

### Access Control
- ✅ Required reviewers for production
- ✅ Branch protection rules
- ✅ Signed commits (optional)
- ✅ CODEOWNERS file (optional)

---

## 🐛 Troubleshooting

### Authentication Errors

```bash
# Error: Unable to authenticate to GCP
# Solution: Verify Workload Identity setup

# Check service account exists
gcloud iam service-accounts list

# Check IAM bindings
gcloud iam service-accounts get-iam-policy \
  SERVICE_ACCOUNT_EMAIL@PROJECT_ID.iam.gserviceaccount.com

# Re-run Workload Identity setup
```

### Docker Build Failures

```bash
# Error: Docker build fails
# Solution: Check Dockerfile syntax

# Test locally
docker build -t test-server ./server
docker build -t test-client -f Dockerfile.client .

# Check build context
ls -la server/
ls -la
```

### Terraform State Lock

```bash
# Error: Error acquiring state lock
# Solution: Break lock manually (use carefully!)

# List locks
gcloud storage ls gs://YOUR-BUCKET-NAME/terraform.tfstate/

# Break lock (only if workflow crashed)
terraform force-unlock LOCK_ID
```

### GKE Deployment Timeout

```bash
# Error: Deployment timeout
# Solution: Check pod status

# Get cluster credentials
gcloud container clusters get-credentials CLUSTER_NAME --region REGION

# Check pods
kubectl get pods -n smart-grocery

# Check events
kubectl get events -n smart-grocery --sort-by='.lastTimestamp'

# Check logs
kubectl logs deployment/server -n smart-grocery
```

### Image Pull Errors

```bash
# Error: ImagePullBackOff
# Solution: Verify GCR access

# Check image exists
gcloud container images list --repository=gcr.io/PROJECT_ID

# Configure GKE to pull from GCR
kubectl create secret docker-registry gcr-json-key \
  --docker-server=gcr.io \
  --docker-username=_json_key \
  --docker-password="$(cat key.json)" \
  -n smart-grocery
```

---

## ⚙️ Customization

### Modify Deployment Behavior

Edit `.github/workflows/cd-gcp.yml`:

```yaml
# Change deployment frequency
on:
  push:
    branches: [ main, release/* ]  # Add release branches

# Add deployment slots
environment:
  name: production
  url: https://smart-grocery.example.com
```

### Add Slack Notifications

Add to end of deployment job:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: 'Deployment to ${{ env.ENVIRONMENT }} ${{ job.status }}'
```

### Add Performance Tests

Add to `docker-compose-test.yml`:

```yaml
- name: Run performance tests
  run: |
    npm install -g artillery
    artillery quick --count 100 --num 10 http://localhost:8080
```

### Enable Automatic Rollback

Add to deployment job:

```yaml
- name: Rollback on failure
  if: failure()
  run: |
    kubectl rollout undo deployment/server -n smart-grocery
    kubectl rollout undo deployment/client -n smart-grocery
```

---

## 📈 Advanced Features

### Multi-region Deployment

```yaml
strategy:
  matrix:
    region: [us-central1, europe-west1, asia-east1]
steps:
  - name: Deploy to ${{ matrix.region }}
    run: |
      gcloud container clusters get-credentials \
        smart-grocery-cluster \
        --region=${{ matrix.region }}
      kubectl apply -k k8s/
```

### Blue-Green Deployment

```yaml
- name: Deploy green environment
  run: |
    kubectl apply -f k8s-green/
    kubectl wait --for=condition=ready pod -l version=green

- name: Switch traffic
  run: |
    kubectl patch svc client -p '{"spec":{"selector":{"version":"green"}}}'
```

### Canary Deployment

```yaml
- name: Deploy canary
  run: |
    kubectl set image deployment/server server=IMAGE:NEW --record
    kubectl scale deployment/server-canary --replicas=1

- name: Monitor metrics
  run: |
    # Wait and check error rate
    sleep 300
    # If OK, promote canary
    kubectl scale deployment/server --replicas=5
```

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GCP Workload Identity](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

---

Your CI/CD pipeline is now fully automated! 🚀
