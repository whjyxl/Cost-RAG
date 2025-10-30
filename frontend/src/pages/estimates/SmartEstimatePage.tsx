import React, { useState, useEffect } from 'react'
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Steps,
  Space,
  Alert,
  Spin,
  message,
  Table,
  Tag,
  Progress,
  Statistic,
  Collapse,
  Divider,
  Tabs,
  Modal,
  Checkbox,
  Rate
} from 'antd'
import {
  RobotOutlined,
  SearchOutlined,
  HistoryOutlined,
  BulbOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CalculatorOutlined,
  SettingOutlined,
  SelectOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  ProjectFeatures,
  BasicFeatures,
  CostFeatures,
  QualityFeatures,
  SimilarProjectRequest,
  ProjectMatch,
  EstimateSuggestion,
  ProjectType,
  QualityLevel,
  MatchWeights,
  HistoricalProject
} from '@/types'
import { SimilarityEngine } from '@/utils/similarityEngine'
import { useLazyFindSimilarProjectsQuery } from '@/store/api/estimatesApi'
import ProjectReferenceSelector from '@/components/estimates/ProjectReferenceSelector'
import ProjectTemplateSelector from '@/components/estimates/ProjectTemplateSelector'

const { Title, Text, Paragraph } = Typography
const { Step } = Steps
const { RangePicker } = DatePicker
const { Panel } = Collapse
const { TabPane } = Tabs

const SmartEstimatePage: React.FC = () => {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [projectFeatures, setProjectFeatures] = useState<ProjectFeatures | null>(null)
  const [similarProjects, setSimilarProjects] = useState<ProjectMatch[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [matchWeights, setMatchWeights] = useState<MatchWeights>({
    basic_weight: 0.3,
    cost_weight: 0.4,
    quality_weight: 0.2,
    location_weight: 0.05,
    temporal_weight: 0.05
  })

  // 模板相关状态
  const [selectedTemplate, setSelectedTemplate] = useState<HistoricalProject | null>(null)
  const [templateApplied, setTemplateApplied] = useState(false)

  const [findSimilarProjects] = useLazyFindSimilarProjectsQuery() // 修复JSX语法错误

  const steps = [
    {
      title: '输入项目信息',
      description: '填写项目基本信息，选择历史项目模板',
      icon: <DatabaseOutlined />
    },
    {
      title: '查看建议',
      description: '基于历史数据生成估算建议',
      icon: <BulbOutlined />
    }
  ]

  useEffect(() => {
    console.log('智能估算页面初始化')
  }, [])

  // 处理模板选择
  const handleTemplateSelect = (template: HistoricalProject) => {
    setSelectedTemplate(template)
    setTemplateApplied(true)

    // 将模板数据自动填充到表单中
    const formData = {
      project_name: template.project_name,
      project_type: template.project_type,
      building_type: template.building_type,
      structure_type: template.structure_type,
      area: template.area,
      location: template.location,
      floors: template.floors,
      construction_year: template.year_built ? { year: () => template.year_built! } : undefined,
      construction_period: template.construction_period,
      quality_level: template.quality_level,
      construction_standard: template.construction_standard,
      design_standard: template.design_standard,
      unit_cost: template.unit_cost
    }

    form.setFieldsValue(formData)
    message.success(`已应用模板: ${template.project_name}`)
  }

  const handleNext = async () => {
    if (currentStep === 0) {
      // 验证表单
      try {
        const values = await form.validateFields()
        const features: ProjectFeatures = {
          basic_features: {
            project_type: values.project_type,
            building_type: values.building_type,
            structure_type: values.structure_type,
            area: values.area,
            location: values.location,
            floors: values.floors,
            year_built: values.construction_year?.year(),
            construction_period: values.construction_period,
            design_standard: values.design_standard
          },
          cost_features: {
            total_cost: 0, // 将在后续步骤中计算
            unit_cost: values.unit_cost || 0,
            material_costs: [],
            labor_costs: [],
            equipment_costs: [],
            overhead_costs: [],
            other_costs: [],
            cost_year: new Date().getFullYear(),
            currency: 'CNY'
          },
          quality_features: {
            quality_level: values.quality_level,
            construction_standard: values.construction_standard,
            technical_specifications: [],
            material_grades: [],
            quality_scores: []
          }
        }

        setProjectFeatures(features)
        // 搜索相似项目并跳转到查看建议步骤
        await searchSimilarProjects()
        setCurrentStep(1)
      } catch (error) {
        message.error('请填写完整的项目信息')
      }
    } else if (currentStep === 1) {
      // 完成估算
      message.success('智能估算完成！')
      // 这里可以保存估算结果或跳转到估算详情页
    }
  }

  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
  }

  const searchSimilarProjects = async () => {
    if (!projectFeatures) return

    setLoading(true)
    try {
      const request: SimilarProjectRequest = {
        project_features: projectFeatures,
        max_results: 10,
        min_similarity_score: 0.3,
        match_weights: matchWeights
      }

      // 使用模拟数据进行演示
      const mockMatches: ProjectMatch[] = [
        {
          historical_project: {
            id: '1',
            name: '阳光花园住宅项目',
            source: 'excel_upload',
            project_features: {
              basic_features: {
                project_type: projectFeatures.basic_features.project_type,
                building_type: '高层住宅',
                structure_type: '框架结构',
                area: projectFeatures.basic_features.area * (0.9 + Math.random() * 0.2),
                location: projectFeatures.basic_features.location,
                floors: projectFeatures.basic_features.floors,
                construction_period: 18,
                design_standard: 'GB50000-2013'
              },
              cost_features: {
                total_cost: 0,
                unit_cost: projectFeatures.cost_features.unit_cost * (0.8 + Math.random() * 0.4),
                material_costs: [],
                labor_costs: [],
                equipment_costs: [],
                overhead_costs: [],
                other_costs: [],
                cost_year: 2023,
                currency: 'CNY'
              },
              quality_features: {
                quality_level: projectFeatures.quality_features.quality_level,
                construction_standard: 'GB50300-2015',
                technical_specifications: [],
                material_grades: [],
                quality_scores: []
              }
            },
            similarity_result: {
              overall_score: 0.85 + Math.random() * 0.1,
              basic_similarity: 0.8 + Math.random() * 0.15,
              cost_similarity: 0.85 + Math.random() * 0.1,
              quality_similarity: 0.9 + Math.random() * 0.1,
              location_similarity: 0.95,
              temporal_similarity: 0.8,
              match_factors: [],
              confidence_level: 0.85,
              explanation: '项目特征高度匹配，适合作为参考'
            },
            cost_estimates: [
              {
                cost_category: '土建工程',
                suggested_unit_cost: projectFeatures.cost_features.unit_cost * (0.95 + Math.random() * 0.1),
                confidence_interval: {
                  lower_bound: projectFeatures.cost_features.unit_cost * 0.9,
                  upper_bound: projectFeatures.cost_features.unit_cost * 1.1,
                  confidence_level: 0.85
                },
                supporting_projects: ['阳光花园住宅项目'],
                adjustment_factors: [],
                rationale: '基于相似项目的历史数据调整得出'
              }
            ],
            applicable_factors: []
          }
        },
        {
          historical_project: {
            id: '2',
            name: '商业中心改造项目',
            source: 'manual_entry',
            project_features: {
              basic_features: {
                project_type: projectFeatures.basic_features.project_type,
                building_type: '商业综合体',
                structure_type: '剪力墙结构',
                area: projectFeatures.basic_features.area * (0.85 + Math.random() * 0.25),
                location: projectFeatures.basic_features.location,
                floors: projectFeatures.basic_features.floors + (Math.random() > 0.5 ? 2 : 0),
                construction_period: 24,
                design_standard: 'JGJ-2016'
              },
              cost_features: {
                total_cost: 0,
                unit_cost: projectFeatures.cost_features.unit_cost * (1.1 + Math.random() * 0.2),
                material_costs: [],
                labor_costs: [],
                equipment_costs: [],
                overhead_costs: [],
                other_costs: [],
                cost_year: 2024,
                currency: 'CNY'
              },
              quality_features: {
                quality_level: projectFeatures.quality_features.quality_level,
                construction_standard: 'GB50300-2015',
                technical_specifications: [],
                material_grades: [],
                quality_scores: []
              }
            },
            similarity_result: {
              overall_score: 0.75 + Math.random() * 0.1,
              basic_similarity: 0.7 + Math.random() * 0.2,
              cost_similarity: 0.8 + Math.random() * 0.15,
              quality_similarity: 0.85 + Math.random() * 0.1,
              location_similarity: 0.95,
              temporal_similarity: 0.9,
              match_factors: [],
              confidence_level: 0.8,
              explanation: '项目特征较为匹配，可适度参考'
            },
            cost_estimates: [
              {
                cost_category: '装饰工程',
                suggested_unit_cost: projectFeatures.cost_features.unit_cost * (1.05 + Math.random() * 0.15),
                confidence_interval: {
                  lower_bound: projectFeatures.cost_features.unit_cost * 1.0,
                  upper_bound: projectFeatures.cost_features.unit_cost * 1.2,
                  confidence_level: 0.8
                },
                supporting_projects: ['商业中心改造项目'],
                adjustment_factors: [],
                rationale: '考虑商业项目的特殊要求和装饰标准'
              }
            ],
            applicable_factors: []
          }
        }
      ]

      setSimilarProjects(mockMatches)
    } catch (error) {
      message.error('搜索相似项目失败')
    } finally {
      setLoading(false)
    }
  }

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

  const similarityColumns: ColumnsType<ProjectMatch> = [
    {
      title: '项目名称',
      dataIndex: ['historical_project', 'name'],
      key: 'project_name',
      render: (text: string, record: ProjectMatch) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            相似度: {(record.similarity_result.overall_score * 100).toFixed(1)}%
          </Text>
        </Space>
      )
    },
    {
      title: '项目类型',
      dataIndex: ['historical_project', 'project_features', 'basic_features', 'project_type'],
      key: 'project_type',
      render: (type: ProjectType) => (
        <Tag color={getProjectTypeColor(type)}>
          {getProjectTypeText(type)}
        </Tag>
      )
    },
    {
      title: '建筑面积',
      dataIndex: ['historical_project', 'project_features', 'basic_features', 'area'],
      key: 'area',
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '单位造价',
      dataIndex: ['historical_project', 'project_features', 'cost_features', 'unit_cost'],
      key: 'unit_cost',
      render: (cost: number) => `¥${cost.toLocaleString()}/㎡`
    },
    {
      title: '质量等级',
      dataIndex: ['historical_project', 'project_features', 'quality_features', 'quality_level'],
      key: 'quality_level',
      render: (level: QualityLevel) => (
        <Tag color={getQualityColor(level)}>
          {getQualityText(level)}
        </Tag>
      )
    },
    {
      title: '置信度',
      dataIndex: ['similarity_result', 'confidence_level'],
      key: 'confidence_level',
      render: (level: number) => (
        <Space direction="vertical" size="small">
          <Progress
            percent={level * 100}
            size="small"
            strokeColor={getSimilarityColor(level)}
            showInfo={false}
          />
          <Text style={{ fontSize: '12px', color: getSimilarityColor(level) }}>
            {(level * 100).toFixed(1)}%
          </Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: ProjectMatch) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedProjects([record.historical_project.id])
                // 这里可以打开详情弹窗
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  const suggestionColumns: ColumnsType<EstimateSuggestion> = [
    {
      title: '成本类别',
      dataIndex: 'cost_category',
      key: 'cost_category'
    },
    {
      title: '建议单位造价',
      dataIndex: 'suggested_unit_cost',
      key: 'suggested_unit_cost',
      render: (cost: number) => `¥${cost.toLocaleString()}/㎡`
    },
    {
      title: '置信区间',
      dataIndex: 'confidence_interval',
      key: 'confidence_interval',
      render: (interval: any) => (
        <Space direction="vertical" size="small">
          <Text>¥{interval.lower_bound.toLocaleString()}/㎡</Text>
          <Text type="secondary">~ ¥{interval.upper_bound.toLocaleString()}/㎡</Text>
        </Space>
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence_interval',
      key: 'confidence',
      render: (interval: any) => `${(interval.confidence_level * 100).toFixed(0)}%`
    },
    {
      title: '支撑项目',
      dataIndex: 'supporting_projects',
      key: 'supporting_projects',
      render: (projects: string[]) => (
        <Space wrap>
          {projects.map((project, index) => (
            <Tag key={index} color="blue">
              {project}
            </Tag>
          ))}
        </Space>
      )
    }
  ]

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            {/* 模板选择区域 */}
            <ProjectTemplateSelector
              onTemplateSelect={handleTemplateSelect}
              currentFormData={form.getFieldsValue()}
              disabled={loading}
              maxTemplates={6}
              showAdvancedFilters={false}
            />

            {/* 项目基本信息表单 */}
            <Card title="项目基本信息" style={{ marginTop: 16 }}>
              {templateApplied && (
                <Alert
                  message="模板已应用"
                  description={`已基于模板"${selectedTemplate?.project_name}"自动填充部分信息，您可以根据需要修改`}
                  type="success"
                  showIcon
                  closable
                  onClose={() => setTemplateApplied(false)}
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  project_type: ProjectType.RESIDENTIAL,
                  quality_level: QualityLevel.STANDARD
                }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="项目名称"
                      name="project_name"
                      rules={[{ required: true, message: '请输入项目名称' }]}
                    >
                      <Input placeholder="请输入项目名称" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="项目类型"
                      name="project_type"
                      rules={[{ required: true, message: '请选择项目类型' }]}
                    >
                      <Select placeholder="请选择项目类型">
                        <Select.Option value={ProjectType.RESIDENTIAL}>住宅</Select.Option>
                        <Select.Option value={ProjectType.COMMERCIAL}>商业</Select.Option>
                        <Select.Option value={ProjectType.INDUSTRIAL}>工业</Select.Option>
                        <Select.Option value={ProjectType.PUBLIC}>公共</Select.Option>
                        <Select.Option value={ProjectType.MIXED}>混合</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="建筑类型"
                    name="building_type"
                    rules={[{ required: true, message: '请输入建筑类型' }]}
                  >
                    <Input placeholder="如：高层住宅、商业综合体等" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="结构类型"
                    name="structure_type"
                    rules={[{ required: true, message: '请输入结构类型' }]}
                  >
                    <Input placeholder="如：框架结构、剪力墙结构等" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="建筑面积 (㎡)"
                    name="area"
                    rules={[{ required: true, message: '请输入建筑面积' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="请输入建筑面积"
                      min={1}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="建设地点"
                    name="location"
                    rules={[{ required: true, message: '请输入建设地点' }]}
                  >
                    <Input placeholder="如：北京市朝阳区" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="层数"
                    name="floors"
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="请输入层数"
                      min={1}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Form.Item label="建设年份">
                    <DatePicker picker="year" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="建设周期 (月)">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="请输入建设周期"
                      min={1}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="预估单位造价 (元/㎡)">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="可选，用于参考"
                      min={0}
                      precision={2}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="质量等级"
                    name="quality_level"
                    rules={[{ required: true, message: '请选择质量等级' }]}
                  >
                    <Select placeholder="请选择质量等级">
                      <Select.Option value={QualityLevel.BASIC}>基础</Select.Option>
                      <Select.Option value={QualityLevel.STANDARD}>标准</Select.Option>
                      <Select.Option value={QualityLevel.PREMIUM}>高端</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="建设标准">
                    <Input placeholder="如：GB50000-2013" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Form.Item label="设计标准">
                    <Input.TextArea
                      rows={3}
                      placeholder="请输入设计标准和特殊要求..."
                    />
                  </Form.Item>
                </Col>
              </Row>

              {projectFeatures?.cost_features?.unit_cost && (
                <Alert
                  message="参考单价"
                  description={`基于您的输入，系统预估单位造价约为 ¥${projectFeatures.cost_features.unit_cost.toLocaleString()}/㎡，将基于历史数据进行调整`}
                  type="info"
                  showIcon
                />
              )}
            </Form>
          </Card>
        </div>
        )

      case 1:
        return (
          <div>
            <Card
              title="匹配结果"
              extra={
                <Space>
                  <Button icon={<SettingOutlined />} onClick={() => {
                    Modal.info({
                      title: '权重配置说明',
                      content: (
                        <div>
                          <p>• 基础特征权重：影响项目类型、面积、结构等基础信息的匹配度</p>
                          <p>• 成本特征权重：影响单位造价、成本构成等财务指标的匹配度</p>
                          <p>• 质量特征权重：影响质量等级、建设标准等技术要求的匹配度</p>
                          <p>• 地理位置、时间因素权重：影响地区差异和时间因素</p>
                          <p>当前权重总和: {(matchWeights.basic_weight + matchWeights.cost_weight + matchWeights.quality_weight + matchWeights.location_weight + matchWeights.temporal_weight).toFixed(2)}</p>
                        </div>
                      ),
                      width: 500
                    })
                  }}>
                    权重配置
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => {
                    setCurrentStep(0)
                  }}>
                    重新选择
                  </Button>
                  <Button icon={<DownloadOutlined />}>
                    导出报告
                  </Button>
                </Space>
              }
            >
              {similarProjects.length > 0 ? (
                <Table
                  columns={similarityColumns}
                  dataSource={similarProjects}
                  rowKey="historical_project.id"
                  pagination={false}
                  size="small"
                  rowSelection={{
                    type: 'checkbox',
                    onChange: (selectedRowKeys) => {
                      setSelectedProjects(selectedRowKeys as string[])
                    }
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <SearchOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <Text type="secondary">正在为您匹配相似项目...</Text>
                  {loading && <Spin />}
                </div>
              )}
            </Card>

            {similarProjects.length > 0 && (
              <Card
                title="估算建议"
                style={{ marginTop: 24 }}
                extra={
                  <Space>
                    <Text type="secondary">
                      基于选中的 {selectedProjects.length} 个相似项目
                    </Text>
                  </Space>
                }
              >
                <Table
                  columns={suggestionColumns}
                  dataSource={similarProjects
                    .filter(p => selectedProjects.includes(p.historical_project.id))
                    .flatMap(p => p.cost_estimates)}
                  rowKey={(record, index) => `${record.cost_category}-${index}`}
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="smart-estimate-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2}>智能估算</Title>
        <Text type="secondary">基于历史项目数据，提供智能成本估算建议</Text>
      </div>

      <Card>
        <Steps current={currentStep} items={steps} />
      </Card>

      <div style={{ marginTop: 24 }}>
        {renderStepContent()}
      </div>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>
              上一步
            </Button>
          )}
          {currentStep === 0 && (
            <Button type="primary" onClick={handleNext} loading={loading}>
              查看建议
            </Button>
          )}
          {currentStep === 1 && (
            <Button type="primary" onClick={() => message.success('智能估算完成！')}>
              完成估算
            </Button>
          )}
        </Space>
      </div>
    </div>
  )
}

export default SmartEstimatePage