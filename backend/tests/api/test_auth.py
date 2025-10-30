"""
认证API端点测试
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.main import app
from app.core.config import get_settings


class TestAuthAPI:
    """认证API测试"""

    @pytest.mark.api
    def test_user_registration_success(self, client: TestClient):
        """测试用户注册成功"""
        registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPassword123!",
            "full_name": "新用户"
        }

        response = client.post("/api/v1/auth/register", json=registration_data)

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "新用户"
        assert "id" in data
        assert "password" not in data  # 确保密码不被返回

    @pytest.mark.api
    def test_user_registration_duplicate_username(self, client: TestClient):
        """测试用户名重复注册"""
        # 先注册一个用户
        registration_data = {
            "username": "testuser",
            "email": "test1@example.com",
            "password": "StrongPassword123!"
        }
        client.post("/api/v1/auth/register", json=registration_data)

        # 尝试用相同用户名再次注册
        duplicate_data = {
            "username": "testuser",
            "email": "test2@example.com",
            "password": "StrongPassword123!"
        }

        response = client.post("/api/v1/auth/register", json=duplicate_data)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    @pytest.mark.api
    def test_user_registration_duplicate_email(self, client: TestClient):
        """测试邮箱重复注册"""
        # 先注册一个用户
        registration_data = {
            "username": "user1",
            "email": "test@example.com",
            "password": "StrongPassword123!"
        }
        client.post("/api/v1/auth/register", json=registration_data)

        # 尝试用相同邮箱再次注册
        duplicate_data = {
            "username": "user2",
            "email": "test@example.com",
            "password": "StrongPassword123!"
        }

        response = client.post("/api/v1/auth/register", json=duplicate_data)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    @pytest.mark.api
    def test_user_registration_invalid_data(self, client: TestClient):
        """测试无效数据注册"""
        # 测试密码太短
        invalid_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "123"
        }

        response = client.post("/api/v1/auth/register", json=invalid_data)
        assert response.status_code == 422

        # 测试邮箱格式无效
        invalid_data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "StrongPassword123!"
        }

        response = client.post("/api/v1/auth/register", json=invalid_data)
        assert response.status_code == 422

    @pytest.mark.api
    def test_user_login_success(self, client: TestClient):
        """测试用户登录成功"""
        # 先注册用户
        registration_data = {
            "username": "loginuser",
            "email": "login@example.com",
            "password": "StrongPassword123!"
        }
        client.post("/api/v1/auth/register", json=registration_data)

        # 登录
        login_data = {
            "username": "loginuser",
            "password": "StrongPassword123!"
        }

        response = client.post("/api/v1/auth/login", data=login_data)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    @pytest.mark.api
    def test_user_login_invalid_credentials(self, client: TestClient):
        """测试无效凭据登录"""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }

        response = client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.api
    def test_current_user_info(self, client: TestClient, mock_user):
        """测试获取当前用户信息"""
        # 创建认证token
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = mock_user

            # 设置认证头
            headers = {"Authorization": "Bearer fake_token"}

            response = client.get("/api/v1/auth/me", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert data["username"] == "testuser"
            assert data["email"] == "test@example.com"
            assert data["is_active"] is True

    @pytest.mark.api
    def test_current_user_unauthorized(self, client: TestClient):
        """测试未授权访问用户信息"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.api
    def test_refresh_token_success(self, client: TestClient, mock_user):
        """测试刷新token成功"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = mock_user

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/auth/refresh", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"

    @pytest.mark.api
    def test_change_password_success(self, client: TestClient, mock_user):
        """测试修改密码成功"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.authenticate_user.return_value = mock_user
            mock_service_instance.change_password.return_value = True

            headers = {"Authorization": "Bearer fake_token"}
            password_data = {
                "current_password": "oldpassword",
                "new_password": "NewPassword123!"
            }

            response = client.put("/api/v1/auth/change-password",
                                headers=headers, json=password_data)

            assert response.status_code == 200
            assert "successfully" in response.json()["message"].lower()

    @pytest.mark.api
    def test_change_password_wrong_current(self, client: TestClient, mock_user):
        """测试修改密码时当前密码错误"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.authenticate_user.return_value = None  # 认证失败

            headers = {"Authorization": "Bearer fake_token"}
            password_data = {
                "current_password": "wrongpassword",
                "new_password": "NewPassword123!"
            }

            response = client.put("/api/v1/auth/change-password",
                                headers=headers, json=password_data)

            assert response.status_code == 400
            assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.api
    def test_logout_success(self, client: TestClient, mock_user):
        """测试登出成功"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = mock_user

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/auth/logout", headers=headers)

            assert response.status_code == 200
            assert "successfully" in response.json()["message"].lower()

    @pytest.mark.api
    def test_password_recovery_request(self, client: TestClient):
        """测试请求密码重置"""
        recovery_data = {"email": "test@example.com"}

        with patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.request_password_reset.return_value = True

            response = client.post("/api/v1/auth/password-recovery", json=recovery_data)

            assert response.status_code == 200
            assert "email sent" in response.json()["message"].lower()

    @pytest.mark.api
    def test_password_reset_success(self, client: TestClient):
        """测试密码重置成功"""
        reset_data = {
            "token": "valid_reset_token",
            "new_password": "NewPassword123!"
        }

        with patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.reset_password.return_value = True

            response = client.post("/api/v1/auth/password-reset", json=reset_data)

            assert response.status_code == 200
            assert "successfully" in response.json()["message"].lower()

    @pytest.mark.api
    def test_verify_email_success(self, client: TestClient):
        """测试邮箱验证成功"""
        with patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.verify_email.return_value = True

            response = client.post("/api/v1/auth/verify-email/test_token")

            assert response.status_code == 200
            assert "successfully" in response.json()["message"].lower()

    @pytest.mark.api
    def test_resend_verification_success(self, client: TestClient, mock_user):
        """测试重发验证邮件成功"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user, \
             patch('app.api.v1.endpoints.auth.UserService') as mock_user_service:

            mock_get_user.return_value = mock_user
            mock_service_instance = AsyncMock()
            mock_user_service.return_value = mock_service_instance
            mock_service_instance.resend_verification.return_value = True

            headers = {"Authorization": "Bearer fake_token"}
            response = client.post("/api/v1/auth/resend-verification", headers=headers)

            assert response.status_code == 200
            assert "email sent" in response.json()["message"].lower()


class TestTokenValidation:
    """Token验证测试"""

    @pytest.mark.api
    def test_invalid_bearer_token(self, client: TestClient):
        """测试无效的Bearer token"""
        headers = {"Authorization": "Bearer invalid_token"}

        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.api
    def test_missing_authorization_header(self, client: TestClient):
        """测试缺少授权头"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.api
    def test_invalid_token_format(self, client: TestClient):
        """测试无效的token格式"""
        headers = {"Authorization": "InvalidFormat token"}

        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.api
    def test_expired_token(self, client: TestClient):
        """测试过期的token"""
        # 创建一个过期的token
        expired_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0dXNlciIsImV4cCI6MTYwMDAwMDAwMH0.invalid"

        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401