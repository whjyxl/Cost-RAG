import React, { useState, useEffect } from 'react'
import {
  Select,
  Card,
  Tag,
  Space,
  Typography,
  Tooltip,
  Row,
  Col,
  Badge,
  Button,
  Divider,
  Descriptions,
  Progress,
  Switch,
  InputNumber,
  Alert,
  Collapse,
  List,
  Avatar,
  Statistic,
  message
} from 'antd'
import {
  SettingOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  GlobalOutlined,
  BulbOutlined,
  ToolOutlined,
  CodeOutlined,
  SearchOutlined,
  ClusterOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RocketOutlined
} from '@ant-design/icons'
import type { SelectProps } from 'antd'

import {
  EmbeddingModel,
  EmbeddingProvider,
  EmbeddingProviderType,
  EmbeddingApiConfig,
  EmbeddingCapabilities,
  CHINESE_EMBEDDING_PROVIDERS,
  ALL_CHINESE_EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_CONFIG
} from '@/config/models'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { Panel } = Collapse

interface EmbeddingModelSelectorProps {
  value?: string
  onChange?: (modelId: string, provider: EmbeddingProviderType) => void
  onConfigChange?: (config: EmbeddingApiConfig) => void
  showConfig?: boolean
  showPricing?: boolean
  showCapabilities?: boolean
  groupByProvider?: boolean
  showComparison?: boolean
  disabled?: boolean
  placeholder?: string
  style?: React.CSSProperties
  size?: 'small' | 'middle' | 'large'
}

const EmbeddingModelSelector: React.FC<EmbeddingModelSelectorProps> = ({
  value,
  onChange,
  onConfigChange,
  showConfig = false,
  showPricing = false,
  showCapabilities = false,
  groupByProvider = false,
  showComparison = false,
  disabled = false,
  placeholder = '请选择Embedding模型',
  style,
  size = 'middle'
}) => {
  const [selectedProvider, setSelectedProvider] = useState<EmbeddingProviderType>('glm')
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_EMBEDDING_CONFIG.model)
  const [config, setConfig] = useState<EmbeddingApiConfig>(DEFAULT_EMBEDDING_CONFIG)
  const [comparisonVisible, setComparisonVisible] = useState(false)
  const [customConfigVisible, setCustomConfigVisible] = useState(false)

  // 初始化选中的模型
  useEffect(() => {
    if (value) {
      const model = ALL_CHINESE_EMBEDDING_MODELS.find(m => m.id === value)
      if (model) {
        setSelectedModel(model.id)
        setSelectedProvider(model.provider)
      }
    }
  }, [value])

  // 处理模型选择
  const handleModelChange = (modelId: string) => {
    const model = ALL_CHINESE_EMBEDDING_MODELS.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(modelId)
      setSelectedProvider(model.provider)

      const newConfig: EmbeddingApiConfig = {
        ...config,
        model: modelId,
        provider: model.provider,
        maxTokens: model.maxTokens
      }

      setConfig(newConfig)
      onChange?.(modelId, model.provider)
      onConfigChange?.(newConfig)
    }
  }

  // 处理配置变更
  const handleConfigChange = (key: keyof EmbeddingApiConfig, value: any) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    onConfigChange?.(newConfig)
  }

  // 获取当前选中的模型信息
  const currentModel = ALL_CHINESE_EMBEDDING_MODELS.find(m => m.id === selectedModel)
  const currentProvider = CHINESE_EMBEDDING_PROVIDERS.find(p => p.id === selectedProvider)

  // 获取模型能力图标
  const getCapabilityIcon = (capability: keyof EmbeddingCapabilities) => {
    const icons = {
      multilingual: <GlobalOutlined />,
      long_text: <RocketOutlined />,
      code_embedding: <CodeOutlined />,
      semantic_search: <SearchOutlined />,
      classification: <BulbOutlined />,
      clustering: <ClusterOutlined />,
      reranking: <SwapOutlined />
    }
    return icons[capability] || <ToolOutlined />
  }

  // 获取能力名称
  const getCapabilityName = (capability: keyof EmbeddingCapabilities) => {
    const names = {
      multilingual: '多语言',
      long_text: '长文本',
      code_embedding: '代码嵌入',
      semantic_search: '语义搜索',
      classification: '文本分类',
      clustering: '聚类分析',
      reranking: '重排序'
    }
    return names[capability] || capability
  }

  // 分组选项
  const groupedOptions = groupByProvider
    ? CHINESE_EMBEDDING_PROVIDERS.map(provider => ({
      label: (
        <Space>
          <Avatar size="small" src={provider.logo} style={{ backgroundColor: '#1890ff' }}>
            {provider.displayName[0]}
          </Avatar>
          <Text strong>{provider.displayName}</Text>
          <Badge count={provider.models.length} size="small" />
        </Space>
      ),
      options: provider.models.map(model => ({
        label: (
          <Space>
            <Text>{model.displayName}</Text>
            {model.tags?.map(tag => (
              <Tag key={tag} size="small">{tag}</Tag>
            ))}
          </Space>
        ),
        value: model.id,
        disabled: model.status !== 'active'
      }))
    }))
    : ALL_CHINESE_EMBEDDING_MODELS.map(model => ({
      label: (
        <Space>
          <Text>{model.displayName}</Text>
          <Tag size="small">{currentProvider?.displayName}</Tag>
          {model.tags?.map(tag => (
            <Tag key={tag} size="small">{tag}</Tag>
          ))}
        </Space>
      ),
      value: model.id,
      disabled: model.status !== 'active'
    }))

  // 渲染模型详情
  const renderModelDetails = () => {
    if (!currentModel || !currentProvider) return null

    return (
      <div>
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="提供商">
            <Space>
              <Avatar size="small" src={currentProvider.logo} style={{ backgroundColor: '#1890ff' }}>
                {currentProvider.displayName[0]}
              </Avatar>
              <Text strong>{currentProvider.displayName}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="模型名称">{currentModel.displayName}</Descriptions.Item>
          <Descriptions.Item label="向量维度">
            <Space>
              <Text strong>{currentModel.dimensions}</Text>
              <Text type="secondary">维</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="最大Tokens">
            <Space>
              <Text strong>{currentModel.maxTokens.toLocaleString()}</Text>
              <Text type="secondary">tokens</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Badge
              status={currentModel.status === 'active' ? 'success' : 'default'}
              text={currentModel.status === 'active' ? '可用' : '不可用'}
            />
          </Descriptions.Item>
        </Descriptions>

        {showPricing && currentModel.pricing && (
          <Card size="small" title="定价信息" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="输入价格"
                  value={currentModel.pricing.input}
                  prefix={<DollarOutlined />}
                  suffix={`/${currentModel.pricing.unit}`}
                  precision={4}
                  valueStyle={{ fontSize: '14px' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="货币"
                  value={currentModel.pricing.currency}
                  valueStyle={{ fontSize: '14px' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {showCapabilities && (
          <Card size="small" title="模型能力">
            <Row gutter={[8, 8]}>
              {Object.entries(currentModel.capabilities).map(([key, enabled]) => (
                <Col span={12} key={key}>
                  <Space>
                    {getCapabilityIcon(key as keyof EmbeddingCapabilities)}
                    <Text style={{ color: enabled ? '#52c41a' : '#999' }}>
                      {getCapabilityName(key as keyof EmbeddingCapabilities)}
                    </Text>
                    {enabled && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {currentModel.description && (
          <Alert
            message={currentModel.description}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    )
  }

  // 渲染自定义配置
  const renderCustomConfig = () => (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>最大Tokens</Text>
            <InputNumber
              value={config.maxTokens}
              onChange={(value) => handleConfigChange('maxTokens', value)}
              min={1}
              max={32000}
              style={{ width: '100%' }}
            />
          </Space>
        </Col>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>批处理大小</Text>
            <InputNumber
              value={config.batchSize}
              onChange={(value) => handleConfigChange('batchSize', value)}
              min={1}
              max={1000}
              style={{ width: '100%' }}
            />
          </Space>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>超时时间 (ms)</Text>
            <InputNumber
              value={config.timeout}
              onChange={(value) => handleConfigChange('timeout', value)}
              min={1000}
              max={300000}
              style={{ width: '100%' }}
            />
          </Space>
        </Col>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>重试次数</Text>
            <InputNumber
              value={config.retryCount}
              onChange={(value) => handleConfigChange('retryCount', value)}
              min={0}
              max={10}
              style={{ width: '100%' }}
            />
          </Space>
        </Col>
      </Row>
      <Row style={{ marginTop: 16 }}>
        <Col span={12}>
          <Space>
            <Text strong>启用缓存</Text>
            <Switch
              checked={config.enableCache}
              onChange={(checked) => handleConfigChange('enableCache', checked)}
            />
          </Space>
        </Col>
      </Row>
    </div>
  )

  return (
    <div style={style}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          value={selectedModel}
          placeholder={placeholder}
          onChange={handleModelChange}
          options={groupedOptions}
          size={size}
          disabled={disabled}
          style={{ width: '100%' }}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
        />

        {/* 模型详情 */}
        {currentModel && (
          <Collapse ghost>
            <Panel
              header={
                <Space>
                  <InfoCircleOutlined />
                  <Text>模型详情</Text>
                </Space>
              }
              key="details"
            >
              {renderModelDetails()}
            </Panel>
          </Collapse>
        )}

        {/* 高级配置 */}
        {showConfig && (
          <Collapse ghost>
            <Panel
              header={
                <Space>
                  <SettingOutlined />
                  <Text>高级配置</Text>
                </Space>
              }
              key="config"
            >
              {renderCustomConfig()}
            </Panel>
          </Collapse>
        )}

        {/* 模型对比 */}
        {showComparison && (
          <Button
            type="dashed"
            icon={<SwapOutlined />}
            onClick={() => setComparisonVisible(true)}
            style={{ width: '100%' }}
          >
            模型对比
          </Button>
        )}
      </Space>

      {/* 模型对比弹窗 */}
      {comparisonVisible && (
        <Modal
          title="Embedding模型对比"
          open={comparisonVisible}
          onCancel={() => setComparisonVisible(false)}
          footer={null}
          width={1000}
        >
          <List
            dataSource={ALL_CHINESE_EMBEDDING_MODELS}
            renderItem={(model) => (
              <List.Item key={model.id}>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      style={{
                        backgroundColor: model.status === 'active' ? '#52c41a' : '#d9d9d9'
                      }}
                    >
                      {model.displayName[0]}
                    </Avatar>
                  }
                  title={
                    <Space>
                      <Text strong>{model.displayName}</Text>
                      <Tag size="small">{CHINESE_EMBEDDING_PROVIDERS.find(p => p.id === model.provider)?.displayName}</Tag>
                    </Space>
                  }
                  description={
                    <Row gutter={16}>
                      <Col span={6}>
                        <Text type="secondary">维度: </Text>
                        <Text strong>{model.dimensions}</Text>
                      </Col>
                      <Col span={6}>
                        <Text type="secondary">Tokens: </Text>
                        <Text strong>{model.maxTokens.toLocaleString()}</Text>
                      </Col>
                      <Col span={6}>
                        <Text type="secondary">多语言: </Text>
                        <Text style={{ color: model.capabilities.multilingual ? '#52c41a' : '#999' }}>
                          {model.capabilities.multilingual ? '支持' : '不支持'}
                        </Text>
                      </Col>
                      <Col span={6}>
                        <Text type="secondary">长文本: </Text>
                        <Text style={{ color: model.capabilities.long_text ? '#52c41a' : '#999' }}>
                          {model.capabilities.long_text ? '支持' : '不支持'}
                        </Text>
                      </Col>
                    </Row>
                  }
                />
              </List.Item>
            )}
          />
        </Modal>
      )}
    </div>
  )
}

export default EmbeddingModelSelector