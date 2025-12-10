import React, { useState } from 'react'
import { Form, Input, Button, Alert, Typography, Space } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from '@/utils/request'
import './LoginForm.css'

const { Title, Text, Link } = Typography

interface RegisterFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  full_name: string
}

const RegisterForm: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (values: RegisterFormData) => {
    setLoading(true)
    setError(null)

    try {
      const { confirmPassword, ...registerData } = values

      await axios.post('/api/v1/auth/register', registerData)

      setSuccess(true)

      // 2秒后跳转到登录页
      setTimeout(() => {
        navigate('/login', {
          state: { message: '注册成功！请使用您的账号登录' }
        })
      }, 2000)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || '注册失败，请稍后重试'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const renderAlert = () => {
    if (success) {
      return (
        <Alert
          message="注册成功"
          description="正在跳转到登录页面..."
          type="success"
          showIcon
          className="login-form-error"
        />
      )
    }

    if (error) {
      return (
        <Alert
          message="注册失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="login-form-error"
        />
      )
    }

    return null
  }

  return (
    <div className="login-form-wrapper">
      <div className="login-form-header">
        <Title level={3} className="login-form-title">
          创建账户
        </Title>
        <Text type="secondary" className="login-form-subtitle">
          填写信息完成注册
        </Text>
      </div>

      {renderAlert()}

      <Form
        form={form}
        name="register"
        size="large"
        onFinish={handleSubmit}
        autoComplete="off"
        className="login-form"
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
            { max: 20, message: '用户名最多20个字符' },
            {
              pattern: /^[a-zA-Z0-9_]+$/,
              message: '用户名只能包含字母、数字和下划线',
            },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="邮箱地址"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          name="full_name"
          rules={[
            { required: true, message: '请输入真实姓名' },
            { min: 2, message: '姓名至少2个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="真实姓名"
            autoComplete="name"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            autoComplete="new-password"
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="确认密码"
            autoComplete="new-password"
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="login-button"
            disabled={success}
          >
            {loading ? '注册中...' : '注册'}
          </Button>
        </Form.Item>
      </Form>

      <div className="register-link">
        <Text type="secondary">
          已有账号？
          <Link href="/login" className="register-text">
            立即登录
          </Link>
        </Text>
      </div>

      <div className="login-footer">
        <Text type="secondary" className="footer-text">
          注册即表示您同意我们的
          <Link href="/terms" target="_blank">
            服务条款
          </Link>
          和
          <Link href="/privacy" target="_blank">
            隐私政策
          </Link>
        </Text>
      </div>
    </div>
  )
}

export default RegisterForm
