"""
系统设置CRUD操作
"""
from typing import Any, Dict, List, Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.system_setting import SystemSetting


class CRUDSystemSetting:
    """系统设置CRUD操作"""

    async def get_by_key(self, db: AsyncSession, key: str) -> Optional[SystemSetting]:
        """通过键获取设置"""
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key == key)
        )
        return result.scalar_one_or_none()

    async def get_all(self, db: AsyncSession) -> List[SystemSetting]:
        """获取所有设置"""
        result = await db.execute(
            select(SystemSetting).order_by(SystemSetting.key)
        )
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        description: Optional[str] = None,
        created_by: Optional[int] = None
    ) -> SystemSetting:
        """创建新设置"""
        setting = SystemSetting(
            key=key,
            value=value,
            description=description
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        return setting

    async def update_or_create(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        description: Optional[str] = None,
        created_by: Optional[int] = None
    ) -> SystemSetting:
        """更新或创建设置（如果不存在则创建）"""
        setting = await self.get_by_key(db, key)
        if setting:
            setting.value = value
            if description is not None:
                setting.description = description
        else:
            setting = SystemSetting(
                key=key,
                value=value,
                description=description
            )
            db.add(setting)

        await db.commit()
        await db.refresh(setting)
        return setting

    async def update_by_key(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        updated_by: Optional[int] = None
    ) -> Optional[SystemSetting]:
        """通过键更新设置"""
        setting = await self.get_by_key(db, key)
        if not setting:
            return None

        setting.value = value

        await db.commit()
        await db.refresh(setting)
        return setting

    async def delete_by_key(
        self,
        db: AsyncSession,
        key: str
    ) -> bool:
        """通过键删除设置"""
        setting = await self.get_by_key(db, key)
        if not setting:
            return False

        await db.delete(setting)
        await db.commit()
        return True


# 创建CRUD实例
system_setting = CRUDSystemSetting()