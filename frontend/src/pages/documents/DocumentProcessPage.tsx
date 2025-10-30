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

  // 模拟数据
  useEffect(() => {
    const mockData: ProcessingItem[] = [
      {
        id: '1',
        name: '工程造价管理规范.pdf',
        type: 'PDF',
        size: '2.0 MB',
        status: 'completed',
        progress: 100,
        currentStep: 4,
        uploadTime: '2024-01-20 10:30:00',
        startTime: '2024-01-20 10:30:05',
        estimatedTime: '2分钟',
        processingLog: [
          { time: '2024-01-20 10:30:05', step: '文件验证', status: 'success', message: '文件格式验证通过' },
          { time: '2024-01-20 10:30:15', step: '文本提取', status: 'success', message: '成功提取文本内容' },
          { time: '2024-01-20 10:30:45', step: '智能分块', status: 'success', message: '文本分块完成，共生成15个片段' },
          { time: '2024-01-20 10:31:05', step: '向量化处理', status: 'success', message: '向量化处理完成，生成512维向量' },
          { time: '2024-01-20 10:31:15', step: '索引构建', status: 'success', message: '索引构建完成' },
        ],
      },
      {
        id: '2',
        name: '建筑项目预算模板.xlsx',
        type: 'Excel',
        size: '1.0 MB',
        status: 'processing',
        progress: 65,
        currentStep: 3,
        uploadTime: '2024-01-20 14:20:00',
        startTime: '2024-01-20 14:20:10',
        estimatedTime: '3分钟',
        processingLog: [
          { time: '2024-01-20 14:20:10', step: '文件验证', status: 'success', message: '文件格式验证通过' },
          { time: '2024-01-20 14:20:20', step: '数据提取', status: 'success', message: 'Excel数据提取完成' },
          { time: '2024-01-20 14:20:35', step: '智能分块', status: 'info', message: '正在处理文本分块...' },
        ],
      },
      {
        id: '3',
        name: '施工合同范本.docx',
        type: 'Word',
        size: '512 KB',
        status: 'processing',
        progress: 30,
        currentStep: 2,
        uploadTime: '2024-01-20 15:45:00',
        startTime: '2024-01-20 15:45:15',
        estimatedTime: '1分钟',
        processingLog: [
          { time: '2024-01-20 15:45:15', step: '文件验证', status: 'success', message: '文件格式验证通过' },
          { time: '2024-01-20 15:45:20', step: '文本提取', status: 'info', message: '正在提取Word文档内容...' },
        ],
      },
      {
        id: '4',
        name: '建筑材料价格表.txt',
        type: 'Text',
        size: '256 KB',
        status: 'failed',
        progress: 25,
        currentStep: 1,
        uploadTime: '2024-01-20 16:30:00',
        startTime: '2024-01-20 16:30:05',
        estimatedTime: '30秒',
        errorMessage: '文件编码格式不支持，请转换为UTF-8编码后重新上传',
        processingLog: [
          { time: '2024-01-20 16:30:05', step: '文件验证', status: 'success', message: '文件格式验证通过' },
          { time: '2024-01-20 16:30:10', step: '文本提取', status: 'error', message: '文件编码格式不支持' },
        ],
      },
      {
        id: '5',
        name: '项目可行性研究报告.pdf',
        type: 'PDF',
        size: '3.0 MB',
        status: 'pending',
        progress: 0,
        currentStep: 0,
        uploadTime: '2024-01-20 17:00:00',
        estimatedTime: '2分钟',
        processingLog: [],
      },
    ]
    setProcessingItems(mockData)
  }, [])

  // 自动刷新进度
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setProcessingItems(prev => prev.map(item => {
        if (item.status === 'processing' && item.progress < 100) {
          const newProgress = Math.min(item.progress + Math.random() * 15, 100)
          const newStatus = newProgress >= 100 ? 'completed' : 'processing'
          const newStep = newStatus === 'completed' ? 4 : Math.min(item.currentStep + (newProgress >= 25 ? 1 : 0), 4)

          return {
            ...item,
            progress: Math.round(newProgress),
            status: newStatus,
            currentStep: newStep,
          }
        }
        return item
      }))
    }, 2000)

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
  const handleRetry = (id: string) => {
    setProcessingItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, status: 'processing', progress: 0, currentStep: 0, errorMessage: undefined }
        : item
    ))
    message.success('已重新加入处理队列')
  }

  // 停止处理
  const handleStop = (id: string) => {
    setProcessingItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, status: 'pending', progress: 0, currentStep: 0 }
        : item
    ))
    message.info('已停止处理')
  }

  // 清理完成项
  const handleClearCompleted = () => {
    setProcessingItems(prev => prev.filter(item => item.status !== 'completed'))
    message.success('已清理完成项')
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
        <Title level={2}>文档处理状态</Title>
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
                onClick={() => window.location.reload()}
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