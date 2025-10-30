import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Empty,
  Modal,
  Drawer,
  Descriptions,
  Divider,
  Tooltip,
  message,
  Popconfirm,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { RangePicker } = DatePicker

interface DocumentItem {
  id: string
  name: string
  size: number
  type: string
  status: 'processing' | 'completed' | 'failed'
  uploadTime: string
  processedTime?: string
  fileSize: string
  pageCount?: number
  wordCount?: number
  processingProgress?: number
  errorMessage?: string
  keywords?: string[]
  summary?: string
}

const DocumentListPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)

  // 模拟数据
  useEffect(() => {
    const mockData: DocumentItem[] = [
      {
        id: '1',
        name: '工程造价管理规范.pdf',
        size: 2048576,
        type: 'application/pdf',
        status: 'completed',
        uploadTime: '2024-01-15 10:30:00',
        processedTime: '2024-01-15 10:32:15',
        fileSize: '2.0 MB',
        pageCount: 45,
        wordCount: 12500,
        keywords: ['工程造价', '管理', '规范', '标准'],
        summary: '本规范详细阐述了工程造价管理的各项标准和要求，包括预算编制、成本控制、结算审核等内容。',
      },
      {
        id: '2',
        name: '建筑项目预算模板.xlsx',
        size: 1048576,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 'processing',
        uploadTime: '2024-01-16 14:20:00',
        fileSize: '1.0 MB',
        processingProgress: 75,
      },
      {
        id: '3',
        name: '施工合同范本.docx',
        size: 524288,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        status: 'completed',
        uploadTime: '2024-01-17 09:15:00',
        processedTime: '2024-01-17 09:16:30',
        fileSize: '512 KB',
        pageCount: 12,
        wordCount: 3200,
        keywords: ['施工合同', '范本', '法律', '条款'],
        summary: '标准施工合同范本，包含合同双方权利义务、工程范围、付款方式等核心条款。',
      },
      {
        id: '4',
        name: '建筑材料价格表.txt',
        size: 262144,
        type: 'text/plain',
        status: 'failed',
        uploadTime: '2024-01-18 16:45:00',
        fileSize: '256 KB',
        errorMessage: '文件格式不支持或文件损坏',
      },
      {
        id: '5',
        name: '项目可行性研究报告.pdf',
        size: 3145728,
        type: 'application/pdf',
        status: 'completed',
        uploadTime: '2024-01-19 11:20:00',
        processedTime: '2024-01-19 11:25:45',
        fileSize: '3.0 MB',
        pageCount: 68,
        wordCount: 18900,
        keywords: ['可行性研究', '项目分析', '投资评估', '风险分析'],
        summary: '详细的项目可行性分析报告，包含市场分析、技术方案、经济效益评估、风险分析等内容。',
      },
    ]
    setDocuments(mockData)
  }, [])

  // 统计信息
  const stats = {
    total: documents.length,
    completed: documents.filter(doc => doc.status === 'completed').length,
    processing: documents.filter(doc => doc.status === 'processing').length,
    failed: documents.filter(doc => doc.status === 'failed').length,
  }

  // 过滤文档
  const filteredDocuments = documents.filter(doc => {
    // 搜索过滤
    const matchesSearch = !searchText ||
      doc.name.toLowerCase().includes(searchText.toLowerCase()) ||
      doc.keywords?.some(keyword => keyword.toLowerCase().includes(searchText.toLowerCase()))

    // 状态过滤
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter

    // 类型过滤
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'pdf' && doc.type === 'application/pdf') ||
      (typeFilter === 'word' && doc.type.includes('wordprocessingml')) ||
      (typeFilter === 'excel' && doc.type.includes('spreadsheetml')) ||
      (typeFilter === 'text' && doc.type === 'text/plain')

    // 日期过滤
    const matchesDate = !dateRange ||
      (dayjs(doc.uploadTime).isAfter(dateRange[0]) &&
       dayjs(doc.uploadTime).isBefore(dateRange[1].add(1, 'day')))

    return matchesSearch && matchesStatus && matchesType && matchesDate
  })

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return <Tag color="success">已完成</Tag>
      case 'processing':
        return <Tag color="processing">处理中</Tag>
      case 'failed':
        return <Tag color="error">失败</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 获取文件类型标签
  const getTypeTag = (type: string, name: string) => {
    const extension = name.split('.').pop()?.toUpperCase()
    let color = 'blue'

    if (extension === 'PDF') color = 'red'
    else if (['DOC', 'DOCX'].includes(extension || '')) color = 'blue'
    else if (['XLS', 'XLSX'].includes(extension || '')) color = 'green'
    else if (['TXT', 'MD'].includes(extension || '')) color = 'orange'

    return <Tag color={color}>{extension || 'UNKNOWN'}</Tag>
  }

  // 查看详情
  const handleViewDetail = (record: DocumentItem) => {
    setSelectedDocument(record)
    setDetailVisible(true)
  }

  // 删除文档
  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id))
    message.success('文档已删除')
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文档')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个文档吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        setDocuments(prev => prev.filter(doc => !selectedRowKeys.includes(doc.id)))
        setSelectedRowKeys([])
        message.success('批量删除成功')
      },
    })
  }

  // 刷新列表
  const handleRefresh = () => {
    setLoading(true)
    // 模拟刷新
    setTimeout(() => {
      setLoading(false)
      message.success('列表已刷新')
    }, 1000)
  }

  // 导出选中项
  const handleExport = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要导出的文档')
      return
    }
    message.success(`正在导出 ${selectedRowKeys.length} 个文档...`)
  }

  // 表格列定义
  const columns: ColumnsType<DocumentItem> = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentItem) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: DocumentItem) => getTypeTag(type, record.name),
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      sorter: (a, b) => dayjs(a.uploadTime).unix() - dayjs(b.uploadTime).unix(),
    },
    {
      title: '处理时间',
      dataIndex: 'processedTime',
      key: 'processedTime',
      render: (time: string) => time || '-',
    },
    {
      title: '页数/字数',
      key: 'stats',
      render: (record: DocumentItem) => (
        <Space direction="vertical" size="small">
          {record.pageCount && <Text type="secondary">{record.pageCount} 页</Text>}
          {record.wordCount && <Text type="secondary">{record.wordCount.toLocaleString()} 字</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: DocumentItem) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              disabled={record.status !== 'completed'}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个文档吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  // 表格选择配置
  const rowSelection: TableProps<DocumentItem>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>文档列表</Title>
        <Paragraph type="secondary">
          管理和查看所有已上传的文档，支持搜索、筛选和批量操作
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总文档数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已处理"
              value={stats.completed}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="处理中"
              value={stats.processing}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="处理失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索文档名称或关键词"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="processing">处理中</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="文件类型"
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部类型</Select.Option>
              <Select.Option value="pdf">PDF</Select.Option>
              <Select.Option value="word">Word</Select.Option>
              <Select.Option value="excel">Excel</Select.Option>
              <Select.Option value="text">文本</Select.Option>
            </Select>
          </Col>
          <Col>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 240 }}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 批量操作 */}
      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Text>已选择 {selectedRowKeys.length} 项</Text>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出选中
            </Button>
            <Button icon={<DeleteOutlined />} danger onClick={handleBatchDelete}>
              批量删除
            </Button>
          </Space>
        </Card>
      )}

      {/* 文档列表 */}
      <Card title="文档列表">
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          locale={{
            emptyText: <Empty description="暂无文档数据" />,
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="文档详情"
        placement="right"
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        width={600}
      >
        {selectedDocument && (
          <div>
            <Descriptions title="基本信息" column={1} bordered>
              <Descriptions.Item label="文档名称">
                {selectedDocument.name}
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">
                {getTypeTag(selectedDocument.type, selectedDocument.name)}
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {selectedDocument.fileSize}
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {selectedDocument.uploadTime}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedDocument.status)}
              </Descriptions.Item>
              {selectedDocument.processedTime && (
                <Descriptions.Item label="处理时间">
                  {selectedDocument.processedTime}
                </Descriptions.Item>
              )}
              {selectedDocument.pageCount && (
                <Descriptions.Item label="页数">
                  {selectedDocument.pageCount} 页
                </Descriptions.Item>
              )}
              {selectedDocument.wordCount && (
                <Descriptions.Item label="字数">
                  {selectedDocument.wordCount.toLocaleString()} 字
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedDocument.keywords && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>关键词</Text>
                </div>
                <Space wrap>
                  {selectedDocument.keywords.map((keyword, index) => (
                    <Tag key={index} color="blue">
                      {keyword}
                    </Tag>
                  ))}
                </Space>
              </>
            )}

            {selectedDocument.summary && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>文档摘要</Text>
                </div>
                <Paragraph>{selectedDocument.summary}</Paragraph>
              </>
            )}

            {selectedDocument.errorMessage && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong type="danger">错误信息</Text>
                </div>
                <Text type="danger">{selectedDocument.errorMessage}</Text>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default DocumentListPage