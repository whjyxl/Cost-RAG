import React, { useState, useEffect } from 'react'
import {
  Typography,
  Card,
  Row,
  Col,
  List,
  Tag,
  Space,
  Statistic,
  Button,
  Tooltip,
  Progress,
  Avatar,
  Divider,
  Badge,
  Spin,
  message
} from 'antd'
import {
  GlobalOutlined,
  FileTextOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  LinkOutlined,
  SyncOutlined,
  NotificationOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

// 新闻资讯接口
interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  publishTime: string
  category: 'policy' | 'industry' | 'market' | 'technology'
  tags: string[]
  readCount: number
  importance: 'high' | 'medium' | 'low'
  url?: string
}

// 材料价格接口
interface MaterialPrice {
  id: string
  name: string
  specification: string
  unit: string
  currentPrice: number
  previousPrice: number
  changePercent: number
  market: string
  updateTime: string
  trend: 'up' | 'down' | 'stable'
}

const DashboardPage: React.FC = () => {
  const [newsLoading, setNewsLoading] = useState(false)
  const [priceLoading, setPriceLoading] = useState(false)
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')

  // 模拟新闻数据
  const mockNewsData: NewsItem[] = [
    {
      id: '1',
      title: '住建部发布新版工程造价咨询服务标准',
      summary: '为规范工程造价咨询服务行为，提高服务质量，住建部近日发布《工程造价咨询服务标准（2024版）》，将于2024年3月1日起实施...',
      source: '住房和城乡建设部官网',
      publishTime: '2024-01-28 10:30',
      category: 'policy',
      tags: ['政策法规', '行业标准', '工程造价'],
      readCount: 15234,
      importance: 'high',
      url: 'https://www.mohurd.gov.cn/...'
    },
    {
      id: '2',
      title: '2024年建材市场价格走势分析',
      summary: '根据最新市场数据，2024年主要建材价格整体呈现稳中有升的态势。钢材、水泥等基础材料价格保持稳定，部分装饰材料价格有所上涨...',
      source: '中国工程造价管理协会',
      publishTime: '2024-01-27 15:45',
      category: 'market',
      tags: ['市场价格', '建材', '走势分析'],
      readCount: 8921,
      importance: 'medium'
    },
    {
      id: '3',
      title: 'BIM技术在工程造价领域的应用创新',
      summary: '随着数字技术的发展，BIM技术在工程造价领域的应用日益深入。通过构建三维模型，实现工程量的精确计算和成本的动态管控...',
      source: '建筑时报',
      publishTime: '2024-01-26 09:20',
      category: 'technology',
      tags: ['BIM技术', '数字化', '创新应用'],
      readCount: 6543,
      importance: 'medium'
    },
    {
      id: '4',
      title: '全国工程造价咨询企业发展报告发布',
      summary: '中国建设工程造价管理协会发布《2023年全国工程造价咨询行业发展报告》，显示行业整体保持良好发展态势，业务收入持续增长...',
      source: '中国建设工程造价管理协会',
      publishTime: '2024-01-25 14:15',
      category: 'industry',
      tags: ['行业报告', '企业发展', '统计数据'],
      readCount: 12087,
      importance: 'high'
    }
  ]

  // 模拟材料价格数据
  const mockPriceData: MaterialPrice[] = [
    {
      id: '1',
      name: '螺纹钢',
      specification: 'HRB400 Φ16-25mm',
      unit: '吨',
      currentPrice: 4250,
      previousPrice: 4180,
      changePercent: 1.67,
      market: '上海市场',
      updateTime: '2024-01-28 16:00',
      trend: 'up'
    },
    {
      id: '2',
      name: '水泥',
      specification: 'P.O 42.5R',
      unit: '吨',
      currentPrice: 485,
      previousPrice: 488,
      changePercent: -0.61,
      market: '北京市场',
      updateTime: '2024-01-28 16:00',
      trend: 'down'
    },
    {
      id: '3',
      name: '混凝土',
      specification: 'C30',
      unit: '立方米',
      currentPrice: 420,
      previousPrice: 420,
      changePercent: 0,
      market: '广州市场',
      updateTime: '2024-01-28 16:00',
      trend: 'stable'
    },
    {
      id: '4',
      name: '铜芯电缆',
      specification: 'YJV22-3×120mm²',
      unit: '米',
      currentPrice: 156.8,
      previousPrice: 155.2,
      changePercent: 1.03,
      market: '深圳市场',
      updateTime: '2024-01-28 16:00',
      trend: 'up'
    }
  ]

  useEffect(() => {
    loadData()
    // 设置自动刷新（每30分钟）
    const interval = setInterval(() => {
      loadData()
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setNewsLoading(true)
    setPriceLoading(true)

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      setNewsList(mockNewsData)
      setMaterialPrices(mockPriceData)
      setLastUpdateTime(new Date().toLocaleString())
    } catch (error) {
      message.error('数据加载失败')
    } finally {
      setNewsLoading(false)
      setPriceLoading(false)
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      policy: 'red',
      industry: 'blue',
      market: 'green',
      technology: 'purple'
    }
    return colors[category] || 'default'
  }

  const getCategoryName = (category: string) => {
    const names = {
      policy: '政策法规',
      industry: '行业动态',
      market: '市场行情',
      technology: '技术创新'
    }
    return names[category] || '其他'
  }

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case 'high':
        return <FireOutlined style={{ color: '#ff4d4f' }} />
      case 'medium':
        return <NotificationOutlined style={{ color: '#fa8c16' }} />
      default:
        return <GlobalOutlined style={{ color: '#1890ff' }} />
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          行业资讯
        </Title>
        <Space>
          <Text type="secondary">
            最后更新：{lastUpdateTime}
          </Text>
          <Button
            icon={<SyncOutlined />}
            onClick={loadData}
            loading={newsLoading || priceLoading}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* 行业新闻 */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <GlobalOutlined />
                <span>行业资讯</span>
                <Badge count={newsList.length} showZero />
              </Space>
            }
            extra={
              <Button type="link" size="small">
                查看更多 <LinkOutlined />
              </Button>
            }
          >
            <Spin spinning={newsLoading}>
              <List
                dataSource={newsList}
                renderItem={(item) => (
                  <List.Item
                    style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}
                    actions={[
                      <Tooltip title="阅读量">
                        <Space>
                          <EyeOutlined />
                          <Text type="secondary">{item.readCount}</Text>
                        </Space>
                      </Tooltip>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          icon={getImportanceIcon(item.importance)}
                          style={{
                            backgroundColor: item.importance === 'high' ? '#fff2e8' : '#f6ffed',
                            color: item.importance === 'high' ? '#fa8c16' : '#52c41a'
                          }}
                        />
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: '16px' }}>
                            {item.title}
                          </Text>
                          <Tag color={getCategoryColor(item.category)}>
                            {getCategoryName(item.category)}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <Paragraph
                            style={{ marginBottom: '8px', color: '#666' }}
                            ellipsis={{ rows: 2 }}
                          >
                            {item.summary}
                          </Paragraph>
                          <Space wrap>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              <ClockCircleOutlined /> {item.publishTime}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              来源：{item.source}
                            </Text>
                            {item.tags.map(tag => (
                              <Tag key={tag} size="small">{tag}</Tag>
                            ))}
                          </Space>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Spin>
          </Card>
        </Col>

        {/* 材料价格 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <DollarOutlined />
                <span>主要材料价格</span>
                <Badge count={materialPrices.length} showZero />
              </Space>
            }
            extra={
              <Button type="link" size="small">
                详细行情 <LinkOutlined />
              </Button>
            }
          >
            <Spin spinning={priceLoading}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {materialPrices.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '6px',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>{item.name}</Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: '12px', marginLeft: '8px' }}
                      >
                        {item.specification}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                          ¥{item.currentPrice}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '12px', marginLeft: '4px' }}>
                          /{item.unit}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Space>
                          {item.trend === 'up' && <RiseOutlined style={{ color: '#f5222d' }} />}
                          {item.trend === 'down' && <FallOutlined style={{ color: '#52c41a' }} />}
                          <Text
                            style={{
                              fontSize: '12px',
                              color: item.trend === 'up' ? '#f5222d' : item.trend === 'down' ? '#52c41a' : '#666'
                            }}
                          >
                            {item.changePercent > 0 ? '+' : ''}{item.changePercent}%
                          </Text>
                        </Space>
                        <div>
                          <Text type="secondary" style={{ fontSize: '10px' }}>
                            {item.market}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Space>

              <Divider />

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  数据更新时间：{materialPrices[0]?.updateTime || '--'}
                </Text>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* 快速统计 */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="今日资讯"
              value={12}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="政策更新"
              value={3}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="价格监控"
              value={156}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="市场热度"
              value={85}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage