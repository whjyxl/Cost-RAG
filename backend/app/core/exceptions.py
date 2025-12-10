"""
自定义异常类和异常处理器
"""
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from typing import Union
import logging

logger = logging.getLogger(__name__)


class CostRAGException(Exception):
    """Cost-RAG系统基础异常类"""

    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class ValidationError(CostRAGException):
    """数据验证异常"""
    pass


class AuthenticationError(CostRAGException):
    """认证异常"""
    pass


class AuthorizationError(CostRAGException):
    """授权异常"""
    pass


class DatabaseError(CostRAGException):
    """数据库异常"""
    pass


class AIServiceError(CostRAGException):
    """AI服务异常"""
    pass


class DocumentProcessingError(CostRAGException):
    """文档处理异常"""
    pass


class KnowledgeGraphError(CostRAGException):
    """知识图谱异常"""
    pass


async def costrag_exception_handler(request: Request, exc: CostRAGException):
    """Cost-RAG自定义异常处理器"""
    logger.error(f"Cost-RAG异常: {exc.message}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": exc.message,
            "error_code": exc.error_code,
            "type": type(exc).__name__
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """请求验证异常处理器"""
    logger.error(f"请求验证异常: {exc.errors()}")

    # Convert errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {}
        for key, value in error.items():
            # Convert non-serializable objects to strings
            if key == 'ctx' and value and 'error' in value:
                # Convert ValueError or other exceptions to strings
                error_dict[key] = {k: str(v) for k, v in value.items()}
            else:
                error_dict[key] = value
        errors.append(error_dict)

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": "请求参数验证失败",
            "details": errors,
            "type": "RequestValidationError"
        }
    )


async def http_exception_handler(request: Request, exc: Union[HTTPException, StarletteHTTPException]):
    """HTTP异常处理器"""
    logger.warning(f"HTTP异常: {exc.status_code} - {exc.detail}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP Error",
            "message": str(exc.detail),
            "status_code": exc.status_code,
            "type": "HTTPException"
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """通用异常处理器"""
    logger.error(f"未处理的异常: {type(exc).__name__}: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "服务器内部错误，请稍后重试",
            "type": type(exc).__name__
        }
    )


def setup_exception_handlers(app):
    """设置异常处理器"""
    from fastapi import FastAPI

    app.add_exception_handler(CostRAGException, costrag_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)