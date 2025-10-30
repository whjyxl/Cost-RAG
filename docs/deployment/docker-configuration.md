# Docker容器化配置

## 📋 目录

- [Docker概述](#docker概述)
- [多容器架构](#多容器架构)
- [Docker Compose配置](#docker-compose配置)
- [服务配置详解](#服务配置详解)
- [网络与存储](#网络与存储)
- [环境配置](#环境配置)
- [部署流程](#部署流程)
- [监控与日志](#监控与日志)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

## 🐳 Docker概述

Cost-RAG系统采用微服务架构，通过Docker容器化实现服务的独立部署、扩展和管理。每个服务运行在独立的容器中，通过Docker Compose进行编排。

### 容器化优势

- **环境一致性**: 开发、测试、生产环境完全一致
- **快速部署**: 秒级启动，支持弹性扩缩容
- **资源隔离**: CPU、内存、网络资源隔离
- **版本管理**: 镜像版本化，支持回滚
- **运维简化**: 统一的生命周期管理

## 🏗️ 多容器架构

### 服务容器划分

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx:80]
    end

    subgraph "Application Layer"
        API[FastAPI:8000]
        WS[WebSocket:8001]
        WORKER[Celery Workers:8002]
    end

    subgraph "Data Layer"
        PG[PostgreSQL:5432]
        REDIS[Redis:6379]
        MILVUS[Milvus:19530]
        NEO4J[Neo4j:7474]
        MINIO[MinIO:9000]
    end

    subgraph "External Services"
        RABBIT[RabbitMQ:5672]
        ELASTIC[Elasticsearch:9200]
    end

    LB --> API
    LB --> WS
    API --> PG
    API --> REDIS
    API --> MILVUS
    API --> NEO4J
    API --> MINIO

    WORKER --> RABBIT
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> ELASTIC

    WS --> REDIS
```

## 📋 Docker Compose配置

### 主配置文件 (docker-compose.yml)

```yaml
version: '3.8'

services:
  # API服务
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: cost-rag-api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://cost_rag:${POSTGRES_PASSWORD}@postgres:5432/cost_rag
      - REDIS_URL=redis://redis:6379/0
      - MILVUS_HOST=milvus
      - MILVUS_PORT=19530
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672/
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      milvus:
        condition: service_healthy
      neo4j:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # WebSocket服务
  websocket:
    build:
      context: .
      dockerfile: Dockerfile.websocket
    container_name: cost-rag-websocket
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Celery Worker
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    container_name: cost-rag-worker
    environment:
      - DATABASE_URL=postgresql://cost_rag:${POSTGRES_PASSWORD}@postgres:5432/cost_rag
      - REDIS_URL=redis://redis:6379/0
      - MILVUS_HOST=milvus
      - MILVUS_PORT=19530
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672/
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
      - ./models:/app/models
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2

  # PostgreSQL数据库
  postgres:
    image: postgres:15-alpine
    container_name: cost-rag-postgres
    environment:
      - POSTGRES_DB=cost_rag
      - POSTGRES_USER=cost_rag
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cost_rag -d cost_rag"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis缓存
  redis:
    image: redis:7-alpine
    container_name: cost-rag-redis
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Milvus向量数据库
  milvus:
    image: milvusdb/milvus:v2.3.0
    container_name: cost-rag-milvus
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvus_data:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      etcd:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # etcd for Milvus
  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    container_name: cost-rag-etcd
    command:
      - etcd
      - --advertise-client-urls=http://127.0.0.1:2379
      - --listen-client-urls=http://0.0.0.0:2379
      - --data-dir=/etcd
    volumes:
      - etcd_data:/etcd
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MinIO对象存储
  minio:
    image: minio/minio:RELEASE.2023-12-14T18-51-57Z
    container_name: cost-rag-minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Neo4j图数据库
  neo4j:
    image: neo4j:5.12-community
    container_name: cost-rag-neo4j
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_security_procedures_unrestricted=apoc.*,gds.*
      - NEO4J_dbms_memory_heap_initial__size=512m
      - NEO4J_dbms_memory_heap_max__size=2G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    ports:
      - "7474:7474"
      - "7687:7687"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_PASSWORD}", "RETURN 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # RabbitMQ消息队列
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: cost-rag-rabbitmq
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Elasticsearch搜索引擎
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    container_name: cost-rag-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
      - "9300:9300"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    container_name: cost-rag-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./static:/var/www/static
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
      - websocket
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  milvus_data:
  etcd_data:
  minio_data:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
  rabbitmq_data:
  elasticsearch_data:

networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 开发环境配置 (docker-compose.dev.yml)

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/__pycache__
    environment:
      - DEBUG=true
      - LOG_LEVEL=DEBUG
      - RELOAD=true
    command: uvicorn cost_rag.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/__pycache__
    environment:
      - DEBUG=true
      - LOG_LEVEL=DEBUG
    command: celery -A cost_rag.celery worker --loglevel=info --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
      - REACT_APP_WS_URL=ws://localhost:8001
    command: npm start
```

### 生产环境配置 (docker-compose.prod.yml)

```yaml
version: '3.8'

services:
  api:
    image: cost-rag/api:${VERSION}
    environment:
      - DEBUG=false
      - LOG_LEVEL=INFO
      - WORKERS=4
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  worker:
    image: cost-rag/worker:${VERSION}
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=cost_rag_prod
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - postgres_backups:/backups

volumes:
  postgres_prod_data:
  postgres_backups:
```

## ⚙️ 服务配置详解

### API服务Dockerfile

```dockerfile
# Dockerfile.api
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
COPY requirements-prod.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements-prod.txt

# 复制应用代码
COPY cost_rag/ ./cost_rag/
COPY scripts/ ./scripts/

# 创建非root用户
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["gunicorn", "cost_rag.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Worker服务Dockerfile

```dockerfile
# Dockerfile.worker
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（包括文档处理工具）
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
COPY requirements-prod.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements-prod.txt

# 复制应用代码
COPY cost_rag/ ./cost_rag/
COPY scripts/ ./scripts/

# 创建非root用户
RUN useradd -m -u 1000 worker && chown -R worker:worker /app
USER worker

# 启动Celery Worker
CMD ["celery", "-A", "cost_rag.celery", "worker", "--loglevel=info", "--concurrency=4"]
```

### 开发环境Dockerfile

```dockerfile
# Dockerfile.dev
FROM python:3.11-slim

WORKDIR /app

# 安装开发工具
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    git \
    vim \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
COPY requirements-dev.txt .

# 安装Python依赖（包括开发依赖）
RUN pip install --no-cache-dir -r requirements-dev.txt

# 设置环境变量
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 默认命令
CMD ["uvicorn", "cost_rag.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

## 🌐 网络与存储

### 网络配置

```yaml
# docker-compose.networks.yml
version: '3.8'

networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.1.0/24

  backend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.2.0/24

  database:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.3.0/24
    internal: true

services:
  api:
    networks:
      - frontend
      - backend

  postgres:
    networks:
      - backend
      - database

  redis:
    networks:
      - backend
      - database
```

### 存储配置

```yaml
# docker-compose.volumes.yml
version: '3.8'

volumes:
  # 数据库数据
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/postgres

  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/redis

  # 向量数据库数据
  milvus_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/milvus

  # 对象存储数据
  minio_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/minio

  # 图数据库数据
  neo4j_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/neo4j

  # 日志存储
  logs:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/logs

  # 上传文件存储
  uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/cost-rag/uploads
```

## 🔧 环境配置

### 环境变量文件 (.env)

```bash
# 数据库配置
POSTGRES_PASSWORD=your_postgres_password
DATABASE_URL=postgresql://cost_rag:${POSTGRES_PASSWORD}@postgres:5432/cost_rag

# Redis配置
REDIS_URL=redis://redis:6379/0

# Milvus配置
MILVUS_HOST=milvus
MILVUS_PORT=19530

# Neo4j配置
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# MinIO配置
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET_NAME=cost-rag-documents

# RabbitMQ配置
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo

# 应用配置
DEBUG=false
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000", "https://yourdomain.com"]

# 文件上传配置
MAX_FILE_SIZE=100MB
ALLOWED_EXTENSIONS=pdf,docx,xlsx,ppt,jpg,png

# Celery配置
CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672/
CELERY_RESULT_BACKEND=redis://redis:6379/1

# 版本配置
VERSION=1.0.0
BUILD_DATE=2024-01-01
```

### 环境特定配置 (.env.dev)

```bash
# 开发环境配置
DEBUG=true
LOG_LEVEL=DEBUG
RELOAD=true

# 开发数据库
POSTGRES_PASSWORD=dev_password
DATABASE_URL=postgresql://cost_rag:dev_password@postgres:5432/cost_rag_dev

# 热重载配置
UVICORN_RELOAD=true
UVICORN_RELOAD_DIRS=/app

# 测试配置
TESTING=true
MOCK_EXTERNAL_APIS=true
```

### 生产环境配置 (.env.prod)

```bash
# 生产环境配置
DEBUG=false
LOG_LEVEL=WARNING
RELOAD=false

# 生产数据库
POSTGRES_PASSWORD=super_secure_password
DATABASE_URL=postgresql://cost_rag:${POSTGRES_PASSWORD}@postgres:5432/cost_rag_prod

# 性能配置
WORKERS=4
WORKER_CONNECTIONS=1000
KEEPALIVE=2

# 安全配置
CORS_ORIGINS=["https://yourdomain.com"]
ALLOWED_HOSTS=["api.yourdomain.com"]
```

## 🚀 部署流程

### 1. 环境准备

```bash
# 创建必要的目录结构
mkdir -p logs uploads data models config

# 设置权限
chmod 755 logs uploads data models config

# 创建环境变量文件
cp .env.example .env
# 编辑.env文件，填入实际配置
```

### 2. 构建镜像

```bash
# 开发环境
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

# 生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# 或者仅构建特定服务
docker-compose build api
docker-compose build worker
```

### 3. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 启动特定服务
docker-compose up -d postgres redis
docker-compose up -d api worker

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api
docker-compose logs -f worker
```

### 4. 数据库初始化

```bash
# 等待数据库服务就绪
docker-compose exec postgres pg_isready -U cost_rag

# 运行数据库迁移
docker-compose exec api alembic upgrade head

# 初始化数据
docker-compose exec api python scripts/init_data.py
```

### 5. 验证部署

```bash
# 检查API健康状态
curl http://localhost:8000/health

# 检查WebSocket连接
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8001/ws

# 测试API端点
curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "password"}'
```

### 6. 停止与清理

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 清理未使用的镜像
docker image prune -f

# 清理所有未使用的资源
docker system prune -a -f
```

## 📊 监控与日志

### 日志配置

```yaml
# docker-compose.logging.yml
version: '3.8'

x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    labels: "service,environment"

services:
  api:
    logging: *default-logging
    environment:
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - ./logs:/app/logs

  worker:
    logging: *default-logging
    environment:
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - ./logs:/app/logs

  postgres:
    logging: *default-logging
    environment:
      - POSTGRES_LOG_STATEMENT=all
    volumes:
      - ./logs/postgres:/var/log/postgresql

  nginx:
    logging: *default-logging
    volumes:
      - ./logs/nginx:/var/log/nginx
```

### 监控配置

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  # Prometheus监控
  prometheus:
    image: prom/prometheus:latest
    container_name: cost-rag-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  # Grafana可视化
  grafana:
    image: grafana/grafana:latest
    container_name: cost-rag-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    depends_on:
      - prometheus

  # Node Exporter
  node-exporter:
    image: prom/node-exporter:latest
    container_name: cost-rag-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

volumes:
  prometheus_data:
  grafana_data:
```

## 🔧 故障排查

### 常见问题诊断

```bash
# 1. 服务启动失败
docker-compose logs api
docker-compose ps

# 2. 数据库连接问题
docker-compose exec postgres pg_isready -U cost_rag
docker-compose exec api python -c "from cost_rag.database import engine; print(engine.execute('SELECT 1').scalar())"

# 3. 内存不足问题
docker stats
docker-compose exec api free -h

# 4. 磁盘空间问题
docker system df
docker-compose exec api df -h

# 5. 网络连接问题
docker-compose exec api ping postgres
docker-compose exec api nslookup postgres
```

### 性能调优

```yaml
# docker-compose.performance.yml
version: '3.8'

services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - WORKERS=4
      - WORKER_CONNECTIONS=1000
      - MAX_REQUESTS=1000
      - MAX_REQUESTS_JITTER=100
      - PRELOAD_APP=true

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - POSTGRES_SHARED_PRELOAD_LIBRARIES=pg_stat_statements
      - POSTGRES_MAX_CONNECTIONS=200
      - POSTGRES_SHARED_BUFFERS=1GB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=3GB
      - POSTGRES_WORK_MEM=16MB
      - POSTGRES_MAINTENANCE_WORK_MEM=256MB

  redis:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

### 备份与恢复

```bash
#!/bin/bash
# backup.sh

# 设置变量
BACKUP_DIR="/backup/cost-rag"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cost-rag-backup-${DATE}.tar.gz"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 备份数据库
docker-compose exec -T postgres pg_dump -U cost_rag cost_rag > ${BACKUP_DIR}/postgres_${DATE}.sql

# 备份Redis
docker-compose exec -T redis redis-cli --rdb - > ${BACKUP_DIR}/redis_${DATE}.rdb

# 备份Milvus
docker cp cost-rag-milvus:/var/lib/milvus ${BACKUP_DIR}/milvus_${DATE}

# 备份MinIO
docker cp cost-rag-minio:/data ${BACKUP_DIR}/minio_${DATE}

# 备份Neo4j
docker cp cost-rag-neo4j:/data ${BACKUP_DIR}/neo4j_${DATE}

# 打包备份文件
tar -czf ${BACKUP_DIR}/${BACKUP_FILE} -C ${BACKUP_DIR} \
    postgres_${DATE}.sql \
    redis_${DATE}.rdb \
    milvus_${DATE} \
    minio_${DATE} \
    neo4j_${DATE}

# 清理临时文件
rm -rf ${BACKUP_DIR}/postgres_${DATE}.sql
rm -rf ${BACKUP_DIR}/redis_${DATE}.rdb
rm -rf ${BACKUP_DIR}/milvus_${DATE}
rm -rf ${BACKUP_DIR}/minio_${DATE}
rm -rf ${BACKUP_DIR}/neo4j_${DATE}

echo "Backup completed: ${BACKUP_DIR}/${BACKUP_FILE}"
```

```bash
#!/bin/bash
# restore.sh

# 设置变量
BACKUP_FILE=$1
BACKUP_DIR="/backup/cost-rag"
RESTORE_DIR="/tmp/cost-rag-restore"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# 创建临时目录
mkdir -p ${RESTORE_DIR}

# 解压备份文件
tar -xzf ${BACKUP_DIR}/${BACKUP_FILE} -C ${RESTORE_DIR}

# 停止服务
docker-compose down

# 恢复数据库
docker-compose up -d postgres
docker-compose exec -T postgres psql -U cost_rag -c "DROP DATABASE IF EXISTS cost_rag;"
docker-compose exec -T postgres psql -U cost_rag -c "CREATE DATABASE cost_rag;"
docker-compose exec -T postgres psql -U cost_rag cost_rag < ${RESTORE_DIR}/postgres_*.sql

# 恢复Redis
docker-compose up -d redis
docker-compose exec -T redis redis-cli FLUSHALL
docker cp ${RESTORE_DIR}/redis_*.rdb cost-rag-redis:/data/dump.rdb
docker-compose restart redis

# 恢复Milvus
docker-compose up -d etcd minio milvus
docker cp ${RESTORE_DIR}/milvus_* cost-rag-milvus:/var/lib/milvus/
docker-compose restart milvus

# 恢复MinIO
docker-compose up -d minio
docker cp ${RESTORE_DIR}/minio_*/data/* cost-rag-minio:/data/

# 恢复Neo4j
docker-compose up -d neo4j
docker cp ${RESTORE_DIR}/neo4j_*/data/* cost-rag-neo4j:/data/

# 启动所有服务
docker-compose up -d

# 清理临时文件
rm -rf ${RESTORE_DIR}

echo "Restore completed from: ${BACKUP_DIR}/${BACKUP_FILE}"
```

## ⚡ 性能优化

### 构建优化

```dockerfile
# 多阶段构建Dockerfile
FROM python:3.11-slim as builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
COPY requirements-prod.txt .

# 安装依赖到临时目录
RUN pip install --user --no-cache-dir -r requirements-prod.txt

# 生产镜像
FROM python:3.11-slim

WORKDIR /app

# 只安装运行时依赖
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 从builder阶段复制Python包
COPY --from=builder /root/.local /root/.local

# 复制应用代码
COPY cost_rag/ ./cost_rag/
COPY scripts/ ./scripts/

# 设置PATH
ENV PATH=/root/.local/bin:$PATH

# 创建非root用户
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["gunicorn", "cost_rag.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### 缓存优化

```yaml
# docker-compose.cache.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      cache_from:
        - cost-rag/api:latest
      target: production
    image: cost-rag/api:${VERSION:-latest}

  # Redis缓存集群
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_master_data:/data

  redis-slave:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru --slaveof redis-master 6379
    depends_on:
      - redis-master
    volumes:
      - redis_slave_data:/data

  # 缓存代理
  redis-proxy:
    image: haproxy:2.8-alpine
    volumes:
      - ./haproxy/redis.cfg:/usr/local/etc/haproxy/haproxy.cfg
    ports:
      - "6380:6380"
    depends_on:
      - redis-master
      - redis-slave

volumes:
  redis_master_data:
  redis_slave_data:
```

### 资源限制优化

```yaml
# docker-compose.resources.yml
version: '3.8'

services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
          pids: 100
        reservations:
          cpus: '1.0'
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 60s
        max_failure_ratio: 0.3

  worker:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
          pids: 200
        reservations:
          cpus: '2.0'
          memory: 2G

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - POSTGRES_SHARED_BUFFERS=1GB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=3GB
      - POSTGRES_WORK_MEM=16MB
      - POSTGRES_MAINTENANCE_WORK_MEM=256MB
```

---

## 📞 技术支持

- **Docker文档**: [Docker官方文档](https://docs.docker.com/)
- **Docker Compose文档**: [Compose官方文档](https://docs.docker.com/compose/)
- **最佳实践**: [Docker最佳实践指南](https://docs.docker.com/develop/dev-best-practices/)
- **故障排查**: [Docker故障排查指南](https://docs.docker.com/config/troubleshooting/)
- **技术支持**: support@cost-rag.com