"""
日志配置模块
"""
import sys
import logging
from loguru import logger
from app.core.config import settings


def setup_logging():
    """设置应用日志配置"""
    # 移除默认的loguru处理器
    logger.remove()

    # 添加控制台输出
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL
    )

    # 添加文件输出
    logger.add(
        "logs/app.log",
        rotation="1 day",
        retention="30 days",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level=settings.LOG_LEVEL,
        encoding="utf-8"
    )

    # 添加错误日志文件
    logger.add(
        "logs/error.log",
        rotation="1 day",
        retention="30 days",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        encoding="utf-8"
    )

    return logger


# 创建应用日志实例
app_logger = setup_logging()