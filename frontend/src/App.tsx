import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import { useAppSelector } from './hooks/redux'
import { selectAuth } from './store/slices/authSlice'

// 页面组件
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import DocumentsPage from './pages/documents/DocumentsPage'
import EstimatesPage from './pages/estimates/EstimatesPage'
import QueriesPage from './pages/queries/QueriesPage'
import SettingsPage from './pages/settings/SettingsPage'

// 布局组件
import AppLayout from './components/layout/AppLayout'
import LoadingScreen from './components/common/LoadingScreen'

const { Content } = Layout

function App() {
  const { isAuthenticated, isLoading } = useAppSelector(selectAuth)

  // 临时禁用认证检查用于测试
  const bypassAuth = true

  // 显示加载屏幕
  if (isLoading && !bypassAuth) {
    return <LoadingScreen />
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated && !bypassAuth) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // 已认证用户的主应用
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="documents/*" element={<DocumentsPage />} />
        <Route path="estimates/*" element={<EstimatesPage />} />
        <Route path="queries/*" element={<QueriesPage />} />
        <Route path="settings/*" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App