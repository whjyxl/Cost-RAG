import React, { useState } from 'react'
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Row,
  Col,
  Divider,
  Space,
  message,
  Tabs,
  InputNumber,
  Alert,
  Table,
  Tag,
  Modal,
  Tooltip,
  Statistic,
} from 'antd'
import {
  SaveOutlined,
  SettingOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  SecurityScanOutlined,
  MonitorOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ApiOutlined,
  KeyOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd'

// 导入国产模型配置
import {
  CHINESE_LLM_PROVIDERS,
  ALL_CHINESE_MODELS,
  LLMProviderType,
  ChineseModelConfig,
  MODEL_CAPABILITY_TAGS,
  CHINESE_EMBEDDING_PROVIDERS,
  ALL_CHINESE_EMBEDDING_MODELS,
  EmbeddingProviderType,
  EmbeddingApiConfig,
  DEFAULT_EMBEDDING_CONFIG
} from '../../config/models'

// 导入Embedding模型选择器
import EmbeddingModelSelector from '../../components/EmbeddingModelSelector'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

interface SystemConfig {
  // 基本设置
  siteName: string
  siteDescription: string
  adminEmail: string
  timezone: string
  language: string
  dateFormat: string

  // 数据库设置
  dbHost: string
  dbPort: number
  dbName: string
  dbUsername: string
  dbPassword: string
  dbConnectionPool: number

  // 文件存储设置
  storageType: 'local' | 'aws' | 'aliyun'
  uploadPath: string
  maxFileSize: number
  allowedFileTypes: string[]

  // 邮件设置
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  smtpEncryption: 'none' | 'ssl' | 'tls'

  // 系统设置
  enableRegistration: boolean
  enableEmailVerification: boolean
  enableMaintenanceMode: boolean
  sessionTimeout: number
  maxLoginAttempts: number

  // AI设置 - 国际模型
  aiProvider: 'openai' | 'claude' | 'local'
  aiApiKey: string
  aiModel: string
  aiMaxTokens: number
  aiTemperature: number

  // 国产模型设置
  chineseLLMProvider: LLMProviderType
  chineseLLMModel: string
  chineseLLMApiKey: string
  chineseLLMMaxTokens: number
  chineseLLMTemperature: number
  enableChineseLLM: boolean

  // 国产模型高级配置
  chineseModelConfig: ChineseModelConfig

  // Embedding模型设置
  embeddingProvider: EmbeddingProviderType
  embeddingModel: string
  embeddingApiKey: string
  enableEmbedding: boolean
  embeddingConfig: EmbeddingApiConfig
}

interface SystemLog {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
  source: string
}

const SystemConfigPage: React.FC = () => {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingApiConfig>(DEFAULT_EMBEDDING_CONFIG)

  const [config, setConfig] = useState<SystemConfig>({
    // 基本设置
    siteName: 'Cost-RAG 智能造价系统',
    siteDescription: '基于AI的工程造价智能问答和估算平台',
    adminEmail: 'admin@cost-rag.com',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    dateFormat: 'YYYY-MM-DD',

    // 数据库设置
    dbHost: 'localhost',
    dbPort: 3306,
    dbName: 'cost_rag',
    dbUsername: 'root',
    dbPassword: '********',
    dbConnectionPool: 10,

    // 文件存储设置
    storageType: 'local',
    uploadPath: '/uploads',
    maxFileSize: 50,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'md', 'html'],

    // 邮件设置
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: 'noreply@cost-rag.com',
    smtpPassword: '********',
    smtpEncryption: 'tls',

    // 系统设置
    enableRegistration: true,
    enableEmailVerification: true,
    enableMaintenanceMode: false,
    sessionTimeout: 120,
    maxLoginAttempts: 5,

    // AI设置 - 国际模型
    aiProvider: 'openai',
    aiApiKey: 'sk-***************************',
    aiModel: 'gpt-4',
    aiMaxTokens: 4000,
    aiTemperature: 0.7,

    // 国产模型设置
    chineseLLMProvider: 'glm',
    chineseLLMModel: 'glm-3-turbo',
    chineseLLMApiKey: 'your-api-key-here',
    chineseLLMMaxTokens: 4000,
    chineseLLMTemperature: 0.7,
    enableChineseLLM: false,

    // 国产模型高级配置
    chineseModelConfig: {
      provider: 'glm',
      apiKey: 'your-api-key-here',
      model: 'glm-3-turbo',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 60000,
      retryCount: 3,
      enableCache: true,
      glmConfig: {
        searchEnabled: true,
        plugins: []
      }
    },

    // Embedding模型设置
    embeddingProvider: 'glm',
    embeddingModel: 'embedding-2',
    embeddingApiKey: 'your-embedding-api-key-here',
    enableEmbedding: false,
    embeddingConfig: DEFAULT_EMBEDDING_CONFIG
  })

  // 模拟系统日志
  const systemLogs: SystemLog[] = [
    {
      id: '1',
      level: 'info',
      message: '系统启动成功',
      timestamp: '2024-01-20 09:00:00',
      source: 'system',
    },
    {
      id: '2',
      level: 'info',
      message: '数据库连接正常',
      timestamp: '2024-01-20 09:00:05',
      source: 'database',
    },
    {
      id: '3',
      level: 'warning',
      message: '磁盘空间使用率达到 85%',
      timestamp: '2024-01-20 10:30:00',
      source: 'storage',
    },
    {
      id: '4',
      level: 'error',
      message: '邮件服务连接失败',
      timestamp: '2024-01-20 11:15:00',
      source: 'email',
    },
    {
      id: '5',
      level: 'info',
      message: '用户登录: zhang_engineer',
      timestamp: '2024-01-20 14:30:00',
      source: 'auth',
    },
  ]

  // 保存配置
  const handleSaveConfig = async (values: any) => {
    setLoading(true)
    try {
      // 模拟保存
      await new Promise(resolve => setTimeout(resolve, 1000))
      setConfig(prev => ({ ...prev, ...values }))
      message.success('系统配置已保存')
    } catch (error) {
      message.error('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 测试连接
  const handleTestConnection = async (type: string) => {
    setTestLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      message.success(`${type}连接测试成功`)
    } catch (error) {
      message.error(`${type}连接测试失败`)
    } finally {
      setTestLoading(false)
    }
  }

  // 获取日志级别标签
  const getLogLevelTag = (level: string) => {
    switch (level) {
      case 'info':
        return <Tag color="blue">信息</Tag>
      case 'warning':
        return <Tag color="orange">警告</Tag>
      case 'error':
        return <Tag color="red">错误</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 日志表格列
  const logColumns: ColumnsType<SystemLog> = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level) => getLogLevelTag(level),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source) => <Tag>{source}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
    },
  ]

  // 渲染基本设置
  const renderBasicSettings = () => (
    <Form
      form={form}
      layout="vertical"
      initialValues={config}
      onFinish={handleSaveConfig}
    >
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="网站名称"
            name="siteName"
            rules={[{ required: true, message: '请输入网站名称' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="管理员邮箱"
            name="adminEmail"
            rules={[
              { required: true, message: '请输入管理员邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="时区"
            name="timezone"
          >
            <Select>
              <Option value="Asia/Shanghai">Asia/Shanghai</Option>
              <Option value="Asia/Tokyo">Asia/Tokyo</Option>
              <Option value="America/New_York">America/New_York</Option>
              <Option value="Europe/London">Europe/London</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="语言"
            name="language"
          >
            <Select>
              <Option value="zh-CN">简体中文</Option>
              <Option value="en-US">English</Option>
              <Option value="ja-JP">日本語</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="网站描述"
        name="siteDescription"
      >
        <TextArea rows={3} />
      </Form.Item>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="日期格式"
            name="dateFormat"
          >
            <Select>
              <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
              <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
              <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="会话超时时间(分钟)"
            name="sessionTimeout"
          >
            <InputNumber min={5} max={480} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          icon={<SaveOutlined />}
        >
          保存设置
        </Button>
      </Form.Item>
    </Form>
  )

  // 渲染数据库设置
  const renderDatabaseSettings = () => (
    <Form
      layout="vertical"
      initialValues={config}
      onFinish={handleSaveConfig}
    >
      <Alert
        message="数据库配置"
        description="修改数据库配置需要重启系统才能生效"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="数据库主机"
            name="dbHost"
            rules={[{ required: true, message: '请输入数据库主机' }]}
          >
            <Input prefix={<DatabaseOutlined />} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="端口"
            name="dbPort"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="数据库名称"
            name="dbName"
            rules={[{ required: true, message: '请输入数据库名称' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="用户名"
            name="dbUsername"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="密码"
            name="dbPassword"
          >
            <Input.Password />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="连接池大小"
            name="dbConnectionPool"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SaveOutlined />}
          >
            保存设置
          </Button>
          <Button
            onClick={() => handleTestConnection('数据库')}
            loading={testLoading}
            icon={<CheckCircleOutlined />}
          >
            测试连接
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )

  // 渲染AI设置
  const renderAISettings = () => (
    <Form
      layout="vertical"
      initialValues={config}
      onFinish={handleSaveConfig}
    >
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="AI提供商"
            name="aiProvider"
          >
            <Select>
              <Option value="openai">OpenAI</Option>
              <Option value="claude">Claude</Option>
              <Option value="local">本地模型</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="模型"
            name="aiModel"
          >
            <Select>
              <Option value="gpt-4">GPT-4</Option>
              <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
              <Option value="claude-3">Claude 3</Option>
              <Option value="local-llm">Local LLM</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="API密钥"
        name="aiApiKey"
      >
        <Input.Password />
      </Form.Item>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="最大令牌数"
            name="aiMaxTokens"
          >
            <InputNumber min={100} max={32000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="温度参数"
            name="aiTemperature"
          >
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Alert
        message="AI配置说明"
        description="温度参数控制回复的随机性，0为最确定，2为最随机。建议值为0.7。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SaveOutlined />}
          >
            保存设置
          </Button>
          <Button
            onClick={() => handleTestConnection('AI服务')}
            loading={testLoading}
            icon={<CheckCircleOutlined />}
          >
            测试连接
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )

  // 渲染国产大模型设置
  const renderChineseLLMSettings = () => {
    // 根据选择的提供商获取可用模型
    const getChineseModelsByProvider = (provider: LLMProviderType) => {
      const models = ALL_CHINESE_MODELS.filter(model => model.provider === provider)
      return models.map(model => (
        <Option key={model.id} value={model.id}>
          {model.displayName} ({model.contextLength.toLocaleString()} tokens)
        </Option>
      ))
    }

    return (
      <Form
        layout="vertical"
        initialValues={config}
        onFinish={handleSaveConfig}
      >
        <Alert
          message="国产大模型配置"
          description="支持智谱AI、月之暗面、阿里千问、百度文心一言、深度求索、零一万物、科大讯飞星火等国产大模型服务"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="启用国产模型"
              name="enableChineseLLM"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="模型提供商"
              name="chineseLLMProvider"
            >
              <Select>
                {CHINESE_LLM_PROVIDERS.map(provider => (
                  <Option key={provider.id} value={provider.id}>
                    <Space>
                      <span>{provider.displayName}</span>
                      <Tag size="small" color="blue">{provider.models.length} 个模型</Tag>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="选择模型"
              name="chineseLLMModel"
            >
              <Select showSearch>
                {getChineseModelsByProvider(config.chineseLLMProvider)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="API密钥"
              name="chineseLLMApiKey"
            >
              <Input.Password placeholder="请输入API密钥" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="最大令牌数"
              name="chineseLLMMaxTokens"
            >
              <InputNumber
                min={100}
                max={128000}
                style={{ width: '100%' }}
                placeholder="4000"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="温度参数"
              name="chineseLLMTemperature"
            >
              <InputNumber
                min={0}
                max={2}
                step={0.1}
                style={{ width: '100%' }}
                placeholder="0.7"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 模型信息展示 */}
        <Card size="small" title="当前选择的模型信息" style={{ marginBottom: 16 }}>
          {(() => {
            const selectedModel = ALL_CHINESE_MODELS.find(
              model => model.id === config.chineseLLMModel
            )
            const provider = CHINESE_LLM_PROVIDERS.find(
              p => p.id === config.chineseLLMProvider
            )

            if (!selectedModel || !provider) {
              return <Text type="secondary">请选择模型和提供商</Text>
            }

            return (
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="上下文长度"
                    value={selectedModel.contextLength}
                    suffix="tokens"
                    prefix={<ThunderboltOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="输入价格"
                    value={selectedModel.pricing?.input || 0}
                    suffix={`¥/${selectedModel.pricing?.unit || '千tokens'}`}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="输出价格"
                    value={selectedModel.pricing?.output || 0}
                    suffix={`¥/${selectedModel.pricing?.unit || '千tokens'}`}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <div>
                    <Text strong>能力标签</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space wrap>
                        {Object.entries(selectedModel.capabilities)
                          .filter(([_, enabled]) => enabled)
                          .map(([capability]) => (
                            <Tag key={capability} size="small">
                              {MODEL_CAPABILITY_TAGS[capability]?.label || capability}
                            </Tag>
                          ))}
                      </Space>
                    </div>
                  </div>
                </Col>
              </Row>
            )
          })()}
        </Card>

        <Alert
          message="使用建议"
          description={
            <div>
              <div>• 智谱AI：综合能力强，适合通用对话和推理</div>
              <div>• 月之暗面：长上下文处理能力强，适合文档分析</div>
              <div>• 阿里千问：中文理解优秀，性价比高</div>
              <div>• 建议先测试连接，确认API密钥有效性</div>
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
            <Button
              onClick={() => handleTestConnection('国产大模型')}
              loading={testLoading}
              icon={<CheckCircleOutlined />}
            >
              测试连接
            </Button>
            <Button
              icon={<ApiOutlined />}
              onClick={() => {
                const provider = CHINESE_LLM_PROVIDERS.find(p => p.id === config.chineseLLMProvider)
                if (provider?.docsUrl) {
                  window.open(provider.docsUrl, '_blank')
                }
              }}
            >
              查看文档
            </Button>
          </Space>
        </Form.Item>
      </Form>
    )
  }

  // 渲染系统日志
  const renderSystemLogs = () => (
    <div>
      <Card
        title="系统日志"
        extra={
          <Button icon={<ReloadOutlined />}>
            刷新日志
          </Button>
        }
      >
        <Table
          columns={logColumns}
          dataSource={systemLogs}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Card>
    </div>
  )

  // 渲染Embedding模型设置
  const renderEmbeddingSettings = () => (
    <Form
      layout="vertical"
      initialValues={config}
      onFinish={handleSaveConfig}
    >
      <Alert
        message="Embedding模型配置"
        description="Embedding模型用于将文本转换为向量，支持语义搜索、文档相似度计算等功能"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="启用Embedding服务"
            name="enableEmbedding"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="API密钥"
            name="embeddingApiKey"
          >
            <Input.Password placeholder="请输入Embedding API密钥" />
          </Form.Item>
        </Col>
      </Row>

      {/* Embedding模型选择器 */}
      <Card size="small" title="Embedding模型选择" style={{ marginBottom: 16 }}>
        <EmbeddingModelSelector
          value={config.embeddingModel}
          onChange={(modelId, provider) => {
            // 更新配置
            const newConfig = {
              ...config,
              embeddingModel: modelId,
              embeddingProvider: provider
            }
            setConfig(newConfig)
          }}
          onConfigChange={(newEmbeddingConfig) => {
            setEmbeddingConfig(newEmbeddingConfig)
            // 同时更新到主配置中
            const newConfig = {
              ...config,
              embeddingConfig: newEmbeddingConfig
            }
            setConfig(newConfig)
          }}
          showConfig={true}
          showPricing={true}
          showCapabilities={true}
          showComparison={true}
          groupByProvider={true}
        />
      </Card>

      {/* 当前选择的模型信息展示 */}
      <Card size="small" title="当前配置信息" style={{ marginBottom: 16 }}>
        {(() => {
          const selectedModel = ALL_CHINESE_EMBEDDING_MODELS.find(
            model => model.id === config.embeddingModel
          )
          const provider = CHINESE_EMBEDDING_PROVIDERS.find(
            p => p.id === config.embeddingProvider
          )

          if (!selectedModel || !provider) {
            return <Text type="secondary">请选择Embedding模型和提供商</Text>
          }

          return (
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="向量维度"
                  value={selectedModel.dimensions}
                  suffix="维"
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="最大Tokens"
                  value={selectedModel.maxTokens.toLocaleString()}
                  suffix="tokens"
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="输入价格"
                  value={selectedModel.pricing?.input || 0}
                  suffix={`¥/${selectedModel.pricing?.unit || '千tokens'}`}
                  prefix={<DollarOutlined />}
                />
              </Col>
              <Col span={6}>
                <div>
                  <Text strong>支持能力</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {Object.entries(selectedModel.capabilities)
                        .filter(([_, enabled]) => enabled)
                        .map(([capability]) => (
                          <Tag key={capability} size="small" color="blue">
                            {capability === 'multilingual' ? '多语言' :
                             capability === 'semantic_search' ? '语义搜索' :
                             capability === 'classification' ? '文本分类' :
                             capability === 'clustering' ? '聚类分析' :
                             capability === 'reranking' ? '重排序' :
                             capability === 'code_embedding' ? '代码嵌入' :
                             capability === 'long_text' ? '长文本' : capability}
                          </Tag>
                        ))}
                    </Space>
                  </div>
                </div>
              </Col>
            </Row>
          )
        })()}
      </Card>

      <Alert
        message="使用建议"
        description={
          <div>
            <div>• 智谱AI BGE系列：中文语义理解优秀，适合通用场景</div>
            <div>• 月之暗面：长文本处理能力强，适合文档向量化</div>
            <div>• 阿里千问：性价比高，中文支持好</div>
            <div>• 建议根据实际需求选择合适的向量维度和模型能力</div>
          </div>
        }
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SaveOutlined />}
          >
            保存设置
          </Button>
          <Button
            onClick={() => handleTestConnection('Embedding服务')}
            loading={testLoading}
            icon={<CheckCircleOutlined />}
          >
            测试连接
          </Button>
          <Button
            icon={<ApiOutlined />}
            onClick={() => {
              const provider = CHINESE_EMBEDDING_PROVIDERS.find(p => p.id === config.embeddingProvider)
              if (provider?.docsUrl) {
                window.open(provider.docsUrl, '_blank')
              }
            }}
          >
            查看文档
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>系统配置</Title>
        <Paragraph type="secondary">
          配置系统参数、数据库连接、AI服务和系统设置
        </Paragraph>
      </div>

      {/* 系统状态概览 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Space>
                <DatabaseOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text strong>数据库状态</Text>
                  <br />
                  <Text type="success">正常运行</Text>
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Space>
                <CloudServerOutlined style={{ color: '#1890ff' }} />
                <div>
                  <Text strong>存储状态</Text>
                  <br />
                  <Text type="warning">85% 使用率</Text>
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Space>
                <SecurityScanOutlined style={{ color: '#faad14' }} />
                <div>
                  <Text strong>安全状态</Text>
                  <br />
                  <Text type="warning">需要更新</Text>
                </div>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Space>
                <MonitorOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text strong>系统性能</Text>
                  <br />
                  <Text type="success">良好</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 配置标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本设置" key="basic">
            {renderBasicSettings()}
          </TabPane>
          <TabPane tab="数据库设置" key="database">
            {renderDatabaseSettings()}
          </TabPane>
          <TabPane tab="AI设置" key="ai">
            {renderAISettings()}
          </TabPane>
          <TabPane tab="国产大模型" key="chinese-llm">
            {renderChineseLLMSettings()}
          </TabPane>
          <TabPane tab="Embedding模型" key="embedding">
            {renderEmbeddingSettings()}
          </TabPane>
          <TabPane tab="系统日志" key="logs">
            {renderSystemLogs()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default SystemConfigPage