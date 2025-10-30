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
  Tabs,
  List,
  Avatar,
  Badge,
  Alert,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  FileTextOutlined,
  DollarOutlined,
  AppstoreOutlined,
  StarOutlined,
  DownloadOutlined,
  UploadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { TabPane } = Tabs

interface EstimateTemplate {
  id: string
  name: string
  category: string
  projectType: string
  description: string
  version: string
  isSystem: boolean
  isPublic: boolean
  rating: number
  usageCount: number
  createdAt: string
  updatedAt: string
  creator: string
  tags: string[]
  previewImage?: string
  estimatedAmount: {
    min: number
    max: number
    currency: string
  }
  features: string[]
}

interface TemplateCategory {
  key: string
  name: string
  description: string
  icon: React.ReactNode
  count: number
}

const EstimateTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [detailVisible, setDetailVisible] = useState(false)
  const [createVisible, setCreateVisible] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EstimateTemplate | null>(null)

  // 模拟数据
  useEffect(() => {
    const mockData: EstimateTemplate[] = [
      {
        id: '1',
        name: '住宅建筑工程模板',
        category: 'residential',
        projectType: '住宅建筑',
        description: '适用于高层住宅楼、别墅、公寓等住宅类建筑项目的成本估算模板，包含土建、安装、装修等完整工程内容。',
        version: '2.1.0',
        isSystem: true,
        isPublic: true,
        rating: 4.8,
        usageCount: 1250,
        createdAt: '2024-01-01 00:00:00',
        updatedAt: '2024-01-15 10:30:00',
        creator: '系统',
        tags: ['住宅', '高层', '别墅', '公寓'],
        estimatedAmount: {
          min: 1000000,
          max: 50000000,
          currency: 'CNY',
        },
        features: [
          '包含完整的土建工程估算项目',
          '涵盖给排水、电气、暖通等专业安装工程',
          '提供多种装修标准和选项',
          '支持地区价格调整',
          '包含详细的工程量清单',
        ],
      },
      {
        id: '2',
        name: '商业综合体模板',
        category: 'commercial',
        projectType: '商业建筑',
        description: '适用于购物中心、写字楼、酒店等商业综合体的成本估算模板，重点考虑商业空间的特殊需求。',
        version: '1.5.2',
        isSystem: false,
        isPublic: true,
        rating: 4.6,
        usageCount: 856,
        createdAt: '2024-01-05 14:20:00',
        updatedAt: '2024-01-18 16:45:00',
        creator: '李造价师',
        tags: ['商业', '综合体', '购物中心', '写字楼'],
        estimatedAmount: {
          min: 5000000,
          max: 100000000,
          currency: 'CNY',
        },
        features: [
          '考虑商业空间的特殊布局要求',
          '包含中央空调、消防等特殊系统',
          '支持店铺分割和灵活组合',
          '提供多种外立面装修选项',
        ],
      },
      {
        id: '3',
        name: '工业厂房模板',
        category: 'industrial',
        projectType: '工业建筑',
        description: '适用于各类工业厂房、仓库、生产车间等工业建筑的成本估算模板，注重生产功能需求。',
        version: '1.3.0',
        isSystem: true,
        isPublic: true,
        rating: 4.5,
        usageCount: 623,
        createdAt: '2024-01-08 09:15:00',
        updatedAt: '2024-01-12 11:30:00',
        creator: '系统',
        tags: ['工业', '厂房', '仓库', '生产车间'],
        estimatedAmount: {
          min: 2000000,
          max: 80000000,
          currency: 'CNY',
        },
        features: [
          '考虑生产设备的安装要求',
          '包含重型荷载和特殊基础',
          '支持工艺流程布局',
          '提供环保和安全设施选项',
        ],
      },
      {
        id: '4',
        name: '市政道路工程模板',
        category: 'infrastructure',
        projectType: '基础设施',
        description: '适用于城市道路、桥梁、管网等市政基础设施的成本估算模板，符合市政工程标准。',
        version: '2.0.1',
        isSystem: true,
        isPublic: true,
        rating: 4.7,
        usageCount: 934,
        createdAt: '2024-01-10 13:45:00',
        updatedAt: '2024-01-20 15:20:00',
        creator: '系统',
        tags: ['市政', '道路', '桥梁', '管网'],
        estimatedAmount: {
          min: 5000000,
          max: 200000000,
          currency: 'CNY',
        },
        features: [
          '符合市政工程计价规范',
          '包含道路、排水、照明等系统',
          '支持不同等级道路标准',
          '考虑交通组织和安全设施',
        ],
      },
      {
        id: '5',
        name: '精装修工程模板',
        category: 'decoration',
        projectType: '装修工程',
        description: '适用于住宅、商业空间的精装修工程成本估算模板，提供多种装修风格和标准。',
        version: '1.8.0',
        isSystem: false,
        isPublic: true,
        rating: 4.4,
        usageCount: 445,
        createdAt: '2024-01-12 16:30:00',
        updatedAt: '2024-01-19 09:45:00',
        creator: '王设计师',
        tags: ['装修', '精装', '室内设计', '软装'],
        estimatedAmount: {
          min: 500000,
          max: 10000000,
          currency: 'CNY',
        },
        features: [
          '提供多种装修风格选择',
          '包含主材和人工费用',
          '支持个性化定制选项',
          '考虑智能家居集成',
        ],
      },
      {
        id: '6',
        name: '园林景观模板',
        category: 'landscape',
        projectType: '园林工程',
        description: '适用于公园、小区景观、庭院等园林景观工程成本估算模板，注重生态和美观效果。',
        version: '1.2.5',
        isSystem: false,
        isPublic: false,
        rating: 4.3,
        usageCount: 234,
        createdAt: '2024-01-15 11:20:00',
        updatedAt: '2024-01-17 14:10:00',
        creator: '张园艺师',
        tags: ['园林', '景观', '绿化', '庭院'],
        estimatedAmount: {
          min: 300000,
          max: 15000000,
          currency: 'CNY',
        },
        features: [
          '包含植物配置和景观小品',
          '考虑季节变化和维护成本',
          '支持生态设计理念',
          '提供灌溉系统选项',
        ],
      },
    ]
    setTemplates(mockData)
  }, [])

  // 模板分类
  const categories: TemplateCategory[] = [
    {
      key: 'all',
      name: '全部模板',
      description: '查看所有类型的估算模板',
      icon: <AppstoreOutlined />,
      count: templates.length,
    },
    {
      key: 'residential',
      name: '住宅建筑',
      description: '住宅楼、别墅、公寓等',
      icon: <FileTextOutlined />,
      count: templates.filter(t => t.category === 'residential').length,
    },
    {
      key: 'commercial',
      name: '商业建筑',
      description: '购物中心、写字楼、酒店等',
      icon: <DollarOutlined />,
      count: templates.filter(t => t.category === 'commercial').length,
    },
    {
      key: 'industrial',
      name: '工业建筑',
      description: '厂房、仓库、生产车间等',
      icon: <SettingOutlined />,
      count: templates.filter(t => t.category === 'industrial').length,
    },
    {
      key: 'infrastructure',
      name: '基础设施',
      description: '道路、桥梁、管网等',
      icon: <FileTextOutlined />,
      count: templates.filter(t => t.category === 'infrastructure').length,
    },
    {
      key: 'decoration',
      name: '装修工程',
      description: '室内外装修、精装等',
      icon: <StarOutlined />,
      count: templates.filter(t => t.category === 'decoration').length,
    },
    {
      key: 'landscape',
      name: '园林工程',
      description: '公园、景观、绿化等',
      icon: <FileTextOutlined />,
      count: templates.filter(t => t.category === 'landscape').length,
    },
  ]

  // 统计信息
  const stats = {
    total: templates.length,
    system: templates.filter(t => t.isSystem).length,
    public: templates.filter(t => t.isPublic).length,
    private: templates.filter(t => !t.isPublic).length,
    totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
    avgRating: templates.length > 0 ? (templates.reduce((sum, t) => sum + t.rating, 0) / templates.length).toFixed(1) : '0.0',
  }

  // 过滤和排序模板
  const filteredTemplates = templates
    .filter(template => {
      // 分类过滤
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter

      // 搜索过滤
      const matchesSearch = !searchText ||
        template.name.toLowerCase().includes(searchText.toLowerCase()) ||
        template.description.toLowerCase().includes(searchText.toLowerCase()) ||
        template.tags?.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()))

      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      // 排序
      switch (sortBy) {
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        case 'popular':
          return b.usageCount - a.usageCount
        case 'rating':
          return b.rating - a.rating
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

  // 使用模板
  const handleUseTemplate = (template: EstimateTemplate) => {
    message.success(`正在使用模板"${template.name}"创建新估算...`)
    // 这里可以跳转到新建估算页面并预填充模板数据
  }

  // 查看详情
  const handleViewDetail = (template: EstimateTemplate) => {
    setSelectedTemplate(template)
    setDetailVisible(true)
  }

  // 复制模板
  const handleCopyTemplate = (template: EstimateTemplate) => {
    message.success(`模板"${template.name}"已复制，可以在个人模板中编辑`)
  }

  // 删除模板
  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(item => item.id !== id))
    message.success('模板已删除')
  }

  // 渲染模板卡片
  const renderTemplateCard = (template: EstimateTemplate) => (
    <Card
      key={template.id}
      hoverable
      style={{ marginBottom: 16 }}
      actions={[
        <Tooltip title="使用模板">
          <Button
            type="text"
            icon={<FileTextOutlined />}
            onClick={() => handleUseTemplate(template)}
          >
            使用
          </Button>
        </Tooltip>,
        <Tooltip title="查看详情">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(template)}
          />
        </Tooltip>,
        <Tooltip title="复制模板">
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => handleCopyTemplate(template)}
          />
        </Tooltip>,
        !template.isSystem && (
          <Tooltip title="删除模板">
            <Popconfirm
              title="确定要删除这个模板吗？"
              onConfirm={() => handleDeleteTemplate(template.id)}
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
        ),
      ].filter(Boolean)}
    >
      <Card.Meta
        avatar={
          <Avatar
            icon={template.isSystem ? <SettingOutlined /> : <FileTextOutlined />}
            style={{ backgroundColor: template.isSystem ? '#1890ff' : '#52c41a' }}
          />
        }
        title={
          <Space>
            <Text strong>{template.name}</Text>
            {template.isSystem && <Tag color="blue">系统</Tag>}
            {template.isPublic && <Tag color="green">公开</Tag>}
            {!template.isPublic && <Tag color="orange">私有</Tag>}
          </Space>
        }
        description={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text ellipsis style={{ height: 40, overflow: 'hidden' }}>
              {template.description}
            </Text>

            <div>
              <Space wrap>
                {template.tags.slice(0, 3).map((tag, index) => (
                  <Tag key={index} size="small">{tag}</Tag>
                ))}
                {template.tags.length > 3 && (
                  <Tag size="small">+{template.tags.length - 3}</Tag>
                )}
              </Space>
            </div>

            <Row gutter={16} style={{ fontSize: '12px', color: '#666' }}>
              <Col span={8}>
                <Space>
                  <StarOutlined style={{ color: '#faad14' }} />
                  <Text>{template.rating}</Text>
                </Space>
              </Col>
              <Col span={8}>
                <Space>
                  <FileTextOutlined />
                  <Text>{template.usageCount}次使用</Text>
                </Space>
              </Col>
              <Col span={8}>
                <Text>v{template.version}</Text>
              </Col>
            </Row>

            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                估算范围: {template.estimatedAmount.currency} {(template.estimatedAmount.min / 10000).toFixed(0)}万 - {(template.estimatedAmount.max / 10000).toFixed(0)}万
              </Text>
            </div>
          </Space>
        }
      />
    </Card>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>估算模板</Title>
        <Paragraph type="secondary">
          使用预定义的成本估算模板，快速创建专业的项目成本估算
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总模板数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="系统模板"
              value={stats.system}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="公开模板"
              value={stats.public}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="私有模板"
              value={stats.private}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总使用次数"
              value={stats.totalUsage}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均评分"
              value={stats.avgRating}
              suffix="/ 5"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 分类标签 */}
      <Card style={{ marginBottom: 24 }}>
        <Tabs activeKey={categoryFilter} onChange={setCategoryFilter}>
          {categories.map(category => (
            <TabPane
              tab={
                <Space>
                  {category.icon}
                  <span>{category.name}</span>
                  <Badge count={category.count} size="small" />
                </Space>
              }
              key={category.key}
            >
              <Text type="secondary">{category.description}</Text>
            </TabPane>
          ))}
        </Tabs>
      </Card>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索模板名称或描述"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="排序方式"
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 120 }}
            >
              <Select.Option value="newest">最新发布</Select.Option>
              <Select.Option value="oldest">最早发布</Select.Option>
              <Select.Option value="popular">最受欢迎</Select.Option>
              <Select.Option value="rating">评分最高</Select.Option>
              <Select.Option value="name">按名称</Select.Option>
            </Select>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateVisible(true)}
            >
              创建模板
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 模板列表 */}
      <Card title={`模板列表 (${filteredTemplates.length})`}>
        {filteredTemplates.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredTemplates.map(template => (
              <Col key={template.id} xs={24} sm={24} md={12} lg={8} xl={6}>
                {renderTemplateCard(template)}
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无匹配的模板" />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="模板详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button key="copy" icon={<CopyOutlined />}>
            复制模板
          </Button>,
          <Button key="use" type="primary" icon={<FileTextOutlined />}>
            使用模板
          </Button>,
        ]}
        width={800}
      >
        {selectedTemplate && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="模板名称" span={2}>
                <Space>
                  <Text strong>{selectedTemplate.name}</Text>
                  {selectedTemplate.isSystem && <Tag color="blue">系统</Tag>}
                  {selectedTemplate.isPublic && <Tag color="green">公开</Tag>}
                  {!selectedTemplate.isPublic && <Tag color="orange">私有</Tag>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="项目类型">
                <Tag color="blue">{selectedTemplate.projectType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本">
                v{selectedTemplate.version}
              </Descriptions.Item>
              <Descriptions.Item label="创建者">
                {selectedTemplate.creator}
              </Descriptions.Item>
              <Descriptions.Item label="评分">
                <Space>
                  <StarOutlined style={{ color: '#faad14' }} />
                  <Text>{selectedTemplate.rating} / 5</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="使用次数">
                {selectedTemplate.usageCount} 次
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedTemplate.updatedAt}
              </Descriptions.Item>
              <Descriptions.Item label="估算范围" span={2}>
                {selectedTemplate.estimatedAmount.currency} {(selectedTemplate.estimatedAmount.min / 10000).toFixed(0)}万 - {(selectedTemplate.estimatedAmount.max / 10000).toFixed(0)}万
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>模板描述</Text>
            </div>
            <Paragraph>{selectedTemplate.description}</Paragraph>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>功能特性</Text>
            </div>
            <List
              dataSource={selectedTemplate.features}
              renderItem={(feature) => (
                <List.Item>
                  <Space>
                    <StarOutlined style={{ color: '#52c41a' }} />
                    <Text>{feature}</Text>
                  </Space>
                </List.Item>
              )}
            />

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>标签</Text>
            </div>
            <Space wrap>
              {selectedTemplate.tags.map((tag, index) => (
                <Tag key={index} color="blue">
                  {tag}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Modal>

      {/* 创建模板弹窗 */}
      <Modal
        title="创建新模板"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>
            取消
          </Button>,
          <Button key="create" type="primary">
            创建模板
          </Button>,
        ]}
      >
        <Alert
          message="模板创建功能"
          description="您可以从现有估算创建模板，或者使用模板编辑器创建新的模板。此功能正在开发中。"
          type="info"
          showIcon
        />
      </Modal>
    </div>
  )
}

export default EstimateTemplatesPage