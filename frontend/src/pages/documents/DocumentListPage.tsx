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
  Spin,
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
  FileSearchOutlined,
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

// 引入样式
import './Documents.css'

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
  chunkCount?: number
  vectorCount?: number
  processingProgress?: number
  errorMessage?: string
  keywords?: string[]
  summary?: string
}

interface DocumentChunkPreview {
  chunkIndex: number
  content: string
  startChar?: number | null
  endChar?: number | null
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
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null)
  const [previewChunks, setPreviewChunks] = useState<DocumentChunkPreview[]>([])
  const [urlDocIdChecked, setUrlDocIdChecked] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  // 加载文档列表
  useEffect(() => {
    fetchDocuments()
  }, [])

  // 检查URL参数，当文档列表加载完成后自动打开指定文档（只检查一次）
  useEffect(() => {
    if (documents.length > 0 && !urlDocIdChecked) {
      const urlParams = new URLSearchParams(window.location.search)
      const docId = urlParams.get('id')
      if (docId) {
        const doc = documents.find(d => d.id === docId)
        if (doc) {
          handlePreview(doc)
        }
      }
      setUrlDocIdChecked(true)
    }
  }, [documents, urlDocIdChecked])

  // 从API获取文档列表
  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/documents/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`获取文档列表失败: ${response.status}`)
      }

      const data = await response.json()
      
      // 调试：打印第一个文档的数据
      if (data.documents && data.documents.length > 0) {
        console.log('第一个文档的原始数据:', data.documents[0])
        console.log('chunk_count:', data.documents[0].chunk_count)
        console.log('vector_count:', data.documents[0].vector_count)
      }

      // 转换后端数据格式为前端格式
      const formattedDocs: DocumentItem[] = (data.documents || []).map((doc: any) => ({
        id: doc.id.toString(),
        name: doc.file_name || doc.title || '未命名文档',
        size: doc.file_size || 0,
        type: doc.file_type || 'unknown',
        status: doc.status || 'completed',
        uploadTime: doc.created_at || new Date().toISOString(),
        processedTime: doc.processed_at,
        fileSize: formatFileSize(doc.file_size || 0),
        pageCount: doc.page_count,
        wordCount: doc.word_count,
        chunkCount: doc.chunk_count || doc.chunkCount || 0,
        vectorCount: doc.vector_count || doc.vectorCount || 0,
        chunk_count: doc.chunk_count || 0,
        vector_count: doc.vector_count || 0,
        processingProgress: doc.processing_progress,
        errorMessage: doc.error_message,
        keywords: doc.keywords || [],
        summary: doc.description || doc.summary,
      }))

      setDocuments(formattedDocs)
    } catch (error) {
      console.error('获取文档列表失败:', error)
      message.error('获取文档列表失败，请稍后重试')
      setDocuments([]) // 失败时显示空列表
    } finally {
      setLoading(false)
    }
  }

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

  const handlePreview = async (record: DocumentItem) => {
    setPreviewDocument(record)
    setPreviewVisible(true)
    setPreviewLoading(true)
    setPreviewChunks([])
    setPreviewUrl('')
    
    // 更新URL参数
    const url = new URL(window.location.href)
    url.searchParams.set('id', record.id)
    window.history.pushState({}, '', url)

    try {
      // 获取临时预览URL
      const previewUrlResponse = await fetch(`/api/v1/documents/${record.id}/preview-url`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      
      if (previewUrlResponse.ok) {
        const previewData = await previewUrlResponse.json()
        setPreviewUrl(`${window.location.origin}${previewData.preview_url}`)
      }
      
      // 获取文档chunks
      const response = await fetch(`/api/v1/documents/${record.id}/chunks?size=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`获取文档分块失败: ${response.status}`)
      }

      const data = await response.json()
      const chunks: DocumentChunkPreview[] = (data.chunks || []).map((chunk: any) => ({
        chunkIndex: chunk.chunk_index,
        content: chunk.content,
        startChar: chunk.start_char,
        endChar: chunk.end_char,
      }))

      if (chunks.length === 0) {
        message.info('该文档暂无可预览的分块内容')
      }

      setPreviewChunks(chunks)
    } catch (error: any) {
      console.error('获取文档分块失败:', error)
      message.error(error.message || '获取文档分块失败，请稍后重试')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreviewClose = () => {
    setPreviewVisible(false)
    setPreviewDocument(null)
    setPreviewChunks([])
  }

  // 删除文档
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`删除文档失败: ${response.status}`)
      }

      setDocuments(prev => prev.filter(doc => doc.id !== id))
      message.success('文档已删除')
    } catch (error) {
      console.error('删除文档失败:', error)
      message.error('删除文档失败，请稍后重试')
    }
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
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map(async (key) => {
              const id = String(key)
              const response = await fetch(`/api/v1/documents/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                  'Content-Type': 'application/json',
                },
              })

              if (!response.ok) {
                throw new Error(`删除文档失败: ${response.status}`)
              }
            })
          )

          setDocuments(prev => prev.filter(doc => !selectedRowKeys.includes(doc.id)))
          setSelectedRowKeys([])
          message.success('批量删除成功')
        } catch (error) {
          console.error('批量删除文档失败:', error)
          message.error('批量删除失败，请稍后重试')
          throw error
        }
      },
    })
  }

  // 刷新列表
  const handleRefresh = async () => {
    await fetchDocuments()
    message.success('列表已刷新')
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
      title: '向量/分块',
      key: 'vectors',
      render: (record: any) => (
        <Space direction="vertical" size="small">
          <Text type={(record.vector_count || record.vectorCount) > 0 ? 'success' : 'secondary'}>
            向量: {record.vector_count || record.vectorCount || 0}
          </Text>
          <Text type="secondary">
            分块: {record.chunk_count || record.chunkCount || 0}
          </Text>
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
          <Tooltip title="预览分块">
            <Button
              type="text"
              icon={<FileSearchOutlined />}
              disabled={record.status !== 'completed'}
              onClick={() => handlePreview(record)}
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
        <Title level={2} className="documents-title">文档列表</Title>
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

      <Modal
        title={
          <Space>
            <span>{previewDocument ? `文档预览 - ${previewDocument.name}` : '文档预览'}</span>
            {previewDocument && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="small"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/v1/documents/${previewDocument.id}/download`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                      }
                    })
                    if (response.ok) {
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = previewDocument.name
                      a.click()
                      window.URL.revokeObjectURL(url)
                      message.success('下载成功')
                    } else {
                      message.error('下载失败')
                    }
                  } catch (error) {
                    message.error('下载失败')
                  }
                }}
              >
                下载原文件
              </Button>
            )}
          </Space>
        }
        open={previewVisible}
        onCancel={handlePreviewClose}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        {previewDocument && (
          <div>
            {/* Office文件在线预览 */}
            {['pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls'].includes(previewDocument.type?.toLowerCase() || '') && previewUrl ? (
              <div style={{ marginBottom: 16 }}>
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                  width="100%"
                  height="600px"
                  frameBorder="0"
                  style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}
                  title="文档预览"
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                  提示：如果预览失败，请点击上方"下载原文件"按钮下载后查看
                </Text>
              </div>
            ) : null}
            
            {/* 文本内容预览 */}
            <Divider>文档内容</Divider>
            <Spin spinning={previewLoading}>
              {previewChunks.length > 0 ? (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.chunkIndex}
                      style={{
                        padding: '12px 16px',
                        marginBottom: 12,
                        background: '#f5f7fa',
                        borderRadius: 8,
                      }}
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text strong>分块 #{chunk.chunkIndex + 1}</Text>
                        <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                          {chunk.content}
                        </Paragraph>
                        {(typeof chunk.startChar === 'number' || typeof chunk.endChar === 'number') && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            位置: {chunk.startChar ?? '-'} - {chunk.endChar ?? '-'}
                          </Text>
                        )}
                      </Space>
                    </div>
                  ))}
                </div>
              ) : (
                !previewLoading && <Empty description="暂无分块内容" />
              )}
            </Spin>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DocumentListPage