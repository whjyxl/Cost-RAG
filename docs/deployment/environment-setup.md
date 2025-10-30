# 环境配置指南

## 📋 目录

- [开发环境配置](#开发环境配置)
- [测试环境配置](#测试环境配置)
- [预生产环境配置](#预生产环境配置)
- [生产环境配置](#生产环境配置)
- [环境变量管理](#环境变量管理)
- [配置验证](#配置验证)
- [环境迁移](#环境迁移)
- [故障排查](#故障排查)

## 🛠️ 开发环境配置

### 1. 系统要求

```yaml
# 基础环境要求
System:
  OS:
    - Ubuntu 20.04+ / macOS 12+ / Windows 10+
    - Linux内核版本 5.4+
  CPU:
    Minimum: 4核心
    Recommended: 8核心+
  Memory:
    Minimum: 8GB RAM
    Recommended: 16GB+ RAM
  Storage:
    Minimum: 50GB可用空间
    Recommended: 100GB+ SSD

# 软件依赖
Software:
  Python: 3.11+
  Node.js: 18+
  Docker: 24.0+
  Docker Compose: 2.0+
  Git: 2.30+
  Make: 4.2+

# 可选工具
OptionalTools:
  - PostgreSQL Client: 15+
  - Redis CLI: 7+
  - kubectl: 1.28+
  - Helm: 3.12+
```

### 2. 快速启动脚本

```bash
#!/bin/bash
# setup-dev.sh - 开发环境快速配置

set -e

echo "🚀 Setting up Cost-RAG development environment..."

# 检查系统要求
check_requirements() {
    echo "📋 Checking system requirements..."

    # 检查Python
    if ! command -v python3.11 &> /dev/null; then
        echo "❌ Python 3.11+ is required"
        exit 1
    fi

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is required"
        exit 1
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is required"
        exit 1
    fi

    echo "✅ All requirements satisfied"
}

# 创建虚拟环境
create_venv() {
    echo "🐍 Creating Python virtual environment..."
    python3.11 -m venv venv
    source venv/bin/activate

    # 升级pip
    pip install --upgrade pip setuptools wheel

    echo "✅ Virtual environment created"
}

# 安装Python依赖
install_dependencies() {
    echo "📦 Installing Python dependencies..."

    # 安装基础依赖
    pip install -r requirements.txt

    # 安装开发依赖
    pip install -r requirements-dev.txt

    echo "✅ Dependencies installed"
}

# 配置环境变量
setup_environment() {
    echo "⚙️ Setting up environment configuration..."

    # 复制环境变量模板
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration"
    fi

    # 创建必要的目录
    mkdir -p logs uploads data models config
    chmod 755 logs uploads data models config

    echo "✅ Environment configured"
}

# 启动基础服务
start_services() {
    echo "🐳 Starting development services..."

    # 启动数据库和缓存服务
    docker-compose -f docker-compose.dev.yml up -d postgres redis

    # 等待服务就绪
    echo "⏳ Waiting for services to be ready..."
    sleep 10

    # 运行数据库迁移
    source venv/bin/activate
    alembic upgrade head

    echo "✅ Services started"
}

# 初始化开发数据
init_dev_data() {
    echo "📊 Initializing development data..."

    source venv/bin/activate
    python scripts/init_dev_data.py

    echo "✅ Development data initialized"
}

# 执行安装步骤
main() {
    check_requirements
    create_venv
    install_dependencies
    setup_environment
    start_services
    init_dev_data

    echo "🎉 Development environment setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Activate virtual environment: source venv/bin/activate"
    echo "2. Edit .env file with your configuration"
    echo "3. Start API server: python -m uvicorn cost_rag.main:app --reload"
    echo "4. Start worker: celery -A cost_rag.celery worker --loglevel=info --reload"
    echo ""
    echo "API Documentation: http://localhost:8000/docs"
    echo "Admin Interface: http://localhost:8000/admin"
}

main "$@"
```

### 3. 开发环境Docker配置

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # PostgreSQL开发数据库
  postgres-dev:
    image: postgres:15-alpine
    container_name: cost-rag-postgres-dev
    environment:
      - POSTGRES_DB=cost_rag_dev
      - POSTGRES_USER=dev_user
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./scripts/init-db-dev.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d cost_rag_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis开发缓存
  redis-dev:
    image: redis:7-alpine
    container_name: cost-rag-redis-dev
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Milvus开发向量数据库
  milvus-dev:
    image: milvusdb/milvus:v2.3.0
    container_name: cost-rag-milvus-dev
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd-dev:2379
      MINIO_ADDRESS: minio-dev:9000
    volumes:
      - milvus_dev_data:/var/lib/milvus
    ports:
      - "19531:19530"
      - "9092:9091"
    depends_on:
      - etcd-dev
      - minio-dev

  # etcd for Milvus
  etcd-dev:
    image: quay.io/coreos/etcd:v3.5.5
    container_name: cost-rag-etcd-dev
    command:
      - etcd
      - --advertise-client-urls=http://127.0.0.1:2379
      - --listen-client-urls=http://0.0.0.0:2379
      - --data-dir=/etcd
    volumes:
      - etcd_dev_data:/etcd

  # MinIO开发存储
  minio-dev:
    image: minio/minio:RELEASE.2023-12-14T18-51-57Z
    container_name: cost-rag-minio-dev
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=devminioadmin
      - MINIO_ROOT_PASSWORD=devminioadmin123
    volumes:
      - minio_dev_data:/data
    ports:
      - "9001:9000"
      - "9002:9001"

  # 开发工具
  adminer:
    image: adminer:latest
    container_name: cost-rag-adminer
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=postgres-dev

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: cost-rag-redis-commander
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis-dev:6379
    depends_on:
      - redis-dev

volumes:
  postgres_dev_data:
  redis_dev_data:
  milvus_dev_data:
  etcd_dev_data:
  minio_dev_data:

networks:
  default:
    name: cost-rag-dev-network
```

### 4. 开发工具配置

```json
// .vscode/settings.json
{
    "python.defaultInterpreterPath": "./venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.linting.flake8Enabled": true,
    "python.linting.mypyEnabled": true,
    "python.formatting.provider": "black",
    "python.formatting.blackArgs": ["--line-length", "88"],
    "python.sortImports.args": ["--profile", "black"],
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.organizeImports": true
    },
    "files.exclude": {
        "**/__pycache__": true,
        "**/*.pyc": true,
        ".pytest_cache": true,
        ".mypy_cache": true,
        "*.egg-info": true
    },
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": [
        "tests",
        "-v",
        "--cov=cost_rag",
        "--cov-report=html",
        "--cov-report=term-missing"
    ],
    "python.testing.unittestEnabled": false,
    "docker.compose.showQuickStartButton": false,
    "docker.showStartPage": false,
    "files.watcherExclude": {
        "**/__pycache__/**": true,
        "**/*.pyc": true,
        "**/venv/**": true
    }
}
```

```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/main.py",
            "module": "uvicorn",
            "args": [
                "cost_rag.main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
                "--reload"
            ],
            "console": "integratedTerminal",
            "envFile": "${workspaceFolder}/.env",
            "cwd": "${workspaceFolder}"
        },
        {
            "name": "Python: Celery Worker",
            "type": "python",
            "request": "launch",
            "module": "celery",
            "args": [
                "-A",
                "cost_rag.celery",
                "worker",
                "--loglevel=info",
                "--reload"
            ],
            "console": "integratedTerminal",
            "envFile": "${workspaceFolder}/.env",
            "cwd": "${workspaceFolder}"
        },
        {
            "name": "Python: Run Tests",
            "type": "python",
            "request": "launch",
            "module": "pytest",
            "args": [
                "tests",
                "-v",
                "--cov=cost_rag",
                "--cov-report=html"
            ],
            "console": "integratedTerminal",
            "cwd": "${workspaceFolder}"
        }
    ]
}
```

## 🧪 测试环境配置

### 1. 测试环境架构

```yaml
# 测试环境配置
TestEnvironment:
  Purpose: 自动化测试、集成测试、性能测试
  Infrastructure:
    - Kubernetes集群 (3节点)
    - PostgreSQL (单实例)
    - Redis (单实例)
    - Milvus (单实例)
    - MinIO (单实例)

  AutoScaling:
    Enabled: false
    FixedInstances: 2

  Monitoring:
    - Basic logging
    - Health checks
    - Test metrics

  Data:
    - 测试数据自动生成
    - 每次测试后清理
    - 隔离测试环境
```

### 2. 测试环境部署脚本

```bash
#!/bin/bash
# deploy-test.sh

set -e

ENVIRONMENT="test"
NAMESPACE="cost-rag-test"
RELEASE_NAME="cost-rag-test"

echo "🧪 Deploying Cost-RAG to test environment..."

# 创建测试命名空间
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# 设置测试标签
kubectl label namespace ${NAMESPACE} environment=test --overwrite

# 部署应用
helm upgrade --install ${RELEASE_NAME} ./helm/cost-rag \
  --namespace ${NAMESPACE} \
  --set environment=test \
  --set api.replicaCount=2 \
  --set worker.replicaCount=2 \
  --set postgresql.primary.persistence.size=100Gi \
  --set redis.master.persistence.size=10Gi \
  --set monitoring.enabled=true \
  --values ./helm/values-test.yaml \
  --wait \
  --timeout 10m

# 初始化测试数据
echo "📊 Initializing test data..."
kubectl run test-data-init --image=cost-rag/test-data:latest \
  --restart=Never \
  --namespace ${NAMESPACE} \
  --env="DATABASE_URL=postgresql://cost_rag:password@postgresql:5432/cost_rag" \
  --env="REDIS_URL=redis://redis-master:6379/0" \
  --command -- python init_test_data.py

# 等待数据初始化完成
kubectl wait --for=condition=complete job/test-data-init --namespace ${NAMESPACE} --timeout=300s

# 验证部署
echo "✅ Verifying test deployment..."
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}

# 运行健康检查
./scripts/health-check.sh --namespace ${NAMESPACE}

echo "🎉 Test environment deployed successfully!"
echo "Test API URL: https://test-api.cost-rag.com"
```

### 3. 测试配置文件

```yaml
# values-test.yaml
global:
  environment: test
  imageRegistry: "your-registry.com"

api:
  replicaCount: 2
  image:
    tag: "latest"
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi
  autoscaling:
    enabled: false

worker:
  replicaCount: 2
  image:
    tag: "latest"
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
  autoscaling:
    enabled: false

postgresql:
  auth:
    postgresPassword: "test_password"
    database: "cost_rag_test"
  primary:
    persistence:
      enabled: true
      size: 100Gi
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi

redis:
  auth:
    enabled: false
  master:
    persistence:
      enabled: true
      size: 10Gi
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 250m
        memory: 256Mi

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-test"
  hosts:
    - host: test-api.cost-rag.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cost-rag-test-tls
      hosts:
        - test-api.cost-rag.com
```

## 🎭 预生产环境配置

### 1. 预生产环境架构

```yaml
# 预生产环境配置
StagingEnvironment:
  Purpose: 生产前验证、用户验收测试
  Infrastructure:
    - Kubernetes集群 (5节点)
    - PostgreSQL (主从复制)
    - Redis (集群模式)
    - Milvus (集群模式)
    - MinIO (分布式)

  AutoScaling:
    Enabled: true
    MinInstances: 2
    MaxInstances: 8

  Monitoring:
    - 完整监控栈
    - 性能分析
    - 错误追踪

  Data:
    - 生产数据脱敏副本
    - 定期同步
    - 数据隔离
```

### 2. 预生产部署配置

```yaml
# values-staging.yaml
global:
  environment: staging
  imageRegistry: "your-registry.com"

api:
  replicaCount: 3
  image:
    tag: "staging"
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 8
    targetCPUUtilizationPercentage: 70

worker:
  replicaCount: 5
  image:
    tag: "staging"
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 15
    targetCPUUtilizationPercentage: 70

postgresql:
  auth:
    postgresPassword: "staging_password"
    database: "cost_rag_staging"
  primary:
    persistence:
      enabled: true
      size: 500Gi
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 4Gi
  readReplicas:
    replicaCount: 2
    persistence:
      enabled: true
      size: 500Gi
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 1000m
        memory: 2Gi

redis:
  auth:
    enabled: true
    password: "staging_redis_password"
  master:
    persistence:
      enabled: true
      size: 50Gi
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 50Gi

monitoring:
  enabled: true
  prometheus:
    enabled: true
    retention: 15d
  grafana:
    enabled: true
    persistence:
      enabled: true
      size: 10Gi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "500"
  hosts:
    - host: staging-api.cost-rag.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cost-rag-staging-tls
      hosts:
        - staging-api.cost-rag.com
```

## 🚀 生产环境配置

### 1. 生产环境架构

```yaml
# 生产环境配置
ProductionEnvironment:
  Purpose: 正式运行环境
  Infrastructure:
    - Kubernetes集群 (多可用区，10+节点)
    - PostgreSQL (主从复制，跨AZ)
    - Redis (集群模式，跨AZ)
    - Milvus (集群模式，跨AZ)
    - MinIO (分布式，跨AZ)
    - CDN (全球分发)
    - WAF (安全防护)

  HighAvailability:
    - 多可用区部署
    - 自动故障转移
    - 健康检查
    - 负载均衡

  AutoScaling:
    Enabled: true
    MinInstances: 5
    MaxInstances: 50

  Monitoring:
    - 全链路监控
    - 实时告警
    - 性能分析
    - 审计日志

  Security:
    - 网络隔离
    - 数据加密
    - 访问控制
    - 安全扫描
```

### 2. 生产环境配置

```yaml
# values-production.yaml
global:
  environment: production
  imageRegistry: "your-registry.com"

api:
  replicaCount: 5
  image:
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 50
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values:
              - cost-rag-api
          topologyKey: kubernetes.io/hostname

worker:
  replicaCount: 10
  image:
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 2000m
      memory: 4Gi
    limits:
      cpu: 4000m
      memory: 8Gi
  autoscaling:
    enabled: true
    minReplicas: 10
    maxReplicas: 100
    targetCPUUtilizationPercentage: 70

postgresql:
  auth:
    existingSecret: "postgres-secret"
  primary:
    persistence:
      enabled: true
      size: 2000Gi
      storageClass: "io2"
    resources:
      requests:
        cpu: 2000m
        memory: 4Gi
      limits:
        cpu: 4000m
        memory: 8Gi
  readReplicas:
    replicaCount: 3
    persistence:
      enabled: true
      size: 2000Gi
      storageClass: "io2"
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 4Gi

redis:
  auth:
    existingSecret: "redis-secret"
  master:
    persistence:
      enabled: true
      size: 200Gi
      storageClass: "io2"
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 1000m
        memory: 2Gi
  replica:
    replicaCount: 3
    persistence:
      enabled: true
      size: 200Gi
      storageClass: "io2"

monitoring:
  enabled: true
  prometheus:
    enabled: true
    retention: 30d
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 2000m
        memory: 4Gi
  grafana:
    enabled: true
    persistence:
      enabled: true
      size: 20Gi
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: api.cost-rag.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cost-rag-production-tls
      hosts:
        - api.cost-rag.com

podDisruptionBudget:
  enabled: true
  api:
    minAvailable: 2
  worker:
    minAvailable: 5

networkPolicy:
  enabled: true
  ingress:
    enabled: true
  egress:
    enabled: true
```

## 🔧 环境变量管理

### 1. 环境变量模板

```bash
# .env.example
# =============================================================================
# Cost-RAG Environment Variables Template
# Copy this file to .env and update with your values
# =============================================================================

# =============================================================================
# 应用基础配置
# =============================================================================
# 应用环境 (development, testing, staging, production)
ENVIRONMENT=development

# 调试模式 (true/false)
DEBUG=true

# 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=INFO

# 应用版本
VERSION=1.0.0

# =============================================================================
# 数据库配置
# =============================================================================
# PostgreSQL数据库连接
DATABASE_URL=postgresql://cost_rag:password@localhost:5432/cost_rag

# 数据库连接池配置
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=3600

# =============================================================================
# Redis缓存配置
# =============================================================================
# Redis连接URL
REDIS_URL=redis://localhost:6379/0

# Redis连接池配置
REDIS_POOL_SIZE=50
REDIS_POOL_TIMEOUT=10

# =============================================================================
# Milvus向量数据库配置
# =============================================================================
# Milvus服务器地址
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Milvus连接配置
MILVUS_CONNECTION_TIMEOUT=10
MILVUS_CONNECTION_POOL_SIZE=10

# =============================================================================
# Neo4j图数据库配置
# =============================================================================
# Neo4j连接URI
NEO4J_URI=bolt://localhost:7687

# Neo4j认证
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# =============================================================================
# MinIO对象存储配置
# =============================================================================
# MinIO服务端点
MINIO_ENDPOINT=localhost:9000

# MinIO认证
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# 存储桶配置
MINIO_BUCKET_NAME=cost-rag-documents
MINIO_SECURE=false

# =============================================================================
# RabbitMQ消息队列配置
# =============================================================================
# RabbitMQ连接URL
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# =============================================================================
# JWT认证配置
# =============================================================================
# JWT密钥 (生产环境请使用强密钥)
JWT_SECRET=your-super-secret-jwt-key-here

# JWT算法
JWT_ALGORITHM=HS256

# Token过期时间
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# =============================================================================
# OpenAI配置
# =============================================================================
# OpenAI API密钥
OPENAI_API_KEY=your-openai-api-key-here

# OpenAI模型配置
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.1

# =============================================================================
# 文件处理配置
# =============================================================================
# 文件上传限制
MAX_FILE_SIZE=100MB
ALLOWED_EXTENSIONS=pdf,docx,xlsx,ppt,jpg,png,jpeg

# 文件存储路径
UPLOAD_PATH=./uploads
TEMP_PATH=./temp

# =============================================================================
# 邮件配置
# =============================================================================
# SMTP服务器配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=true

# 邮件发送配置
EMAIL_FROM=noreply@cost-rag.com
EMAIL_FROM_NAME=Cost-RAG System

# =============================================================================
# Celery配置
# =============================================================================
# Celery代理URL
CELERY_BROKER_URL=amqp://guest:guest@localhost:5672/
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Celery任务配置
CELERY_TASK_SERIALIZER=json
CELERY_RESULT_SERIALIZER=json
CELERY_ACCEPT_CONTENT=["json"]
CELERY_TIMEZONE=UTC
CELERY_ENABLE_UTC=true

# =============================================================================
# 安全配置
# =============================================================================
# CORS配置
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8080"]
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS=["*"]

# 安全头配置
SECURITY_HEADERS=true
X_FRAME_OPTIONS=DENY
X_CONTENT_TYPE_OPTIONS=nosniff
X_XSS_PROTECTION=1; mode=block

# =============================================================================
# 监控配置
# =============================================================================
# 健康检查配置
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/health

# 指标收集配置
METRICS_ENABLED=true
METRICS_PATH=/metrics

# =============================================================================
# 第三方服务配置
# =============================================================================
# Sentry错误追踪
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=development

# New Relic应用监控
NEW_RELIC_LICENSE_KEY=your-newrelic-key-here
NEW_RELIC_APP_NAME=cost-rag

# =============================================================================
# 业务配置
# =============================================================================
# 分页配置
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100

# 缓存配置
CACHE_TTL=3600
CACHE_PREFIX=cost_rag

# API限流配置
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# =============================================================================
# 特性开关
# =============================================================================
# 功能开关
FEATURE_DOCUMENT_UPLOAD=true
FEATURE_COST_ESTIMATION=true
FEATURE_MULTI_PROJECT_COMPARISON=true
FEATURE_RAG_QUERY=true
FEATURE_KNOWLEDGE_GRAPH=true

# 实验性功能
EXPERIMENTAL_FEATURES=false
BETA_FEATURES=true
```

### 2. 环境变量验证脚本

```python
#!/usr/bin/env python3
# validate-env.py - 环境变量验证脚本

import os
import sys
import re
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse


class EnvironmentValidator:
    def __init__(self, env_file: str = ".env"):
        self.env_file = env_file
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.required_vars = self._get_required_variables()
        self.optional_vars = self._get_optional_variables()

    def _get_required_variables(self) -> Dict[str, Dict[str, Any]]:
        """获取必需的环境变量配置"""
        return {
            "DATABASE_URL": {
                "pattern": r"^postgresql://[^:]+:[^@]+@[^:]+:\d+/[^/]+$",
                "description": "PostgreSQL数据库连接URL"
            },
            "REDIS_URL": {
                "pattern": r"^redis://[^:]+:\d+/\d+$",
                "description": "Redis缓存连接URL"
            },
            "JWT_SECRET": {
                "min_length": 32,
                "description": "JWT密钥，至少32个字符"
            },
            "OPENAI_API_KEY": {
                "pattern": r"^sk-[a-zA-Z0-9]{48}$",
                "description": "OpenAI API密钥"
            }
        }

    def _get_optional_variables(self) -> Dict[str, Dict[str, Any]]:
        """获取可选的环境变量配置"""
        return {
            "MILVUS_HOST": {
                "default": "localhost",
                "description": "Milvus服务器地址"
            },
            "MILVUS_PORT": {
                "default": "19530",
                "type": "int",
                "description": "Milvus服务器端口"
            },
            "DEBUG": {
                "default": "false",
                "type": "bool",
                "description": "调试模式"
            },
            "LOG_LEVEL": {
                "default": "INFO",
                "choices": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                "description": "日志级别"
            }
        }

    def load_env_file(self) -> Dict[str, str]:
        """加载环境变量文件"""
        env_vars = {}

        if not os.path.exists(self.env_file):
            self.errors.append(f"环境变量文件 {self.env_file} 不存在")
            return env_vars

        try:
            with open(self.env_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()

                    # 跳过注释和空行
                    if not line or line.startswith('#'):
                        continue

                    # 解析键值对
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()

                        # 移除引号
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]

                        env_vars[key] = value
                    else:
                        self.warnings.append(f"第 {line_num} 行格式错误: {line}")

        except Exception as e:
            self.errors.append(f"读取环境变量文件失败: {str(e)}")

        return env_vars

    def validate_variable(self, name: str, value: str, config: Dict[str, Any]) -> bool:
        """验证单个环境变量"""
        is_valid = True

        # 检查最小长度
        if "min_length" in config and len(value) < config["min_length"]:
            self.errors.append(f"{name}: 长度不足，至少需要 {config['min_length']} 个字符")
            is_valid = False

        # 检查正则表达式
        if "pattern" in config and not re.match(config["pattern"], value):
            self.errors.append(f"{name}: 格式不正确，应为 {config['description']}")
            is_valid = False

        # 检查类型
        if "type" in config:
            if config["type"] == "bool":
                if value.lower() not in ["true", "false"]:
                    self.errors.append(f"{name}: 必须为 true 或 false")
                    is_valid = False
            elif config["type"] == "int":
                if not value.isdigit():
                    self.errors.append(f"{name}: 必须为整数")
                    is_valid = False

        # 检查选择项
        if "choices" in config and value not in config["choices"]:
            self.errors.append(f"{name}: 必须为以下值之一: {', '.join(config['choices'])}")
            is_valid = False

        return is_valid

    def validate_database_url(self, url: str) -> bool:
        """验证数据库URL"""
        try:
            parsed = urlparse(url)

            if parsed.scheme != "postgresql":
                self.errors.append("DATABASE_URL: 必须使用 PostgreSQL 协议")
                return False

            if not all([parsed.hostname, parsed.username, parsed.password]):
                self.errors.append("DATABASE_URL: 缺少必要的主机、用户名或密码")
                return False

            if not parsed.path or parsed.path == "/":
                self.errors.append("DATABASE_URL: 缺少数据库名称")
                return False

            return True

        except Exception:
            self.errors.append("DATABASE_URL: URL格式无效")
            return False

    def validate_redis_url(self, url: str) -> bool:
        """验证Redis URL"""
        try:
            parsed = urlparse(url)

            if parsed.scheme != "redis":
                self.errors.append("REDIS_URL: 必须使用 Redis 协议")
                return False

            if not parsed.hostname:
                self.errors.append("REDIS_URL: 缺少主机地址")
                return False

            if not parsed.path or parsed.path == "/":
                self.errors.append("REDIS_URL: 缺少数据库编号")
                return False

            db_num = parsed.path.lstrip("/")
            if not db_num.isdigit():
                self.errors.append("REDIS_URL: 数据库编号必须为整数")
                return False

            return True

        except Exception:
            self.errors.append("REDIS_URL: URL格式无效")
            return False

    def validate_security(self, env_vars: Dict[str, str]) -> None:
        """验证安全相关配置"""
        # 检查生产环境配置
        if env_vars.get("ENVIRONMENT") == "production":
            if env_vars.get("DEBUG", "false").lower() == "true":
                self.warnings.append("生产环境不应启用调试模式")

            if env_vars.get("JWT_SECRET") == "your-super-secret-jwt-key-here":
                self.errors.append("生产环境必须设置安全的JWT密钥")

            if env_vars.get("DATABASE_URL", "").contains("localhost"):
                self.warnings.append("生产环境建议使用专用数据库服务器")

    def validate(self) -> bool:
        """执行验证"""
        print(f"🔍 验证环境变量文件: {self.env_file}")
        print("-" * 50)

        env_vars = self.load_env_file()

        if self.errors:
            print("❌ 环境变量文件加载失败:")
            for error in self.errors:
                print(f"   • {error}")
            return False

        # 验证必需变量
        missing_vars = []
        for var_name, config in self.required_vars.items():
            if var_name not in env_vars:
                missing_vars.append(var_name)
            else:
                self.validate_variable(var_name, env_vars[var_name], config)

        if missing_vars:
            self.errors.insert(0, f"缺少必需的环境变量: {', '.join(missing_vars)}")

        # 验证特定变量
        if "DATABASE_URL" in env_vars:
            self.validate_database_url(env_vars["DATABASE_URL"])

        if "REDIS_URL" in env_vars:
            self.validate_redis_url(env_vars["REDIS_URL"])

        # 验证安全配置
        self.validate_security(env_vars)

        # 设置默认值
        for var_name, config in self.optional_vars.items():
            if var_name not in env_vars and "default" in config:
                env_vars[var_name] = config["default"]
                print(f"📝 使用默认值: {var_name}={config['default']}")

        # 输出结果
        print("\n📊 验证结果:")
        print("-" * 30)

        if self.errors:
            print("❌ 错误:")
            for error in self.errors:
                print(f"   • {error}")

        if self.warnings:
            print("⚠️  警告:")
            for warning in self.warnings:
                print(f"   • {warning}")

        if not self.errors and not self.warnings:
            print("✅ 所有环境变量配置正确!")

        return len(self.errors) == 0

    def generate_example(self) -> None:
        """生成示例配置文件"""
        example_file = f"{self.env_file}.example"

        with open(example_file, 'w', encoding='utf-8') as f:
            f.write("# Cost-RAG Environment Variables Example\n")
            f.write("# Copy this file to .env and update with your values\n\n")

            f.write("# Required Variables\n")
            for var_name, config in self.required_vars.items():
                f.write(f"# {config['description']}\n")
                f.write(f"{var_name}=\n\n")

            f.write("# Optional Variables\n")
            for var_name, config in self.optional_vars.items():
                f.write(f"# {config['description']}")
                if "default" in config:
                    f.write(f" (默认: {config['default']})")
                f.write("\n")
                f.write(f"# {var_name}={config.get('default', '')}\n\n")

        print(f"📝 示例配置文件已生成: {example_file}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="验证环境变量配置")
    parser.add_argument("--env-file", default=".env", help="环境变量文件路径")
    parser.add_argument("--generate-example", action="store_true", help="生成示例配置文件")

    args = parser.parse_args()

    validator = EnvironmentValidator(args.env_file)

    if args.generate_example:
        validator.generate_example()
        return

    is_valid = validator.validate()

    sys.exit(0 if is_valid else 1)


if __name__ == "__main__":
    main()
```

## ✅ 配置验证

### 1. 健康检查脚本

```bash
#!/bin/bash
# health-check.sh

set -e

NAMESPACE="default"
TIMEOUT=300
VERBOSE=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

echo "🔍 执行健康检查..."
echo "命名空间: $NAMESPACE"
echo "超时时间: ${TIMEOUT}秒"
echo "---"

# 检查Pod状态
check_pods() {
    echo "📦 检查Pod状态..."

    local pod_status=$(kubectl get pods -n $NAMESPACE --no-headers 2>/dev/null)

    if [ -z "$pod_status" ]; then
        echo "❌ 无法获取Pod状态"
        return 1
    fi

    echo "$pod_status" | while read -r line; do
        local pod_name=$(echo $line | awk '{print $1}')
        local pod_ready=$(echo $line | awk '{print $2}')
        local pod_status=$(echo $line | awk '{print $3}')
        local pod_restarts=$(echo $line | awk '{print $4}')

        if [ "$VERBOSE" = true ]; then
            echo "   Pod: $pod_name | Ready: $pod_ready | Status: $pod_status | Restarts: $pod_restarts"
        fi

        # 检查Pod是否就绪
        local ready_expected=$(echo $pod_ready | cut -d'/' -f2)
        local ready_actual=$(echo $pod_ready | cut -d'/' -f1)

        if [ "$ready_actual" -lt "$ready_expected" ]; then
            echo "⚠️  Pod $pod_name 未完全就绪 ($pod_ready)"
        elif [ "$pod_status" != "Running" ] && [ "$pod_status" != "Completed" ]; then
            echo "❌ Pod $pod_name 状态异常: $pod_status"
        fi
    done

    echo "✅ Pod状态检查完成"
}

# 检查服务状态
check_services() {
    echo "🔗 检查服务状态..."

    local services=$(kubectl get services -n $NAMESPACE --no-headers 2>/dev/null)

    if [ -z "$services" ]; then
        echo "❌ 无法获取服务状态"
        return 1
    fi

    echo "$services" | while read -r line; do
        local service_name=$(echo $line | awk '{print $1}')
        local service_type=$(echo $line | awk '{print $2}')
        local cluster_ip=$(echo $line | awk '{print $3}')
        local ports=$(echo $line | awk '{print $5}')

        if [ "$VERBOSE" = true ]; then
            echo "   Service: $service_name | Type: $service_type | IP: $cluster_ip | Ports: $ports"
        fi

        # 检查ClusterIP
        if [ "$service_type" = "ClusterIP" ] && [ "$cluster_ip" = "<none>" ]; then
            echo "⚠️  Service $service_name 没有分配ClusterIP"
        fi
    done

    echo "✅ 服务状态检查完成"
}

# 检查Ingress状态
check_ingress() {
    echo "🌐 检查Ingress状态..."

    local ingress_list=$(kubectl get ingress -n $NAMESPACE --no-headers 2>/dev/null)

    if [ -z "$ingress_list" ]; then
        echo "ℹ️  没有找到Ingress资源"
        return 0
    fi

    echo "$ingress_list" | while read -r line; do
        local ingress_name=$(echo $line | awk '{print $1}')
        local ingress_class=$(echo $line | awk '{print $2}')
        local hosts=$(echo $line | awk '{print $3}')
        local address=$(echo $line | awk '{print $4}')
        local ports=$(echo $line | awk '{print $5}')

        if [ "$VERBOSE" = true ]; then
            echo "   Ingress: $ingress_name | Class: $ingress_class | Hosts: $hosts | Address: $address"
        fi

        # 检查地址分配
        if [ "$address" = "<pending>" ]; then
            echo "⚠️  Ingress $ingress_name 地址分配中..."
        elif [ -z "$address" ] || [ "$address" = "<none>" ]; then
            echo "❌ Ingress $ingress_name 没有分配地址"
        fi
    done

    echo "✅ Ingress状态检查完成"
}

# 检查API健康状态
check_api_health() {
    echo "🏥 检查API健康状态..."

    local api_url="http://api.cost-rag.com/health"

    # 如果是本地开发，使用localhost
    if [ "$NAMESPACE" = "default" ]; then
        api_url="http://localhost:8000/health"
    fi

    # 等待服务响应
    local end_time=$(($(date +%s) + TIMEOUT))

    while [ $(date +%s) -lt $end_time ]; do
        if curl -s -f "$api_url" > /dev/null 2>&1; then
            echo "✅ API健康检查通过"
            return 0
        fi

        if [ "$VERBOSE" = true ]; then
            echo "   等待API响应... ($(date))"
        fi

        sleep 5
    done

    echo "❌ API健康检查失败"
    return 1
}

# 检查数据库连接
check_database_connection() {
    echo "🗄️  检查数据库连接..."

    local db_host="cost-rag-postgres"
    local db_port="5432"

    # 等待数据库就绪
    local end_time=$(($(date +%s) + TIMEOUT))

    while [ $(date +%s) -lt $end_time ]; do
        if kubectl exec -n $NAMESPACE deployment/cost-rag-api -- pg_isready -h $db_host -p $db_port > /dev/null 2>&1; then
            echo "✅ 数据库连接正常"
            return 0
        fi

        if [ "$VERBOSE" = true ]; then
            echo "   等待数据库连接... ($(date))"
        fi

        sleep 5
    done

    echo "❌ 数据库连接失败"
    return 1
}

# 检查Redis连接
check_redis_connection() {
    echo "📦 检查Redis连接..."

    local redis_host="cost-rag-redis-master"
    local redis_port="6379"

    # 等待Redis就绪
    local end_time=$(($(date +%s) + TIMEOUT))

    while [ $(date +%s) -lt $end_time ]; do
        if kubectl exec -n $NAMESPACE deployment/cost-rag-api -- redis-cli -h $redis_host -p $redis_port ping > /dev/null 2>&1; then
            echo "✅ Redis连接正常"
            return 0
        fi

        if [ "$VERBOSE" = true ]; then
            echo "   等待Redis连接... ($(date))"
        fi

        sleep 5
    done

    echo "❌ Redis连接失败"
    return 1
}

# 检查资源使用情况
check_resource_usage() {
    echo "📊 检查资源使用情况..."

    # 检查CPU和内存使用
    kubectl top pods -n $NAMESPACE --no-headers 2>/dev/null | while read -r line; do
        local pod_name=$(echo $line | awk '{print $1}')
        local cpu_usage=$(echo $line | awk '{print $2}')
        local memory_usage=$(echo $line | awk '{print $3}')

        if [ "$VERBOSE" = true ]; then
            echo "   $pod_name: CPU=$cpu_usage, Memory=$memory_usage"
        fi

        # 检查CPU使用率
        local cpu_value=$(echo $cpu_usage | sed 's/m//')
        if [ "$cpu_value" -gt 1000 ]; then
            echo "⚠️  Pod $pod_name CPU使用率较高: $cpu_usage"
        fi

        # 检查内存使用
        local memory_value=$(echo $memory_usage | sed 's/Mi//')
        if [ "$memory_value" -gt 2000 ]; then
            echo "⚠️  Pod $pod_name 内存使用较高: $memory_usage"
        fi
    done

    echo "✅ 资源使用情况检查完成"
}

# 主检查函数
main() {
    local start_time=$(date +%s)
    local checks_passed=0
    local total_checks=6

    # 执行各项检查
    if check_pods; then ((checks_passed++)); fi
    if check_services; then ((checks_passed++)); fi
    if check_ingress; then ((checks_passed++)); fi
    if check_api_health; then ((checks_passed++)); fi
    if check_database_connection; then ((checks_passed++)); fi
    if check_redis_connection; then ((checks_passed++)); fi

    # 检查资源使用情况（可选）
    if [ "$VERBOSE" = true ]; then
        check_resource_usage
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "---"
    echo "📈 健康检查完成!"
    echo "通过检查: $checks_passed/$total_checks"
    echo "用时: ${duration}秒"

    if [ $checks_passed -eq $total_checks ]; then
        echo "🎉 所有检查通过!"
        exit 0
    else
        echo "❌ 部分检查失败，请查看详细信息"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
Cost-RAG 健康检查工具

用法: $0 [选项]

选项:
  --namespace <name>    指定命名空间 (默认: default)
  --timeout <seconds>   设置超时时间 (默认: 300)
  --verbose, -v         显示详细输出
  --help, -h           显示此帮助信息

示例:
  $0                           # 使用默认配置
  $0 --namespace production    # 检查生产环境
  $0 --verbose                 # 显示详细输出
  $0 --timeout 600             # 设置10分钟超时

EOF
}

# 检查命令行参数
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# 检查kubectl是否可用
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 命令未找到，请确保已安装并配置"
    exit 1
fi

# 检查是否连接到集群
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 无法连接到Kubernetes集群"
    exit 1
fi

# 执行主检查
main
```

## 🔄 环境迁移

### 1. 数据迁移脚本

```python
#!/usr/bin/env python3
# migrate-environment.py - 环境数据迁移工具

import os
import sys
import argparse
import logging
from typing import Dict, List, Optional
from datetime import datetime
import psycopg2
import redis
from minio import Minio
from minio.error import S3Error
import json


class EnvironmentMigrator:
    def __init__(self, source_config: Dict, target_config: Dict):
        self.source_config = source_config
        self.target_config = target_config
        self.logger = self._setup_logger()

    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger("environment_migrator")
        logger.setLevel(logging.INFO)

        # 创建控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)

        # 创建文件处理器
        os.makedirs("logs", exist_ok=True)
        file_handler = logging.FileHandler(f"logs/migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
        file_handler.setLevel(logging.DEBUG)

        # 设置格式
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)

        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        return logger

    def migrate_database(self, tables: Optional[List[str]] = None) -> bool:
        """迁移数据库数据"""
        self.logger.info("开始数据库迁移...")

        try:
            # 连接源数据库
            source_conn = psycopg2.connect(
                host=self.source_config['db_host'],
                port=self.source_config['db_port'],
                database=self.source_config['db_name'],
                user=self.source_config['db_user'],
                password=self.source_config['db_password']
            )

            # 连接目标数据库
            target_conn = psycopg2.connect(
                host=self.target_config['db_host'],
                port=self.target_config['db_port'],
                database=self.target_config['db_name'],
                user=self.target_config['db_user'],
                password=self.target_config['db_password']
            )

            source_cursor = source_conn.cursor()
            target_cursor = target_conn.cursor()

            # 获取表列表
            if not tables:
                source_cursor.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """)
                tables = [row[0] for row in source_cursor.fetchall()]

            total_tables = len(tables)
            migrated_tables = 0

            for table_name in tables:
                self.logger.info(f"迁移表: {table_name}")

                try:
                    # 获取表数据
                    source_cursor.execute(f"SELECT * FROM {table_name}")
                    columns = [desc[0] for desc in source_cursor.description]
                    rows = source_cursor.fetchall()

                    if not rows:
                        self.logger.info(f"表 {table_name} 为空，跳过")
                        continue

                    # 清空目标表
                    target_cursor.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")

                    # 批量插入数据
                    batch_size = 1000
                    for i in range(0, len(rows), batch_size):
                        batch = rows[i:i + batch_size]

                        # 构建插入语句
                        placeholders = ', '.join(['%s'] * len(columns))
                        insert_query = f"""
                            INSERT INTO {table_name} ({', '.join(columns)})
                            VALUES ({placeholders})
                        """

                        target_cursor.executemany(insert_query, batch)
                        target_conn.commit()

                    migrated_tables += 1
                    self.logger.info(f"表 {table_name} 迁移完成，共 {len(rows)} 条记录")

                except Exception as e:
                    self.logger.error(f"迁移表 {table_name} 失败: {str(e)}")
                    target_conn.rollback()
                    continue

            # 关闭连接
            source_cursor.close()
            target_cursor.close()
            source_conn.close()
            target_conn.close()

            self.logger.info(f"数据库迁移完成: {migrated_tables}/{total_tables} 个表")
            return migrated_tables == total_tables

        except Exception as e:
            self.logger.error(f"数据库迁移失败: {str(e)}")
            return False

    def migrate_redis_data(self) -> bool:
        """迁移Redis数据"""
        self.logger.info("开始Redis数据迁移...")

        try:
            # 连接源Redis
            source_redis = redis.Redis(
                host=self.source_config['redis_host'],
                port=self.source_config['redis_port'],
                db=self.source_config['redis_db'],
                decode_responses=True
            )

            # 连接目标Redis
            target_redis = redis.Redis(
                host=self.target_config['redis_host'],
                port=self.target_config['redis_port'],
                db=self.target_config['redis_db'],
                decode_responses=True
            )

            # 获取所有键
            keys = source_redis.keys('*')
            total_keys = len(keys)
            migrated_keys = 0

            for key in keys:
                try:
                    # 获取键类型
                    key_type = source_redis.type(key)

                    if key_type == 'string':
                        value = source_redis.get(key)
                        target_redis.set(key, value)
                    elif key_type == 'hash':
                        value = source_redis.hgetall(key)
                        target_redis.hmset(key, value)
                    elif key_type == 'list':
                        value = source_redis.lrange(key, 0, -1)
                        target_redis.delete(key)
                        for item in value:
                            target_redis.rpush(key, item)
                    elif key_type == 'set':
                        value = source_redis.smembers(key)
                        target_redis.sadd(key, *value)
                    elif key_type == 'zset':
                        value = source_redis.zrange(key, 0, -1, withscores=True)
                        for member, score in value:
                            target_redis.zadd(key, {member: score})

                    migrated_keys += 1

                    if migrated_keys % 1000 == 0:
                        self.logger.info(f"已迁移 {migrated_keys}/{total_keys} 个键")

                except Exception as e:
                    self.logger.error(f"迁移键 {key} 失败: {str(e)}")
                    continue

            self.logger.info(f"Redis数据迁移完成: {migrated_keys}/{total_keys} 个键")
            return migrated_keys == total_keys

        except Exception as e:
            self.logger.error(f"Redis数据迁移失败: {str(e)}")
            return False

    def migrate_minio_data(self, bucket_name: str) -> bool:
        """迁移MinIO对象存储数据"""
        self.logger.info(f"开始迁移MinIO存储桶: {bucket_name}")

        try:
            # 连接源MinIO
            source_client = Minio(
                self.source_config['minio_endpoint'],
                access_key=self.source_config['minio_access_key'],
                secret_key=self.source_config['minio_secret_key'],
                secure=self.source_config.get('minio_secure', False)
            )

            # 连接目标MinIO
            target_client = Minio(
                self.target_config['minio_endpoint'],
                access_key=self.target_config['minio_access_key'],
                secret_key=self.target_config['minio_secret_key'],
                secure=self.target_config.get('minio_secure', False)
            )

            # 创建目标存储桶
            if not target_client.bucket_exists(bucket_name):
                target_client.make_bucket(bucket_name)

            # 获取对象列表
            objects = source_client.list_objects(bucket_name, recursive=True)
            total_objects = 0
            migrated_objects = 0

            # 先计算总数
            source_client = Minio(
                self.source_config['minio_endpoint'],
                access_key=self.source_config['minio_access_key'],
                secret_key=self.source_config['minio_secret_key'],
                secure=self.source_config.get('minio_secure', False)
            )
            for _ in source_client.list_objects(bucket_name, recursive=True):
                total_objects += 1

            # 迁移对象
            for obj in source_client.list_objects(bucket_name, recursive=True):
                try:
                    # 获取对象数据
                    response = source_client.get_object(bucket_name, obj.object_name)
                    data = response.read()

                    # 上传到目标存储桶
                    target_client.put_object(
                        bucket_name,
                        obj.object_name,
                        data=data,
                        length=len(data),
                        content_type=response.headers.get('content-type')
                    )

                    migrated_objects += 1

                    if migrated_objects % 100 == 0:
                        self.logger.info(f"已迁移 {migrated_objects}/{total_objects} 个对象")

                except Exception as e:
                    self.logger.error(f"迁移对象 {obj.object_name} 失败: {str(e)}")
                    continue

            self.logger.info(f"MinIO数据迁移完成: {migrated_objects}/{total_objects} 个对象")
            return migrated_objects == total_objects

        except Exception as e:
            self.logger.error(f"MinIO数据迁移失败: {str(e)}")
            return False

    def generate_migration_report(self, results: Dict[str, bool]) -> None:
        """生成迁移报告"""
        report = {
            "migration_time": datetime.now().isoformat(),
            "source_environment": self.source_config.get('environment', 'unknown'),
            "target_environment": self.target_config.get('environment', 'unknown'),
            "results": results,
            "summary": {
                "total_components": len(results),
                "successful_migrations": sum(results.values()),
                "failed_migrations": len(results) - sum(results.values())
            }
        }

        # 保存报告
        report_file = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        self.logger.info(f"迁移报告已保存: {report_file}")

        # 打印摘要
        print("\n" + "="*50)
        print("迁移摘要")
        print("="*50)
        print(f"源环境: {report['source_environment']}")
        print(f"目标环境: {report['target_environment']}")
        print(f"迁移时间: {report['migration_time']}")
        print(f"总组件数: {report['summary']['total_components']}")
        print(f"成功迁移: {report['summary']['successful_migrations']}")
        print(f"失败迁移: {report['summary']['failed_migrations']}")
        print("="*50)

    def execute_migration(self, components: List[str]) -> bool:
        """执行完整迁移"""
        self.logger.info("开始环境迁移...")

        results = {}

        if 'database' in components:
            results['database'] = self.migrate_database()

        if 'redis' in components:
            results['redis'] = self.migrate_redis_data()

        if 'minio' in components:
            results['minio'] = self.migrate_minio_data('cost-rag-documents')

        # 生成报告
        self.generate_migration_report(results)

        # 返回整体结果
        return all(results.values())


def load_config(config_file: str) -> Dict:
    """加载配置文件"""
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="环境数据迁移工具")
    parser.add_argument("--source-config", required=True, help="源环境配置文件")
    parser.add_argument("--target-config", required=True, help="目标环境配置文件")
    parser.add_argument("--components", nargs='+',
                       choices=['database', 'redis', 'minio'],
                       default=['database', 'redis', 'minio'],
                       help="要迁移的组件")
    parser.add_argument("--dry-run", action="store_true", help="只显示将要迁移的内容，不执行实际迁移")

    args = parser.parse_args()

    # 加载配置
    try:
        source_config = load_config(args.source_config)
        target_config = load_config(args.target_config)
    except Exception as e:
        print(f"❌ 加载配置文件失败: {str(e)}")
        sys.exit(1)

    # 创建迁移器
    migrator = EnvironmentMigrator(source_config, target_config)

    if args.dry_run:
        print("🔍 预演模式 - 不会执行实际迁移")
        print(f"源环境: {source_config.get('environment', 'unknown')}")
        print(f"目标环境: {target_config.get('environment', 'unknown')}")
        print(f"迁移组件: {', '.join(args.components)}")
        return

    # 执行迁移
    success = migrator.execute_migration(args.components)

    if success:
        print("🎉 环境迁移成功完成!")
        sys.exit(0)
    else:
        print("❌ 环境迁移失败，请查看日志")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

---

## 📞 技术支持

- **环境配置**: [配置模板文件](../config/)
- **部署脚本**: [scripts目录](../scripts/)
- **故障排查**: [故障排查指南](../troubleshooting/)
- **技术支持**: support@cost-rag.com