import React, { useState, useEffect } from 'react'
import { Typography, Card, Row, Col, Button, Table, Tag, Spin, Space, Select, Input, Alert, Divider, message } from 'antd'
import { SwapOutlined, ReloadOutlined, BarChartOutlined, LineChartOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useGetTemplatesQuery } from '@/store/api/templatesApi'
import type { ProjectTemplate } from '@/store/api/templatesApi'
import './Estimates.css'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select

interface ComparisonProject {
  id: number
  name: string
  type: string
  location: string
  area: number
  totalCost: number
  unitCost: number
  floors: string
  qualityLevel: string
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
  const [searchParams] = useSearchParams()
  const [selectedProjects, setSelectedProjects] = useState<React.Key[]>([])
  const [filters, setFilters] = useState({
    project_type: undefined as string | undefined,
    searchTerm: ''
  })

  // 从URL参数获取预选项目IDs
  useEffect(() => {
    const projectIds = searchParams.get('project_ids')
    if (projectIds) {
      const ids = projectIds.split(',').map(id => parseInt(id))
      setSelectedProjects(ids)
    }
  }, [searchParams])

  // 获取项目模板数据
  const { data: templatesData, isLoading, refetch } = useGetTemplatesQuery({
    page: 1,
    size: 100,
    is_enabled: true,
    project_type: filters.project_type
  })

  // 将ProjectTemplate转换为ComparisonProject
  const projects: ComparisonProject[] = (templatesData?.templates || []).map(template => ({
    id: template.id,
    name: template.name,
    type: template.project_type || '未分类',
    location: '未指定', // ProjectTemplate没有location字段，可以后续添加
    area: template.area,
    totalCost: template.total_cost || 0,
    unitCost: template.unit_cost || 0,
    floors: template.floors || '未知',
    qualityLevel: '标准', // ProjectTemplate没有quality_level，可以后续添加
    createdAt: new Date(template.created_at).toLocaleDateString('zh-CN')
  }))

  // 根据搜索词过滤
  const filteredProjects = projects.filter(p =>
    !filters.searchTerm || p.name.toLowerCase().includes(filters.searchTerm.toLowerCase())
  )

  // 计算对比指标
  const comparisonData: ComparisonMetric[] = selectedProjects.length >= 2 ? [
    {
      name: '总造价',
      unit: '万元',
      projects: Object.fromEntries(
        selectedProjects.map(id => {
          const project = projects.find(p => p.id === id)
          return [String(id), project ? (project.totalCost / 10000).toFixed(2) : 0]
        })
      )
    },
    {
      name: '单位造价',
      unit: '元/㎡',
      projects: Object.fromEntries(
        selectedProjects.map(id => {
          const project = projects.find(p => p.id === id)
          return [String(id), project ? project.unitCost.toFixed(2) : 0]
        })
      )
    },
    {
      name: '建筑面积',
      unit: '㎡',
      projects: Object.fromEntries(
        selectedProjects.map(id => {
          const project = projects.find(p => p.id === id)
          return [String(id), project ? project.area.toLocaleString() : 0]
        })
      )
    },
    {
      name: '层数',
      unit: '',
      projects: Object.fromEntries(
        selectedProjects.map(id => {
          const project = projects.find(p => p.id === id)
          return [String(id), project ? project.floors : '未知']
        })
      )
    }
  ] : []

  const handleProjectSelection = (selectedRowKeys: React.Key[]) => {
    setSelectedProjects(selectedRowKeys)
  }

  const handleCreateComparison = () => {
    if (selectedProjects.length < 2) {
      message.warning('请至少选择两个项目进行对比')
      return
    }
    // 可以跳转到详细对比分析页面
    message.success(`准备对比 ${selectedProjects.length} 个项目`)
  }

  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      '住宅': 'blue',
      'residential': 'blue',
      '商业': 'green',
      'commercial': 'green',
      '工业': 'orange',
      'industrial': 'orange',
      '公共建筑': 'purple',
      'public': 'purple'
    }
    return colorMap[type] || 'default'
  }

  const projectColumns: ColumnsType<ComparisonProject> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type || '未分类'}</Tag>
    },
    {
      title: '建筑面积',
      dataIndex: 'area',
      key: 'area',
      width: 120,
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '总造价',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 120,
      render: (cost: number) => cost ? `¥${(cost / 10000).toFixed(2)}万` : '-'
    },
    {
      title: '单位造价',
      dataIndex: 'unitCost',
      key: 'unitCost',
      width: 120,
      render: (cost: number) => cost ? `¥${cost.toLocaleString()}` : '-'
    },
    {
      title: '层数',
      dataIndex: 'floors',
      key: 'floors',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120
    }
  ]

  const metricColumns: ColumnsType<ComparisonMetric> = [
    {
      title: '对比指标',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      fixed: 'left'
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80
    },
    ...selectedProjects.map((projectId, index) => {
      const project = projects.find(p => p.id === projectId)
      return {
        title: project?.name || `项目${index + 1}`,
        dataIndex: ['projects', String(projectId)],
        key: String(projectId),
        width: 150,
        render: (value: string | number) => (
          <span style={{
            color: index % 3 === 0 ? '#1890ff' : index % 3 === 1 ? '#52c41a' : '#fa8c16',
            fontWeight: 'bold'
          }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        )
      }
    })
  ]

  // 计算统计信息
  const calculateStats = () => {
    if (selectedProjects.length < 2) return null

    const selectedProjectsData = selectedProjects
      .map(id => projects.find(p => p.id === id))
      .filter(p => p !== undefined) as ComparisonProject[]

    const unitCosts = selectedProjectsData.map(p => p.unitCost).filter(c => c > 0)
    if (unitCosts.length === 0) return null

    const minUnitCost = Math.min(...unitCosts)
    const maxUnitCost = Math.max(...unitCosts)
    const avgArea = selectedProjectsData.reduce((sum, p) => sum + p.area, 0) / selectedProjectsData.length

    return {
      minUnitCost,
      maxUnitCost,
      avgArea,
      count: selectedProjectsData.length
    }
  }

  const stats = calculateStats()

  return (
    <div className="project-comparison-page">
      {/* 页面标题 */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2} className="estimates-title">项目对比分析</Title>
        <Text type="secondary">选择历史项目进行多维度成本对比分析</Text>
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
                value={filters.project_type}
                onChange={(value) => setFilters({ ...filters, project_type: value })}
                style={{ width: 140 }}
                allowClear
              >
                <Option value="">全部类型</Option>
                <Option value="residential">住宅</Option>
                <Option value="commercial">商业</Option>
                <Option value="industrial">工业</Option>
                <Option value="public">公共建筑</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                刷新
              </Button>
              <Button
                icon={<SwapOutlined />}
                type="primary"
                onClick={handleCreateComparison}
                disabled={selectedProjects.length < 2}
              >
                开始对比 ({selectedProjects.length})
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        {/* 项目选择表格 */}
        <Col xs={24} lg={14}>
          <Card
            title="项目列表"
            extra={
              <Text type="secondary">
                已选择 {selectedProjects.length} / {filteredProjects.length} 个项目
              </Text>
            }
          >
            <Table
              columns={projectColumns}
              dataSource={filteredProjects}
              rowKey="id"
              loading={isLoading}
              rowSelection={{
                selectedRowKeys: selectedProjects,
                onChange: handleProjectSelection,
                type: 'checkbox'
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 个项目`
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>

        {/* 对比预览 */}
        <Col xs={24} lg={10}>
          <Card
            title="对比预览"
            extra={
              <Space>
                <Button icon={<BarChartOutlined />} size="small" disabled={selectedProjects.length < 2}>
                  图表视图
                </Button>
                <Button icon={<LineChartOutlined />} size="small" disabled={selectedProjects.length < 2}>
                  趋势分析
                </Button>
              </Space>
            }
          >
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
                  scroll={{ x: 400 }}
                />

                <Divider />

                {stats && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Space direction="vertical">
                      <Text strong>主要发现：</Text>
                      <Text>• {stats.count}个项目中，造价差异显著</Text>
                      <Text>• 单位造价范围：¥{stats.minUnitCost.toLocaleString()} - ¥{stats.maxUnitCost.toLocaleString()}/㎡</Text>
                      <Text>• 平均建筑面积：{stats.avgArea.toLocaleString()} ㎡</Text>
                    </Space>
                  </div>
                )}

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
