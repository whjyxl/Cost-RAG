import React, { useState, useCallback, useRef } from 'react'
import {
  Card,
  Typography,
  Upload,
  Button,
  Progress,
  Table,
  Tag,
  Space,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  Empty,
  message,
  Switch,
  Tooltip,
} from 'antd'
import {
  InboxOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'

// 引入样式
import './Documents.css'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

interface DocumentItem {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'done' | 'error'
  uploadTime: string
  progress?: number
  errorMessage?: string
  file?: File
}

const DocumentUploadPage: React.FC = () => {
  const [documentList, setDocumentList] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [generateKnowledgeGraph, setGenerateKnowledgeGraph] = useState(true) // 默认生成知识图谱
  const fileMapRef = useRef<Record<string, File>>({})

  // 模拟数据统计
  const stats = {
    total: documentList.length,
    success: documentList.filter(item => item.status === 'done').length,
    failed: documentList.filter(item => item.status === 'error').length,
    uploading: documentList.filter(item => item.status === 'uploading').length,
  }

  // 文件上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.pdf,.txt,.md,.html,.doc,.docx',
    beforeUpload: (file) => {
      // 检查文件类型
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/html',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]

      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|md|html|doc|docx)$/i)) {
        message.error('只支持 PDF、TXT、Markdown、HTML、DOC、DOCX 格式的文件')
        return false
      }

      // 检查文件大小 (100MB)
      const isLt100M = file.size / 1024 / 1024 < 100
      if (!isLt100M) {
        message.error('文件大小不能超过 100MB')
        return false
      }

      // 记录文件引用，防止后续无法获取
      fileMapRef.current[file.uid] = file as unknown as File

      return false // 阻止自动上传，我们手动处理
    },
    onChange(info) {
      const { fileList } = info

      // 转换文件列表为我们的格式
      const newDocuments: DocumentItem[] = fileList.map((file) => {
        const existingDoc = documentList.find(d => d.id === file.uid)

        if (file.originFileObj) {
          fileMapRef.current[file.uid] = file.originFileObj as File
        }

        const baseDoc: DocumentItem = existingDoc
          ? {
              ...existingDoc,
              file: (file.originFileObj as File | undefined) ?? existingDoc.file ?? fileMapRef.current[file.uid],
            }
          : {
              id: file.uid,
              name: file.name,
              size: file.size || 0,
              type: file.type || 'unknown',
              status: 'uploading', // 明确设置为 uploading 状态
              uploadTime: new Date().toLocaleString(),
              progress: 0,
              errorMessage: undefined,
              file: (file.originFileObj as File | undefined) ?? fileMapRef.current[file.uid],
            }

        return baseDoc
      })

      setDocumentList(newDocuments)

      // 清理已移除的文件引用
      const activeIds = new Set(fileList.map(file => file.uid))
      Object.keys(fileMapRef.current).forEach((id) => {
        if (!activeIds.has(id)) {
          delete fileMapRef.current[id]
        }
      })
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files)
    },
  }

  // 处理文件上传
  const handleUpload = useCallback(async () => {
    if (documentList.length === 0) {
      message.warning('请先选择要上传的文件')
      return
    }

    const pendingDocs = documentList.filter(doc => doc.status === 'uploading')
    if (pendingDocs.length === 0) {
      message.warning('没有待上传的文件')
      return
    }

    setUploading(true)

    try {
      // 逐个上传文件
      for (const doc of pendingDocs) {
        try {
          const targetFile = doc.file ?? fileMapRef.current[doc.id]

          if (!targetFile) {
            throw new Error('无法找到文件')
          }

          // 创建 FormData
          const formData = new FormData()
          formData.append('file', targetFile)

          // 添加文档元数据（后端要求 title 为必填项）
          formData.append('title', doc.name.split('.')[0])
          formData.append('description', '')
          formData.append('category', 'general')
          formData.append('tags', '')  // 空字符串，后端期望逗号分隔的字符串（不是JSON数组）
          formData.append('is_public', 'false')
          formData.append('generate_knowledge_graph', String(generateKnowledgeGraph)) // 是否生成知识图谱

          // 模拟上传进度（因为fetch不支持原生进度跟踪）
          setDocumentList(prev => prev.map(item =>
            item.id === doc.id ? { ...item, progress: 30 } : item
          ))

          // 调用真实API上传
          const response = await fetch('/api/v1/documents/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || errorData.message || '上传失败')
          }

          const result = await response.json()

          // 上传成功
          setDocumentList(prev => prev.map(item =>
            item.id === doc.id
              ? {
                  ...item,
                  status: 'done',
                  progress: 100,
                  errorMessage: undefined
                }
              : item
          ))

          delete fileMapRef.current[doc.id]

        } catch (error: any) {
          console.error('文件上传失败:', error)

          // 上传失败
          setDocumentList(prev => prev.map(item =>
            item.id === doc.id
              ? {
                  ...item,
                  status: 'error',
                  progress: 0,
                  errorMessage: error.message || '上传失败'
                }
              : item
          ))
        }
      }

      message.success('文件上传完成')
    } catch (error: any) {
      console.error('上传过程出错:', error)
      message.error('上传过程出错，请重试')
    } finally {
      setUploading(false)
    }
  }, [documentList])

  // 删除文件
  const handleRemove = useCallback((id: string) => {
    setDocumentList(prev => prev.filter(item => item.id !== id))
    message.success('文件已移除')
    delete fileMapRef.current[id]
  }, [])

  // 清空列表
  const handleClear = useCallback(() => {
    setDocumentList([])
    message.success('文件列表已清空')
    fileMapRef.current = {}
  }, [])

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentItem) => (
        <Space>
          <FileTextOutlined />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '文件类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: DocumentItem) => {
        const extension = record.name.split('.').pop()?.toUpperCase()
        return <Tag color="blue">{extension || 'UNKNOWN'}</Tag>
      },
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: DocumentItem) => {
        switch (status) {
          case 'uploading':
            return (
              <Space direction="vertical" size="small" style={{ width: 120 }}>
                <Progress percent={record.progress || 0} size="small" />
                <Text type="secondary">上传中...</Text>
              </Space>
            )
          case 'done':
            return (
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text type="success">上传成功</Text>
              </Space>
            )
          case 'error':
            return (
              <Space direction="vertical" size="small">
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text type="danger">上传失败</Text>
                </Space>
                {record.errorMessage && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {record.errorMessage}
                  </Text>
                )}
              </Space>
            )
          default:
            return <Text type="secondary">未知状态</Text>
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: DocumentItem) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            disabled={record.status !== 'done'}
          >
            预览
          </Button>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleRemove(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} className="documents-title">文档上传</Title>
        <Paragraph type="secondary">
          支持上传 PDF、TXT、Markdown、HTML、DOC、DOCX 格式的文档文件，单文件最大 50MB
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="上传成功"
              value={stats.success}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="上传失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="正在上传"
              value={stats.uploading}
              prefix={<UploadOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 上传区域 */}
      <Card title="文件上传" style={{ marginBottom: 24 }}>
        <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传。严格禁止上传公司数据或其他敏感文件。
          </p>
        </Dragger>

        <Space size="large">
          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              onClick={handleUpload}
              disabled={documentList.length === 0}
            >
              开始上传
            </Button>
            <Button onClick={handleClear} disabled={documentList.length === 0}>
              清空列表
            </Button>
          </Space>
          
          <Divider type="vertical" />
          
          <Tooltip title="开启后将自动提取文档中的实体和关系，构建知识图谱">
            <Space>
              <Text>生成知识图谱：</Text>
              <Switch 
                checked={generateKnowledgeGraph} 
                onChange={setGenerateKnowledgeGraph}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Space>
          </Tooltip>
        </Space>
      </Card>

      {/* 文件列表 */}
      <Card title="文件列表">
        {documentList.length > 0 ? (
          <Table
            columns={columns}
            dataSource={documentList}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty
            description="暂无文件，请先选择要上传的文件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* 提示信息 */}
      <Alert
        message="上传说明"
        description={
          <div>
            <p>1. 支持的文件格式：PDF、TXT、Markdown、HTML、DOC、DOCX</p>
            <p>2. 单个文件大小限制：100MB</p>
            <p>3. 上传后的文件将自动进行文本提取和处理</p>
            <p>4. 处理完成后可在文档列表中查看和搜索</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  )
}

export default DocumentUploadPage