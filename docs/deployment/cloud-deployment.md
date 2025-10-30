# 云平台部署指南

## 📋 目录

- [云平台选择](#云平台选择)
- [AWS部署](#aws部署)
- [Azure部署](#azure部署)
- [Google Cloud部署](#google-cloud部署)
- [阿里云部署](#阿里云部署)
- [Kubernetes部署](#kubernetes部署)
- [CI/CD流水线](#cicd流水线)
- [监控与运维](#监控与运维)
- [成本优化](#成本优化)
- [安全配置](#安全配置)

## ☁️ 云平台选择

### 云平台对比

| 平台 | 优势 | 适用场景 | 推荐指数 |
|------|------|----------|----------|
| **AWS** | 服务最全、生态成熟、文档完善 | 企业级应用、全球部署 | ⭐⭐⭐⭐⭐ |
| **Azure** | 与Microsoft生态集成好、混合云 | 企业客户、Windows环境 | ⭐⭐⭐⭐ |
| **Google Cloud** | AI/ML能力强、容器技术领先 | AI应用、容器化部署 | ⭐⭐⭐⭐ |
| **阿里云** | 国内访问快、中文支持好 | 国内业务、中小企业 | ⭐⭐⭐⭐ |

### Cost-RAG推荐配置

基于系统特点和需求，推荐云平台配置如下：

- **推荐平台**: AWS (全球业务) / 阿里云 (国内业务)
- **地域选择**: 根据用户分布选择就近地域
- **实例类型**: 计算优化型 + 内存优化型组合
- **存储方案**: SSD + 对象存储混合架构

## 🅰️ AWS部署

### 1. 基础设施规划

#### VPC网络架构

```yaml
# VPC配置
VPC:
  CIDR: 10.0.0.0/16
  Subnets:
    Public:
      - Public-1A: 10.0.1.0/24 (us-east-1a)
      - Public-1B: 10.0.2.0/24 (us-east-1b)
    Private:
      - Private-1A: 10.0.11.0/24 (us-east-1a)
      - Private-1B: 10.0.12.0/24 (us-east-1b)
    Database:
      - DB-1A: 10.0.21.0/24 (us-east-1a)
      - DB-1B: 10.0.22.0/24 (us-east-1b)

# 路由配置
Routes:
  Public: IGW (Internet Gateway)
  Private: NAT Gateway
  Database: Isolated
```

#### EC2实例配置

```yaml
# Auto Scaling Group配置
AutoScalingGroups:
  API-Servers:
    InstanceType: c5.2xlarge (8 vCPU, 16GB RAM)
    MinSize: 2
    MaxSize: 10
    DesiredCapacity: 3
    TargetTracking:
      Metric: CPUUtilization
      TargetValue: 70
      ScaleOutCooldown: 300
      ScaleInCooldown: 300

  Worker-Servers:
    InstanceType: c5.4xlarge (16 vCPU, 32GB RAM)
    MinSize: 2
    MaxSize: 20
    DesiredCapacity: 5
    TargetTracking:
      Metric: ApproximateNumberOfMessagesVisible
      TargetValue: 10

  Database-Servers:
    InstanceType: r5.2xlarge (8 vCPU, 64GB RAM)
    MinSize: 1
    MaxSize: 3
    DesiredCapacity: 2
    MultiAZ: true
```

### 2. RDS数据库配置

```yaml
# RDS PostgreSQL配置
RDS:
  Engine: PostgreSQL 15.4
  InstanceClass: db.r5.2xlarge
  MultiAZ: true
  Storage:
    Type: gp3 (General Purpose SSD)
    Size: 1000GB
    ProvisionedIOPS: 3000
    StorageThroughput: 125
  Backup:
    RetentionPeriod: 7 days
    BackupWindow: "03:00-04:00"
    MaintenanceWindow: "sun:04:00-sun:05:00"
  Security:
    EncryptionAtRest: true
    EncryptionInTransit: true
  Monitoring:
    EnhancedMonitoring: 60 seconds
    PerformanceInsights: true
    CloudWatchLogsExport:
      - postgresql
      - upgrade

# 参数组配置
ParameterGroup:
  Parameters:
    max_connections: 200
    shared_buffers: 2GB
    effective_cache_size: 6GB
    work_mem: 16MB
    maintenance_work_mem: 256MB
    checkpoint_completion_target: 0.9
    wal_buffers: 16MB
    default_statistics_target: 100
```

### 3. ElastiCache配置

```yaml
# Redis集群配置
ElastiCache:
  Engine: Redis 7.0
  NodeType: cache.r6g.2xlarge
  NumCacheClusters: 3
  ReplicationGroup:
    AutomaticFailover: true
    MultiAZ: true
    NumNodeGroups: 1
    ReplicasPerNodeGroup: 2
    PrimaryAvailabilityZone: us-east-1a
    ReplicaAvailabilityZones:
      - us-east-1b
      - us-east-1c
  Configuration:
    MaxMemoryPolicy: allkeys-lru
    ReservedMemory: 25
    ClusterMode: false
    TransitEncryption: true
    AtRestEncryption: true
  Maintenance:
    Window: "sun:05:00-sun:06:00"
    SnapshotWindow: "06:00-07:00"
    SnapshotRetentionLimit: 7
```

### 4. EKS Kubernetes部署

#### EKS集群配置

```yaml
# EKS集群配置
EKSCluster:
  Name: cost-rag-cluster
  Version: "1.28"
  RoleArn: arn:aws:iam::ACCOUNT:role/EKSClusterRole
  ResourcesVpcConfig:
    SubnetIds:
      - subnet-public-1a
      - subnet-private-1a
      - subnet-public-1b
      - subnet-private-1b
    EndpointPrivateAccess: true
    EndpointPublicAccess: false
  Logging:
    ClusterLogging:
      Enabled:
        - api
        - audit
        - authenticator
        - controllerManager
        - scheduler

# 节点组配置
NodeGroups:
  System:
    InstanceType: m5.large
    DesiredSize: 2
    MinSize: 1
    MaxSize: 3
    Labels:
      Role: system
    Taints:
      - Key: dedicated
        Value: system
        Effect: NoSchedule

  Application:
    InstanceType: c5.2xlarge
    DesiredSize: 3
    MinSize: 2
    MaxSize: 10
    Labels:
      Role: application
    SpotPrice: "0.5"

  Worker:
    InstanceType: c5.4xlarge
    DesiredSize: 5
    MinSize: 2
    MaxSize: 20
    Labels:
      Role: worker
    SpotPrice: "0.4"
```

#### Kubernetes部署清单

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: cost-rag
  labels:
    name: cost-rag
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cost-rag-config
  namespace: cost-rag
data:
  DATABASE_HOST: "cost-rag-postgres.cost-rag.svc.cluster.local"
  REDIS_HOST: "cost-rag-redis.cost-rag.svc.cluster.local"
  MILVUS_HOST: "cost-rag-milvus.cost-rag.svc.cluster.local"
  NEO4J_URI: "bolt://cost-rag-neo4j.cost-rag.svc.cluster.local:7687"
  LOG_LEVEL: "INFO"
  ENVIRONMENT: "production"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cost-rag-secrets
  namespace: cost-rag
type: Opaque
data:
  DATABASE_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-jwt-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cost-rag-api
  namespace: cost-rag
  labels:
    app: cost-rag-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cost-rag-api
  template:
    metadata:
      labels:
        app: cost-rag-api
    spec:
      containers:
      - name: api
        image: cost-rag/api:1.0.0
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgresql://cost_rag:$(DATABASE_PASSWORD)@$(DATABASE_HOST):5432/cost_rag"
        - name: REDIS_URL
          value: "redis://$(REDIS_HOST):6379/0"
        envFrom:
        - configMapRef:
            name: cost-rag-config
        - secretRef:
            name: cost-rag-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cost-rag-api
  namespace: cost-rag
spec:
  selector:
    app: cost-rag-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP
---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cost-rag-ingress
  namespace: cost-rag
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.cost-rag.com
    secretName: cost-rag-tls
  rules:
  - host: api.cost-rag.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cost-rag-api
            port:
              number: 80
```

### 5. CloudWatch监控配置

```yaml
# CloudWatch Logs配置
CloudWatchLogs:
  LogGroups:
    - Name: /aws/ec2/cost-rag-api
      RetentionInDays: 30
    - Name: /aws/ec2/cost-rag-worker
      RetentionInDays: 30
    - Name: /aws/rds/postgresql/cost-rag
      RetentionInDays: 30

# CloudWatch Metrics配置
CloudWatchMetrics:
  CustomMetrics:
    - Namespace: CostRAG/API
      Metrics:
        - Name: RequestCount
          Unit: Count
          Value: request_count
        - Name: ResponseTime
          Unit: Milliseconds
          Value: response_time
        - Name: ErrorRate
          Unit: Percent
          Value: error_rate
        - Name: ActiveUsers
          Unit: Count
          Value: active_users

# CloudWatch Alarms配置
CloudWatchAlarms:
  - Name: cost-rag-api-high-cpu
    MetricName: CPUUtilization
    Namespace: AWS/EC2
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - arn:aws:sns:us-east-1:ACCOUNT:cost-rag-alerts

  - Name: cost-rag-database-connections
    MetricName: DatabaseConnections
    Namespace: AWS/RDS
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 150
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - arn:aws:sns:us-east-1:ACCOUNT:cost-rag-alerts
```

## 🔷 Azure部署

### 1. 资源组规划

```yaml
# Azure Resource Group
ResourceGroup:
  Name: rg-cost-rag-prod
  Location: eastus
  Tags:
    Environment: production
    Project: cost-rag
    Department: engineering

# 网络资源
VirtualNetwork:
  Name: vnet-cost-rag
  AddressSpace: 10.0.0.0/16
  Subnets:
    - Name: snet-app
      AddressPrefix: 10.0.1.0/24
      Purpose: Application servers
    - Name: snet-data
      AddressPrefix: 10.0.2.0/24
      Purpose: Database servers
    - Name: snet-cache
      AddressPrefix: 10.0.3.0/24
      Purpose: Cache servers
```

### 2. AKS集群配置

```yaml
# AKS集群
AKSCluster:
  Name: aks-cost-rag
  Location: eastus
  ResourceGroup: rg-cost-rag-prod
  DNSPrefix: cost-rag-aks
  KubernetesVersion: "1.28.0"
  NetworkProfile:
    NetworkPlugin: azure
    NetworkPolicy: calico
    ServiceCidr: 10.1.0.0/16
    DnsServiceIP: 10.1.0.10
    DockerBridgeCidr: 172.17.0.1/16
  AgentPoolProfiles:
    - Name: apppool
      Count: 3
      VmSize: Standard_D4s_v3
      OsType: Linux
      Mode: System
      AvailabilityZones:
        - 1
        - 2
        - 3
    - Name: workerpool
      Count: 5
      VmSize: Standard_D8s_v3
      OsType: Linux
      Mode: User
      AvailabilityZones:
        - 1
        - 2
        - 3
  AddonProfiles:
    OmsAgent:
      Enabled: true
      LogAnalyticsWorkspaceResourceId: /subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-cost-rag-prod/providers/Microsoft.OperationalInsights/workspaces/law-cost-rag
    HttpApplicationRouting:
      Enabled: true
```

### 3. Azure Database配置

```yaml
# Azure Database for PostgreSQL
PostgreSQL:
  Name: pg-cost-rag
  Location: eastus
  ResourceGroup: rg-cost-rag-prod
  Version: "15"
  Tier: GeneralPurpose
  VCore: 8
  StorageSizeGB: 1024
  BackupRetentionDays: 7
  GeoRedundantBackup: Enabled
  HighAvailability: ZoneRedundant
  StorageAutoGrow: Enabled
  AdministratorLogin: cost_rag_admin
  Tags:
    Environment: production
    Application: cost-rag

# Azure Cache for Redis
Redis:
  Name: redis-cost-rag
  Location: eastus
  ResourceGroup: rg-cost-rag-prod
  Sku:
    Name: Premium
    Family: P
    Capacity: 2
  EnableNonSslPort: false
  RedisConfiguration:
    maxmemory-policy: allkeys-lru
    rdb-backup-enabled: "true"
    rdb-backup-frequency: "60"
    rdb-backup-max-snapshot-count: "1"
    rdb-storage-connection-string: <storage-connection-string>
  StaticIP: 10.0.3.10
  SubnetId: /subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-cost-rag-prod/providers/Microsoft.Network/virtualNetworks/vnet-cost-rag/subnets/snet-cache
```

### 4. Azure Monitor配置

```yaml
# Log Analytics Workspace
LogAnalytics:
  Name: law-cost-rag
  Location: eastus
  ResourceGroup: rg-cost-rag-prod
  Sku: PerGB2018
  RetentionInDays: 30

# Application Insights
ApplicationInsights:
  Name: ai-cost-rag
  Location: eastus
  ResourceGroup: rg-cost-rag-prod
  ApplicationType: web
  WorkspaceResourceId: /subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-cost-rag-prod/providers/Microsoft.OperationalInsights/workspaces/law-cost-rag

# Monitor Alerts
Alerts:
  - Name: High CPU Usage
    Description: CPU usage is above 80%
    Severity: 2
    Enabled: true
    Condition:
      AllOf:
        - Field: Percentage CPU
          Operator: GreaterThan
          Value: 80
    EvaluationFrequency: PT1M
    WindowSize: PT5M
    AutoMitigate: true
    Actions:
      - ActionGroupId: /subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-cost-rag-prod/providers/microsoft.insights/actionGroups/ag-cost-rag-alerts
```

## 🌐 Google Cloud部署

### 1. 项目和网络配置

```yaml
# GCP Project
Project:
  ID: cost-rag-prod
  Name: Cost-RAG Production
  Organization: <ORGANIZATION_ID>

# VPC网络
VPCNetwork:
  Name: cost-rag-vpc
  AutoCreateSubnetworks: false
  RoutingMode: REGIONAL

  Subnetworks:
    - Name: cost-rag-subnet-1
      Region: us-central1
      IPRange: 10.0.1.0/24
      SecondaryRanges:
        - Name: pods
          IPRange: 10.1.0.0/16
        - Name: services
          IPRange: 10.2.0.0/16
    - Name: cost-rag-subnet-2
      Region: us-central1
      IPRange: 10.0.2.0/24

# 防火墙规则
FirewallRules:
  - Name: allow-internal
    Direction: INGRESS
    Priority: 1000
    SourceRanges:
      - 10.0.0.0/16
    Allowed:
      - IPProtocol: TCP
        Ports:
          - "22"
          - "80"
          - "443"
          - "8000"
          - "5432"
          - "6379"
          - "19530"
```

### 2. GKE集群配置

```yaml
# GKE集群
GKECluster:
  Name: cost-rag-gke
  Location: us-central1
  InitialNodeCount: 1
  Network: cost-rag-vpc
  Subnetwork: cost-rag-subnet-1

  NodePools:
    - Name: default-pool
      Config:
        MachineType: n2-standard-4
        DiskSizeGb: 100
        DiskType: pd-ssd
        ImageType: COS_CONTAINERD
        OauthScopes:
          - "https://www.googleapis.com/auth/devstorage.read_only"
          - "https://www.googleapis.com/auth/logging.write"
          - "https://www.googleapis.com/auth/monitoring"
          - "https://www.googleapis.com/auth/servicecontrol"
          - "https://www.googleapis.com/auth/service.management.readonly"
          - "https://www.googleapis.com/auth/trace.append"
      InitialNodeCount: 3
      Autoscaling:
        Enabled: true
        MinNodeCount: 1
        MaxNodeCount: 10
      Management:
        AutoRepair: true
        AutoUpgrade: true

    - Name: worker-pool
      Config:
        MachineType: n2-standard-8
        DiskSizeGb: 200
        DiskType: pd-ssd
        Preemptible: true
      InitialNodeCount: 5
      Autoscaling:
        Enabled: true
        MinNodeCount: 2
        MaxNodeCount: 20

  Addons:
    HttpLoadBalancing: enabled
    HorizontalPodAutoscaling: enabled
    NetworkPolicyConfig: enabled
    GcePersistentDiskCsiDriver: enabled

  MasterAuthorizedNetworksConfig:
    Enabled: true
    CidrBlocks:
      - CidrBlock: 203.0.113.0/24
        DisplayName: Office Network

  PrivateClusterConfig:
    EnablePrivateNodes: true
    EnablePrivateEndpoint: true
    MasterIpv4CidrBlock: 172.16.0.0/28
```

### 3. Cloud SQL配置

```yaml
# Cloud SQL PostgreSQL
CloudSQL:
  Name: cost-rag-db
  DatabaseVersion: POSTGRES_15
  Region: us-central1

  Settings:
    Tier: db-n2-standard-8
    DiskSize: 1000
    DiskType: PD_SSD
    DataDiskSizeGb: 1000
    DataDiskType: PD_SSD

    AvailabilityType: REGIONAL
    BackupConfiguration:
      Enabled: true
      StartTime: "03:00"
      Location: us-central1
      PointInTimeRecoveryEnabled: true
      TransactionLogRetentionDays: 7

    DatabaseFlags:
      - Name: max_connections
        Value: "200"
      - Name: shared_buffers
        Value: "2GB"
      - Name: effective_cache_size
        Value: "6GB"

    IpConfiguration:
      Ipv4Enabled: false
      PrivateNetwork: cost-rag-vpc
      RequireSsl: true

    LocationPreference:
      Zone: us-central1-a
      SecondaryZone: us-central1-b
```

### 4. Memorystore配置

```yaml
# Memorystore for Redis
Memorystore:
  Name: cost-rag-redis
  Region: us-central1
  Tier: STANDARD_HA
  MemorySizeGb: 16
  AuthorizedNetwork: cost-rag-vpc
  RedisVersion: REDIS_7_0
  DisplayName: Cost-RAG Redis Cluster

  MaintenancePolicy:
    WeeklyMaintenanceWindow:
      Day: SUNDAY
      StartTime:
        Hours: 2
        Minutes: 0

  PersistenceConfig:
    PersistenceMode: RDB
    RdbConfig:
      RdbSnapshotPeriod: SIX_HOURS
      RdbSnapshotStartTime: "03:00"
```

## 🇨🇳 阿里云部署

### 1. 基础架构配置

```yaml
# VPC网络配置
VPC:
  Region: cn-hangzhou
  CidrBlock: 172.16.0.0/16
  VpcName: vpc-cost-rag

  VSwitches:
    - ZoneId: cn-hangzhou-h
      CidrBlock: 172.16.1.0/24
      VSwitchName: vswitch-cost-rag-h
    - ZoneId: cn-hangzhou-i
      CidrBlock: 172.16.2.0/24
      VSwitchName: vswitch-cost-rag-i

# 安全组配置
SecurityGroup:
  GroupName: sg-cost-rag
  Description: Security group for Cost-RAG application

  Rules:
    - PortRange: 22/22
      Protocol: tcp
      SourceGroup: sg-bastion
      Policy: accept
      Description: SSH from bastion host

    - PortRange: 80/80
      Protocol: tcp
      SourceCidrIp: 0.0.0.0/0
      Policy: accept
      Description: HTTP access

    - PortRange: 443/443
      Protocol: tcp
      SourceCidrIp: 0.0.0.0/0
      Policy: accept
      Description: HTTPS access
```

### 2. ACK集群配置

```yaml
# ACK集群
ACKCluster:
  Name: cost-rag-cluster
  ClusterType: ManagedKubernetes
  Region: cn-hangzhou
  ZoneId:
    - cn-hangzhou-h
    - cn-hangzhou-i

  ContainerCidr: 10.244.0.0/16
  ServiceCidr: 10.96.0.0/12

  Worker configurations:
    - WorkerInstanceType: ecs.c6.2xlarge
      WorkerSystemDiskCategory: cloud_essd
      WorkerSystemDiskSize: 120
      WorkerCount: 3

  KubernetesVersion: "1.28.3-aliyun.1"

  Addons:
    - Name: flannel
      Config: ""
    - Name: csi-plugin
      Config: ""
    - Name: csi-provisioner
      Config: ""
    - Name: nginx-ingress-controller
      Config: "IngressSlbNetworkType=internet"
    - Name: autoscaler
      Config: ""
```

### 3. RDS数据库配置

```yaml
# ApsaraDB for RDS PostgreSQL
RDS:
  Engine: PostgreSQL
  EngineVersion: 15.0
  DBInstanceClass: pg.n2.2xlarge.1
  DBInstanceStorage: 1000
  DBInstanceStorageType: cloud_essd
  ZoneId: cn-hangzhou-h
  ZoneIdSlave1: cn-hangzhou-i

  SecurityIPList: 172.16.0.0/16

  BackupPolicy:
    PreferredBackupPeriod: Monday,Wednesday,Friday,Sunday
    PreferredBackupTime: 02:00Z-03:00Z
    BackupRetentionPeriod: 7

  HighAvailabilitySettings:
    HighAvailabilityMode: RPO

  Tags:
    - Key: Environment
      Value: production
    - Key: Application
      Value: cost-rag
```

### 4. Redis缓存配置

```yaml
# ApsaraDB for Redis
Redis:
  InstanceClass: redis.amber.master.large
  EngineVersion: 7.0
  Capacity: 16384
  ZoneId: cn-hangzhou-h

  ArchitectureType: standard
  NodeType: master_slave

  EvictionPolicy: allkeys_lru
  MaxMemoryPolicy: allkeys_lru

  BackupPolicy:
    PreferredBackupPeriod: Monday,Wednesday,Friday
    PreferredBackupTime: 03:00Z-04:00Z
    EnableBackupLog: true

  Tags:
    - Key: Environment
      Value: production
    - Key: Application
      Value: cost-rag
```

## ☸️ Kubernetes部署

### 1. Helm Charts配置

```yaml
# Chart.yaml (cost-rag)
apiVersion: v2
name: cost-rag
description: Cost-RAG Application Helm Chart
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: 12.5.9
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.11.6
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

```yaml
# values.yaml
global:
  imageRegistry: "your-registry.com"
  imagePullSecrets:
    - name: registry-secret

api:
  replicaCount: 3
  image:
    repository: cost-rag/api
    tag: "1.0.0"
    pullPolicy: IfNotPresent

  service:
    type: ClusterIP
    port: 80
    targetPort: 8000

  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/rate-limit: "100"
    hosts:
      - host: api.cost-rag.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: cost-rag-tls
        hosts:
          - api.cost-rag.com

  resources:
    limits:
      cpu: 1000m
      memory: 2Gi
    requests:
      cpu: 500m
      memory: 1Gi

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

worker:
  replicaCount: 5
  image:
    repository: cost-rag/worker
    tag: "1.0.0"
    pullPolicy: IfNotPresent

  resources:
    limits:
      cpu: 2000m
      memory: 4Gi
    requests:
      cpu: 1000m
      memory: 2Gi

  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70

postgresql:
  enabled: true
  auth:
    postgresPassword: "secure-password"
    database: "cost_rag"
  primary:
    persistence:
      enabled: true
      size: 1000Gi
      storageClass: "fast-ssd"
    resources:
      limits:
        cpu: 2000m
        memory: 4Gi
      requests:
        cpu: 1000m
        memory: 2Gi

redis:
  enabled: true
  auth:
    enabled: true
    password: "redis-password"
  master:
    persistence:
      enabled: true
      size: 100Gi
      storageClass: "fast-ssd"
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 100Gi
      storageClass: "fast-ssd"
```

### 2. 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

# 配置变量
NAMESPACE="cost-rag"
RELEASE_NAME="cost-rag"
CHART_PATH="./helm/cost-rag"
VALUES_FILE="./helm/values-${ENVIRONMENT}.yaml"

# 创建命名空间
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# 添加Helm仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 部署应用
echo "Deploying Cost-RAG application..."
helm upgrade --install ${RELEASE_NAME} ${CHART_PATH} \
  --namespace ${NAMESPACE} \
  --values ${VALUES_FILE} \
  --wait \
  --timeout 10m

# 验证部署
echo "Verifying deployment..."
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}
kubectl get ingress -n ${NAMESPACE}

# 运行健康检查
echo "Running health checks..."
./scripts/health-check.sh

echo "Deployment completed successfully!"
```

### 3. 监控配置

```yaml
# monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - "cost-rag-rules.yml"

    scrape_configs:
      - job_name: 'cost-rag-api'
        kubernetes_sd_configs:
        - role: pod
          namespaces:
            names:
            - cost-rag
        relabel_configs:
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
          action: keep
          regex: true
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
          action: replace
          target_label: __metrics_path__
          regex: (.+)
        - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
          action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          target_label: __address__

      - job_name: 'cost-rag-worker'
        kubernetes_sd_configs:
        - role: pod
          namespaces:
            names:
            - cost-rag
        relabel_configs:
        - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
          action: keep
          regex: cost-rag-worker

  cost-rag-rules.yml: |
    groups:
    - name: cost-rag.rules
      rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"
```

## 🔄 CI/CD流水线

### 1. GitHub Actions配置

```yaml
# .github/workflows/deploy.yml
name: Deploy Cost-RAG

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt

    - name: Run tests
      run: |
        pytest tests/ --cov=cost_rag --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push API image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.api
        push: true
        tags: ${{ steps.meta.outputs.tags }}-api
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Build and push Worker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.worker
        push: true
        tags: ${{ steps.meta.outputs.tags }}-worker
        labels: ${{ steps.meta.outputs.labels }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name cost-rag-staging

    - name: Deploy to staging
      run: |
        helm upgrade --install cost-rag-staging ./helm/cost-rag \
          --namespace staging \
          --create-namespace \
          --set api.image.tag=${{ needs.build.outputs.image-tag }}-api \
          --set worker.image.tag=${{ needs.build.outputs.image-tag }}-worker \
          --set environment=staging \
          --values ./helm/values-staging.yaml \
          --wait

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name cost-rag-production

    - name: Deploy to production
      run: |
        helm upgrade --install cost-rag-production ./helm/cost-rag \
          --namespace production \
          --create-namespace \
          --set api.image.tag=${{ needs.build.outputs.image-tag }}-api \
          --set worker.image.tag=${{ needs.build.outputs.image-tag }}-worker \
          --set environment=production \
          --values ./helm/values-production.yaml \
          --wait

    - name: Run smoke tests
      run: |
        ./scripts/smoke-tests.sh
```

### 2. GitLab CI配置

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  DOCKER_REGISTRY: registry.gitlab.com
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

test:
  stage: test
  image: python:3.11
  services:
    - postgres:15
    - redis:7
  variables:
    POSTGRES_DB: test_cost_rag
    POSTGRES_USER: test_user
    POSTGRES_PASSWORD: test_password
    DATABASE_URL: postgresql://test_user:test_password@postgres:5432/test_cost_rag
    REDIS_URL: redis://redis:6379/0
  before_script:
    - python -m pip install --upgrade pip
    - pip install -r requirements.txt
    - pip install -r requirements-dev.txt
  script:
    - pytest tests/ --cov=cost_rag --cov-report=xml
  coverage: '/TOTAL.+?(\d+\%)$/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml

build:
  stage: build
  image: docker:24.0.5
  services:
    - docker:24.0.5-dind
  before_script:
    - echo $CI_REGISTRY_PASSWORD | docker login -u $CI_REGISTRY_USER --password-stdin $CI_REGISTRY
  script:
    - docker build -f Dockerfile.api -t $CI_REGISTRY_IMAGE/api:$CI_COMMIT_SHA .
    - docker build -f Dockerfile.worker -t $CI_REGISTRY_IMAGE/worker:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE/api:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE/worker:$CI_COMMIT_SHA
    - docker tag $CI_REGISTRY_IMAGE/api:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE/api:latest
    - docker tag $CI_REGISTRY_IMAGE/worker:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE/worker:latest
    - docker push $CI_REGISTRY_IMAGE/api:latest
    - docker push $CI_REGISTRY_IMAGE/worker:latest
  only:
    - main
    - develop

deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context $KUBE_CONTEXT_STAGING
    - helm upgrade --install cost-rag-staging ./helm/cost-rag \
        --namespace staging \
        --create-namespace \
        --set api.image.tag=$CI_COMMIT_SHA \
        --set worker.image.tag=$CI_COMMIT_SHA \
        --set environment=staging \
        --values ./helm/values-staging.yaml
  environment:
    name: staging
    url: https://staging-api.cost-rag.com
  only:
    - develop

deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context $KUBE_CONTEXT_PRODUCTION
    - helm upgrade --install cost-rag-production ./helm/cost-rag \
        --namespace production \
        --create-namespace \
        --set api.image.tag=$CI_COMMIT_SHA \
        --set worker.image.tag=$CI_COMMIT_SHA \
        --set environment=production \
        --values ./helm/values-production.yaml
  environment:
    name: production
    url: https://api.cost-rag.com
  when: manual
  only:
    - main
```

## 📊 监控与运维

### 1. Prometheus监控配置

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093

    rule_files:
      - "/etc/prometheus/rules/*.yml"

    scrape_configs:
      - job_name: 'kubernetes-apiservers'
        kubernetes_sd_configs:
        - role: endpoints
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
        - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
          action: keep
          regex: default;kubernetes;https

      - job_name: 'kubernetes-nodes'
        kubernetes_sd_configs:
        - role: node
        relabel_configs:
        - action: labelmap
          regex: __meta_kubernetes_node_label_(.+)
        - target_label: __address__
          replacement: kubernetes.default.svc:443
        - source_labels: [__meta_kubernetes_node_name]
          regex: (.+)
          target_label: __metrics_path__
          replacement: /api/v1/nodes/${1}/proxy/metrics

      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
        - role: pod
        relabel_configs:
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
          action: keep
          regex: true
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
          action: replace
          target_label: __metrics_path__
          regex: (.+)
        - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
          action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_pod_label_(.+)
        - source_labels: [__meta_kubernetes_namespace]
          action: replace
          target_label: kubernetes_namespace
        - source_labels: [__meta_kubernetes_pod_name]
          action: replace
          target_label: kubernetes_pod_name
```

### 2. Grafana仪表板配置

```json
{
  "dashboard": {
    "id": null,
    "title": "Cost-RAG Application Dashboard",
    "tags": ["cost-rag", "application"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "id": 2,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Seconds"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "yAxes": [
          {
            "label": "Percentage",
            "max": 1,
            "min": 0
          }
        ]
      },
      {
        "id": 4,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ],
        "yAxes": [
          {
            "label": "Connections"
          }
        ]
      },
      {
        "id": 5,
        "title": "Cache Hit Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)",
            "legendFormat": "Hit Rate"
          }
        ],
        "yAxes": [
          {
            "label": "Hit Rate",
            "max": 1,
            "min": 0
          }
        ]
      },
      {
        "id": 6,
        "title": "Worker Queue Length",
        "type": "graph",
        "targets": [
          {
            "expr": "celery_queue_length",
            "legendFormat": "{{queue}}"
          }
        ],
        "yAxes": [
          {
            "label": "Tasks"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

## 💰 成本优化

### 1. 资源优化策略

```yaml
# 成本优化配置
CostOptimization:
  Compute:
    # 使用Spot实例节省成本
    SpotInstances:
      Enabled: true
      Percentage: 40
      InstanceTypes:
        - c5.large
        - c5.xlarge
        - c5.2xlarge

    # 自动扩缩容
    AutoScaling:
      MinInstances: 2
      MaxInstances: 20
      ScaleInCooldown: 300
      ScaleOutCooldown: 60

    # 实例类型优化
    RightSizing:
      MonitorCPU: true
      MonitorMemory: true
      DownsizeThreshold: 50
      UpsizeThreshold: 80

  Storage:
    # 混合存储策略
    StorageTiers:
      Hot: SSD (经常访问的数据)
      Warm: HDD (偶尔访问的数据)
      Cold: S3 Glacier (备份数据)

    # 自动生命周期管理
    LifecyclePolicy:
      Transition:
        - Days: 30
          StorageClass: STANDARD_IA
        - Days: 90
          StorageClass: GLACIER
        - Days: 365
          StorageClass: DEEP_ARCHIVE
      Expiration:
        Days: 2555

  Database:
    # 读写分离
    ReadReplicas:
      Enabled: true
      Count: 2
      InstanceClass: db.r5.large

    # 自动暂停开发环境
    DevEnvironment:
      AutoPause: true
      PauseAfter: 1 hour

    # 备份优化
    BackupStrategy:
      Retention: 7 days
      BackupWindow: "03:00-04:00"
      CrossRegionBackup: false

  Network:
    # 数据传输优化
    DataTransfer:
      UseCDN: true
      CompressResponses: true
      CacheHeaders: true

    # VPC优化
    VPC:
      UseNATGateway: false
      UseVPCEndpoints: true
      OptimizeSubnetUsage: true
```

### 2. 成本监控告警

```yaml
# 成本监控配置
CostMonitoring:
  Budgets:
    - Name: MonthlyBudget
      BudgetType: COST
      TimeUnit: MONTHLY
      BudgetAmount: 10000
      CostFilters:
        Service:
          - Amazon EC2
          - Amazon RDS
          - Amazon ElastiCache

    - Name: DevelopmentBudget
      BudgetType: COST
      TimeUnit: MONTHLY
      BudgetAmount: 2000
      CostFilters:
        Tag:
          Environment: development

  Alerts:
    - Name: HighSpendAlert
      Threshold: 80
      ThresholdType: PERCENTAGE_OF_BUDGET
      NotificationType: ACTUAL

    - Name: ForecastedSpendAlert
      Threshold: 90
      ThresholdType: PERCENTAGE_OF_BUDGET
      NotificationType: FORECASTED

  CostAllocationTags:
    - Environment
    - Application
    - Team
    - Project
    - Owner

# 成本优化脚本
#!/bin/bash
# cost-optimization.sh

# 检查未使用的资源
echo "Checking for unused resources..."

# 检查未使用的EBS卷
unused_volumes=$(aws ec2 describe-volumes --filters Name=status,Values=available --query 'Volumes[*].VolumeId' --output text)
if [ ! -z "$unused_volumes" ]; then
    echo "Found unused EBS volumes: $unused_volumes"
    # 可以添加删除逻辑
fi

# 检查未使用的EIP
unused_eips=$(aws ec2 describe-addresses --filters Name=association-id,Values=none --query 'Addresses[*].AllocationId' --output text)
if [ ! -z "$unused_eips" ]; then
    echo "Found unused EIPs: $unused_eips"
    # 可以添加释放逻辑
fi

# 检查过期的快照
old_snapshots=$(aws ec2 describe-snapshots --owner-ids self --filters Name=tag:AutoSnapshot,Values=true --query 'Snapshots[?StartTime<`$(date -d '30 days ago' --iso-8601)`].SnapshotId' --output text)
if [ ! -z "$old_snapshots" ]; then
    echo "Found old snapshots: $old_snapshots"
    # 可以添加清理逻辑
fi

echo "Cost optimization check completed."
```

## 🛡️ 安全配置

### 1. 网络安全

```yaml
# 安全组配置
SecurityGroups:
  ALBSecurityGroup:
    Description: Security group for Application Load Balancer
    Inbound:
      - Port: 80
        Protocol: TCP
        Source: 0.0.0.0/0
      - Port: 443
        Protocol: TCP
        Source: 0.0.0.0/0
    Outbound:
      - Port: 80
        Protocol: TCP
        Destination: 10.0.0.0/16
      - Port: 443
        Protocol: TCP
        Destination: 10.0.0.0/16

  APISecurityGroup:
    Description: Security group for API servers
    Inbound:
      - Port: 8000
        Protocol: TCP
        Source: !Ref ALBSecurityGroup
    Outbound:
      - Port: 5432
        Protocol: TCP
        Destination: !Ref DatabaseSecurityGroup
      - Port: 6379
        Protocol: TCP
        Destination: !Ref CacheSecurityGroup

  DatabaseSecurityGroup:
    Description: Security group for RDS database
    Inbound:
      - Port: 5432
        Protocol: TCP
        Source: !Ref APISecurityGroup
    Outbound: []

# WAF配置
WAF:
  WebACL:
    Name: cost-rag-waf
    Scope: REGIONAL
    DefaultAction:
      Allow: {}
    Rules:
      - Name: RateLimitRule
        Priority: 1
        Statement:
          RateBasedStatement:
            Limit: 2000
            AggregateKeyType: IP
        Action:
          Block: {}
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: RateLimitRule

      - Name: SQLInjectionRule
        Priority: 2
        Statement:
          SqliMatchStatement:
            FieldToMatch:
              Body: {}
            TextTransformations:
              - Priority: 0
                Type: URL_DECODE
        Action:
          Block: {}
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: SQLInjectionRule
```

### 2. 身份认证和授权

```yaml
# IAM角色和策略
IAM:
  Roles:
    EKSClusterRole:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: eks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

    NodeInstanceRole:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

    CostRAGServiceRole:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: CostRAGServicePolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                  - s3:DeleteObject
                Resource: arn:aws:s3:::cost-rag-documents/*
              - Effect: Allow
                Action:
                  - sqs:SendMessage
                  - sqs:ReceiveMessage
                  - sqs:DeleteMessage
                Resource: arn:aws:sqs:us-east-1:ACCOUNT:cost-rag-queue
              - Effect: Allow
                Action:
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: arn:aws:logs:*:*:*

# RBAC配置
RBAC:
  ServiceAccounts:
    - Name: cost-rag-api
      Namespace: cost-rag
      Annotations:
        eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/CostRAGServiceRole

  ClusterRoles:
    - Name: cost-rag-operator
      Rules:
        - apiGroups: [""]
          resources: ["pods", "services", "endpoints"]
          verbs: ["get", "list", "watch"]
        - apiGroups: ["apps"]
          resources: ["deployments", "replicasets"]
          verbs: ["get", "list", "watch"]

  ClusterRoleBindings:
    - Name: cost-rag-operator-binding
      RoleRef:
        ApiGroup: rbac.authorization.k8s.io
        Kind: ClusterRole
        Name: cost-rag-operator
      Subjects:
        - Kind: ServiceAccount
          Name: cost-rag-api
          Namespace: cost-rag
```

### 3. 数据加密和合规

```yaml
# 加密配置
Encryption:
  S3:
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: AES256
          BucketKeyEnabled: true
    VersioningConfiguration:
      Status: Enabled
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true

  RDS:
    StorageEncrypted: true
    KmsKeyId: alias/cost-rag-db-key
    CopyTagsToSnapshot: true
    DeleteAutomatedBackups: true

  EFS:
    Encrypted: true
    KmsKeyId: alias/cost-rag-efs-key

  SecretsManager:
    KmsKeyId: alias/cost-rag-secrets-key

# 合规性配置
Compliance:
  AuditLogging:
    CloudTrail:
      IsMultiRegionTrail: true
      IncludeGlobalServiceEvents: true
      S3BucketName: cost-rag-cloudtrail-logs
      KmsKeyId: alias/cost-rag-cloudtrail-key

    Config:
      DeliveryChannel:
        S3BucketName: cost-rag-config-bucket
        S3KeyPrefix: config/

    GuardDuty:
      Enabled: true
      DataSources:
        S3Logs:
          Enable: true
        Kubernetes:
          AuditLogs:
            Enable: true
```

---

## 📞 技术支持

- **AWS文档**: [AWS官方文档](https://docs.aws.amazon.com/)
- **Azure文档**: [Azure官方文档](https://docs.microsoft.com/azure/)
- **Google Cloud文档**: [GCP官方文档](https://cloud.google.com/docs)
- **阿里云文档**: [阿里云官方文档](https://help.aliyun.com/)
- **Kubernetes文档**: [K8s官方文档](https://kubernetes.io/docs/)
- **技术支持**: support@cost-rag.com