import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  Input,
  Upload,
  message,
  Modal,
  Statistic,
  Alert,
  Tabs,
  Tooltip
} from 'antd'
import {
  UploadOutlined,
  DatabaseOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  RocketOutlined,
  HistoryOutlined,
  SwapOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

// 使用正确的 API
import {
  useGetTemplatesQuery,
  useDeleteTemplateMutation,
  useUploadExcelMutation,
  ProjectTemplate,
  ProjectTemplateCostItem
} from '@/store/api/templatesApi'

import './Estimates.css'

const { Title, Text } = Typography
const { Search } = Input
const { TabPane } = Tabs

const HistoricalDataPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // RTK Query hooks
  const {
    data: templatesData,
    isLoading,
    error,
    refetch
  } = useGetTemplatesQuery({ page, size: pageSize, name: searchTerm || undefined })

  const [deleteTemplate] = useDeleteTemplateMutation()
  const [uploadExcel, { isLoading: uploading }] = useUploadExcelMutation()

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadFileList, setUploadFileList] = useState<File[]>([])

  // 估算历史记录状态
  const [estimatesData, setEstimatesData] = useState<any>(null)
  const [estimatesLoading, setEstimatesLoading] = useState(false)
  const [estimatesPage, setEstimatesPage] = useState(1)
  const [estimatesPageSize, setEstimatesPageSize] = useState(10)

  // 上传处理
  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      message.error('请选择要上传的Excel文件')
      return
    }

    // 检查认证 token
    const token = localStorage.getItem('accessToken')
    if (!token) {
      message.error('登录已过期，请重新登录')
      navigate('/login')
      return
    }

    let successCount = 0
    let failCount = 0

    try {
      for (const file of uploadFileList) {
        try {
          const formData = new FormData()
          formData.append('file', file)

          await uploadExcel(formData).unwrap()
          console.log(`文件 ${file.name} 上传成功`)
          successCount++
        } catch (error: any) {
          console.error(`文件 ${file.name} 上传失败:`, error)
          if (error?.status === 401) {
            message.error('认证失败,请重新登录')
            navigate('/login')
            return
          }
          failCount++
        }
      }

      if (successCount > 0) {
        message.success(`成功上传 ${successCount} 个文件${failCount > 0 ? `，${failCount} 个失败` : ''}`)
      } else {
        message.error('所有文件上传失败')
      }

      setUploadModalVisible(false)
      setUploadFileList([])
      // RTK Query 会自动刷新数据
    } catch (error) {
      message.error('上传过程出错')
      console.error('Upload error:', error)
    }
  }

  // 获取估算历史记录
  const fetchEstimatesHistory = async () => {
    try {
      setEstimatesLoading(true)
      const token = localStorage.getItem('accessToken')
      if (!token) {
        message.error('登录已过期，请重新登录')
        navigate('/login')
        return
      }

      const response = await fetch(
        `/api/v1/template-estimates/estimates?page=${estimatesPage}&size=${estimatesPageSize}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('获取估算历史记录失败')
      }

      const data = await response.json()
      setEstimatesData(data)
    } catch (error) {
      message.error('获取估算历史记录失败')
      console.error('Fetch estimates error:', error)
    } finally {
      setEstimatesLoading(false)
    }
  }

  // 当切换到估算历史Tab时，获取数据
  React.useEffect(() => {
    if (activeTab === 'estimates') {
      fetchEstimatesHistory()
    }
  }, [activeTab, estimatesPage, estimatesPageSize])

  // 删除估算记录
  const handleDeleteEstimate = async (estimateId: number, estimateName: string) => {
    Modal.confirm({
      title: '确认删除估算记录',
      content: `确定要删除估算记录"${estimateName}"吗？此操作不可撤销。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('accessToken')
          if (!token) {
            message.error('登录已过期，请重新登录')
            navigate('/login')
            return
          }

          const response = await fetch(
            `/api/v1/template-estimates/estimates/${estimateId}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          )

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || '删除失败')
          }

          message.success('估算记录已成功删除')
          // 刷新列表
          fetchEstimatesHistory()
        } catch (error: any) {
          message.error(error.message || '删除估算记录失败')
          console.error('Delete estimate error:', error)
        }
      }
    })
  }

  // 删除处理
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个项目模板吗？此操作不可撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTemplate(id).unwrap()
          message.success('删除成功')
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  // "用于估算"按钮处理
  const handleUseForEstimation = (template: ProjectTemplate) => {
    navigate('/estimates/smart-estimate', {
      state: {
        referenceProject: {
          id: template.id,
          name: template.name,
          area: template.area,
          unit_cost: template.unit_cost,
          total_cost: template.total_cost,
          cost_items: template.cost_items
        }
      }
    })
  }

  // "项目对比"按钮处理
  const handleCompareProjects = () => {
    if (selectedRowKeys.length < 2) {
      message.warning('请至少选择2个项目进行对比')
      return
    }
    if (selectedRowKeys.length > 5) {
      message.warning('最多支持同时对比5个项目')
      return
    }
    // 导航到对比页面，传递选中的项目IDs
    navigate(`/estimates/comparisons?project_ids=${selectedRowKeys.join(',')}`)
  }

  // 14级成本明细展开渲染
  const expandedRowRender = (record: ProjectTemplate) => {
    // 按层级分组
    const primaryItems = record.cost_items?.filter(item => item.is_primary_section) || []
    const secondaryItems = record.cost_items?.filter(item => item.is_secondary_section) || []

    // 组织层级数据
    const hierarchicalData = primaryItems.map(primary => {
      const children = secondaryItems.filter(
        sec => sec.primary_section_code === primary.item_code
      )
      return {
        ...primary,
        children: children.length > 0 ? children : undefined
      }
    })

    // 14级明细表格列定义
    const detailColumns: ColumnsType<ProjectTemplateCostItem> = [
      {
        title: '代码',
        dataIndex: 'item_code',
        width: 100,
        render: (code: string, item: ProjectTemplateCostItem) => (
          <Text strong={item.is_primary_section} style={{
            color: item.is_primary_section ? '#1890ff' : undefined
          }}>
            {code}
          </Text>
        )
      },
      {
        title: '项目名称',
        dataIndex: 'item_name',
        width: 300,
        render: (name: string, item: ProjectTemplateCostItem) => (
          <Text strong={item.is_primary_section}>{name}</Text>
        )
      },
      {
        title: '单价(元/m²)',
        dataIndex: 'unit_price',
        width: 150,
        align: 'right',
        render: (price: number | null) =>
          price !== null ? `¥${price.toFixed(2)}` : '-'
      },
      {
        title: '合价(元)',
        dataIndex: 'total_price',
        width: 150,
        align: 'right',
        render: (price: number | null) =>
          price !== null ? `¥${(price / 10000).toFixed(2)}万` : '-'
      },
      {
        title: '类型',
        dataIndex: 'item_type',
        width: 100,
        render: (type: string, item: ProjectTemplateCostItem) => {
          if (item.is_primary_section) return <Tag color="blue">一级分部</Tag>
          if (item.is_secondary_section) return <Tag>二级分项</Tag>
          return <Tag color="default">明细</Tag>
        }
      }
    ]

    return (
      <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
        <Alert
          message="14级成本明细"
          description="展示该项目的完整成本结构：一级分部（1.0-14.0）和二级分项明细。第14项为总造价，等于前13项之和。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={detailColumns}
          dataSource={hierarchicalData}
          pagination={false}
          size="small"
          bordered
          rowKey="id"
          expandable={{
            childrenColumnName: 'children',
            defaultExpandAllRows: false,
            indentSize: 20
          }}
          rowClassName={(record: ProjectTemplateCostItem) =>
            record.is_primary_section ? 'primary-section-row' : ''
          }
        />
      </div>
    )
  }

  // 表格列定义
  const columns: ColumnsType<ProjectTemplate> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProjectTemplate) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          {record.source_file && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              来源: {record.source_file}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '项目类型',
      dataIndex: 'project_type',
      key: 'project_type',
      render: (type: string | null) => {
        if (!type) return <Tag>未分类</Tag>
        const typeMap: Record<string, { text: string; color: string }> = {
          'residential': { text: '住宅', color: 'blue' },
          'commercial': { text: '商业', color: 'green' },
          'industrial': { text: '工业', color: 'orange' },
          'public': { text: '公共', color: 'purple' },
          'mixed': { text: '混合', color: 'cyan' }
        }
        const config = typeMap[type] || { text: type, color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '建筑面积',
      dataIndex: 'area',
      key: 'area',
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '单位造价',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      render: (cost: number | null) =>
        cost !== null ? `¥${cost.toLocaleString()}/㎡` : '-'
    },
    {
      title: '总造价',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: (cost: number | null) =>
        cost !== null ? `¥${(cost / 10000).toFixed(2)}万` : '-'
    },
    {
      title: '质量等级',
      key: 'quality',
      render: (_, record: ProjectTemplate) => {
        // 根据单位造价估算质量等级
        const unitCost = record.unit_cost || 0
        if (unitCost >= 3000) return <Tag color="gold">高端</Tag>
        if (unitCost >= 2000) return <Tag color="blue">标准</Tag>
        return <Tag color="green">基础</Tag>
      }
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
      render: (_, record: ProjectTemplate) => (
        <Space>
          <Tooltip title="用于成本估算">
            <Button
              type="primary"
              size="small"
              icon={<RocketOutlined />}
              onClick={() => handleUseForEstimation(record)}
            >
              用于估算
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    }
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
              value={templatesData?.total || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均单位造价"
              value={templatesData?.templates?.reduce((sum, t) => sum + (t.unit_cost || 0), 0) / (templatesData?.templates?.length || 1) || 0}
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
              value={0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作" style={{ marginBottom: 24 }}>
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
            icon={<SwapOutlined />}
            onClick={handleCompareProjects}
            disabled={selectedRowKeys.length < 2}
          >
            项目对比 ({selectedRowKeys.length})
          </Button>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => navigate('/estimates/analytics')}
          >
            数据分析
          </Button>
          <Button
            icon={<DownloadOutlined />}
            disabled={selectedRowKeys.length === 0}
          >
            导出选中数据
          </Button>
        </Space>
      </Card>

      {/* 最近上传的项目 */}
      <Card
        title="最近上传的项目"
        extra={
          <Button type="link" onClick={() => setActiveTab('list')}>
            查看全部
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={templatesData?.templates?.slice(0, 5) || []}
          rowKey="id"
          pagination={false}
          size="small"
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => (record.cost_items?.length || 0) > 0
          }}
        />
      </Card>
    </div>
  )

  // 列表标签页内容
  const renderList = () => (
    <div>
      {/* 搜索过滤器 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={16}>
            <Search
              placeholder="搜索项目名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={() => setPage(1)}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchTerm('')
                  setPage(1)
                  refetch()
                }}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => setPage(1)}
              >
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
          dataSource={templatesData?.templates || []}
          rowKey="id"
          loading={isLoading}
          rowSelection={rowSelection}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => (record.cost_items?.length || 0) > 0
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: templatesData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage)
              setPageSize(newPageSize)
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )

  // 渲染估算历史记录
  const renderEstimatesHistory = () => {
    const columns: ColumnsType<any> = [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
        sorter: (a: any, b: any) => a.id - b.id
      },
      {
        title: '估算名称',
        dataIndex: 'name',
        width: 300,
        ellipsis: true
      },
      {
        title: '估算类型',
        dataIndex: 'estimation_type',
        width: 120,
        render: (type: string) => (
          <Tag color={type === 'AI估算' ? 'blue' : 'green'}>{type}</Tag>
        )
      },
      {
        title: '参考模板',
        dataIndex: 'template_name',
        width: 200,
        ellipsis: true
      },
      {
        title: '总造价（万元）',
        dataIndex: 'total_cost',
        width: 150,
        align: 'right',
        render: (cost: number) => (cost / 10000).toFixed(2)
      },
      {
        title: '单位造价（元/㎡）',
        dataIndex: 'cost_per_unit',
        width: 150,
        align: 'right',
        render: (cost: number) => cost?.toFixed(2) || '-'
      },
      {
        title: '置信度',
        dataIndex: 'confidence_score',
        width: 120,
        render: (score: number) => (
          <span style={{ color: score > 0.7 ? '#52c41a' : score > 0.5 ? '#faad14' : '#ff4d4f' }}>
            {(score * 100).toFixed(1)}%
          </span>
        )
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (date: string) => new Date(date).toLocaleString('zh-CN')
      },
      {
        title: '操作',
        key: 'action',
        width: 200,
        fixed: 'right',
        render: (_: any, record: any) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/estimates/detail/${record.id}`)}
            >
              查看详情
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteEstimate(record.id, record.name)}
            >
              删除
            </Button>
          </Space>
        )
      }
    ]

    return (
      <div>
        <Card title="估算历史记录" extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchEstimatesHistory}>
              刷新
            </Button>
          </Space>
        }>
          <Table
            columns={columns}
            dataSource={estimatesData?.estimates || []}
            loading={estimatesLoading}
            rowKey="id"
            pagination={{
              current: estimatesPage,
              pageSize: estimatesPageSize,
              total: estimatesData?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              onChange: (newPage, newPageSize) => {
                setEstimatesPage(newPage)
                if (newPageSize) setEstimatesPageSize(newPageSize)
              }
            }}
            scroll={{ x: 1400 }}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="historical-data-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2} className="estimates-title">历史数据管理</Title>
        <Text type="secondary">管理历史项目数据，支持Excel导入和智能分析</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="数据概览" key="overview">
          {renderOverview()}
        </TabPane>
        <TabPane tab="项目列表" key="list">
          {renderList()}
        </TabPane>
        <TabPane tab="估算历史" key="estimates">
          {renderEstimatesHistory()}
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
          description="请上传包含工程造价数据的Excel文件，系统将自动解析并提取项目信息。支持多项目Excel格式（最多7个项目）。"
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
            setUploadFileList(info.fileList.map(f => f.originFileObj as File).filter(Boolean))
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
