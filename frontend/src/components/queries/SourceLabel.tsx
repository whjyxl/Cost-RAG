/**
 * 知识来源标注组件
 * 用于在AI回答中显示来源信息(文档/知识图谱/成本数据)
 */
import React from 'react'
import { Tag, Tooltip, Space } from 'antd'
import {
  FileTextOutlined,
  ShareAltOutlined,
  DollarOutlined,
  DatabaseOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'

export interface SourceInfo {
  type: 'document' | 'knowledge_graph' | 'cost_data'
  count: number
  items: Array<{
    id: string | number
    name: string
    score?: number
    snippet?: string
  }>
}

export interface SourceLabelProps {
  sources: SourceInfo[]
  showDetails?: boolean
  onClick?: (source: SourceInfo) => void
  size?: 'small' | 'default'
}

const SourceLabel: React.FC<SourceLabelProps> = ({
  sources,
  showDetails = false,
  onClick,
  size = 'small'
}) => {
  if (!sources || sources.length === 0) {
    return null
  }

  const getSourceConfig = (type: string) => {
    switch (type) {
      case 'document':
        return {
          icon: <FileTextOutlined />,
          color: '#1890ff',
          label: '文档',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff'
        }
      case 'knowledge_graph':
        return {
          icon: <ShareAltOutlined />,
          color: '#52c41a',
          label: '知识图谱',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f'
        }
      case 'cost_data':
        return {
          icon: <DollarOutlined />,
          color: '#fa8c16',
          label: '成本数据',
          bgColor: '#fff7e6',
          borderColor: '#ffd591'
        }
      default:
        return {
          icon: <DatabaseOutlined />,
          color: '#8c8c8c',
          label: '其他',
          bgColor: '#f5f5f5',
          borderColor: '#d9d9d9'
        }
    }
  }

  const renderSourceTag = (source: SourceInfo) => {
    const config = getSourceConfig(source.type)

    const tagContent = (
      <Tag
        icon={config.icon}
        color={config.color}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          margin: '2px 4px 2px 0',
          fontSize: size === 'small' ? '12px' : '14px',
          padding: size === 'small' ? '0 7px' : '2px 10px',
          borderRadius: '10px',
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          color: config.color,
          fontWeight: 500
        }}
        onClick={() => onClick && onClick(source)}
      >
        {config.label}
        {source.count > 0 && (
          <span style={{ marginLeft: 4, fontWeight: 600 }}>
            {source.count}
          </span>
        )}
        {showDetails && source.count > 0 && (
          <CheckCircleOutlined style={{ marginLeft: 4, fontSize: '10px' }} />
        )}
      </Tag>
    )

    if (source.items && source.items.length > 0) {
      const tooltipContent = (
        <div style={{ maxWidth: 300 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {config.label}来源详情:
          </div>
          {source.items.slice(0, 5).map((item, idx) => (
            <div
              key={item.id}
              style={{
                padding: '4px 0',
                borderBottom: idx < source.items.length - 1 ? '1px dashed rgba(255,255,255,0.3)' : 'none'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500 }}>
                {idx + 1}. {item.name}
              </div>
              {item.score !== undefined && (
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: 2 }}>
                  相关度: {(item.score * 100).toFixed(1)}%
                </div>
              )}
              {item.snippet && (
                <div
                  style={{
                    fontSize: '11px',
                    opacity: 0.7,
                    marginTop: 2,
                    maxHeight: '40px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {item.snippet.substring(0, 60)}...
                </div>
              )}
            </div>
          ))}
          {source.items.length > 5 && (
            <div style={{ marginTop: 8, fontSize: '11px', opacity: 0.7 }}>
              还有 {source.items.length - 5} 个来源...
            </div>
          )}
        </div>
      )

      return (
        <Tooltip
          key={source.type}
          title={tooltipContent}
          placement="top"
          overlayStyle={{ maxWidth: 350 }}
        >
          {tagContent}
        </Tooltip>
      )
    }

    return <React.Fragment key={source.type}>{tagContent}</React.Fragment>
  }

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px dashed rgba(0,0,0,0.06)'
      }}
    >
      <Space size={[4, 4]} wrap>
        <span
          style={{
            fontSize: size === 'small' ? '11px' : '12px',
            color: '#8c8c8c',
            fontWeight: 500,
            marginRight: 4
          }}
        >
          来源:
        </span>
        {sources.map(renderSourceTag)}
      </Space>
    </div>
  )
}

export default SourceLabel
