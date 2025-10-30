import React, { useState } from 'react'
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Select,
  InputNumber,
  Row,
  Col,
  Table,
  Space,
  Modal,
  Steps,
  Divider,
  Alert,
  Tag,
  Tooltip,
  message,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  EyeOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  DollarOutlined,
  PercentageOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select
const { Step } = Steps

interface CostItem {
  id: string
  category: string
  subcategory: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
  totalAmount: number
  marginRate: number
  finalAmount: number
  remarks?: string
}

interface EstimateInfo {
  projectName: string
  projectType: string
  location: string
  clientName: string
  estimatedPeriod: string
  currency: string
  taxRate: number
  overheadRate: number
  contingencyRate: number
  profitMargin: number
  description: string
}

const CreateEstimatePage: React.FC = () => {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [costItems, setCostItems] = useState<CostItem[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [estimateInfo, setEstimateInfo] = useState<EstimateInfo>({
    projectName: '',
    projectType: '',
    location: '',
    clientName: '',
    estimatedPeriod: '',
    currency: 'CNY',
    taxRate: 9,
    overheadRate: 15,
    contingencyRate: 5,
    profitMargin: 10,
    description: '',
  })

  // 项目类型选项
  const projectTypes = [
    '住宅建筑',
    '商业建筑',
    '工业建筑',
    '基础设施',
    '装修工程',
    '园林工程',
    '其他工程',
  ]

  // 成本分类选项
  const costCategories = [
    {
      label: '土建工程',
      value: 'civil',
      subcategories: ['基础工程', '主体结构', '砌筑工程', '屋面工程', '装饰工程'],
    },
    {
      label: '安装工程',
      value: 'installation',
      subcategories: ['给排水工程', '电气工程', '暖通工程', '消防工程', '智能化工程'],
    },
    {
      label: '材料费用',
      value: 'materials',
      subcategories: ['主要材料', '辅助材料', '周转材料', '设备材料'],
    },
    {
      label: '人工费用',
      value: 'labor',
      subcategories: ['技术工人', '普通工人', '管理人员', '特殊工种'],
    },
    {
      label: '机械费用',
      value: 'machinery',
      subcategories: ['大型机械', '小型机械', '运输车辆', '检测设备'],
    },
    {
      label: '其他费用',
      value: 'others',
      subcategories: ['临时设施', '安全文明', '环保费用', '其他费用'],
    },
  ]

  // 单位选项
  const units = ['m³', 'm²', 'm', 't', 'kg', '台', '套', '项', '工日', '车次']

  // 货币选项
  const currencies = [
    { label: '人民币(CNY)', value: 'CNY' },
    { label: '美元(USD)', value: 'USD' },
    { label: '欧元(EUR)', value: 'EUR' },
  ]

  // 添加成本项
  const handleAddItem = () => {
    const newItem: CostItem = {
      id: Date.now().toString(),
      category: '',
      subcategory: '',
      description: '',
      unit: 'm²',
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      marginRate: 10,
      finalAmount: 0,
    }
    setCostItems([...costItems, newItem])
  }

  // 删除成本项
  const handleDeleteItem = (id: string) => {
    setCostItems(costItems.filter(item => item.id !== id))
  }

  // 更新成本项
  const handleUpdateItem = (id: string, field: keyof CostItem, value: any) => {
    setCostItems(costItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        // 重新计算金额
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.totalAmount = updatedItem.quantity * updatedItem.unitPrice
          updatedItem.finalAmount = updatedItem.totalAmount * (1 + updatedItem.marginRate / 100)
        }
        if (field === 'marginRate') {
          updatedItem.finalAmount = updatedItem.totalAmount * (1 + value / 100)
        }
        return updatedItem
      }
      return item
    }))
  }

  // 计算总计
  const calculateTotal = () => {
    const subtotal = costItems.reduce((sum, item) => sum + item.finalAmount, 0)
    const overhead = subtotal * (estimateInfo.overheadRate / 100)
    const contingency = (subtotal + overhead) * (estimateInfo.contingencyRate / 100)
    const subtotalWithContingency = subtotal + overhead + contingency
    const tax = subtotalWithContingency * (estimateInfo.taxRate / 100)
    const total = subtotalWithContingency + tax
    const profit = total * (estimateInfo.profitMargin / 100)
    const finalTotal = total + profit

    return {
      subtotal,
      overhead,
      contingency,
      tax,
      profit,
      finalTotal,
    }
  }

  // 表格列定义
  const columns: ColumnsType<CostItem> = [
    {
      title: '成本分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (value, record) => (
        <Select
          value={value}
          placeholder="选择分类"
          style={{ width: '100%' }}
          onChange={(val) => handleUpdateItem(record.id, 'category', val)}
        >
          {costCategories.map(cat => (
            <Option key={cat.value} value={cat.value}>{cat.label}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '子分类',
      dataIndex: 'subcategory',
      key: 'subcategory',
      width: 120,
      render: (value, record) => {
        const selectedCategory = costCategories.find(cat => cat.value === record.category)
        return (
          <Select
            value={value}
            placeholder="选择子分类"
            style={{ width: '100%' }}
            onChange={(val) => handleUpdateItem(record.id, 'subcategory', val)}
          >
            {selectedCategory?.subcategories.map(sub => (
              <Option key={sub} value={sub}>{sub}</Option>
            ))}
          </Select>
        )
      },
    },
    {
      title: '项目描述',
      dataIndex: 'description',
      key: 'description',
      render: (value, record) => (
        <Input
          value={value}
          placeholder="输入项目描述"
          onChange={(e) => handleUpdateItem(record.id, 'description', e.target.value)}
        />
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      render: (value, record) => (
        <Select
          value={value}
          style={{ width: '100%' }}
          onChange={(val) => handleUpdateItem(record.id, 'unit', val)}
        >
          {units.map(unit => (
            <Option key={unit} value={unit}>{unit}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          onChange={(val) => handleUpdateItem(record.id, 'quantity', val || 0)}
        />
      ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 120,
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          prefix={<DollarOutlined />}
          onChange={(val) => handleUpdateItem(record.id, 'unitPrice', val || 0)}
        />
      ),
    },
    {
      title: '小计',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (value) => (
        <Text strong>{value.toFixed(2)}</Text>
      ),
    },
    {
      title: '利润率(%)',
      dataIndex: 'marginRate',
      key: 'marginRate',
      width: 100,
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          max={100}
          precision={1}
          style={{ width: '100%' }}
          suffix="%"
          onChange={(val) => handleUpdateItem(record.id, 'marginRate', val || 0)}
        />
      ),
    },
    {
      title: '合计',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      width: 120,
      render: (value) => (
        <Text strong style={{ color: '#1890ff' }}>{value.toFixed(2)}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个成本项吗？"
          onConfirm={() => handleDeleteItem(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      ),
    },
  ]

  // 步骤配置
  const steps = [
    {
      title: '基本信息',
      description: '填写项目基本信息',
    },
    {
      title: '成本明细',
      description: '添加成本项目',
    },
    {
      title: '费率设置',
      description: '设置各项费率',
    },
    {
      title: '预览确认',
      description: '预览并确认估算',
    },
  ]

  const totals = calculateTotal()

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>新建成本估算</Title>
        <Paragraph type="secondary">
          创建新的项目成本估算，包含详细的成本分析和费用计算
        </Paragraph>
      </div>

      {/* 步骤指示器 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} size="small">
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
            />
          ))}
        </Steps>
      </Card>

      {/* 第一步：基本信息 */}
      {currentStep === 0 && (
        <Card title="项目基本信息">
          <Form
            form={form}
            layout="vertical"
            initialValues={estimateInfo}
            onValuesChange={(_, allValues) => setEstimateInfo(allValues)}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="项目名称"
                  name="projectName"
                  rules={[{ required: true, message: '请输入项目名称' }]}
                >
                  <Input placeholder="输入项目名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="项目类型"
                  name="projectType"
                  rules={[{ required: true, message: '请选择项目类型' }]}
                >
                  <Select placeholder="选择项目类型">
                    {projectTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="项目地点"
                  name="location"
                  rules={[{ required: true, message: '请输入项目地点' }]}
                >
                  <Input placeholder="输入项目地点" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="客户名称"
                  name="clientName"
                  rules={[{ required: true, message: '请输入客户名称' }]}
                >
                  <Input placeholder="输入客户名称" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="估算期间"
                  name="estimatedPeriod"
                  rules={[{ required: true, message: '请输入估算期间' }]}
                >
                  <Input placeholder="如：2024年第1季度" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="货币单位"
                  name="currency"
                  rules={[{ required: true, message: '请选择货币单位' }]}
                >
                  <Select>
                    {currencies.map(currency => (
                      <Option key={currency.value} value={currency.value}>
                        {currency.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="项目描述"
              name="description"
            >
              <TextArea
                rows={4}
                placeholder="输入项目详细描述..."
                maxLength={500}
                showCount
              />
            </Form.Item>

            <div style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={() => setCurrentStep(1)}>
                下一步
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* 第二步：成本明细 */}
      {currentStep === 1 && (
        <Card title="成本明细">
          <Alert
            message="添加成本项目"
            description="请添加详细的成本项目，包括人工、材料、机械等各项费用"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddItem}
            >
              添加成本项
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={costItems}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1200 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6}>
                  <Text strong>小计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <Text strong>{totals.subtotal.toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} colSpan={2}>
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9}>
                  <Text strong style={{ color: '#1890ff' }}>
                    {costItems.reduce((sum, item) => sum + item.finalAmount, 0).toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                上一步
              </Button>
              <Button
                type="primary"
                onClick={() => setCurrentStep(2)}
                disabled={costItems.length === 0}
              >
                下一步
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 第三步：费率设置 */}
      {currentStep === 2 && (
        <Card title="费率设置">
          <Alert
            message="费用率设置"
            description="设置管理费、不可预见费、税费和利润率等各项费率参数"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="管理费率">
                <InputNumber
                  value={estimateInfo.overheadRate}
                  min={0}
                  max={50}
                  precision={1}
                  suffix="%"
                  style={{ width: '100%' }}
                  onChange={(value) => setEstimateInfo(prev => ({
                    ...prev,
                    overheadRate: value || 0
                  }))}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  管理费用按总成本的百分比计算
                </Text>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="不可预见费率">
                <InputNumber
                  value={estimateInfo.contingencyRate}
                  min={0}
                  max={30}
                  precision={1}
                  suffix="%"
                  style={{ width: '100%' }}
                  onChange={(value) => setEstimateInfo(prev => ({
                    ...prev,
                    contingencyRate: value || 0
                  }))}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  用于应对意外情况和风险
                </Text>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small" title="税率">
                <InputNumber
                  value={estimateInfo.taxRate}
                  min={0}
                  max={20}
                  precision={1}
                  suffix="%"
                  style={{ width: '100%' }}
                  onChange={(value) => setEstimateInfo(prev => ({
                    ...prev,
                    taxRate: value || 0
                  }))}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  增值税率或其他相关税率
                </Text>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="利润率">
                <InputNumber
                  value={estimateInfo.profitMargin}
                  min={0}
                  max={50}
                  precision={1}
                  suffix="%"
                  style={{ width: '100%' }}
                  onChange={(value) => setEstimateInfo(prev => ({
                    ...prev,
                    profitMargin: value || 0
                  }))}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  预期利润率
                </Text>
              </Card>
            </Col>
          </Row>

          {/* 费用汇总 */}
          <Card size="small" title="费用汇总" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="直接成本"
                  value={totals.subtotal}
                  precision={2}
                  prefix={<DollarOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="管理费用"
                  value={totals.overhead}
                  precision={2}
                  prefix={<PercentageOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="不可预见费"
                  value={totals.contingency}
                  precision={2}
                  prefix={<InfoCircleOutlined />}
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="税费"
                  value={totals.tax}
                  precision={2}
                  prefix={<CalculatorOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="利润"
                  value={totals.profit}
                  precision={2}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="总计"
                  value={totals.finalTotal}
                  precision={2}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </Card>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(1)}>
                上一步
              </Button>
              <Button type="primary" onClick={() => setCurrentStep(3)}>
                下一步
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 第四步：预览确认 */}
      {currentStep === 3 && (
        <Card title="估算预览">
          <Alert
            message="确认估算信息"
            description="请仔细核对以下估算信息，确认无误后保存"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* 项目信息摘要 */}
          <Card size="small" title="项目信息" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>项目名称：</Text>
                <Text>{estimateInfo.projectName}</Text>
              </Col>
              <Col span={8}>
                <Text strong>项目类型：</Text>
                <Text>{estimateInfo.projectType}</Text>
              </Col>
              <Col span={8}>
                <Text strong>项目地点：</Text>
                <Text>{estimateInfo.location}</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Text strong>客户名称：</Text>
                <Text>{estimateInfo.clientName}</Text>
              </Col>
              <Col span={8}>
                <Text strong>估算期间：</Text>
                <Text>{estimateInfo.estimatedPeriod}</Text>
              </Col>
              <Col span={8}>
                <Text strong>货币单位：</Text>
                <Text>{estimateInfo.currency}</Text>
              </Col>
            </Row>
          </Card>

          {/* 成本项目汇总 */}
          <Card size="small" title="成本项目汇总" style={{ marginBottom: 16 }}>
            <Table
              dataSource={costItems}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '分类', dataIndex: 'category', key: 'category' },
                { title: '子分类', dataIndex: 'subcategory', key: 'subcategory' },
                { title: '描述', dataIndex: 'description', key: 'description' },
                { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice' },
                { title: '合计', dataIndex: 'finalAmount', key: 'finalAmount' },
              ]}
            />
          </Card>

          {/* 最终费用 */}
          <Card size="small" title="最终费用">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="直接成本"
                  value={totals.subtotal}
                  precision={2}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="管理费用"
                  value={totals.overhead}
                  precision={2}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="不可预见费"
                  value={totals.contingency}
                  precision={2}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="税费"
                  value={totals.tax}
                  precision={2}
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="利润"
                  value={totals.profit}
                  precision={2}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="项目总计"
                  value={totals.finalTotal}
                  precision={2}
                  valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </Card>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(2)}>
                上一步
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setPreviewVisible(true)}
              >
                预览报告
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={() => {
                  setLoading(true)
                  // 模拟保存
                  setTimeout(() => {
                    setLoading(false)
                    message.success('成本估算已保存成功')
                  }, 2000)
                }}
              >
                保存估算
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 预览弹窗 */}
      <Modal
        title="成本估算报告预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button key="export" type="primary" icon={<FileTextOutlined />}>
            导出报告
          </Button>,
        ]}
        width={1000}
      >
        <div style={{ padding: '20px' }}>
          <Title level={3} style={{ textAlign: 'center' }}>
            {estimateInfo.projectName} - 成本估算报告
          </Title>
          <Divider />

          {/* 报告内容可以进一步展开 */}
          <Alert
            message="报告预览"
            description="完整的成本估算报告将在实际导出时生成"
            type="info"
            showIcon
          />
        </div>
      </Modal>
    </div>
  )
}

export default CreateEstimatePage