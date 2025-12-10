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
  Space,
  Alert,
  Spin,
  message,
  Table,
  Progress,
  Statistic,
  Divider,
  Empty,
  Tabs,
  List,
  Tooltip,
  Switch,
  Drawer,
  Descriptions,
  Tag
} from 'antd'
import {
  RobotOutlined,
  CalculatorOutlined,
  DownloadOutlined,
  ApiOutlined,
  WarningOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'

import './Estimates.css'
import { ProjectType, QualityLevel } from '@/types'
import type { ProjectTemplate } from '@/store/api/templatesApi'
import { useGetTemplatesQuery } from '@/store/api/templatesApi'
import { post } from '@/utils/request'
import SmartModelSelector from '@/components/SmartModelSelector'
import type { LLMModel } from '@/config/models'
import type { AIModelStatus } from '@/services/aiModelStatusService'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

// 地区系数预设
const REGION_FACTORS: Record<string, number> = {
  '北京': 1.2,
  '上海': 1.15,
  '深圳': 1.18,
  '广州': 1.1,
  '西安': 1.0,
  '成都': 0.95,
  '重庆': 0.93,
  '武汉': 0.98,
}

const SmartEstimatePage: React.FC = () => {
  const location = useLocation()
  const [form] = Form.useForm()
  const [quickForm] = Form.useForm()

  // 状态管理
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'template' | 'ai'>('template')
  const [expertMode, setExpertMode] = useState(false)

  // 当切换到AI估算标签时，自动填充默认值（解决输入法问题和字段验证冲突）
  useEffect(() => {
    if (activeTab === 'ai') {
      // 为所有必填字段设置默认值
      const currentValues = form.getFieldsValue()
      const defaultValues: any = {}

      if (!currentValues.project_name) {
        defaultValues.project_name = 'AI智能估算项目'
      }
      if (!currentValues.project_type) {
        defaultValues.project_type = ProjectType.RESIDENTIAL  // 默认住宅
      }
      if (!currentValues.building_type) {
        defaultValues.building_type = '高层住宅'
      }
      if (!currentValues.area) {
        defaultValues.area = 8000  // 默认8000平米
      }
      if (!currentValues.location) {
        defaultValues.location = '北京市朝阳区'
      }
      if (!currentValues.quality_level) {
        defaultValues.quality_level = QualityLevel.STANDARD  // 默认标准
      }

      // 一次性设置所有默认值
      if (Object.keys(defaultValues).length > 0) {
        form.setFieldsValue(defaultValues)
      }
    }
  }, [activeTab, form])

  // 模板估算相关
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [templateEstimateResult, setTemplateEstimateResult] = useState<any>(null)
  const [recommendedTemplates, setRecommendedTemplates] = useState<any[]>([])

  // AI估算相关
  const [aiEstimateResult, setAiEstimateResult] = useState<any>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedModelInfo, setSelectedModelInfo] = useState<LLMModel | null>(null)
  const [selectedModelStatus, setSelectedModelStatus] = useState<AIModelStatus | null>(null)
  const [hasConfiguredModels, setHasConfiguredModels] = useState(true)

  // 调整系数
  const [regionFactor, setRegionFactor] = useState<number>(1.0)
  const [qualityFactor, setQualityFactor] = useState<number>(1.0)

  // 对比功能
  const [comparisonList, setComparisonList] = useState<any[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [saving, setSaving] = useState(false)

  // RTK Query
  const { data: templatesData } = useGetTemplatesQuery({ page: 1, size: 100 })

  // 从历史数据页面导航过来时，接收referenceProject
  const referenceProject = location.state?.referenceProject as ProjectTemplate | undefined

  useEffect(() => {
    if (referenceProject) {
      setSelectedTemplateId(referenceProject.id)
      setSelectedTemplate(referenceProject)
      form.setFieldsValue({
        template_id: referenceProject.id,
        project_name: `基于${referenceProject.name}的新项目`,
        project_type: referenceProject.project_type || ProjectType.RESIDENTIAL,
        area: referenceProject.area,
        quality_level: QualityLevel.STANDARD
      })
      message.success(`已加载参考项目: ${referenceProject.name}`)
    }
  }, [referenceProject, form])

  // 监听面积和项目类型变化，智能推荐模板
  useEffect(() => {
    const area = form.getFieldValue('area')
    const projectType = form.getFieldValue('project_type')

    if (area && projectType && templatesData?.templates) {
      const recommended = templatesData.templates
        .filter(t => {
          const areaMatch = Math.abs(t.area - area) / area < 0.3 // 面积差异<30%
          const typeMatch = !projectType || t.project_type === projectType
          return areaMatch && typeMatch
        })
        .slice(0, 3)
        .map(t => ({
          ...t,
          similarity_score: 1 - Math.abs(t.area - area) / area
        }))

      setRecommendedTemplates(recommended)
    }
  }, [form, templatesData])

  // 处理模板选择
  const handleTemplateSelect = (templateId: number) => {
    const template = templatesData?.templates?.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplateId(templateId)
      setSelectedTemplate(template)

      // 自动填充表单
      form.setFieldsValue({
        project_type: template.project_type,
      })

      // 根据地点设置地区系数
      // 这里简化处理，实际应该从template的location字段提取
      const cityMatch = Object.keys(REGION_FACTORS).find(city =>
        template.name?.includes(city)
      )
      if (cityMatch) {
        setRegionFactor(REGION_FACTORS[cityMatch])
      }

      message.success(`已选择模板: ${template.name}`)
    }
  }

  // 处理AI模型选择
  const handleModelSelect = (model: LLMModel, status: AIModelStatus) => {
    setSelectedModelInfo(model)
    setSelectedModelStatus(status)
    setHasConfiguredModels(status.configured && status.enabled)
  }

  // 将前端provider映射到后端API provider
  const getBackendProvider = (frontendProvider: string): string => {
    const providerMap: Record<string, string> = {
      'glm': 'zhipuai',
      'kimi': 'moonshot',
      'qwen': 'dashscope',
      'wenxin': 'baidu',
      'deepseek': 'deepseek',
      'yi': 'yi',
      'spark': 'spark'
    }
    return providerMap[frontendProvider] || frontendProvider
  }

  // 执行模板估算
  const handleTemplateEstimate = async () => {
    try {
      const values = await form.validateFields()

      if (!selectedTemplateId) {
        message.error('请先选择参考模板')
        return
      }

      setLoading(true)

      const response = await post<any>('/api/v1/template-estimates/estimate', {
        name: values.project_name,
        project_type: values.project_type || selectedTemplate?.project_type,
        area: values.area,
        location: values.location,
        start_date: values.construction_year?.format('YYYY'),
        template_id: selectedTemplateId
      })

      console.log('🔍 [CRITICAL] API Response received:', response)
      console.log('🔍 [CRITICAL] cost_breakdown exists?:', !!response.cost_breakdown)
      console.log('🔍 [CRITICAL] cost_breakdown content:', response.cost_breakdown)
      if (response.cost_breakdown?.secondary_sections) {
        console.log('🔍 [CRITICAL] Secondary 2.1:', response.cost_breakdown.secondary_sections['2.1'])
      }

      // 应用前端的地区和质量调整系数
      const adjustedUnitCost = response.unit_cost * regionFactor * qualityFactor
      const adjustedTotalCost = adjustedUnitCost * values.area

      const stateToSet = {
        ...response,
        unit_cost: adjustedUnitCost,
        total_cost: adjustedTotalCost,
        adjustment_factors: {
          ...response.adjustment_factors,
          region_factor: regionFactor,
          quality_factor: qualityFactor
        }
      }

      console.log('🔍 [CRITICAL] Setting state with cost_breakdown?:', !!stateToSet.cost_breakdown)
      console.log('🔍 [CRITICAL] State to set:', stateToSet)

      setTemplateEstimateResult(stateToSet)

      message.success('模板估算完成')
    } catch (error: any) {
      console.error('Template estimate error:', error)
      message.error(error?.response?.data?.detail || '模板估算失败')
    } finally {
      setLoading(false)
    }
  }

  // 快速估算
  const handleQuickEstimate = async () => {
    try {
      const values = await quickForm.validateFields()
      setLoading(true)

      const template = templatesData?.templates?.find(t => t.id === values.template_id)

      const response = await post<any>('/api/v1/template-estimates/estimate', {
        name: `快速估算_${template?.name || ''}`,
        project_type: template?.project_type || ProjectType.RESIDENTIAL,
        area: values.area,
        location: template?.name || '未知',
        start_date: values.year?.format('YYYY'),
        template_id: values.template_id
      })

      setTemplateEstimateResult(response)
      message.success('快速估算完成')
    } catch (error: any) {
      message.error('快速估算失败')
    } finally {
      setLoading(false)
    }
  }

  // 执行AI估算
  const handleAIEstimate = async () => {
    try {
      if (!selectedModelInfo || !selectedModelStatus) {
        message.warning('请先选择AI模型')
        return
      }

      if (!selectedModelStatus.configured || !selectedModelStatus.enabled) {
        message.error(`${selectedModelStatus.providerName} 未配置或已禁用`)
        return
      }

      // ✅ 修复：只验证AI估算的必填字段，避免与模板Tab的required规则冲突
      // 必填字段：project_name, project_type, building_type, area, location, quality_level
      // 可选字段会在后续form.getFieldsValue()中获取
      const aiFields = [
        'project_name',
        'project_type',
        'building_type',
        'area',
        'location',
        'quality_level'
      ]
      const values = await form.validateFields(aiFields)

      // 获取所有字段值（包括可选字段）
      const allValues = form.getFieldsValue()
      setLoading(true)

      const backendProvider = getBackendProvider(selectedModelInfo.provider)

      // 如果用户选择了参考模板，使用模板的单位造价作为参考
      const referenceUnitCost = selectedTemplate?.unit_cost || null

      const requestBody = {
        project_name: allValues.project_name,
        project_type: allValues.project_type,
        building_type: allValues.building_type || null,
        structure_type: allValues.structure_type || null,
        area: allValues.area,
        location: allValues.location,
        floors: allValues.floors || null,
        unit_cost: referenceUnitCost,  // 使用模板的单位造价作为参考
        quality_level: allValues.quality_level,
        construction_year: allValues.construction_year ? allValues.construction_year.year() : null,
        construction_period: allValues.construction_period || null,
        construction_standard: allValues.construction_standard || null,
        design_standard: allValues.design_standard || null,
        ai_provider: backendProvider,
        ai_model: selectedModelInfo.id,
        temperature: 0.7
      }

      // AI估算需要较长时间，设置90秒超时
      const result = await post<any>('/api/v1/estimates/ai-estimate', requestBody, {
        timeout: 90000  // 90秒超时（AI模型调用通常需要10-30秒）
      })

      setAiEstimateResult({
        estimated_unit_cost: result.estimated_unit_cost,
        total_cost: result.estimated_total_cost,
        confidence: result.confidence,
        breakdown: result.breakdown,
        cost_breakdown: result.cost_breakdown,  // ✅ 修复：保存14级成本明细到状态
        rationale: result.rationale,
        model_used: result.model_used
      })

      message.success('AI估算完成')
    } catch (error: any) {
      console.error('AI estimate error:', error)
      message.error(error?.response?.data?.detail || 'AI估算失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存AI估算结果
  const handleSaveAIEstimate = async () => {
    if (!aiEstimateResult) {
      message.warning('没有可保存的估算结果')
      return
    }

    try {
      setSaving(true)
      const values = form.getFieldsValue()

      const saveRequest = {
        project_name: values.project_name,
        project_type: values.project_type,
        area: values.area,
        location: values.location,
        estimated_unit_cost: aiEstimateResult.estimated_unit_cost,
        estimated_total_cost: aiEstimateResult.total_cost,
        confidence: aiEstimateResult.confidence,
        breakdown: aiEstimateResult.breakdown,
        cost_breakdown: aiEstimateResult.cost_breakdown || null,  // ✅ 新增：保存14级成本明细
        rationale: aiEstimateResult.rationale,
        model_used: aiEstimateResult.model_used,
        ai_provider: selectedModelInfo?.provider || 'unknown',
        quality_level: values.quality_level,
        construction_year: values.construction_year ? values.construction_year.year() : null
      }

      const result = await post<any>('/api/v1/estimates/ai-estimate/save', saveRequest)

      message.success(`估算结果已保存（ID: ${result.estimation_id}）`)

      // 可选：跳转到历史记录页面
      // navigate('/estimates/history')
    } catch (error: any) {
      console.error('Save AI estimate error:', error)
      console.error('Error response:', error?.response)
      console.error('Request data:', saveRequest)
      message.error(error?.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 14级成本数据格式化
  const formatCostBreakdown = (breakdown: any) => {
    console.log('🔍 [DEBUG] formatCostBreakdown called with:', breakdown)
    if (!breakdown) return []

    const { primary_sections, secondary_sections } = breakdown
    console.log('🔍 [DEBUG] primary_sections:', primary_sections)
    console.log('🔍 [DEBUG] secondary_sections:', secondary_sections)
    if (!primary_sections) return []

    // ✅ 修复：使用第14项（项目总造价）作为占比计算的分母
    const item14 = primary_sections['14.0']
    const totalCost = item14?.total_price || 0
    console.log('🔍 [DEBUG] 第14项总造价:', totalCost)

    return Object.entries(primary_sections).map(([code, data]: [string, any]) => {
      const primaryCode = code.split('.')[0]
      // ✅ 修复：二级分部占比基于所属的一级分部总价计算
      const primaryTotal = data.total_price || 0
      const children = secondary_sections ?
        Object.entries(secondary_sections)
          .filter(([secCode]) => secCode.startsWith(primaryCode + '.'))
          .map(([secCode, secData]: [string, any]) => {
            console.log(`🔍 [DEBUG] Secondary ${secCode}:`, secData)
            // 二级分部占比 = 二级金额 / 所属一级金额 × 100%
            const secondaryPercentage = primaryTotal > 0
              ? parseFloat((secData.total_price / primaryTotal * 100).toFixed(2))
              : 0
            return {
              key: secCode,
              code: secCode,
              name: secData.item_name || `成本项 ${secCode}`,
              unit_price: secData.unit_price,
              total_price: secData.total_price,
              percentage: secondaryPercentage,
              is_primary: false
            }
          }) : []

      // ✅ 修复：第14项占比固定为100%，其他项基于第14项（总造价）计算
      let primaryPercentage = 0
      if (code === '14.0') {
        // 第14项（项目总造价）占比 = 100%
        primaryPercentage = 100.0
      } else {
        // 前13项占比 = 各项金额 / 第14项总造价 × 100%
        primaryPercentage = totalCost > 0
          ? parseFloat((data.total_price / totalCost * 100).toFixed(2))
          : 0
      }

      return {
        key: code,
        code,
        name: data.item_name || `成本项 ${code}`,
        unit_price: data.unit_price,
        total_price: data.total_price,
        percentage: primaryPercentage,
        is_primary: true,
        children: children.length > 0 ? children : undefined
      }
    })
  }

  // Excel导出
  const exportToExcel = (result: any, type: 'template' | 'ai') => {
    const workbook = XLSX.utils.book_new()

    // Sheet1: 估算概要
    const summaryData = [
      ['成本估算报告'],
      [''],
      ['项目名称', result.project_name || form.getFieldValue('project_name')],
      ['建筑面积', `${form.getFieldValue('area')}㎡`],
      ['建设地点', form.getFieldValue('location')],
      ['建设年份', result.new_start_date || form.getFieldValue('construction_year')?.format('YYYY')],
      ['估算方式', type === 'template' ? '模板估算' : 'AI智能估算'],
      [''],
      ['估算总造价', `¥${(result.total_cost/10000).toFixed(2)}万元`],
      ['单位造价', `¥${result.unit_cost?.toFixed(2) || result.estimated_unit_cost?.toFixed(2)}/㎡`],
      ['置信度', `${(result.confidence * 100).toFixed(1)}%`],
      [''],
    ]

    if (type === 'template') {
      summaryData.push(
        ['参考模板', result.matched_template_name],
        ['模板时间', result.reference_start_date],
        ['时间调整系数', result.adjustment_factors?.time_adjustment_factor?.toFixed(3) || '1.000'],
        ['地区调整系数', regionFactor.toFixed(2)],
        ['质量调整系数', qualityFactor.toFixed(2)]
      )
    } else {
      summaryData.push(
        ['使用模型', result.model_used],
        ['估算依据', result.rationale]
      )
    }

    summaryData.push(
      [''],
      ['报告生成时间', new Date().toLocaleString()]
    )

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, ws1, '估算概要')

    // Sheet2: 成本明细
    if (result.cost_breakdown) {
      const detailData = formatCostBreakdown(result.cost_breakdown).map(item => ({
        '代码': item.code,
        '项目名称': item.name,
        '单位造价(元/㎡)': item.unit_price?.toFixed(2) || '-',
        '合价(万元)': item.total_price ? (item.total_price/10000).toFixed(2) : '-',
        '占比(%)': item.percentage.toFixed(2)
      }))
      const ws2 = XLSX.utils.json_to_sheet(detailData)
      XLSX.utils.book_append_sheet(workbook, ws2, '成本明细')
    }

    // 下载
    const fileName = `成本估算报告_${form.getFieldValue('project_name')}_${Date.now()}.xlsx`
    XLSX.writeFile(workbook, fileName)
    message.success(`报告已导出：${fileName}`)
  }

  // 添加到对比列表
  const addToComparison = (result: any, type: 'template' | 'ai') => {
    const comparisonItem = {
      id: Date.now(),
      name: `${type === 'template' ? '模板' : 'AI'}估算_${form.getFieldValue('project_name')}`,
      type,
      template_name: type === 'template' ? result.matched_template_name : result.model_used,
      total_cost: result.total_cost,
      unit_cost: result.unit_cost || result.estimated_unit_cost,
      time_factor: result.adjustment_factors?.time_adjustment_factor || 1.0,
      confidence: result.confidence,
      timestamp: new Date().toLocaleString()
    }

    setComparisonList([...comparisonList, comparisonItem])
    message.success('已添加到对比列表')
  }

  // 模板估算Tab内容
  const renderTemplateEstimate = () => (
    <div>
      {/* 智能推荐 */}
      {recommendedTemplates.length > 0 && !expertMode && (
        <Card title="🎯 智能推荐模板" size="small" style={{ marginBottom: 16 }} className="template-recommendation-card">
          <List
            dataSource={recommendedTemplates}
            renderItem={(template: any) => (
              <List.Item
                actions={[
                  <Button type="link" onClick={() => handleTemplateSelect(template.id)}>
                    使用此模板
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                  title={template.name}
                  description={
                    <Space>
                      <Tag color="blue">相似度 {(template.similarity_score * 100).toFixed(1)}%</Tag>
                      <Text type="secondary">面积: {template.area}㎡</Text>
                      <Text type="secondary">单价: ¥{template.unit_cost}/㎡</Text>
                      {template.start_date && <Text type="secondary">{template.start_date}</Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 标准模式表单 */}
      {!expertMode && (
        <Card title="项目基本信息" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" initialValues={{ quality_level: QualityLevel.STANDARD }}>
            {/* 模板选择 */}
            <Form.Item
              label="选择参考模板"
              name="template_id"
              rules={[{ required: true, message: '请选择模板' }]}
            >
              <Select
                showSearch
                placeholder="选择历史项目模板"
                onChange={handleTemplateSelect}
                optionFilterProp="children"
                filterOption={(input, option: any) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {templatesData?.templates?.map(t => (
                  <Select.Option key={t.id} value={t.id}>
                    <div>
                      <div><Text strong>{t.name}</Text></div>
                      <Text type="secondary" style={{fontSize: 12}}>
                        {t.area}㎡ | ¥{t.unit_cost}/㎡ | {t.start_date}
                      </Text>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {/* 模板信息预览 */}
            {selectedTemplate && (
              <Alert
                type="info"
                message={`参考模板：${selectedTemplate.name}`}
                description={
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="建设时间">{selectedTemplate.start_date || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="建筑面积">{selectedTemplate.area}㎡</Descriptions.Item>
                    <Descriptions.Item label="项目类型">{selectedTemplate.project_type || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="单位造价">¥{selectedTemplate.unit_cost}/㎡</Descriptions.Item>
                  </Descriptions>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item label="项目名称" name="project_name" rules={[{ required: true, message: '请输入项目名称' }]}>
                  <Input placeholder="请输入项目名称" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="建筑面积(㎡)" name="area" rules={[{ required: true, message: '请输入建筑面积' }]}>
                  <InputNumber style={{width: '100%'}} placeholder="请输入建筑面积" min={1} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item label="建设地点" name="location" rules={[{ required: true, message: '请输入建设地点' }]}>
                  <Input placeholder="如：西安市" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="新项目建设年份"
                  name="construction_year"
                  rules={[{ required: true, message: '请选择建设年份' }]}
                  extra={selectedTemplate?.start_date && (
                    <Text type="secondary">
                      参考项目建于 {selectedTemplate.start_date}，系统将自动调整造价
                    </Text>
                  )}
                >
                  <DatePicker picker="year" style={{width: '100%'}} placeholder="选择建设年份" />
                </Form.Item>
              </Col>
            </Row>

            {/* 调整系数设置 */}
            <Card title="调整系数设置" size="small" style={{marginBottom: 16}}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="地区调整系数"
                    extra="北京1.2 上海1.15 西安1.0 成都0.95"
                  >
                    <InputNumber
                      value={regionFactor}
                      onChange={(v) => setRegionFactor(v || 1.0)}
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      precision={2}
                      style={{width: '100%'}}
                      addonAfter="倍"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="质量等级"
                    name="quality_level"
                    rules={[{ required: true, message: '请选择质量等级' }]}
                  >
                    <Select onChange={(value: string) => {
                      const factorMap: Record<string, number> = {
                        [QualityLevel.BASIC]: 0.9,
                        [QualityLevel.STANDARD]: 1.0,
                        [QualityLevel.PREMIUM]: 1.2
                      }
                      setQualityFactor(factorMap[value] || 1.0)
                    }}>
                      <Select.Option value={QualityLevel.BASIC}>基础（0.9倍）</Select.Option>
                      <Select.Option value={QualityLevel.STANDARD}>标准（1.0倍）</Select.Option>
                      <Select.Option value={QualityLevel.PREMIUM}>高端（1.2倍）</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 可选字段 */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item label="项目类型" name="project_type">
                  <Select placeholder="请选择项目类型">
                    <Select.Option value={ProjectType.RESIDENTIAL}>住宅</Select.Option>
                    <Select.Option value={ProjectType.COMMERCIAL}>商业</Select.Option>
                    <Select.Option value={ProjectType.INDUSTRIAL}>工业</Select.Option>
                    <Select.Option value={ProjectType.PUBLIC}>公共</Select.Option>
                    <Select.Option value={ProjectType.MIXED}>混合</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="建设周期(月)" name="construction_period">
                  <InputNumber style={{width: '100%'}} placeholder="请输入建设周期" min={1} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      {/* 快速模式表单 */}
      {expertMode && (
        <Card title="⚡ 快速估算（仅填3项）">
          <Form form={quickForm} layout="inline" onFinish={handleQuickEstimate}>
            <Form.Item label="模板" name="template_id" rules={[{required: true, message: '请选择模板'}]}>
              <Select style={{width: 200}} placeholder="选择模板">
                {templatesData?.templates?.slice(0, 10).map(t => (
                  <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="面积(㎡)" name="area" rules={[{required: true, message: '请输入面积'}]}>
              <InputNumber min={1} placeholder="10000" />
            </Form.Item>

            <Form.Item label="年份" name="year" rules={[{required: true, message: '请选择年份'}]}>
              <DatePicker picker="year" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />} loading={loading}>
                立即估算
              </Button>
            </Form.Item>
          </Form>

          <Alert
            type="info"
            message="使用默认值：地点=模板地点，质量=标准"
            style={{marginTop: 16}}
          />
        </Card>
      )}

      {/* 估算结果 */}
      {templateEstimateResult && (
        <Card title="📊 模板估算结果" style={{marginTop: 24}}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <Statistic
                title="估算总造价"
                value={templateEstimateResult.total_cost / 10000}
                prefix="¥"
                suffix="万"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="单位造价"
                value={templateEstimateResult.unit_cost}
                prefix="¥"
                suffix="/㎡"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <div>
                <Statistic
                  title="时间调整系数"
                  value={templateEstimateResult.adjustment_factors?.time_adjustment_factor || 1.0}
                  precision={3}
                  valueStyle={{
                    color: (templateEstimateResult.adjustment_factors?.time_adjustment_factor || 1.0) > 1
                      ? '#cf1322' : '#3f8600'
                  }}
                  prefix={(templateEstimateResult.adjustment_factors?.time_adjustment_factor || 1.0) > 1
                    ? '↑' : '↓'}
                />
                <Text type="secondary" style={{fontSize: 12}}>
                  {templateEstimateResult.adjustment_factors?.years_difference || 0}年差异
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="置信度"
                value={templateEstimateResult.confidence * 100}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>

          <Divider />

          <Alert
            type="info"
            message="造价调整说明"
            description={
              <Descriptions column={2} size="small">
                <Descriptions.Item label="参考模板">
                  {templateEstimateResult.matched_template_name}
                </Descriptions.Item>
                <Descriptions.Item label="参考时间">
                  {templateEstimateResult.reference_start_date || '未知'}
                </Descriptions.Item>
                <Descriptions.Item label="新建时间">
                  {templateEstimateResult.new_start_date || '未知'}
                </Descriptions.Item>
                <Descriptions.Item label="时间调整">
                  {(templateEstimateResult.adjustment_factors?.time_adjustment_factor || 1.0).toFixed(3)}
                </Descriptions.Item>
                <Descriptions.Item label="地区调整">
                  {regionFactor.toFixed(2)}倍
                </Descriptions.Item>
                <Descriptions.Item label="质量调整">
                  {qualityFactor.toFixed(2)}倍
                </Descriptions.Item>
              </Descriptions>
            }
            style={{marginBottom: 16}}
          />

          <Divider>14级成本构成明细</Divider>

          <Table
            dataSource={formatCostBreakdown(templateEstimateResult.cost_breakdown)}
            columns={[
              {
                title: '代码',
                dataIndex: 'code',
                width: 100,
                render: (code: string, record: any) => (
                  <Text strong={record.is_primary}>{code}</Text>
                )
              },
              {
                title: '项目名称',
                dataIndex: 'name',
                width: 300,
                render: (name: string, record: any) => (
                  <Text strong={record.is_primary}>{name}</Text>
                )
              },
              {
                title: '单位造价',
                dataIndex: 'unit_price',
                align: 'right' as const,
                render: (v: number) => v ? `¥${v.toFixed(2)}/㎡` : '-'
              },
              {
                title: '合价',
                dataIndex: 'total_price',
                align: 'right' as const,
                render: (v: number) => v ? `¥${(v/10000).toFixed(2)}万` : '-'
              },
              {
                title: '占比',
                dataIndex: 'percentage',
                width: 200,
                render: (v: number) => <Progress percent={v} size="small" />
              }
            ]}
            expandable={{
              childrenColumnName: 'children',
              defaultExpandAllRows: false,
              indentSize: 20
            }}
            pagination={false}
            size="small"
            bordered
            rowClassName={(record: any) => record.is_primary ? 'primary-section-row' : ''}
          />

          <Divider />

          {/* ✅ 新增：显示已保存提示 */}
          {templateEstimateResult.estimation_id && (
            <Alert
              type="success"
              message="估算结果已自动保存"
              description={`估算记录ID: ${templateEstimateResult.estimation_id}，您可以在"历史数据管理"中查看和管理此估算记录。`}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Space size="large">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => exportToExcel(templateEstimateResult, 'template')}
            >
              导出Excel报告
            </Button>
            <Button
              icon={<SwapOutlined />}
              onClick={() => addToComparison(templateEstimateResult, 'template')}
            >
              添加到对比
            </Button>
            <Button onClick={() => setShowComparison(true)}>
              查看对比 ({comparisonList.length})
            </Button>
          </Space>
        </Card>
      )}

      {!loading && !templateEstimateResult && (
        <Empty
          description="请填写项目信息后点击下方'开始估算'按钮执行模板估算"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={<CalculatorOutlined />}
          onClick={expertMode ? handleQuickEstimate : handleTemplateEstimate}
          loading={loading}
        >
          开始估算
        </Button>
      </div>
    </div>
  )

  // AI估算Tab内容
  const renderAIEstimate = () => (
    <div>
      <Card title="项目基本信息" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ quality_level: QualityLevel.STANDARD }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item label="项目名称" name="project_name" rules={[{ required: true }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="项目类型" name="project_type" rules={[{ required: true }]}>
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
              <Form.Item label="建筑类型" name="building_type" rules={[{ required: true }]}>
                <Input placeholder="如：高层住宅、商业综合体等" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="结构类型" name="structure_type">
                <Input placeholder="如：框架结构、剪力墙结构等" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Form.Item label="建筑面积(㎡)" name="area" rules={[{ required: true }]}>
                <InputNumber style={{width: '100%'}} placeholder="请输入建筑面积" min={1} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="建设地点" name="location" rules={[{ required: true }]}>
                <Input placeholder="如：北京市朝阳区" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="层数" name="floors">
                <InputNumber style={{width: '100%'}} placeholder="请输入层数" min={1} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Form.Item label="建设年份" name="construction_year">
                <DatePicker picker="year" style={{width: '100%'}} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="建设周期(月)" name="construction_period">
                <InputNumber style={{width: '100%'}} placeholder="请输入建设周期" min={1} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="质量等级" name="quality_level" rules={[{ required: true }]}>
                <Select placeholder="请选择质量等级">
                  <Select.Option value={QualityLevel.BASIC}>基础</Select.Option>
                  <Select.Option value={QualityLevel.STANDARD}>标准</Select.Option>
                  <Select.Option value={QualityLevel.PREMIUM}>高端</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item label="建设标准" name="construction_standard">
                <Input placeholder="如：GB50000-2013" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="设计标准" name="design_standard">
                <Input.TextArea rows={2} placeholder="请输入设计标准和特殊要求..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="AI估算说明" style={{ marginBottom: 16 }}>
        <Alert
          message="AI智能估算"
          description="使用大语言模型和机器学习算法，基于大量历史数据进行智能估算。适用于历史数据库中无相似项目的情况。"
          type="info"
          showIcon
          icon={<ApiOutlined />}
        />
        {selectedTemplate && (
          <Alert
            message="参考模板已选择"
            description={
              <div>
                <Text>AI 估算将参考模板 <Text strong>{selectedTemplate.name}</Text> 的单位造价 <Text strong>¥{selectedTemplate.unit_cost}/㎡</Text> 进行智能调整</Text>
              </div>
            }
            type="success"
            showIcon
            style={{ marginTop: 12 }}
            closable
          />
        )}
      </Card>

      <Card title={<Space><RobotOutlined /> 选择AI模型</Space>} style={{ marginBottom: 16 }}>
        {!hasConfiguredModels && (
          <Alert
            message="未配置AI模型"
            description={
              <span>
                您还没有配置任何AI模型，请先前往
                <a href="/settings/system" style={{ marginLeft: 4, marginRight: 4 }}>系统设置</a>
                配置API密钥后再使用AI智能估算功能
              </span>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
            closable
          />
        )}

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>请选择用于估算的AI模型：</Text>
              <SmartModelSelector
                value={selectedModel || undefined}
                onChange={(value: string) => setSelectedModel(value)}
                onModelSelect={handleModelSelect}
                autoSelectConfigured={true}
                placeholder="请选择AI模型（带绿色标记的为已配置）"
                size="large"
              />
              {selectedModelInfo && selectedModelStatus && (
                <Alert
                  message={
                    <Space>
                      <Text>已选择：</Text>
                      <Text strong>{selectedModelInfo.displayName}</Text>
                      <Text type="secondary">({selectedModelStatus.providerName})</Text>
                    </Space>
                  }
                  type="success"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {aiEstimateResult && (
        <Card title="📊 AI估算结果" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Statistic
                title="估算单位造价"
                value={aiEstimateResult.estimated_unit_cost}
                prefix="¥"
                suffix="/㎡"
                precision={2}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="估算总造价"
                value={aiEstimateResult.total_cost / 10000}
                prefix="¥"
                suffix="万"
                precision={2}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="AI置信度"
                value={aiEstimateResult.confidence * 100}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>

          <Divider />

          {/* ✅ 新增：14级成本构成明细表格 */}
          {aiEstimateResult.cost_breakdown && (
            <>
              <Divider>14级成本构成明细</Divider>

              <Table
                dataSource={formatCostBreakdown(aiEstimateResult.cost_breakdown)}
                columns={[
                  {
                    title: '代码',
                    dataIndex: 'code',
                    width: 100,
                    render: (code: string, record: any) => (
                      <Text strong={record.is_primary}>{code}</Text>
                    )
                  },
                  {
                    title: '项目名称',
                    dataIndex: 'name',
                    width: 300,
                    render: (name: string, record: any) => (
                      <Text strong={record.is_primary}>{name}</Text>
                    )
                  },
                  {
                    title: '单位造价',
                    dataIndex: 'unit_price',
                    align: 'right' as const,
                    render: (v: number) => v ? `¥${v.toFixed(2)}/㎡` : '-'
                  },
                  {
                    title: '合价',
                    dataIndex: 'total_price',
                    align: 'right' as const,
                    render: (v: number) => v ? `¥${(v/10000).toFixed(2)}万` : '-'
                  },
                  {
                    title: '占比',
                    dataIndex: 'percentage',
                    width: 200,
                    render: (v: number) => <Progress percent={v} size="small" />
                  }
                ]}
                expandable={{
                  childrenColumnName: 'children',
                  defaultExpandAllRows: false,
                  indentSize: 20
                }}
                pagination={false}
                size="small"
                bordered
                rowClassName={(record: any) => record.is_primary ? 'primary-section-row' : ''}
              />

              <Divider />
            </>
          )}

          {/* 原有的4大类成本构成分析（向后兼容） */}
          {!aiEstimateResult.cost_breakdown && (
            <>
              <Title level={5}>成本构成分析</Title>
              <Table
                dataSource={aiEstimateResult.breakdown}
                columns={[
                  { title: '成本类别', dataIndex: 'category', key: 'category' },
                  {
                    title: '单位造价',
                    dataIndex: 'unit_cost',
                    key: 'unit_cost',
                    render: (value: number) => `¥${value.toFixed(2)}/㎡`
                  },
                  {
                    title: '占比',
                    dataIndex: 'percentage',
                    key: 'percentage',
                    render: (value: number) => (
                      <Progress percent={value} size="small" />
                    )
                  }
                ]}
                pagination={false}
                size="small"
              />

              <Divider />
            </>
          )}

          <Paragraph>
            <Text strong>估算依据: </Text>
            {aiEstimateResult.rationale}
          </Paragraph>
          <Text type="secondary">模型: {aiEstimateResult.model_used}</Text>

          <Divider />

          <Space size="large">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveAIEstimate}
              loading={saving}
            >
              保存估算结果
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportToExcel(aiEstimateResult, 'ai')}
            >
              导出Excel报告
            </Button>
            <Button
              icon={<SwapOutlined />}
              onClick={() => addToComparison(aiEstimateResult, 'ai')}
            >
              添加到对比
            </Button>
            <Button onClick={() => setShowComparison(true)}>
              查看对比 ({comparisonList.length})
            </Button>
          </Space>
        </Card>
      )}

      {!loading && !aiEstimateResult && (
        <Empty
          description="请填写项目信息后点击下方'开始估算'按钮执行AI智能估算"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={<CalculatorOutlined />}
          onClick={handleAIEstimate}
          loading={loading}
        >
          开始估算
        </Button>
      </div>
    </div>
  )

  return (
    <div className="smart-estimate-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2} className="estimates-title">
          <RobotOutlined style={{ marginRight: 8 }} />
          智能成本估算
        </Title>
        <Text type="secondary">
          支持模板估算和AI估算两种方式，灵活满足不同估算需求
        </Text>
      </div>

      <Spin spinning={loading}>
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'template' | 'ai')}
            size="large"
            tabBarExtraContent={
              activeTab === 'template' && (
                <Switch
                  checkedChildren="专家模式"
                  unCheckedChildren="标准模式"
                  checked={expertMode}
                  onChange={setExpertMode}
                />
              )
            }
          >
            <TabPane tab="📊 模板估算" key="template">
              {renderTemplateEstimate()}
            </TabPane>

            <TabPane tab="🤖 AI估算" key="ai">
              {renderAIEstimate()}
            </TabPane>
          </Tabs>
        </Card>
      </Spin>

      {/* 对比分析抽屉 */}
      <Drawer
        title="估算结果对比"
        open={showComparison}
        onClose={() => setShowComparison(false)}
        width={1200}
      >
        <Table
          dataSource={comparisonList}
          columns={[
            { title: '估算方案', dataIndex: 'name', fixed: 'left' as const, width: 200 },
            {
              title: '估算方式',
              dataIndex: 'type',
              render: (v: string) => v === 'template' ?
                <Tag color="blue">模板</Tag> : <Tag color="green">AI</Tag>
            },
            { title: '使用模板/模型', dataIndex: 'template_name' },
            {
              title: '总造价',
              dataIndex: 'total_cost',
              render: (v: number) => `¥${(v/10000).toFixed(2)}万`,
              sorter: (a: any, b: any) => a.total_cost - b.total_cost
            },
            {
              title: '单位造价',
              dataIndex: 'unit_cost',
              render: (v: number) => `¥${v.toFixed(2)}/㎡`,
              sorter: (a: any, b: any) => a.unit_cost - b.unit_cost
            },
            {
              title: '时间调整',
              dataIndex: 'time_factor',
              render: (v: number) => v.toFixed(3)
            },
            {
              title: '置信度',
              dataIndex: 'confidence',
              render: (v: number) => `${(v * 100).toFixed(1)}%`,
              sorter: (a: any, b: any) => a.confidence - b.confidence
            },
            { title: '创建时间', dataIndex: 'timestamp' },
            {
              title: '操作',
              render: (_: any, record: any) => (
                <Button
                  type="text"
                  danger
                  size="small"
                  onClick={() => setComparisonList(comparisonList.filter(item => item.id !== record.id))}
                >
                  移除
                </Button>
              )
            }
          ]}
          scroll={{ x: 1200 }}
          pagination={false}
        />
      </Drawer>
    </div>
  )
}

export default SmartEstimatePage
