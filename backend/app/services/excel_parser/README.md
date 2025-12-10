# Excel多项目对比解析器

## 📋 概述

Excel多项目对比解析器用于解析包含多个工程项目成本对比数据的Excel文件。

## 🚀 快速开始

### 基础使用

```python
from app.services.excel_parser import MultiProjectExcelParser

# 创建解析器
parser = MultiProjectExcelParser()

# 解析Excel文件
result = parser.parse("projects_comparison.xlsx")

# 查看结果
print(f"解析了 {len(result.projects)} 个项目")

for project in result.projects:
    print(f"项目: {project.basic_info.name}")
    print(f"面积: {project.basic_info.area} m²")
```

### 高级配置

```python
from app.services.excel_parser import MultiProjectExcelParser, ParserConfig

config = ParserConfig(
    validate_math_relationships=True,
    tolerance=0.01,
    skip_empty_projects=True
)

parser = MultiProjectExcelParser(config=config)
result = parser.parse("projects.xlsx")
```

### 数据验证

```python
# 验证所有项目
validation = result.validate_all_projects(tolerance=0.01)

if validation["is_valid"]:
    print("✅ 所有项目验证通过")
else:
    print(f"❌ {validation['summary']['invalid_projects']} 个项目验证失败")
```

## 📊 Excel文件格式

### 文件结构

```
| A列        | B列      | C列      | D列      |
|-----------|----------|----------|----------|
| (空)       | 项目名称  | (空)     | (空)     |
| (空)       | 面积     | (空)     | (空)     |
| (空)       | 层数     | (空)     | (空)     |
| (空)       | 时间     | (空)     | (空)     |
| 1.0 分部1  | 合价     | 单价     | 备注     |
```

### 数据要求

1. **第1行**: 项目名称（必填）
2. **第2行**: 建筑面积（必填）
3. **第3行**: 层数信息（可选）
4. **第4行**: 开竣工时间（可选）
5. **第5行起**: 成本分部分项数据

### 分部分项代码规范

- 一级分部: `1.0`, `2.0`, ..., `13.0`
- 二级分部: `1.1`, `1.2`, `2.1`, `2.2`, ...
- 项目总造价: `14.0`

## ✅ 数据验证规则

### 数学关系验证

**规则1**: 二级分部求和 = 一级分部
```
1.1 + 1.2 = 1.0
```

**规则2**: 一级分部求和 = 项目总造价
```
1.0 + 2.0 + ... + 13.0 = 14.0
```

## 🧪 测试

### 运行测试

```bash
# 所有测试
pytest tests/unit/excel_parser/ -v

# 特定测试
pytest tests/unit/excel_parser/test_models.py -v
```

### 生成测试Excel文件

```bash
cd backend/app/services/excel_parser
python create_test_files.py
```

## 🚨 异常处理

```python
from app.services.excel_parser.exceptions import (
    ExcelParserError,
    FileNotFoundError,
    InvalidExcelStructureError,
)

try:
    parser = MultiProjectExcelParser()
    result = parser.parse("projects.xlsx")
except FileNotFoundError as e:
    print(f"文件不存在: {e.message}")
except ExcelParserError as e:
    print(f"解析错误: {e.message}")
```

## 📝 更新日志

### v1.0.0 (2025-11-06)
- ✨ 初始版本发布
- ✨ 支持多项目Excel解析
- ✨ 14级分部分项结构支持
- ✨ 数学关系验证

---

**维护者**: Cost-RAG Team  
**创建日期**: 2025-11-06
