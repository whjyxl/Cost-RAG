import React, { useState, useEffect } from 'react'
import {
  Card,
  Checkbox,
  Slider,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Divider,
  Tag,
  Tooltip,
  Alert,
  Switch,
  InputNumber,
  Select,
  Collapse,
  Badge,
  Progress,
  Empty,
  message
} from 'antd'
import {
  DatabaseOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  CalculatorOutlined,
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  MinusOutlined
} from '@ant-design/icons'
import type { CheckboxProps } from 'antd'

import {
  DataSource,
  DataSourceType,
  DataSourceConfig,
  DataSourcePriority,
  UserQueryContext
} from '@/types'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse
const { Option } = Select

interface DataSourceSelectorProps {
  visible?: boolean
  onSourcesChange?: (sources: DataSource[]) => void
  onPriorityChange?: (priorities: DataSourcePriority[]) => void
  defaultSources?: DataSource[]
  userContext?: UserQueryContext
  showAdvanced?: boolean
  disabled?: boolean
  compact?: boolean
}

// 默认数据源配置
const DEFAULT_DATA_SOURCES: DataSource[] = [
  {
    id: 'documents',
    name: '文档知识库',
    displayName: '文档知识库',
    type: 'documents',
    enabled: true,
    priority: 2,
    config: {
      maxResults: 10,
      filters: {},
      searchType: 'semantic',
      includeContent: true,
      dateRange: 'all'
    },
    description: '搜索已上传的文档内容，包括项目文档、技术规范等',
    capabilities: ['semantic_search', 'content_extraction', 'document_filtering'],
    status: 'active',
    lastSync: new Date().toISOString()
  },
  {
    id: 'knowledge_graph',
    name: '知识图谱',
    displayName: '知识图谱',
    type: 'knowledge_graph',
    enabled: true,
    priority: 1,
    config: {
      maxResults: 20,
      nodeTypes: ['project', 'material', 'activity'],
      relationshipTypes: ['relates_to', 'contains'],
      depth: 2,
      includeProperties: true
    },
    description: '通过实体和关系发现深层次的关联信息',
    capabilities: ['entity_search', 'relationship_traversal', 'graph_visualization'],
    status: 'active',
    lastSync: new Date().toISOString()
  },
  {
    id: 'historical_data',
    name: '历史项目数据',
    displayName: '历史项目数据',
    type: 'historical_data',
    enabled: true,
    priority: 3,
    config: {
      maxResults: 15,
      projectTypes: ['residential', 'commercial', 'industrial'],
      similarityThreshold: 0.6,
      dateRange: '5years',
      includeCostData: true
    },
    description: '基于历史相似项目提供成本估算参考',
    capabilities: ['similarity_search', 'cost_analysis', 'trend_analysis'],
    status: 'active',
    lastSync: new Date().toISOString()
  }
]

// 默认优先级配置
const DEFAULT_PRIORITIES: DataSourcePriority[] = [
  {
    sourceType: 'knowledge_graph',
    priority: 1,
    weight: 1.5,
    reason: '知识图谱提供结构化的实体和关系信息，通常更准确'
  },
  {
    sourceType: 'documents',
    priority: 2,
    weight: 1.2,
    reason: '文档内容丰富但需要进一步处理和验证'
  },
  {
    sourceType: 'historical_data',
    priority: 3,
    weight: 1.0,
    reason: '历史数据提供参考价值，但可能存在时效性问题'
  }
]

const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  visible = true,
  onSourcesChange,
  onPriorityChange,
  defaultSources = DEFAULT_DATA_SOURCES,
  userContext,
  showAdvanced = false,
  disabled = false,
  compact = false
}) => {
  const [sources, setSources] = useState<DataSource[]>(defaultSources)
  const [priorities, setPriorities] = useState<DataSourcePriority[]>(DEFAULT_PRIORITIES)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(showAdvanced)
  const [editingSource, setEditingSource] = useState<string | null>(null)
  const [smartRecommendations, setSmartRecommendations] = useState<string[]>([])

  // 数据源类型配置
  const sourceTypeConfig = {
    documents: {
      icon: <FileTextOutlined />,
      color: '#1890ff',
      title: '文档知识库',
      description: '搜索项目文档、技术规范等文本内容'
    },
    knowledge_graph: {
      icon: <NodeIndexOutlined />,
      color: '#52c41a',
      title: '知识图谱',
      description: '通过实体关系发现深层次信息'
    },
    historical_data: {
      icon: <CalculatorOutlined />,
      color: '#fa8c16',
      title: '历史项目数据',
      description: '基于相似项目提供成本估算参考'
    }
  }

  // 初始化时生成智能推荐
  useEffect(() => {
    if (userContext?.currentQuery) {
      generateSmartRecommendations(userContext.currentQuery)
    }
  }, [userContext])

  // 处理数据源选择变化
  const handleSourceToggle = (sourceId: string, enabled: boolean) => {
    const updatedSources = sources.map(source =>
      source.id === sourceId ? { ...source, enabled } : source
    )
    setSources(updatedSources)
    onSourcesChange?.(updatedSources)
  }

  // 处理优先级变化
  const handlePriorityChange = (sourceId: string, priority: number) => {
    const updatedSources = sources.map(source =>
      source.id === sourceId ? { ...source, priority } : source
    )
    setSources(updatedSources)

    // 同时更新优先级配置
    const source = sources.find(s => s.id === sourceId)
    if (source) {
      const updatedPriorities = priorities.map(p =>
        p.sourceType === source.type
          ? { ...p, priority }
          : p
      )
      setPriorities(updatedPriorities)
      onPriorityChange?.(updatedPriorities)
    }
  }

  // 处理权重变化
  const handleWeightChange = (sourceType: DataSourceType, weight: number) => {
    const updatedPriorities = priorities.map(p =>
      p.sourceType === sourceType ? { ...p, weight } : p
    )
    setPriorities(updatedPriorities)
    onPriorityChange?.(updatedPriorities)
  }

  // 处理配置变化
  const handleConfigChange = (sourceId: string, config: Partial<DataSourceConfig>) => {
    const updatedSources = sources.map(source =>
      source.id === sourceId
        ? { ...source, config: { ...source.config, ...config } }
        : source
    )
    setSources(updatedSources)
    onSourcesChange?.(updatedSources)
  }

  // 生成智能推荐
  const generateSmartRecommendations = (query: string) => {
    const recommendations: string[] = []

    // 基于查询内容推荐数据源
    if (query.includes('成本') || query.includes('价格') || query.includes('预算')) {
      recommendations.push('建议启用历史项目数据以获得成本参考')
    }

    if (query.includes('关系') || query.includes('关联') || query.includes('结构')) {
      recommendations.push('建议优先使用知识图谱来发现实体关系')
    }

    if (query.includes('文档') || query.includes('规范') || query.includes('标准')) {
      recommendations.push('建议启用文档知识库搜索相关文档')
    }

    if (query.length < 10) {
      recommendations.push('查询较短，建议启用多个数据源以获得更全面的结果')
    }

    setSmartRecommendations(recommendations)
  }

  // 应用智能配置
  const applySmartConfiguration = () => {
    const optimizedSources = sources.map(source => {
      let enabled = source.enabled
      let priority = source.priority
      let config = { ...source.config }

      // 根据查询类型优化配置
      if (userContext?.currentQuery) {
        const query = userContext.currentQuery.toLowerCase()

        // 成本相关查询
        if (query.includes('成本') || query.includes('价格')) {
          if (source.type === 'historical_data') {
            enabled = true
            priority = 1
            config.maxResults = 20
            config.similarityThreshold = 0.7
          }
        }

        // 关系相关查询
        if (query.includes('关系') || query.includes('关联')) {
          if (source.type === 'knowledge_graph') {
            enabled = true
            priority = 1
            config.depth = 3
            config.includeProperties = true
          }
        }

        // 文档相关查询
        if (query.includes('文档') || query.includes('规范')) {
          if (source.type === 'documents') {
            enabled = true
            priority = 1
            config.searchType = 'semantic'
            config.includeContent = true
          }
        }
      }

      return { ...source, enabled, priority, config }
    })

    setSources(optimizedSources)
    onSourcesChange?.(optimizedSources)
    message.success('已应用智能配置优化')
  }

  // 重置为默认配置
  const resetToDefaults = () => {
    setSources(DEFAULT_DATA_SOURCES)
    setPriorities(DEFAULT_PRIORITIES)
    onSourcesChange?.(DEFAULT_DATA_SOURCES)
    onPriorityChange?.(DEFAULT_PRIORITIES)
    message.info('已重置为默认配置')
  }

  // 渲染数据源卡片
  const renderSourceCard = (source: DataSource) => {
    const config = sourceTypeConfig[source.type]
    const isEnabled = source.enabled

    return (
      <Card
        key={source.id}
        size={compact ? 'small' : 'default'}
        className={`data-source-card ${isEnabled ? 'enabled' : 'disabled'}`}
        style={{
          opacity: isEnabled ? 1 : 0.6,
          borderColor: isEnabled ? config.color : '#d9d9d9',
          marginBottom: compact ? 8 : 16
        }}
        extra={
          <Space>
            <Tooltip title="编辑配置">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditingSource(editingSource === source.id ? null : source.id)}
              />
            </Tooltip>
            <Checkbox
              checked={isEnabled}
              onChange={(e) => handleSourceToggle(source.id, e.target.checked)}
              disabled={disabled}
            />
          </Space>
        }
        title={
          <Space>
            <span style={{ color: config.color }}>{config.icon}</span>
            <span>{config.title}</span>
            <Badge
              count={source.priority}
              style={{
                backgroundColor: config.color,
                fontSize: '12px'
              }}
            />
          </Space>
        }
      >
        <div>
          <Paragraph style={{ marginBottom: 12, fontSize: compact ? 12 : 14 }}>
            {config.description}
          </Paragraph>

          {/* 优先级设置 */}
          <div style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: compact ? 12 : 14 }}>
                优先级: {source.priority}
              </Text>
              <Slider
                min={1}
                max={5}
                value={source.priority}
                onChange={(value) => handlePriorityChange(source.id, value)}
                disabled={disabled || !isEnabled}
                style={{ margin: 0 }}
                tooltip={{ formatter: (value) => `优先级 ${value}` }}
              />
            </Space>
          </div>

          {/* 高级配置 */}
          {editingSource === source.id && (
            <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
              <Title level={5}>高级配置</Title>
              {renderAdvancedConfig(source)}
            </div>
          )}

          {/* 状态信息 */}
          <div style={{ marginTop: 12 }}>
            <Space wrap>
              <Tag color={source.status === 'active' ? 'green' : 'orange'}>
                {source.status === 'active' ? '可用' : '不可用'}
              </Tag>
              <Tooltip title={`最后同步: ${new Date(source.lastSync).toLocaleString()}`}>
                <Tag icon={<InfoCircleOutlined />} color="blue">
                  已同步
                </Tag>
              </Tooltip>
            </Space>
          </div>
        </div>
      </Card>
    )
  }

  // 渲染高级配置
  const renderAdvancedConfig = (source: DataSource) => {
    switch (source.type) {
      case 'documents':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>最大结果数:</Text>
              <InputNumber
                min={1}
                max={50}
                value={source.config.maxResults}
                onChange={(value) => handleConfigChange(source.id, { maxResults: value })}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>搜索类型:</Text>
              <Select
                value={source.config.searchType}
                onChange={(value) => handleConfigChange(source.id, { searchType: value })}
                style={{ width: '100%', marginTop: 4 }}
              >
                <Option value="semantic">语义搜索</Option>
                <Option value="keyword">关键词搜索</Option>
                <Option value="hybrid">混合搜索</Option>
              </Select>
            </div>
            <div>
              <Space>
                <Text strong>包含内容:</Text>
                <Switch
                  checked={source.config.includeContent}
                  onChange={(checked) => handleConfigChange(source.id, { includeContent: checked })}
                />
              </Space>
            </div>
          </Space>
        )

      case 'knowledge_graph':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>最大结果数:</Text>
              <InputNumber
                min={1}
                max={50}
                value={source.config.maxResults}
                onChange={(value) => handleConfigChange(source.id, { maxResults: value })}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>搜索深度:</Text>
              <InputNumber
                min={1}
                max={5}
                value={source.config.depth}
                onChange={(value) => handleConfigChange(source.id, { depth: value })}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <Space>
                <Text strong>包含属性:</Text>
                <Switch
                  checked={source.config.includeProperties}
                  onChange={(checked) => handleConfigChange(source.id, { includeProperties: checked })}
                />
              </Space>
            </div>
          </Space>
        )

      case 'historical_data':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>最大结果数:</Text>
              <InputNumber
                min={1}
                max={50}
                value={source.config.maxResults}
                onChange={(value) => handleConfigChange(source.id, { maxResults: value })}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>相似度阈值:</Text>
              <Slider
                min={0.1}
                max={1}
                step={0.1}
                value={source.config.similarityThreshold}
                onChange={(value) => handleConfigChange(source.id, { similarityThreshold: value })}
                style={{ marginTop: 4 }}
                tooltip={{ formatter: (value) => `${(value * 100).toFixed(0)}%` }}
              />
            </div>
            <div>
              <Space>
                <Text strong>包含成本数据:</Text>
                <Switch
                  checked={source.config.includeCostData}
                  onChange={(checked) => handleConfigChange(source.id, { includeCostData: checked })}
                />
              </Space>
            </div>
          </Space>
        )

      default:
        return null
    }
  }

  // 渲染优先级配置
  const renderPriorityConfig = () => (
    <Card title="优先级策略" size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {priorities.map((priority, index) => (
          <div key={priority.sourceType} style={{ padding: '8px 0' }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Space>
                  <span style={{ color: sourceTypeConfig[priority.sourceType].color }}>
                    {sourceTypeConfig[priority.sourceType].icon}
                  </span>
                  <Text strong>{sourceTypeConfig[priority.sourceType].title}</Text>
                </Space>
              </Col>
              <Col span={4}>
                <Text>优先级: {priority.priority}</Text>
              </Col>
              <Col span={6}>
                <Space>
                  <Text>权重:</Text>
                  <InputNumber
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={priority.weight}
                    onChange={(value) => handleWeightChange(priority.sourceType, value || 1)}
                    size="small"
                    style={{ width: 80 }}
                  />
                </Space>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {priority.reason}
                </Text>
              </Col>
            </Row>
          </div>
        ))}
      </Space>
    </Card>
  )

  // 渲染智能推荐
  const renderSmartRecommendations = () => {
    if (smartRecommendations.length === 0) return null

    return (
      <Alert
        message="智能推荐"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {smartRecommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Button size="small" onClick={applySmartConfiguration}>
            应用推荐
          </Button>
        }
      />
    )
  }

  // 渲染统计信息
  const renderStatistics = () => {
    const enabledCount = sources.filter(s => s.enabled).length
    const totalCount = sources.length

    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#1890ff', fontWeight: 'bold' }}>
                {enabledCount}
              </div>
              <div style={{ color: '#666' }}>已启用数据源</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#52c41a', fontWeight: 'bold' }}>
                {totalCount}
              </div>
              <div style={{ color: '#666' }}>总数据源</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#fa8c16', fontWeight: 'bold' }}>
                {Math.round((enabledCount / totalCount) * 100)}%
              </div>
              <div style={{ color: '#666' }}>启用率</div>
            </div>
          </Card>
        </Col>
      </Row>
    )
  }

  if (!visible) return null

  return (
    <div className="data-source-selector">
      {/* 标题和操作 */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Title level={4} style={{ margin: 0 }}>
                数据源配置
              </Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title="显示高级配置">
                <Switch
                  checked={showAdvancedConfig}
                  onChange={setShowAdvancedConfig}
                  checkedChildren="高级"
                  unCheckedChildren="基础"
                />
              </Tooltip>
              <Button onClick={resetToDefaults} disabled={disabled}>
                重置默认
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 统计信息 */}
      {renderStatistics()}

      {/* 智能推荐 */}
      {renderSmartRecommendations()}

      {/* 优先级配置 */}
      {showAdvancedConfig && renderPriorityConfig()}

      {/* 数据源列表 */}
      <Collapse ghost>
        <Panel
          header={
            <Space>
              <SettingOutlined />
              <span>数据源列表</span>
              <Badge count={sources.filter(s => s.enabled).length} />
            </Space>
          }
          key="sources"
        >
          <Row gutter={[16, 16]}>
            {sources.map(source => (
              <Col key={source.id} xs={24} lg={showAdvancedConfig ? 24 : 12}>
                {renderSourceCard(source)}
              </Col>
            ))}
          </Row>
        </Panel>
      </Collapse>

      {/* 操作提示 */}
      <Alert
        message="配置说明"
        description={
          <div>
            <div>• 优先级数字越小，优先级越高</div>
            <div>• 权重影响最终答案的融合结果</div>
            <div>• 建议根据查询类型动态调整数据源配置</div>
            <div>• 点击数据源卡片右上角的编辑按钮可以查看高级配置</div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  )
}

export default DataSourceSelector