import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography } from 'antd'

// 子页面组件
import ProfilePage from './ProfilePage'
import SystemConfigPage from './SystemConfigPage'
import ApiManagementPage from './ApiManagementPage'

const { Title } = Typography

const SettingsPage: React.FC = () => {
  return (
    <div>
      <Routes>
        <Route index element={
          <div>
            <Title level={2}>系统设置</Title>
            <p>系统设置功能正在开发中...</p>
          </div>
        } />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="system" element={<SystemConfigPage />} />
        <Route path="api" element={<ApiManagementPage />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </div>
  )
}

export default SettingsPage