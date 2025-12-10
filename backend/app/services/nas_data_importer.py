"""
NAS数据导入服务

支持从群晖NAS自动导入知识图谱数据
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

from app.core.nas_config import nas_settings
from app.services.knowledge_graph_service import knowledge_graph_service
from app.schemas.knowledge import EntityCreate, RelationCreate
from app.schemas.construction_types import get_node_base_type, get_relation_base_type
from app.db.session import get_db

logger = logging.getLogger(__name__)


class NASDataImporter:
    """NAS数据导入器"""
    
    def __init__(self):
        self.import_history = {}  # 记录已导入的文件
        self.error_log = []  # 错误日志
        
    def get_data_path(self, profession: str, data_type: str) -> Path:
        """
        获取数据文件路径
        
        Args:
            profession: 专业类型（door_window, plumbing等）
            data_type: 数据类型（standards, processes等）
        
        Returns:
            完整路径
        """
        if os.name == 'nt':  # Windows
            base_path = Path(nas_settings.NAS_MOUNT_POINT_WIN)
        else:  # Linux
            base_path = Path(nas_settings.NAS_MOUNT_POINT)
        
        return base_path / profession / data_type
    
    async def scan_and_import(self, profession: str, db: AsyncSession) -> Dict[str, Any]:
        """
        扫描并导入指定专业的所有数据
        
        Args:
            profession: 专业类型
            db: 数据库会话
        
        Returns:
            导入统计信息
        """
        stats = {
            "profession": profession,
            "start_time": datetime.now().isoformat(),
            "files_processed": 0,
            "nodes_created": 0,
            "relations_created": 0,
            "errors": []
        }
        
        logger.info(f"开始扫描 {profession} 专业数据...")
        
        # 扫描各类数据目录
        data_types = [
            nas_settings.STANDARDS_DIR,
            nas_settings.PROCESSES_DIR,
            nas_settings.MATERIALS_DIR,
            nas_settings.COSTS_DIR,
            nas_settings.OPTIMIZATIONS_DIR
        ]
        
        for data_type in data_types:
            try:
                result = await self.import_data_type(profession, data_type, db)
                stats["files_processed"] += result["files_processed"]
                stats["nodes_created"] += result["nodes_created"]
                stats["relations_created"] += result["relations_created"]
            except Exception as e:
                error_msg = f"导入 {data_type} 数据失败: {str(e)}"
                logger.error(error_msg)
                stats["errors"].append(error_msg)
        
        stats["end_time"] = datetime.now().isoformat()
        logger.info(f"完成 {profession} 专业数据导入: {stats}")
        
        return stats
    
    async def import_data_type(
        self,
        profession: str,
        data_type: str,
        db: AsyncSession
    ) -> Dict[str, int]:
        """
        导入指定类型的数据
        
        Args:
            profession: 专业类型
            data_type: 数据类型
            db: 数据库会话
        
        Returns:
            导入统计
        """
        stats = {"files_processed": 0, "nodes_created": 0, "relations_created": 0}
        
        data_path = self.get_data_path(profession, data_type)
        
        if not data_path.exists():
            logger.warning(f"数据目录不存在: {data_path}")
            return stats
        
        # 遍历目录中的所有文件
        for file_path in data_path.glob("*"):
            if file_path.suffix[1:] not in nas_settings.SUPPORTED_FORMATS:
                continue
            
            # 检查是否已导入
            file_key = f"{profession}_{data_type}_{file_path.name}"
            if file_key in self.import_history:
                continue
            
            try:
                result = await self.import_file(file_path, profession, data_type, db)
                stats["files_processed"] += 1
                stats["nodes_created"] += result["nodes_created"]
                stats["relations_created"] += result["relations_created"]
                
                # 记录导入历史
                self.import_history[file_key] = {
                    "imported_at": datetime.now().isoformat(),
                    "result": result
                }
                
                logger.info(f"成功导入文件: {file_path.name}")
                
            except Exception as e:
                error_msg = f"导入文件 {file_path.name} 失败: {str(e)}"
                logger.error(error_msg)
                self.error_log.append({
                    "file": str(file_path),
                    "error": error_msg,
                    "timestamp": datetime.now().isoformat()
                })
        
        return stats
    
    async def import_file(
        self,
        file_path: Path,
        profession: str,
        data_type: str,
        db: AsyncSession
    ) -> Dict[str, int]:
        """
        导入单个文件
        
        Args:
            file_path: 文件路径
            profession: 专业类型
            data_type: 数据类型
            db: 数据库会话
        
        Returns:
            导入统计
        """
        file_ext = file_path.suffix[1:].lower()
        
        if file_ext == "json":
            return await self.import_json_file(file_path, db)
        elif file_ext in ["xlsx", "csv"]:
            return await self.import_excel_file(file_path, db)
        elif file_ext in ["md", "txt"]:
            return await self.import_text_file(file_path, profession, data_type, db)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")
    
    async def import_json_file(self, file_path: Path, db: AsyncSession) -> Dict[str, int]:
        """
        导入JSON格式数据
        
        JSON格式示例:
        {
            "nodes": [
                {
                    "name": "门窗工程",
                    "type": "project",
                    "properties": {...},
                    "confidence": 1.0
                }
            ],
            "relations": [
                {
                    "source": "门窗工程",
                    "target": "设计规范",
                    "type": "related_to",
                    "properties": {...}
                }
            ]
        }
        """
        stats = {"nodes_created": 0, "relations_created": 0}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        node_map = {}  # 节点名称到ID的映射
        
        # 导入节点
        if "nodes" in data:
            for node_data in data["nodes"]:
                try:
                    entity = EntityCreate(**node_data)
                    node = await knowledge_graph_service.create_knowledge_node(
                        entity_data=entity,
                        user_id=1,  # 系统用户
                        db=db
                    )
                    node_map[node_data["name"]] = node.id
                    stats["nodes_created"] += 1
                except Exception as e:
                    logger.error(f"创建节点失败: {node_data.get('name')}, 错误: {str(e)}")
        
        # 导入关系
        if "relations" in data:
            for rel_data in data["relations"]:
                try:
                    source_id = node_map.get(rel_data["source"])
                    target_id = node_map.get(rel_data["target"])
                    
                    if not source_id or not target_id:
                        logger.warning(f"关系节点未找到: {rel_data['source']} -> {rel_data['target']}")
                        continue
                    
                    relation = RelationCreate(
                        source_node_id=source_id,
                        target_node_id=target_id,
                        type=rel_data["type"],
                        properties=rel_data.get("properties", {}),
                        confidence=rel_data.get("confidence", 0.9),
                        source=rel_data.get("source", "nas_import")
                    )
                    
                    await knowledge_graph_service.create_knowledge_relation(
                        relation_data=relation,
                        user_id=1,
                        db=db
                    )
                    stats["relations_created"] += 1
                    
                except Exception as e:
                    logger.error(f"创建关系失败: {rel_data}, 错误: {str(e)}")
        
        return stats
    
    async def import_excel_file(self, file_path: Path, db: AsyncSession) -> Dict[str, int]:
        """
        导入Excel/CSV格式数据
        
        Excel格式要求:
        - Sheet1: nodes (列: name, type, properties_json, confidence)
        - Sheet2: relations (列: source, target, type, properties_json, confidence)
        """
        stats = {"nodes_created": 0, "relations_created": 0}
        
        # 读取节点数据
        try:
            if file_path.suffix == ".csv":
                nodes_df = pd.read_csv(file_path)
            else:
                nodes_df = pd.read_excel(file_path, sheet_name="nodes")
            
            node_map = {}
            
            for _, row in nodes_df.iterrows():
                try:
                    properties = json.loads(row.get("properties_json", "{}"))
                    
                    entity = EntityCreate(
                        name=row["name"],
                        type=row["type"],
                        properties=properties,
                        confidence=row.get("confidence", 0.9),
                        source="nas_import"
                    )
                    
                    node = await knowledge_graph_service.create_knowledge_node(
                        entity_data=entity,
                        user_id=1,
                        db=db
                    )
                    node_map[row["name"]] = node.id
                    stats["nodes_created"] += 1
                    
                except Exception as e:
                    logger.error(f"创建节点失败: {row.get('name')}, 错误: {str(e)}")
        
        except Exception as e:
            logger.error(f"读取节点数据失败: {str(e)}")
        
        # 读取关系数据
        try:
            if file_path.suffix == ".csv":
                # CSV文件只包含节点，关系需要单独文件
                return stats
            
            relations_df = pd.read_excel(file_path, sheet_name="relations")
            
            for _, row in relations_df.iterrows():
                try:
                    source_id = node_map.get(row["source"])
                    target_id = node_map.get(row["target"])
                    
                    if not source_id or not target_id:
                        continue
                    
                    properties = json.loads(row.get("properties_json", "{}"))
                    
                    relation = RelationCreate(
                        source_node_id=source_id,
                        target_node_id=target_id,
                        type=row["type"],
                        properties=properties,
                        confidence=row.get("confidence", 0.9),
                        source="nas_import"
                    )
                    
                    await knowledge_graph_service.create_knowledge_relation(
                        relation_data=relation,
                        user_id=1,
                        db=db
                    )
                    stats["relations_created"] += 1
                    
                except Exception as e:
                    logger.error(f"创建关系失败: {str(e)}")
        
        except Exception as e:
            logger.error(f"读取关系数据失败: {str(e)}")
        
        return stats
    
    async def import_text_file(
        self,
        file_path: Path,
        profession: str,
        data_type: str,
        db: AsyncSession
    ) -> Dict[str, int]:
        """
        导入文本/Markdown文件
        
        将文本内容作为文档节点导入，并提取实体和关系
        """
        stats = {"nodes_created": 0, "relations_created": 0}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 创建文档节点
        try:
            entity = EntityCreate(
                name=file_path.stem,
                type="document",
                properties={
                    "content": content,
                    "file_name": file_path.name,
                    "profession": profession,
                    "data_type": data_type,
                    "imported_from": "nas"
                },
                confidence=0.8,
                source="nas_import"
            )
            
            await knowledge_graph_service.create_knowledge_node(
                entity_data=entity,
                user_id=1,
                db=db
            )
            stats["nodes_created"] += 1
            
            # TODO: 可以调用NLP服务提取实体和关系
            
        except Exception as e:
            logger.error(f"导入文本文件失败: {str(e)}")
        
        return stats
    
    def get_import_statistics(self) -> Dict[str, Any]:
        """获取导入统计信息"""
        return {
            "total_files_imported": len(self.import_history),
            "total_errors": len(self.error_log),
            "import_history": self.import_history,
            "recent_errors": self.error_log[-10:]  # 最近10条错误
        }


class NASFileWatcher(FileSystemEventHandler):
    """NAS文件监控器"""
    
    def __init__(self, importer: NASDataImporter):
        self.importer = importer
        self.pending_imports = []
    
    def on_created(self, event: FileCreatedEvent):
        """文件创建事件"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        if file_path.suffix[1:] in nas_settings.SUPPORTED_FORMATS:
            logger.info(f"检测到新文件: {file_path}")
            self.pending_imports.append(file_path)
    
    async def process_pending_imports(self, db: AsyncSession):
        """处理待导入文件"""
        while self.pending_imports:
            file_path = self.pending_imports.pop(0)
            
            try:
                # 解析文件路径获取专业和数据类型
                parts = file_path.parts
                profession = parts[-3] if len(parts) >= 3 else "unknown"
                data_type = parts[-2] if len(parts) >= 2 else "unknown"
                
                await self.importer.import_file(file_path, profession, data_type, db)
                logger.info(f"自动导入文件成功: {file_path}")
                
            except Exception as e:
                logger.error(f"自动导入文件失败: {file_path}, 错误: {str(e)}")


# 全局导入器实例
nas_data_importer = NASDataImporter()
