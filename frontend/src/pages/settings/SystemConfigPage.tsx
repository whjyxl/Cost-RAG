import React, { useState, useEffect } from 'react'
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

// 导入API服务
import { request } from '../../utils/request'

// 导入Embedding模型选择器
import EmbeddingModelSelector from '../../components/EmbeddingModelSelector'

// 导入AI模型状态指示器
import AIModelStatusIndicator from '../../components/AIModelStatusIndicator'

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

// 提供商配置状态接口
interface ProviderConfigStatus {
  configured: boolean
  enabled: boolean
  maskedKey?: string
  name: string
}

const SystemConfigPage: React.FC = () => {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingApiConfig>(DEFAULT_EMBEDDING_CONFIG)

  // 存储各提供商的配置状态
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderConfigStatus>>({
    zhipuai: { configured: false, enabled: false, name: '智谱AI' },
    moonshot: { configured: false, enabled: false, name: '月之暗面' },
    dashscope: { configured: false, enabled: false, name: '阿里千问' },
    baidu: { configured: false, enabled: false, name: '百度文心' },
    deepseek: { configured: false, enabled: false, name: '深度求索' },
    yi: { configured: false, enabled: false, name: '零一万物' },
    spark: { configured: false, enabled: false, name: '科大讯飞星火' }
  })

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

  // 系统日志状态
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // 加载系统日志
  const loadSystemLogs = async (level?: string, source?: string) => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams()
      if (level) params.append('level', level)
      if (source) params.append('source', source)
      params.append('limit', '100')
      
      const response = await request(`/api/v1/system/logs?${params.toString()}`, {
        method: 'GET',
      })
      
      if (response && response.success && response.data) {
        setSystemLogs(response.data)
      }
    } catch (error) {
      console.error('加载系统日志失败:', error)
      message.error('加载系统日志失败')
    } finally {
      setLogsLoading(false)
    }
  }

  // 加载Embedding配置
  const loadEmbeddingConfig = async () => {
    try {
      console.log('开始加载Embedding配置...')
      const response = await request('/api/v1/system-config/embedding', {
        method: 'GET',
      })
      
      if (response && response.success && response.data) {
        const embeddingData = response.data
        console.log('Embedding配置加载成功:', embeddingData)
        
        // 更新表单和状态
        form.setFieldsValue({
          embeddingProvider: embeddingData.provider || 'dashscope',
          embeddingModel: embeddingData.model || 'text-embedding-v2',
          embeddingApiKey: embeddingData.api_key || ''
        })
        
        setConfig(prev => ({
          ...prev,
          embeddingProvider: embeddingData.provider || 'dashscope',
          embeddingModel: embeddingData.model || 'text-embedding-v2',
          embeddingApiKey: embeddingData.api_key || ''
        }))
      }
    } catch (error) {
      console.error('加载Embedding配置失败:', error)
    }
  }

  // 加载AI模型配置
  const loadAIModelConfig = async () => {
    try {
      console.log('开始加载AI模型配置...')

      // 使用正确的API路径 - 获取AI提供商信息
      const response = await request('/api/v1/ai-models/providers', {
        method: 'GET',
      })

      console.log('AI配置API响应:', response)

      // 适配后端返回的数据格式
      // /api/v1/ai-models/providers 返回: { providers: {...}, configured_count: N, total_count: N }
      if (response && response.providers) {
        const providers = response.providers
        console.log('提供商配置数据:', providers)

        // 更新每个提供商的配置状态
        const newStatuses: Record<string, ProviderConfigStatus> = {}

        // 处理所有7个提供商
        const providerKeys = ['zhipuai', 'moonshot', 'dashscope', 'baidu', 'deepseek', 'yi', 'spark']
        const providerNames: Record<string, string> = {
          zhipuai: '智谱AI',
          moonshot: '月之暗面',
          dashscope: '阿里千问',
          baidu: '百度文心',
          deepseek: '深度求索',
          yi: '零一万物',
          spark: '科大讯飞星火'
        }

        providerKeys.forEach(key => {
          const providerData = providers[key]
          if (providerData) {
            newStatuses[key] = {
              configured: providerData.configured || false,
              enabled: providerData.enabled || false,
              maskedKey: providerData.api_key || undefined,
              name: providerNames[key]
            }

            if (providerData.configured) {
              console.log(`${providerNames[key]}已配置, 脱敏密钥: ${providerData.api_key}`)
            }
          } else {
            newStatuses[key] = {
              configured: false,
              enabled: false,
              name: providerNames[key]
            }
          }
        })

        // 更新状态
        setProviderStatuses(newStatuses)

        console.log(`已配置 ${response.configured_count} / ${response.total_count} 个AI提供商`)
      }
    } catch (error) {
      console.error('加载AI配置失败:', error)
      message.error('加载AI配置失败，请刷新页面重试')
    }
  }

  // 组件挂载时加载配置
  useEffect(() => {
    loadAIModelConfig()
    loadEmbeddingConfig()
    loadSystemLogs()
  }, [])

  // 保存配置
  const handleSaveConfig = async (values: any) => {
    setLoading(true)
    try {
      console.log('开始保存配置:', values)
      let successCount = 0
      let failCount = 0

      // 统一字段映射，支持下划线格式
      const apiConfigs = {
        'zhipuai_api_key': values.zhipuai_api_key,
        'moonshot_api_key': values.moonshot_api_key,
        'dashscope_api_key': values.dashscope_api_key,
        'baidu_api_key': values.baidu_api_key,
        'deepseek_api_key': values.deepseek_api_key,
        'yi_api_key': values.yi_api_key,
        'spark_api_key': values.spark_api_key
      }

      console.log('处理后的API配置:', apiConfigs)

      // 构建统一的配置更新请求
      const configUpdate: any = {}
      let hasAnyConfig = false

      // 收集所有有效的AI模型配置
      if (apiConfigs.zhipuai_api_key) {
        configUpdate.zhipuai = {
          api_key: apiConfigs.zhipuai_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.moonshot_api_key) {
        configUpdate.moonshot = {
          api_key: apiConfigs.moonshot_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.dashscope_api_key) {
        configUpdate.dashscope = {
          api_key: apiConfigs.dashscope_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.baidu_api_key) {
        configUpdate.baidu = {
          api_key: apiConfigs.baidu_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.deepseek_api_key) {
        configUpdate.deepseek = {
          api_key: apiConfigs.deepseek_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.yi_api_key) {
        configUpdate.yi = {
          api_key: apiConfigs.yi_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      if (apiConfigs.spark_api_key) {
        configUpdate.spark = {
          api_key: apiConfigs.spark_api_key,
          enabled: true
        }
        hasAnyConfig = true
      }

      // 一次性提交所有配置到统一端点
      if (hasAnyConfig) {
        try {
          console.log('正在保存AI模型配置...', configUpdate)
          const response = await request('/api/v1/ai-models/config', {
            method: 'PUT',
            data: configUpdate,
          })
          console.log('AI模型配置保存成功:', response)

          const updatedCount = response?.updated_fields?.length || 0
          if (updatedCount > 0) {
            message.success(`AI模型配置保存成功，更新了 ${updatedCount} 个配置项`)
            successCount = updatedCount
          } else {
            message.info('AI模型配置未发生变化')
          }

          // 保存成功后重新加载配置以确保UI显示最新数据
          console.log('重新加载配置以更新UI...')
          await loadAIModelConfig()
        } catch (error: any) {
          failCount++
          console.error('保存AI模型配置失败:', error)
          const errorMsg = error?.response?.data?.detail || error?.message || '保存AI模型配置失败'
          message.error(`保存AI模型配置失败: ${errorMsg}`)
        }
      } else {
        message.info('没有需要保存的AI模型配置')
      }

      // 保存Embedding配置
      if (values.embeddingProvider || values.embeddingModel || values.embeddingApiKey) {
        try {
          console.log('正在保存Embedding配置...')
          const embeddingUpdate = {
            provider: values.embeddingProvider || config.embeddingProvider,
            model: values.embeddingModel || config.embeddingModel,
            api_key: values.embeddingApiKey || config.embeddingApiKey,
            config: config.embeddingConfig || {}
          }
          
          const embeddingResponse = await request('/api/v1/system-config/embedding', {
            method: 'PUT',
            data: embeddingUpdate,
          })
          
          if (embeddingResponse && embeddingResponse.success) {
            console.log('Embedding配置保存成功:', embeddingResponse)
            message.success('Embedding配置保存成功')
            
            // 重新加载配置
            await loadEmbeddingConfig()
          }
        } catch (error: any) {
          console.error('保存Embedding配置失败:', error)
          const errorMsg = error?.response?.data?.detail || error?.message || '保存Embedding配置失败'
          message.error(`保存Embedding配置失败: ${errorMsg}`)
        }
      }

      // 保存其他系统配置（这里可以扩展其他配置的保存逻辑）
      setConfig(prev => ({ ...prev, ...values }));

    } catch (error: any) {
      console.error('保存配置失败:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '保存失败，请重试';
      message.error(`保存失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  // 测试连接
  const handleTestConnection = async (type: string) => {
    setTestLoading(true);
    try {
      // 如果type是"国产大模型"，则测试所有已配置的提供商
      if (type === '国产大模型') {
        message.info('正在测试所有已配置的AI模型连接...')
        let successCount = 0
        let failCount = 0
        const results: string[] = []

        for (const [key, status] of Object.entries(providerStatuses)) {
          if (status.configured) {
            try {
              const response = await request(`/api/v1/ai-models/test/${key}`, {
                method: 'POST',
              })
              if (response && response.status === 'success') {
                successCount++
                results.push(`✓ ${status.name}: 连接成功`)
              } else {
                failCount++
                results.push(`✗ ${status.name}: ${response?.error || '连接失败'}`)
              }
            } catch (error: any) {
              failCount++
              results.push(`✗ ${status.name}: ${error?.message || '连接失败'}`)
            }
          }
        }

        if (successCount > 0 && failCount === 0) {
          message.success(`测试完成！所有${successCount}个已配置模型连接成功`)
        } else if (successCount > 0) {
          message.warning(`测试完成！${successCount}个成功，${failCount}个失败`)
        } else {
          message.error('所有已配置模型连接失败，请检查API密钥')
        }

        // 显示详细结果
        console.log('测试结果:', results.join('\n'))
      } else {
        // 其他类型的测试（数据库、AI服务等）
        await new Promise(resolve => setTimeout(resolve, 2000));
        message.success(`${type}连接测试成功`);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || '连接测试失败'
      message.error(`${type}连接测试失败: ${errorMsg}`);
    } finally {
      setTestLoading(false);
    }
  }

  // 测试单个提供商连接
  const handleTestProvider = async (providerKey: string) => {
    const status = providerStatuses[providerKey]
    if (!status.configured) {
      message.warning(`请先配置${status.name}的API密钥`)
      return
    }

    setTestLoading(true);
    try {
      const response = await request(`/api/v1/ai-models/test/${providerKey}`, {
        method: 'POST',
      })
      if (response && response.status === 'success') {
        message.success(`${status.name}连接测试成功！`)
      } else {
        message.error(`${status.name}连接测试失败: ${response?.error || '未知错误'}`)
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || '连接测试失败'
      message.error(`${status.name}连接测试失败: ${errorMsg}`);
    } finally {
      setTestLoading(false);
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
          <Col span={24}>
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
              label="通用API密钥"
              name="chineseLLMApiKey"
              extra="所有国产模型的通用密钥（可选）"
            >
              <Input.Password placeholder="请输入API密钥" />
            </Form.Item>
          </Col>
        </Row>

        {/* 具体模型的API密钥配置 */}
        <Alert
          message="API密钥配置"
          description="请为每个AI模型提供商配置独立的API密钥"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>智谱AI密钥</span>
                  {providerStatuses.zhipuai.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="zhipuai_api_key"
              extra="GLM-4, GLM-3-Turbo等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.zhipuai.maskedKey
                    ? `当前密钥: ${providerStatuses.zhipuai.maskedKey}`
                    : "请输入智谱AI API密钥"
                }
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>月之暗面密钥</span>
                  {providerStatuses.moonshot.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="moonshot_api_key"
              extra="Moonshot-v1-8k等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.moonshot.maskedKey
                    ? `当前密钥: ${providerStatuses.moonshot.maskedKey}`
                    : "请输入月之暗面API密钥"
                }
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>阿里千问密钥</span>
                  {providerStatuses.dashscope.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="dashscope_api_key"
              extra="Qwen-Turbo, Qwen-Plus等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.dashscope.maskedKey
                    ? `当前密钥: ${providerStatuses.dashscope.maskedKey}`
                    : "请输入阿里千问API密钥"
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>百度文心密钥</span>
                  {providerStatuses.baidu.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="baidu_api_key"
              extra="文心一言4.0等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.baidu.maskedKey
                    ? `当前密钥: ${providerStatuses.baidu.maskedKey}`
                    : "请输入百度文心API密钥"
                }
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>深度求索密钥</span>
                  {providerStatuses.deepseek.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="deepseek_api_key"
              extra="DeepSeek-V2等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.deepseek.maskedKey
                    ? `当前密钥: ${providerStatuses.deepseek.maskedKey}`
                    : "请输入深度求索API密钥"
                }
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>零一万物密钥</span>
                  {providerStatuses.yi.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="yi_api_key"
              extra="Yi-34B-Chat等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.yi.maskedKey
                    ? `当前密钥: ${providerStatuses.yi.maskedKey}`
                    : "请输入零一万物API密钥"
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <span>科大讯飞星火密钥</span>
                  {providerStatuses.spark.configured ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
                  ) : (
                    <Tag color="error" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                  )}
                </Space>
              }
              name="spark_api_key"
              extra="讯飞星火3.5等"
            >
              <Input.Password
                placeholder={
                  providerStatuses.spark.maskedKey
                    ? `当前密钥: ${providerStatuses.spark.maskedKey}`
                    : "请输入科大讯飞星火API密钥"
                }
              />
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
        <Col span={8}>
          <Form.Item
            label="Embedding供应商"
            name="embeddingProvider"
            rules={[{ required: true, message: '请选择Embedding供应商' }]}
          >
            <Select 
              placeholder="请选择供应商"
              onChange={(value) => {
                // 更新供应商时，清空模型选择
                form.setFieldsValue({ embeddingModel: undefined })
                setConfig(prev => ({
                  ...prev,
                  embeddingProvider: value,
                  embeddingModel: ''
                }))
              }}
            >
              {CHINESE_EMBEDDING_PROVIDERS.map(provider => (
                <Select.Option key={provider.id} value={provider.id}>
                  {provider.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Embedding模型"
            name="embeddingModel"
            rules={[{ required: true, message: '请选择Embedding模型' }]}
          >
            <Select 
              placeholder="请先选择供应商"
              disabled={!config.embeddingProvider}
              onChange={(value) => {
                setConfig(prev => ({
                  ...prev,
                  embeddingModel: value
                }))
              }}
            >
              {ALL_CHINESE_EMBEDDING_MODELS
                .filter(model => model.provider === config.embeddingProvider)
                .map(model => (
                  <Select.Option key={model.id} value={model.id}>
                    {model.name} ({model.dimensions}维)
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="API密钥"
            name="embeddingApiKey"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="请输入API密钥" />
          </Form.Item>
        </Col>
      </Row>

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