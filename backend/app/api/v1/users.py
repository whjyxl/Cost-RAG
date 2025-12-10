"""
用户管理路由
"""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.api import deps
from app.crud import user as user_crud
from app.db.session import get_async_session
from app.core.logging import app_logger

router = APIRouter()


@router.get("/", response_model=List[schemas.User])
async def read_users(
    db: AsyncSession = Depends(get_async_session),
    skip: int = 0,
    limit: int = 100,
    current_user: schemas.User = Depends(deps.get_current_superuser),
) -> Any:
    """
    获取用户列表（仅超级管理员）
    """
    try:
        users = await user_crud.get_multi(db, skip=skip, limit=limit)
        return users
    except Exception as e:
        app_logger.error(f"获取用户列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取用户列表失败"
        )


@router.post("/", response_model=schemas.User)
async def create_user(
    *,
    db: AsyncSession = Depends(get_async_session),
    user_in: schemas.UserCreate,
    current_user: schemas.User = Depends(deps.get_current_superuser),
) -> Any:
    """
    创建新用户（仅超级管理员）
    """
    try:
        user = await user_crud.get_by_email(db, email=user_in.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户邮箱已存在"
            )

        user = await user_crud.create(db, obj_in=user_in)
        app_logger.info(f"管理员创建用户: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"创建用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建用户失败"
        )


@router.get("/{user_id}", response_model=schemas.User)
async def read_user(
    *,
    db: AsyncSession = Depends(get_async_session),
    user_id: int,
    current_user: schemas.User = Depends(deps.get_current_user),
) -> Any:
    """
    获取用户信息
    """
    try:
        user = await user_crud.get(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通用户只能查看自己的信息
        if not current_user.is_superuser and current_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限查看该用户信息"
            )

        return user
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"获取用户信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取用户信息失败"
        )


@router.put("/{user_id}", response_model=schemas.User)
async def update_user(
    *,
    db: AsyncSession = Depends(get_async_session),
    user_id: int,
    user_in: schemas.UserUpdate,
    current_user: schemas.User = Depends(deps.get_current_user),
) -> Any:
    """
    更新用户信息
    """
    try:
        user = await user_crud.get(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 普通用户只能更新自己的信息
        if not current_user.is_superuser and current_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="没有权限修改该用户信息"
            )

        # 普通用户不能修改管理员权限
        if not current_user.is_superuser:
            if user_in.is_superuser is not None:
                user_in.is_superuser = user.is_superuser
            if user_in.is_active is not None and user_in.is_active != user.is_active:
                user_in.is_active = user.is_active

        user = await user_crud.update(db, db_obj=user, obj_in=user_in)
        app_logger.info(f"用户信息更新成功: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"更新用户信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新用户信息失败"
        )


@router.delete("/{user_id}", response_model=schemas.User)
async def delete_user(
    *,
    db: AsyncSession = Depends(get_async_session),
    user_id: int,
    current_user: schemas.User = Depends(deps.get_current_superuser),
) -> Any:
    """
    删除用户（仅超级管理员）
    """
    try:
        user = await user_crud.get(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 不能删除自己
        if current_user.id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能删除自己的账户"
            )

        user = await user_crud.remove(db, id=user_id)
        app_logger.info(f"管理员删除用户: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"删除用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除用户失败"
        )


# TODO: 重新实现用户项目列表功能，需要先创建Project schema
# @router.get("/{user_id}/projects", response_model=List[schemas.Project])
# async def read_user_projects(
#     *,
#     db: AsyncSession = Depends(get_async_session),
#     user_id: int,
#     skip: int = 0,
#     limit: int = 100,
#     current_user: schemas.User = Depends(deps.get_current_user),
# ) -> Any:
#     """
#     获取用户的项目列表
#     """
#     try:
#         # 普通用户只能查看自己的项目
#         if not current_user.is_superuser and current_user.id != user_id:
#             raise HTTPException(
#                 status_code=status.HTTP_403_FORBIDDEN,
#                 detail="没有权限查看该用户的项目"
#             )
#
#         # TODO: 实现获取用户项目的逻辑
#         # 这里需要实现从数据库获取用户关联的项目
#         return []
#     except HTTPException:
#         raise
#     except Exception as e:
#         app_logger.error(f"获取用户项目失败: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="获取用户项目失败"
#         )