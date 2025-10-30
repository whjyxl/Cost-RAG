import React from 'react'
import { Select, Tag, Space, Tooltip, Typography } from 'antd'
import { ThunderboltOutlined, DollarOutlined } from '@ant-design/icons'
import type { SelectProps } from 'antd'

// 导入模型配置
import {
  CHINESE_LLM_PROVIDERS,
  ALL_CHINESE_MODELS,
  LLMProviderType,
  LLMModel
} from '../../config/models'

const { Text } = Typography
const { Option } = Select

export interface ModelSelectorProps extends Omit<SelectProps<string>, 'options' | 'children'> {
  /**
   * 是否显示国际模型
   */
  showInternationalModels?: boolean
  /**
   * 是否显示国产模型
   */
  showChineseModels?: boolean
  /**
   * 显示模型能力标签
   */
  showCapabilities?: boolean
  /**
   * 显示模型价格信息
   */
  showPricing?: boolean
  /**
   * 显示上下文长度
   */
  showContextLength?: boolean
  /**
   * 按提供商分组显示
   */
  groupByProvider?: boolean
  /**
   * 过滤器函数
   */
  filter?: (model: LLMModel) => boolean
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  showInternationalModels = true,
  showChineseModels = true,
  showCapabilities = false,
  showPricing = false,
  showContextLength = true,
  groupByProvider = false,
  filter,
  ...selectProps
}) => {
  // 国际模型配置
  const internationalModels: LLMModel[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      displayName: 'GPT-4',
      provider: 'openai',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.03,
        output: 0.06,
        currency: 'USD',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: 'OpenAI最强大的多模态模型',
      tags: ['多模态', '推理', '代码'],
      status: 'active',
      releaseDate: '2023-03-14'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      displayName: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextLength: 16384,
      maxTokens: 4096,
      pricing: {
        input: 0.0015,
        output: 0.002,
        currency: 'USD',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: false,
        multimodal: false,
        function_calling: true
      },
      description: '快速、经济的通用模型',
      tags: ['快速', '经济', '通用'],
      status: 'active',
      releaseDate: '2022-11-28'
    },
    {
      id: 'claude-3',
      name: 'Claude 3',
      displayName: 'Claude 3',
      provider: 'claude',
      contextLength: 200000,
      maxTokens: 4096,
      pricing: {
        input: 0.015,
        output: 0.075,
        currency: 'USD',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: 'Anthropic的最新AI助手',
      tags: ['安全', '长上下文', '分析'],
      status: 'active',
      releaseDate: '2024-03-04'
    }
  ]

  // 获取所有模型
  const getAllModels = (): LLMModel[] => {
    const models: LLMModel[] = []

    if (showInternationalModels) {
      models.push(...internationalModels)
    }

    if (showChineseModels) {
      models.push(...ALL_CHINESE_MODELS)
    }

    // 应用过滤器
    if (filter) {
      return models.filter(filter)
    }

    return models
  }

  // 获取模型能力标签
  const getModelCapabilityTags = (model: LLMModel) => {
    if (!showCapabilities) return null

    const capabilityTags = {
      chat: { label: '对话', color: 'blue' },
      reasoning: { label: '推理', color: 'purple' },
      code: { label: '代码', color: 'green' },
      analysis: { label: '分析', color: 'orange' },
      translation: { label: '翻译', color: 'cyan' },
      long_context: { label: '长上下文', color: 'red' },
      multimodal: { label: '多模态', color: 'magenta' },
      function_calling: { label: '函数调用', color: 'teal' }
    }

    return (
      <Space wrap style={{ marginLeft: 8 }}>
        {Object.entries(model.capabilities)
          .filter(([_, enabled]) => enabled)
          .slice(0, 3) // 最多显示3个标签
          .map(([capability]) => (
            <Tag key={capability} size="small" color={capabilityTags[capability]?.color}>
              {capabilityTags[capability]?.label}
            </Tag>
          ))}
      </Space>
    )
  }

  // 获取模型价格信息
  const getModelPricingInfo = (model: LLMModel) => {
    if (!showPricing || !model.pricing) return null

    return (
      <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
        <DollarOutlined style={{ marginRight: 4 }} />
        {model.pricing.currency} {model.pricing.input}/{model.pricing.unit}
      </Text>
    )
  }

  // 获取模型上下文长度信息
  const getContextLengthInfo = (model: LLMModel) => {
    if (!showContextLength) return null

    return (
      <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
        <ThunderboltOutlined style={{ marginRight: 4 }} />
        {(model.contextLength / 1000).toFixed(0)}K
      </Text>
    )
  }

  // 获取提供商标签
  const getProviderTag = (provider: string) => {
    const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === provider)
    if (providerInfo) {
      return <Tag color="blue" size="small">{providerInfo.displayName}</Tag>
    }

    const internationalProviders: Record<string, { color: string; label: string }> = {
      'openai': { color: 'green', label: 'OpenAI' },
      'claude': { color: 'purple', label: 'Claude' },
      'local': { color: 'orange', label: '本地' }
    }

    const providerConfig = internationalProviders[provider]
    return providerConfig ? (
      <Tag color={providerConfig.color} size="small">{providerConfig.label}</Tag>
    ) : null
  }

  // 按提供商分组
  if (groupByProvider) {
    const models = getAllModels()
    const groupedModels = models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    }, {} as Record<string, LLMModel[]>)

    return (
      <Select<string> {...selectProps}>
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <Select.OptGroup key={provider} label={getProviderTag(provider)}>
            {providerModels.map(model => (
              <Option key={model.id} value={model.id}>
                <Space>
                  <Text>{model.displayName}</Text>
                  {getContextLengthInfo(model)}
                  {getModelPricingInfo(model)}
                  {getModelCapabilityTags(model)}
                </Space>
              </Option>
            ))}
          </Select.OptGroup>
        ))}
      </Select>
    )
  }

  // 不分组显示
  return (
    <Select<string> {...selectProps}>
      {getAllModels().map(model => (
        <Option key={model.id} value={model.id}>
          <Space>
            <Text>{model.displayName}</Text>
            {getProviderTag(model.provider)}
            {getContextLengthInfo(model)}
            {getModelPricingInfo(model)}
            {getModelCapabilityTags(model)}
          </Space>
        </Option>
      ))}
    </Select>
  )
}

export default ModelSelector