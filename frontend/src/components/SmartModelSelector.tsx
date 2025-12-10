import React, { useState, useEffect } from 'react'
import { Select, Space, Typography, Badge, Tooltip, Button, message } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  BulbOutlined
} from '@ant-design/icons'
import type { SelectProps } from 'antd'

import {
  CHINESE_LLM_PROVIDERS,
  ALL_CHINESE_MODELS,
  LLMProviderType,
  LLMModel
} from '@/config/models'
import { getAIModelStatus, getRecommendedModel, AIModelStatus } from '@/services/aiModelStatusService'

const { Text } = Typography
const { Option } = Select

export interface SmartModelSelectorProps extends Omit<SelectProps<string>, 'options' | 'children'> {
  /**
   * 是否自动切换到配置成功的模型
   */
  autoSelectConfigured?: boolean
  /**
   * 模型选择回调
   */
  onModelSelect?: (model: LLMModel, status: AIModelStatus) => void
}

const SmartModelSelector: React.FC<SmartModelSelectorProps> = ({
  autoSelectConfigured = true,
  onModelSelect,
  value,
  onChange,
  ...selectProps
}) => {
  const [modelStatuses, setModelStatuses] = useState<AIModelStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [recommendedModel, setRecommendedModel] = useState<AIModelStatus | null>(null)

  // 提供商映射
  const providerMap: Record<string, string> = {
    'glm': 'zhipuai',
    'kimi': 'moonshot',
    'qwen': 'dashscope',
    'wenxin': 'baidu',
    'deepseek': 'deepseek',
    'yi': 'yi',
    'spark': 'spark'
  }

  // 反向映射
  const reverseProviderMap: Record<string, string> = {
    'zhipuai': 'glm',
    'moonshot': 'kimi',
    'dashscope': 'qwen',
    'baidu': 'wenxin',
    'deepseek': 'deepseek',
    'yi': 'yi',
    'spark': 'spark'
  }

  useEffect(() => {
    loadModelStatuses()
  }, [])

  useEffect(() => {
    if (autoSelectConfigured && modelStatuses.length > 0 && !value) {
      selectFirstAvailableModel()
    }
  }, [modelStatuses, autoSelectConfigured, value])

  const loadModelStatuses = async () => {
    setLoading(true)
    try {
      const statuses = await getAIModelStatus()
      setModelStatuses(statuses)

      // 获取推荐模型
      const recommended = await getRecommendedModel()
      setRecommendedModel(recommended)
    } catch (error) {
      console.error('加载模型状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectFirstAvailableModel = () => {
    const configuredModels = modelStatuses.filter(s => s.configured && s.enabled)
    if (configuredModels.length > 0) {
      // 按优先级选择
      const priorityOrder = ['moonshot', 'zhipuai', 'dashscope', 'deepseek', 'yi', 'baidu', 'spark']

      for (const provider of priorityOrder) {
        const model = configuredModels.find(s => s.provider === provider)
        if (model) {
          const firstModel = ALL_CHINESE_MODELS.find(m => m.provider === reverseProviderMap[provider])
          if (firstModel) {
            handleChange(firstModel.id, firstModel, model)
            return
          }
        }
      }
    }
  }

  const getModelStatus = (model: LLMModel): AIModelStatus | undefined => {
    const providerKey = providerMap[model.provider]
    return modelStatuses.find(s => s.provider === providerKey)
  }

  const getStatusBadge = (status: AIModelStatus | undefined) => {
    if (!status) {
      return <Badge status="processing" text="检测中" />
    }

    if (status.configured && status.enabled) {
      return (
        <Tooltip title={`${status.providerName} API已配置并可用`}>
          <Badge
            status="success"
            icon={<CheckCircleOutlined />}
            text="可用"
          />
        </Tooltip>
      )
    } else if (!status.configured) {
      return (
        <Tooltip title={`${status.providerName} 未配置API密钥`}>
          <Badge
            status="error"
            icon={<CloseCircleOutlined />}
            text="未配置"
          />
        </Tooltip>
      )
    } else {
      return (
        <Tooltip title={`${status.providerName} 已配置但已禁用`}>
          <Badge
            status="warning"
            icon={<ExclamationCircleOutlined />}
            text="已禁用"
          />
        </Tooltip>
      )
    }
  }

  const getProviderTag = (provider: string, status?: AIModelStatus) => {
    const providerInfo = CHINESE_LLM_PROVIDERS.find(p => p.id === provider)
    const isRecommended = status && recommendedModel?.provider === providerMap[provider]

    return (
      <Space>
        {providerInfo && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            backgroundColor: isRecommended ? '#f0f9ff' : '#f5f5f5',
            border: isRecommended ? '1px solid #1890ff' : '1px solid #d9d9d9',
            color: isRecommended ? '#1890ff' : '#666'
          }}>
            {isRecommended && <BulbOutlined style={{ marginRight: 4 }} />}
            {providerInfo.displayName}
          </span>
        )}
        {status && getStatusBadge(status)}
      </Space>
    )
  }

  const handleChange = (selectedValue: string, model: LLMModel, status?: AIModelStatus) => {
    onChange?.(selectedValue, { model, status })
    onModelSelect?.(model, status || {} as AIModelStatus)
  }

  const handleSelect = (selectedValue: string) => {
    const model = ALL_CHINESE_MODELS.find(m => m.id === selectedValue)
    const status = getModelStatus(model!)

    if (status && !status.configured) {
      message.warning(`${status.providerName} 未配置API密钥，请先在系统设置中配置`)
    }

    handleChange(selectedValue, model!, status)
  }

  // 按提供商分组
  const groupedModels = ALL_CHINESE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, LLMModel[]>)

  return (
    <div>
      <Select<string>
        value={value}
        onChange={handleChange}
        placeholder="请选择AI模型"
        style={{ width: '100%' }}
        {...selectProps}
      >
        {loading ? (
          <Option value="" disabled>
            <Space>
              <span>检测模型配置中...</span>
            </Space>
          </Option>
        ) : (
          Object.entries(groupedModels).map(([provider, models]) => {
            const providerStatus = modelStatuses.find(s => s.provider === providerMap[provider])

            return (
              <Select.OptGroup
                key={provider}
                label={
                  <Space>
                    {getProviderTag(provider, providerStatus)}
                    {providerStatus?.configured && (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    )}
                  </Space>
                }
              >
                {models.map(model => {
                  const status = getModelStatus(model)
                  return (
                    <Option
                      key={model.id}
                      value={model.id}
                      disabled={!status?.configured}
                    >
                      <Space>
                        <Text>{model.displayName}</Text>
                        {status?.configured && (
                          <CheckCircleOutlined
                            style={{ color: '#52c41a', fontSize: '12px' }}
                          />
                        )}
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          <ThunderboltOutlined style={{ marginRight: 2 }} />
                          {(model.contextLength / 1000).toFixed(0)}K
                        </Text>
                      </Space>
                    </Option>
                  )
                })}
              </Select.OptGroup>
            )
          })
        )}
      </Select>
    </div>
  )
}

export default SmartModelSelector