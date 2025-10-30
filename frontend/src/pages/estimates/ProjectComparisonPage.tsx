import React, { useState, useEffect } from 'react'
import { Typography, Card, Row, Col, Button, Table, Tag, Spin, Space, Select, DatePicker, Input, Alert, Divider } from 'antd'
import { PlusOutlined, EyeOutlined, DownloadOutlined, BarChartOutlined, LineChartOutlined, FilterOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

interface ComparisonProject {
  id: string
  name: string
  type: 'residential' | 'commercial' | 'industrial'
  location: string
  area: number
  totalCost: number
  unitCost: number
  constructionPeriod: number
  qualityLevel: 'basic' | 'standard' | 'premium'
  status: 'planning' | 'in_progress' | 'completed'
  createdAt: string
}

interface ComparisonMetric {
  name: string
  unit: string
  projects: {
    [projectId: string]: string | number
  }
}

const ProjectComparisonPage: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ComparisonProject[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<ComparisonMetric[]>([])
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    dateRange: null as any,
    searchTerm: ''
  })

  // 模拟数据 - 在实际应用中这些应该从API获取
  const mockProjects: ComparisonProject[] = [
    {
      id: '1',
      name: '阳光花园住宅项目A',
      type: 'residential',
      location: '北京市朝阳区',
      area: 8500,
      totalCost: 12750000,
      unitCost: 15000,
      constructionPeriod: 18,
      qualityLevel: 'premium',
      status: 'completed',
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'CBD商业中心项目B',
      type: 'commercial',
      location: '上海市浦东新区',
      area: 12000,
      totalCost: 24000000,
      unitCost: 20000,
      constructionPeriod: 24,
      qualityLevel: 'standard',
      status: 'in_progress',
      createdAt: '2024-02-20'
    },
    {
      id: '3',
      name: '工业园区厂房C',
      type: 'industrial',
      location: '深圳市宝安区',
      area: 15000,
      totalCost: 13500000,
      unitCost: 9000,
      constructionPeriod: 15,
      qualityLevel: 'basic',
      status: 'planning',
      createdAt: '2024-03-10'
    }
  ]

  const mockMetrics: ComparisonMetric[] = [
    {
      name: '总造价',
      unit: '万元',
      projects: {
        '1': 1275,
        '2': 2400,
        '3': 1350
      }
    },
    {
      name: '单位造价',
      unit: '元/㎡',
      projects: {
        '1': 15000,
        '2': 20000,
        '3': 9000
      }
    },
    {
      name: '建筑面积',
      unit: '㎡',
      projects: {
        '1': 8500,
        '2': 12000,
        '3': 15000
      }
    },
    {
      name: '建设周期',
      unit: '月',
      projects: {
        '1': 18,
        '2': 24,
        '3': 15
      }
    }
  ]

  useEffect(() => {
    loadProjects()
    loadComparisonData()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 800))

      let filteredProjects = mockProjects

      if (filters.type !== 'all') {
        filteredProjects = filteredProjects.filter(p => p.type === filters.type)
      }
      if (filters.status !== 'all') {
        filteredProjects = filteredProjects.filter(p => p.status === filters.status)
      }
      if (filters.searchTerm) {
        filteredProjects = filteredProjects.filter(p =>
          p.name.toLowerCase().includes(filters.searchTerm.toLowerCase())
        )
      }

      setProjects(filteredProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadComparisonData = () => {
    // 模拟加载对比数据
    setComparisonData(mockMetrics)
  }

  const handleProjectSelection = (selectedRowKeys: React.Key[]) => {
    setSelectedProjects(selectedRowKeys as string[])
  }

  const handleCreateComparison = () => {
    if (selectedProjects.length < 2) {
      alert('请至少选择两个项目进行对比')
      return
    }
    navigate('/comparisons/analysis', {
      state: { selectedProjects }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'processing'
      case 'planning': return 'warning'
      default: return 'default'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'residential': return 'blue'
      case 'commercial': return 'green'
      case 'industrial': return 'orange'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成'
      case 'in_progress': return '进行中'
      case 'planning': return '规划中'
      default: return '未知'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'residential': return '住宅'
      case 'commercial': return '商业'
      case 'industrial': return '工业'
      default: return '其他'
    }
  }

  const getQualityColor = (level: string) => {
    switch (level) {
      case 'premium': return 'gold'
      case 'standard': return 'blue'
      case 'basic': return 'green'
      default: return 'default'
    }
  }

  const getQualityText = (level: string) => {
    switch (level) {
      case 'premium': return '高端'
      case 'standard': return '标准'
      case 'basic': return '基础'
      default: return '未定义'
    }
  }

  const projectColumns: ColumnsType<ComparisonProject> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={getTypeColor(type)}>{getTypeText(type)}</Tag>
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location'
    },
    {
      title: '建筑面积',
      dataIndex: 'area',
      key: 'area',
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '总造价',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (cost: number) => `¥${(cost / 10000).toFixed(2)}万`
    },
    {
      title: '单位造价',
      dataIndex: 'unitCost',
      key: 'unitCost',
      render: (cost: number) => `¥${cost.toLocaleString()}`
    },
    {
      title: '建设周期',
      dataIndex: 'constructionPeriod',
      key: 'constructionPeriod',
      render: (period: number) => `${period}个月`
    },
    {
      title: '质量等级',
      dataIndex: 'qualityLevel',
      key: 'qualityLevel',
      render: (level: string) => <Tag color={getQualityColor(level)}>{getQualityText(level)}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt'
    }
  ]

  const metricColumns: ColumnsType<ComparisonMetric> = [
    {
      title: '对比指标',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit'
    },
    ...selectedProjects.map((projectId, index) => ({
      title: mockProjects.find(p => p.id === projectId)?.name || `项目${index + 1}`,
      dataIndex: `projects.${projectId}`,
      key: projectId,
      render: (value: string | number) => (
        <span style={{ color: index % 2 === 0 ? '#1890ff' : '#52c41a', fontWeight: 'bold' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      )
    }))
  ]

  return (
    <div className="project-comparison-page">
      {/* 页面标题 */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2}>项目对比分析</Title>
        <Text type="secondary">选择项目进行多维度成本对比分析</Text>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={24} md={16}>
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
                value={filters.type}
                onChange={(value) => setFilters({ ...filters, type: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="all">全部类型</Option>
                <Option value="residential">住宅</Option>
                <Option value="commercial">商业</Option>
                <Option value="industrial">工业</Option>
              </Select>
              <Select
                placeholder="项目状态"
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="all">全部状态</Option>
                <Option value="planning">规划中</Option>
                <Option value="in_progress">进行中</Option>
                <Option value="completed">已完成</Option>
              </Select>
              <RangePicker
                placeholder="选择时间范围"
                onChange={(dates, dateStrings) => {
                  setFilters({ ...filters, dateRange: dates })
                }}
              />
            </Space>
          </Col>
          <Col xs={24} sm={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadProjects}>
                刷新
              </Button>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={handleCreateComparison}
                disabled={selectedProjects.length < 2}
              >
                创建对比 ({selectedProjects.length})
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        {/* 项目选择表格 */}
        <Col xs={24} lg={14}>
          <Card title="项目列表" extra={
            <Text type="secondary">
              已选择 {selectedProjects.length} 个项目
            </Text>
          }>
            <Table
              columns={projectColumns}
              dataSource={projects}
              rowKey="id"
              loading={loading}
              rowSelection={{
                selectedRowKeys: selectedProjects,
                onChange: handleProjectSelection,
                type: 'checkbox'
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Col>

        {/* 对比预览 */}
        <Col xs={24} lg={10}>
          <Card title="对比预览" extra={
            <Space>
              <Button icon={<BarChartOutlined />} size="small">
                图表视图
              </Button>
              <Button icon={<LineChartOutlined />} size="small">
                趋势分析
              </Button>
            </Space>
          }>
            {selectedProjects.length >= 2 ? (
              <div>
                <Alert
                  message={`已选择 ${selectedProjects.length} 个项目进行对比`}
                  type="info"
                  style={{ marginBottom: 16 }}
                  showIcon
                />

                <Table
                  columns={metricColumns}
                  dataSource={comparisonData}
                  pagination={false}
                  size="small"
                  scroll={{ x: 600 }}
                />

                <Divider />

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Space direction="vertical">
                    <Text strong>主要发现：</Text>
                    <Text>• {selectedProjects.length}个项目中，造价差异显著</Text>
                    <Text>• 单位造价范围：¥9,000 - ¥20,000/㎡</Text>
                    <Text>• 建设周期影响：15-24个月</Text>
                  </Space>
                </div>

                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SwapOutlined />}
                    onClick={handleCreateComparison}
                  >
                    详细对比分析
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#999'
              }}>
                <SwapOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <Text>请选择至少2个项目进行对比</Text>
                <Text type="secondary">支持多维度对比分析</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ProjectComparisonPage