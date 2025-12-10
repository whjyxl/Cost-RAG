"""
Excel解析器自定义异常

定义了Excel解析过程中可能出现的所有异常类型，
便于精确的错误处理和用户友好的错误信息。

Author: Cost-RAG Team
Created: 2025-11-06
"""


class ExcelParserError(Exception):
    """Excel解析器基础异常"""
    
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """转换为字典格式，便于API返回"""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "details": self.details
        }


class FileNotFoundError(ExcelParserError):
    """文件不存在异常"""
    pass


class InvalidFileFormatError(ExcelParserError):
    """无效的文件格式异常"""
    pass


class InvalidExcelStructureError(ExcelParserError):
    """Excel结构无效异常"""
    pass


class MissingRequiredDataError(ExcelParserError):
    """缺少必需数据异常"""
    pass


class DataValidationError(ExcelParserError):
    """数据验证失败异常"""
    pass


class MathematicalRelationshipError(ExcelParserError):
    """数学关系验证失败异常"""
    pass


class ProjectAreaInvalidError(ExcelParserError):
    """项目面积无效异常"""
    pass


class CostSectionMissingError(ExcelParserError):
    """成本分部缺失异常"""
    pass


class NumericValueError(ExcelParserError):
    """数值错误异常"""
    pass


__all__ = [
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
