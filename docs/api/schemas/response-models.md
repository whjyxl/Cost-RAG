# 响应数据模型规范

## 概述

本文档详细定义了Cost-RAG系统API的所有响应数据模型，包括成功响应和错误响应的标准格式。所有模型都遵循JSON Schema标准，提供统一的响应结构、状态码规范和数据格式说明。

## 📋 目录

- [通用响应结构](#通用响应结构)
- [认证相关响应](#认证相关响应)
- [文档处理响应](#文档处理响应)
- [成本估算响应](#成本估算响应)
- [多项目对比响应](#多项目对比响应)
- [RAG查询响应](#rag查询响应)
- [错误响应模型](#错误响应模型)
- [分页响应模型](#分页响应模型)

## 🏗️ 通用响应结构

### 标准响应格式

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "标准API响应",
  "required": ["success", "timestamp"],
  "properties": {
    "success": {
      "type": "boolean",
      "title": "操作是否成功",
      "description": "指示API调用是否成功执行"
    },
    "data": {
      "type": "object",
      "title": "响应数据",
      "description": "成功时返回的具体数据内容"
    },
    "message": {
      "type": "string",
      "title": "响应消息",
      "description": "操作结果的简要描述",
      "maxLength": 255
    },
    "error": {
      "$ref": "#/definitions/ErrorInfo",
      "title": "错误信息",
      "description": "失败时返回的错误详情"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "title": "响应时间戳",
      "description": "API响应生成的时间"
    },
    "request_id": {
      "type": "string",
      "format": "uuid",
      "title": "请求ID",
      "description": "用于追踪请求的唯一标识符"
    },
    "metadata": {
      "type": "object",
      "title": "元数据",
      "description": "额外的响应元信息",
      "properties": {
        "version": {
          "type": "string",
          "title": "API版本"
        },
        "processing_time": {
          "type": "number",
          "title": "处理时间（毫秒）"
        },
        "warnings": {
          "type": "array",
          "title": "警告信息",
          "items": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

**成功响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "doc_123456789",
    "filename": "cost_template.pdf"
  },
  "message": "操作成功",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_abc123",
  "metadata": {
    "version": "v1.0.0",
    "processing_time": 125.5,
    "warnings": []
  }
}
```

## 🔐 认证相关响应

### LoginResponse

用户登录响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "用户登录响应",
  "required": ["access_token", "token_type", "expires_in", "user"],
  "properties": {
    "access_token": {
      "type": "string",
      "title": "访问令牌",
      "description": "JWT格式的访问令牌",
      "minLength": 100
    },
    "refresh_token": {
      "type": "string",
      "title": "刷新令牌",
      "description": "用于刷新访问令牌的刷新令牌"
    },
    "token_type": {
      "type": "string",
      "enum": ["Bearer"],
      "title": "令牌类型"
    },
    "expires_in": {
      "type": "integer",
      "title": "过期时间",
      "description": "访问令牌的有效期（秒）",
      "minimum": 1
    },
    "refresh_expires_in": {
      "type": "integer",
      "title": "刷新令牌过期时间",
      "description": "刷新令牌的有效期（秒）"
    },
    "user": {
      "$ref": "#/definitions/UserInfo"
    },
    "permissions": {
      "type": "array",
      "title": "用户权限",
      "items": {
        "type": "string"
      }
    }
  }
}
```

**UserInfo Definition**:
```json
{
  "type": "object",
  "title": "用户信息",
  "required": ["id", "username", "full_name", "role"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "title": "用户ID"
    },
    "username": {
      "type": "string",
      "format": "email",
      "title": "用户邮箱"
    },
    "full_name": {
      "type": "string",
      "title": "用户姓名"
    },
    "role": {
      "type": "string",
      "enum": ["admin", "user", "viewer"],
      "title": "用户角色"
    },
    "avatar_url": {
      "type": "string",
      "format": "uri",
      "title": "头像URL"
    },
    "last_login": {
      "type": "string",
      "format": "date-time",
      "title": "最后登录时间"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "title": "创建时间"
    },
    "organization": {
      "type": "string",
      "title": "所属组织"
    }
  }
}
```

**示例**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzP5a9L8y5N9J7wFJ5jN7zF5J7wFJ5jN7zF5J7wFJ5jN7zF5J7w",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_expires_in": 604800,
    "user": {
      "id": "user_123456789",
      "username": "engineer@cost-rag.com",
      "full_name": "张工程师",
      "role": "user",
      "avatar_url": "https://api.cost-rag.com/avatars/user_123456789.jpg",
      "last_login": "2024-01-15T09:30:00Z",
      "created_at": "2023-06-01T10:00:00Z",
      "organization": "北京工程造价咨询有限公司"
    },
    "permissions": [
      "documents:read",
      "documents:write",
      "estimates:read",
      "estimates:write",
      "queries:read",
      "queries:write"
    ]
  },
  "message": "登录成功",
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_abc123"
}
```

## 📄 文档处理响应

### DocumentUploadResponse

文档上传响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "文档上传响应",
  "required": ["document_id", "filename", "processing_status"],
  "properties": {
    "document_id": {
      "type": "string",
      "format": "uuid",
      "title": "文档ID"
    },
    "filename": {
      "type": "string",
      "title": "文件名"
    },
    "file_type": {
      "type": "string",
      "title": "文件类型"
    },
    "document_type": {
      "type": "string",
      "enum": ["cost_template", "industry_report", "specification", "drawing", "other"],
      "title": "文档类型分类"
    },
    "file_size": {
      "type": "integer",
      "title": "文件大小（字节）"
    },
    "processing_status": {
      "type": "string",
      "enum": ["uploaded", "processing", "completed", "failed"],
      "title": "处理状态"
    },
    "upload_time": {
      "type": "string",
      "format": "date-time",
      "title": "上传时间"
    },
    "estimated_processing_time": {
      "type": "integer",
      "title": "预估处理时间（秒）"
    },
    "file_metadata": {
      "type": "object",
      "title": "文件元数据",
      "properties": {
        "original_format": {
          "type": "string",
          "title": "原始格式"
        },
        "page_count": {
          "type": "integer",
          "title": "页数"
        },
        "creation_date": {
          "type": "string",
          "format": "date",
          "title": "创建日期"
        },
        "author": {
          "type": "string",
          "title": "作者"
        },
        "language": {
          "type": "string",
          "title": "文档语言"
        }
      }
    }
  }
}
```

### DocumentDetailResponse

文档详情响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "文档详情响应",
  "required": ["document", "processing_status"],
  "properties": {
    "document": {
      "$ref": "#/definitions/DocumentSummary"
    },
    "extracted_text": {
      "type": "string",
      "title": "提取的文本内容"
    },
    "text_metadata": {
      "type": "object",
      "title": "文本元数据",
      "properties": {
        "total_characters": {
          "type": "integer",
          "title": "总字符数"
        },
        "total_words": {
          "type": "integer",
          "title": "总词数"
        },
        "language_detected": {
          "type": "string",
          "title": "检测的语言"
        },
        "ocr_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "title": "OCR置信度"
        }
      }
    },
    "chunk_count": {
      "type": "integer",
      "title": "分块数量"
    },
    "entities_extracted": {
      "type": "array",
      "title": "提取的实体",
      "items": {
        "$ref": "#/definitions/ExtractedEntity"
      }
    },
    "processing_details": {
      "type": "object",
      "title": "处理详情",
      "properties": {
        "ocr_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "parsing_method": {
          "type": "string",
          "title": "解析方法"
        },
        "language_detected": {
          "type": "string"
        },
        "processing_time": {
          "type": "number",
          "title": "处理时间（秒）"
        },
        "chunk_strategy": {
          "type": "string",
          "title": "分块策略"
        },
        "vector_model": {
          "type": "string",
          "title": "向量化模型"
        }
      }
    },
    "chunks_preview": {
      "type": "array",
      "title": "分块预览",
      "items": {
        "$ref": "#/definitions/DocumentChunk"
      },
      "maxItems": 10
    }
  }
}
```

**DocumentChunk Definition**:
```json
{
  "type": "object",
  "title": "文档分块",
  "required": ["chunk_id", "chunk_index", "content"],
  "properties": {
    "chunk_id": {
      "type": "string",
      "title": "分块ID"
    },
    "chunk_index": {
      "type": "integer",
      "title": "分块索引"
    },
    "content": {
      "type": "string",
      "title": "分块内容"
    },
    "token_count": {
      "type": "integer",
      "title": "Token数量"
    },
    "embedding_vector_id": {
      "type": "string",
      "title": "向量ID"
    }
  }
}
```

### DocumentListResponse

文档列表响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "文档列表响应",
  "required": ["documents", "pagination"],
  "properties": {
    "documents": {
      "type": "array",
      "title": "文档列表",
      "items": {
        "$ref": "#/definitions/DocumentSummary"
      }
    },
    "pagination": {
      "$ref": "#/definitions/PaginationInfo"
    },
    "filters_applied": {
      "type": "object",
      "title": "应用的过滤器",
      "properties": {
        "document_type": {
          "type": "string"
        },
        "search": {
          "type": "string"
        },
        "date_range": {
          "type": "object"
        }
      }
    },
    "statistics": {
      "type": "object",
      "title": "统计信息",
      "properties": {
        "total_documents": {
          "type": "integer"
        },
        "total_size": {
          "type": "integer"
        },
        "processing_summary": {
          "type": "object",
          "properties": {
            "completed": {
              "type": "integer"
            },
            "processing": {
              "type": "integer"
            },
            "failed": {
              "type": "integer"
            }
          }
        }
      }
    }
  }
}
```

## 💰 成本估算响应

### CreateEstimateResponse

创建成本估算响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "创建成本估算响应",
  "required": ["estimate_id", "project_name", "status"],
  "properties": {
    "estimate_id": {
      "type": "string",
      "format": "uuid",
      "title": "估算ID"
    },
    "project_name": {
      "type": "string",
      "title": "项目名称"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "processing", "completed", "failed"],
      "title": "估算状态"
    },
    "estimated_completion_time": {
      "type": "integer",
      "title": "预估完成时间（秒）"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "title": "创建时间"
    },
    "calculation_progress": {
      "type": "object",
      "title": "计算进度",
      "properties": {
        "current_step": {
          "type": "string",
          "title": "当前步骤"
        },
        "progress_percentage": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "title": "进度百分比"
        },
        "estimated_remaining_time": {
          "type": "integer",
          "title": "预估剩余时间（秒）"
        }
      }
    }
  }
}
```

### EstimateDetailResponse

成本估算详情响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "成本估算详情响应",
  "required": ["estimate", "breakdown"],
  "properties": {
    "estimate": {
      "$ref": "#/definitions/EstimateSummary"
    },
    "breakdown": {
      "$ref": "#/definitions/CostBreakdown"
    },
    "template_used": {
      "type": "object",
      "title": "使用的模板",
      "properties": {
        "template_id": {
          "type": "string",
          "format": "uuid"
        },
        "template_name": {
          "type": "string"
        },
        "region": {
          "type": "string"
        },
        "base_year": {
          "type": "integer"
        },
        "similarity_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "title": "模板相似度"
        }
      }
    },
    "validation_results": {
      "$ref": "#/definitions/ValidationResults"
    },
    "calculation_metadata": {
      "type": "object",
      "title": "计算元数据",
      "properties": {
        "calculation_method": {
          "type": "string",
          "title": "计算方法"
        },
        "processing_time": {
          "type": "number",
          "title": "处理时间（秒）"
        },
        "quality_adjustments": {
          "type": "object",
          "title": "质量调整系数",
          "additionalProperties": {
            "type": "number"
          }
        },
        "regional_adjustments": {
          "type": "object",
          "title": "地区调整系数"
        },
        "confidence_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "title": "置信度"
        }
      }
    },
    "cost_trends": {
      "type": "object",
      "title": "成本趋势",
      "properties": {
        "market_comparison": {
          "type": "object",
          "properties": {
            "market_average": {
              "type": "number"
            },
            "market_percentile": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            }
          }
        },
        "historical_trends": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "period": {
                "type": "string"
              },
              "unit_cost": {
                "type": "number"
              }
            }
          }
        }
      }
    }
  }
}
```

**CostBreakdown Definition**:
```json
{
  "type": "object",
  "title": "成本分解",
  "required": ["total_cost", "unit_cost"],
  "properties": {
    "total_cost": {
      "type": "number",
      "title": "总造价（元）"
    },
    "unit_cost": {
      "type": "number",
      "title": "单方造价（元/平方米）"
    },
    "primary_sections": {
      "type": "array",
      "title": "一级分部",
      "items": {
        "$ref": "#/definitions/PrimarySection"
      }
    },
    "secondary_sections": {
      "type": "array",
      "title": "二级分部",
      "items": {
        "$ref": "#/definitions/SecondarySection"
      }
    },
    "cost_analysis": {
      "type": "object",
      "title": "成本分析",
      "properties": {
        "material_cost_ratio": {
          "type": "number",
          "title": "材料成本占比"
        },
        "labor_cost_ratio": {
          "type": "number",
          "title": "人工成本占比"
        },
        "equipment_cost_ratio": {
          "type": "number",
          "title": "设备成本占比"
        },
        "management_cost_ratio": {
          "type": "number",
          "title": "管理成本占比"
        }
      }
    }
  }
}
```

## 📊 多项目对比响应

### ComparisonUploadResponse

对比文件上传响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "对比文件上传响应",
  "required": ["comparison_id", "filename", "projects_extracted"],
  "properties": {
    "comparison_id": {
      "type": "string",
      "format": "uuid",
      "title": "对比ID"
    },
    "filename": {
      "type": "string",
      "title": "文件名"
    },
    "file_size": {
      "type": "integer",
      "title": "文件大小（字节）"
    },
    "projects_extracted": {
      "type": "array",
      "title": "提取的项目列表",
      "items": {
        "$ref": "#/definitions/ExtractedProject"
      }
    },
    "validation_results": {
      "$ref": "#/definitions/ValidationResults"
    },
    "processing_time": {
      "type": "number",
      "title": "处理时间（秒）"
    },
    "parsing_summary": {
      "type": "object",
      "title": "解析摘要",
      "properties": {
        "total_rows": {
          "type": "integer",
          "title": "总行数"
        },
        "projects_found": {
          "type": "integer",
          "title": "发现的项目数"
        },
        "sections_parsed": {
          "type": "integer",
          "title": "解析的分部数"
        },
        "data_quality_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "title": "数据质量评分"
        }
      }
    }
  }
}
```

### SimilarityAnalysisResponse

相似性分析响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "相似性分析响应",
  "required": ["analysis_id", "target_project", "similar_projects"],
  "properties": {
    "analysis_id": {
      "type": "string",
      "format": "uuid",
      "title": "分析ID"
    },
    "target_project": {
      "type": "object",
      "title": "目标项目",
      "properties": {
        "area": {
          "type": "number"
        },
        "project_type": {
          "type": "string"
        },
        "location": {
          "type": "string"
        },
        "quality_level": {
          "type": "string"
        }
      }
    },
    "similar_projects": {
      "type": "array",
      "title": "相似项目列表",
      "items": {
        "$ref": "#/definitions/SimilarProject"
      }
    },
    "cost_analysis": {
      "$ref": "#/definitions/CostAnalysisSummary"
    },
    "recommendations": {
      "type": "array",
      "title": "建议列表",
      "items": {
        "$ref": "#/definitions/CostRecommendation"
      }
    },
    "risk_assessment": {
      "type": "object",
      "title": "风险评估",
      "properties": {
        "overall_risk_level": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "risk_factors": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/RiskFactor"
          }
        },
        "contingency_recommendation": {
          "type": "object",
          "properties": {
            "contingency_percentage": {
              "type": "number"
            },
            "contingency_amount": {
              "type": "number"
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      }
    },
    "confidence_metrics": {
      "type": "object",
      "title": "置信度指标",
      "properties": {
        "overall_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "data_quality_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "market_data_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "analysis_method_confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    }
  }
}
```

## 🤖 RAG查询响应

### QueryResponse

查询响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "查询响应",
  "required": ["query_id", "question", "status"],
  "properties": {
    "query_id": {
      "type": "string",
      "format": "uuid",
      "title": "查询ID"
    },
    "question": {
      "type": "string",
      "title": "原始问题"
    },
    "status": {
      "type": "string",
      "enum": ["processing", "completed", "failed"],
      "title": "查询状态"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "title": "创建时间"
    },
    "estimated_completion_time": {
      "type": "integer",
      "title": "预估完成时间（秒）"
    },
    "processing_progress": {
      "type": "object",
      "title": "处理进度",
      "properties": {
        "current_stage": {
          "type": "string",
          "enum": ["query_understanding", "retrieval", "generation", "validation"]
        },
        "progress_percentage": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      }
    }
  }
}
```

### QueryDetailResponse

查询详情响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "查询详情响应",
  "required": ["query", "answer"],
  "properties": {
    "query": {
      "type": "object",
      "title": "查询信息",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "question": {
          "type": "string"
        },
        "status": {
          "type": "string"
        },
        "created_at": {
          "type": "string",
          "format": "date-time"
        },
        "completed_at": {
          "type": "string",
          "format": "date-time"
        },
        "processing_time": {
          "type": "number",
          "title": "处理时间（秒）"
        }
      }
    },
    "answer": {
      "$ref": "#/definitions/AnswerInfo"
    },
    "sources": {
      "type": "array",
      "title": "来源列表",
      "items": {
        "$ref": "#/definitions/QuerySource"
      }
    },
    "reasoning_process": {
      "type": "object",
      "title": "推理过程",
      "properties": {
        "query_understanding": {
          "type": "object",
          "properties": {
            "intent": {
              "type": "string"
            },
            "entities_extracted": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "query_type": {
              "type": "string"
            }
          }
        },
        "retrieval_strategy": {
          "type": "object",
          "properties": {
            "method_used": {
              "type": "string"
            },
            "semantic_search_weight": {
              "type": "number"
            },
            "keyword_search_weight": {
              "type": "number"
            },
            "knowledge_graph_enhanced": {
              "type": "boolean"
            }
          }
        },
        "source_analysis": {
          "type": "object",
          "properties": {
            "total_retrieved": {
              "type": "integer"
            },
            "relevant_sources": {
              "type": "integer"
            },
            "source_diversity": {
              "type": "number"
            },
            "recency_weight": {
              "type": "number"
            }
          }
        },
        "answer_generation": {
          "type": "object",
          "properties": {
            "model_used": {
              "type": "string"
            },
            "prompt_tokens": {
              "type": "integer"
            },
            "completion_tokens": {
              "type": "integer"
            },
            "temperature": {
              "type": "number"
            },
            "generation_method": {
              "type": "string"
            }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "title": "元数据",
      "properties": {
        "retrieval_method": {
          "type": "string"
        },
        "similarity_threshold_used": {
          "type": "number"
        },
        "knowledge_graph_entities": {
          "type": "integer"
        },
        "domain_confidence": {
          "type": "number"
        },
        "factuality_score": {
          "type": "number"
        },
        "user_feedback": {
          "type": "object",
          "properties": {
            "rating": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5
            },
            "feedback_text": {
              "type": "string"
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    }
  }
}
```

**AnswerInfo Definition**:
```json
{
  "type": "object",
  "title": "答案信息",
  "required": ["content", "confidence_score"],
  "properties": {
    "content": {
      "type": "string",
      "title": "答案内容"
    },
    "confidence_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "title": "置信度"
    },
    "answer_length": {
      "type": "integer",
      "title": "答案长度（字符）"
    },
    "language": {
      "type": "string",
      "title": "答案语言"
    },
    "sources_cited": {
      "type": "integer",
      "title": "引用的来源数量"
    },
    "key_points": {
      "type": "array",
      "title": "关键信息点",
      "items": {
        "type": "string"
      }
    },
    "related_entities": {
      "type": "array",
      "title": "相关实体",
      "items": {
        "$ref": "#/definitions/RelatedEntity"
      }
    },
    "follow_up_questions": {
      "type": "array",
      "title": "建议的后续问题",
      "items": {
        "type": "string"
      }
    }
  }
}
```

## ❌ 错误响应模型

### ErrorResponse

标准错误响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "错误响应",
  "required": ["success", "error", "timestamp"],
  "properties": {
    "success": {
      "type": "boolean",
      "const": false
    },
    "error": {
      "$ref": "#/definitions/ErrorInfo"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "request_id": {
      "type": "string",
      "format": "uuid"
    },
    "trace_id": {
      "type": "string",
      "title": "追踪ID",
      "description": "用于内部错误追踪"
    }
  }
}
```

**ErrorInfo Definition**:
```json
{
  "type": "object",
  "title": "错误信息",
  "required": ["code", "message"],
  "properties": {
    "code": {
      "type": "string",
      "title": "错误代码",
      "description": "唯一的错误标识符"
    },
    "message": {
      "type": "string",
      "title": "错误消息",
      "description": "对错误的简要描述"
    },
    "details": {
      "type": "array",
      "title": "错误详情",
      "items": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string",
            "title": "错误字段"
          },
          "message": {
            "type": "string",
            "title": "字段错误描述"
          },
          "value": {
            "title": "错误值"
          },
          "constraint": {
            "title": "约束条件"
          }
        }
      }
    },
    "suggestions": {
      "type": "array",
      "title": "解决建议",
      "items": {
        "type": "string"
      }
    },
    "help_url": {
      "type": "string",
      "format": "uri",
      "title": "帮助文档URL"
    },
    "retry_after": {
      "type": "integer",
      "title": "重试等待时间（秒）"
    }
  }
}
```

**错误代码分类**:
```json
{
  "error_categories": {
    "validation_errors": {
      "INVALID_REQUEST_FORMAT": "请求格式不正确",
      "MISSING_REQUIRED_FIELD": "缺少必填字段",
      "INVALID_FIELD_VALUE": "字段值无效",
      "FIELD_OUT_OF_RANGE": "字段值超出范围",
      "INVALID_ENUM_VALUE": "枚举值无效"
    },
    "authentication_errors": {
      "UNAUTHORIZED": "未授权访问",
      "INVALID_CREDENTIALS": "认证信息无效",
      "TOKEN_EXPIRED": "访问令牌已过期",
      "INSUFFICIENT_PERMISSIONS": "权限不足"
    },
    "resource_errors": {
      "RESOURCE_NOT_FOUND": "资源不存在",
      "RESOURCE_ALREADY_EXISTS": "资源已存在",
      "RESOURCE_IN_USE": "资源正在使用中",
      "RESOURCE_LIMIT_EXCEEDED": "资源数量超出限制"
    },
    "business_logic_errors": {
      "CALCULATION_FAILED": "计算失败",
      "VALIDATION_FAILED": "验证失败",
      "PROCESSING_FAILED": "处理失败",
      "DEPENDENCY_UNAVAILABLE": "依赖服务不可用"
    },
    "system_errors": {
      "INTERNAL_SERVER_ERROR": "服务器内部错误",
      "SERVICE_UNAVAILABLE": "服务不可用",
      "RATE_LIMIT_EXCEEDED": "请求频率超限",
      "TIMEOUT": "请求超时"
    }
  }
}
```

## 📄 分页响应模型

### PaginationInfo

分页信息模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "分页信息",
  "required": ["page", "size", "total", "pages"],
  "properties": {
    "page": {
      "type": "integer",
      "minimum": 1,
      "title": "当前页码"
    },
    "size": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "title": "每页数量"
    },
    "total": {
      "type": "integer",
      "minimum": 0,
      "title": "总记录数"
    },
    "pages": {
      "type": "integer",
      "minimum": 0,
      "title": "总页数"
    },
    "has_next": {
      "type": "boolean",
      "title": "是否有下一页"
    },
    "has_prev": {
      "type": "boolean",
      "title": "是否有上一页"
    },
    "has_first": {
      "type": "boolean",
      "title": "是否有首页"
    },
    "has_last": {
      "type": "boolean",
      "title": "是否有末页"
    }
  }
}
```

### PaginatedResponse

通用分页响应模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "分页响应",
  "required": ["items", "pagination"],
  "properties": {
    "items": {
      "type": "array",
      "title": "数据项列表"
    },
    "pagination": {
      "$ref": "#/definitions/PaginationInfo"
    },
    "filters": {
      "type": "object",
      "title": "应用的过滤器"
    },
    "sorting": {
      "type": "object",
      "title": "排序信息",
      "properties": {
        "sort_by": {
          "type": "string"
        },
        "sort_order": {
          "type": "string",
          "enum": ["asc", "desc"]
        }
      }
    },
    "statistics": {
      "type": "object",
      "title": "统计信息"
    }
  }
}
```

## 📝 数据定义

### 通用数据类型定义

```json
{
  "definitions": {
    "DocumentSummary": {
      "type": "object",
      "properties": {
        "id": {"type": "string", "format": "uuid"},
        "filename": {"type": "string"},
        "file_type": {"type": "string"},
        "document_type": {"type": "string"},
        "file_size": {"type": "integer"},
        "processing_status": {"type": "string"},
        "created_at": {"type": "string", "format": "date-time"},
        "updated_at": {"type": "string", "format": "date-time"},
        "project_name": {"type": "string"}
      }
    },
    "ExtractedEntity": {
      "type": "object",
      "properties": {
        "entity_type": {
          "type": "string",
          "enum": ["material", "process", "quota", "regulation", "company", "location"]
        },
        "entity_name": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "position": {
          "type": "object",
          "properties": {
            "start": {"type": "integer"},
            "end": {"type": "integer"}
          }
        },
        "context": {"type": "string"},
        "standard_code": {"type": "string"}
      }
    },
    "EstimateSummary": {
      "type": "object",
      "properties": {
        "id": {"type": "string", "format": "uuid"},
        "project_name": {"type": "string"},
        "project_type": {"type": "string"},
        "area": {"type": "number"},
        "status": {"type": "string"},
        "total_cost": {"type": "number"},
        "unit_cost": {"type": "number"},
        "created_at": {"type": "string", "format": "date-time"},
        "updated_at": {"type": "string", "format": "date-time"}
      }
    },
    "ValidationResults": {
      "type": "object",
      "properties": {
        "is_valid": {"type": "boolean"},
        "errors": {
          "type": "array",
          "items": {"type": "string"}
        },
        "warnings": {
          "type": "array",
          "items": {"type": "string"}
        },
        "mathematical_validation": {
          "type": "object",
          "properties": {
            "section_14_validation": {"type": "boolean"},
            "hierarchy_validations": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "section_code": {"type": "string"},
                  "is_valid": {"type": "boolean"},
                  "expected_value": {"type": "number"},
                  "actual_value": {"type": "number"}
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## 🔍 使用示例

### 完整响应示例

```json
{
  "success": true,
  "data": {
    "query": {
      "id": "qry_123456789",
      "question": "混凝土C30的单价是多少？",
      "status": "completed",
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:30:08Z",
      "processing_time": 8.2
    },
    "answer": {
      "content": "根据最新的成本数据，混凝土C30的单价约为**450-520元/立方米**...",
      "confidence_score": 0.92,
      "answer_length": 280,
      "language": "zh-CN",
      "sources_cited": 4,
      "key_points": [
        "C30混凝土单价450-520元/立方米",
        "水泥成本占比最大(40-44%)",
        "地区差异影响价格15-25%"
      ]
    },
    "sources": [
      {
        "document_id": "doc_abc123",
        "document_name": "2024年北京市工程造价定额",
        "relevance_score": 0.95,
        "trust_score": 0.98
      }
    ]
  },
  "message": "查询完成",
  "timestamp": "2024-01-15T10:30:08Z",
  "request_id": "req_def456",
  "metadata": {
    "version": "v1.0.0",
    "processing_time": 8200,
    "warnings": []
  }
}
```

---

## 📞 技术支持

- **API文档**: [OpenAPI规范](../openapi.yaml)
- **请求模型**: [请求数据模型](request-models.md)
- **数据库模式**: [数据库设计规范](database-schemas.md)
- **技术支持**: support@cost-rag.com