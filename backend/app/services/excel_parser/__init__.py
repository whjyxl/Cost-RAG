"""
Excel多项目对比解析器

这个包提供了完整的Excel多项目对比文件解析功能，
包括数据提取、验证和存储。

主要功能：
- 解析多项目对比Excel文件
- 识别14级分部分项结构
- 数据验证（数学关系、完整性）
- 存储到PostgreSQL数据库

Author: Cost-RAG Team
Created: 2025-11-06
Version: 1.0.0
"""

from .models import (
    ItemType,
    ProjectBasicInfo,
    CostItemValue,
    CostItem,
    ProjectCostData,
    ProjectComparisonData,
    ParserConfig,
)
from .parser import MultiProjectExcelParser
from .exceptions import (
    ExcelParserError,
    FileNotFoundError,
    InvalidFileFormatError,
    InvalidExcelStructureError,
    MissingRequiredDataError,
    DataValidationError,
    MathematicalRelationshipError,
    ProjectAreaInvalidError,
    CostSectionMissingError,
    NumericValueError,
)

__version__ = "1.0.0"

__all__ = [
    # 数据模型
    "ItemType",
    "ProjectBasicInfo",
    "CostItemValue",
    "CostItem",
    "ProjectCostData",
    "ProjectComparisonData",
    "ParserConfig",
    # 解析器
    "MultiProjectExcelParser",
    # 异常
    "ExcelParserError",
    "FileNotFoundError",
    "InvalidFileFormatError",
    "InvalidExcelStructureError",
    "MissingRequiredDataError",
    "DataValidationError",
    "MathematicalRelationshipError",
    "ProjectAreaInvalidError",
    "CostSectionMissingError",
    "NumericValueError",
]
