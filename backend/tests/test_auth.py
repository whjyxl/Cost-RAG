"""
用户认证和授权系统测试
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch

from app.core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_user,
    authenticate_user
)
from app.schemas.user import UserCreate, UserUpdate
from app.models.user import User


@pytest.mark.asyncio
async def test_password_hashing():
    """测试密码哈希和验证"""
    password = "test_password_123"

    # 测试密码哈希
    hashed = get_password_hash(password)
    assert hashed != password
    assert len(hashed) >= 50  # bcrypt hash length

    # 测试密码验证
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


@pytest.mark.asyncio
async def test_create_access_token():
    """测试创建访问令牌"""
    data = {"sub": "testuser@example.com", "exp": 1234567890}
    token = create_access_token(data)

    assert isinstance(token, str)
    assert len(token) > 100  # JWT token length


@pytest.mark.asyncio
async def test_user_model_validation():
    """测试用户模型验证"""
    # 测试有效用户创建
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="测试用户",
        is_active=True,
        is_superuser=False
    )

    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True
    assert user.is_superuser is False


@pytest.mark.asyncio
async def test_user_schema_validation():
    """测试用户模式验证"""
    # 测试有效用户创建模式
    user_data = UserCreate(
        username="testuser",
        email="test@example.com",
        password="password123",
        full_name="测试用户"
    )

    assert user_data.username == "testuser"
    assert user_data.email == "test@example.com"
    assert user_data.password == "password123"
    assert user_data.full_name == "测试用户"


@pytest.mark.asyncio
async def test_user_preferences():
    """测试用户偏好设置"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        preferences={"theme": "dark", "language": "zh-CN"}
    )

    # 测试获取偏好
    assert user.get_preference("theme") == "dark"
    assert user.get_preference("language") == "zh-CN"
    assert user.get_preference("nonexistent", "default") == "default"

    # 测试设置偏好
    user.set_preference("font_size", "large")
    assert user.get_preference("font_size") == "large"


@pytest.mark.asyncio
async def test_user_locking():
    """测试用户锁定机制"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        failed_login_attempts=3,
        locked_until=datetime.now(timezone.utc) + timedelta(minutes=30)
    )

    assert user.is_locked is True

    # 测试未锁定用户
    unlocked_user = User(
        username="unlocked",
        email="unlocked@example.com",
        hashed_password=get_password_hash("password123")
    )

    assert unlocked_user.is_locked is False


@pytest.mark.asyncio
async def test_user_display_name():
    """测试用户显示名称"""
    # 测试有全名的用户
    user_with_name = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="测试用户"
    )

    assert user_with_name.get_display_name() == "测试用户"

    # 测试无全名的用户
    user_without_name = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123")
    )

    assert user_without_name.get_display_name() == "testuser"


@pytest.mark.asyncio
@patch('app.core.security.get_user_by_email')
async def test_authenticate_user(mock_get_user):
    """测试用户认证"""
    # 模拟数据库用户
    db_user = User(
        id=1,
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        is_active=True
    )
    mock_get_user.return_value = db_user

    # 测试有效认证
    authenticated_user = await authenticate_user("test@example.com", "password123")
    assert authenticated_user is not None
    assert authenticated_user.email == "test@example.com"

    # 测试无效密码
    invalid_user = await authenticate_user("test@example.com", "wrongpassword")
    assert invalid_user is None

    # 测试无效邮箱
    non_existent_user = await authenticate_user("nonexistent@example.com", "password123")
    assert non_existent_user is None


@pytest.mark.asyncio
@patch('app.core.security.get_user_by_token')
async def test_get_current_user(mock_get_user):
    """测试获取当前用户"""
    # 模拟数据库用户
    db_user = User(
        id=1,
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        is_active=True
    )
    mock_get_user.return_value = db_user

    # 测试有效token
    token = create_access_token({"sub": "test@example.com"})
    current_user = await get_current_user(token)
    assert current_user is not None
    assert current_user.email == "test@example.com"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_crud_operations():
    """测试用户CRUD操作"""
    # 这里应该集成实际的数据库测试
    # 由于我们还没有实现完整的数据库层，这里提供测试框架

    # 创建用户
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="测试用户"
    )

    # 验证创建
    assert user.username == "testuser"
    assert user.email == "test@example.com"

    # 模拟更新
    user.full_name = "更新的用户名"
    assert user.full_name == "更新的用户名"

    # 模拟软删除
    user.is_active = False
    assert user.is_active is False


@pytest.mark.asyncio
async def test_user_permission_system():
    """测试用户权限系统"""
    # 创建普通用户
    normal_user = User(
        username="normal",
        email="normal@example.com",
        hashed_password=get_password_hash("password123"),
        is_superuser=False
    )

    # 创建超级用户
    super_user = User(
        username="admin",
        email="admin@example.com",
        hashed_password=get_password_hash("password123"),
        is_superuser=True
    )

    assert normal_user.is_superuser is False
    assert super_user.is_superuser is True


@pytest.mark.asyncio
async def test_user_validation():
    """测试用户数据验证"""
    # 测试邮箱格式验证
    with pytest.raises(ValueError):
        User(
            username="test",
            email="invalid_email",  # 无效邮箱格式
            hashed_password=get_password_hash("password123")
        )

    # 测试密码长度验证
    with pytest.raises(ValueError):
        User(
            username="test",
            email="test@example.com",
            hashed_password=get_password_hash("123")  # 密码太短
        )