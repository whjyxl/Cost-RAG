import React, { useState, useEffect } from 'react'
import {
  Select,
  Card,
  Table,
  Tag,
  Progress,
  Space,
  Typography,
  Button,
  Tooltip,
  Alert,
  Row,
  Col,
  Statistic,
  Rate,
  Divider,
  Badge
} from 'antd'
import {
  ProjectOutlined,
  BarChartOutlined,
  EyeOutlined,
  SelectOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilterOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  ProjectMatch,
  ProjectType,
  QualityLevel
} from '@/types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

interface ProjectReferenceSelectorProps {
  similarProjects: ProjectMatch[]
  selectedProjects: string[]
  onSelectionChange: (selectedIds: string[]) => void
  loading?: boolean
}

interface ProjectWithStats {
  id: string
  name: string
  similarity: number
  unitCost: number
  area: number
  confidenceLevel: number
  projectType: ProjectType
  qualityLevel: QualityLevel
  matchReason: string
}

const ProjectReferenceSelector: React.FC<ProjectReferenceSelectorProps> = ({
  similarProjects,
  selectedProjects,
  onSelectionChange,
  loading = false
}) => {
  const [filterOptions, setFilterOptions] = useState({
    minSimilarity: 0.3,
    projectType: 'all' as ProjectType | 'all',
    qualityLevel: 'all' as QualityLevel | 'all',
    sortBy: 'similarity' as 'similarity' | 'cost' | 'area' | 'confidence'
  })
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithStats[]>([])

  // 将项目数据转换为统计格式
  const projectStats: ProjectWithStats[] = similarProjects.map(match => ({
    id: match.historical_project.id,
    name: match.historical_project.name,
    similarity: match.similarity_result.overall_score,
    unitCost: match.historical_project.project_features.cost_features.unit_cost,
    area: match.historical_project.project_features.basic_features.area,
    confidenceLevel: match.similarity_result.confidence_level,
    projectType: match.historical_project.project_features.basic_features.project_type,
    qualityLevel: match.historical_project.project_features.quality_features.quality_level,
    matchReason: match.similarity_result.explanation
  }))

  // 过滤和排序项目
  useEffect(() => {
    let filtered = projectStats.filter(project => {
      if (project.similarity < filterOptions.minSimilarity) return false
      if (filterOptions.projectType !== 'all' && project.projectType !== filterOptions.projectType) return false
      if (filterOptions.qualityLevel !== 'all' && project.qualityLevel !== filterOptions.qualityLevel) return false
      return true
    })

    // 排序
    filtered.sort((a, b) => {
      switch (filterOptions.sortBy) {
        case 'similarity':
          return b.similarity - a.similarity
        case 'cost':
          return a.unitCost - b.unitCost
        case 'area':
          return Math.abs(b.area - 10000) - Math.abs(a.area - 10000) // 假设标准面积为10000平米
        case 'confidence':
          return b.confidenceLevel - a.confidenceLevel
        default:
          return 0
      }
    })

    setFilteredProjects(filtered)
  }, [projectStats, filterOptions])

  // 计算选中项目的统计信息
  const selectedStats = React.useMemo(() => {
    const selected = filteredProjects.filter(p => selectedProjects.includes(p.id))
    if (selected.length === 0) return null

    const avgSimilarity = selected.reduce((sum, p) => sum + p.similarity, 0) / selected.length
    const avgUnitCost = selected.reduce((sum, p) => sum + p.unitCost, 0) / selected.length
    const avgConfidence = selected.reduce((sum, p) => sum + p.confidenceLevel, 0) / selected.length
    const totalArea = selected.reduce((sum, p) => sum + p.area, 0)

    return {
      count: selected.length,
      avgSimilarity,
      avgUnitCost,
      avgConfidence,
      totalArea
    }
  }, [selectedProjects, filteredProjects])

  const getProjectTypeColor = (type: ProjectType) => {
    const colors = {
      [ProjectType.RESIDENTIAL]: 'blue',
      [ProjectType.COMMERCIAL]: 'green',
      [ProjectType.INDUSTRIAL]: 'orange',
      [ProjectType.PUBLIC]: 'purple',
      [ProjectType.MIXED]: 'cyan'
    }
    return colors[type] || 'default'
  }

  const getProjectTypeText = (type: ProjectType) => {
    const texts = {
      [ProjectType.RESIDENTIAL]: '住宅',
      [ProjectType.COMMERCIAL]: '商业',
      [ProjectType.INDUSTRIAL]: '工业',
      [ProjectType.PUBLIC]: '公共',
      [ProjectType.MIXED]: '混合'
    }
    return texts[type] || '其他'
  }

  const getQualityColor = (level: QualityLevel) => {
    const colors = {
      [QualityLevel.BASIC]: 'green',
      [QualityLevel.STANDARD]: 'blue',
      [QualityLevel.PREMIUM]: 'gold'
    }
    return colors[level] || 'default'
  }

  const getQualityText = (level: QualityLevel) => {
    const texts = {
      [QualityLevel.BASIC]: '基础',
      [QualityLevel.STANDARD]: '标准',
      [QualityLevel.PREMIUM]: '高端'
    }
    return texts[level] || '未知'
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return '#52c41a'
    if (score >= 0.6) return '#faad14'
    return '#ff4d4f'
  }

  const getConfidenceColor = (level: number) => {
    if (level >= 0.85) return '#52c41a'
    if (level >= 0.7) return '#faad14'
    return '#ff4d4f'
  }

  const columns: ColumnsType<ProjectWithStats> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: ProjectWithStats) => (
        <Space direction="vertical" size="small">
          <Space>
            <Text strong style={{ fontSize: '14px' }}>{text}</Text>
            {selectedProjects.includes(record.id) && (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.matchReason.length > 30
              ? `${record.matchReason.slice(0, 30)}...`
              : record.matchReason}
          </Text>
        </Space>
      )
    },
    {
      title: '项目信息',
      key: 'project_info',
      width: 150,
      render: (_, record: ProjectWithStats) => (
        <Space direction="vertical" size="small">
          <Tag color={getProjectTypeColor(record.projectType)}>
            {getProjectTypeText(record.projectType)}
          </Tag>
          <Tag color={getQualityColor(record.qualityLevel)}>
            {getQualityText(record.qualityLevel)}
          </Tag>
          <Text style={{ fontSize: '12px' }}>
            {record.area.toLocaleString()} ㎡
          </Text>
        </Space>
      )
    },
    {
      title: '相似度',
      dataIndex: 'similarity',
      key: 'similarity',
      width: 120,
      sorter: true,
      render: (similarity: number) => (
        <Space direction="vertical" size="small">
          <Progress
            percent={similarity * 100}
            size="small"
            strokeColor={getSimilarityColor(similarity)}
            showInfo={false}
          />
          <Text style={{ fontSize: '12px', color: getSimilarityColor(similarity) }}>
            {(similarity * 100).toFixed(1)}%
          </Text>
        </Space>
      )
    },
    {
      title: '单位造价',
      dataIndex: 'unitCost',
      key: 'unitCost',
      width: 120,
      sorter: true,
      render: (cost: number) => (
        <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
          ¥{cost.toLocaleString()}/㎡
        </Text>
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidenceLevel',
      key: 'confidenceLevel',
      width: 100,
      render: (level: number) => (
        <Space direction="vertical" size="small">
          <Progress
            percent={level * 100}
            size="small"
            strokeColor={getConfidenceColor(level)}
            showInfo={false}
          />
          <Text style={{ fontSize: '12px', color: getConfidenceColor(level) }}>
            {(level * 100).toFixed(1)}%
          </Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record: ProjectWithStats) => (
        <Space>
          <Tooltip title={selectedProjects.includes(record.id) ? "取消选择" : "选择项目"}>
            <Button
              type={selectedProjects.includes(record.id) ? "primary" : "default"}
              size="small"
              icon={<SelectOutlined />}
              onClick={() => {
                const newSelection = selectedProjects.includes(record.id)
                  ? selectedProjects.filter(id => id !== record.id)
                  : [...selectedProjects, record.id]
                onSelectionChange(newSelection)
              }}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  const handleBatchSelect = (type: 'high' | 'all' | 'clear') => {
    switch (type) {
      case 'high':
        const highSimilarity = filteredProjects
          .filter(p => p.similarity >= 0.8)
          .map(p => p.id)
        onSelectionChange(highSimilarity)
        break
      case 'all':
        onSelectionChange(filteredProjects.map(p => p.id))
        break
      case 'clear':
        onSelectionChange([])
        break
    }
  }

  return (
    <div className="project-reference-selector">
      {/* 过滤器面板 */}
      <Card
        title={
          <Space>
            <FilterOutlined />
            <span>筛选条件</span>
            <Badge count={filteredProjects.length} />
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: '12px' }}>最低相似度</Text>
              <Select
                value={filterOptions.minSimilarity}
                onChange={(value) => setFilterOptions(prev => ({ ...prev, minSimilarity: value }))}
                style={{ width: '100%' }}
                size="small"
              >
                <Option value={0.3}>30% (低)</Option>
                <Option value={0.5}>50% (中)</Option>
                <Option value={0.7}>70% (高)</Option>
                <Option value={0.8}>80% (很高)</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: '12px' }}>项目类型</Text>
              <Select
                value={filterOptions.projectType}
                onChange={(value) => setFilterOptions(prev => ({ ...prev, projectType: value }))}
                style={{ width: '100%' }}
                size="small"
              >
                <Option value="all">全部类型</Option>
                <Option value={ProjectType.RESIDENTIAL}>住宅</Option>
                <Option value={ProjectType.COMMERCIAL}>商业</Option>
                <Option value={ProjectType.INDUSTRIAL}>工业</Option>
                <Option value={ProjectType.PUBLIC}>公共</Option>
                <Option value={ProjectType.MIXED}>混合</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: '12px' }}>质量等级</Text>
              <Select
                value={filterOptions.qualityLevel}
                onChange={(value) => setFilterOptions(prev => ({ ...prev, qualityLevel: value }))}
                style={{ width: '100%' }}
                size="small"
              >
                <Option value="all">全部等级</Option>
                <Option value={QualityLevel.BASIC}>基础</Option>
                <Option value={QualityLevel.STANDARD}>标准</Option>
                <Option value={QualityLevel.PREMIUM}>高端</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: '12px' }}>排序方式</Text>
              <Select
                value={filterOptions.sortBy}
                onChange={(value) => setFilterOptions(prev => ({ ...prev, sortBy: value }))}
                style={{ width: '100%' }}
                size="small"
              >
                <Option value="similarity">相似度优先</Option>
                <Option value="cost">造价优先</Option>
                <Option value="area">面积优先</Option>
                <Option value="confidence">置信度优先</Option>
              </Select>
            </Space>
          </Col>
        </Row>

        {/* 快速选择按钮 */}
        <Divider style={{ margin: '12px 0' }} />
        <Space wrap>
          <Button
            size="small"
            onClick={() => handleBatchSelect('high')}
            disabled={filteredProjects.filter(p => p.similarity >= 0.8).length === 0}
          >
            选择高相似度项目
          </Button>
          <Button
            size="small"
            onClick={() => handleBatchSelect('all')}
            disabled={filteredProjects.length === 0}
          >
            选择全部
          </Button>
          <Button
            size="small"
            onClick={() => handleBatchSelect('clear')}
            disabled={selectedProjects.length === 0}
          >
            清空选择
          </Button>
        </Space>
      </Card>

      {/* 选中项目统计 */}
      {selectedStats && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>已选择项目统计</span>
              <Badge count={selectedStats.count} />
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均相似度"
                value={selectedStats.avgSimilarity * 100}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#1890ff', fontSize: '16px' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均单位造价"
                value={selectedStats.avgUnitCost}
                prefix="¥"
                suffix="/㎡"
                precision={0}
                valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均置信度"
                value={selectedStats.avgConfidence * 100}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="总面积"
                value={selectedStats.totalArea}
                suffix="㎡"
                precision={0}
                valueStyle={{ color: '#722ed1', fontSize: '16px' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 项目列表 */}
      <Card
        title={
          <Space>
            <ProjectOutlined />
            <span>相似项目列表</span>
            <Badge count={filteredProjects.length} />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredProjects}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个项目`
          }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 使用提示 */}
      <Alert
        message="使用提示"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>系统已根据您的项目特征自动匹配相似的历史项目</li>
            <li>您可以使用过滤器筛选符合特定条件的参考项目</li>
            <li>建议选择相似度较高（&gt;80%）且置信度高的项目作为参考</li>
            <li>选中的项目将用于生成更准确的估算建议</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  )
}

export default ProjectReferenceSelector