import React from 'react'
import { Card, Button, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'

const { Text } = Typography

export interface APIStatus {
  provider: string
  status: 'connected' | 'disconnected' | 'unknown' | 'testing'
  lastCheck?: string
  responseTime?: number
  error?: string
  configured: boolean
}

interface APIStatusIndicatorProps {
  status: APIStatus
  onTest?: () => void
  compact?: boolean
}

const APIStatusIndicator: React.FC<APIStatusIndicatorProps> = ({
  status,
  onTest,
  compact = false
}) => {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'connected':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: compact ? 16 : 20 }} />
      case 'disconnected':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: compact ? 16 : 20 }} />
      case 'testing':
        return <ReloadOutlined spin style={{ color: '#1890ff', fontSize: compact ? 16 : 20 }} />
      default:
        return <QuestionCircleOutlined style={{ color: '#faad14', fontSize: compact ? 16 : 20 }} />
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'connected': return '#52c41a'
      case 'disconnected': return '#ff4d4f'
      case 'testing': return '#1890ff'
      default: return '#faad14'
    }
  }

  const getStatusText = () => {
    switch (status.status) {
      case 'connected': return '已连接'
      case 'disconnected': return '连接失败'
      case 'testing': return '测试中...'
      default: return '未知状态'
    }
  }

  const getConfiguredStatus = () => {
    if (!status.configured) {
      return <Tag color="orange">未配置</Tag>
    }
    return null
  }

  
  if (compact) {
    return (
      <Space size="small" align="center">
        {getStatusIcon()}
        <Text style={{ color: getStatusColor(), fontSize: 12 }}>
          {status.provider}
        </Text>
        {getConfiguredStatus()}
      </Space>
    )
  }

  return (
    <Card
      size="small"
      style={{
        border: `1px solid ${getStatusColor()}`,
        backgroundColor: status.status === 'connected' ? '#f6ffed' :
                          status.status === 'disconnected' ? '#fff2f0' : '#fffbe6'
      }}
    >
      <div style={{ padding: '8px 12px' }}>
        <Space align="center" wrap>
          {getStatusIcon()}
          <div>
            <Space direction="vertical" size="small">
              <Space>
                <Text strong style={{ color: getStatusColor() }}>
                  {status.provider}
                </Text>
                {getConfiguredStatus()}
              </Space>

              <Space size="small">
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {getStatusText()}
                </Text>
                {status.lastCheck && (
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    {status.lastCheck}
                  </Text>
                )}
              </Space>

              {status.responseTime && (
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  响应时间: {status.responseTime}ms
                </Text>
              )}

              {status.error && (
                <Tooltip title={status.error} placement="top">
                  <Text type="danger" style={{ fontSize: '10px' }}>
                    <ExclamationCircleOutlined /> 错误
                  </Text>
                </Tooltip>
              )}
            </Space>
          </div>

          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={onTest}
            loading={status.status === 'testing'}
            style={{
              border: `1px solid ${getStatusColor()}`,
              color: getStatusColor()
            }}
          >
            测试
          </Button>
        </Space>
      </div>
    </Card>
  )
}

export default APIStatusIndicator