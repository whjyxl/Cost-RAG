# 请求数据模型规范

## 概述

本文档详细定义了Cost-RAG系统API的所有请求数据模型，包括认证、文档处理、成本估算、多项目对比、RAG查询等模块的请求参数规范。所有模型都遵循JSON Schema标准，并提供详细的字段说明、验证规则和使用示例。

## 📋 目录

- [认证相关模型](#认证相关模型)
- [文档处理模型](#文档处理模型)
- [成本估算模型](#成本估算模型)
- [多项目对比模型](#多项目对比模型)
- [RAG查询模型](#rag查询模型)
- [通用数据模型](#通用数据模型)

## 🔐 认证相关模型

### LoginRequest

用户登录请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "用户登录请求",
  "required": ["username", "password"],
  "properties": {
    "username": {
      "type": "string",
      "format": "email",
      "title": "用户邮箱",
      "description": "用户登录邮箱地址",
      "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "minLength": 5,
      "maxLength": 255,
      "examples": ["user@example.com"]
    },
    "password": {
      "type": "string",
      "format": "password",
      "title": "用户密码",
      "description": "用户登录密码",
      "minLength": 8,
      "maxLength": 128,
      "pattern": "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$",
      "examples": ["SecurePass123"]
    },
    "remember_me": {
      "type": "boolean",
      "title": "记住登录状态",
      "description": "是否保持登录状态",
      "default": false
    }
  },
  "additionalProperties": false
}
```

**示例**:
```json
{
  "username": "engineer@cost-rag.com",
  "password": "SecurePass123",
  "remember_me": true
}
```

### RefreshTokenRequest

刷新访问令牌请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "刷新令牌请求",
  "required": ["refresh_token"],
  "properties": {
    "refresh_token": {
      "type": "string",
      "title": "刷新令牌",
      "description": "用于刷新访问令牌的刷新令牌",
      "minLength": 100,
      "maxLength": 1000
    }
  },
  "additionalProperties": false
}
```

**示例**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```

## 📄 文档处理模型

### DocumentUploadRequest

文档上传请求模型（multipart/form-data）

**字段定义**:

| 字段 | 类型 | 必填 | 描述 | 验证规则 |
|------|------|------|------|----------|
| file | File | ✅ | 上传的文档文件 | 大小≤100MB，支持PDF/Excel/Word/PPT |
| document_type | String | ❌ | 文档类型分类 | 枚举值：cost_template, industry_report, specification, drawing, other |
| project_id | UUID | ❌ | 关联的项目ID | UUID格式 |
| description | String | ❌ | 文档描述 | 最大1000字符 |

**支持的文件类型**:
```json
{
  "allowed_types": {
    "pdf": [".pdf"],
    "excel": [".xlsx", ".xls"],
    "word": [".docx", ".doc"],
    "powerpoint": [".pptx", ".ppt"],
    "text": [".txt", ".md"],
    "html": [".html", ".htm"]
  },
  "max_file_size": 104857600,
  "document_types": [
    "cost_template",
    "industry_report",
    "specification",
    "drawing",
    "other"
  ]
}
```

### DocumentUpdateRequest

文档更新请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "文档更新请求",
  "properties": {
    "filename": {
      "type": "string",
      "title": "文件名",
      "minLength": 1,
      "maxLength": 255
    },
    "document_type": {
      "type": "string",
      "enum": ["cost_template", "industry_report", "specification", "drawing", "other"]
    },
    "description": {
      "type": "string",
      "title": "文档描述",
      "maxLength": 1000
    },
    "project_id": {
      "type": "string",
      "format": "uuid",
      "title": "项目ID"
    },
    "tags": {
      "type": "array",
      "title": "文档标签",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 50
      },
      "maxItems": 10
    }
  },
  "additionalProperties": false
}
```

**示例**:
```json
{
  "filename": "2024年北京市工程造价定额.pdf",
  "document_type": "cost_template",
  "description": "北京市2024年最新工程造价定额标准",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "tags": ["定额", "北京", "2024年", "工程造价"]
}
```

## 💰 成本估算模型

### CreateEstimateRequest

创建成本估算请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "创建成本估算请求",
  "required": ["project_name", "project_type", "area"],
  "properties": {
    "project_name": {
      "type": "string",
      "title": "项目名称",
      "description": "工程项目名称",
      "minLength": 2,
      "maxLength": 255,
      "pattern": "^[\\u4e00-\\u9fa5a-zA-Z0-9\\s\\-()（）]+$"
    },
    "project_type": {
      "type": "string",
      "title": "项目类型",
      "enum": ["office", "residential", "commercial", "mixed"],
      "description": "工程项目类型分类"
    },
    "area": {
      "type": "number",
      "title": "建筑面积",
      "description": "项目建筑面积（平方米）",
      "minimum": 1,
      "maximum": 1000000,
      "multipleOf": 0.01
    },
    "floors": {
      "type": "integer",
      "title": "楼层数",
      "description": "建筑物总层数",
      "minimum": 1,
      "maximum": 200
    },
    "quality_level": {
      "type": "string",
      "title": "质量等级",
      "enum": ["low", "medium", "high"],
      "default": "medium",
      "description": "项目质量等级标准"
    },
    "location": {
      "type": "string",
      "title": "项目位置",
      "description": "项目地理位置",
      "maxLength": 255,
      "pattern": "^[\\u4e00-\\u9fa5a-zA-Z0-9\\s\\-()（）市省区县]+$"
    },
    "template_id": {
      "type": "string",
      "format": "uuid",
      "title": "成本模板ID",
      "description": "指定的成本模板ID，为空则自动选择"
    },
    "description": {
      "type": "string",
      "title": "项目描述",
      "description": "项目的详细描述信息",
      "maxLength": 1000
    },
    "special_requirements": {
      "type": "array",
      "title": "特殊要求",
      "description": "项目的特殊技术要求",
      "items": {
        "type": "string",
        "maxLength": 200
      },
      "maxItems": 10
    }
  },
  "additionalProperties": false
}
```

**项目类型详细说明**:
```json
{
  "project_types": {
    "office": {
      "name": "办公楼",
      "description": "商务写字楼、办公大楼",
      "typical_features": ["标准层", "中央空调", "电梯系统", "停车场"]
    },
    "residential": {
      "name": "住宅",
      "description": "商品住宅、保障性住房",
      "typical_features": ["户型多样", "生活配套", "绿化率", "物业设施"]
    },
    "commercial": {
      "name": "商业",
      "description": "购物中心、商场、商业综合体",
      "typical_features": ["大空间", "消防系统", "装饰装修", "人流组织"]
    },
    "mixed": {
      "name": "综合体",
      "description": "多功能综合建筑",
      "typical_features": ["功能复合", "分区管理", "共享设施", "复杂系统"]
    }
  }
}
```

**质量等级详细说明**:
```json
{
  "quality_levels": {
    "low": {
      "name": "基础质量",
      "adjustment_factor": 0.85,
      "description": "满足基本功能要求的标准",
      "typical_applications": ["经济适用房", "工业厂房", "仓储设施"]
    },
    "medium": {
      "name": "标准质量",
      "adjustment_factor": 1.00,
      "description": "市场主流标准质量",
      "typical_applications": ["商品房", "办公楼", "商业建筑"]
    },
    "high": {
      "name": "高质量",
      "adjustment_factor": 1.20,
      "description": "高端优质质量标准",
      "typical_applications": ["高端住宅", "地标建筑", "五星级酒店"]
    }
  }
}
```

**示例**:
```json
{
  "project_name": "中关村科技园创新中心",
  "project_type": "office",
  "area": 85000.0,
  "floors": 32,
  "quality_level": "high",
  "location": "北京市海淀区中关村",
  "description": "高科技办公楼，包含研发中心、孵化器和配套商业设施",
  "special_requirements": [
    "智能化系统",
    "绿色建筑标准",
    "快速电梯系统",
    "高效空调系统"
  ]
}
```

### UpdateEstimateRequest

更新成本估算请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "更新成本估算请求",
  "properties": {
    "project_name": {
      "type": "string",
      "minLength": 2,
      "maxLength": 255
    },
    "area": {
      "type": "number",
      "minimum": 1,
      "maximum": 1000000,
      "multipleOf": 0.01
    },
    "quality_level": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "floors": {
      "type": "integer",
      "minimum": 1,
      "maximum": 200
    },
    "location": {
      "type": "string",
      "maxLength": 255
    },
    "description": {
      "type": "string",
      "maxLength": 1000
    },
    "special_requirements": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 200
      },
      "maxItems": 10
    }
  },
  "additionalProperties": false
}
```

### EstimateExportRequest

估算导出请求模型（查询参数）

**参数定义**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| format | String | ✅ | - | 导出格式：excel/markdown |
| template | String | ❌ | standard | 模板样式：standard/detailed/summary |
| language | String | ❌ | zh-CN | 导出语言：zh-CN/en-US |
| include_charts | Boolean | ❌ | false | 是否包含图表（仅Excel） |
| section_level | String | ❌ | all | 章节级别：primary/secondary/all |
| currency | String | ❌ | CNY | 货币单位：CNY/USD/EUR |
| decimal_places | Integer | ❌ | 2 | 小数位数：0-4 |

**示例**:
```
GET /estimates/est_123456789/export?format=excel&template=detailed&language=zh-CN&include_charts=true&section_level=all&currency=CNY&decimal_places=2
```

## 📊 多项目对比模型

### SimilarityAnalysisRequest

相似性分析请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "相似性分析请求",
  "required": ["target_project"],
  "properties": {
    "target_project": {
      "type": "object",
      "title": "目标项目",
      "required": ["area", "project_type"],
      "properties": {
        "area": {
          "type": "number",
          "title": "建筑面积",
          "minimum": 1,
          "maximum": 1000000,
          "multipleOf": 0.01
        },
        "project_type": {
          "type": "string",
          "enum": ["office", "residential", "commercial", "mixed"]
        },
        "location": {
          "type": "string",
          "title": "项目位置",
          "maxLength": 255
        },
        "quality_level": {
          "type": "string",
          "enum": ["low", "medium", "high"],
          "default": "medium"
        },
        "floors": {
          "type": "integer",
          "title": "楼层数",
          "minimum": 1,
          "maximum": 200
        },
        "budget_range": {
          "type": "object",
          "title": "预算范围",
          "properties": {
            "min_budget": {
              "type": "number",
              "minimum": 0
            },
            "max_budget": {
              "type": "number",
              "minimum": 0
            }
          }
        }
      }
    },
    "analysis_options": {
      "type": "object",
      "title": "分析选项",
      "properties": {
        "similarity_threshold": {
          "type": "number",
          "title": "相似度阈值",
          "minimum": 0,
          "maximum": 1,
          "default": 0.7
        },
        "max_results": {
          "type": "integer",
          "title": "最大结果数量",
          "minimum": 1,
          "maximum": 20,
          "default": 10
        },
        "include_cost_analysis": {
          "type": "boolean",
          "default": true
        },
        "include_risk_assessment": {
          "type": "boolean",
          "default": true
        },
        "weight_config": {
          "type": "object",
          "title": "相似度权重配置",
          "properties": {
            "area": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.3
            },
            "location": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.25
            },
            "project_type": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.2
            },
            "quality_level": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.15
            },
            "floors": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 0.1
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}
```

**权重配置说明**:
```json
{
  "weight_descriptions": {
    "area": "建筑面积相似度权重，反映项目规模相似性",
    "location": "地理位置相似度权重，考虑地区成本差异",
    "project_type": "项目类型相似度权重，类型相同权重最高",
    "quality_level": "质量等级相似度权重，影响成本标准",
    "floors": "楼层数相似度权重，反映建筑复杂度"
  },
  "weight_sum_validation": "权重总和必须等于1.0"
}
```

**示例**:
```json
{
  "target_project": {
    "area": 75000.0,
    "project_type": "commercial",
    "location": "深圳市南山区",
    "quality_level": "high",
    "floors": 35,
    "budget_range": {
      "min_budget": 400000000,
      "max_budget": 500000000
    }
  },
  "analysis_options": {
    "similarity_threshold": 0.75,
    "max_results": 8,
    "include_cost_analysis": true,
    "include_risk_assessment": true,
    "weight_config": {
      "area": 0.35,
      "location": 0.30,
      "project_type": 0.20,
      "quality_level": 0.10,
      "floors": 0.05
    }
  }
}
```

### BatchAnalysisRequest

批量分析请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "批量分析请求",
  "required": ["target_projects"],
  "properties": {
    "target_projects": {
      "type": "array",
      "title": "目标项目列表",
      "items": {
        "type": "object",
        "required": ["area", "project_type", "name"],
        "properties": {
          "name": {
            "type": "string",
            "title": "项目名称",
            "minLength": 2,
            "maxLength": 255
          },
          "area": {
            "type": "number",
            "minimum": 1,
            "maximum": 1000000
          },
          "project_type": {
            "type": "string",
            "enum": ["office", "residential", "commercial", "mixed"]
          },
          "location": {
            "type": "string",
            "maxLength": 255
          },
          "quality_level": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "default": "medium"
          }
        }
      },
      "minItems": 1,
      "maxItems": 10
    },
    "shared_analysis_options": {
      "type": "object",
      "title": "共享分析选项",
      "properties": {
        "similarity_threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.7
        },
        "include_cost_analysis": {
          "type": "boolean",
          "default": true
        },
        "compare_between_targets": {
          "type": "boolean",
          "default": false,
          "description": "是否在目标项目之间进行对比分析"
        }
      }
    }
  }
}
```

## 🤖 RAG查询模型

### QueryRequest

RAG查询请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "RAG查询请求",
  "required": ["question"],
  "properties": {
    "question": {
      "type": "string",
      "title": "查询问题",
      "description": "用户提出的问题",
      "minLength": 5,
      "maxLength": 1000,
      "pattern": "^[\\u4e00-\\u9fa5a-zA-Z0-9\\s\\-\\?\\！\\，\\.\\。]+$"
    },
    "context_type": {
      "type": "string",
      "title": "上下文类型",
      "enum": ["cost_estimation", "material_info", "regulation", "technique", "market", "general"],
      "default": "general"
    },
    "max_results": {
      "type": "integer",
      "title": "最大检索结果数",
      "description": "检索返回的最大文档数量",
      "minimum": 1,
      "maximum": 20,
      "default": 5
    },
    "include_sources": {
      "type": "boolean",
      "title": "包含来源信息",
      "description": "是否在答案中包含来源引用",
      "default": true
    },
    "conversation_id": {
      "type": "string",
      "format": "uuid",
      "title": "对话ID",
      "description": "用于多轮对话的上下文连续性"
    },
    "query_options": {
      "type": "object",
      "title": "查询选项",
      "properties": {
        "retrieval_method": {
          "type": "string",
          "enum": ["semantic", "keyword", "hybrid"],
          "default": "hybrid"
        },
        "similarity_threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.7
        },
        "include_knowledge_graph": {
          "type": "boolean",
          "default": true
        },
        "domain_filter": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["cost_estimation", "material_info", "regulation", "technique", "market"]
          },
          "maxItems": 5
        },
        "time_range": {
          "type": "string",
          "pattern": "^\\d+[mwy]$",
          "description": "时间范围过滤，如12m、2y、30d"
        },
        "source_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["cost_template", "industry_report", "specification", "drawing", "other"]
          },
          "maxItems": 5
        },
        "answer_length": {
          "type": "string",
          "enum": ["short", "medium", "long"],
          "default": "medium"
        },
        "confidence_threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.6
        }
      }
    }
  },
  "additionalProperties": false
}
```

**上下文类型详细说明**:
```json
{
  "context_types": {
    "cost_estimation": {
      "name": "成本估算",
      "description": "工程造价计算、定额查询、成本分析相关",
      "typical_queries": ["混凝土单价", "人工费标准", "定额计算"],
      "preferred_sources": ["cost_template", "industry_report"]
    },
    "material_info": {
      "name": "材料信息",
      "description": "建筑材料价格、规格、性能相关",
      "typical_queries": ["钢筋规格", "水泥价格", "材料性能"],
      "preferred_sources": ["specification", "industry_report"]
    },
    "regulation": {
      "name": "法规规范",
      "description": "国家标准、行业规范、政策法规相关",
      "typical_queries": ["施工规范", "质量标准", "安全规定"],
      "preferred_sources": ["specification", "cost_template"]
    },
    "technique": {
      "name": "工艺技术",
      "description": "施工工艺、技术方案、工法相关",
      "typical_queries": ["施工工艺", "技术方案", "施工方法"],
      "preferred_sources": ["specification", "drawing"]
    },
    "market": {
      "name": "市场分析",
      "description": "价格趋势、市场动态、行业分析相关",
      "typical_queries": ["价格趋势", "市场行情", "行业发展"],
      "preferred_sources": ["industry_report"]
    },
    "general": {
      "name": "通用",
      "description": "综合性问题，不限定特定领域",
      "typical_queries": ["综合咨询", "对比分析", "建议方案"],
      "preferred_sources": ["all"]
    }
  }
}
```

**示例**:
```json
{
  "question": "高层住宅建筑的深基坑支护有哪些常用方式？各自的适用条件和成本如何？",
  "context_type": "technique",
  "max_results": 8,
  "include_sources": true,
  "conversation_id": "conv_123456789",
  "query_options": {
    "retrieval_method": "hybrid",
    "similarity_threshold": 0.75,
    "include_knowledge_graph": true,
    "domain_filter": ["technique", "cost_estimation"],
    "source_types": ["specification", "industry_report"],
    "answer_length": "long",
    "confidence_threshold": 0.7
  }
}
```

### BatchQueryRequest

批量查询请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "批量查询请求",
  "required": ["queries"],
  "properties": {
    "queries": {
      "type": "array",
      "title": "查询列表",
      "items": {
        "type": "object",
        "required": ["question"],
        "properties": {
          "question": {
            "type": "string",
            "minLength": 5,
            "maxLength": 1000
          },
          "context_type": {
            "type": "string",
            "enum": ["cost_estimation", "material_info", "regulation", "technique", "market", "general"],
            "default": "general"
          },
          "priority": {
            "type": "string",
            "enum": ["high", "medium", "low"],
            "default": "medium"
          }
        }
      },
      "minItems": 1,
      "maxItems": 10
    },
    "batch_options": {
      "type": "object",
      "title": "批量处理选项",
      "properties": {
        "max_concurrent": {
          "type": "integer",
          "title": "最大并发数",
          "minimum": 1,
          "maximum": 5,
          "default": 3
        },
        "shared_context": {
          "type": "string",
          "title": "共享上下文",
          "description": "为所有查询提供共享的上下文信息",
          "maxLength": 500
        },
        "fail_fast": {
          "type": "boolean",
          "title": "快速失败",
          "description": "遇到错误时是否立即停止处理",
          "default": false
        }
      }
    }
  }
}
```

### ConversationStartRequest

开始对话请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "开始对话请求",
  "properties": {
    "title": {
      "type": "string",
      "title": "对话标题",
      "maxLength": 100
    },
    "context": {
      "type": "string",
      "title": "对话上下文",
      "description": "对话的背景信息",
      "maxLength": 500
    },
    "persona": {
      "type": "string",
      "title": "AI角色设定",
      "enum": ["professional", "friendly", "technical", "concise"],
      "default": "professional"
    },
    "max_history_length": {
      "type": "integer",
      "title": "最大历史记录长度",
      "minimum": 1,
      "maximum": 20,
      "default": 10
    }
  }
}
```

## 🔧 通用数据模型

### PaginationRequest

分页请求模型（查询参数）

**参数定义**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| page | Integer | ❌ | 1 | 页码，从1开始 |
| size | Integer | ❌ | 20 | 每页数量，1-100 |
| sort_by | String | ❌ | created_at | 排序字段 |
| sort_order | String | ❌ | desc | 排序方向：asc/desc |

**示例**:
```
GET /documents?page=2&size=10&sort_by=file_size&sort_order=desc
```

### SearchRequest

搜索请求模型（查询参数）

**参数定义**:

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| q | String | ✅ | - | 搜索关键词 |
| search_type | String | ❌ | hybrid | 搜索类型：semantic/keyword/hybrid |
| filters | Object | ❌ | - | 过滤条件 |
| facets | String | ❌ | - | 分面统计字段 |

**示例**:
```
GET /documents/search?q=混凝土&search_type=semantic&filters={"document_type":"cost_template"}&facets=document_type,location
```

### FilterRequest

过滤请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "过滤请求",
  "properties": {
    "date_range": {
      "type": "object",
      "title": "日期范围",
      "properties": {
        "start_date": {
          "type": "string",
          "format": "date-time"
        },
        "end_date": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "numeric_range": {
      "type": "object",
      "title": "数值范围",
      "patternProperties": {
        "^[a-zA-Z_][a-zA-Z0-9_]*$": {
          "type": "object",
          "properties": {
            "min": {"type": "number"},
            "max": {"type": "number"}
          }
        }
      }
    },
    "enum_filters": {
      "type": "object",
      "title": "枚举过滤",
      "patternProperties": {
        "^[a-zA-Z_][a-zA-Z0-9_]*$": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "text_search": {
      "type": "object",
      "title": "文本搜索",
      "properties": {
        "query": {"type": "string"},
        "fields": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    }
  }
}
```

### BulkOperationRequest

批量操作请求模型

**Schema Definition**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "批量操作请求",
  "required": ["operation", "items"],
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["create", "update", "delete"],
      "title": "操作类型"
    },
    "items": {
      "type": "array",
      "title": "操作项目列表",
      "items": {
        "type": "object"
      },
      "minItems": 1,
      "maxItems": 100
    },
    "options": {
      "type": "object",
      "title": "操作选项",
      "properties": {
        "continue_on_error": {
          "type": "boolean",
          "default": false
        },
        "validate_before_execute": {
          "type": "boolean",
          "default": true
        },
        "dry_run": {
          "type": "boolean",
          "default": false
        }
      }
    }
  }
}
```

## 📝 验证规则说明

### 通用验证规则

1. **字符串长度验证**
   - 最小长度：1-1000字符
   - 最大长度：根据字段用途设定
   - 特殊字符：根据字段需求允许特定字符

2. **数值范围验证**
   - 整数：根据业务逻辑设定最小最大值
   - 浮点数：支持小数点后2位精度
   - 正数验证：成本、面积等必须为正数

3. **枚举值验证**
   - 严格匹配预定义的枚举值
   - 大小写敏感
   - 支持中文枚举值

4. **格式验证**
   - UUID格式：标准UUID v4格式
   - 邮箱格式：标准邮箱正则表达式
   - 日期格式：ISO 8601标准

5. **业务逻辑验证**
   - 项目面积与楼层数的合理性
   - 成本数值的逻辑关系
   - 文件大小和类型限制

### 错误处理机制

```json
{
  "validation_error_response": {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "请求参数验证失败",
      "details": [
        {
          "field": "area",
          "message": "面积必须在1-1000000之间",
          "value": 0,
          "constraint": {
            "min": 1,
            "max": 1000000
          }
        }
      ]
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

## 🔍 使用示例

### 完整请求示例

```json
{
  "authentication": {
    "login": {
      "username": "engineer@cost-rag.com",
      "password": "SecurePass123",
      "remember_me": true
    }
  },
  "document_upload": {
    "file": "cost_template.pdf",
    "document_type": "cost_template",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "description": "2024年北京市工程造价定额"
  },
  "cost_estimation": {
    "project_name": "中关村科技园创新中心",
    "project_type": "office",
    "area": 85000.0,
    "floors": 32,
    "quality_level": "high",
    "location": "北京市海淀区中关村"
  },
  "rag_query": {
    "question": "高层办公楼的混凝土强度等级如何选择？",
    "context_type": "technique",
    "max_results": 5,
    "query_options": {
      "retrieval_method": "hybrid",
      "similarity_threshold": 0.8
    }
  }
}
```

---

## 📞 技术支持

- **API文档**: [OpenAPI规范](../openapi.yaml)
- **响应模型**: [响应数据模型](response-models.md)
- **数据库模式**: [数据库设计规范](database-schemas.md)
- **技术支持**: support@cost-rag.com