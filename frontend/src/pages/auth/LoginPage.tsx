import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Layout, Typography, Card } from 'antd'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { restoreAuthState, checkTokenValidity } from '@/store/slices/authSlice'
import LoginForm from '@/components/auth/LoginForm'
import './LoginPage.css'

const { Content } = Layout
const { Title, Paragraph } = Typography

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth)

  // 页面加载时恢复认证状态
  useEffect(() => {
    dispatch(restoreAuthState())
    dispatch(checkTokenValidity())
  }, [dispatch])

  // 如果已认证，重定向到dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Layout className="login-page">
      <Content className="login-content">
        <div className="login-left">
          <div className="login-branding">
            <div className="brand-logo">
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="80" height="80" rx="20" fill="#2563eb" />
                <path
                  d="M40 20C30.0589 20 22 28.0589 22 40C22 51.9411 30.0589 60 40 60C49.9411 60 58 51.9411 58 40C58 28.0589 49.9411 20 40 20Z"
                  fill="white"
                />
                <path
                  d="M32 32H48V48H32V32Z"
                  fill="#2563eb"
                />
              </svg>
            </div>
            <Title level={1} className="brand-title">
              Cost-RAG
            </Title>
            <Paragraph className="brand-subtitle">
              工程造价咨询智能RAG系统
            </Paragraph>
          </div>

          <div className="login-features">
            <Card className="feature-card">
              <div className="feature-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <Title level={4}>智能文档处理</Title>
              <Paragraph>
                支持PDF、Excel、Word等多种格式，智能解析和向量化存储
              </Paragraph>
            </Card>

            <Card className="feature-card">
              <div className="feature-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 8V16M8 12H16M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <Title level={4}>成本估算引擎</Title>
              <Paragraph>
                14级分部分项层级计算，多项目对比分析
              </Paragraph>
            </Card>

            <Card className="feature-card">
              <div className="feature-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21 21L16.5 16.5M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <Title level={4}>RAG智能问答</Title>
              <Paragraph>
                混合检索策略，知识图谱增强，精准回答工程造价问题
              </Paragraph>
            </Card>
          </div>
        </div>

        <div className="login-right">
          <LoginForm onSuccess={() => {/* 登录成功后的处理 */}} />
        </div>
      </Content>
    </Layout>
  )
}

export default LoginPage