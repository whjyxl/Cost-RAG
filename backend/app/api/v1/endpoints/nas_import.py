"""
NAS数据导入API端点
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.nas_data_importer import nas_data_importer
from app.core.nas_config import nas_settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ImportRequest(BaseModel):
    """导入请求模型"""
    profession: str  # 专业类型: door_window, plumbing, hvac等
    data_types: List[str] = None  # 数据类型列表，None表示全部


class ImportResponse(BaseModel):
    """导入响应模型"""
    task_id: str
    message: str
    profession: str


@router.post("/scan-and-import", response_model=ImportResponse)
async def scan_and_import_data(
    request: ImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    扫描NAS目录并导入数据
    
    支持的专业类型:
    - door_window: 门窗工程
    - plumbing: 水电工程
    - hvac: 暖通工程
    - decoration: 装饰装修
    """
    # 验证用户权限（可选：只允许管理员导入）
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    
    # 验证专业类型
    valid_professions = [
        nas_settings.DOOR_WINDOW_DIR,
        nas_settings.PLUMBING_DIR,
        nas_settings.HVAC_DIR,
        nas_settings.DECORATION_DIR
    ]
    
    if request.profession not in valid_professions:
        raise HTTPException(
            status_code=400,
            detail=f"无效的专业类型，支持: {', '.join(valid_professions)}"
        )
    
    # 生成任务ID
    import uuid
    task_id = str(uuid.uuid4())
    
    # 后台任务执行导入
    async def import_task():
        async for db_session in get_db():
            try:
                result = await nas_data_importer.scan_and_import(request.profession, db_session)
                logger.info(f"导入任务完成: {task_id}, 结果: {result}")
            except Exception as e:
                logger.error(f"导入任务失败: {task_id}, 错误: {str(e)}")
            break
    
    background_tasks.add_task(import_task)
    
    return ImportResponse(
        task_id=task_id,
        message=f"开始导入 {request.profession} 专业数据",
        profession=request.profession
    )


@router.get("/import-statistics")
async def get_import_statistics(
    current_user: User = Depends(get_current_user)
):
    """
    获取导入统计信息
    """
    stats = nas_data_importer.get_import_statistics()
    return stats


@router.get("/data-structure")
async def get_data_structure(
    current_user: User = Depends(get_current_user)
):
    """
    获取NAS数据目录结构说明
    """
    return {
        "description": "NAS数据目录结构",
        "root": nas_settings.DATA_ROOT,
        "structure": {
            "professions": [
                {
                    "name": "door_window",
                    "display_name": "门窗工程",
                    "data_types": [
                        {"name": "standards", "display_name": "设计规范", "formats": ["json", "xlsx", "md"]},
                        {"name": "processes", "display_name": "施工工艺", "formats": ["json", "xlsx", "md"]},
                        {"name": "materials", "display_name": "材料数据", "formats": ["json", "xlsx", "csv"]},
                        {"name": "costs", "display_name": "成本数据", "formats": ["json", "xlsx", "csv"]},
                        {"name": "optimizations", "display_name": "优化建议", "formats": ["json", "md"]}
                    ]
                },
                {
                    "name": "plumbing",
                    "display_name": "水电工程",
                    "data_types": "同上"
                },
                {
                    "name": "hvac",
                    "display_name": "暖通工程",
                    "data_types": "同上"
                },
                {
                    "name": "decoration",
                    "display_name": "装饰装修",
                    "data_types": "同上"
                }
            ]
        },
        "example_path": f"{nas_settings.DATA_ROOT}/door_window/standards/GB50033-2013.json",
        "supported_formats": nas_settings.SUPPORTED_FORMATS
    }


@router.get("/file-format-examples")
async def get_file_format_examples(
    current_user: User = Depends(get_current_user)
):
    """
    获取文件格式示例
    """
    return {
        "json_format": {
            "description": "JSON格式（推荐）",
            "example": {
                "nodes": [
                    {
                        "name": "门窗工程",
                        "type": "project",
                        "properties": {
                            "node_subtype": "project_division",
                            "code": "GB50210-2018",
                            "description": "建筑装饰装修工程中的门窗分部工程"
                        },
                        "confidence": 1.0,
                        "source": "standard"
                    }
                ],
                "relations": [
                    {
                        "source": "门窗工程",
                        "target": "建筑门窗设计规范",
                        "type": "related_to",
                        "properties": {
                            "relation_subtype": "follows_standard"
                        },
                        "confidence": 1.0
                    }
                ]
            }
        },
        "excel_format": {
            "description": "Excel格式",
            "sheets": {
                "nodes": {
                    "columns": ["name", "type", "properties_json", "confidence", "source"],
                    "example_row": [
                        "门窗工程",
                        "project",
                        '{"node_subtype": "project_division"}',
                        1.0,
                        "standard"
                    ]
                },
                "relations": {
                    "columns": ["source", "target", "type", "properties_json", "confidence"],
                    "example_row": [
                        "门窗工程",
                        "设计规范",
                        "related_to",
                        '{"relation_subtype": "follows_standard"}',
                        1.0
                    ]
                }
            }
        },
        "csv_format": {
            "description": "CSV格式（仅节点）",
            "columns": ["name", "type", "properties_json", "confidence", "source"],
            "note": "CSV格式只支持节点导入，关系需要单独的JSON或Excel文件"
        },
        "markdown_format": {
            "description": "Markdown格式（文档导入）",
            "note": "Markdown文件会作为文档节点导入，可以后续通过NLP提取实体和关系"
        }
    }


@router.get("/logs")
async def get_import_logs(
    current_user: User = Depends(get_current_user)
):
    """
    获取导入日志
    """
    # 从导入器获取历史记录
    history = nas_data_importer.get_import_statistics()
    
    # 转换为日志格式
    logs = []
    for file_key, record in history.get("import_history", {}).items():
        parts = file_key.split("_")
        logs.append({
            "id": file_key,
            "file_name": parts[-1] if len(parts) > 2 else file_key,
            "profession": parts[0] if len(parts) > 0 else "unknown",
            "data_type": parts[1] if len(parts) > 1 else "unknown",
            "status": "success" if record.get("result", {}).get("nodes_created", 0) > 0 else "failed",
            "nodes_count": record.get("result", {}).get("nodes_created", 0),
            "relations_count": record.get("result", {}).get("relations_created", 0),
            "imported_at": record.get("imported_at", ""),
            "error_message": None
        })
    
    return logs


@router.get("/task-status/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    获取导入任务状态
    """
    # 这里应该从任务队列或数据库中获取任务状态
    # 简化实现，返回模拟数据
    return {
        "task_id": task_id,
        "profession": "door_window",
        "status": "completed",
        "progress": 100,
        "files_processed": 5,
        "nodes_created": 50,
        "relations_created": 80,
        "errors": [],
        "start_time": "2024-12-03T10:00:00",
        "end_time": "2024-12-03T10:05:00"
    }


@router.post("/validate-file")
async def validate_import_file(
    file_path: str,
    current_user: User = Depends(get_current_user)
):
    """
    验证导入文件格式
    """
    from pathlib import Path
    import json
    
    file = Path(file_path)
    
    if not file.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.suffix[1:] not in nas_settings.SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式，支持: {', '.join(nas_settings.SUPPORTED_FORMATS)}"
        )
    
    validation_result = {
        "file_name": file.name,
        "file_size": file.stat().st_size,
        "format": file.suffix[1:],
        "valid": True,
        "errors": []
    }
    
    # JSON格式验证
    if file.suffix == ".json":
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if "nodes" not in data and "relations" not in data:
                validation_result["valid"] = False
                validation_result["errors"].append("JSON文件必须包含 'nodes' 或 'relations' 字段")
            
            if "nodes" in data:
                validation_result["node_count"] = len(data["nodes"])
            
            if "relations" in data:
                validation_result["relation_count"] = len(data["relations"])
                
        except json.JSONDecodeError as e:
            validation_result["valid"] = False
            validation_result["errors"].append(f"JSON格式错误: {str(e)}")
    
    # Excel格式验证
    elif file.suffix in [".xlsx", ".xls"]:
        try:
            import pandas as pd
            excel_file = pd.ExcelFile(file)
            validation_result["sheets"] = excel_file.sheet_names
            
            if "nodes" in excel_file.sheet_names:
                nodes_df = pd.read_excel(file, sheet_name="nodes")
                validation_result["node_count"] = len(nodes_df)
            
            if "relations" in excel_file.sheet_names:
                relations_df = pd.read_excel(file, sheet_name="relations")
                validation_result["relation_count"] = len(relations_df)
                
        except Exception as e:
            validation_result["valid"] = False
            validation_result["errors"].append(f"Excel读取错误: {str(e)}")
    
    return validation_result
