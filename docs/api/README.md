# Cost-RAG API 概览

## 🚀 系统简介

Cost-RAG 工程造价咨询智能RAG系统是一个基于成本优化的检索增强生成系统，专为工程造价咨询行业设计。本API提供完整的文档处理、智能问答、成本估算和多项目对比功能。

## 📋 核心特性

### 🔍 RAG智能检索
- 支持PDF、Excel、Word、PPT等多种文档格式
- 混合检索：语义搜索 + 关键词搜索
- 智能分块和向量化存储
- 知识图谱增强检索

### 💰 成本估算引擎
- 14级分部分项层级计算
- 多项目对比分析
- 质量等级调整
- 实时成本验证

### 📊 数据处理能力
- 行业数据定时爬取
- 多项目Excel智能解析
- 文档OCR和结构化提取
- 实时价格监控

## 🌐 API基础信息

- **基础URL**: `http://localhost:8000/api/v1`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API版本**: v1.0.0

## 🔐 认证授权

### 获取访问令牌
```http
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "your_password"
}
```

### 使用令牌
```http
Authorization: Bearer <your_jwt_token>
```

## 📚 API模块概览

| 模块 | 描述 | 端点数量 |
|------|------|----------|
| **文档处理** | 文档上传、解析、向量化 | 8 |
| **RAG查询** | 智能问答、检索、生成 | 6 |
| **成本估算** | 单项目/多项目成本计算 | 10 |
| **项目管理** | 项目CRUD、模板管理 | 12 |
| **数据爬取** | 行业数据获取和管理 | 5 |
| **系统管理** | 监控、配置、用户管理 | 8 |
| **外部集成** | Webhook、第三方API | 4 |

## 🎯 快速开始

### 1. 上传文档
```http
POST /documents/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: [your_document.pdf]
document_type: cost_template
```

### 2. 创建成本估算
```http
POST /estimates
Content-Type: application/json
Authorization: Bearer <token>

{
  "project_name": "商业综合体项目",
  "project_type": "commercial",
  "area": 50000.0,
  "quality_level": "medium",
  "location": "北京市朝阳区"
}
```

### 3. 智能问答
```http
POST /queries
Content-Type: application/json
Authorization: Bearer <token>

{
  "question": "混凝土C30的单价是多少？",
  "context_type": "cost_estimation",
  "max_results": 5
}
```

### 4. 多项目对比分析
```http
POST /comparisons/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: [comparison_excel.xlsx]
```

## 📊 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  },
  "message": "操作成功",
  "timestamp": "2024-01-01T12:00:00Z",
  "request_id": "req_123456789"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "area",
        "message": "面积必须大于0"
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "request_id": "req_123456789"
}
```

## 🔍 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权访问 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 422 | 数据验证失败 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

## ⚡ 性能特性

- **并发处理**: 支持100+并发用户
- **响应时间**: 95%请求 < 3秒
- **文件大小**: 支持最大100MB文档
- **批处理**: 支持批量文档上传
- **缓存**: Redis多级缓存优化

## 🛡️ 安全特性

- **身份认证**: JWT令牌认证
- **权限控制**: 基于角色的访问控制
- **数据加密**: HTTPS传输加密
- **输入验证**: 严格的数据验证
- **频率限制**: API调用频率限制

## 📈 监控指标

- **系统健康**: `/health` 端点
- **性能指标**: `/metrics` 端点
- **API统计**: 请求量、成功率、响应时间
- **资源监控**: CPU、内存、存储使用率

## 📞 技术支持

- **API文档**: [详细API规范](./openapi.yaml)
- **错误码参考**: [错误处理指南](./error-handling.md)
- **SDK支持**: Python、JavaScript SDK
- **技术支持**: support@cost-rag.com

## 🔄 版本更新

当前版本：**v1.0.0**

更新记录：
- v1.0.0 - 初始版本发布
- 支持14级成本计算
- 完整RAG工作流
- 多项目对比功能

---

## 📖 下一步

1. 查看 [OpenAPI完整规范](./openapi.yaml)
2. 了解 [认证授权机制](./authentication.md)
3. 学习 [错误处理方式](./error-handling.md)
4. 探索具体端点文档：
   - [文档处理API](./endpoints/document-processing.md)
   - [成本估算API](./endpoints/cost-estimation.md)
   - [多项目对比API](./endpoints/multi-project-comparison.md)
   - [RAG查询API](./endpoints/rag-query.md)