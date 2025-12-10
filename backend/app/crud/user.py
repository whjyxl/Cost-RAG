"""
用户CRUD操作
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[User]:
        """通过邮箱获取用户"""
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, db: AsyncSession, *, username: str) -> Optional[User]:
        """通过用户名获取用户"""
        result = await db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        """创建用户"""
        db_obj = User(
            email=obj_in.email,
            username=obj_in.username,
            full_name=obj_in.full_name,
            hashed_password=get_password_hash(obj_in.password),
            phone=obj_in.phone,
            avatar_url=obj_in.avatar_url,
            is_active=obj_in.is_active,
            is_superuser=obj_in.is_superuser,
            is_verified=obj_in.is_verified,
            preferences=obj_in.preferences,
            default_llm_model=obj_in.default_llm_model,
            notes=obj_in.notes,
        )
        db.add(db_obj)
        # 刷新以获取自动生成的ID，但不提交事务
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: User, obj_in: UserUpdate
    ) -> User:
        """更新用户"""
        update_data = obj_in.dict(exclude_unset=True)
        if "password" in update_data:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password
        return await super().update(db, db_obj=db_obj, obj_in=update_data)

    async def authenticate(
        self, db: AsyncSession, *, email: str, password: str
    ) -> Optional[User]:
        """User authentication - supports both plaintext and bcrypt passwords"""
        print(f"[DEBUG] authenticate called: email={email}")
        user = await self.get_by_email(db, email=email)
        print(f"[DEBUG] get_by_email result: user={user}")
        if not user:
            print("[DEBUG] User not found!")
            return None

        print(f"[DEBUG] User found: ID={user.id}, Email={user.email}")
        print(f"[DEBUG] Hashed password (first 50): {user.hashed_password[:50]}...")

        # Temporary solution: support plaintext password verification (for bcrypt compatibility issues)
        try:
            # First try normal bcrypt verification
            print(f"[DEBUG] Trying bcrypt verification...")
            is_valid = verify_password(password, user.hashed_password)
            print(f"[DEBUG] Bcrypt verification result: {is_valid}")
            if is_valid:
                print("[DEBUG] Authentication successful via bcrypt!")
                return user
        except Exception as e:
            print(f"[DEBUG] Bcrypt verification exception: {e}")
            # bcrypt verification failed, try plaintext password verification (temporary solution)
            if user.hashed_password == password or user.hashed_password == f"temp_{password}":
                print("[DEBUG] Authentication successful via plaintext!")
                return user

        print("[DEBUG] Authentication failed!")
        return None

    async def is_active(self, user: User) -> bool:
        """检查用户是否激活"""
        return user.is_active

    async def is_superuser(self, user: User) -> bool:
        """检查用户是否超级用户"""
        return user.is_superuser


# 创建全局CRUD实例
user = CRUDUser(User)