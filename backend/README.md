# Cost-RAG 后端API

Cost-RAG 智能成本咨询系统后端服务，基于FastAPI构建的现代化微服务架构。

## 🚀 功能特性

- **用户认证与授权**: JWT认证 + RBAC权限管理
- **文档管理**: 支持多格式文档上传、解析、向量化存储
- **成本估算**: AI驱动的智能成本计算和历史数据对比
- **知识图谱**: 实体识别、关系抽取、语义查询
- **AI模型集成**: 支持7个主流国产AI模型
- **智能问答**: 多源查询检索和答案融合
- **实时监控**: Prometheus + Grafana监控体系
- **高可用架构**: 微服务架构 + 容器化部署

## 🏗️ 技术架构

### 核心技术栈
- **Web框架**: FastAPI (Python 3.11+)
- **数据库**: PostgreSQL + SQLAlchemy (异步ORM)
- **缓存**: Redis
- **向量数据库**: Qdrant
- **图数据库**: Neo4j
- **认证**: JWT + bcrypt
- **文档处理**: PyMuPDF + python-docx
- **AI集成**: OpenAI API兼容接口

### 架构设计
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用       │    │   API网关        │    │   负载均衡       │
│   (React)       │───▶│   (Nginx)       │───▶│   (Nginx)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   后端API        │◀───│   监控服务       │
                       │   (FastAPI)     │    │ (Prometheus)    │
                       └─────────────────┘    └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   PostgreSQL   │    │     Redis      │    │    Neo4j       │    │    Qdrant      │
│   (主数据库)    │    │    (缓存)       │    │   (图数据库)    │    │  (向量数据库)   │
└───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
```

## 📦 快速开始

### 环境要求
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Node.js 18+ (用于开发工具)

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/your-org/cost-rag.git
cd cost-rag/backend
```

2. **创建虚拟环境**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows
```

3. **安装依赖**
```bash
pip install -r requirements.txt
```

4. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

5. **启动依赖服务**
```bash
docker-compose up -d postgres redis neo4j qdrant
```

6. **运行数据库迁移**
```bash
python -m alembic upgrade head
```

7. **启动应用**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

8. **访问API文档**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Docker部署

1. **开发环境**
```bash
./scripts/deploy.sh dev --build --migrate --seed --monitoring
```

2. **生产环境**
```bash
./scripts/deploy.sh production --build --migrate --monitoring
```

## 📚 API文档

### 认证接口
```http
POST /api/v1/auth/register  # 用户注册
POST /api/v1/auth/login     # 用户登录
GET  /api/v1/auth/me        # 获取当前用户信息
PUT  /api/v1/auth/change-password  # 修改密码
```

### 文档管理
```http
POST /api/v1/documents/upload        # 上传文档
GET  /api/v1/documents               # 获取文档列表
GET  /api/v1/documents/{id}          # 获取文档详情
PUT  /api/v1/documents/{id}/metadata # 更新文档元数据
DELETE /api/v1/documents/{id}         # 删除文档
GET  /api/v1/documents/search        # 搜索文档
```

### 智能问答
```http
POST /api/v1/qa/query            # 处理查询
POST /api/v1/qa/batch-query      # 批量查询
GET  /api/v1/qa/history          # 查询历史
GET  /api/v1/qa/suggestions      # 查询建议
```

### 成本估算
```http
POST /api/v1/cost-estimates      # 创建估算
GET  /api/v1/cost-estimates/{id} # 获取估算详情
PUT  /api/v1/cost-estimates/{id} # 更新估算
GET  /api/v1/cost-estimates/project/{id}/summary  # 项目成本汇总
```

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
pytest

# 运行单元测试
pytest tests/unit/

# 运行集成测试
pytest tests/integration/

# 运行API测试
pytest tests/api/

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

### 测试覆盖率目标
- 总体覆盖率: >90%
- 核心模块覆盖率: >95%
- API端点覆盖率: 100%

## 🔧 配置说明

### 环境变量
```bash
# 应用配置
SECRET_KEY=your-secret-key
DEBUG=false
ENVIRONMENT=production

# 数据库配置
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname
REDIS_URL=redis://localhost:6379/0

# AI模型配置
ZHIPUAI_API_KEY=your-zhipuai-key
MOONSHOT_API_KEY=your-moonshot-key
# ... 其他AI模型API密钥

# 外部服务
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
QDRANT_URL=http://localhost:6333
```

### 数据库配置
- **PostgreSQL**: 主数据库，存储业务数据
- **Redis**: 缓存和会话存储
- **Neo4j**: 知识图谱存储
- **Qdrant**: 向量存储，用于文档检索

## 📊 监控与日志

### 监控指标
- API响应时间
- 请求成功率
- 数据库连接池状态
- 内存和CPU使用率
- AI模型调用统计

### 日志级别
- `DEBUG`: 详细调试信息
- `INFO`: 一般信息
- `WARNING`: 警告信息
- `ERROR`: 错误信息
- `CRITICAL`: 严重错误

### 访问监控
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## 🔒 安全特性

### 认证与授权
- JWT Token认证
- 密码加密存储
- RBAC权限控制
- API访问频率限制

### 数据安全
- 输入验证和清理
- SQL注入防护
- XSS防护
- CORS配置

## 🚀 性能优化

### 缓存策略
- Redis缓存热点数据
- 数据库查询结果缓存
- API响应缓存

### 数据库优化
- 连接池管理
- 索引优化
- 查询优化
- 读写分离支持

### 异步处理
- 异步数据库操作
- 异步AI模型调用
- 后台任务队列

## 🤝 贡献指南

### 开发流程
1. Fork项目
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request
5. 代码审查
6. 合并代码

### 代码规范
- 遵循PEP 8代码风格
- 使用类型注解
- 编写完整的文档字符串
- 保持测试覆盖率

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](LICENSE)文件。

## 🆘 支持与帮助

### 常见问题
1. **数据库连接失败**: 检查数据库服务是否启动
2. **AI模型调用失败**: 检查API密钥配置
3. **文档上传失败**: 检查文件格式和大小限制

### 获取帮助
- 📖 查看API文档: http://localhost:8000/docs
- 🐛 提交Issue: GitHub Issues
- 💬 社区讨论: GitHub Discussions

### 联系方式
- 邮箱: support@cost-rag.com
- 文档: https://docs.cost-rag.com
- 官网: https://cost-rag.com

---

**Cost-RAG Team** - 让成本咨询更智能 🚀