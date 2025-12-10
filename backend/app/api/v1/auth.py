"""
认证相关路由
"""
from datetime import timedelta, datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.api import deps
from app.core import security
from app.core.config import settings
from app.crud import user as user_crud
from app.db.session import get_async_session, get_db
from app.core.logging import app_logger
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(
    *,
    db: AsyncSession = Depends(get_db),
    login_data: schemas.LoginRequest
) -> Any:
    """
    用户登录获取访问令牌
    """
    try:
        user = await user_crud.user.authenticate(
            db, email=login_data.email, password=login_data.password
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif not await user_crud.user.is_active(user):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户账户已被禁用"
            )

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )

        # 生成刷新令牌（如果需要记住登录状态）
        refresh_token = None
        if login_data.remember_me:
            refresh_token_expires = timedelta(days=30)
            refresh_token = security.create_access_token(
                data={"sub": str(user.id), "type": "refresh"},
                expires_delta=refresh_token_expires
            )

        app_logger.info(f"用户登录成功: {user.email}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"登录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录过程中发生错误"
        )


@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: schemas.UserCreate,
) -> Any:
    """
    用户注册
    """
    try:
        # 检查邮箱是否已存在
        user_by_email = await user_crud.user.get_by_email(db, email=user_in.email)
        if user_by_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户邮箱已存在"
            )
        
        # 检查用户名是否已存在
        user_by_username = await user_crud.user.get_by_username(db, username=user_in.username)
        if user_by_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已存在"
            )

        user = await user_crud.user.create(db, obj_in=user_in)
        # 刷新用户以获取生成的ID和其他字段
        await db.refresh(user)
        # 强制提交事务以确保数据持久化
        await db.commit()
        app_logger.info(f"用户注册成功: {user.email}")

        # 转换为schema对象，确保datetime字段被正确序列化
        user_schema = schemas.User.model_validate(user)
        return user_schema
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"注册失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册过程中发生错误"
        )


@router.post("/refresh", response_model=schemas.Token)
async def refresh_token(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    刷新访问令牌
    """
    try:
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            data={"sub": str(current_user.id)}, expires_delta=access_token_expires
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "is_active": current_user.is_active,
                "is_superuser": current_user.is_superuser
            }
        }
    except Exception as e:
        app_logger.error(f"令牌刷新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="令牌刷新失败"
        )


@router.get("/me", response_model=schemas.User)
async def read_users_me(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    获取当前用户信息
    """
    # get_current_user已经返回User模型，直接转换为schema
    # 转换为schema对象，确保datetime字段被正确序列化
    user_schema = schemas.User.model_validate(current_user)
    return user_schema


@router.put("/me", response_model=schemas.User)
async def update_user_me(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: schemas.UserUpdate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    更新当前用户信息
    """
    try:
        user = await user_crud.user.update(db, db_obj=current_user, obj_in=user_in)
        app_logger.info(f"用户信息更新成功: {user.email}")
        return user
    except Exception as e:
        app_logger.error(f"用户信息更新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="用户信息更新失败"
        )


@router.put("/change-password", response_model=schemas.Message)
async def change_password(
    *,
    db: AsyncSession = Depends(get_db),
    password_change: schemas.PasswordChange,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    修改密码
    """
    try:
        # 验证当前密码
        if not security.verify_password(password_change.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )

        # 更新密码
        hashed_password = security.get_password_hash(password_change.new_password)
        current_user.hashed_password = hashed_password
        await db.commit()

        app_logger.info(f"用户修改密码成功: {current_user.email}")

        return schemas.Message(
            message="密码修改成功",
            success=True
        )
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"修改密码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="修改密码失败"
        )


@router.post("/logout", response_model=schemas.Message)
async def logout(
    *,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    用户登出

    注意：由于使用JWT，服务端无需维护会话状态。
    实际的登出由客户端清除token完成。
    此端点主要用于记录登出日志或执行其他清理操作。
    """
    app_logger.info(f"用户登出: {current_user.email}")

    return schemas.Message(
        message="登出成功",
        success=True
    )


@router.post("/password-recovery", response_model=schemas.Message)
async def password_recovery(
    *,
    db: AsyncSession = Depends(get_db),
    recovery_request: schemas.PasswordRecoveryRequest,
) -> Any:
    """
    请求密码重置

    发送密码重置邮件（带重置令牌）。
    注意：为了安全，即使邮箱不存在也返回成功消息。
    """
    try:
        # 查找用户
        user = await user_crud.user.get_by_email(db, email=recovery_request.email)

        if user:
            # 生成重置令牌（有效期15分钟）
            reset_token_expires = timedelta(minutes=15)
            reset_token = security.create_access_token(
                data={"sub": str(user.id), "type": "password_reset"},
                expires_delta=reset_token_expires
            )

            # TODO: 实际应用中应通过邮件服务发送重置令牌
            # await email_service.send_password_reset_email(user.email, reset_token)

            app_logger.info(f"密码重置请求: {user.email}")
            # 开发环境下返回token（生产环境不应返回）
            if settings.DEBUG:
                return schemas.Message(
                    message=f"密码重置邮件已发送。重置令牌（仅开发环境显示）: {reset_token}",
                    success=True
                )

        # 为了安全，即使用户不存在也返回相同消息
        return schemas.Message(
            message="如果该邮箱已注册，您将收到密码重置邮件",
            success=True
        )
    except Exception as e:
        app_logger.error(f"密码重置请求失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置请求失败"
        )


@router.post("/password-reset", response_model=schemas.Message)
async def password_reset(
    *,
    db: AsyncSession = Depends(get_db),
    reset_data: schemas.PasswordReset,
) -> Any:
    """
    执行密码重置

    使用重置令牌重置密码。
    """
    try:
        # 验证并解析token
        payload = security.decode_token(reset_data.token)
        if not payload or payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的重置令牌"
            )

        user_id = int(payload.get("sub"))
        user = await user_crud.user.get(db, id=user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 更新密码
        hashed_password = security.get_password_hash(reset_data.new_password)
        user.hashed_password = hashed_password
        await db.commit()

        app_logger.info(f"密码重置成功: {user.email}")

        return schemas.Message(
            message="密码重置成功",
            success=True
        )
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"密码重置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码重置失败，令牌可能已过期"
        )


@router.post("/verify-email", response_model=schemas.Message)
async def verify_email(
    *,
    db: AsyncSession = Depends(get_db),
    verification: schemas.EmailVerification,
) -> Any:
    """
    验证邮箱

    使用验证令牌激活账户。
    """
    try:
        # 验证并解析token
        payload = security.decode_token(verification.token)
        if not payload or payload.get("type") != "email_verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的验证令牌"
            )

        user_id = int(payload.get("sub"))
        user = await user_crud.user.get(db, id=user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        if user.is_verified:
            return schemas.Message(
                message="邮箱已经验证过了",
                success=True
            )

        # 标记为已验证
        user.is_verified = True
        await db.commit()

        app_logger.info(f"邮箱验证成功: {user.email}")

        return schemas.Message(
            message="邮箱验证成功",
            success=True
        )
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"邮箱验证失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱验证失败，令牌可能已过期"
        )


@router.post("/resend-verification", response_model=schemas.Message)
async def resend_verification(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    重新发送验证邮件
    """
    try:
        if current_user.is_verified:
            return schemas.Message(
                message="邮箱已经验证过了",
                success=True
            )

        # 生成验证令牌（有效期24小时）
        verification_token_expires = timedelta(hours=24)
        verification_token = security.create_access_token(
            data={"sub": str(current_user.id), "type": "email_verification"},
            expires_delta=verification_token_expires
        )

        # TODO: 实际应用中应通过邮件服务发送验证令牌
        # await email_service.send_verification_email(current_user.email, verification_token)

        app_logger.info(f"重发验证邮件: {current_user.email}")

        # 开发环境下返回token（生产环境不应返回）
        if settings.DEBUG:
            return schemas.Message(
                message=f"验证邮件已发送。验证令牌（仅开发环境显示）: {verification_token}",
                success=True
            )

        return schemas.Message(
            message="验证邮件已发送",
            success=True
        )
    except Exception as e:
        app_logger.error(f"重发验证邮件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重发验证邮件失败"
        )