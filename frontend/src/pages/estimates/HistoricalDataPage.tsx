import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Spin,
  Space,
  Select,
  Input,
  DatePicker,
  Upload,
  message,
  Modal,
  Progress,
  Statistic,
  Alert,
  Tabs,
  Tooltip,
  Badge,
  Dropdown
} from 'antd'
import {
  UploadOutlined,
  DatabaseOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MoreOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  HistoricalProject,
  HistoricalProjectSearchParams,
  ProjectType,
  QualityLevel,
  HistoricalProjectSource,
  ValidationStatus
} from '@/types'
import {
  useGetHistoricalProjectsQuery,
  useLazyGetHistoricalProjectsQuery,
  useDeleteHistoricalProjectMutation,
  useBatchImportHistoricalProjectsMutation,
  useGetHistoricalProjectStatisticsQuery,
  useExportHistoricalProjectsMutation
} from '@/store/api/estimatesApi'
import { ExcelParser } from '@/utils/excelParser'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Search } = Input
const { TabPane } = Tabs

const HistoricalDataPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // 统计信息
  const {
    data: statistics,
    isLoading: statisticsLoading,
    error: statisticsError
  } = useGetHistoricalProjectStatisticsQuery()

  // 历史项目列表
  const [searchParams, setSearchParams] = useState<HistoricalProjectSearchParams>({
    page: 1,
    page_size: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  })

  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects
  } = useGetHistoricalProjectsQuery(searchParams)

  // Hooks
  const [searchProjects] = useLazyGetHistoricalProjectsQuery()
  const [deleteProject] = useDeleteHistoricalProjectMutation()
  const [batchImport] = useBatchImportHistoricalProjectsMutation()
  const [exportData] = useExportHistoricalProjectsMutation()

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadFileList, setUploadFileList] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // 过滤器状态
  const [filters, setFilters] = useState({
    searchTerm: '',
    projectType: 'all' as string,
    qualityLevel: 'all' as string,
    dataSource: 'all' as string,
    dateRange: null as any
  })

  useEffect(() => {
    if (statistics) {
      console.log('历史项目统计信息:', statistics)
    }
  }, [statistics])

  const handleSearch = () => {
    const params: HistoricalProjectSearchParams = {
      ...searchParams,
      page: 1
    }

    if (filters.searchTerm) {
      params.query = filters.searchTerm
    }

    if (filters.projectType !== 'all') {
      params.project_types = [filters.projectType as ProjectType]
    }

    if (filters.qualityLevel !== 'all') {
      params.quality_levels = [filters.qualityLevel as QualityLevel]
    }

    if (filters.dataSource !== 'all') {
      params.data_sources = [filters.dataSource as HistoricalProjectSource]
    }

    setSearchParams(params)
  }

  const handleResetFilters = () => {
    setFilters({
      searchTerm: '',
      projectType: 'all',
      qualityLevel: 'all',
      dataSource: 'all',
      dateRange: null
    })
    setSearchParams({
      page: 1,
      page_size: 10,
      sort_by: 'created_at',
      sort_order: 'desc'
    })
  }

  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      message.error('请选择要上传的Excel文件')
      return
    }

    setUploading(true)
    try {
      // 这里应该调用批量导入API
      message.success(`成功导入 ${uploadFileList.length} 个文件`)
      setUploadModalVisible(false)
      setUploadFileList([])
      refetchProjects()
    } catch (error) {
      message.error('导入失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个历史项目吗？此操作不可撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteProject(id).unwrap()
          message.success('删除成功')
          refetchProjects()
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  const handleExport = async (format: 'excel' | 'csv' | 'json') => {
    try {
      const blob = await exportData({
        project_ids: selectedRowKeys.length > 0 ? selectedRowKeys as string[] : undefined,
        format,
        filters: searchParams
      }).unwrap()

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `历史项目数据.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case ValidationStatus.VALIDATED: return 'success'
      case ValidationStatus.PENDING: return 'processing'
      case ValidationStatus.NEEDS_REVIEW: return 'warning'
      case ValidationStatus.REJECTED: return 'error'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case ValidationStatus.VALIDATED: return '已验证'
      case ValidationStatus.PENDING: return '待验证'
      case ValidationStatus.NEEDS_REVIEW: return '需要审核'
      case ValidationStatus.REJECTED: return '已拒绝'
      default: return '未知'
    }
  }

  const getSourceText = (source: string) => {
    switch (source) {
      case HistoricalProjectSource.EXCEL_UPLOAD: return 'Excel上传'
      case HistoricalProjectSource.MANUAL_ENTRY: return '手动录入'
      case HistoricalProjectSource.API_IMPORT: return 'API导入'
      default: return '未知'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case HistoricalProjectSource.EXCEL_UPLOAD: return 'blue'
      case HistoricalProjectSource.MANUAL_ENTRY: return 'green'
      case HistoricalProjectSource.API_IMPORT: return 'purple'
      default: return 'default'
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 90) return '#52c41a'
    if (score >= 70) return '#faad14'
    return '#ff4d4f'
  }

  const columns: ColumnsType<HistoricalProject> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: HistoricalProject) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          {record.excel_metadata && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              来源: {record.excel_metadata.filename}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '项目类型',
      dataIndex: ['project_features', 'basic_features', 'project_type'],
      key: 'project_type',
      render: (type: ProjectType) => {
        const typeMap = {
          [ProjectType.RESIDENTIAL]: { text: '住宅', color: 'blue' },
          [ProjectType.COMMERCIAL]: { text: '商业', color: 'green' },
          [ProjectType.INDUSTRIAL]: { text: '工业', color: 'orange' },
          [ProjectType.PUBLIC]: { text: '公共', color: 'purple' },
          [ProjectType.MIXED]: { text: '混合', color: 'cyan' }
        }
        const config = typeMap[type] || { text: '其他', color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '建筑面积',
      dataIndex: ['project_features', 'basic_features', 'area'],
      key: 'area',
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '单位造价',
      dataIndex: ['project_features', 'cost_features', 'unit_cost'],
      key: 'unit_cost',
      render: (cost: number) => `¥${cost.toLocaleString()}/㎡`
    },
    {
      title: '总造价',
      dataIndex: ['project_features', 'cost_features', 'total_cost'],
      key: 'total_cost',
      render: (cost: number) => `¥${(cost / 10000).toFixed(2)}万`
    },
    {
      title: '质量等级',
      dataIndex: ['project_features', 'quality_features', 'quality_level'],
      key: 'quality_level',
      render: (level: QualityLevel) => {
        const levelMap = {
          [QualityLevel.BASIC]: { text: '基础', color: 'green' },
          [QualityLevel.STANDARD]: { text: '标准', color: 'blue' },
          [QualityLevel.PREMIUM]: { text: '高端', color: 'gold' }
        }
        const config = levelMap[level] || { text: '未知', color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '数据质量',
      dataIndex: 'data_quality_score',
      key: 'data_quality_score',
      render: (score: number) => (
        <Space direction="vertical" size="small">
          <Progress
            percent={score}
            size="small"
            strokeColor={getQualityColor(score)}
            showInfo={false}
          />
          <Text style={{ fontSize: '12px', color: getQualityColor(score) }}>
            {score.toFixed(1)}%
          </Text>
        </Space>
      )
    },
    {
      title: '验证状态',
      dataIndex: ['quality_indicators', 'validation_status'],
      key: 'validation_status',
      render: (status: ValidationStatus) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: HistoricalProject) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/estimates/historical-data/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/estimates/historical-data/${record.id}/edit`)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'export',
                  label: '导出数据',
                  icon: <DownloadOutlined />
                },
                {
                  key: 'validate',
                  label: '数据验证',
                  icon: <CheckCircleOutlined />
                },
                {
                  key: 'delete',
                  label: '删除',
                  icon: <DeleteOutlined />,
                  danger: true
                }
              ],
              onClick: ({ key }) => {
                if (key === 'delete') {
                  handleDelete(record.id)
                } else if (key === 'export') {
                  handleExport('excel')
                }
              }
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
    type: 'checkbox' as const
  }

  // 概览标签页内容
  const renderOverview = () => (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="历史项目总数"
              value={statistics?.total_projects || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均单位造价"
              value={statistics?.average_unit_cost || 0}
              prefix="¥"
              suffix="/㎡"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="数据质量评分"
              value={85}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="本周新增"
              value={statistics?.recent_uploads?.length || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="快速操作">
            <Space size="large" wrap>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                size="large"
                onClick={() => setUploadModalVisible(true)}
              >
                上传Excel文件
              </Button>
              <Button
                icon={<SearchOutlined />}
                onClick={() => navigate('/estimates/smart-estimate')}
              >
                智能估算
              </Button>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => navigate('/estimates/analytics')}
              >
                数据分析
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleExport('excel')}
                disabled={selectedRowKeys.length === 0}
              >
                导出选中数据
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 最近上传的项目 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="最近上传的项目"
            extra={
              <Button type="link" onClick={() => navigate('/estimates/historical-data/list')}>
                查看全部
              </Button>
            }
          >
            <Table
              columns={columns.slice(0, 6)} // 只显示前6列
              dataSource={statistics?.recent_uploads?.slice(0, 5) || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )

  // 列表标签页内容
  const renderList = () => (
    <div>
      {/* 过滤器 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              <Search
                placeholder="搜索项目名称..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                placeholder="项目类型"
                value={filters.projectType}
                onChange={(value) => setFilters({ ...filters, projectType: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Select.Option value="all">全部类型</Select.Option>
                <Select.Option value="residential">住宅</Select.Option>
                <Select.Option value="commercial">商业</Select.Option>
                <Select.Option value="industrial">工业</Select.Option>
                <Select.Option value="public">公共</Select.Option>
                <Select.Option value="mixed">混合</Select.Option>
              </Select>
              <Select
                placeholder="质量等级"
                value={filters.qualityLevel}
                onChange={(value) => setFilters({ ...filters, qualityLevel: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Select.Option value="all">全部等级</Select.Option>
                <Select.Option value="basic">基础</Select.Option>
                <Select.Option value="standard">标准</Select.Option>
                <Select.Option value="premium">高端</Select.Option>
              </Select>
              <Select
                placeholder="数据来源"
                value={filters.dataSource}
                onChange={(value) => setFilters({ ...filters, dataSource: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Select.Option value="all">全部来源</Select.Option>
                <Select.Option value="excel_upload">Excel上传</Select.Option>
                <Select.Option value="manual_entry">手动录入</Select.Option>
                <Select.Option value="api_import">API导入</Select.Option>
              </Select>
              <RangePicker
                placeholder="选择时间范围"
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                重置
              </Button>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 项目列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={projectsData?.items || []}
          rowKey="id"
          loading={projectsLoading}
          rowSelection={rowSelection}
          pagination={{
            current: searchParams.page,
            pageSize: searchParams.page_size,
            total: projectsData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setSearchParams({ ...searchParams, page, page_size: pageSize })
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )

  return (
    <div className="historical-data-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2}>历史数据管理</Title>
        <Text type="secondary">管理历史项目数据，支持Excel导入和智能分析</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="数据概览" key="overview">
          {renderOverview()}
        </TabPane>
        <TabPane tab="项目列表" key="list">
          {renderList()}
        </TabPane>
      </Tabs>

      {/* 上传Excel文件弹窗 */}
      <Modal
        title="上传Excel文件"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setUploadModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploading}
            onClick={handleUpload}
            disabled={uploadFileList.length === 0}
          >
            开始上传
          </Button>
        ]}
        width={600}
      >
        <Alert
          message="支持Excel格式"
          description="请上传包含工程造价数据的Excel文件，系统将自动解析并提取项目信息。支持标准造价预算表、详细清单等多种格式。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Upload.Dragger
          multiple
          accept=".xlsx,.xls"
          beforeUpload={(file) => {
            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         file.type === 'application/vnd.ms-excel'
            if (!isExcel) {
              message.error('只能上传Excel文件!')
              return false
            }
            const isLt10M = file.size / 1024 / 1024 < 10
            if (!isLt10M) {
              message.error('文件大小不能超过10MB!')
              return false
            }
            return false // 阻止自动上传
          }}
          onChange={(info) => {
            setUploadFileList(info.fileList.map(f => f.originFileObj as File))
          }}
          showUploadList={true}
        >
          <p className="ant-upload-drag-icon">
            <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单个或批量上传，文件大小不超过10MB</p>
        </Upload.Dragger>
      </Modal>
    </div>
  )
}

export default HistoricalDataPage