import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Empty,
  Modal,
  Descriptions,
  Timeline,
  Tooltip,
  message,
  Popconfirm,
  Rate,
  Dropdown,
  MenuProps,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  StarOutlined,
  HistoryOutlined,
  MoreOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RobotOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { RangePicker } = DatePicker

interface QueryHistory {
  id: string
  sessionTitle: string
  question: string
  answer: string
  questionTime: string
  answerTime: string
  sessionMessages: number
  rating?: number
  feedback?: 'positive' | 'negative'
  relatedDocs?: string[]
  category?: string
  tokensUsed?: number
}

const QueryHistoryPage: React.FC = () => {
  const [histories, setHistories] = useState<QueryHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [ratingFilter, setRatingFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<QueryHistory | null>(null)

  // 模拟数据
  useEffect(() => {
    const mockData: QueryHistory[] = [
      {
        id: '1',
        sessionTitle: '工程造价计算方法咨询',
        question: '请问建筑工程造价计算的基本方法和步骤是什么？',
        answer: '建筑工程造价计算主要包括以下步骤：1. 工程量计算，2. 单价分析，3. 费用计算，4. 风险评估，5. 最终审核。具体方法包括定额法、清单计价法、类比法等。',
        questionTime: '2024-01-20 10:30:00',
        answerTime: '2024-01-20 10:30:45',
        sessionMessages: 3,
        rating: 5,
        feedback: 'positive',
        relatedDocs: ['工程造价管理规范.pdf', '预算编制指南.docx'],
        category: '造价计算',
        tokensUsed: 256,
      },
      {
        id: '2',
        sessionTitle: '施工合同问题',
        question: '施工合同中需要注意哪些关键条款？',
        answer: '施工合同的关键条款包括：1. 工程范围和质量标准，2. 工期和进度安排，3. 付款方式和节点，4. 违约责任和赔偿，5. 争议解决方式等。',
        questionTime: '2024-01-20 11:15:00',
        answerTime: '2024-01-20 11:15:30',
        sessionMessages: 2,
        rating: 4,
        feedback: 'positive',
        relatedDocs: ['合同管理手册.pdf', '施工合同范本.docx'],
        category: '合同管理',
        tokensUsed: 189,
      },
      {
        id: '3',
        sessionTitle: '建筑材料价格咨询',
        question: '目前钢材和水泥的市场价格走势如何？',
        answer: '根据最新市场数据，钢材价格近期有所上涨，主要受原材料成本和市场需求影响。建议关注期货市场和供应商报价，适时采购。',
        questionTime: '2024-01-20 14:20:00',
        answerTime: '2024-01-20 14:21:00',
        sessionMessages: 2,
        rating: 3,
        feedback: 'negative',
        relatedDocs: ['建筑材料价格表.txt'],
        category: '材料价格',
        tokensUsed: 142,
      },
      {
        id: '4',
        sessionTitle: '项目可行性研究',
        question: '如何进行项目可行性研究的成本估算？',
        answer: '项目可行性研究的成本估算包括：1. 投资估算，2. 运营成本分析，3. 收益预测，4. 风险评估。需要考虑土地、建筑、设备、人工、材料等各项费用。',
        questionTime: '2024-01-20 15:45:00',
        answerTime: '2024-01-20 15:46:15',
        sessionMessages: 4,
        rating: 5,
        feedback: 'positive',
        relatedDocs: ['可行性研究报告模板.pdf', '项目投资指南.docx'],
        category: '可行性研究',
        tokensUsed: 312,
      },
      {
        id: '5',
        sessionTitle: '质量控制标准',
        question: '建筑工程质量控制的主要标准是什么？',
        answer: '建筑工程质量控制标准主要包括：1. 国家强制性标准，2. 行业推荐性标准，3. 地方性标准，4. 企业标准。质量控制应遵循PDCA循环原则。',
        questionTime: '2024-01-20 16:30:00',
        answerTime: '2024-01-20 16:30:20',
        sessionMessages: 1,
        rating: 4,
        feedback: 'positive',
        relatedDocs: ['质量管理规范.pdf'],
        category: '质量控制',
        tokensUsed: 178,
      },
    ]
    setHistories(mockData)
  }, [])

  // 统计信息
  const stats = {
    total: histories.length,
    today: histories.filter(h => dayjs(h.questionTime).isSame(dayjs(), 'day')).length,
    thisWeek: histories.filter(h => dayjs(h.questionTime).isSame(dayjs().subtract(1, 'week'), 'week')).length,
    avgRating: histories.length > 0 ? (histories.reduce((sum, h) => sum + (h.rating || 0), 0) / histories.length).toFixed(1) : '0.0',
    totalTokens: histories.reduce((sum, h) => sum + (h.tokensUsed || 0), 0),
  }

  // 过滤历史记录
  const filteredHistories = histories.filter(history => {
    // 搜索过滤
    const matchesSearch = !searchText ||
      history.question.toLowerCase().includes(searchText.toLowerCase()) ||
      history.answer.toLowerCase().includes(searchText.toLowerCase()) ||
      history.sessionTitle.toLowerCase().includes(searchText.toLowerCase())

    // 分类过滤
    const matchesCategory = categoryFilter === 'all' || history.category === categoryFilter

    // 评分过滤
    const matchesRating = ratingFilter === 'all' ||
      (ratingFilter === 'high' && history.rating && history.rating >= 4) ||
      (ratingFilter === 'medium' && history.rating && history.rating >= 3 && history.rating < 4) ||
      (ratingFilter === 'low' && history.rating && history.rating < 3)

    // 日期过滤
    const matchesDate = !dateRange ||
      (dayjs(history.questionTime).isAfter(dateRange[0]) &&
       dayjs(history.questionTime).isBefore(dateRange[1].add(1, 'day')))

    return matchesSearch && matchesCategory && matchesRating && matchesDate
  })

  // 获取评分标签
  const getRatingTag = (rating?: number) => {
    if (!rating) return <Tag>未评分</Tag>
    if (rating >= 4.5) return <Tag color="success">优秀</Tag>
    if (rating >= 3.5) return <Tag color="processing">良好</Tag>
    if (rating >= 2.5) return <Tag color="warning">一般</Tag>
    return <Tag color="error">需改进</Tag>
  }

  // 获取分类标签
  const getCategoryTag = (category?: string) => {
    const colors: Record<string, string> = {
      '造价计算': 'blue',
      '合同管理': 'green',
      '材料价格': 'orange',
      '可行性研究': 'purple',
      '质量控制': 'red',
      '进度管理': 'cyan',
    }
    return <Tag color={colors[category || ''] || 'default'}>{category || '其他'}</Tag>
  }

  // 查看详情
  const handleViewDetail = (record: QueryHistory) => {
    setSelectedHistory(record)
    setDetailVisible(true)
  }

  // 删除记录
  const handleDelete = (id: string) => {
    setHistories(prev => prev.filter(item => item.id !== id))
    message.success('查询记录已删除')
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        setHistories(prev => prev.filter(item => !selectedRowKeys.includes(item.id)))
        setSelectedRowKeys([])
        message.success('批量删除成功')
      },
    })
  }

  // 刷新列表
  const handleRefresh = () => {
    setLoading(true)
    // 模拟刷新
    setTimeout(() => {
      setLoading(false)
      message.success('列表已刷新')
    }, 1000)
  }

  // 导出记录
  const handleExport = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要导出的记录')
      return
    }
    message.success(`正在导出 ${selectedRowKeys.length} 条记录...`)
  }

  // 复制内容
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    message.success('已复制到剪贴板')
  }

  // 更多操作菜单
  const getMoreMenuItems = (record: QueryHistory): MenuProps['items'] => [
    {
      key: 'copy-question',
      label: '复制问题',
      icon: <CopyOutlined />,
      onClick: () => handleCopy(record.question),
    },
    {
      key: 'copy-answer',
      label: '复制回答',
      icon: <CopyOutlined />,
      onClick: () => handleCopy(record.answer),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDelete(record.id),
    },
  ]

  // 表格列定义
  const columns: ColumnsType<QueryHistory> = [
    {
      title: '会话标题',
      dataIndex: 'sessionTitle',
      key: 'sessionTitle',
      render: (text: string, record: QueryHistory) => (
        <Space>
          <HistoryOutlined />
          <Text strong>{text}</Text>
          <Text type="secondary">({record.sessionMessages}条消息)</Text>
        </Space>
      ),
    },
    {
      title: '问题分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => getCategoryTag(category),
    },
    {
      title: '问题内容',
      dataIndex: 'question',
      key: 'question',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text ellipsis style={{ maxWidth: 300 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: number) => (
        <Space>
          {getRatingTag(rating)}
          <Rate disabled defaultValue={rating} style={{ fontSize: 12 }} />
        </Space>
      ),
    },
    {
      title: 'Token使用',
      dataIndex: 'tokensUsed',
      key: 'tokensUsed',
      render: (tokens: number) => (
        <Tag color="blue">{tokens} tokens</Tag>
      ),
    },
    {
      title: '查询时间',
      dataIndex: 'questionTime',
      key: 'questionTime',
      sorter: (a, b) => dayjs(a.questionTime).unix() - dayjs(b.questionTime).unix(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: QueryHistory) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Dropdown
            menu={{ items: getMoreMenuItems(record) }}
            trigger={['click']}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
            />
          </Dropdown>
        </Space>
      ),
    },
  ]

  // 表格选择配置
  const rowSelection: TableProps<QueryHistory>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>查询历史</Title>
        <Paragraph type="secondary">
          查看和管理智能问答历史记录，支持搜索、筛选和导出
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总查询数"
              value={stats.total}
              prefix={<SearchOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日查询"
              value={stats.today}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="本周查询"
              value={stats.thisWeek}
              valueStyle={{ color: '#1890ff' }}
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
        <Col span={4}>
          <Card>
            <Statistic
              title="总Token使用"
              value={stats.totalTokens}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索问题或回答内容"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="分类筛选"
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部分类</Select.Option>
              <Select.Option value="造价计算">造价计算</Select.Option>
              <Select.Option value="合同管理">合同管理</Select.Option>
              <Select.Option value="材料价格">材料价格</Select.Option>
              <Select.Option value="可行性研究">可行性研究</Select.Option>
              <Select.Option value="质量控制">质量控制</Select.Option>
              <Select.Option value="进度管理">进度管理</Select.Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="评分筛选"
              value={ratingFilter}
              onChange={setRatingFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部评分</Select.Option>
              <Select.Option value="high">优秀 (4.5+)</Select.Option>
              <Select.Option value="medium">良好 (3.5-4.4)</Select.Option>
              <Select.Option value="low">需改进 (3.4-)</Select.Option>
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
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
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

      {/* 历史记录列表 */}
      <Card title="查询历史记录">
        {filteredHistories.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredHistories}
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
          <Empty description="暂无查询历史记录" />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            <Text>查询详情</Text>
            {selectedHistory && (
              <>
                {getRatingTag(selectedHistory.rating)}
                {selectedHistory.relatedDocs && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                  {selectedHistory.relatedDocs.length} 个相关文档
                </Tag>
                )}
              </>
            )}
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedHistory && (
          <div>
            <Descriptions title="基本信息" column={2} bordered>
              <Descriptions.Item label="会话标题" span={2}>
                {selectedHistory.sessionTitle}
              </Descriptions.Item>
              <Descriptions.Item label="问题分类">
                {getCategoryTag(selectedHistory.category)}
              </Descriptions.Item>
              <Descriptions.Item label="评分">
                <Space>
                  {getRatingTag(selectedHistory.rating)}
                  <Rate disabled defaultValue={selectedHistory.rating} />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Token使用">
                <Tag color="blue">{selectedHistory.tokensUsed} tokens</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="查询时间">
                {selectedHistory.questionTime}
              </Descriptions.Item>
              <Descriptions.Item label="回答时间">
                {selectedHistory.answerTime}
              </Descriptions.Item>
              <Descriptions.Item label="消息数量" span={2}>
                {selectedHistory.sessionMessages} 条
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5}>问题内容</Title>
            <Paragraph
              style={{
                backgroundColor: '#f5f5f5',
                padding: '16px',
                borderRadius: '6px',
              }}
            >
              {selectedHistory.question}
            </Paragraph>

            <Divider />

            <Title level={5}>AI回答</Title>
            <Paragraph
              style={{
                backgroundColor: '#e6f7ff',
                padding: '16px',
                borderRadius: '6px',
              }}
            >
              {selectedHistory.answer}
            </Paragraph>

            {selectedHistory.relatedDocs && selectedHistory.relatedDocs.length > 0 && (
              <>
                <Divider />
                <Title level={5}>相关文档</Title>
                <Space wrap>
                  {selectedHistory.relatedDocs.map((doc, index) => (
                    <Tag key={index} color="blue">
                      {doc}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default QueryHistoryPage