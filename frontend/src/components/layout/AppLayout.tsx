import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Badge, Tooltip, Space, Divider } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  QuestionCircleOutlined,
  ShareAltOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { logout } from '../../store/slices/authSlice'
import { toggleSidebar, selectThemeMode, setThemeMode } from '../../store/slices/uiSlice'
import { selectUnreadCount } from '../../store/slices/notificationsSlice'
import './AppLayout.css'

const { Header, Sider, Content } = Layout

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()

  const { user } = useAppSelector((state) => state.auth)
  const sidebarCollapsed = useAppSelector((state) => state.ui.layout.sidebarCollapsed)
  const themeMode = useAppSelector(selectThemeMode)
  const unreadCount = useAppSelector(selectUnreadCount)

  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)

  // 菜单配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <GlobalOutlined />,
      label: '行业资讯',
    },
    {
      key: '/documents',
      icon: <FileTextOutlined />,
      label: '文档管理',
      children: [
        {
          key: '/documents/upload',
          label: '上传文档',
        },
        {
          key: '/documents/list',
          label: '文档列表',
        },
        {
          key: '/documents/process',
          label: '处理状态',
        },
        {
          key: '/documents/knowledge-graph',
          label: '知识图谱',
        },
      ],
    },
    {
      key: '/estimates',
      icon: <CalculatorOutlined />,
      label: '成本估算',
      children: [
        {
          key: '/estimates/create',
          label: '新建估算',
        },
        {
          key: '/estimates/list',
          label: '估算列表',
        },
        {
          key: '/estimates/templates',
          label: '估算模板',
        },
        {
          key: '/estimates/historical-data',
          label: '历史数据管理',
        },
        {
          key: '/estimates/smart-estimate',
          label: '智能估算',
        },
        {
          key: '/estimates/comparisons',
          label: '项目对比',
        },
      ],
    },
    {
      key: '/queries',
      icon: <QuestionCircleOutlined />,
      label: '智能问答',
      children: [
        {
          key: '/queries/chat',
          label: '问答对话',
        },
        {
          key: '/queries/history',
          label: '查询历史',
        },
      ],
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        {
          key: '/settings/profile',
          label: '个人资料',
        },
        {
          key: '/settings/system',
          label: '系统配置',
        },
        {
          key: '/settings/api',
          label: 'API管理',
        },
      ],
    },
  ]

  // 切换侧边栏
  const handleToggleSidebar = () => {
    dispatch(toggleSidebar())
  }

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    setMobileMenuVisible(false)
  }

  // 处理用户下拉菜单
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        navigate('/settings/profile')
        break
      case 'logout':
        dispatch(logout())
        navigate('/login')
        break
      default:
        break
    }
  }

  // 快速导航处理
  const handleQuickNavigate = (path: string) => {
    navigate(path)
  }

  // 快速导航菜单项
  const quickNavItems = [
    {
      key: '/dashboard',
      icon: <GlobalOutlined />,
      label: '行业资讯',
    },
    {
      key: '/queries/chat',
      icon: <QuestionCircleOutlined />,
      label: '智能问答',
    },
    {
      key: '/estimates/create',
      icon: <CalculatorOutlined />,
      label: '成本估算',
    },
    {
      key: '/documents/upload',
      icon: <FileTextOutlined />,
      label: '文档上传',
    },
    {
      key: '/settings/system',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ]

  // 切换主题
  const handleToggleTheme = () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light'
    dispatch(setThemeMode(newTheme))
  }

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const pathname = location.pathname
    return [pathname]
  }

  // 获取展开的菜单项
  const getOpenKeys = () => {
    const pathname = location.pathname
    const openKeys: string[] = []

    menuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => {
          return pathname.startsWith(child.key)
        })
        if (hasActiveChild) {
          openKeys.push(item.key)
        }
      }
    })

    return openKeys
  }

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  return (
    <Layout className="app-layout">
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={240}
        collapsedWidth={0}
        className="app-sider"
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken && !sidebarCollapsed) {
            setMobileMenuVisible(false)
          }
        }}
      >
        <div className="app-logo">
          <div className="logo-icon">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 背景渐变定义 */}
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1890ff" />
                  <stop offset="50%" stopColor="#722ed1" />
                  <stop offset="100%" stopColor="#52c41a" />
                </linearGradient>
              </defs>

              {/* 圆角矩形背景 */}
              <rect width="40" height="40" rx="8" fill="url(#logoGradient)" />

              {/* Cost文字 */}
              <text
                x="20"
                y="17"
                fontSize="9"
                fontWeight="bold"
                fill="white"
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
              >
                Cost
              </text>

              {/* RAG文字 */}
              <text
                x="20"
                y="28"
                fontSize="9"
                fontWeight="300"
                fill="white"
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                opacity="0.9"
              >
                RAG
              </text>

              {/* 装饰线条 */}
              <line
                x1="10"
                y1="21"
                x2="30"
                y2="21"
                stroke="white"
                strokeWidth="0.8"
                opacity="0.3"
              />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="logo-text">Cost-RAG</span>
          )}
        </div>

        <Menu
          theme="light"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          className="app-menu"
        />
      </Sider>

      <Layout className="app-main-layout">
        {/* 顶部导航栏 */}
        <Header className="app-header">
          <div className="header-left">
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={handleToggleSidebar}
              className="sidebar-toggle"
            />
          </div>

          <div className="header-right">
            {/* 快速导航 */}
            <Dropdown
              menu={{
                items: quickNavItems.map(item => ({
                  key: item.key,
                  icon: item.icon,
                  label: item.label,
                  onClick: () => handleQuickNavigate(item.key),
                })),
              }}
              placement="bottomRight"
              arrow
            >
              <Tooltip title="快速导航">
                <Button
                  type="text"
                  icon={<ThunderboltOutlined />}
                  className="quick-nav-btn"
                >
                  快速导航
                </Button>
              </Tooltip>
            </Dropdown>

            <Divider type="vertical" style={{ height: '24px', margin: '0 12px' }} />

            {/* 主题切换 */}
            <Tooltip title={themeMode === 'light' ? '切换到暗黑模式' : '切换到亮色模式'}>
              <Button
                type="text"
                icon={themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={handleToggleTheme}
                className="theme-toggle"
              />
            </Tooltip>

            {/* 通知 */}
            <Tooltip title="通知">
              <Badge count={unreadCount} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  className="notification-btn"
                />
              </Badge>
            </Tooltip>

            {/* 用户头像 */}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenuClick,
              }}
              placement="bottomRight"
              arrow
            >
              <div className="user-avatar">
                <Avatar
                  size="small"
                  src={user?.avatar_url}
                  icon={<UserOutlined />}
                />
                <span className="user-name">{user?.full_name || user?.username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 主内容区 */}
        <Content className="app-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout