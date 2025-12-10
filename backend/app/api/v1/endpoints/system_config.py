"""
系统配置API端点
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
import json

from app.api.deps import get_current_user, get_db
from app.models.system_config import SystemConfig
from app.models.user import User

router = APIRouter()


@router.get("/embedding")
async def get_embedding_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取Embedding配置"""
    try:
        # 查询embedding相关配置
        result = await db.execute(
            select(SystemConfig).where(
                SystemConfig.category == "embedding",
                SystemConfig.is_active == True
            )
        )
        configs = result.scalars().all()
        
        # 转换为字典
        config_dict = {}
        for config in configs:
            key = config.config_key.replace("embedding_", "")
            if config.config_type == "json":
                config_dict[key] = json.loads(config.config_value) if config.config_value else {}
            elif config.config_type == "int":
                config_dict[key] = int(config.config_value) if config.config_value else 0
            elif config.config_type == "bool":
                config_dict[key] = config.config_value.lower() == "true" if config.config_value else False
            else:
                config_dict[key] = config.config_value or ""
        
        return {
            "success": True,
            "data": config_dict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.put("/embedding")
async def update_embedding_config(
    config_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新Embedding配置"""
    try:
        updated_fields = []
        
        # 定义配置映射
        config_mapping = {
            "provider": ("embedding_provider", "string", "Embedding提供商"),
            "model": ("embedding_model", "string", "Embedding模型"),
            "api_key": ("embedding_api_key", "string", "Embedding API密钥"),
            "config": ("embedding_config", "json", "Embedding详细配置")
        }
        
        for key, (db_key, config_type, description) in config_mapping.items():
            if key in config_data:
                value = config_data[key]
                
                # 转换值为字符串
                if config_type == "json":
                    value_str = json.dumps(value, ensure_ascii=False)
                else:
                    value_str = str(value)
                
                # 查询是否存在
                result = await db.execute(
                    select(SystemConfig).where(SystemConfig.config_key == db_key)
                )
                existing_config = result.scalar_one_or_none()
                
                if existing_config:
                    # 更新
                    existing_config.config_value = value_str
                    existing_config.config_type = config_type
                else:
                    # 创建
                    new_config = SystemConfig(
                        config_key=db_key,
                        config_value=value_str,
                        config_type=config_type,
                        description=description,
                        category="embedding",
                        is_active=True
                    )
                    db.add(new_config)
                
                updated_fields.append(key)
        
        await db.commit()
        
        return {
            "success": True,
            "message": f"成功更新 {len(updated_fields)} 个配置项",
            "updated_fields": updated_fields
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"保存配置失败: {str(e)}")


@router.get("/all")
async def get_all_system_configs(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取所有系统配置"""
    try:
        query = select(SystemConfig).where(SystemConfig.is_active == True)
        if category:
            query = query.where(SystemConfig.category == category)
        
        result = await db.execute(query)
        configs = result.scalars().all()
        
        config_dict = {}
        for config in configs:
            if config.config_type == "json":
                config_dict[config.config_key] = json.loads(config.config_value) if config.config_value else {}
            elif config.config_type == "int":
                config_dict[config.config_key] = int(config.config_value) if config.config_value else 0
            elif config.config_type == "bool":
                config_dict[config.config_key] = config.config_value.lower() == "true" if config.config_value else False
            else:
                config_dict[config.config_key] = config.config_value or ""
        
        return {
            "success": True,
            "data": config_dict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")
