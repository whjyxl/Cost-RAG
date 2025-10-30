import React, { useState, useEffect } from 'react'
import {
  Card,
  Tabs,
  List,
  Tag,
  Progress,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Button,
  Tooltip,
  Alert,
  Collapse,
  Descriptions,
  Badge,
  Empty,
  Spin,
  Timeline,
  Divider,
  Avatar,
  Rate,
  Switch,
  Input,
  message
} from 'antd'
import {
  EyeOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined,
  ExpandOutlined,
  CompressOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  CalculatorOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  FilterOutlined,
  ReloadOutlined,
  StarOutlined
} from '@ant-design/icons'
import type { TabsProps } from 'antd'

import {
  UnifiedQueryResponse,
  DataSourceResult,
  SourceAttribution,
  SmartRecommendation,
  QueryProgress,
  UserQueryContext
} from '@/types'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { Panel } = Collapse
const { TextArea } = Input

interface UnifiedResultsDisplayProps {
  response?: UnifiedQueryResponse
  loading?: boolean
  queryContext?: UserQueryContext
  showSourceDetails?: boolean
  showProgress?: boolean
  showRecommendations?: boolean
  enableFeedback?: boolean
  onFeedback?: (queryId: string, feedback: 'like' | 'dislike', comment?: string) => void
  onRetry?: () => void
  onExport?: (format: 'markdown' | 'json' | 'pdf') => void
  onSourceClick?: (attribution: SourceAttribution) => void
  onRecommendationClick?: (recommendation: SmartRecommendation) => void
  compact?: boolean
  style?: React.CSSProperties
}

const UnifiedResultsDisplay: React.FC<UnifiedResultsDisplayProps> = ({
  response,
  loading = false,
  queryContext,
  showSourceDetails = true,
  showProgress = true,
  showRecommendations = true,
  enableFeedback = true,
  onFeedback,
  onRetry,
  onExport,
  onSourceClick,
  onRecommendationClick,
  compact = false,
  style
}) => {
  const [expandedSources, setExpandedSources] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>('answer')
  const [showRawData, setShowRawData] = useState(false)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [copiedText, setCopiedText] = useState(false)

  // 数据源类型配置
  const sourceTypeConfig = {
    documents: {
      icon: <FileTextOutlined />,
      color: '#1890ff',
      title: '文档知识库'
    },
    knowledge_graph: {
      icon: <NodeIndexOutlined />,
      color: '#52c41a',
      title: '知识图谱'
    },
    historical_data: {
      icon: <CalculatorOutlined />,
      color: '#fa8c16',
      title: '历史项目数据'
    }
  }

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(true)
      message.success('已复制到剪贴板')
      setTimeout(() => setCopiedText(false), 2000)
    } catch (error) {
      message.error('复制失败')
    }
  }

  // 处理反馈
  const handleFeedback = (type: 'like' | 'dislike') => {
    if (response && onFeedback) {
      onFeedback(response.queryId, type, feedbackComment || undefined)
      message.success('感谢您的反馈')
      setFeedbackComment('')
    }
  }

  // 渲染查询进度
  const renderProgress = () => {
    if (!response?.progress || !showProgress) return null

    const progress = response.progress
    const progressPercentage = progress.percentage || 0
    const isCompleted = progress.status === 'completed'
    const hasError = progress.status === 'failed'

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            {hasError ? (
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            ) : isCompleted ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <Spin size="small" />
            )}
            <Space direction="vertical" size={0}>
              <Text strong>
                {progress.currentStep === 'completed' ? '查询完成' :
                 progress.currentStep === 'error' ? '查询出错' :
                 `正在${progress.currentStep}...`}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {progress.completedSteps.length}/{progress.totalSteps} 步骤完成
              </Text>
            </Space>
          </Space>

          <Space>
            <Progress
              percent={progressPercentage}
              size="small"
              style={{ width: 200 }}
              strokeColor={hasError ? '#ff4d4f' : isCompleted ? '#52c41a' : '#1890ff'}
              format={() => `${progressPercentage}%`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {progress.executionTime}ms
            </Text>
          </Space>
        </div>

        {/* 错误信息 */}
        {hasError && progress.errors.length > 0 && (
          <Alert
            message="查询过程中出现错误"
            description={progress.errors.join('; ')}
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            action={
              <Button size="small" onClick={onRetry}>
                重试
              </Button>
            }
          />
        )}

        {/* 时间线 */}
        {progress.completedSteps.length > 0 && (
          <Timeline style={{ marginTop: 12 }}>
            {progress.completedSteps.map((step, index) => (
              <Timeline.Item key={index} color="green">
                <Text style={{ fontSize: 12 }}>{step}</Text>
              </Timeline.Item>
            ))}
            {!isCompleted && !hasError && (
              <Timeline.Item color="blue" dot={<Spin size="small" />}>
                <Text style={{ fontSize: 12 }}>{progress.currentStep}</Text>
              </Timeline.Item>
            )}
          </Timeline>
        )}
      </Card>
    )
  }

  // 渲染主要答案
  const renderMainAnswer = () => {
    if (!response || loading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在整合多个数据源的信息...</Text>
          </div>
        </div>
      )
    }

    if (!response.success || response.error) {
      return (
        <Alert
          message="查询失败"
          description={response.error || '未知错误'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          }
        />
      )
    }

    return (
      <div>
        {/* 答案头部 */}
        <div style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Badge
                  count={response.confidence > 0.8 ? '高' : response.confidence > 0.5 ? '中' : '低'}
                  style={{ backgroundColor: response.confidence > 0.8 ? '#52c41a' : response.confidence > 0.5 ? '#faad14' : '#ff4d4f' }}
                />
                <Text strong>置信度: {(response.confidence * 100).toFixed(0)}%</Text>
                {response.fromCache && (
                  <Tag color="blue">缓存结果</Tag>
                )}
              </Space>
            </Col>
            <Col>
              <Space>
                <Tooltip title="复制答案">
                  <Button
                    type="text"
                    size="small"
                    icon={copiedText ? <CheckCircleOutlined /> : <CopyOutlined />}
                    onClick={() => copyToClipboard(response.fusedAnswer)}
                  />
                </Tooltip>
                <Tooltip title="导出结果">
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => onExport?.('markdown')}
                  />
                </Tooltip>
                <Tooltip title="分享结果">
                  <Button
                    type="text"
                    size="small"
                    icon={<ShareAltOutlined />}
                    onClick={() => message.info('分享功能开发中')}
                  />
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </div>

        {/* 主要答案内容 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            fontSize: compact ? 14 : 16
          }}>
            {response.fusedAnswer}
          </div>

          {/* 答案元数据 */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="数据源数量"
                  value={response.sourceResults.length}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="执行时间"
                  value={response.executionTime}
                  suffix="ms"
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="推荐数量"
                  value={response.recommendations.length}
                  prefix={<BulbOutlined />}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="查询ID"
                  value={response.queryId.substring(0, 8)}
                  prefix={<InfoCircleOutlined />}
                  valueStyle={{ fontSize: 12 }}
                />
              </Col>
            </Row>
          </div>
        </Card>

        {/* 用户反馈 */}
        {enableFeedback && (
          <Card size="small" title="您觉得这个答案有帮助吗？">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Button
                  type="text"
                  icon={<LikeOutlined />}
                  onClick={() => handleFeedback('like')}
                >
                  有帮助
                </Button>
                <Button
                  type="text"
                  icon={<DislikeOutlined />}
                  onClick={() => handleFeedback('dislike')}
                >
                  没帮助
                </Button>
              </Space>
              <TextArea
                placeholder="请提供更多反馈信息（可选）"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={2}
                maxLength={200}
              />
            </Space>
          </Card>
        )}
      </div>
    )
  }

  // 渲染数据源详情
  const renderSourceDetails = () => {
    if (!response?.sourceResults || response.sourceResults.length === 0) {
      return <Empty description="暂无数据源信息" />
    }

    const toggleSourceExpansion = (sourceId: string) => {
      setExpandedSources(prev =>
        prev.includes(sourceId)
          ? prev.filter(id => id !== sourceId)
          : [...prev, sourceId]
      )
    }

    return (
      <List
        dataSource={response.sourceResults.filter(r => r.success)}
        renderItem={(result, index) => (
          <List.Item key={index}>
            <Card
              size="small"
              style={{ width: '100%' }}
              title={
                <Space>
                  <Avatar
                    size="small"
                    style={{ backgroundColor: sourceTypeConfig[result.source.type]?.color || '#1890ff' }}
                    icon={sourceTypeConfig[result.source.type]?.icon || <DatabaseOutlined />}
                  />
                  <span>{result.source.displayName}</span>
                  <Badge
                    count={(result.confidence * 100).toFixed(0) + '%'}
                    style={{
                      backgroundColor: result.confidence > 0.8 ? '#52c41a' : result.confidence > 0.5 ? '#faad14' : '#ff4d4f'
                    }}
                  />
                </Space>
              }
              extra={
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {result.executionTime}ms
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={expandedSources.includes(result.source.id) ? <CompressOutlined /> : <ExpandOutlined />}
                    onClick={() => toggleSourceExpansion(result.source.id)}
                  />
                </Space>
              }
            >
              {/* 基本信息 */}
              <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="数据源类型">
                  <Tag color={sourceTypeConfig[result.source.type]?.color}>
                    {sourceTypeConfig[result.source.type]?.title}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  {result.source.priority}
                </Descriptions.Item>
                <Descriptions.Item label="置信度">
                  <Progress
                    percent={result.confidence * 100}
                    size="small"
                    style={{ width: 100 }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="执行时间">
                  {result.executionTime}ms
                </Descriptions.Item>
              </Descriptions>

              {/* 扩展详情 */}
              {expandedSources.includes(result.source.id) && (
                <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <Title level={5}>详细信息</Title>

                  {/* 源归属信息 */}
                  {result.attribution && result.attribution.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>来源详情:</Text>
                      <List
                        size="small"
                        dataSource={result.attribution}
                        renderItem={(attr, idx) => (
                          <List.Item key={idx} style={{ padding: '4px 0' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                <Text strong>{attr.itemTitle}</Text>
                                <Rate
                                  disabled
                                  defaultValue={attr.relevanceScore * 5}
                                  style={{ fontSize: 12 }}
                                />
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {attr.excerpt}
                              </Text>
                              {attr.itemUrl && (
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => onSourceClick?.(attr)}
                                >
                                  查看详情
                                </Button>
                              )}
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}

                  {/* 原始数据 */}
                  {showRawData && (
                    <div>
                      <Text strong>原始数据:</Text>
                      <pre style={{
                        background: '#f5f5f5',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 12,
                        maxHeight: 200,
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </List.Item>
        )}
      />
    )
  }

  // 渲染智能推荐
  const renderRecommendations = () => {
    if (!response?.recommendations || response.recommendations.length === 0) {
      return <Empty description="暂无推荐信息" />
    }

    return (
      <List
        dataSource={response.recommendations}
        renderItem={(recommendation, index) => (
          <List.Item key={index}>
            <Card
              size="small"
              style={{ width: '100%' }}
              title={
                <Space>
                  <BulbOutlined style={{ color: '#faad14' }} />
                  <span>{recommendation.title}</span>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onRecommendationClick?.(recommendation)}
                >
                  应用推荐
                </Button>
              }
            >
              <Paragraph style={{ marginBottom: 12 }}>
                {recommendation.description}
              </Paragraph>

              {recommendation.action && (
                <Alert
                  message="推荐操作"
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>类型: {recommendation.action.type}</Text>
                      <Text>说明: {recommendation.action.reason}</Text>
                      {'suggestedQuery' in recommendation.action && (
                        <Text>建议查询: {recommendation.action.suggestedQuery}</Text>
                      )}
                      {'sourceType' in recommendation.action && (
                        <Text>建议数据源: {recommendation.action.sourceType}</Text>
                      )}
                    </Space>
                  }
                  type="info"
                  showIcon
                />
              )}
            </Card>
          </List.Item>
        )}
      />
    )
  }

  // 渲染查询上下文
  const renderQueryContext = () => {
    if (!queryContext) {
      return <Empty description="暂无查询上下文信息" />
    }

    return (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="用户ID">
          {queryContext.userId}
        </Descriptions.Item>
        <Descriptions.Item label="会话ID">
          {queryContext.sessionId}
        </Descriptions.Item>
        <Descriptions.Item label="当前查询">
          {queryContext.currentQuery}
        </Descriptions.Item>
        <Descriptions.Item label="查询历史">
          <List
            size="small"
            dataSource={queryContext.queryHistory}
            renderItem={(query, index) => (
              <List.Item key={index} style={{ padding: '4px 0' }}>
                <Space>
                  <Text type="secondary">{index + 1}.</Text>
                  <Text>{query}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Descriptions.Item>
        <Descriptions.Item label="偏好设置">
          <Space wrap>
            {queryContext.preferences?.preferredSources?.map(source => (
              <Tag key={source} color="blue">{source}</Tag>
            ))}
            {queryContext.preferences?.language && (
              <Tag color="green">{queryContext.preferences.language}</Tag>
            )}
            {queryContext.preferences?.fusionStrategy && (
              <Tag color="orange">{queryContext.preferences.fusionStrategy}</Tag>
            )}
          </Space>
        </Descriptions.Item>
      </Descriptions>
    )
  }

  // 渲染原始响应数据
  const renderRawData = () => {
    if (!response) {
      return <Empty description="暂无响应数据" />
    }

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Switch
              checked={showRawData}
              onChange={setShowRawData}
              checkedChildren="显示原始数据"
              unCheckedChildren="隐藏原始数据"
            />
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(JSON.stringify(response, null, 2))}
            >
              复制JSON
            </Button>
          </Space>
        </div>

        {showRawData && (
          <pre style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 6,
            fontSize: 12,
            maxHeight: 500,
            overflow: 'auto',
            border: '1px solid #d9d9d9'
          }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  // 主渲染逻辑
  if (loading) {
    return (
      <Card style={style}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在处理您的查询...</Text>
          </div>
          <Progress
            percent={75}
            status="active"
            style={{ marginTop: 16, width: 300 }}
          />
        </div>
      </Card>
    )
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'answer',
      label: (
        <Space>
          <CheckCircleOutlined />
          <span>答案</span>
        </Space>
      ),
      children: renderMainAnswer()
    }
  ]

  if (showSourceDetails) {
    tabItems.push({
      key: 'sources',
      label: (
        <Space>
          <DatabaseOutlined />
          <span>数据源</span>
          <Badge count={response?.sourceResults?.length || 0} size="small" />
        </Space>
      ),
      children: renderSourceDetails()
    })
  }

  if (showRecommendations && response?.recommendations && response.recommendations.length > 0) {
    tabItems.push({
      key: 'recommendations',
      label: (
        <Space>
          <BulbOutlined />
          <span>推荐</span>
          <Badge count={response.recommendations.length} size="small" />
        </Space>
      ),
      children: renderRecommendations()
    })
  }

  tabItems.push({
    key: 'context',
    label: (
      <Space>
        <InfoCircleOutlined />
        <span>上下文</span>
      </Space>
    ),
    children: renderQueryContext()
  })

  tabItems.push({
    key: 'debug',
    label: (
      <Space>
        <SettingOutlined />
        <span>调试</span>
      </Space>
    ),
    children: renderRawData()
  })

  return (
    <div className="unified-results-display" style={style}>
      {/* 查询进度 */}
      {renderProgress()}

      {/* 主要内容标签页 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size={compact ? 'small' : 'middle'}
          items={tabItems}
        />
      </Card>

      {/* 底部操作栏 */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Space>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            disabled={loading}
          >
            重新查询
          </Button>
          <Button
            type="text"
            icon={<ShareAltOutlined />}
            onClick={() => message.info('分享功能开发中')}
          >
            分享结果
          </Button>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => onExport?.('markdown')}
          >
            导出结果
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default UnifiedResultsDisplay