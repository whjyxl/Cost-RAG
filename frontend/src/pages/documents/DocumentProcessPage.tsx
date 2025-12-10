import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Tag,
  Progress,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Alert,
  Steps,
  Timeline,
  Badge,
  Tooltip,
  message,
  Modal,
  Descriptions,
  Empty,
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  FileTextOutlined,
  EyeOutlined,
  ReloadOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd'

// 引入样式
import './Documents.css'

const { Title, Text, Paragraph } = Typography
const { Step } = Steps

interface ProcessingItem {
  id: string
  name: string
  type: string
  size: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStep: number
  uploadTime: string
  startTime?: string
  estimatedTime?: string
  errorMessage?: string
  processingLog?: ProcessingLog[]
}

interface ProcessingLog {
  time: string
  step: string
  status: 'success' | 'error' | 'info'
  message: string
}

const DocumentProcessPage: React.FC = () => {
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ProcessingItem | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 加载处理任务列表
  useEffect(() => {
    fetchProcessingItems()
  }, [])

  // 从API获取处理任务
  const fetchProcessingItems = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/documents/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`获取处理任务失败: ${response.status}`)
      }

      const data = await response.json()

      // 转换后端数据格式为前端格式
      const formattedItems: ProcessingItem[] = (data.documents || []).map((doc: any) => {
        // 计算文件类型
        const getFileType = (fileName: string, mimeType: string) => {
          const ext = fileName.split('.').pop()?.toUpperCase()
          if (ext === 'PDF') return 'PDF'
          if (['DOC', 'DOCX'].includes(ext || '')) return 'Word'
          if (['XLS', 'XLSX'].includes(ext || '')) return 'Excel'
          if (['TXT', 'MD'].includes(ext || '')) return 'Text'
          return ext || 'Unknown'
        }

        // 格式化文件大小
        const formatSize = (bytes: number) => {
          if (!bytes) return '0 B'
          const k = 1024
          const sizes = ['B', 'KB', 'MB', 'GB']
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
        }

        // 映射状态
        const mapStatus = (status: string): 'pending' | 'processing' | 'completed' | 'failed' => {
          if (status === 'pending') return 'pending'
          if (status === 'processing') return 'processing'
          if (status === 'completed') return 'completed'
          if (status === 'failed') return 'failed'
          return 'pending'
        }

        // 计算当前步骤（基于进度）
        const getCurrentStep = (progress: number) => {
          if (progress >= 100) return 5
          if (progress >= 80) return 4
          if (progress >= 60) return 3
          if (progress >= 40) return 2
          if (progress >= 20) return 1
          return 0
        }

        const progress = doc.processing_progress || 0
        const status = mapStatus(doc.status)

        return {
          id: doc.id.toString(),
          name: doc.file_name || doc.title || '未命名文档',
          type: getFileType(doc.file_name || '', doc.file_type || ''),
          size: formatSize(doc.file_size || 0),
          status: status,
          progress: Math.round(progress),
          currentStep: getCurrentStep(progress),
          uploadTime: doc.created_at ? new Date(doc.created_at).toLocaleString('zh-CN') : '-',
          startTime: doc.processed_at ? new Date(doc.processed_at).toLocaleString('zh-CN') : undefined,
          estimatedTime: status === 'processing' ? '处理中...' : undefined,
          errorMessage: doc.error_message || undefined,
          processingLog: [], // 处理日志暂时为空，需要后端支持
        }
      })

      setProcessingItems(formattedItems)
    } catch (error) {
      console.error('获取处理任务失败:', error)
      message.error('获取处理任务失败，请稍后重试')
      setProcessingItems([])
    } finally {
      setLoading(false)
    }
  }

  // 自动刷新进度（每5秒调用真实API）
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchProcessingItems()
    }, 5000) // 每5秒刷新一次

    return () => clearInterval(interval)
  }, [autoRefresh])

  // 统计信息
  const stats = {
    total: processingItems.length,
    pending: processingItems.filter(item => item.status === 'pending').length,
    processing: processingItems.filter(item => item.status === 'processing').length,
    completed: processingItems.filter(item => item.status === 'completed').length,
    failed: processingItems.filter(item => item.status === 'failed').length,
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<ClockCircleOutlined />}>等待中</Tag>
      case 'processing':
        return <Tag color="processing" icon={<SyncOutlined spin />}>处理中</Tag>
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
      case 'failed':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 获取处理步骤
  const getProcessingSteps = () => [
    { title: '文件验证', description: '验证文件格式和完整性' },
    { title: '文本提取', description: '提取文档中的文本内容' },
    { title: '智能分块', description: '将文本分割成合适的片段' },
    { title: '向量化处理', description: '生成文本向量表示' },
    { title: '索引构建', description: '构建搜索索引' },
  ]

  // 查看详情
  const handleViewDetail = (item: ProcessingItem) => {
    setSelectedItem(item)
    setDetailVisible(true)
  }

  // 重试处理
  const handleRetry = async (id: string) => {
    try {
      // TODO: 后端需要提供重试API
      // const response = await fetch(`/api/v1/documents/${id}/retry`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      //     'Content-Type': 'application/json',
      //   },
      // })

      // 暂时使用前端模拟（等待后端API）
      setProcessingItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, status: 'processing', progress: 0, currentStep: 0, errorMessage: undefined }
          : item
      ))
      message.success('已重新加入处理队列（注：后端API待实现）')
    } catch (error) {
      console.error('重试失败:', error)
      message.error('重试失败，请稍后重试')
    }
  }

  // 停止处理
  const handleStop = async (id: string) => {
    try {
      // TODO: 后端需要提供停止API
      // const response = await fetch(`/api/v1/documents/${id}/stop`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      //     'Content-Type': 'application/json',
      //   },
      // })

      // 暂时使用前端模拟（等待后端API）
      setProcessingItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, status: 'pending', progress: 0, currentStep: 0 }
          : item
      ))
      message.info('已停止处理（注：后端API待实现）')
    } catch (error) {
      console.error('停止失败:', error)
      message.error('停止失败，请稍后重试')
    }
  }

  // 清理完成项
  const handleClearCompleted = async () => {
    try {
      // TODO: 后端需要提供批量删除API
      // const completedIds = processingItems.filter(item => item.status === 'completed').map(item => item.id)
      // const response = await fetch('/api/v1/documents/batch-delete', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ ids: completedIds }),
      // })

      // 暂时使用前端模拟（等待后端API）
      setProcessingItems(prev => prev.filter(item => item.status !== 'completed'))
      message.success('已清理完成项（注：后端API待实现）')
    } catch (error) {
      console.error('清理失败:', error)
      message.error('清理失败，请稍后重试')
    }
  }

  // 获取日志状态图标
  const getLogIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
    }
  }

  // 表格列定义
  const columns: ColumnsType<ProcessingItem> = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProcessingItem) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
          <Text type="secondary">({record.type})</Text>
        </Space>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: ProcessingItem) => (
        <Space direction="vertical" size="small" style={{ width: 150 }}>
          <Progress percent={progress} size="small" status={record.status === 'failed' ? 'exception' : 'active'} />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            步骤 {record.currentStep}/5
          </Text>
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
    },
    {
      title: '预计时间',
      dataIndex: 'estimatedTime',
      key: 'estimatedTime',
      render: (time: string, record: ProcessingItem) => {
        if (record.status === 'completed') return '-'
        return time || '-'
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: ProcessingItem) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'processing' && (
            <Tooltip title="停止处理">
              <Button
                type="text"
                icon={<StopOutlined />}
                onClick={() => handleStop(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'failed' && (
            <Tooltip title="重试">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => handleRetry(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} className="documents-title">文档处理状态</Title>
        <Paragraph type="secondary">
          监控文档处理进度，查看处理日志和错误信息
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card>
            <Statistic
              title="总文档数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="等待处理"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="正在处理"
              value={stats.processing}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="处理失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 控制按钮 */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Badge count={stats.processing} offset={[10, 0]}>
                <Button
                  type={autoRefresh ? 'primary' : 'default'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? '自动刷新中' : '开启自动刷新'}
                </Button>
              </Badge>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchProcessingItems()}
              >
                手动刷新
              </Button>
              {stats.completed > 0 && (
                <Button onClick={handleClearCompleted}>
                  清理完成项
                </Button>
              )}
            </Space>
          </Col>
          <Col>
            <Alert
              message={
                <Space>
                  <InfoCircleOutlined />
                  <Text>处理队列将自动按顺序处理文档，处理完成后可用于智能问答</Text>
                </Space>
              }
              type="info"
              showIcon={false}
              style={{ margin: 0 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 处理列表 */}
      <Card title="处理队列">
        {processingItems.length > 0 ? (
          <Table
            columns={columns}
            dataSource={processingItems}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
          />
        ) : (
          <Empty description="暂无处理任务" />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            <Text>处理详情</Text>
            {selectedItem && getStatusTag(selectedItem.status)}
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedItem && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="文档名称" span={2}>
                {selectedItem.name}
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">
                {selectedItem.type}
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {selectedItem.size}
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {selectedItem.uploadTime}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {selectedItem.startTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预计时间">
                {selectedItem.estimatedTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前进度">
                <Progress percent={selectedItem.progress} status={selectedItem.status === 'failed' ? 'exception' : 'active'} />
              </Descriptions.Item>
            </Descriptions>

            {selectedItem.errorMessage && (
              <Alert
                message="错误信息"
                description={selectedItem.errorMessage}
                type="error"
                style={{ marginTop: 16, marginBottom: 16 }}
              />
            )}

            <div style={{ marginTop: 24 }}>
              <Title level={5}>处理步骤</Title>
              <Steps
                current={selectedItem.currentStep}
                size="small"
                items={getProcessingSteps().slice(0, 5).map((step, index) => ({
                  title: step.title,
                  description: step.description,
                  status: index < selectedItem.currentStep ? 'finish' : index === selectedItem.currentStep ? 'process' : 'wait',
                }))}
              />
            </div>

            {selectedItem.processingLog && selectedItem.processingLog.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>处理日志</Title>
                <Timeline>
                  {selectedItem.processingLog.map((log, index) => (
                    <Timeline.Item key={index} dot={getLogIcon(log.status)}>
                      <Space direction="vertical" size="small">
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {log.time}
                        </Text>
                        <Text strong>{log.step}</Text>
                        <Text>{log.message}</Text>
                      </Space>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DocumentProcessPage