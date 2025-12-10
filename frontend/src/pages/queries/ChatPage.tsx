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
  Alert,
  Table,
  Slider,
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
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TableOutlined,
  LinkOutlined,
  DownloadOutlined,
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
import SmartModelSelector from '../../components/SmartModelSelector'
import AIModelStatusIndicator from '../../components/AIModelStatusIndicator'
import { getAIModelStatus, getRecommendedModel } from '@/services/aiModelStatusService'
import KnowledgeGraphPanel from '../../components/knowledge/KnowledgeGraphPanel'
import DataSourceSelector from '../../components/queries/DataSourceSelector'
import UnifiedResultsDisplay from '../../components/queries/UnifiedResultsDisplay'
// import SourceLabel, { SourceInfo } from '../../components/queries/SourceLabel' // 改用内联版本
import { GraphNode } from '@/types'
import knowledgeGraphApi from '@/services/knowledgeGraphApi'
import { unifiedQueryManager } from '@/services/unifiedQueryManager'

// 来源信息接口 - 内联定义
interface SourceInfo {
  type: 'document' | 'knowledge_graph' | 'cost_data'
  count: number
  items: Array<{
    id: string | number
    name: string
    score?: number
    snippet?: string
  }>
}

// 导入现代化样式
import './ChatPage.css'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

// Provider名称映射：前端品牌名 ↔ 后端技术名
// Kimi = 月之暗面(Moonshot), GLM = 智谱AI(ZhipuAI), 通义千问 = DashScope
const PROVIDER_NAME_MAP = {
  // 前端 → 后端
  toBackend: {
    'kimi': 'moonshot',      // Kimi = 月之暗面
    'glm': 'zhipuai',        // GLM = 智谱AI
    'qwen': 'dashscope',     // 通义千问 = DashScope
    'wenxin': 'baidu',       // 文心一言 = 百度
    'deepseek': 'deepseek',
    'yi': 'yi',
    'spark': 'spark'
  } as Record<string, string>,

  // 后端 → 前端
  toFrontend: {
    'moonshot': 'kimi',
    'zhipuai': 'glm',
    'dashscope': 'qwen',
    'baidu': 'wenxin',
    'deepseek': 'deepseek',
    'yi': 'yi',
    'spark': 'spark'
  } as Record<string, string>
}

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
  sources?: SourceInfo[]  // 新增:知识来源信息
  unifiedResponse?: any  // 统一查询响应
  retrievalResult?: any  // 完整的检索结果(包含knowledge详细数据)
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
  const [knowledgeDetailVisible, setKnowledgeDetailVisible] = useState(false)
  const [selectedKnowledgeData, setSelectedKnowledgeData] = useState<any>(null)
  const [documentDetailVisible, setDocumentDetailVisible] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([])
  const [costDataVisible, setCostDataVisible] = useState(false)
  const [selectedCostData, setSelectedCostData] = useState<any[]>([])
  const [costDetailVisible, setCostDetailVisible] = useState(false)
  const [selectedCostProject, setSelectedCostProject] = useState<any>(null)
  const [modelStatuses, setModelStatuses] = useState<Record<string, any>>({})
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
  
  // 检索设置相关状态
  const [retrievalSettingsVisible, setRetrievalSettingsVisible] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5) // 相似度阈值，默认0.5
  const [maxResults, setMaxResults] = useState(10) // 最大结果数

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

  // 加载模型状态并自动选择配置成功的模型
  useEffect(() => {
    const loadModelStatus = async () => {
      try {
        const statuses = await getAIModelStatus()
        const statusMap: Record<string, any> = {}

        statuses.forEach(status => {
          statusMap[status.provider] = status
        })

        setModelStatuses(statusMap)

        // 获取当前模型对应的后端provider名称
        const backendProvider = PROVIDER_NAME_MAP.toBackend[currentModel.provider] || currentModel.provider

        // 如果没有当前模型或当前模型未配置，自动选择第一个配置成功的模型
        if (!currentModel || !statusMap[backendProvider]?.configured) {
          const configuredModels = statuses.filter(s => s.configured && s.enabled)
          if (configuredModels.length > 0) {
            // 优先级顺序（使用后端provider名称）
            const priorityOrder = ['moonshot', 'zhipuai', 'dashscope', 'deepseek', 'yi', 'baidu', 'spark']

            for (const backendProviderName of priorityOrder) {
              const model = configuredModels.find(s => s.provider === backendProviderName)
              if (model) {
                // 转换为前端provider名称
                const frontendProviderId = PROVIDER_NAME_MAP.toFrontend[backendProviderName]
                const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === frontendProviderId)

                if (providerInfo && providerInfo.models.length > 0) {
                  const firstModel = providerInfo.models[0]
                  const newModelConfig: CurrentModelConfig = {
                    provider: frontendProviderId as LLMProviderType,
                    model: firstModel.id,
                    modelName: firstModel.displayName,
                    providerName: providerInfo.displayName,
                    contextLength: firstModel.contextLength,
                    pricing: firstModel.pricing
                  }
                  setCurrentModel(newModelConfig)
                  message.success(`已自动选择已配置的模型: ${providerInfo.displayName} - ${firstModel.displayName}`)
                  break
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('加载模型状态失败:', error)
      }
    }

    loadModelStatus()
  }, [])

  // 模拟会话数据
  useEffect(() => {
    const mockSessions: ChatSession[] = [
      {
        id: 'default',
        title: '默认对话',
        messages: [
          {
            id: '1',
            content: `您好!我是Cost-RAG智能助手,当前使用的是 ${currentModel.providerName} - ${currentModel.modelName} 模型。可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗?`,
            type: 'assistant',
            timestamp: '2024-01-20 10:00:00',
            status: 'sent',
          },
        ],
        createdAt: '2024-01-20 10:00:00',
        lastMessage: '您好!我是Cost-RAG智能助手...',
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

    // 客户端验证：问题长度必须至少5个字符
    const trimmedInput = inputValue.trim()
    if (trimmedInput.length < 5) {
      message.error('问题至少需要5个字符，请输入更详细的问题')
      return
    }

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
      // 使用真实的QA API
      await callQAApi(inputValue.trim())
    }
  }

  // 调用QA API
  const callQAApi = async (query: string) => {
    try {
      // 获取JWT令牌
      const token = localStorage.getItem('accessToken')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // 如果有令牌,添加到请求头
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // 构建请求数据
      const requestData = {
        question: query,  // 修复: 使用正确的字段名 'question'
        query_type: 'simple',
        session_id: currentSessionId,
        include_sources: ['documents', 'knowledge_graph', 'cost_database', 'ai_model'],  // 修复: 启用所有数据源
        max_results: maxResults,  // 使用用户设置的最大结果数
        similarity_threshold: similarityThreshold,  // 使用用户设置的相似度阈值
        language: 'zh'
      }

      // 开发环境调试日志
      if (import.meta.env.DEV) {
        console.log('[ChatPage] QA API 请求:', {
          url: '/api/v1/qa/query',
          method: 'POST',
          headers: Object.keys(headers),
          data: requestData,
          token: token ? `${token.substring(0, 20)}...` : 'none'
        })
      }

      const response = await fetch('/api/v1/qa/query', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      })

      // 处理422验证错误
      if (response.status === 422) {
        const errorData = await response.json()
        let errorMessage = '请求参数验证失败：'

        // 解析Pydantic验证错误详情
        if (errorData.detail && Array.isArray(errorData.detail)) {
          const errors = errorData.detail.map((err: any) => {
            const field = err.loc ? err.loc.join('.') : '未知字段'
            const msg = err.msg || '验证失败'
            if (err.type === 'string_too_short' || msg.includes('at least')) {
              return `问题内容至少需要${err.ctx?.min_length || 5}个字符`
            }
            return `${field}: ${msg}`
          })
          errorMessage += errors.join('; ')
        } else {
          errorMessage = '请求参数格式不正确'
        }

        throw new Error(errorMessage)
      }

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()

      // 【调试日志】查看完整响应
      console.log('[ChatPage] QA API完整响应:', data)
      console.log('[ChatPage] retrieval_result:', data.retrieval_result)

      // 解析来源信息
      const sources: SourceInfo[] = []

      // 文档来源 - 按文档ID去重
      if (data.retrieval_result?.documents && data.retrieval_result.documents.length > 0) {
        // 按文档ID去重，只保留每个文档的第一个（相似度最高的）块
        const uniqueDocs = new Map()
        data.retrieval_result.documents.forEach((doc: any) => {
          if (!uniqueDocs.has(doc.document_id)) {
            uniqueDocs.set(doc.document_id, doc)
          }
        })
        
        const uniqueDocArray = Array.from(uniqueDocs.values())
        sources.push({
          type: 'document',
          count: uniqueDocArray.length,
          items: uniqueDocArray.map((doc: any) => ({
            id: doc.document_id,
            name: doc.title || doc.file_path,
            score: doc.relevance_score,
            snippet: doc.content ? doc.content.substring(0, 100) : ''
          }))
        })
      }

      // 知识图谱来源
      if (data.retrieval_result?.knowledge && data.retrieval_result.knowledge.length > 0) {
        console.log('[ChatPage] 发现知识图谱数据:', data.retrieval_result.knowledge.length, '个节点')
        console.log('[ChatPage] 第一个知识节点:', data.retrieval_result.knowledge[0])
        sources.push({
          type: 'knowledge_graph',
          count: data.retrieval_result.knowledge.length,
          items: data.retrieval_result.knowledge.map((kg: any) => ({
            id: kg.node_id,
            name: kg.node_name || kg.name,
            score: kg.relevance_score,
            snippet: kg.explanation || ''
          }))
        })
        console.log('[ChatPage] 知识图谱来源已添加到sources')
      } else {
        console.log('[ChatPage] ⚠️ 未找到知识图谱数据')
      }

      // 成本数据来源
      if (data.retrieval_result?.cost_data && data.retrieval_result.cost_data.length > 0) {
        sources.push({
          type: 'cost_data',
          count: data.retrieval_result.cost_data.length,
          items: data.retrieval_result.cost_data.map((cost: any) => ({
            id: cost.cost_id || cost.item_name,
            name: cost.item_name,
            score: cost.relevance_score,
            snippet: `${cost.category} - ${cost.unit}`
          }))
        })
      }

      // 【调试日志】查看最终的sources数组
      console.log('[ChatPage] 最终sources数组:', sources)
      console.log('[ChatPage] sources长度:', sources.length)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.answer?.answer || '抱歉,无法处理您的问题。',
        type: 'assistant',
        timestamp: new Date().toLocaleString(),
        status: 'sent',
        relatedDocs: data.related_documents?.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          snippet: doc.snippet,
          relevance: doc.relevance_score,
          source: doc.source_type
        })) || [],
        tokens: data.answer?.token_usage?.total_tokens || Math.floor(Math.random() * 500) + 200,
        sources: sources,  // 添加来源信息
        retrievalResult: data.retrieval_result  // 保存完整检索结果
      }

      console.log('[ChatPage] 创建的消息对象:', assistantMessage)
      console.log('[ChatPage] 消息的sources字段:', assistantMessage.sources)

      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)
      scrollToBottom()

    } catch (error) {
      console.error('QA API调用失败:', error)

      // 显示真实的错误信息,不再使用模拟响应
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `抱歉,AI服务暂时不可用。错误信息:${errorMessage}\n\n请稍后重试,或联系管理员检查AI模型配置。`,
        type: 'assistant',
        timestamp: new Date().toLocaleString(),
        status: 'error',
        relatedDocs: [],
        tokens: 0,
      }

      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)
      scrollToBottom()

      // 显示错误通知
      message.error({
        content: `AI服务连接失败: ${errorMessage}`,
        duration: 5,
        style: { marginTop: '20vh' }
      })
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
      message.error('查询过程中出现错误,请稍后重试')
      setLoading(false)
    }
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
    const fullQuery = contextQuery ? `${contextQuery},请基于这些实体信息进行回答。` : inputValue.trim()

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
          content: '您好!我是Cost-RAG智能助手,可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗?',
          type: 'assistant',
          timestamp: new Date().toLocaleString(),
          status: 'sent',
        },
      ],
      createdAt: new Date().toLocaleString(),
      lastMessage: '您好!我是Cost-RAG智能助手...',
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
        content: '您好!我是Cost-RAG智能助手,可以帮您解答关于工程造价、项目管理的相关问题。请问有什么可以帮助您的吗?',
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
    message.success('感谢您的反馈!')
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
      message.error('复制失败,请手动复制链接')
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

  // 渲染消息 - 现代化版本
  const renderMessage = (msg: Message) => (
    <div key={msg.id} className={`message-wrapper ${msg.type}`}>
      {/* AI消息 - 左对齐 */}
      {msg.type === 'assistant' && (
        <>
          <Avatar className="message-avatar assistant-avatar" icon={<RobotOutlined />} />
          <div className="message-bubble assistant-message">
            <div className="message-timestamp">{msg.timestamp}</div>
            <div className="message-content">{msg.content}</div>

            {/* 操作按钮 */}
            {msg.status === 'sent' && (
              <div className="message-actions">
                <Tooltip title="复制">
                  <button
                    className="message-action-btn"
                    onClick={() => handleCopy(msg.content)}
                  >
                    <CopyOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="点赞">
                  <button
                    className={`message-action-btn ${msg.feedback === 'positive' ? 'active-positive' : ''}`}
                    onClick={() => handleFeedback(msg.id, 'positive')}
                  >
                    <LikeOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="点踩">
                  <button
                    className={`message-action-btn ${msg.feedback === 'negative' ? 'active-negative' : ''}`}
                    onClick={() => handleFeedback(msg.id, 'negative')}
                  >
                    <DislikeOutlined />
                  </button>
                </Tooltip>
                {msg.relatedDocs && msg.relatedDocs.length > 0 && (
                  <Tooltip title="相关文档">
                    <button
                      className="message-action-btn"
                      onClick={() => handleViewRelatedDocs(msg)}
                    >
                      <FileTextOutlined /> {msg.relatedDocs.length}
                    </button>
                  </Tooltip>
                )}
                {msg.tokens && (
                  <span className="token-badge">
                    {msg.tokens} tokens
                  </span>
                )}
              </div>
            )}

            {/* 知识来源标注 - 内联版本 */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                <Space size={[4, 4]} wrap>
                  <span style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, marginRight: 4 }}>
                    来源:
                  </span>
                  {msg.sources.map((source, idx) => {
                    const config = source.type === 'document'
                      ? { icon: <FileTextOutlined />, color: '#1890ff', label: '文档', bg: '#e6f7ff' }
                      : source.type === 'knowledge_graph'
                      ? { icon: <ShareAltOutlined />, color: '#52c41a', label: '知识图谱', bg: '#f6ffed' }
                      : { icon: <DollarOutlined />, color: '#fa8c16', label: '成本数据', bg: '#fff7e6' }

                    return (
                      <Tag
                        key={idx}
                        icon={config.icon}
                        color={config.color}
                        style={{
                          margin: '2px 4px 2px 0',
                          fontSize: '12px',
                          padding: '0 7px',
                          borderRadius: '10px',
                          backgroundColor: config.bg,
                          color: config.color,
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          console.log('[Tag Click] source.type:', source.type)
                          console.log('[Tag Click] msg.retrievalResult:', msg.retrievalResult)
                          console.log('[Tag Click] msg对象:', msg)

                          if (source.type === 'knowledge_graph') {
                            // 点击知识图谱标签,显示知识图谱详情
                            console.log('[Tag Click] knowledge_graph data:', msg.retrievalResult?.knowledge)
                            setSelectedKnowledgeData(msg.retrievalResult?.knowledge || [])
                            setKnowledgeDetailVisible(true)
                          } else if (source.type === 'document') {
                            // 点击文档标签,显示文档详情
                            console.log('[Tag Click] document data:', msg.retrievalResult?.documents)
                            setSelectedDocuments(msg.retrievalResult?.documents || [])
                            setDocumentDetailVisible(true)
                          } else if (source.type === 'cost_data') {
                            // 点击成本数据标签,显示成本数据表格
                            console.log('[Tag Click] cost_data:', msg.retrievalResult?.cost_data)
                            const costData = msg.retrievalResult?.cost_data || []
                            console.log('[Tag Click] 设置成本数据，数量:', costData.length)
                            setSelectedCostData(costData)
                            setCostDataVisible(true)
                            console.log('[Tag Click] costDataVisible设置为true')
                          }
                        }}
                      >
                        {config.label} {source.count}
                      </Tag>
                    )
                  })}
                </Space>
              </div>
            )}

            {/* 相关文档标签 */}
            {msg.relatedDocs && msg.relatedDocs.length > 0 && (
              <div className="related-docs-tags">
                {msg.relatedDocs.slice(0, 3).map(doc => (
                  <Tooltip key={doc.id} title={doc.snippet}>
                    <span
                      className="doc-tag"
                      onClick={() => handleViewRelatedDocs(msg)}
                    >
                      {doc.title}
                    </span>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 用户消息 - 右对齐 */}
      {msg.type === 'user' && (
        <>
          <div className="message-bubble user-message">
            <div className="message-timestamp">{msg.timestamp}</div>
            <div className="message-content">{msg.content}</div>
          </div>
          <Avatar className="message-avatar user-avatar" icon={<UserOutlined />} />
        </>
      )}
    </div>
  )

  return (
    <div className="chat-modern">
      {/* 背景装饰光球 */}
      <div className="chat-bg-orb-1" style={{ top: '-300px', right: '-200px' }} />
      <div className="chat-bg-orb-2" style={{ bottom: '-250px', left: '-150px' }} />

      {/* 聊天头部 */}
      <div className="chat-header-modern">
        <Row justify="space-between" align="middle">
          <Col>
            <Space align="center">
              <h2 className="chat-header-title">智能问答</h2>
              <Badge count={messages.length - 1} style={{ backgroundColor: '#667eea' }} />
            </Space>
          </Col>
          <Col>
            <Space wrap>
              {/* 多源查询开关 */}
              <Tooltip title={unifiedQueryMode ? "多源查询模式已开启" : "开启多源查询模式"}>
                <Button
                  className={`chat-toolbar-btn ${unifiedQueryMode ? 'active' : ''}`}
                  icon={<ThunderboltOutlined />}
                  onClick={() => setUnifiedQueryMode(!unifiedQueryMode)}
                >
                  多源查询
                </Button>
              </Tooltip>

              {/* 数据源配置 */}
              {unifiedQueryMode && (
                <Button
                  className="chat-toolbar-btn"
                  icon={<FilterOutlined />}
                  onClick={() => setDataSourceSelectorVisible(true)}
                >
                  数据源
                </Button>
              )}

              {/* 知识图谱 */}
              <Button
                className="chat-toolbar-btn"
                icon={<BranchesOutlined />}
                onClick={() => setKnowledgeGraphVisible(true)}
              >
                知识图谱
              </Button>

              {/* 模型选择 */}
              <Button
                className="chat-toolbar-btn"
                icon={<SettingOutlined />}
                onClick={() => setModelSelectorVisible(true)}
              >
                <Space size={4}>
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>
                    {currentModel.providerName}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {currentModel.modelName}
                  </span>
                  {(() => {
                    const backendProvider = PROVIDER_NAME_MAP.toBackend[currentModel.provider] || currentModel.provider
                    const isConfigured = modelStatuses[backendProvider]?.configured
                    return isConfigured ? <Badge status="success" /> : <Badge status="error" />
                  })()}
                </Space>
              </Button>

              {/* 历史对话 */}
              <Dropdown menu={{ items: sessionMenuItems }} placement="bottomRight">
                <Button className="chat-toolbar-btn" icon={<HistoryOutlined />}>
                  历史对话
                </Button>
              </Dropdown>

              {/* 清空对话 */}
              <Button
                className="chat-toolbar-btn"
                icon={<ClearOutlined />}
                onClick={handleClearChat}
              >
                清空
              </Button>

              {/* 新建对话 */}
              <Button
                className="chat-toolbar-btn active"
                icon={<StarOutlined />}
                onClick={handleNewChat}
              >
                新建
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* AI模型配置警告 */}
      {Object.keys(modelStatuses).length > 0 &&
       Object.values(modelStatuses).filter(status => status.configured && status.enabled).length === 0 && (
        <div style={{ padding: '16px 24px 0' }}>
          <Alert
            message="未配置AI模型"
            description={
              <span>
                您还没有配置任何AI模型，请先前往{' '}
                <a href="/settings/system-config" style={{ fontWeight: 600 }}>系统设置</a>
                {' '}配置API密钥后再使用智能问答功能
              </span>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            closable
            style={{ marginBottom: 0 }}
          />
        </div>
      )}

      {/* 消息列表容器 */}
      <div className="chat-messages-container">
        {messages.length > 0 ? (
          messages.map(renderMessage)
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <RobotOutlined />
            </div>
            <Text style={{ fontSize: 16, color: '#999' }}>开始您的第一个问题</Text>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="message-wrapper assistant">
            <Avatar className="message-avatar assistant-avatar" icon={<RobotOutlined />} />
            <div className="message-bubble assistant-message">
              <div className="message-loading">
                <span>正在思考</span>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        {/* 检索设置提示 - 简洁版 */}
        <div style={{ 
          marginBottom: 8, 
          padding: '6px 12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          border: '1px solid #e8e8e8'
        }}>
          <Space size={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              相似度: <Text strong>{(similarityThreshold * 100).toFixed(0)}%</Text>
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              结果数: <Text strong>{maxResults}</Text>
            </Text>
          </Space>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setRetrievalSettingsVisible(true)}
          >
            设置
          </Button>
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            className="chat-input-box"
            placeholder="请输入您的问题..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            ref={inputRef}
            autoSize={{ minRows: 1, maxRows: 4 }}
            data-testid="qa-input"
          />
          <Tooltip title="上传文件">
            <button
              className="chat-attach-btn"
              onClick={() => message.info('文件上传功能开发中')}
            >
              <PaperClipOutlined />
            </button>
          </Tooltip>
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || loading}
          >
            {loading ? <Spin size="small" /> : <SendOutlined />}
            <span>发送</span>
          </button>
        </Space.Compact>
      </div>

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
            当前使用:{currentModel.providerName} - {currentModel.modelName}
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

        {/* 智能模型推荐 */}
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f9ff',
          borderRadius: '6px',
          border: '1px solid #bae7ff',
          marginBottom: 16
        }}>
          <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
            💡 智能推荐
          </Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              已为您检测到配置成功的AI模型,优先推荐:
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            {Object.entries(modelStatuses)
              .filter(([_, status]) => status.configured && status.enabled)
              .map(([provider, status]: [string, any]) => {
                const providerModelMap: Record<string, string> = {
                  'moonshot': 'kimi',
                  'zhipuai': 'glm',
                  'dashscope': 'qwen',
                  'deepseek': 'deepseek',
                  'yi': 'yi',
                  'baidu': 'wenxin',
                  'spark': 'spark'
                }
                const providerId = providerModelMap[provider]
                const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === providerId)

                return providerInfo ? (
                  <Button
                    key={provider}
                    type={currentModel.provider === providerId ? 'primary' : 'default'}
                    size="small"
                    style={{
                      margin: '4px 8px 4px 0',
                      backgroundColor: currentModel.provider === providerId ? '#1890ff' : '#f0f9ff',
                      borderColor: currentModel.provider === providerId ? '#1890ff' : '#bae7ff'
                    }}
                    onClick={() => {
                      if (providerInfo.models.length > 0) {
                        const firstModel = providerInfo.models[0]
                        handleModelChange(providerId as LLMProviderType, firstModel.id)
                      }
                    }}
                  >
                    <span style={{ color: currentModel.provider === providerId ? '#fff' : '#1890ff' }}>
                      ✓ {status.providerName} ({providerInfo.displayName})
                    </span>
                  </Button>
                ) : null
              })}
          </div>
        </div>

        {currentModel.pricing && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '6px',
            marginTop: 16
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong>当前模型信息:</Text>
              <div>
                <Text>提供商:{currentModel.providerName}</Text>
              </div>
              <div>
                <Text>模型:{currentModel.modelName}</Text>
              </div>
              <div>
                <Text>上下文长度:{currentModel.contextLength?.toLocaleString()} tokens</Text>
              </div>
              <div>
                <Space>
                  <DollarOutlined style={{ color: '#52c41a' }} />
                  <Text>价格:{currentModel.pricing.currency} {currentModel.pricing.input}/{currentModel.pricing.unit} (输入)</Text>
                  <Text>•</Text>
                  <Text>{currentModel.pricing.currency} {currentModel.pricing.output}/{currentModel.pricing.unit} (输出)</Text>
                </Space>
              </div>
            </Space>
          </div>
        )}
      </Modal>

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
                          来源:{doc.source}
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

      {/* 知识图谱详情展示Modal */}
      <Modal
        title={
          <Space>
            <ShareAltOutlined style={{ color: '#52c41a' }} />
            <span>知识图谱检索结果</span>
            {selectedKnowledgeData && (
              <Tag color="success">
                {selectedKnowledgeData.length} 个节点
              </Tag>
            )}
          </Space>
        }
        open={knowledgeDetailVisible}
        onCancel={() => setKnowledgeDetailVisible(false)}
        width={900}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setKnowledgeDetailVisible(false)}
          >
            关闭
          </Button>
        ]}
      >
        {selectedKnowledgeData && selectedKnowledgeData.length > 0 ? (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <List
              dataSource={selectedKnowledgeData}
              renderItem={(node: any, index: number) => (
                <List.Item
                  key={node.node_id || index}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #f0f0f0',
                    background: index % 2 === 0 ? '#fafafa' : 'white'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: '#52c41a' }}
                        icon={<NodeIndexOutlined />}
                      />
                    }
                    title={
                      <Space>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>
                          {node.node_name || node.name}
                        </span>
                        <Tag color="green">{node.node_type || node.type}</Tag>
                        {node.relevance_score && (
                          <Tag color="blue">
                            相关度: {(node.relevance_score * 100).toFixed(0)}%
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        {node.explanation && (
                          <div style={{ marginBottom: 8, color: '#595959' }}>
                            <Text type="secondary">匹配原因:</Text> {node.explanation}
                          </div>
                        )}
                        {node.properties && Object.keys(node.properties).length > 0 && (
                          <div>
                            <Text type="secondary">属性:</Text>
                            <div style={{ marginTop: 4 }}>
                              {Object.entries(node.properties).map(([key, value]: [string, any]) => (
                                <Tag key={key} style={{ margin: '2px 4px 2px 0' }}>
                                  {key}: {String(value)}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                        {node.relationships && node.relationships.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">关系:</Text>
                            <div style={{ marginTop: 4 }}>
                              {node.relationships.slice(0, 5).map((rel: any, relIdx: number) => (
                                <Tag key={relIdx} color="cyan" style={{ margin: '2px 4px 2px 0' }}>
                                  {rel.relation_type || rel.type} → {rel.target_name || rel.target}
                                </Tag>
                              ))}
                              {node.relationships.length > 5 && (
                                <Tag>还有 {node.relationships.length - 5} 个关系...</Tag>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty description="暂无知识图谱数据" />
        )}
      </Modal>

      {/* 文档详情展示Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>匹配文档列表</span>
            {selectedDocuments && (
              <Tag color="blue">
                {selectedDocuments.length} 个文档
              </Tag>
            )}
          </Space>
        }
        open={documentDetailVisible}
        onCancel={() => setDocumentDetailVisible(false)}
        width={900}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setDocumentDetailVisible(false)}
          >
            关闭
          </Button>
        ]}
      >
        {selectedDocuments && selectedDocuments.length > 0 ? (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <List
              dataSource={selectedDocuments}
              renderItem={(doc: any, index: number) => (
                <List.Item
                  key={doc.document_id || index}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #f0f0f0',
                    background: index % 2 === 0 ? '#fafafa' : 'white'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: '#1890ff' }}
                        icon={<FileTextOutlined />}
                      />
                    }
                    title={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space>
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>
                            {doc.document_title || doc.title || '未命名文档'}
                          </span>
                          {doc.relevance_score && (
                            <Tag color="blue">
                              相关度: {(doc.relevance_score * 100).toFixed(0)}%
                            </Tag>
                          )}
                        </Space>
                        {doc.source_type && (
                          <Tag color="geekblue" style={{ fontSize: '12px' }}>
                            {doc.source_type}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        {doc.content && (
                          <div style={{ marginBottom: 8 }}>
                            <Text type="secondary">内容摘要:</Text>
                            <div style={{
                              marginTop: 4,
                              padding: '8px 12px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '4px',
                              fontSize: '13px',
                              lineHeight: '1.6',
                              maxHeight: '120px',
                              overflowY: 'auto'
                            }}>
                              {doc.content.slice(0, 300)}
                              {doc.content.length > 300 && '...'}
                            </div>
                          </div>
                        )}
                        {doc.chunk_content && !doc.content && (
                          <div style={{ marginBottom: 8 }}>
                            <Text type="secondary">匹配片段:</Text>
                            <div style={{
                              marginTop: 4,
                              padding: '8px 12px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '4px',
                              fontSize: '13px',
                              lineHeight: '1.6'
                            }}>
                              {doc.chunk_content}
                            </div>
                          </div>
                        )}
                        {doc.metadata && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">文档信息:</Text>
                            <div style={{ marginTop: 4 }}>
                              {doc.metadata.file_type && (
                                <Tag style={{ margin: '2px 4px 2px 0' }}>
                                  类型: {doc.metadata.file_type}
                                </Tag>
                              )}
                              {doc.metadata.page_count && (
                                <Tag style={{ margin: '2px 4px 2px 0' }}>
                                  页数: {doc.metadata.page_count}
                                </Tag>
                              )}
                              {doc.metadata.upload_time && (
                                <Tag style={{ margin: '2px 4px 2px 0' }}>
                                  上传时间: {new Date(doc.metadata.upload_time).toLocaleDateString()}
                                </Tag>
                              )}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <Space>
                            <Button
                              size="small"
                              type="link"
                              icon={<EyeOutlined />}
                              onClick={() => {
                                // 跳转到文档列表页面
                                if (doc.document_id) {
                                  window.open(`/documents/list?highlight=${doc.document_id}`, '_blank')
                                } else {
                                  message.warning('文档ID不存在')
                                }
                              }}
                            >
                              在列表中查看
                            </Button>
                            {doc.file_path && (
                              <Button
                                size="small"
                                type="link"
                                icon={<DownloadOutlined />}
                                onClick={async () => {
                                  try {
                                    // 下载文档
                                    const token = localStorage.getItem('token')
                                    const response = await fetch(`/api/v1/documents/${doc.document_id}/download`, {
                                      headers: {
                                        'Authorization': `Bearer ${token}`
                                      }
                                    })
                                    
                                    if (response.ok) {
                                      const blob = await response.blob()
                                      const url = window.URL.createObjectURL(blob)
                                      const a = document.createElement('a')
                                      a.href = url
                                      a.download = doc.title || doc.file_path || 'document.pdf'
                                      document.body.appendChild(a)
                                      a.click()
                                      window.URL.revokeObjectURL(url)
                                      document.body.removeChild(a)
                                      message.success('下载成功')
                                    } else {
                                      message.error('下载失败')
                                    }
                                  } catch (error) {
                                    console.error('下载错误:', error)
                                    message.error('下载失败')
                                  }
                                }}
                              >
                                下载文档
                              </Button>
                            )}
                          </Space>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty description="暂无匹配文档" />
        )}
      </Modal>

      {/* 成本数据展示Modal */}
      <Modal
        title={
          <Space>
            <TableOutlined style={{ color: '#fa8c16' }} />
            <span>历史项目成本数据</span>
            {selectedCostData && (
              <Tag color="orange">
                {selectedCostData.length} 个项目
              </Tag>
            )}
          </Space>
        }
        open={costDataVisible}
        onCancel={() => setCostDataVisible(false)}
        width={1000}
        footer={[
          <Button
            key="export"
            icon={<ExportOutlined />}
            onClick={() => {
              message.info('导出Excel功能开发中')
            }}
          >
            导出Excel
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setCostDataVisible(false)}
          >
            关闭
          </Button>
        ]}
      >
        {selectedCostData && selectedCostData.length > 0 ? (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <Table
              dataSource={selectedCostData}
              pagination={false}
              size="small"
              rowKey={(record, index) => record.project_id || index}
              rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
              columns={[
                {
                  title: '项目名称',
                  dataIndex: 'project_name',
                  key: 'project_name',
                  width: 200,
                  ellipsis: true,
                  render: (text: string) => (
                    <Tooltip title={text}>
                      <span style={{ fontWeight: 500 }}>{text || '未命名项目'}</span>
                    </Tooltip>
                  )
                },
                {
                  title: '建筑面积(㎡)',
                  dataIndex: 'building_area',
                  key: 'building_area',
                  width: 120,
                  align: 'right',
                  sorter: (a: any, b: any) => (a.building_area || 0) - (b.building_area || 0),
                  render: (value: number) => value ? value.toLocaleString() : '-'
                },
                {
                  title: '单位造价(元/㎡)',
                  dataIndex: 'unit_price',
                  key: 'unit_price',
                  width: 130,
                  align: 'right',
                  sorter: (a: any, b: any) => (a.unit_price || 0) - (b.unit_price || 0),
                  render: (value: number) => value ? `¥${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'
                },
                {
                  title: '总造价(万元)',
                  dataIndex: 'total_cost',
                  key: 'total_cost',
                  width: 130,
                  align: 'right',
                  sorter: (a: any, b: any) => (a.total_cost || 0) - (b.total_cost || 0),
                  render: (value: number) => {
                    if (!value) return '-'
                    const costInWan = value / 10000
                    return (
                      <span style={{ fontWeight: 600, color: '#fa8c16' }}>
                        ¥{costInWan.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    )
                  }
                },
                {
                  title: '工程类型',
                  dataIndex: 'project_type',
                  key: 'project_type',
                  width: 110,
                  render: (text: string) => text ? <Tag color="cyan">{text}</Tag> : '-'
                },
                {
                  title: '相关度',
                  dataIndex: 'relevance_score',
                  key: 'relevance_score',
                  width: 100,
                  align: 'center',
                  sorter: (a: any, b: any) => (a.relevance_score || 0) - (b.relevance_score || 0),
                  defaultSortOrder: 'descend',
                  render: (score: number) => {
                    if (!score) return '-'
                    const percentage = (score * 100).toFixed(0)
                    const color = score > 0.8 ? 'success' : score > 0.6 ? 'processing' : 'warning'
                    return (
                      <Tag color={color}>
                        {percentage}%
                      </Tag>
                    )
                  }
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 100,
                  align: 'center',
                  render: (_: any, record: any) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setSelectedCostProject(record)
                        setCostDetailVisible(true)
                      }}
                    >
                      查看详情
                    </Button>
                  )
                }
              ]}
              expandable={{
                expandedRowRender: (record: any) => {
                  // 提取一级分部数据（is_primary_section = true）
                  const primarySections = record.cost_items?.filter((item: any) => item.is_primary_section) || []

                  return (
                    <div style={{ padding: '12px', backgroundColor: '#fafafa' }}>
                      {/* 基本信息 */}
                      <Descriptions size="small" column={2} bordered style={{ marginBottom: '12px' }}>
                        {record.location && (
                          <Descriptions.Item label="项目地点">
                            {record.location}
                          </Descriptions.Item>
                        )}
                        {record.completion_date && (
                          <Descriptions.Item label="竣工日期">
                            {new Date(record.completion_date).toLocaleDateString()}
                          </Descriptions.Item>
                        )}
                        {record.structure_type && (
                          <Descriptions.Item label="结构类型">
                            {record.structure_type}
                          </Descriptions.Item>
                        )}
                        {record.floors && (
                          <Descriptions.Item label="楼层">
                            {record.floors}
                          </Descriptions.Item>
                        )}
                        {record.notes && (
                          <Descriptions.Item label="备注" span={2}>
                            {record.notes}
                          </Descriptions.Item>
                        )}
                        {record.match_reason && (
                          <Descriptions.Item label="匹配原因" span={2}>
                            <Text type="secondary">{record.match_reason}</Text>
                          </Descriptions.Item>
                        )}
                      </Descriptions>

                      {/* 一级分部成本预览 */}
                      {primarySections.length > 0 ? (
                        <div>
                          <div style={{ marginBottom: '8px', fontWeight: 500, color: '#1890ff' }}>
                            📊 一级分部成本预览 ({primarySections.length}项)
                          </div>
                          <Table
                            size="small"
                            dataSource={primarySections}
                            pagination={false}
                            rowKey={(item) => item.item_code}
                            columns={[
                              {
                                title: '编号',
                                dataIndex: 'item_code',
                                key: 'item_code',
                                width: 80,
                              },
                              {
                                title: '分部名称',
                                dataIndex: 'item_name',
                                key: 'item_name',
                                ellipsis: true,
                              },
                              {
                                title: '单价(元/㎡)',
                                dataIndex: 'unit_price',
                                key: 'unit_price',
                                width: 130,
                                align: 'right',
                                render: (value: number) => value ? `¥${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'
                              },
                              {
                                title: '合价(元)',
                                dataIndex: 'total_price',
                                key: 'total_price',
                                width: 150,
                                align: 'right',
                                render: (value: number) => value ? `¥${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'
                              }
                            ]}
                          />
                        </div>
                      ) : (
                        <Alert
                          message="暂无成本明细数据"
                          description="该项目的成本分部数据尚未导入"
                          type="info"
                          showIcon
                          style={{ marginTop: '12px' }}
                        />
                      )}
                    </div>
                  )
                },
                rowExpandable: (record: any) => true
              }}
            />
            <style>
              {`
                .table-row-light {
                  background-color: #ffffff;
                }
                .table-row-dark {
                  background-color: #fafafa;
                }
              `}
            </style>
          </div>
        ) : (
          <Empty description="暂无成本数据" />
        )}
      </Modal>

      {/* 成本详情Modal - 显示完整14级成本结构 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarOutlined style={{ color: '#1890ff' }} />
            <span>项目成本详细信息</span>
          </div>
        }
        open={costDetailVisible}
        onCancel={() => {
          setCostDetailVisible(false)
          setSelectedCostProject(null)
        }}
        width={1200}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setCostDetailVisible(false)
              setSelectedCostProject(null)
            }}
          >
            关闭
          </Button>
        ]}
      >
        {selectedCostProject ? (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {/* 项目基本信息 */}
            <Card size="small" title="项目基本信息" style={{ marginBottom: '16px' }}>
              <Descriptions size="small" column={3} bordered>
                <Descriptions.Item label="项目名称" span={3}>
                  <strong>{selectedCostProject.project_name}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="工程类型">
                  {selectedCostProject.project_type || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="建筑面积">
                  {selectedCostProject.building_area ? `${selectedCostProject.building_area.toLocaleString()} ㎡` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="楼层">
                  {selectedCostProject.floors || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="单位造价">
                  {selectedCostProject.unit_price ? `¥${selectedCostProject.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}/㎡` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="总造价">
                  <strong style={{ color: '#fa8c16', fontSize: '16px' }}>
                    {selectedCostProject.total_cost ? `¥${(selectedCostProject.total_cost / 10000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} 万元` : '-'}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="竣工日期">
                  {selectedCostProject.completion_date ? new Date(selectedCostProject.completion_date).toLocaleDateString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 14级成本明细表 */}
            {selectedCostProject.cost_items && selectedCostProject.cost_items.length > 0 ? (
              <Card size="small" title="成本明细（14级结构）">
                <Table
                  size="small"
                  dataSource={selectedCostProject.cost_items}
                  pagination={false}
                  rowKey={(item) => item.item_code}
                  expandable={{
                    expandedRowRender: (record: any) => {
                      // 如果是一级分部，显示它下面的二级分部
                      if (record.is_primary_section) {
                        const secondarySections = selectedCostProject.cost_items.filter(
                          (item: any) =>
                            item.is_secondary_section &&
                            item.item_code.startsWith(record.item_code.split('.')[0] + '.')
                        )

                        if (secondarySections.length > 0) {
                          return (
                            <Table
                              size="small"
                              dataSource={secondarySections}
                              pagination={false}
                              rowKey={(item) => item.item_code}
                              showHeader={false}
                              columns={[
                                {
                                  dataIndex: 'item_code',
                                  key: 'item_code',
                                  width: 100,
                                  render: (text: string) => <Text type="secondary">{text}</Text>
                                },
                                {
                                  dataIndex: 'item_name',
                                  key: 'item_name',
                                  ellipsis: true,
                                },
                                {
                                  dataIndex: 'unit_price',
                                  key: 'unit_price',
                                  width: 150,
                                  align: 'right',
                                  render: (value: number) => value ? `¥${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'
                                },
                                {
                                  dataIndex: 'total_price',
                                  key: 'total_price',
                                  width: 180,
                                  align: 'right',
                                  render: (value: number) => value ? `¥${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'
                                }
                              ]}
                            />
                          )
                        }
                      }
                      return null
                    },
                    rowExpandable: (record: any) => record.is_primary_section
                  }}
                  columns={[
                    {
                      title: '编号',
                      dataIndex: 'item_code',
                      key: 'item_code',
                      width: 100,
                      render: (text: string, record: any) => (
                        <span style={{ fontWeight: record.is_primary_section ? 600 : 400 }}>
                          {text}
                        </span>
                      )
                    },
                    {
                      title: '分部分项名称',
                      dataIndex: 'item_name',
                      key: 'item_name',
                      ellipsis: true,
                      render: (text: string, record: any) => (
                        <span style={{ fontWeight: record.is_primary_section ? 600 : 400 }}>
                          {text}
                        </span>
                      )
                    },
                    {
                      title: '单价(元/㎡)',
                      dataIndex: 'unit_price',
                      key: 'unit_price',
                      width: 150,
                      align: 'right',
                      render: (value: number, record: any) => value ? (
                        <span style={{ fontWeight: record.is_primary_section ? 600 : 400 }}>
                          ¥{value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      ) : '-'
                    },
                    {
                      title: '合价(元)',
                      dataIndex: 'total_price',
                      key: 'total_price',
                      width: 180,
                      align: 'right',
                      render: (value: number, record: any) => value ? (
                        <span style={{ fontWeight: record.is_primary_section ? 600 : 400, color: record.is_primary_section ? '#fa8c16' : undefined }}>
                          ¥{value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      ) : '-'
                    }
                  ]}
                  // 只显示一级分部,二级分部在展开行中显示
                  dataSource={selectedCostProject.cost_items.filter((item: any) => item.is_primary_section)}
                />
              </Card>
            ) : (
              <Alert
                message="暂无成本明细数据"
                description="该项目的成本分部数据尚未导入，无法显示详细的14级成本结构"
                type="info"
                showIcon
              />
            )}
          </div>
        ) : (
          <Empty description="未选择项目" />
        )}
      </Modal>

      {/* 检索设置弹窗 - 简洁版 */}
      <Modal
        title="检索设置"
        open={retrievalSettingsVisible}
        onCancel={() => setRetrievalSettingsVisible(false)}
        onOk={() => {
          message.success('设置已保存')
          setRetrievalSettingsVisible(false)
        }}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>相似度阈值</Text>
              <Text type="secondary">{(similarityThreshold * 100).toFixed(0)}%</Text>
            </div>
            <Slider
              min={0.1}
              max={0.9}
              step={0.05}
              value={similarityThreshold}
              onChange={setSimilarityThreshold}
              marks={{
                0.1: '10%',
                0.3: '30%',
                0.5: '50%',
                0.7: '70%',
                0.9: '90%'
              }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              阈值越低，召回的文档越多；阈值越高，结果越精确
            </Text>
          </div>

          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>最大结果数</Text>
              <Text type="secondary">{maxResults} 条</Text>
            </div>
            <Slider
              min={5}
              max={20}
              step={5}
              value={maxResults}
              onChange={setMaxResults}
              marks={{
                5: '5',
                10: '10',
                15: '15',
                20: '20'
              }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              控制每次检索返回的最大文档数量
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ChatPage
