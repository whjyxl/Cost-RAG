import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Avatar,
  Spin,
  Empty,
  message,
  Badge,
  Tooltip,
  Switch,
  Divider,
  Rate,
  Statistic,
  Alert
} from 'antd'
import {
  SearchOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  BuildingOutlined,
  CalendarOutlined,
  FilterOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  BulbOutlined
} from '@ant-design/icons'
import type { SelectProps } from 'antd'

import {
  ProjectMatch,
  ProjectType,
  QualityLevel,
  HistoricalProject,
  SimilarProjectRequest
} from '@/types'
import { useLazyFindSimilarProjectsQuery } from '@/store/api/estimatesApi'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { Option } = Select

interface ProjectTemplateSelectorProps {
  onTemplateSelect: (template: HistoricalProject) => void
  currentFormData?: Partial<SimilarProjectRequest>
  disabled?: boolean
  maxTemplates?: number
  showAdvancedFilters?: boolean
}

// 模板数据到表单字段的映射
const TEMPLATE_FIELD_MAPPING: Record<string, keyof HistoricalProject> = {
  project_name: 'project_name',
  project_type: 'project_type',
  building_type: 'building_type',
  structure_type: 'structure_type',
  area: 'area',
  location: 'location',
  floors: 'floors',
  year_built: 'year_built',
  construction_period: 'construction_period',
  quality_level: 'quality_level',
  construction_standard: 'construction_standard',
  design_standard: 'design_standard',
  total_cost: 'total_cost',
  unit_cost: 'unit_cost'
}

const ProjectTemplateSelector: React.FC<ProjectTemplateSelectorProps> = ({
  onTemplateSelect,
  currentFormData = {},
  disabled = false,
  maxTemplates = 8,
  showAdvancedFilters = false
}) => {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<HistoricalProject[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    projectType: undefined as ProjectType | undefined,
    qualityLevel: undefined as QualityLevel | undefined,
    minArea: undefined as number | undefined,
    maxArea: undefined as number | undefined,
    similarityThreshold: 0.6
  })
  const [showFilters, setShowFilters] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const [findSimilarProjects] = useLazyFindSimilarProjectsQuery()

  // 获取项目类型选项
  const projectTypeOptions: SelectProps['options'] = [
    { label: '住宅项目', value: 'residential' },
    { label: '商业项目', value: 'commercial' },
    { label: '工业项目', value: 'industrial' },
    { label: '公共建筑', value: 'public' },
    { label: '基础设施', value: 'infrastructure' },
    { label: '其他项目', value: 'other' }
  ]

  // 获取质量等级选项
  const qualityLevelOptions: SelectProps['options'] = [
    { label: '优质', value: 'excellent' },
    { label: '良好', value: 'good' },
    { label: '标准', value: 'standard' },
    { label: '合格', value: 'qualified' }
  ]

  // 加载模板数据
  useEffect(() => {
    loadTemplates()
  }, [currentFormData, filters])

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const timer = setTimeout(() => {
        loadTemplates()
      }, 30000) // 30秒自动刷新
      return () => clearTimeout(timer)
    }
  }, [autoRefresh, currentFormData, filters])

  const loadTemplates = async () => {
    if (disabled) return

    setLoading(true)
    try {
      // 构建搜索请求，使用当前表单数据作为偏好
      const request: SimilarProjectRequest = {
        ...currentFormData,
        // 设置默认权重，优先匹配基本信息
        weights: {
          basic_weight: 0.5,
          cost_weight: 0.2,
          quality_weight: 0.2,
          location_weight: 0.05,
          temporal_weight: 0.05
        },
        limit: maxTemplates,
        include_inactive: false
      }

      const response = await findSimilarProjects(request)

      if (response.success && response.data) {
        // 将ProjectMatch转换为HistoricalProject
        const historicalProjects: HistoricalProject[] = response.data.items.map((match: ProjectMatch) => ({
          id: match.id,
          project_name: match.project_name,
          project_type: match.project_type,
          building_type: match.building_type,
          structure_type: match.structure_type,
          area: match.area,
          location: match.location,
          floors: match.floors,
          year_built: match.year_built,
          construction_period: match.construction_period,
          quality_level: match.quality_level,
          construction_standard: match.construction_standard,
          design_standard: match.design_standard,
          total_cost: match.total_cost,
          unit_cost: match.unit_cost,
          completion_date: match.completion_date,
          created_at: match.created_at,
          updated_at: match.updated_at,
          features: match.features || {},
          similarity_score: match.similarity_score,
          confidence_level: match.confidence_level
        }))

        // 应用过滤器
        const filteredTemplates = applyFilters(historicalProjects)
        setTemplates(filteredTemplates)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      message.error('加载模板数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 应用过滤器
  const applyFilters = (projects: HistoricalProject[]): HistoricalProject[] => {
    return projects.filter(project => {
      // 项目类型过滤
      if (filters.projectType && project.project_type !== filters.projectType) {
        return false
      }

      // 质量等级过滤
      if (filters.qualityLevel && project.quality_level !== filters.qualityLevel) {
        return false
      }

      // 面积范围过滤
      if (filters.minArea && project.area < filters.minArea) {
        return false
      }
      if (filters.maxArea && project.area > filters.maxArea) {
        return false
      }

      // 相似度阈值过滤
      if (project.similarity_score && project.similarity_score < filters.similarityThreshold) {
        return false
      }

      return true
    }).slice(0, maxTemplates)
  }

  // 处理模板选择
  const handleTemplateSelect = (template: HistoricalProject) => {
    setSelectedTemplateId(template.id)
    onTemplateSelect(template)
    message.success(`已选择模板: ${template.project_name}`)
  }

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchQuery(value)

    if (!value.trim()) {
      loadTemplates()
      return
    }

    const filtered = templates.filter(template =>
      template.project_name.toLowerCase().includes(value.toLowerCase()) ||
      template.building_type?.toLowerCase().includes(value.toLowerCase()) ||
      template.location?.toLowerCase().includes(value.toLowerCase())
    )
    setTemplates(filtered)
  }

  // 渲染模板卡片
  const renderTemplateCard = (template: HistoricalProject) => {
    const isSelected = selectedTemplateId === template.id
    const similarity = template.similarity_score || 0

    return (
      <Col key={template.id} xs={24} sm={12} lg={8} xl={6}>
        <Card
          hoverable={!disabled}
          size="small"
          className={`template-card ${isSelected ? 'selected' : ''}`}
          style={{
            border: isSelected ? '2px solid #1890ff' : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={() => !disabled && handleTemplateSelect(template)}
          actions={[
            <Button
              type={isSelected ? 'primary' : 'default'}
              size="small"
              icon={isSelected ? <CheckCircleOutlined /> : <CopyOutlined />}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                handleTemplateSelect(template)
              }}
            >
              {isSelected ? '已选择' : '应用模板'}
            </Button>
          ]}
        >
          <Card.Meta
            avatar={
              <Avatar
                size="small"
                style={{
                  backgroundColor: getProjectTypeColor(template.project_type),
                  fontSize: '12px'
                }}
              >
                {getProjectTypeIcon(template.project_type)}
              </Avatar>
            }
            title={
              <div style={{ maxWidth: '100%' }}>
                <Tooltip title={template.project_name}>
                  <Text strong ellipsis>
                    {template.project_name}
                  </Text>
                </Tooltip>
              </div>
            }
            description={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {/* 项目基本信息 */}
                <div>
                  <Tag color="blue" size="small">{template.project_type}</Tag>
                  {template.building_type && (
                    <Tag color="green" size="small">{template.building_type}</Tag>
                  )}
                </div>

                {/* 关键指标 */}
                <Row gutter={8}>
                  <Col span={12}>
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>面积</Text>
                      <Text strong style={{ fontSize: '12px' }}>
                        {template.area?.toLocaleString()} m²
                      </Text>
                    </Space>
                  </Col>
                  <Col span={12}>
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>层数</Text>
                      <Text strong style={{ fontSize: '12px' }}>
                        {template.floors || '-'}
                      </Text>
                    </Space>
                  </Col>
                </Row>

                {/* 相似度和质量 */}
                <Row gutter={8}>
                  <Col span={12}>
                    <Space>
                      <Text type="secondary" style={{ fontSize: '11px' }}>相似度</Text>
                      <Tag
                        color={getSimilarityColor(similarity)}
                        size="small"
                      >
                        {(similarity * 100).toFixed(0)}%
                      </Tag>
                    </Space>
                  </Col>
                  <Col span={12}>
                    <Space>
                      <Text type="secondary" style={{ fontSize: '11px' }}>质量</Text>
                      <Tag color="purple" size="small">
                        {getQualityLevelText(template.quality_level)}
                      </Tag>
                    </Space>
                  </Col>
                </Row>

                {/* 建设信息 */}
                <div>
                  <Space size="small" wrap>
                    {template.location && (
                      <Tag icon={<EnvironmentOutlined />} size="small">
                        {template.location}
                      </Tag>
                    )}
                    {template.year_built && (
                      <Tag icon={<CalendarOutlined />} size="small">
                        {template.year_built}年
                      </Tag>
                    )}
                  </Space>
                </div>

                {/* 相似度指示器 */}
                {similarity > 0 && (
                  <Progress
                    percent={similarity * 100}
                    size="small"
                    strokeColor={getSimilarityColor(similarity)}
                    showInfo={false}
                    style={{ marginTop: 4 }}
                  />
                )}
              </Space>
            }
          />
        </Card>
      </Col>
    )
  }

  // 获取项目类型颜色
  const getProjectTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      residential: '#52c41a',
      commercial: '#1890ff',
      industrial: '#fa8c16',
      public: '#722ed1',
      infrastructure: '#13c2c2',
      other: '#8c8c8c'
    }
    return colors[type] || '#8c8c8c'
  }

  // 获取项目类型图标
  const getProjectTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      residential: '住',
      commercial: '商',
      industrial: '工',
      public: '公',
      infrastructure: '基',
      other: '其'
    }
    return icons[type] || '项'
  }

  // 获取相似度颜色
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.8) return '#52c41a'
    if (similarity >= 0.6) return '#faad14'
    return '#ff4d4f'
  }

  // 获取质量等级文本
  const getQualityLevelText = (level?: string): string => {
    const texts: Record<string, string> = {
      excellent: '优质',
      good: '良好',
      standard: '标准',
      qualified: '合格'
    }
    return texts[level || 'unknown'] || '未知'
  }

  // 渲染过滤器
  const renderFilters = () => (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} align="middle">
        <Col span={6}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>项目类型</Text>
            <Select
              placeholder="全部类型"
              allowClear
              value={filters.projectType}
              onChange={(value) => setFilters(prev => ({ ...prev, projectType: value }))}
              style={{ width: '100%' }}
              size="small"
            >
              {projectTypeOptions}
            </Select>
          </Space>
        </Col>
        <Col span={6}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>质量等级</Text>
            <Select
              placeholder="全部等级"
              allowClear
              value={filters.qualityLevel}
              onChange={(value) => setFilters(prev => ({ ...prev, qualityLevel: value }))}
              style={{ width: '100%' }}
              size="small"
            >
              {qualityLevelOptions}
            </Select>
          </Space>
        </Col>
        <Col span={6}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>面积范围 (m²)</Text>
          <Input.Group compact size="small">
            <InputNumber
              style={{ width: '50%' }}
              placeholder="最小"
              min={0}
              value={filters.minArea}
              onChange={(value) => setFilters(prev => ({ ...prev, minArea: value }))}
            />
            <InputNumber
              style={{ width: '50%' }}
              placeholder="最大"
              min={0}
              value={filters.maxArea}
              onChange={(value) => setFilters(prev => ({ ...prev, maxArea: value }))}
            />
          </Input.Group>
        </Space>
        </Col>
        <Col span={6}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>相似度阈值</Text>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={1}
            step={0.1}
            value={filters.similarityThreshold}
            onChange={(value) => setFilters(prev => ({ ...prev, similarityThreshold: value }))}
            size="small"
            formatter={(value) => `${value}`}
            parser={(value) => parseFloat(value!)}
          />
        </Space>
        </Col>
      </Row>
    </Card>
  )

  return (
    <div className="project-template-selector">
      {/* 头部操作栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              <BulbOutlined /> 选择项目模板
            </Title>
            <Text type="secondary">
              快速选择相似项目模板，自动填充基本信息
            </Text>
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="自动刷新">
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                size="small"
              />
            </Tooltip>
            <Tooltip title={showFilters ? '隐藏筛选器' : '显示筛选器'}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                size="small"
              />
            </Tooltip>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadTemplates}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 使用提示 */}
      <Alert
        message="模板选择提示"
        description={
          <div>
            <div>• 选择模板后，系统会自动填充项目基本信息到表单中</div>
            <div>• 您可以根据需要修改模板填充的内容</div>
            <div>• 建议选择相似度高于80%的模板以获得更好的匹配效果</div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 搜索栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索项目名称、建筑类型或地点..."
          allowClear
          onSearch={handleSearch}
          onChange={(e) => setSearchQuery(e.target.value)}
          loading={loading}
          style={{ width: '100%' }}
        />
      </Card>

      {/* 过滤器 */}
      {showFilters && renderFilters()}

      {/* 模板列表 */}
      <Spin spinning={loading}>
        {templates.length > 0 ? (
          <>
            <Row gutter={[16, 16]}>
              {templates.map(renderTemplateCard)}
            </Row>

            {/* 统计信息 */}
            <Divider />
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="可用模板"
                    value={templates.length}
                    prefix={<ThunderboltOutlined />}
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="高相似度模板"
                    value={templates.filter(t => (t.similarity_score || 0) >= 0.8).length}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="最新更新"
                    value={templates.length > 0 ? '刚刚' : '-'}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="自动刷新"
                    value={autoRefresh ? '开启' : '关闭'}
                    prefix={<ReloadOutlined />}
                    valueStyle={{ fontSize: '16px', color: autoRefresh ? '#52c41a' : '#8c8c8c' }}
                  />
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <Empty
            description={searchQuery ? "未找到匹配的模板" : "暂无可用模板"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Spin>
    </div>
  )
}

export default ProjectTemplateSelector