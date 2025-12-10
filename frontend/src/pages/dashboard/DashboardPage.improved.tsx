import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  List,
  Tag,
  Space,
  Statistic,
  Button,
  Tooltip,
  Avatar,
  Divider,
  Badge,
  Spin,
  message,
  Empty,
  Segmented
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
  NotificationOutlined,
  TrendingUpOutlined,
  AreaChartOutlined,
} from '@ant-design/icons'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import './DashboardPage.module.css'

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

// 价格趋势接口
interface PriceTrend {
  date: string
  钢铁: number
  水泥: number
  混凝土: number
  电缆: number
}

/**
 * 改进后的 Dashboard 页面
 * 主要改进：
 * 1. 统计卡片设计升级 - 添加渐变背景和悬停效果
 * 2. 新闻卡片增强 - 左侧重要度指示条
 * 3. 价格监控可视化 - 添加趋势图表
 * 4. 动画效果 - 页面加载和数据更新动画
 * 5. 响应式改进 - 更好的移动端适配
 */
const DashboardPageImproved: React.FC = () => {
  const [newsLoading, setNewsLoading] = useState(false)
  const [priceLoading, setPriceLoading] = useState(false)
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([])
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card')

  // 模拟新闻数据（同原来的）
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
    // ... 其他数据
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
    // ... 其他数据
  ]

  // 模拟价格趋势数据
  const mockTrendData: PriceTrend[] = [
    { date: '1月22日', 钢铁: 4200, 水泥: 480, 混凝土: 415, 电缆: 150 },
    { date: '1月23日', 钢铁: 4220, 水泥: 482, 混凝土: 417, 电缆: 152 },
    { date: '1月24日', 钢铁: 4210, 水泥: 485, 混凝土: 420, 电缆: 155 },
    { date: '1月25日', 钢铁: 4230, 水泥: 488, 混凝土: 418, 电缆: 154 },
    { date: '1月26日', 钢铁: 4240, 水泥: 487, 混凝土: 420, 电缆: 156 },
    { date: '1月27日', 钢铁: 4245, 水泥: 486, 混凝土: 421, 电缆: 155 },
    { date: '1月28日', 钢铁: 4250, 水泥: 485, 混凝土: 420, 电缆: 156 },
  ]

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      loadData()
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setNewsLoading(true)
    setPriceLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setNewsList(mockNewsData)
      setMaterialPrices(mockPriceData)
      setPriceTrends(mockTrendData)
      setLastUpdateTime(new Date().toLocaleString())
    } catch (error) {
      message.error('数据加载失败')
    } finally {
      setNewsLoading(false)
      setPriceLoading(false)
    }
  }

  // ============================================================
  // 辅助函数
  // ============================================================

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      policy: 'red',
      industry: 'blue',
      market: 'green',
      technology: 'purple'
    }
    return colors[category] || 'default'
  }

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      policy: '政策法规',
      industry: '行业动态',
      market: '市场行情',
      technology: '技术创新'
    }
    return names[category] || '其他'
  }

  const getImportanceColor = (importance: string): { bg: string; border: string } => {
    const colors: Record<string, { bg: string; border: string }> = {
      high: { bg: '#FEE2E2', border: '#EF4444' },
      medium: { bg: '#FEF3C7', border: '#F59E0B' },
      low: { bg: '#DBEAFE', border: '#3B82F6' }
    }
    return colors[importance] || colors.low
  }

  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return timeStr
  }

  // ============================================================
  // 渲染函数
  // ============================================================

  return (
    <div className="dashboard-container">
      {/* 页面头部 */}
      <div className="dashboard-header">
        <Title level={2} style={{ margin: 0 }}>
          <GlobalOutlined style={{ marginRight: '12px', color: '#2563EB' }} />
          行业资讯与数据监控
        </Title>
        <Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <SyncOutlined spin style={{ marginRight: '4px' }} />
            最后更新：{lastUpdateTime}
          </Text>
          <Button
            icon={<SyncOutlined />}
            onClick={loadData}
            loading={newsLoading || priceLoading}
            type="primary"
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 统计卡片行 - 新增和改进 */}
      <Row gutter={[16, 16]} className="statistics-row">
        <StatisticsCard
          icon={<GlobalOutlined />}
          title="今日资讯"
          value={156}
          unit="条"
          trend="up"
          color="#2563EB"
        />
        <StatisticsCard
          icon={<FileTextOutlined />}
          title="政策更新"
          value={12}
          unit="项"
          trend="up"
          color="#10B981"
        />
        <StatisticsCard
          icon={<DollarOutlined />}
          title="价格监控"
          value={48}
          unit="种"
          trend="stable"
          color="#F59E0B"
        />
        <StatisticsCard
          icon={<TrendingUpOutlined />}
          title="系统活度"
          value={94}
          unit="%"
          trend="up"
          color="#8B5CF6"
        />
      </Row>

      {/* 主内容区 - 行业新闻和趋势 */}
      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        {/* 左侧：行业新闻 */}
        <Col xs={24} lg={16}>
          <Card
            className="news-card-container"
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
                  <NewsItemImproved
                    item={item}
                    onRead={() => {
                      // 处理阅读事件
                    }}
                  />
                )}
                locale={{
                  emptyText: <Empty description="暂无资讯" />
                }}
              />
            </Spin>
          </Card>
        </Col>

        {/* 右侧：价格面板 */}
        <Col xs={24} lg={8}>
          <Card
            className="price-panel"
            title={
              <Space>
                <DollarOutlined />
                <span>主要材料价格</span>
                <Badge count={materialPrices.length} showZero />
              </Space>
            }
            extra={
              <Button type="link" size="small">
                详细 <LinkOutlined />
              </Button>
            }
          >
            <Spin spinning={priceLoading}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {materialPrices.map((item) => (
                  <PriceItemImproved key={item.id} item={item} />
                ))}
              </Space>

              <Divider style={{ margin: '16px 0' }} />

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  数据更新时间：{materialPrices[0]?.updateTime || '--'}
                </Text>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* 价格趋势图表 - 新增 */}
      <Card
        className="trend-chart-container"
        title={
          <Space>
            <AreaChartOutlined />
            <span>价格趋势分析</span>
          </Space>
        }
        style={{ marginTop: '24px' }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={priceTrends}>
            <defs>
              <linearGradient id="colorSteel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCement" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="钢铁"
              stroke="#2563EB"
              fillOpacity={1}
              fill="url(#colorSteel)"
            />
            <Area
              type="monotone"
              dataKey="水泥"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorCement)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

// ============================================================
// 子组件 - 改进的统计卡片
// ============================================================

interface StatisticsCardProps {
  icon: React.ReactNode
  title: string
  value: number
  unit: string
  trend?: 'up' | 'down' | 'stable'
  color: string
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({
  icon,
  title,
  value,
  unit,
  trend,
  color
}) => (
  <Col xs={24} sm={12} md={6}>
    <Card
      className="statistics-card"
      style={{
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}20`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = `0 12px 24px ${color}15`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <div style={{ fontSize: '20px', color }}>
            {icon}
          </div>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            {title}
          </Text>
        </Space>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <Text
            strong
            style={{
              fontSize: '28px',
              color: '#1F2937'
            }}
          >
            {value}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {unit}
          </Text>
        </div>
        {trend === 'up' && (
          <Text style={{ color: '#EF4444', fontSize: '12px' }}>
            <RiseOutlined /> 环比上升
          </Text>
        )}
        {trend === 'down' && (
          <Text style={{ color: '#10B981', fontSize: '12px' }}>
            <FallOutlined /> 环比下降
          </Text>
        )}
      </Space>
    </Card>
  </Col>
)

// ============================================================
// 子组件 - 改进的新闻项
// ============================================================

interface NewsItemImprovedProps {
  item: NewsItem
  onRead?: () => void
}

const NewsItemImproved: React.FC<NewsItemImprovedProps> = ({ item, onRead }) => {
  const importance = getImportanceColor(item.importance)

  return (
    <div
      className="news-item-improved"
      style={{
        padding: '16px',
        marginBottom: '12px',
        border: `1px solid #E5E7EB`,
        borderRadius: '8px',
        borderLeft: `4px solid ${importance.border}`,
        backgroundColor: importance.bg,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.08)'
        e.currentTarget.style.transform = 'translateX(4px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateX(0)'
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Text strong style={{ fontSize: '15px' }}>
            {item.title}
          </Text>
          <Tag color={getCategoryColor(item.category)}>
            {getCategoryName(item.category)}
          </Tag>
          {item.importance === 'high' && (
            <Tag icon={<FireOutlined />} color="red">
              重要
            </Tag>
          )}
        </Space>

        <Paragraph
          style={{ marginBottom: '8px', color: '#666' }}
          ellipsis={{ rows: 2 }}
        >
          {item.summary}
        </Paragraph>

        <Space wrap style={{ fontSize: '12px' }}>
          <Text type="secondary">
            <ClockCircleOutlined /> {formatTime(item.publishTime)}
          </Text>
          <Text type="secondary">来源：{item.source}</Text>
          <Space size={4}>
            {item.tags.slice(0, 2).map(tag => (
              <Tag key={tag} size="small" style={{ fontSize: '11px' }}>
                {tag}
              </Tag>
            ))}
          </Space>
          <Tooltip title="阅读量">
            <Text type="secondary">
              <EyeOutlined /> {item.readCount}
            </Text>
          </Tooltip>
        </Space>
      </Space>
    </div>
  )
}

// ============================================================
// 子组件 - 改进的价格项
// ============================================================

interface PriceItemImprovedProps {
  item: MaterialPrice
}

const PriceItemImproved: React.FC<PriceItemImprovedProps> = ({ item }) => {
  const trendColor = item.trend === 'up' ? '#EF4444' : item.trend === 'down' ? '#10B981' : '#9CA3AF'

  return (
    <div
      style={{
        padding: '12px',
        border: '1px solid #E5E7EB',
        borderRadius: '6px',
        backgroundColor: '#FAFAFA',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F3F4F6'
        e.currentTarget.style.borderColor = '#2563EB'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FAFAFA'
        e.currentTarget.style.borderColor = '#E5E7EB'
      }}
    >
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Text strong>{item.name}</Text>
          <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
            {item.specification}
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563EB' }}>
            ¥{item.currentPrice}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', marginLeft: '4px' }}>
            /{item.unit}
          </Text>
        </div>

        <div style={{ textAlign: 'right' }}>
          <Space>
            {item.trend === 'up' && <RiseOutlined style={{ color: trendColor }} />}
            {item.trend === 'down' && <FallOutlined style={{ color: trendColor }} />}
            <Text style={{ fontSize: '12px', color: trendColor, fontWeight: 500 }}>
              {item.changePercent > 0 ? '+' : ''}{item.changePercent}%
            </Text>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>
              {item.market}
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPageImproved
