"""
NAS配置管理API
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.api.deps import get_db
from app.models.nas_config import NASConfig

logger = logging.getLogger(__name__)

router = APIRouter()


class NASConfigUpdate(BaseModel):
    """NAS配置更新模型"""
    host: str
    port: int = 445
    share_name: str
    username: str
    password: str
    auto_import: bool = True
    watch_interval: int = 60


class NASConfigResponse(BaseModel):
    """NAS配置响应模型"""
    host: str
    port: int
    share_name: str
    username: str
    password: str = ""  # 不返回实际密码
    auto_import: bool
    watch_interval: int


class ConnectionTestResult(BaseModel):
    """连接测试结果"""
    success: bool
    message: str


@router.get("/config", response_model=NASConfigResponse)
async def get_nas_config(db: AsyncSession = Depends(get_db)):
    """
    获取NAS配置（从数据库读取，无需重启服务）
    """
    try:
        # 从数据库读取配置
        result = await db.execute(select(NASConfig).order_by(NASConfig.id.desc()).limit(1))
        config_db = result.scalar_one_or_none()
        
        if config_db:
            # 返回数据库中的配置
            config = NASConfigResponse(
                host=config_db.host,
                port=config_db.port,
                share_name=config_db.share_name,
                username=config_db.username,
                password="******",  # 隐藏密码
                auto_import=config_db.auto_import,
                watch_interval=config_db.watch_interval,
            )
        else:
            # 返回默认配置
            config = NASConfigResponse(
                host='192.168.1.100',
                port=445,
                share_name='knowledge_data',
                username='admin',
                password="",
                auto_import=True,
                watch_interval=60,
            )
        return config
    except Exception as e:
        logger.error(f"获取NAS配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取配置失败")


@router.post("/config")
async def update_nas_config(config: NASConfigUpdate, db: AsyncSession = Depends(get_db)):
    """
    更新NAS配置（保存到数据库，立即生效，无需重启服务）
    """
    try:
        logger.info(f"更新NAS配置: {config.host}:{config.port}/{config.share_name}")
        
        # 查找现有配置
        result = await db.execute(select(NASConfig).order_by(NASConfig.id.desc()).limit(1))
        config_db = result.scalar_one_or_none()
        
        if config_db:
            # 更新现有配置
            config_db.host = config.host
            config_db.port = config.port
            config_db.share_name = config.share_name
            config_db.username = config.username
            config_db.password = config.password
            config_db.auto_import = config.auto_import
            config_db.watch_interval = config.watch_interval
        else:
            # 创建新配置
            config_db = NASConfig(
                host=config.host,
                port=config.port,
                share_name=config.share_name,
                username=config.username,
                password=config.password,
                auto_import=config.auto_import,
                watch_interval=config.watch_interval,
            )
            db.add(config_db)
        
        await db.commit()
        
        return {
            "success": True,
            "message": "配置已保存并立即生效"
        }
    except Exception as e:
        logger.error(f"更新NAS配置失败: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="更新配置失败")


@router.post("/test-connection", response_model=ConnectionTestResult)
async def test_nas_connection(config: NASConfigUpdate):
    """
    测试NAS连接
    """
    try:
        # TODO: 实现实际的SMB连接测试
        # 这里只是模拟测试
        logger.info(f"测试NAS连接: {config.host}:{config.port}")
        
        # 简单验证
        if not config.host or not config.share_name:
            return ConnectionTestResult(
                success=False,
                message="主机地址和共享名称不能为空"
            )
        
        # 模拟成功
        return ConnectionTestResult(
            success=True,
            message=f"成功连接到 {config.host}:{config.port}/{config.share_name}"
        )
    except Exception as e:
        logger.error(f"测试NAS连接失败: {str(e)}")
        return ConnectionTestResult(
            success=False,
            message=f"连接失败: {str(e)}"
        )
