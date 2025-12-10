import React, { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  UserOutlined,
  SettingOutlined,
  ApiOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'

// 子页面组件
import ProfilePage from './ProfilePage'
import SystemConfigPage from './SystemConfigPage'
import ApiManagementPage from './ApiManagementPage'
import APIStatusDashboardPage from './APIStatusDashboardPage'
import NASConfigPage from './NASConfigPage'

// 导入现代化样式
import './SettingsPage.css'

interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  path: string
}

const menuItems: MenuItem[] = [
  {
    key: 'profile',
    label: '个人资料',
    icon: <UserOutlined />,
    path: '/settings/profile',
  },
  {
    key: 'system',
    label: '系统配置',
    icon: <SettingOutlined />,
    path: '/settings/system',
  },
  {
    key: 'nas-config',
    label: 'NAS配置',
    icon: <CloudServerOutlined />,
    path: '/settings/nas-config',
  },
  {
    key: 'api',
    label: 'API管理',
    icon: <ApiOutlined />,
    path: '/settings/api',
  },
  {
    key: 'api-status',
    label: 'API状态',
    icon: <DashboardOutlined />,
    path: '/settings/api-status',
  },
]

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // 从当前路径判断活动菜单项
  const getActiveKey = () => {
    const path = location.pathname
    const item = menuItems.find(item => path.includes(item.key))
    return item?.key || 'profile'
  }

  const [activeKey, setActiveKey] = useState(getActiveKey())

  const handleMenuClick = (key: string) => {
    setActiveKey(key)
    const item = menuItems.find(item => item.key === key)
    if (item) {
      navigate(item.path)
    }
  }

  // 如果在根路径,显示设置主页
  const isRootPath = location.pathname === '/settings' || location.pathname === '/preview/settings'

  return (
    <div className="settings-modern">
      {/* 页面标题 */}
      <h1 className="settings-title">系统设置</h1>

      <div className="settings-layout">
        {/* 左侧菜单 */}
        <div className="settings-menu">
          <div className="settings-menu-card">
            {menuItems.map(item => (
              <div
                key={item.key}
                className={`settings-menu-item ${activeKey === item.key ? 'active' : ''}`}
                onClick={() => handleMenuClick(item.key)}
              >
                <span className="settings-menu-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="settings-content">
          <div className="settings-content-card">
            {isRootPath ? (
              <div>
                <div className="settings-section">
                  <div className="settings-section-title">
                    <ExclamationCircleOutlined className="settings-section-icon" />
                    欢迎使用系统设置
                  </div>
                  <div className="settings-section-content">
                    <p style={{ color: '#666', marginBottom: 16 }}>
                      请从左侧菜单选择您要配置的设置项。
                    </p>

                    <div className="settings-stats">
                      <div className="settings-stat-card">
                        <div className="settings-stat-label">设置项</div>
                        <div className="settings-stat-value">
                          {menuItems.length}
                          <span className="settings-stat-unit">个</span>
                        </div>
                      </div>

                      <div className="settings-stat-card">
                        <div className="settings-stat-label">系统状态</div>
                        <div className="settings-stat-value" style={{
                          background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}>
                          正常
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <h4 style={{ marginBottom: 12, color: '#2c3e50' }}>快速导航:</h4>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {menuItems.map(item => (
                          <button
                            key={item.key}
                            className="settings-secondary-btn"
                            onClick={() => handleMenuClick(item.key)}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Routes>
                <Route path="profile" element={<ProfilePage />} />
                <Route path="system" element={<SystemConfigPage />} />
                <Route path="nas-config" element={<NASConfigPage />} />
                <Route path="api" element={<ApiManagementPage />} />
                <Route path="api-status" element={<APIStatusDashboardPage />} />
                <Route path="*" element={<Navigate to="/settings" replace />} />
              </Routes>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
