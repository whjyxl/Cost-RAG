"""
用户管理API路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    UserProfileResponse,
    UserProfileUpdate,
    UserPreferencesUpdate,
    PasswordChange,
    Message
)
from passlib.context import CryptContext

router = APIRouter()

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    """
    获取当前登录用户
    临时实现：返回ID为1的用户，后续需要实现JWT认证
    """
    result = await db.execute(select(User).where(User.id == 1))
    user = result.scalar_one_or_none()
    
    if not user:
        # 如果不存在，创建一个默认用户
        user = User(
            username="zhang_engineer",
            email="zhang.engineer@cost-rag.com",
            full_name="张工程师",
            hashed_password=get_password_hash("password123"),
            phone="+86 138 0013 8000",
            is_active=True,
            preferences={
                "title": "高级造价工程师",
                "department": "工程造价部",
                "company": "Cost-RAG科技有限公司",
                "bio": "拥有10年工程造价经验，专注于住宅建筑和商业项目的成本估算与管理。",
                "location": "北京市朝阳区",
                "timezone": "Asia/Shanghai",
                "language": "zh-CN",
                "theme": "light",
                "email_notifications": True,
                "push_notifications": True,
                "weekly_report": True,
                "auto_save": True,
                "two_factor_auth": False
            }
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    return user


@router.get("/profile", response_model=UserProfileResponse, summary="获取个人资料")
async def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户的个人资料
    """
    # 从preferences中提取扩展字段
    prefs = current_user.preferences or {}
    
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        phone=current_user.phone,
        full_name=current_user.full_name,
        title=prefs.get("title"),
        department=prefs.get("department"),
        company=prefs.get("company"),
        avatar_url=current_user.avatar_url,
        bio=prefs.get("bio"),
        location=prefs.get("location"),
        timezone=prefs.get("timezone", "Asia/Shanghai"),
        language=prefs.get("language", "zh-CN"),
        theme=prefs.get("theme", "light"),
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
        login_count=current_user.login_count or 0,
        preferences=current_user.preferences
    )


@router.put("/profile", response_model=UserProfileResponse, summary="更新个人资料")
async def update_user_profile(
    profile_update: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新当前用户的个人资料
    """
    # 更新基本字段
    update_data = {}
    if profile_update.full_name is not None:
        update_data["full_name"] = profile_update.full_name
    if profile_update.email is not None:
        # 检查邮箱是否已被其他用户使用
        result = await db.execute(
            select(User).where(User.email == profile_update.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被使用"
            )
        update_data["email"] = profile_update.email
    if profile_update.phone is not None:
        update_data["phone"] = profile_update.phone
    if profile_update.avatar_url is not None:
        update_data["avatar_url"] = profile_update.avatar_url
    
    # 更新preferences中的扩展字段
    prefs = current_user.preferences or {}
    if profile_update.title is not None:
        prefs["title"] = profile_update.title
    if profile_update.department is not None:
        prefs["department"] = profile_update.department
    if profile_update.company is not None:
        prefs["company"] = profile_update.company
    if profile_update.location is not None:
        prefs["location"] = profile_update.location
    if profile_update.bio is not None:
        prefs["bio"] = profile_update.bio
    if profile_update.timezone is not None:
        prefs["timezone"] = profile_update.timezone
    if profile_update.language is not None:
        prefs["language"] = profile_update.language
    if profile_update.theme is not None:
        prefs["theme"] = profile_update.theme
    
    update_data["preferences"] = prefs
    
    # 执行更新
    if update_data:
        await db.execute(
            update(User).where(User.id == current_user.id).values(**update_data)
        )
        await db.commit()
        
        # 重新查询用户
        result = await db.execute(select(User).where(User.id == current_user.id))
        updated_user = result.scalar_one()
        
        return UserProfileResponse(
            id=updated_user.id,
            username=updated_user.username,
            email=updated_user.email,
            phone=updated_user.phone,
            full_name=updated_user.full_name,
            title=prefs.get("title"),
            department=prefs.get("department"),
            company=prefs.get("company"),
            avatar_url=updated_user.avatar_url,
            bio=prefs.get("bio"),
            location=prefs.get("location"),
            timezone=prefs.get("timezone", "Asia/Shanghai"),
            language=prefs.get("language", "zh-CN"),
            theme=prefs.get("theme", "light"),
            created_at=updated_user.created_at,
            last_login_at=updated_user.last_login_at,
            login_count=updated_user.login_count or 0,
            preferences=updated_user.preferences
        )
    
    # 如果没有更新，返回当前用户信息
    return await get_user_profile(current_user)


@router.put("/preferences", response_model=Message, summary="更新用户偏好设置")
async def update_user_preferences(
    preferences_update: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    更新当前用户的偏好设置
    """
    prefs = current_user.preferences or {}
    
    # 更新偏好设置
    if preferences_update.email_notifications is not None:
        prefs["email_notifications"] = preferences_update.email_notifications
    if preferences_update.push_notifications is not None:
        prefs["push_notifications"] = preferences_update.push_notifications
    if preferences_update.weekly_report is not None:
        prefs["weekly_report"] = preferences_update.weekly_report
    if preferences_update.auto_save is not None:
        prefs["auto_save"] = preferences_update.auto_save
    if preferences_update.two_factor_auth is not None:
        prefs["two_factor_auth"] = preferences_update.two_factor_auth
    if preferences_update.theme is not None:
        prefs["theme"] = preferences_update.theme
    if preferences_update.language is not None:
        prefs["language"] = preferences_update.language
    if preferences_update.timezone is not None:
        prefs["timezone"] = preferences_update.timezone
    
    # 执行更新
    await db.execute(
        update(User).where(User.id == current_user.id).values(preferences=prefs)
    )
    await db.commit()
    
    return Message(message="偏好设置已更新", success=True)


@router.post("/change-password", response_model=Message, summary="修改密码")
async def change_password(
    password_change: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    修改当前用户的密码
    """
    # 验证当前密码
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前密码不正确"
        )
    
    # 更新密码
    new_hashed_password = get_password_hash(password_change.new_password)
    await db.execute(
        update(User).where(User.id == current_user.id).values(hashed_password=new_hashed_password)
    )
    await db.commit()
    
    return Message(message="密码修改成功", success=True)
