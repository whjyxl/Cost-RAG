import React, { useState, useCallback } from 'react'
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
}

const DocumentUploadPage: React.FC = () => {
  const [documentList, setDocumentList] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)

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

      // 检查文件大小 (50MB)
      const isLt50M = file.size / 1024 / 1024 < 50
      if (!isLt50M) {
        message.error('文件大小不能超过 50MB')
        return false
      }

      return false // 阻止自动上传，我们手动处理
    },
    onChange(info) {
      const { fileList } = info

      // 转换文件列表为我们的格式
      const newDocuments: DocumentItem[] = fileList.map((file, index) => {
        const existingDoc = documentList.find(d => d.id === file.uid)

        if (existingDoc) {
          return existingDoc
        }

        return {
          id: file.uid,
          name: file.name,
          size: file.size || 0,
          type: file.type || 'unknown',
          status: file.status as 'uploading' | 'done' | 'error',
          uploadTime: new Date().toLocaleString(),
          progress: file.percent || 0,
          errorMessage: file.response?.message,
        }
      })

      setDocumentList(newDocuments)
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

    setUploading(true)

    // 模拟上传过程
    for (const doc of documentList) {
      if (doc.status === 'uploading') {
        // 模拟上传进度
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 200))

          setDocumentList(prev => prev.map(item =>
            item.id === doc.id
              ? { ...item, progress }
              : item
          ))
        }

        // 模拟上传结果
        const success = Math.random() > 0.2 // 80% 成功率

        setDocumentList(prev => prev.map(item =>
          item.id === doc.id
            ? {
                ...item,
                status: success ? 'done' : 'error',
                progress: 100,
                errorMessage: success ? undefined : '上传失败：服务器内部错误'
              }
            : item
        ))
      }
    }

    setUploading(false)
    message.success('文件上传完成')
  }, [documentList])

  // 删除文件
  const handleRemove = useCallback((id: string) => {
    setDocumentList(prev => prev.filter(item => item.id !== id))
    message.success('文件已移除')
  }, [])

  // 清空列表
  const handleClear = useCallback(() => {
    setDocumentList([])
    message.success('文件列表已清空')
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
        <Title level={2}>文档上传</Title>
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
            <p>2. 单个文件大小限制：50MB</p>
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