"""
数据模型模块 - 修复导入顺序以确保SQLAlchemy关系正确初始化
"""

# 先导入基础模型，再导入依赖模型，最后导入关系复杂的模型
from .project import Project, ProjectType, CostEstimate, CostItem
from .user import User
from .document import Document, DocumentChunk
from .knowledge import KnowledgeNode, KnowledgeRelation, KnowledgePath
from .domain import KnowledgeDomain, NodeDomainMapping, PREDEFINED_DOMAINS
from .query import QueryHistory, QueryResult, UserFeedback
from .system_setting import SystemSetting
from .project_template import ProjectTemplate, ProjectTemplateCostItem

__all__ = [
    "User",
    "Project", "ProjectType", "CostEstimate", "CostItem",
    "Document", "DocumentChunk",
    "KnowledgeNode", "KnowledgeRelation", "KnowledgePath",
    "KnowledgeDomain", "NodeDomainMapping", "PREDEFINED_DOMAINS",
    "QueryHistory", "QueryResult", "UserFeedback",
    "SystemSetting",
    "ProjectTemplate", "ProjectTemplateCostItem"
]