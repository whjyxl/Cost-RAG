import React, { useState, useEffect } from 'react'
import { Badge, Tooltip, Space, Typography, Button, message } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { getAIModelStatus, testAIModel, AIModelStatus } from '@/services/aiModelStatusService'
import logger from '@/utils/logger'

const { Text } = Typography

interface AIModelStatusIndicatorProps {
  provider: string
  providerName: string
  onStatusChange?: (configured: boolean) => void
}

const AIModelStatusIndicator: React.FC<AIModelStatusIndicatorProps> = ({
  provider,
  providerName,
  onStatusChange
}) => {
  const [status, setStatus] = useState<AIModelStatus | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [provider])

  const loadStatus = async () => {
    try {
      const allStatus = await getAIModelStatus()
      const currentStatus = allStatus.find(s => s.provider === provider)
      setStatus(currentStatus || null)
      onStatusChange?.(currentStatus?.configured || false)
    } catch (error) {
      logger.error('加载模型状态失败:', error)
    }
  }

  const handleTest = async () => {
    setLoading(true)
    try {
      const success = await testAIModel(provider)
      if (success) {
        message.success(`${providerName} 测试成功`)
        loadStatus()
      } else {
        message.error(`${providerName} 测试失败`)
      }
    } catch (error) {
      message.error(`${providerName} 测试出错`)
    } finally {
      setLoading(false)
    }
  }

  if (!status) {
    return (
      <Tooltip title="正在检测配置状态...">
        <Badge status="processing" text="检测中" />
      </Tooltip>
    )
  }

  const getStatusConfig = () => {
    if (status.configured && status.enabled) {
      return {
        status: 'success' as const,
        icon: <CheckCircleOutlined />,
        text: '已配置',
        color: '#52c41a',
        tooltip: `${providerName} API密钥已配置并可用`
      }
    } else if (!status.configured) {
      return {
        status: 'error' as const,
        icon: <CloseCircleOutlined />,
        text: '未配置',
        color: '#ff4d4f',
        tooltip: `${providerName} 未配置API密钥`
      }
    } else {
      return {
        status: 'warning' as const,
        icon: <ExclamationCircleOutlined />,
        text: '已禁用',
        color: '#faad14',
        tooltip: `${providerName} 已配置但已禁用`
      }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <Space size="small">
      <Tooltip title={statusConfig.tooltip}>
        <Badge
          status={statusConfig.status}
          text={
            <Text style={{ color: statusConfig.color }}>
              {statusConfig.text}
            </Text>
          }
        />
      </Tooltip>

      {status.configured && status.enabled && (
        <Tooltip title="重新测试API连接">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleTest}
          />
        </Tooltip>
      )}
    </Space>
  )
}

export default AIModelStatusIndicator