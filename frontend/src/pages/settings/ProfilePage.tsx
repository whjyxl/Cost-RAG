import React, { useState } from 'react'
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Select,
  Avatar,
  Upload,
  Row,
  Col,
  Divider,
  Switch,
  InputNumber,
  Space,
  message,
  Descriptions,
  Badge,
  Tabs,
  List,
  Tag,
  Tooltip,
} from 'antd'
import {
  UserOutlined,
  UploadOutlined,
  SaveOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  BankOutlined,
  CalendarOutlined,
  SafetyOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CameraOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { UploadProps } from 'antd'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

interface UserProfile {
  id: string
  username: string
  email: string
  phone: string
  fullName: string
  title: string
  department: string
  company: string
  avatar: string
  bio: string
  location: string
  joinDate: string
  lastLogin: string
  status: 'online' | 'offline' | 'busy'
  timezone: string
  language: string
  theme: 'light' | 'dark' | 'auto'
  emailNotifications: boolean
  pushNotifications: boolean
  weeklyReport: boolean
  autoSave: boolean
  twoFactorAuth: boolean
  password: string
  confirmPassword: string
}

interface ActivityLog {
  id: string
  action: string
  description: string
  timestamp: string
  ip: string
  device: string
}

const ProfilePage: React.FC = () => {
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')

  const [profile, setProfile] = useState<UserProfile>({
    id: '1',
    username: 'zhang_engineer',
    email: 'zhang.engineer@cost-rag.com',
    phone: '+86 138 0013 8000',
    fullName: '张工程师',
    title: '高级造价工程师',
    department: '工程造价部',
    company: 'Cost-RAG科技有限公司',
    avatar: '',
    bio: '拥有10年工程造价经验，专注于住宅建筑和商业项目的成本估算与管理。熟悉各类工程计价软件和规范标准。',
    location: '北京市朝阳区',
    joinDate: '2022-03-15',
    lastLogin: '2024-01-20 14:30:00',
    status: 'online',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    theme: 'light',
    emailNotifications: true,
    pushNotifications: true,
    weeklyReport: true,
    autoSave: true,
    twoFactorAuth: false,
    password: '',
    confirmPassword: '',
  })

  // 模拟活动日志
  const activityLogs: ActivityLog[] = [
    {
      id: '1',
      action: '创建估算',
      description: '创建了"阳光小区住宅楼建设项目"成本估算',
      timestamp: '2024-01-20 14:30:00',
      ip: '192.168.1.100',
      device: 'Chrome 120 / Windows 10',
    },
    {
      id: '2',
      action: '上传文档',
      description: '上传了"工程造价管理规范.pdf"文档',
      timestamp: '2024-01-20 11:15:00',
      ip: '192.168.1.100',
      device: 'Chrome 120 / Windows 10',
    },
    {
      id: '3',
      action: '修改资料',
      description: '更新了个人联系方式',
      timestamp: '2024-01-19 16:45:00',
      ip: '192.168.1.100',
      device: 'Chrome 120 / Windows 10',
    },
    {
      id: '4',
      action: '导出报告',
      description: '导出了"科技园区厂房改造工程"估算报告',
      timestamp: '2024-01-19 10:20:00',
      ip: '192.168.1.100',
      device: 'Chrome 120 / Windows 10',
    },
    {
      id: '5',
      action: '登录系统',
      description: '用户登录系统',
      timestamp: '2024-01-19 09:00:00',
      ip: '192.168.1.100',
      device: 'Chrome 120 / Windows 10',
    },
  ]

  // 头像上传配置
  const uploadProps: UploadProps = {
    name: 'avatar',
    showUploadList: false,
    beforeUpload: (file) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'
      if (!isJpgOrPng) {
        message.error('只能上传 JPG/PNG 格式的图片!')
        return false
      }
      const isLt2M = file.size / 1024 / 1024 < 2
      if (!isLt2M) {
        message.error('图片大小不能超过 2MB!')
        return false
      }

      // 创建预览URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      return false // 阻止自动上传
    },
  }

  // 保存个人资料
  const handleSaveProfile = async (values: any) => {
    setLoading(true)
    try {
      // 模拟保存
      await new Promise(resolve => setTimeout(resolve, 1000))
      setProfile(prev => ({ ...prev, ...values }))
      message.success('个人资料已更新')
    } catch (error) {
      message.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 修改密码
  const handleChangePassword = async (values: any) => {
    setLoading(true)
    try {
      // 模拟密码修改
      await new Promise(resolve => setTimeout(resolve, 1000))
      message.success('密码修改成功，请重新登录')
      passwordForm.resetFields()
    } catch (error) {
      message.error('密码修改失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge status="success" text="在线" />
      case 'offline':
        return <Badge status="default" text="离线" />
      case 'busy':
        return <Badge status="warning" text="忙碌" />
      default:
        return <Badge status="default" text="未知" />
    }
  }

  // 渲染个人信息表单
  const renderProfileForm = () => (
    <Form
      form={form}
      layout="vertical"
      initialValues={profile}
      onFinish={handleSaveProfile}
    >
      <Row gutter={24}>
        <Col span={8}>
          <Card title="头像设置" style={{ textAlign: 'center' }}>
            <Space direction="vertical" size="large">
              <Avatar
                size={120}
                src={avatarUrl || profile.avatar}
                icon={<UserOutlined />}
                style={{ border: '4px solid #f0f0f0' }}
              />
              <Upload {...uploadProps}>
                <Button icon={<CameraOutlined />}>更换头像</Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                支持 JPG、PNG 格式，不超过 2MB
              </Text>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card title="基本信息">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="用户名"
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input prefix={<UserOutlined />} disabled />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="姓名"
                  name="fullName"
                  rules={[{ required: true, message: '请输入姓名' }]}
                >
                  <Input prefix={<UserOutlined />} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="邮箱"
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input prefix={<MailOutlined />} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="手机号码"
                  name="phone"
                  rules={[{ required: true, message: '请输入手机号码' }]}
                >
                  <Input prefix={<PhoneOutlined />} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="职位"
                  name="title"
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="部门"
                  name="department"
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="公司"
                  name="company"
                >
                  <Input prefix={<BankOutlined />} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="所在地"
                  name="location"
                >
                  <Input prefix={<EnvironmentOutlined />} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="个人简介"
              name="bio"
            >
              <TextArea
                rows={4}
                placeholder="介绍一下自己..."
                maxLength={200}
                showCount
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
              >
                保存资料
              </Button>
            </Form.Item>
          </Card>
        </Col>
      </Row>
    </Form>
  )

  // 渲染安全设置
  const renderSecuritySettings = () => (
    <Row gutter={24}>
      <Col span={12}>
        <Card title="修改密码">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
          >
            <Form.Item
              label="当前密码"
              name="currentPassword"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item
              label="新密码"
              name="newPassword"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '密码长度至少8位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                visibilityToggle={{
                  visible: passwordVisible,
                  onVisibleChange: setPasswordVisible,
                }}
              />
            </Form.Item>

            <Form.Item
              label="确认新密码"
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col span={12}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card title="双因素认证">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Space>
                  <SafetyOutlined />
                  <Text>启用双因素认证可以提高账户安全性</Text>
                </Space>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary">
                  {profile.twoFactorAuth ? '已启用双因素认证' : '未启用双因素认证'}
                </Text>
                <Switch
                  checked={profile.twoFactorAuth}
                  onChange={(checked) => {
                    setProfile(prev => ({ ...prev, twoFactorAuth: checked }))
                    message.success(checked ? '双因素认证已启用' : '双因素认证已关闭')
                  }}
                />
              </div>
              {profile.twoFactorAuth && (
                <Alert
                  message="安全提醒"
                  description="请确保您的手机可以正常接收验证码"
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </Card>

          <Card title="登录历史">
            <List
              size="small"
              dataSource={activityLogs.slice(0, 3)}
              renderItem={(log) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{log.action}</Text>
                        <Text type="secondary">{log.timestamp}</Text>
                      </Space>
                    }
                    description={log.description}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  )

  // 渲染通知设置
  const renderNotificationSettings = () => (
    <Row gutter={24}>
      <Col span={24}>
        <Card title="通知偏好设置">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={5}>邮件通知</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <MailOutlined />
                    <Text>系统通知邮件</Text>
                    <Tooltip title="接收系统重要更新和通知">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                  <Switch
                    checked={profile.emailNotifications}
                    onChange={(checked) => {
                      setProfile(prev => ({ ...prev, emailNotifications: checked }))
                      message.success(checked ? '邮件通知已开启' : '邮件通知已关闭')
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <CalendarOutlined />
                    <Text>每周工作报告</Text>
                    <Tooltip title="每周一发送工作总结报告">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                  <Switch
                    checked={profile.weeklyReport}
                    onChange={(checked) => {
                      setProfile(prev => ({ ...prev, weeklyReport: checked }))
                      message.success(checked ? '周报已开启' : '周报已关闭')
                    }}
                  />
                </div>
              </Space>
            </div>

            <Divider />

            <div>
              <Title level={5}>推送通知</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <EditOutlined />
                    <Text>浏览器推送通知</Text>
                    <Tooltip title="在浏览器中接收实时通知">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                  <Switch
                    checked={profile.pushNotifications}
                    onChange={(checked) => {
                      setProfile(prev => ({ ...prev, pushNotifications: checked }))
                      message.success(checked ? '推送通知已开启' : '推送通知已关闭')
                    }}
                  />
                </div>
              </Space>
            </div>

            <Divider />

            <div>
              <Title level={5}>系统设置</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <SaveOutlined />
                    <Text>自动保存</Text>
                    <Tooltip title="自动保存未完成的工作">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                  <Switch
                    checked={profile.autoSave}
                    onChange={(checked) => {
                      setProfile(prev => ({ ...prev, autoSave: checked }))
                      message.success(checked ? '自动保存已开启' : '自动保存已关闭')
                    }}
                  />
                </div>
              </Space>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  )

  // 渲染活动日志
  const renderActivityLogs = () => (
    <Card title="活动日志">
      <List
        dataSource={activityLogs}
        renderItem={(log) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar icon={<UserOutlined />} />}
              title={
                <Space>
                  <Tag color="blue">{log.action}</Tag>
                  <Text>{log.description}</Text>
                </Space>
              }
              description={
                <Space direction="vertical" size="small">
                  <Text type="secondary">{log.timestamp}</Text>
                  <Space split={<Divider type="vertical" />}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      IP: {log.ip}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {log.device}
                    </Text>
                  </Space>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>个人资料</Title>
        <Paragraph type="secondary">
          管理您的个人信息、安全设置和通知偏好
        </Paragraph>
      </div>

      {/* 用户信息概览 */}
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={24}>
          <Col>
            <Avatar
              size={64}
              src={profile.avatar}
              icon={<UserOutlined />}
            />
          </Col>
          <Col flex="auto">
            <Space direction="vertical" size="small">
              <Title level={3} style={{ margin: 0 }}>
                {profile.fullName}
                {getStatusBadge(profile.status)}
              </Title>
              <Text type="secondary">{profile.title} · {profile.department}</Text>
              <Text type="secondary">{profile.company}</Text>
              <Space split={<Divider type="vertical" />}>
                <Text type="secondary">
                  <CalendarOutlined /> 加入于 {profile.joinDate}
                </Text>
                <Text type="secondary">
                  最后登录 {profile.lastLogin}
                </Text>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 设置标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本信息" key="profile">
            {renderProfileForm()}
          </TabPane>
          <TabPane tab="安全设置" key="security">
            {renderSecuritySettings()}
          </TabPane>
          <TabPane tab="通知设置" key="notifications">
            {renderNotificationSettings()}
          </TabPane>
          <TabPane tab="活动日志" key="logs">
            {renderActivityLogs()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default ProfilePage