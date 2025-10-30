import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Checkbox, Alert, Card, Typography, Space, Divider } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { loginUser, clearError } from '@/store/slices/authSlice'
import { LoginRequest } from '@/types'
import './LoginForm.css'

const { Title, Text, Link } = Typography

interface LoginFormProps {
  onSuccess?: () => void
  showRegisterLink?: boolean
  showForgotPasswordLink?: boolean
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  showRegisterLink = false,
  showForgotPasswordLink = true,
}) => {
  const dispatch = useAppDispatch()
  const { isLoading, error, isAuthenticated } = useAppSelector((state) => state.auth)
  const [form] = Form.useForm()

  const [loginData, setLoginData] = useState<LoginRequest>({
    username: '',
    password: '',
    remember_me: false,
  })

  // 清除错误信息
  useEffect(() => {
    if (error) {
      dispatch(clearError())
    }
  }, [dispatch, error])

  // 登录成功处理
  useEffect(() => {
    if (isAuthenticated && onSuccess) {
      onSuccess()
    }
  }, [isAuthenticated, onSuccess])

  // 表单提交处理
  const handleSubmit = async (values: LoginRequest) => {
    try {
      await dispatch(loginUser(values)).unwrap()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  // 表单字段变化处理
  const handleValuesChange = (changedValues: Partial<LoginRequest>, allValues: LoginRequest) => {
    setLoginData(allValues)
    if (error) {
      dispatch(clearError())
    }
  }

  // 渲染错误信息
  const renderError = () => {
    if (!error) return null

    return (
      <Alert
        message="登录失败"
        description={error}
        type="error"
        showIcon
        closable
        onClose={() => dispatch(clearError())}
        className="login-form-error"
      />
    )
  }

  return (
    <div className="login-form-container">
      <Card className="login-form-card">
        <div className="login-form-header">
          <div className="login-logo">
            <div className="logo-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="48" height="48" rx="12" fill="#2563eb" />
                <path
                  d="M24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36C30.6274 36 36 30.6274 36 24C36 17.3726 30.6274 12 24 12Z"
                  fill="white"
                />
                <path
                  d="M20 20H28V28H20V20Z"
                  fill="#2563eb"
                />
              </svg>
            </div>
          </div>
          <Title level={2} className="login-title">
            Cost-RAG
          </Title>
          <Text type="secondary" className="login-subtitle">
            工程造价咨询智能RAG系统
          </Text>
        </div>

        <Divider />

        {renderError()}

        <Form
          form={form}
          name="login"
          size="large"
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
          initialValues={loginData}
          autoComplete="off"
          className="login-form"
        >
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: '请输入用户名或邮箱',
              },
              {
                type: 'string',
                min: 3,
                message: '用户名至少3个字符',
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名或邮箱"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: '请输入密码',
              },
              {
                min: 6,
                message: '密码至少6个字符',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item>
            <div className="login-options">
              <Form.Item name="remember_me" valuePropName="checked" noStyle>
                <Checkbox>记住我</Checkbox>
              </Form.Item>

              {showForgotPasswordLink && (
                <Link href="/forgot-password" className="forgot-password-link">
                  忘记密码？
                </Link>
              )}
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              className="login-button"
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        {showRegisterLink && (
          <>
            <Divider>或</Divider>
            <div className="register-link">
              <Text type="secondary">
                还没有账号？
                <Link href="/register" className="register-text">
                  立即注册
                </Link>
              </Text>
            </div>
          </>
        )}

        <div className="login-footer">
          <Text type="secondary" className="footer-text">
            登录即表示您同意我们的
            <Link href="/terms" target="_blank">
              服务条款
            </Link>
            和
            <Link href="/privacy" target="_blank">
              隐私政策
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  )
}

export default LoginForm