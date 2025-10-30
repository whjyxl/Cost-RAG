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
  Progress,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExportOutlined,
  PlusOutlined,
  DollarOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { RangePicker } = DatePicker

interface EstimateItem {
  id: string
  projectName: string
  projectType: string
  clientName: string
  location: string
  totalAmount: number
  currency: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
  estimatedPeriod: string
  taxRate: number
  profitMargin: number
  creator: string
  approver?: string
  approvedAt?: string
  tags?: string[]
  description?: string
  costItemCount: number
}

const EstimateListPage: React.FC = () => {
  const [estimates, setEstimates] = useState<EstimateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateItem | null>(null)

  // 模拟数据
  useEffect(() => {
    const mockData: EstimateItem[] = [
      {
        id: '1',
        projectName: '阳光小区住宅楼建设项目',
        projectType: '住宅建筑',
        clientName: '阳光地产开发有限公司',
        location: '北京市朝阳区',
        totalAmount: 5680000,
        currency: 'CNY',
        status: 'approved',
        priority: 'high',
        createdAt: '2024-01-15 10:30:00',
        updatedAt: '2024-01-18 14:20:00',
        estimatedPeriod: '2024年第1季度',
        taxRate: 9,
        profitMargin: 15,
        creator: '张工程师',
        approver: '李总监',
        approvedAt: '2024-01-18 14:20:00',
        tags: ['住宅', '高层建筑', '混凝土结构'],
        description: '住宅楼建设项目的详细成本估算，包含土建、安装、装修等全部工程内容',
        costItemCount: 45,
      },
      {
        id: '2',
        projectName: '科技园区厂房改造工程',
        projectType: '工业建筑',
        clientName: '创新科技发展有限公司',
        location: '上海市浦东新区',
        totalAmount: 3250000,
        currency: 'CNY',
        status: 'pending',
        priority: 'medium',
        createdAt: '2024-01-18 09:15:00',
        updatedAt: '2024-01-20 11:30:00',
        estimatedPeriod: '2024年第1季度',
        taxRate: 9,
        profitMargin: 12,
        creator: '王造价师',
        tags: ['工业', '改造', '钢结构'],
        description: '现有厂房的改造和升级工程估算',
        costItemCount: 32,
      },
      {
        id: '3',
        projectName: '城市商业中心装修项目',
        projectType: '装修工程',
        clientName: '华联商业集团',
        location: '深圳市南山区',
        totalAmount: 1890000,
        currency: 'CNY',
        status: 'draft',
        priority: 'low',
        createdAt: '2024-01-20 14:45:00',
        updatedAt: '2024-01-20 14:45:00',
        estimatedPeriod: '2024年第2季度',
        taxRate: 9,
        profitMargin: 10,
        creator: '赵设计师',
        tags: ['商业', '装修', '室内设计'],
        description: '商业中心室内装修工程的详细估算',
        costItemCount: 28,
      },
      {
        id: '4',
        projectName: '市政道路建设项目',
        projectType: '基础设施',
        clientName: '市建设局',
        location: '广州市天河区',
        totalAmount: 8900000,
        currency: 'CNY',
        status: 'rejected',
        priority: 'high',
        createdAt: '2024-01-10 16:20:00',
        updatedAt: '2024-01-16 10:15:00',
        estimatedPeriod: '2024年第1季度',
        taxRate: 9,
        profitMargin: 8,
        creator: '钱工程师',
        approver: '孙局长',
        approvedAt: '2024-01-16 10:15:00',
        tags: ['市政', '道路', '基础设施'],
        description: '城市主干道建设项目的成本估算',
        costItemCount: 67,
      },
      {
        id: '5',
        projectName: '园林景观绿化工程',
        projectType: '园林工程',
        clientName: '绿色生态园林公司',
        location: '杭州市西湖区',
        totalAmount: 1250000,
        currency: 'CNY',
        status: 'approved',
        priority: 'medium',
        createdAt: '2024-01-08 13:10:00',
        updatedAt: '2024-01-12 16:45:00',
        estimatedPeriod: '2024年第1季度',
        taxRate: 9,
        profitMargin: 12,
        creator: '周园艺师',
        approver: '吴经理',
        approvedAt: '2024-01-12 16:45:00',
        tags: ['园林', '绿化', '景观'],
        description: '公园景观绿化工程估算',
        costItemCount: 35,
      },
    ]
    setEstimates(mockData)
  }, [])

  // 统计信息
  const stats = {
    total: estimates.length,
    draft: estimates.filter(e => e.status === 'draft').length,
    pending: estimates.filter(e => e.status === 'pending').length,
    approved: estimates.filter(e => e.status === 'approved').length,
    rejected: estimates.filter(e => e.status === 'rejected').length,
    totalAmount: estimates.reduce((sum, e) => sum + e.totalAmount, 0),
    avgAmount: estimates.length > 0 ? estimates.reduce((sum, e) => sum + e.totalAmount, 0) / estimates.length : 0,
  }

  // 过滤估算
  const filteredEstimates = estimates.filter(estimate => {
    // 搜索过滤
    const matchesSearch = !searchText ||
      estimate.projectName.toLowerCase().includes(searchText.toLowerCase()) ||
      estimate.clientName.toLowerCase().includes(searchText.toLowerCase()) ||
      estimate.location.toLowerCase().includes(searchText.toLowerCase()) ||
      estimate.tags?.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()))

    // 状态过滤
    const matchesStatus = statusFilter === 'all' || estimate.status === statusFilter

    // 类型过滤
    const matchesType = typeFilter === 'all' || estimate.projectType === typeFilter

    // 优先级过滤
    const matchesPriority = priorityFilter === 'all' || estimate.priority === priorityFilter

    // 日期过滤
    const matchesDate = !dateRange ||
      (dayjs(estimate.createdAt).isAfter(dateRange[0]) &&
       dayjs(estimate.createdAt).isBefore(dateRange[1].add(1, 'day')))

    return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesDate
  })

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'draft':
        return <Tag color="default">草稿</Tag>
      case 'pending':
        return <Tag color="processing">待审核</Tag>
      case 'approved':
        return <Tag color="success">已批准</Tag>
      case 'rejected':
        return <Tag color="error">已拒绝</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 获取优先级标签
  const getPriorityTag = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Tag color="red">高</Tag>
      case 'medium':
        return <Tag color="orange">中</Tag>
      case 'low':
        return <Tag color="green">低</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  // 格式化金额
  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString()}`
  }

  // 查看详情
  const handleViewDetail = (record: EstimateItem) => {
    setSelectedEstimate(record)
    setDetailVisible(true)
  }

  // 复制估算
  const handleCopy = (record: EstimateItem) => {
    message.success('估算已复制，可以在编辑中修改')
  }

  // 删除估算
  const handleDelete = (id: string) => {
    setEstimates(prev => prev.filter(item => item.id !== id))
    message.success('估算已删除')
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的估算')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个估算吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        setEstimates(prev => prev.filter(item => !selectedRowKeys.includes(item.id)))
        setSelectedRowKeys([])
        message.success('批量删除成功')
      },
    })
  }

  // 导出估算
  const handleExport = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要导出的估算')
      return
    }
    message.success(`正在导出 ${selectedRowKeys.length} 个估算...`)
  }

  // 表格列定义
  const columns: ColumnsType<EstimateItem> = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (text: string, record: EstimateItem) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.clientName}
          </Text>
        </Space>
      ),
    },
    {
      title: '项目类型',
      dataIndex: 'projectType',
      key: 'projectType',
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text ellipsis style={{ maxWidth: 120 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '估算金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number, record: EstimateItem) => (
        <Text strong style={{ color: '#1890ff' }}>
          {formatAmount(amount, record.currency)}
        </Text>
      ),
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => getPriorityTag(priority),
    },
    {
      title: '利润率',
      dataIndex: 'profitMargin',
      key: 'profitMargin',
      render: (rate: number) => (
        <Space>
          <PercentageOutlined />
          <Text>{rate}%</Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      render: (creator: string) => (
        <Space>
          <UserOutlined />
          <Text>{creator}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: EstimateItem) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => message.info('编辑功能开发中')}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="导出">
            <Button
              type="text"
              icon={<ExportOutlined />}
              onClick={() => message.info('导出功能开发中')}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个估算吗？"
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
  const rowSelection: TableProps<EstimateItem>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>估算列表</Title>
        <Paragraph type="secondary">
          管理和查看所有成本估算项目，支持搜索、筛选和批量操作
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总估算数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="草稿"
              value={stats.draft}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已批准"
              value={stats.approved}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总金额"
              value={stats.totalAmount}
              precision={0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索项目名称、客户或地点"
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
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="pending">待审核</Select.Option>
              <Select.Option value="approved">已批准</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="类型筛选"
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部类型</Select.Option>
              <Select.Option value="住宅建筑">住宅建筑</Select.Option>
              <Select.Option value="商业建筑">商业建筑</Select.Option>
              <Select.Option value="工业建筑">工业建筑</Select.Option>
              <Select.Option value="基础设施">基础设施</Select.Option>
              <Select.Option value="装修工程">装修工程</Select.Option>
              <Select.Option value="园林工程">园林工程</Select.Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="优先级筛选"
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部优先级</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
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

      {/* 估算列表 */}
      <Card title="估算列表">
        {filteredEstimates.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredEstimates}
            rowKey="id"
            loading={loading}
            rowSelection={rowSelection}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
          />
        ) : (
          <Empty description="暂无估算数据" />
        )}
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="估算详情"
        placement="right"
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        width={800}
      >
        {selectedEstimate && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="项目名称" span={2}>
                {selectedEstimate.projectName}
              </Descriptions.Item>
              <Descriptions.Item label="项目类型">
                <Tag color="blue">{selectedEstimate.projectType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户名称">
                {selectedEstimate.clientName}
              </Descriptions.Item>
              <Descriptions.Item label="项目地点">
                {selectedEstimate.location}
              </Descriptions.Item>
              <Descriptions.Item label="估算期间">
                {selectedEstimate.estimatedPeriod}
              </Descriptions.Item>
              <Descriptions.Item label="估算金额">
                <Text strong style={{ color: '#1890ff', fontSize: '16px' }}>
                  {formatAmount(selectedEstimate.totalAmount, selectedEstimate.currency)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="税率">
                {selectedEstimate.taxRate}%
              </Descriptions.Item>
              <Descriptions.Item label="利润率">
                {selectedEstimate.profitMargin}%
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedEstimate.status)}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {getPriorityTag(selectedEstimate.priority)}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                <Space>
                  <UserOutlined />
                  {selectedEstimate.creator}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                <Space>
                  <CalendarOutlined />
                  {selectedEstimate.createdAt}
                </Space>
              </Descriptions.Item>
              {selectedEstimate.approver && (
                <Descriptions.Item label="审批人">
                  {selectedEstimate.approver}
                </Descriptions.Item>
              )}
              {selectedEstimate.approvedAt && (
                <Descriptions.Item label="审批时间">
                  {selectedEstimate.approvedAt}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="成本项目数">
                {selectedEstimate.costItemCount} 项
              </Descriptions.Item>
            </Descriptions>

            {selectedEstimate.description && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>项目描述</Text>
                </div>
                <Paragraph>{selectedEstimate.description}</Paragraph>
              </>
            )}

            {selectedEstimate.tags && selectedEstimate.tags.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>标签</Text>
                </div>
                <Space wrap>
                  {selectedEstimate.tags.map((tag, index) => (
                    <Tag key={index} color="blue">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              </>
            )}

            <Divider />
            <div style={{ marginBottom: 16 }}>
              <Text strong>项目进度</Text>
            </div>
            <Progress
              percent={
                selectedEstimate.status === 'approved' ? 100 :
                selectedEstimate.status === 'pending' ? 60 :
                selectedEstimate.status === 'rejected' ? 0 : 30
              }
              status={
                selectedEstimate.status === 'approved' ? 'success' :
                selectedEstimate.status === 'rejected' ? 'exception' : 'active'
              }
              format={(percent) => `${percent}% (${selectedEstimate.status === 'approved' ? '已完成' : selectedEstimate.status === 'pending' ? '审核中' : selectedEstimate.status === 'rejected' ? '已拒绝' : '草稿'})`}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default EstimateListPage