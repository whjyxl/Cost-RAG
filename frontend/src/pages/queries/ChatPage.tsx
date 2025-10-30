import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Avatar,
  List,
  Tag,
  Tooltip,
  Spin,
  Empty,
  message,
  Drawer,
  Descriptions,
  Badge,
  Dropdown,
  MenuProps,
  Row,
  Col,
  Modal,
  Tabs,
  Switch,
  Divider,
} from 'antd'
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  HistoryOutlined,
  StarOutlined,
  MoreOutlined,
  ClearOutlined,
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  FileTextOutlined,
  BulbOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  BranchesOutlined,
  ShareAltOutlined,
  DatabaseOutlined,
  NodeIndexOutlined,
  CalculatorOutlined,
  EyeOutlined,
  FilterOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import type { MenuProps as AntdMenuProps } from 'antd'

// 导入模型配置
import {
  CHINESE_LLM_PROVIDERS,
  ALL_CHINESE_MODELS,
  LLMProviderType,
  LLMModel
} from '../../config/models'
import ModelSelector from '../../components/ModelSelector'
import KnowledgeGraphPanel from '../../components/knowledge/KnowledgeGraphPanel'
import DataSourceSelector from '../../components/queries/DataSourceSelector'
import UnifiedResultsDisplay from '../../components/queries/UnifiedResultsDisplay'
import { GraphNode } from '@/types'
import knowledgeGraphApi from '@/services/knowledgeGraphApi'
import { unifiedQueryManager } from '@/services/unifiedQueryManager'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

// 当前选中的模型配置
interface CurrentModelConfig {
  provider: LLMProviderType
  model: string
  modelName: string
  providerName: string
  contextLength?: number
  pricing?: {
    input: number
    output: number
    currency: string
    unit: string
  }
}

interface Message {
  id: string
  content: string
  type: 'user' | 'assistant'
  timestamp: string
  relatedDocs?: RelatedDocument[]
  status?: 'sending' | 'sent' | 'error'
  feedback?: 'positive' | 'negative'
  tokens?: number
}

interface RelatedDocument {
  id: string
  title: string
  source: string
  relevanceScore: number
  snippet: string
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  lastMessage: string
  messageCount: number
  modelConfig?: CurrentModelConfig
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('default')
  const [relatedDocsVisible, setRelatedDocsVisible] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [knowledgeGraphVisible, setKnowledgeGraphVisible] = useState(false)
  const [knowledgeGraphCollapsed, setKnowledgeGraphCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  // 模型相关状态
  const [currentModel, setCurrentModel] = useState<CurrentModelConfig>({
    provider: 'glm',
    model: 'glm-3-turbo',
    modelName: 'GLM-3-turbo',
    providerName: '智谱AI',
    contextLength: 128000,
    pricing: {
      input: 0.005,
      output: 0.005,
      currency: 'CNY',
      unit: 'tokens'
    }
  })
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false)

  // 多源查询相关状态
  const [unifiedQueryMode, setUnifiedQueryMode] = useState(false)
  const [dataSourceSelectorVisible, setDataSourceSelectorVisible] = useState(false)
  const [selectedDataSources, setSelectedDataSources] = useState<any[]>([])
  const [unifiedResponse, setUnifiedResponse] = useState<any>(null)
  const [unifiedQueryContext, setUnifiedQueryContext] = useState<any>(null)
  const [unifiedResultsVisible, setUnifiedResultsVisible] = useState(false)

  // 模型选择处理
  const handleModelChange = (provider: LLMProviderType, modelId: string) => {
    // 查找模型信息
    const model = ALL_CHINESE_MODELS.find(m => m.id === modelId)
    if (model) {
      const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === provider)
      const newModelConfig: CurrentModelConfig = {
        provider,
        model: modelId,
        modelName: model.displayName,
        providerName: providerInfo?.displayName || provider,
        contextLength: model.contextLength,
        pricing: model.pricing
      }
      setCurrentModel(newModelConfig)

      // 更新当前会话的模型配置
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, modelConfig: newModelConfig }
          : session
      ))

      message.success(`已切换到 ${providerInfo?.displayName} - ${model.displayName}`)
    }
    setModelSelectorVisible(false)
  }

  // 模拟会话数据
  useEffect(() => {
    const mockSessions: ChatSession[] = [
      {
        id: 'default',
        title: '默认对话',
        messages: [
          {
            id: '1',
            content: `您好！我是Cost-RAG智能助手，当前使用的是 ${currentModel.providerName} - ${currentModel.modelName} 模型。可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗？`,
            type: 'assistant',
            timestamp: '2024-01-20 10:00:00',
            status: 'sent',
          },
        ],
        createdAt: '2024-01-20 10:00:00',
        lastMessage: '您好！我是Cost-RAG智能助手...',
        messageCount: 1,
        modelConfig: currentModel,
      },
    ]
    setSessions(mockSessions)
    setMessages(mockSessions[0].messages)
  }, [])

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      type: 'user',
      timestamp: new Date().toLocaleString(),
      status: 'sent',
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    if (unifiedQueryMode && selectedDataSources.length > 0) {
      // 统一查询模式
      await handleUnifiedQuery(inputValue.trim())
    } else {
      // 传统模拟响应
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: generateMockResponse(inputValue.trim()),
          type: 'assistant',
          timestamp: new Date().toLocaleString(),
          status: 'sent',
          relatedDocs: generateMockRelatedDocs(),
          tokens: Math.floor(Math.random() * 500) + 200,
        }

        setMessages(prev => [...prev, assistantMessage])
        setLoading(false)
        scrollToBottom()
      }, 1500)
    }
  }

  // 处理统一查询
  const handleUnifiedQuery = async (query: string) => {
    try {
      // 构建查询上下文
      const context = {
        userId: 'user_' + Date.now(),
        sessionId: currentSessionId,
        currentQuery: query,
        queryHistory: messages.slice(-5).map(m => m.content),
        preferences: {
          preferredSources: selectedDataSources.map(s => s.type),
          language: 'zh-CN',
          fusionStrategy: 'weighted'
        }
      }

      setUnifiedQueryContext(context)

      // 执行统一查询
      const response = await unifiedQueryManager.executeQuery({
        query,
        dataSources: selectedDataSources,
        context: query,
        priorities: selectedDataSources.map(s => ({
          sourceType: s.type,
          priority: s.priority || 1,
          weight: s.weight || 1.0,
          reason: `${s.displayName}的权重配置`
        })),
        maxResults: 20,
        sessionId: currentSessionId,
        userId: context.userId
      })

      setUnifiedResponse(response)

      // 构建AI消息
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.success ? response.fusedAnswer : `查询失败: ${response.error}`,
        type: 'assistant',
        timestamp: new Date().toLocaleString(),
        status: 'sent',
        relatedDocs: response.sourceResults.map(r => ({
          id: r.source.id,
          title: r.source.displayName,
          snippet: r.data ? JSON.stringify(r.data).substring(0, 200) + '...' : '',
          relevance: r.confidence,
          source: r.source.type
        })),
        tokens: Math.floor(Math.random() * 800) + 300,
        unifiedResponse: response
      }

      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)
      scrollToBottom()

    } catch (error) {
      console.error('统一查询失败:', error)
      message.error('查询过程中出现错误，请稍后重试')
      setLoading(false)
    }
  }

  // 生成模拟响应
  const generateMockResponse = (question: string): string => {
    const responses = [
      '根据您的问题，我需要更多信息来给出准确的回答。请问您能提供更多背景信息吗？',
      '这是一个很好的问题。基于我对工程造价管理的理解，我建议您可以从以下几个方面来考虑...',
      '根据相关的工程造价管理规范，这个问题的答案如下...',
      '我理解您的需求。基于Cost-RAG系统中的文档资料，我可以为您提供以下信息...',
      '这是一个复杂的技术问题。建议您参考相关的技术文档或咨询专业的工程造价师。',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // 生成模拟相关文档
  const generateMockRelatedDocs = (): RelatedDocument[] => {
    const docs: RelatedDocument[] = [
      {
        id: '1',
        title: '工程造价管理规范',
        source: '工程造价管理规范.pdf',
        relevanceScore: 0.95,
        snippet: '本规范详细阐述了工程造价管理的各项标准和要求...',
      },
      {
        id: '2',
        title: '建筑项目预算编制指南',
        source: '预算编制指南.docx',
        relevanceScore: 0.87,
        snippet: '预算编制应遵循以下基本原则...',
      },
      {
        id: '3',
        title: '施工合同管理要点',
        source: '合同管理手册.pdf',
        relevanceScore: 0.82,
        snippet: '施工合同管理是项目成本控制的关键环节...',
      },
    ]
    return docs.slice(0, Math.floor(Math.random() * 3) + 1)
  }

  // 复制消息
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    message.success('已复制到剪贴板')
  }

  // 消息反馈
  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ))
    message.success('感谢您的反馈')
  }

  // 查看相关文档
  const handleViewRelatedDocs = (message: Message) => {
    setSelectedMessage(message)
    setRelatedDocsVisible(true)
  }

  // 知识图谱节点选择处理
  const handleGraphNodeSelect = (node: GraphNode) => {
    // 基于选择的节点构建问题
    const question = `请详细介绍一下${node.label}这个${node.type === NodeType.PROJECT ? '项目' :
                      node.type === NodeType.MATERIAL ? '材料' :
                      node.type === NodeType.ACTIVITY ? '活动' :
                      node.type === NodeType.RESOURCE ? '资源' :
                      node.type === NodeType.SPECIFICATION ? '规范' : '法规'}`

    setInputValue(question)
    setKnowledgeGraphVisible(false)

    message.success(`已基于"${node.label}"生成问题`)
  }

  // 基于知识图谱上下文进行问答
  const handleQueryWithGraph = (contextQuery: string, contextNodes: string[]) => {
    const fullQuery = contextQuery ? `${contextQuery}，请基于这些实体信息进行回答。` : inputValue.trim()

    if (fullQuery) {
      setInputValue(fullQuery)
      setKnowledgeGraphVisible(false)

      // 自动发送问题
      setTimeout(() => {
        handleSend()
      }, 500)
    }
  }

  // 新建对话
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [
        {
          id: Date.now().toString(),
          content: '您好！我是Cost-RAG智能助手，可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗？',
          type: 'assistant',
          timestamp: new Date().toLocaleString(),
          status: 'sent',
        },
      ],
      createdAt: new Date().toLocaleString(),
      lastMessage: '您好！我是Cost-RAG智能助手...',
      messageCount: 1,
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setMessages(newSession.messages)
  }

  // 清空对话
  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        content: '您好！我是Cost-RAG智能助手，可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗？',
        type: 'assistant',
        timestamp: new Date().toLocaleString(),
        status: 'sent',
      },
    ])
    message.success('对话已清空')
  }

  // 处理统一查询结果反馈
  const handleResultFeedback = (feedback: {
    rating: number
    category: string
    comment: string
    issueId?: string
  }) => {
    console.log('User feedback:', feedback)
    message.success('感谢您的反馈！')
  }

  // 导出查询结果
  const handleExportResults = () => {
    if (!unifiedResponse) return

    const exportData = {
      query: unifiedResponse.queryId,
      timestamp: unifiedResponse.timestamp,
      answer: unifiedResponse.fusedAnswer,
      confidence: unifiedResponse.confidence,
      sources: unifiedResponse.sourceResults,
      executionTime: unifiedResponse.executionTime,
      recommendations: unifiedResponse.recommendations
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `query_result_${Date.now()}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()

    message.success('查询结果已导出')
  }

  // 分享查询结果
  const handleShareResults = () => {
    if (!unifiedResponse) return

    // 模拟分享功能
    const shareUrl = `${window.location.origin}/shared-query/${unifiedResponse.queryId}`

    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('分享链接已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败，请手动复制链接')
    })
  }

  // 会话菜单
  const sessionMenuItems: AntdMenuProps['items'] = sessions.map(session => ({
    key: session.id,
    label: (
      <Space>
        <Text ellipsis style={{ maxWidth: 200 }}>{session.title}</Text>
        <Badge count={session.messageCount} size="small" />
      </Space>
    ),
    onClick: () => {
      setCurrentSessionId(session.id)
      setMessages(session.messages)
    },
  }))

  // 渲染消息
  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      style={{
        display: 'flex',
        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      {message.type === 'assistant' && (
        <Avatar
          icon={<RobotOutlined />}
          style={{
            backgroundColor: '#1890ff',
            marginRight: 12,
          }}
        />
      )}
      <div
        style={{
          maxWidth: '70%',
          backgroundColor: message.type === 'user' ? '#1890ff' : '#f5f5f5',
          color: message.type === 'user' ? '#fff' : '#000',
          padding: '12px 16px',
          borderRadius: '12px',
          wordBreak: 'break-word',
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <Text style={{ color: message.type === 'user' ? '#fff' : '#666' }}>
            {message.timestamp}
          </Text>
        </div>
        <Paragraph style={{
          margin: 0,
          color: message.type === 'user' ? '#fff' : '#000'
        }}>
          {message.content}
        </Paragraph>

        {/* AI消息的操作按钮 */}
        {message.type === 'assistant' && message.status === 'sent' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <Space split>
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(message.content)}
                  style={{ color: message.type === 'user' ? '#fff' : '#666' }}
                />
              </Tooltip>
              <Tooltip title="点赞">
                <Button
                  type="text"
                  size="small"
                  icon={<LikeOutlined />}
                  onClick={() => handleFeedback(message.id, 'positive')}
                  style={{
                    color: message.feedback === 'positive' ? '#52c41a' : (message.type === 'user' ? '#fff' : '#666')
                  }}
                />
              </Tooltip>
              <Tooltip title="点踩">
                <Button
                  type="text"
                  size="small"
                  icon={<DislikeOutlined />}
                  onClick={() => handleFeedback(message.id, 'negative')}
                  style={{
                    color: message.feedback === 'negative' ? '#ff4d4f' : (message.type === 'user' ? '#fff' : '#666')
                  }}
                />
              </Tooltip>
              {message.relatedDocs && message.relatedDocs.length > 0 && (
                <Tooltip title="相关文档">
                  <Button
                    type="text"
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => handleViewRelatedDocs(message)}
                    style={{ color: message.type === 'user' ? '#fff' : '#666' }}
                  />
                </Tooltip>
              )}
              <Tooltip title="Token使用">
                <Tag size="small" color={message.type === 'user' ? 'blue' : 'green'}>
                  {message.tokens} tokens
                </Tag>
              </Tooltip>
            </Space>
          </div>
        )}

        {/* 相关文档预览 */}
        {message.relatedDocs && message.relatedDocs.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {message.relatedDocs.map(doc => (
                <Tooltip
                  key={doc.id}
                  title={`${doc.source}\n${doc.snippet}`}
                >
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      message.info(`查看文档：${doc.title}`)
                    }}
                  >
                    {doc.title}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          </div>
        )}
      </div>
      {message.type === 'user' && (
        <Avatar
          icon={<UserOutlined />}
          style={{ backgroundColor: '#87d068', marginLeft: 12 }}
        />
      )}
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 聊天头部 */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Title level={3} style={{ margin: 0 }}>
                智能问答
              </Title>
              <Badge count={messages.length - 1} size="small">
                <Button
                  type="text"
                  icon={<BulbOutlined />}
                >
                  提示词
                </Button>
              </Badge>
            </Space>
          </Col>
          <Col>
            <Space>
              {/* 多源查询开关 */}
              <Tooltip title={unifiedQueryMode ? "多源查询模式已开启" : "开启多源查询模式"}>
                <Button
                  type={unifiedQueryMode ? "primary" : "default"}
                  icon={<ThunderboltOutlined />}
                  onClick={() => setUnifiedQueryMode(!unifiedQueryMode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 12px'
                  }}
                >
                  <Space>
                    <span>多源查询</span>
                    <DatabaseOutlined style={{ fontSize: '12px' }} />
                  </Space>
                </Button>
              </Tooltip>

              {/* 数据源配置按钮 */}
              {unifiedQueryMode && (
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setDataSourceSelectorVisible(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 12px'
                  }}
                >
                  <Space>
                    <span>数据源</span>
                    <EyeOutlined style={{ fontSize: '12px' }} />
                  </Space>
                </Button>
              )}

              {/* 知识图谱按钮 */}
              <Button
                icon={<BranchesOutlined />}
                onClick={() => setKnowledgeGraphVisible(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px'
                }}
              >
                <Space>
                  <span>知识图谱</span>
                  <ShareAltOutlined style={{ fontSize: '12px' }} />
                </Space>
              </Button>

              {/* 当前模型显示 */}
              <Button
                icon={<SettingOutlined />}
                onClick={() => setModelSelectorVisible(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px'
                }}
              >
                <Space>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {currentModel.providerName}
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {currentModel.modelName}
                  </span>
                  {currentModel.contextLength && (
                    <span style={{ fontSize: '11px', color: '#999' }}>
                      <ThunderboltOutlined style={{ marginRight: 2 }} />
                      {(currentModel.contextLength / 1000).toFixed(0)}K
                    </span>
                  )}
                </Space>
              </Button>
              <Dropdown menu={{ items: sessionMenuItems }} placement="bottomRight">
                <Button icon={<HistoryOutlined />}>
                  历史对话
                </Button>
              </Dropdown>
              <Button
                icon={<ClearOutlined />}
                onClick={handleClearChat}
              >
                清空对话
              </Button>
              <Button
                type="primary"
                icon={<StarOutlined />}
                onClick={handleNewChat}
              >
                新建对话
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 模型选择弹窗 */}
      <Modal
        title="选择AI模型"
        open={modelSelectorVisible}
        onCancel={() => setModelSelectorVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            当前使用：{currentModel.providerName} - {currentModel.modelName}
          </Text>
        </div>

        <ModelSelector
          value={currentModel.model}
          onChange={(modelId) => handleModelChange(currentModel.provider, modelId)}
          showChineseModels={true}
          showInternationalModels={false}
          showPricing={true}
          showContextLength={true}
          showCapabilities={true}
          groupByProvider={true}
          placeholder="请选择模型"
          style={{ width: '100%', marginBottom: 16 }}
        />

        {currentModel.pricing && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '6px',
            marginTop: 16
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong>当前模型信息：</Text>
              <div>
                <Text>提供商：{currentModel.providerName}</Text>
              </div>
              <div>
                <Text>模型：{currentModel.modelName}</Text>
              </div>
              <div>
                <Text>上下文长度：{currentModel.contextLength?.toLocaleString()} tokens</Text>
              </div>
              <div>
                <Space>
                  <DollarOutlined style={{ color: '#52c41a' }} />
                  <Text>价格：{currentModel.pricing.currency} {currentModel.pricing.input}/{currentModel.pricing.unit} (输入)</Text>
                  <Text>•</Text>
                  <Text>{currentModel.pricing.currency} {currentModel.pricing.output}/{currentModel.pricing.unit} (输出)</Text>
                </Space>
              </div>
            </Space>
          </div>
        )}
      </Modal>

      {/* 消息列表 */}
      <Card style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {messages.length > 0 ? (
            messages.map(renderMessage)
          ) : (
            <Empty
              description="开始您的第一个问题"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* 输入区域 */}
      <Card style={{ marginTop: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="请输入您的问题..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleSend}
            ref={inputRef}
            suffix={
              <Tooltip title="上传文件">
                <Button
                  type="text"
                  icon={<PaperClipOutlined />}
                  onClick={() => message.info('文件上传功能开发中')}
                />
              </Tooltip>
            }
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim() || loading}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>

      {/* 相关文档抽屉 */}
      <Drawer
        title="相关文档"
        placement="right"
        onClose={() => setRelatedDocsVisible(false)}
        open={relatedDocsVisible}
        width={600}
      >
        {selectedMessage && selectedMessage.relatedDocs && (
          <div>
            <Paragraph>
              <Text type="secondary">基于回答"</Text>
              <Text strong>{selectedMessage.content.slice(0, 50)}...</Text>
              <Text type="secondary">"找到的相关文档</Text>
            </Paragraph>

            <List
              dataSource={selectedMessage.relatedDocs}
              renderItem={(doc) => (
                <List.Item key={doc.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{doc.title}</Text>
                        <Tag color="blue">
                          {Math.round(doc.relevanceScore * 100)}% 匹配度
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          来源：{doc.source}
                        </Text>
                        <Paragraph style={{ margin: '8px 0' }}>
                          {doc.snippet}
                        </Paragraph>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>

      {/* 知识图谱抽屉 */}
      <Drawer
        title={
          <Space>
            <BranchesOutlined />
            <span>知识图谱</span>
            <Badge count="NEW" style={{ backgroundColor: '#52c41a' }} />
          </Space>
        }
        placement="right"
        onClose={() => setKnowledgeGraphVisible(false)}
        open={knowledgeGraphVisible}
        width={400}
        styles={{
          body: { padding: 0 },
          header: { borderBottom: '1px solid #f0f0f0' }
        }}
      >
        <KnowledgeGraphPanel
          visible={knowledgeGraphVisible}
          onClose={() => setKnowledgeGraphVisible(false)}
          onNodeSelect={handleGraphNodeSelect}
          onQueryWithGraph={handleQueryWithGraph}
        />
      </Drawer>

      {/* 数据源选择器弹窗 */}
      <Modal
        title={
          <Space>
            <DatabaseOutlined />
            <span>数据源配置</span>
            <Badge count={selectedDataSources.length} style={{ backgroundColor: '#1890ff' }} />
          </Space>
        }
        open={dataSourceSelectorVisible}
        onCancel={() => setDataSourceSelectorVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setDataSourceSelectorVisible(false)}>
            取消
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              setDataSourceSelectorVisible(false)
              message.success('数据源配置已更新')
            }}
          >
            应用配置
          </Button>
        ]}
      >
        <DataSourceSelector
          onSourcesChange={setSelectedDataSources}
          userContext={unifiedQueryContext}
        />
      </Modal>

      {/* 统一查询结果展示弹窗 */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined />
            <span>多源查询结果</span>
            {unifiedResponse && (
              <Tag color={unifiedResponse.success ? 'success' : 'error'}>
                置信度: {Math.round((unifiedResponse.confidence || 0) * 100)}%
              </Tag>
            )}
          </Space>
        }
        open={unifiedResultsVisible}
        onCancel={() => setUnifiedResultsVisible(false)}
        width={1000}
        footer={[
          <Button key="export" icon={<ExportOutlined />} onClick={handleExportResults}>
            导出结果
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setUnifiedResultsVisible(false)}
          >
            关闭
          </Button>
        ]}
      >
        {unifiedResponse && (
          <UnifiedResultsDisplay
            response={unifiedResponse}
            onFeedback={handleResultFeedback}
            onExport={handleExportResults}
            onShare={handleShareResults}
          />
        )}
      </Modal>
    </div>
  )
}

export default ChatPage