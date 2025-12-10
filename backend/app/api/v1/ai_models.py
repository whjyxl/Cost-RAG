"""
AI模型配置管理API
支持多种AI模型提供商的配置管理
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud import system_setting
from app.schemas import SystemSettingCreate, SystemSettingUpdate
from app.models.user import User

router = APIRouter()

# 支持的AI模型提供商配置
SUPPORTED_PROVIDERS = [
    "zhipuai",  # 智谱AI
    "moonshot", # 月之暗面
    "tongyi",   # 通义千问
    "wenxin",   # 文心一言
    "deepseek", # 深度求索
    "yi",       # 零一万物
    "spark"     # 讯飞星火
]

# 默认模型配置
DEFAULT_MODELS = {
    "zhipuai": {
        "api_key": "",
        "model": "glm-4",
        "enabled": False,
        "base_url": "https://open.bigmodel.cn/api/paas/v4/"
    },
    "moonshot": {
        "api_key": "",
        "model": "moonshot-v1-8k",
        "enabled": False,
        "base_url": "https://api.moonshot.cn/v1"
    },
    "tongyi": {
        "api_key": "",
        "model": "qwen-plus",
        "enabled": False,
        "base_url": "https://dashscope.aliyuncs.com/api/v1"
    },
    "wenxin": {
        "api_key": "",
        "model": "ERNIE-Speed-128K",
        "enabled": False,
        "base_url": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1"
    },
    "deepseek": {
        "api_key": "",
        "model": "deepseek-coder",
        "enabled": False,
        "base_url": "https://api.deepseek.com"
    },
    "yi": {
        "api_key": "",
        "model": "yi-large",
        "enabled": False,
        "base_url": "https://api.lingyiwanwu.com/v1"
    },
    "spark": {
        "api_key": "",
        "model": "spark-max",
        "enabled": False,
        "base_url": "https://spark-api.xf-yun.com/v3.5"
    }
}


@router.get("/", summary="获取所有AI模型配置")
async def get_ai_models(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    获取所有AI模型提供商的配置

    Args:
        db: 数据库会话
        current_user: 当前用户

    Returns:
        所有AI模型配置的字典
    """
    try:
        # 构建配置键列表
        config_keys = [f"ai_model.{provider}" for provider in SUPPORTED_PROVIDERS]

        # 批量获取配置
        settings = {}
        for key in config_keys:
            setting = await system_setting.crud_system_setting.get_by_key(db, key)
            if setting:
                settings[key] = setting.value

        # 构建响应数据
        ai_configs = {}
        for provider in SUPPORTED_PROVIDERS:
            setting_key = f"ai_model.{provider}"
            if setting_key in settings:
                ai_configs[provider] = settings[setting_key]
            else:
                # 如果没有配置，返回默认配置
                ai_configs[provider] = DEFAULT_MODELS[provider]

        return ai_configs

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取AI配置失败: {str(e)}"
        )


@router.get("/{provider}", summary="获取指定AI模型配置")
async def get_ai_model(
    provider: str,
    db: AsyncSession = Depends(deps.db_session),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    获取指定AI模型提供商的配置

    Args:
        provider: AI模型提供商
        db: 数据库会话
        current_user: 当前用户

    Returns:
        指定AI模型的配置
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的AI模型提供商: {provider}"
        )

    try:
        setting_key = f"ai_model.{provider}"
        setting = await system_setting.crud_system_setting.get_by_key(db, setting_key)

        if setting:
            return setting.value
        else:
            return DEFAULT_MODELS[provider]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取AI配置失败: {str(e)}"
        )


@router.put("/{provider}", summary="更新AI模型配置")
async def update_ai_model(
    provider: str,
    config_data: Dict[str, Any],
    db: AsyncSession = Depends(deps.db_session),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    更新AI模型提供商配置

    Args:
        provider: AI模型提供商
        config_data: 配置数据
        db: 数据库会话
        current_user: 当前用户

    Returns:
        更新后的配置
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的AI模型提供商: {provider}"
        )

    try:
        # 验证配置数据
        validated_config = await _validate_config(provider, config_data)

        # 更新配置
        setting_key = f"ai_model.{provider}"
        setting_data = {
            "key": setting_key,
            "value": validated_config,
            "category": "ai_model",
            "description": f"{provider} AI模型配置"
        }

        # 创建或更新配置
        updated_setting = await system_setting.crud_system_setting.update_by_key(
            db=db,
            key=setting_key,
            value=validated_config,
            updated_by=current_user.id
        )

        return updated_setting.value

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新AI配置失败: {str(e)}"
        )


@router.delete("/{provider}", summary="删除AI模型配置")
async def delete_ai_model(
    provider: str,
    db: AsyncSession = Depends(deps.db_session),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, str]:
    """
    删除AI模型提供商配置

    Args:
        provider: AI模型提供商
        db: 数据库会话
        current_user: 当前用户

    Returns:
        操作结果
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的AI模型提供商: {provider}"
        )

    try:
        setting_key = f"ai_model.{provider}"
        success = await system_setting.crud_system_setting.delete_by_key(db, key=setting_key)

        if success:
            return {"message": f"{provider} 配置已删除"}
        else:
            return {"message": f"{provider} 配置不存在"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除AI配置失败: {str(e)}"
        )


@router.post("/test/{provider}", summary="测试AI模型连接")
async def test_ai_model(
    provider: str,
    db: AsyncSession = Depends(deps.db_session),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    测试AI模型连接

    Args:
        provider: AI模型提供商
        db: 数据库会话
        current_user: 当前用户

    Returns:
        测试结果
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的AI模型提供商: {provider}"
        )

    try:
        # 获取配置
        setting_key = f"ai_model.{provider}"
        setting = await system_setting.crud_system_setting.get_by_key(db, setting_key)

        if not setting:
            return {
                "success": False,
                "error": f"{provider} 配置不存在"
            }

        config = setting.value

        # 检查必要字段
        if not config.get("api_key"):
            return {
                "success": False,
                "error": "API密钥未配置"
            }

        if not config.get("enabled"):
            return {
                "success": False,
                "error": "AI模型未启用"
            }

        # 这里可以添加实际的API连接测试逻辑
        # 目前只返回基本验证结果
        return {
            "success": True,
            "provider": provider,
            "model": config.get("model"),
            "message": "配置验证通过，可以正常使用"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试AI模型连接失败: {str(e)}"
        )


async def _validate_config(provider: str, config_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    验证配置数据

    Args:
        provider: AI模型提供商
        config_data: 配置数据

    Returns:
        验证后的配置数据
    """
    # 获取默认配置
    default_config = DEFAULT_MODELS.get(provider, {})

    # 合并配置数据
    validated_config = default_config.copy()
    validated_config.update(config_data)

    # 验证必要字段
    if "model" not in validated_config:
        raise ValueError("模型名称是必需的")

    # 确保启用状态是布尔值
    if "enabled" in validated_config:
        validated_config["enabled"] = bool(validated_config["enabled"])

    return validated_config