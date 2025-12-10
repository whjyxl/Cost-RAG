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
  Badge,
  Spin
} from 'antd'
import {
  GlobalOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  LinkOutlined,
  SyncOutlined,
  NotificationOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import './DashboardPage.css'

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
      importance: 'high'
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

  // 加载数据
  useEffect(() => {
    loadNews()
    loadPrices()
  }, [])

  const loadNews = async () => {
    setNewsLoading(true)
    // 模拟API调用
    setTimeout(() => {
      setNewsList(mockNewsData)
      setNewsLoading(false)
      setLastUpdateTime(new Date().toLocaleString('zh-CN'))
    }, 500)
  }

  const loadPrices = async () => {
    setPriceLoading(true)
    // 模拟API调用
    setTimeout(() => {
      setMaterialPrices(mockPriceData)
      setPriceLoading(false)
    }, 500)
  }

  const refreshData = () => {
    loadNews()
    loadPrices()
  }

  // 渲染分类标签
  const renderCategoryTag = (category: string, importance: string) => {
    const colors: Record<string, string> = {
      policy: 'red',
      industry: 'blue',
      market: 'green',
      technology: 'purple'
    }
    return (
      <Tag color={colors[category] || 'default'} className={importance === 'high' ? 'tag-important' : ''}>
        {category === 'policy' && '政策法规'}
        {category === 'industry' && '行业动态'}
        {category === 'market' && '市场行情'}
        {category === 'technology' && '技术创新'}
      </Tag>
    )
  }

  return (
    <div className="dashboard-modern">
      {/* 背景装饰 */}
      <div className="bg-orb bg-orb-1" style={{ top: '-300px', right: '-300px' }} />
      <div className="bg-orb bg-orb-2" style={{ bottom: '-250px', left: '-250px' }} />

      {/* 页面标题 */}
      <div className="dashboard-header">
        <Title level={2} className="page-title gradient-text">
          行业资讯
        </Title>
        <Space>
          <Text type="secondary">最后更新：{lastUpdateTime || '--'}</Text>
          <Button
            icon={newsLoading ? <SyncOutlined spin /> : <SyncOutlined />}
            onClick={refreshData}
            className="refresh-btn"
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} className="stats-section">
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-stat-card fade-in" style={{ animationDelay: '0.1s' }}>
            <Statistic
              title="今日资讯"
              value={12}
              prefix={<GlobalOutlined className="stat-icon" style={{ color: '#667eea' }} />}
              valueStyle={{ color: '#667eea', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-stat-card fade-in" style={{ animationDelay: '0.2s' }}>
            <Statistic
              title="政策更新"
              value={3}
              prefix={<FileTextOutlined className="stat-icon" style={{ color: '#764ba2' }} />}
              valueStyle={{ color: '#764ba2', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-stat-card fade-in" style={{ animationDelay: '0.3s' }}>
            <Statistic
              title="价格监控"
              value={156}
              prefix={<DollarOutlined className="stat-icon" style={{ color: '#f093fb' }} />}
              valueStyle={{ color: '#f093fb', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="glass-stat-card fade-in" style={{ animationDelay: '0.4s' }}>
            <Statistic
              title="市场热度"
              value={85}
              suffix="%"
              prefix={<RiseOutlined className="stat-icon" style={{ color: '#43e97b' }} />}
              valueStyle={{ color: '#43e97b', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主内容区 */}
      <Row gutter={[24, 24]} className="content-section">
        {/* 行业资讯 */}
        <Col xs={24} lg={14}>
          <Card
            className="glass-card news-card"
            title={
              <Space>
                <GlobalOutlined className="gradient-text" />
                <span>行业资讯</span>
                <Badge count={newsList.length} style={{ backgroundColor: '#667eea' }} />
              </Space>
            }
            extra={
              <Button type="link" icon={<LinkOutlined />}>
                查看更多
              </Button>
            }
          >
            <Spin spinning={newsLoading}>
              <List
                dataSource={newsList}
                renderItem={(item, index) => (
                  <List.Item
                    className="news-item fade-in"
                    style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                  >
                    <div className="news-item-content">
                      <div className="news-icon">
                        {item.importance === 'high' ? <FireOutlined /> : <NotificationOutlined />}
                      </div>
                      <div className="news-details">
                        <Title level={4} className="news-title">
                          <span>{item.title}</span>
                          {renderCategoryTag(item.category, item.importance)}
                        </Title>
                        <Paragraph className="news-summary" ellipsis={{ rows: 2 }}>
                          {item.summary}
                        </Paragraph>
                        <div className="news-meta">
                          <Space split={<span className="separator">·</span>}>
                            <span><ClockCircleOutlined /> {item.publishTime}</span>
                            <span>来源：{item.source}</span>
                            {item.tags.map(tag => (
                              <Tag key={tag} className="meta-tag">{tag}</Tag>
                            ))}
                          </Space>
                        </div>
                      </div>
                      <div className="news-stats">
                        <Space direction="vertical" align="center">
                          <EyeOutlined />
                          <Text type="secondary">{item.readCount.toLocaleString()}</Text>
                        </Space>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Spin>
          </Card>
        </Col>

        {/* 主要材料价格 */}
        <Col xs={24} lg={10}>
          <Card
            className="glass-card price-card"
            title={
              <Space>
                <DollarOutlined className="gradient-text" />
                <span>主要材料价格</span>
                <Badge count={materialPrices.length} style={{ backgroundColor: '#764ba2' }} />
              </Space>
            }
            extra={
              <Button type="link" icon={<LinkOutlined />}>
                详细行情
              </Button>
            }
          >
            <Spin spinning={priceLoading}>
              <div className="price-list">
                {materialPrices.map((item, index) => (
                  <div
                    key={item.id}
                    className="price-item fade-in"
                    style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                  >
                    <div className="price-header">
                      <div>
                        <Text strong className="material-name">{item.name}</Text>
                        <Text type="secondary" className="material-spec">{item.specification}</Text>
                      </div>
                      <div className="price-value">
                        <div className="current-price">
                          <span className="price-currency">¥{item.currentPrice.toLocaleString()}</span>
                          <span className="price-unit">/{item.unit}</span>
                        </div>
                        <div className={`price-change ${item.trend}`}>
                          {item.trend === 'up' && <RiseOutlined />}
                          {item.trend === 'down' && <FallOutlined />}
                          <span>{item.changePercent > 0 ? '+' : ''}{item.changePercent}%</span>
                        </div>
                        <Text type="secondary" className="market-name">{item.market}</Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="price-footer">
                <Text type="secondary">数据更新时间：{materialPrices[0]?.updateTime || '--'}</Text>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
