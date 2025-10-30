import React, { useState } from 'react'
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Row,
  Col,
  Statistic,
  Alert,
  Tabs,
  List,
  Badge,
  Tooltip,
  message,
  Popconfirm,
  InputNumber,
} from 'antd'
import {
  ApiOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  KeyOutlined,
  SafetyOutlined,
  CloudServerOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd'

// 导入国产模型配置
import {
  CHINESE_LLM_PROVIDERS,
  ALL_CHINESE_MODELS,
  LLMProviderType
} from '../../config/models'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  status: 'active' | 'inactive' | 'revoked'
  createdAt: string
  expiresAt: string
  lastUsed: string
  usageCount: number
  rateLimit: number
  createdBy: string
  description?: string
  provider?: 'openai' | 'claude' | 'glm' | 'kimi' | 'qwen' | 'wenxin' | 'deepseek' | 'yi' | 'spark' | 'local'
  model?: string
  costUsage?: {
    totalCost: number
    currency: string
    inputTokens: number
    outputTokens: number
  }
}

interface ApiEndpoint {
  id: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  description: string
  status: 'active' | 'inactive'
  usage: number
  avgResponseTime: number
  errorRate: number
}

const ApiManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('keys')
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // 模拟API密钥数据
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: '生产环境API密钥',
      key: 'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
      permissions: ['read', 'write', 'admin'],
      status: 'active',
      createdAt: '2024-01-01 00:00:00',
      expiresAt: '2025-01-01 00:00:00',
      lastUsed: '2024-01-20 14:30:00',
      usageCount: 1250,
      rateLimit: 1000,
      createdBy: 'admin',
      description: '用于生产环境的API访问',
      provider: 'openai',
      model: 'gpt-4',
      costUsage: {
        totalCost: 156.78,
        currency: 'USD',
        inputTokens: 125000,
        outputTokens: 45000
      }
    },
    {
      id: '2',
      name: '智谱AI GLM-4密钥',
      key: 'glm-abcdefghijklmnopqrstuvwxyz123456',
      permissions: ['read', 'write'],
      status: 'active',
      createdAt: '2024-01-10 10:00:00',
      expiresAt: '2025-01-10 10:00:00',
      lastUsed: '2024-01-20 16:45:00',
      usageCount: 680,
      rateLimit: 800,
      createdBy: 'admin',
      description: '智谱AI GLM-4模型API密钥',
      provider: 'glm',
      model: 'glm-4',
      costUsage: {
        totalCost: 89.45,
        currency: 'CNY',
        inputTokens: 98000,
        outputTokens: 32000
      }
    },
    {
      id: '3',
      name: '月之暗面Kimi密钥',
      key: 'sk-moon-uvwxyz7890123456789',
      permissions: ['read', 'write'],
      status: 'active',
      createdAt: '2024-01-12 15:30:00',
      expiresAt: '2024-12-12 15:30:00',
      lastUsed: '2024-01-20 18:20:00',
      usageCount: 245,
      rateLimit: 600,
      createdBy: 'developer',
      description: '月之暗面Kimi 32K模型API密钥',
      provider: 'kimi',
      model: 'moonshot-v1-32k',
      costUsage: {
        totalCost: 67.32,
        currency: 'CNY',
        inputTokens: 45000,
        outputTokens: 18000
      }
    },
    {
      id: '4',
      name: '阿里千问Plus密钥',
      key: 'sk-qwen-abcdefghijklmnopqrstuv',
      permissions: ['read', 'write'],
      status: 'active',
      createdAt: '2024-01-15 09:15:00',
      expiresAt: '2024-10-15 09:15:00',
      lastUsed: '2024-01-20 12:30:00',
      usageCount: 189,
      rateLimit: 500,
      createdBy: 'admin',
      description: '阿里云通义千问Plus模型API密钥',
      provider: 'qwen',
      model: 'qwen-plus',
      costUsage: {
        totalCost: 42.18,
        currency: 'CNY',
        inputTokens: 76000,
        outputTokens: 21000
      }
    },
    {
      id: '5',
      name: '开发测试密钥',
      key: 'sk-test-wxyz987654321',
      permissions: ['read', 'write'],
      status: 'active',
      createdAt: '2024-01-18 14:00:00',
      expiresAt: '2024-07-18 14:00:00',
      lastUsed: '2024-01-19 16:45:00',
      usageCount: 95,
      rateLimit: 300,
      createdBy: 'developer',
      description: '用于开发和测试环境',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      costUsage: {
        totalCost: 12.34,
        currency: 'USD',
        inputTokens: 15000,
        outputTokens: 8000
      }
    },
    {
      id: '6',
      name: '第三方集成密钥',
      key: 'sk-int-readonly123456789',
      permissions: ['read'],
      status: 'inactive',
      createdAt: '2024-01-15 14:20:00',
      expiresAt: '2024-04-15 14:20:00',
      lastUsed: '2024-01-18 09:15:00',
      usageCount: 45,
      rateLimit: 100,
      createdBy: 'admin',
      description: '用于第三方系统集成',
    },
  ])

  // 模拟API端点数据
  const apiEndpoints: ApiEndpoint[] = [
    {
      id: '1',
      path: '/api/v1/documents',
      method: 'GET',
      description: '获取文档列表',
      status: 'active',
      usage: 5234,
      avgResponseTime: 120,
      errorRate: 0.1,
    },
    {
      id: '2',
      path: '/api/v1/documents',
      method: 'POST',
      description: '上传新文档',
      status: 'active',
      usage: 856,
      avgResponseTime: 850,
      errorRate: 0.3,
    },
    {
      id: '3',
      path: '/api/v1/estimates',
      method: 'GET',
      description: '获取估算列表',
      status: 'active',
      usage: 3421,
      avgResponseTime: 95,
      errorRate: 0.05,
    },
    {
      id: '4',
      path: '/api/v1/queries',
      method: 'POST',
      description: '提交查询请求',
      status: 'active',
      usage: 2156,
      avgResponseTime: 1250,
      errorRate: 0.2,
    },
    {
      id: '5',
      path: '/api/v1/ai/chat',
      method: 'POST',
      description: 'AI对话接口',
      status: 'active',
      usage: 1876,
      avgResponseTime: 2100,
      errorRate: 0.8,
    },
  ]

  // 统计信息
  const stats = {
    totalKeys: apiKeys.length,
    activeKeys: apiKeys.filter(k => k.status === 'active').length,
    totalRequests: apiEndpoints.reduce((sum, e) => sum + e.usage, 0),
    avgResponseTime: Math.round(
      apiEndpoints.reduce((sum, e) => sum + e.avgResponseTime, 0) / apiEndpoints.length
    ),
  }

  // 创建新API密钥
  const handleCreateKey = async (values: any) => {
    setLoading(true)
    try {
      // 模拟创建
      await new Promise(resolve => setTimeout(resolve, 1000))
      const newKey: ApiKey = {
        id: Date.now().toString(),
        name: values.name,
        key: values.provider?.startsWith('sk-')
          ? `${values.provider}-${Math.random().toString(36).substring(2, 15)}`
          : `sk-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        permissions: values.permissions,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsed: '-',
        usageCount: 0,
        rateLimit: values.rateLimit,
        createdBy: 'current_user',
        description: values.description,
        provider: values.provider,
        model: values.model,
        costUsage: values.provider ? {
          totalCost: 0,
          currency: values.provider === 'openai' || values.provider === 'claude' ? 'USD' : 'CNY',
          inputTokens: 0,
          outputTokens: 0
        } : undefined
      }
      setApiKeys(prev => [...prev, newKey])
      message.success('API密钥创建成功')
      setModalVisible(false)
      form.resetFields()
    } catch (error) {
      message.error('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 删除API密钥
  const handleDeleteKey = (id: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== id))
    message.success('API密钥已删除')
  }

  // 复制API密钥
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    message.success('API密钥已复制到剪贴板')
  }

  // 撤销API密钥
  const handleRevokeKey = (id: string) => {
    setApiKeys(prev => prev.map(key =>
      key.id === id ? { ...key, status: 'revoked' as const } : key
    ))
    message.success('API密钥已撤销')
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="success">活跃</Tag>
      case 'inactive':
        return <Tag color="default">非活跃</Tag>
      case 'revoked':
        return <Tag color="error">已撤销</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 获取方法标签
  const getMethodTag = (method: string) => {
    const colors = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
    }
    return <Tag color={colors[method as keyof typeof colors]}>{method}</Tag>
  }

  // 获取提供商标签
  const getProviderTag = (provider?: string) => {
    if (!provider) return <Tag>未知</Tag>

    const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === provider)
    if (providerInfo) {
      return (
        <Tag color="blue">
          {providerInfo.displayName}
        </Tag>
      )
    }

    // 国际模型提供商
    const internationalProviders: Record<string, string> = {
      'openai': 'green',
      'claude': 'purple',
      'local': 'orange'
    }

    return (
      <Tag color={internationalProviders[provider] || 'default'}>
        {provider.toUpperCase()}
      </Tag>
    )
  }

  // API密钥表格列
  const keyColumns: ColumnsType<ApiKey> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ApiKey) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string, record: ApiKey) => (
        <Space direction="vertical" size="small">
          {getProviderTag(provider)}
          {record.model && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.model}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'API密钥',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Space>
          <Text code style={{ fontSize: '12px' }}>
            {key.substring(0, 20)}...
          </Text>
          <Tooltip title="复制密钥">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyKey(key)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.map(perm => (
            <Tag key={perm} size="small">{perm}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '成本使用',
      dataIndex: 'costUsage',
      key: 'costUsage',
      render: (costUsage?: { totalCost: number; currency: string; inputTokens: number; outputTokens: number }) => {
        if (!costUsage) return <Text type="secondary">-</Text>

        return (
          <Space direction="vertical" size="small">
            <Text strong>
              {costUsage.currency} {costUsage.totalCost.toFixed(2)}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              输入: {(costUsage.inputTokens / 1000).toFixed(1)}K
              {' '}
              输出: {(costUsage.outputTokens / 1000).toFixed(1)}K
            </Text>
          </Space>
        )
      },
      sorter: (a, b) => (a.costUsage?.totalCost || 0) - (b.costUsage?.totalCost || 0),
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      sorter: (a, b) => a.usageCount - b.usageCount,
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: ApiKey) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedKey(record)
                setDetailVisible(true)
              }}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="撤销密钥">
              <Popconfirm
                title="确定要撤销这个API密钥吗？"
                onConfirm={() => handleRevokeKey(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="text"
                  icon={<SafetyOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个API密钥吗？"
              onConfirm={() => handleDeleteKey(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  // API端点表格列
  const endpointColumns: ColumnsType<ApiEndpoint> = [
    {
      title: '端点',
      key: 'endpoint',
      render: (_, record: ApiEndpoint) => (
        <Space>
          {getMethodTag(record.method)}
          <Text code>{record.path}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={status === 'active' ? 'success' : 'default'} text={status === 'active' ? '正常' : '停用'} />
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage',
      key: 'usage',
      sorter: (a, b) => a.usage - b.usage,
    },
    {
      title: '平均响应时间',
      dataIndex: 'avgResponseTime',
      key: 'avgResponseTime',
      render: (time: number) => `${time}ms`,
      sorter: (a, b) => a.avgResponseTime - b.avgResponseTime,
    },
    {
      title: '错误率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      render: (rate: number) => (
        <Text type={rate > 0.5 ? 'danger' : rate > 0.1 ? 'warning' : 'success'}>
          {rate}%
        </Text>
      ),
      sorter: (a, b) => a.errorRate - b.errorRate,
    },
  ]

  // 渲染API密钥管理
  const renderKeyManagement = () => (
    <div>
      <Card
        title="API密钥管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            创建密钥
          </Button>
        }
      >
        <Table
          columns={keyColumns}
          dataSource={apiKeys}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Card>

      {/* 创建密钥弹窗 */}
      <Modal
        title="创建API密钥"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateKey}
        >
          <Form.Item
            label="密钥名称"
            name="name"
            rules={[{ required: true, message: '请输入密钥名称' }]}
          >
            <Input placeholder="例如：生产环境API密钥" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={2} placeholder="描述此密钥的用途" />
          </Form.Item>

          <Form.Item
            label="模型提供商"
            name="provider"
            rules={[{ required: true, message: '请选择模型提供商' }]}
          >
            <Select
              placeholder="选择模型提供商"
              onChange={(value) => {
                // 清空模型选择
                form.setFieldsValue({ model: undefined })
              }}
            >
              <Option value="openai">OpenAI</Option>
              <Option value="claude">Claude</Option>
              <Option value="local">本地模型</Option>
              {CHINESE_LLM_PROVIDERS.map(provider => (
                <Option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.provider !== currentValues.provider}
          >
            {({ getFieldValue }) => {
              const provider = getFieldValue('provider')
              if (!provider) return null

              // 获取当前提供商的可用模型
              const getModelsByProvider = (provider: string) => {
                if (provider === 'openai') {
                  return [
                    <Option key="gpt-4" value="gpt-4">GPT-4</Option>,
                    <Option key="gpt-3.5-turbo" value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                  ]
                }
                if (provider === 'claude') {
                  return [
                    <Option key="claude-3" value="claude-3">Claude 3</Option>
                  ]
                }
                if (provider === 'local') {
                  return [
                    <Option key="local-llm" value="local-llm">Local LLM</Option>
                  ]
                }

                // 国产模型
                const models = ALL_CHINESE_MODELS.filter(model => model.provider === provider)
                return models.map(model => (
                  <Option key={model.id} value={model.id}>
                    {model.displayName} ({model.contextLength.toLocaleString()} tokens)
                  </Option>
                ))
              }

              return (
                <Form.Item
                  label="选择模型"
                  name="model"
                  rules={[{ required: true, message: '请选择模型' }]}
                >
                  <Select placeholder="选择模型">
                    {getModelsByProvider(provider)}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item
            label="权限"
            name="permissions"
            rules={[{ required: true, message: '请选择权限' }]}
          >
            <Select mode="multiple" placeholder="选择权限">
              <Option value="read">读取</Option>
              <Option value="write">写入</Option>
              <Option value="admin">管理</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="速率限制(请求/小时)"
            name="rateLimit"
            rules={[{ required: true, message: '请输入速率限制' }]}
          >
            <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建密钥
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 密钥详情弹窗 */}
      <Modal
        title="API密钥详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedKey && (
          <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text strong>密钥信息</Text>
                <Card size="small" style={{ marginTop: 8 }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>名称:</Text>
                      <Text strong>{selectedKey.name}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>密钥:</Text>
                      <Space>
                        <Text code>{selectedKey.key}</Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopyKey(selectedKey.key)}
                        />
                      </Space>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>状态:</Text>
                      {getStatusTag(selectedKey.status)}
                    </div>
                  </Space>
                </Card>
              </div>

              <div>
                <Text strong>使用统计</Text>
                <Card size="small" style={{ marginTop: 8 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="总使用次数"
                        value={selectedKey.usageCount}
                        prefix={<BarChartOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="速率限制"
                        value={selectedKey.rateLimit}
                        suffix="/小时"
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="最后使用"
                        value={selectedKey.lastUsed}
                        valueStyle={{ fontSize: '14px' }}
                      />
                    </Col>
                  </Row>
                </Card>
              </div>

              {selectedKey.description && (
                <div>
                  <Text strong>描述</Text>
                  <Card size="small" style={{ marginTop: 8 }}>
                    <Text>{selectedKey.description}</Text>
                  </Card>
                </div>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )

  // 渲染API端点监控
  const renderEndpointMonitoring = () => (
    <Card title="API端点监控">
      <Table
        columns={endpointColumns}
        dataSource={apiEndpoints}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
      />
    </Card>
  )

  // 渲染使用统计
  const renderUsageStats = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总API密钥"
              value={stats.totalKeys}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃密钥"
              value={stats.activeKeys}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={stats.totalRequests}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={stats.avgResponseTime}
              suffix="ms"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        message="API使用说明"
        description="API密钥用于第三方系统集成，请妥善保管。如发现异常使用，请及时撤销密钥。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="使用指南">
        <List
          dataSource={[
            { title: '基础认证', description: '在请求头中添加 Authorization: Bearer YOUR_API_KEY' },
            { title: '速率限制', description: '每个密钥都有独立的速率限制，超出限制将返回429状态码' },
            { title: '错误处理', description: '请检查响应状态码，4xx表示客户端错误，5xx表示服务器错误' },
            { title: '版本控制', description: 'API版本在URL路径中指定，如 /api/v1/documents' },
          ]}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<ApiOutlined />}
                title={item.title}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>API管理</Title>
        <Paragraph type="secondary">
          管理API密钥、监控端点状态和查看使用统计
        </Paragraph>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="API密钥" key="keys">
          {renderKeyManagement()}
        </TabPane>
        <TabPane tab="端点监控" key="endpoints">
          {renderEndpointMonitoring()}
        </TabPane>
        <TabPane tab="使用统计" key="stats">
          {renderUsageStats()}
        </TabPane>
      </Tabs>
    </div>
  )
}

export default ApiManagementPage