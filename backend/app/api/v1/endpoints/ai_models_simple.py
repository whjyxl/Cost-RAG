"""
临时AI模型配置端点 - 专门用于API密钥保存
"""
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import logging

from app.db.session import get_async_session
from app.api.deps import get_current_user
from app.models.user import User
from app.crud import system_setting

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic 模型定义
class AIModelConfig(BaseModel):
    provider: str
    api_key: Optional[str] = None
    enabled: bool = True

class AIModelConfigResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# 支持的AI提供商
SUPPORTED_PROVIDERS = {
    "zhipuai": "智谱AI",
    "moonshot": "月之暗面",
    "qwen": "阿里通义千问",
    "baidu": "百度文心一言",
    "deepseek": "深度求索",
    "yi": "零一万物",
    "spark": "科大讯飞星火"
}

@router.get("/", response_model=Dict[str, Any])
async def get_ai_model_configs(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """获取所有AI模型配置"""
    try:
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="只有管理员可以查看AI配置")

        configs = {}
        for provider_key, provider_name in SUPPORTED_PROVIDERS.items():
            api_key_setting = await system_setting.get_by_key(db, f"{provider_key}_api_key")
            enabled_setting = await system_setting.get_by_key(db, f"{provider_key}_enabled")

            configs[provider_key] = {
                "name": provider_name,
                "api_key": api_key_setting.value if api_key_setting else "",
                "enabled": enabled_setting.value if enabled_setting else True
            }

        return {
            "success": True,
            "data": configs
        }
    except Exception as e:
        logger.error(f"获取AI配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取AI配置失败")

@router.put("/{provider}", response_model=AIModelConfigResponse)
async def update_ai_model_config(
    provider: str,
    config: AIModelConfig,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """更新指定AI提供商的配置"""
    try:
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="只有管理员可以修改AI配置")

        if provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail=f"不支持的AI提供商: {provider}")

        # 保存API密钥
        if config.api_key is not None:
            await system_setting.update_or_create(
                db,
                key=f"{provider}_api_key",
                value=config.api_key,
                description=f"{SUPPORTED_PROVIDERS[provider]} API密钥",
                created_by=current_user.id
            )

        # 保存启用状态
        await system_setting.update_or_create(
            db,
            key=f"{provider}_enabled",
            value=config.enabled,
            description=f"{SUPPORTED_PROVIDERS[provider]} 启用状态",
            created_by=current_user.id
        )

        logger.info(f"用户 {current_user.email} 更新了 {provider} 的AI配置")

        return AIModelConfigResponse(
            success=True,
            message=f"{SUPPORTED_PROVIDERS[provider]}配置更新成功"
        )

    except Exception as e:
        logger.error(f"更新AI配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="更新AI配置失败")

@router.get("/{provider}/status", response_model=Dict[str, Any])
async def get_provider_status(
    provider: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """获取指定AI提供商的状态"""
    try:
        if provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail=f"不支持的AI提供商: {provider}")

        api_key_setting = await system_setting.get_by_key(db, f"{provider}_api_key")
        enabled_setting = await system_setting.get_by_key(db, f"{provider}_enabled")

        api_key = api_key_setting.value if api_key_setting else ""
        enabled = enabled_setting.value if enabled_setting else True

        return {
            "provider": provider,
            "name": SUPPORTED_PROVIDERS[provider],
            "configured": bool(api_key),
            "enabled": enabled,
            "api_key_length": len(api_key) if api_key else 0
        }

    except Exception as e:
        logger.error(f"获取提供商状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取提供商状态失败")

@router.get("/test/crud", response_model=Dict[str, Any])
async def test_crud_operations(
    db: AsyncSession = Depends(get_async_session)
):
    """测试CRUD操作 - 临时端点用于验证功能"""
    try:
        # Test getting all settings
        all_settings = await system_setting.get_all(db)

        # Test getting a specific setting
        zhipu_setting = await system_setting.get_by_key(db, "zhipuai_api_key")

        # Test update operation
        test_result = await system_setting.update_by_key(
            db,
            "test_setting",
            "test_value_12345"
        )

        return {
            "success": True,
            "message": "CRUD操作测试完成",
            "data": {
                "total_settings": len(all_settings),
                "zhipu_key_exists": zhipu_setting is not None,
                "zhipu_key_length": len(zhipu_setting.value) if zhipu_setting else 0,
                "test_update_result": test_result is not None,
                "sample_settings": [
                    {"key": s.key, "value_length": len(s.value) if s.value else 0}
                    for s in all_settings[:5]
                ]
            }
        }

    except Exception as e:
        logger.error(f"CRUD测试失败: {str(e)}")
        return {
            "success": False,
            "message": f"CRUD测试失败: {str(e)}",
            "data": None
        }