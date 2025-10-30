import React, { useState, useEffect } from 'react'
import { Typography, Card, Row, Col, Button, Select, Tag, Spin, Space, Tooltip, Input } from 'antd'
import { SearchOutlined, FilterOutlined, ZoomInOutlined, ZoomOutOutlined, DownloadOutlined, ReloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography
const { Option } = Select

interface GraphNode {
  id: string
  name: string
  type: 'document' | 'concept' | 'entity'
  category?: string
  importance: 'high' | 'medium' | 'low'
  connections: number
}

interface GraphEdge {
  source: string
  target: string
  type: 'reference' | 'dependency' | 'relationship'
  weight: number
}

const KnowledgeGraphPage: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // 模拟数据 - 在实际应用中这些应该从API获取
  const mockNodes: GraphNode[] = [
    { id: '1', name: '工程造价计算规范', type: 'document', category: '规范', importance: 'high', connections: 15 },
    { id: '2', name: '混凝土配合比设计', type: 'concept', category: '材料', importance: 'high', connections: 12 },
    { id: '3', name: '人工成本计算', type: 'concept', category: '成本', importance: 'medium', connections: 8 },
    { id: '4', name: '机械费率标准', type: 'document', category: '标准', importance: 'medium', connections: 6 },
    { id: '5', name: '工程量清单计价', type: 'entity', category: '方法', importance: 'high', connections: 20 },
    { id: '6', name: '材料价格信息', type: 'entity', category: '数据', importance: 'high', connections: 18 },
  ]

  const mockEdges: GraphEdge[] = [
    { source: '1', target: '2', type: 'reference', weight: 0.8 },
    { source: '1', target: '3', type: 'dependency', weight: 0.6 },
    { source: '2', target: '3', type: 'relationship', weight: 0.7 },
    { source: '2', target: '4', type: 'reference', weight: 0.5 },
    { source: '3', target: '5', type: 'dependency', weight: 0.9 },
    { source: '4', target: '5', type: 'reference', weight: 0.4 },
    { source: '5', target: '6', type: 'dependency', weight: 0.8 },
    { source: '1', target: '6', type: 'reference', weight: 0.6 },
  ]

  useEffect(() => {
    loadKnowledgeGraph()
  }, [])

  const loadKnowledgeGraph = async () => {
    setLoading(true)
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000))

      setNodes(mockNodes)
      setEdges(mockEdges)
    } catch (error) {
      console.error('Failed to load knowledge graph:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadKnowledgeGraph()
  }

  const handleExport = () => {
    // 实现导出功能
    console.log('Export knowledge graph')
  }

  const getFilteredNodes = () => {
    return nodes.filter(node => {
      const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory
      const matchesType = selectedType === 'all' || node.type === selectedType
      const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesType && matchesSearch
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document': return '#1890ff'
      case 'concept': return '#52c41a'
      case 'entity': return '#722ed1'
      default: return '#666'
    }
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return '#ff4d4f'
      case 'medium': return '#faad14'
      case 'low': return '#52c41a'
      default: return '#d9d9d9'
    }
  }

  return (
    <div className="knowledge-graph-page">
      {/* 页面标题 */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={2}>知识图谱</Title>
        <Text type="secondary">可视化学档、概念和实体之间的关系网络</Text>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Input
                placeholder="搜索节点..."
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                placeholder="分类"
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="all">全部</Option>
                <Option value="规范">规范</Option>
                <Option value="材料">材料</Option>
                <Option value="成本">成本</Option>
                <Option value="标准">标准</Option>
                <Option value="方法">方法</Option>
                <Option value="数据">数据</Option>
              </Select>
              <Select
                placeholder="类型"
                value={selectedType}
                onChange={setSelectedType}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="all">全部</Option>
                <Option value="document">文档</Option>
                <Option value="concept">概念</Option>
                <Option value="entity">实体</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={18} style={{ textAlign: 'right' }}>
            <Space>
              <Tooltip title="刷新数据">
                <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                  刷新
                </Button>
              </Tooltip>
              <Tooltip title="导出图谱">
                <Button icon={<DownloadOutlined />} onClick={handleExport}>
                  导出
                </Button>
              </Tooltip>
              <Tooltip title="分享图谱">
                <Button icon={<ShareAltOutlined />}>
                  分享
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                {getFilteredNodes().length}
              </div>
              <div>节点总数</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                {edges.length}
              </div>
              <div>关系连接</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                {getFilteredNodes().filter(n => n.importance === 'high').length}
              </div>
              <div>重要节点</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                {Math.round(getFilteredNodes().reduce((sum, node) => sum + node.connections, 0) / getFilteredNodes().length)}
              </div>
              <div>平均连接数</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 知识图谱可视化 */}
      <Card>
        <Spin spinning={loading}>
          <div style={{
            height: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            border: '1px dashed #d9d9d9',
            borderRadius: 4
          }}>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <Title level={4} style={{ color: '#666' }}>知识图谱可视化</Title>
              <Text type="secondary">支持拖拽、缩放、筛选等功能</Text>
            </div>

            {/* 节点列表 */}
            <div style={{ width: '100%', maxWidth: 800 }}>
              <Row gutter={[16, 16]}>
                {getFilteredNodes().slice(0, 6).map((node) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={node.id}>
                    <Card
                      size="small"
                      hoverable
                      style={{
                        borderLeft: `4px solid ${getTypeColor(node.type)}`,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Text strong style={{ color: getTypeColor(node.type) }}>
                          {node.name}
                        </Text>
                      </div>
                      <Space wrap>
                        <Tag color={getTypeColor(node.type)}>{node.type}</Tag>
                        {node.category && (
                          <Tag>{node.category}</Tag>
                        )}
                        <Tag color={getImportanceColor(node.importance)}>
                          {node.importance === 'high' ? '重要' :
                           node.importance === 'medium' ? '一般' : '低'}
                        </Tag>
                        <Tag>连接: {node.connections}</Tag>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>

            {getFilteredNodes().length === 0 && (
              <div style={{ textAlign: 'center', color: '#999' }}>
                <Text>暂无匹配的节点</Text>
              </div>
            )}
          </div>
        </Spin>
      </Card>
    </div>
  )
}

export default KnowledgeGraphPage