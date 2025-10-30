import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Input,
  Button,
  List,
  Tag,
  Space,
  Typography,
  Avatar,
  Tooltip,
  Spin,
  Empty,
  message,
  Tabs,
  Badge,
  Row,
  Col,
  Statistic,
  Select,
  Divider,
  Collapse,
  Tree,
  Modal,
  Descriptions,
  Progress,
  Alert,
  Dropdown,
  MenuProps
} from 'antd'
import {
  SearchOutlined,
  NodeIndexOutlined,
  ShareAltOutlined,
  EyeOutlined,
  BranchesOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  FullscreenOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  BulbOutlined,
  FileTextOutlined,
  ProjectOutlined,
  ToolOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import type { TabsProps, TreeDataNode } from 'antd'
import type { MenuProps as AntdMenuProps } from 'antd'

import {
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  NodeType,
  QueryRequest,
  QueryResponse
} from '@/types'
import knowledgeGraphApi from '@/services/knowledgeGraphApi'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { TabPane } = Tabs
const { Panel } = Collapse
const { Option } = Select

interface KnowledgeGraphPanelProps {
  visible: boolean
  onClose: () => void
  onNodeSelect?: (node: GraphNode) => void
  onQueryWithGraph?: (query: string, contextNodes: string[]) => void
}

const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  visible,
  onClose,
  onNodeSelect,
  onQueryWithGraph
}) => {
  // 状态管理
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [statistics, setStatistics] = useState<KnowledgeGraph['statistics'] | null>(null)
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeNeighbors, setNodeNeighbors] = useState<{
    center_node: GraphNode
    neighbors: GraphNode[]
    edges: GraphEdge[]
  } | null>(null)
  const [selectedContextNodes, setSelectedContextNodes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('overview')

  // 过滤器状态
  const [filters, setFilters] = useState({
    node_types: [] as NodeType[],
    max_nodes: 50,
    include_properties: true
  })

  const nodeTypeColors = {
    [NodeType.PROJECT]: '#1890ff',
    [NodeType.MATERIAL]: '#52c41a',
    [NodeType.ACTIVITY]: '#fa8c16',
    [NodeType.RESOURCE]: '#722ed1',
    [NodeType.SPECIFICATION]: '#eb2f96',
    [NodeType.REGULATION]: '#f5222d'
  }

  const nodeTypeIcons = {
    [NodeType.PROJECT]: <ProjectOutlined />,
    [NodeType.MATERIAL]: <ToolOutlined />,
    [NodeType.ACTIVITY]: <ThunderboltOutlined />,
    [NodeType.RESOURCE]: <NodeIndexOutlined />,
    [NodeType.SPECIFICATION]: <FileTextOutlined />,
    [NodeType.REGULATION]: <SafetyCertificateOutlined />
  }

  const nodeTypeNames = {
    [NodeType.PROJECT]: '项目',
    [NodeType.MATERIAL]: '材料',
    [NodeType.ACTIVITY]: '活动',
    [NodeType.RESOURCE]: '资源',
    [NodeType.SPECIFICATION]: '规范',
    [NodeType.REGULATION]: '法规'
  }

  // 加载统计数据
  useEffect(() => {
    if (visible) {
      loadStatistics()
    }
  }, [visible])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const response = await knowledgeGraphApi.getStatistics()
      if (response.success && response.data) {
        setStatistics(response.data)
      }
    } catch (error) {
      console.error('Failed to load statistics:', error)
      message.error('加载知识图谱统计信息失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索节点
  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      const response = await knowledgeGraphApi.searchNodes({
        query: value.trim(),
        node_types: filters.node_types.length > 0 ? filters.node_types : undefined,
        limit: 20
      })

      if (response.success && response.data) {
        setSearchResults(response.data.items)
      }
    } catch (error) {
      console.error('Search failed:', error)
      message.error('搜索失败')
    } finally {
      setSearchLoading(false)
    }
  }

  // 获取节点详情
  const handleNodeClick = async (node: GraphNode) => {
    setSelectedNode(node)

    try {
      setLoading(true)
      const response = await knowledgeGraphApi.getNodeNeighbors({
        nodeId: node.id,
        depth: 2,
        limit: 10
      })

      if (response.success && response.data) {
        setNodeNeighbors(response.data)
      }
    } catch (error) {
      console.error('Failed to load node neighbors:', error)
      message.error('加载节点关联信息失败')
    } finally {
      setLoading(false)
    }
  }

  // 添加节点到上下文
  const handleAddToContext = (nodeId: string) => {
    if (selectedContextNodes.includes(nodeId)) {
      setSelectedContextNodes(prev => prev.filter(id => id !== nodeId))
    } else {
      setSelectedContextNodes(prev => [...prev, nodeId])
    }
  }

  // 基于上下文节点进行问答
  const handleQueryWithContext = () => {
    if (selectedContextNodes.length > 0 && onQueryWithGraph) {
      const contextQuery = selectedContextNodes.length > 0
        ? `基于以下实体: ${selectedContextNodes.join(', ')}`
        : ''
      onQueryWithGraph(contextQuery, selectedContextNodes)
    }
  }

  // 渲染节点标签
  const renderNodeTag = (node: GraphNode) => (
    <Tag
      color={nodeTypeColors[node.type]}
      icon={nodeTypeIcons[node.type]}
      style={{ cursor: 'pointer', marginBottom: 4 }}
    >
      {node.label}
    </Tag>
  )

  // 渲染统计概览
  const renderOverview = () => (
    <div>
      {statistics && (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="总节点数"
                value={statistics.total_nodes}
                prefix={<NodeIndexOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="总关系数"
                value={statistics.total_edges}
                prefix={<ShareAltOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Divider />

      {statistics && (
        <Card title="节点类型分布" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {Object.entries(statistics.node_types).map(([type, count]) => (
              <div key={type}>
                <Space style={{ marginBottom: 4 }}>
                  <span style={{ color: nodeTypeColors[type as NodeType] }}>
                    {nodeTypeIcons[type as NodeType]}
                  </span>
                  <Text>{nodeTypeNames[type as NodeType]}</Text>
                  <Tag>{count}</Tag>
                </Space>
                <Progress
                  percent={Math.round((count / statistics.total_nodes) * 100)}
                  strokeColor={nodeTypeColors[type as NodeType]}
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
          </Space>
        </Card>
      )}

      <Card title="关系类型分布" size="small">
        {statistics && Object.entries(statistics.relationship_types).map(([type, count]) => (
          <div key={type} style={{ marginBottom: 8 }}>
            <Space>
              <LinkOutlined />
              <Text>{type}</Text>
              <Tag color="blue">{count}</Tag>
            </Space>
          </div>
        ))}
      </Card>
    </div>
  )

  // 渲染搜索结果
  const renderSearch = () => (
    <div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>节点类型过滤：</Text>
          <Select
            mode="multiple"
            placeholder="选择节点类型"
            style={{ width: '100%', marginTop: 8 }}
            value={filters.node_types}
            onChange={(values) => setFilters(prev => ({ ...prev, node_types: values }))}
          >
            {Object.values(NodeType).map(type => (
              <Option key={type} value={type}>
                <Space>
                  {nodeTypeIcons[type]}
                  {nodeTypeNames[type]}
                </Space>
              </Option>
            ))}
          </Select>
        </div>

        <Search
          placeholder="搜索知识图谱中的实体..."
          allowClear
          enterButton={<SearchOutlined />}
          loading={searchLoading}
          onSearch={handleSearch}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {selectedContextNodes.length > 0 && (
          <Alert
            message={`已选择 ${selectedContextNodes.length} 个实体作为上下文`}
            type="info"
            action={
              <Button size="small" onClick={handleQueryWithContext}>
                基于此问答
              </Button>
            }
            style={{ marginTop: 8 }}
          />
        )}

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {searchResults.length > 0 ? (
            <List
              dataSource={searchResults}
              renderItem={(node) => (
                <List.Item
                  key={node.id}
                  actions={[
                    <Tooltip title="查看详情">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleNodeClick(node)}
                      />
                    </Tooltip>,
                    <Tooltip title={selectedContextNodes.includes(node.id) ? "从上下文移除" : "添加到上下文"}>
                      <Button
                        type="text"
                        size="small"
                        icon={selectedContextNodes.includes(node.id) ? <MinusCircleOutlined /> : <PlusCircleOutlined />}
                        onClick={() => handleAddToContext(node.id)}
                        style={{
                          color: selectedContextNodes.includes(node.id) ? '#ff4d4f' : '#52c41a'
                        }}
                      />
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: nodeTypeColors[node.type] }}
                        icon={nodeTypeIcons[node.type]}
                        size="small"
                      />
                    }
                    title={
                      <Space>
                        {renderNodeTag(node)}
                        {onNodeSelect && (
                          <Button
                            type="link"
                            size="small"
                            icon={<BranchesOutlined />}
                            onClick={() => onNodeSelect(node)}
                          >
                            关联分析
                          </Button>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                          {Object.entries(node.properties).slice(0, 2).map(([key, value]) => (
                            <div key={key}>
                              <Text type="secondary">{key}:</Text> {String(value)}
                            </div>
                          ))}
                        </Paragraph>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              description={searchQuery ? "未找到匹配的实体" : "输入关键词搜索实体"}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Space>
    </div>
  )

  // 渲染节点详情
  const renderNodeDetail = () => {
    if (!selectedNode) {
      return (
        <Empty
          description="选择一个节点查看详情"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )
    }

    return (
      <div>
        <Card
          title={
            <Space>
              {renderNodeTag(selectedNode)}
              <Button
                type="text"
                size="small"
                icon={selectedContextNodes.includes(selectedNode.id) ? <MinusCircleOutlined /> : <PlusCircleOutlined />}
                onClick={() => handleAddToContext(selectedNode.id)}
                style={{
                  color: selectedContextNodes.includes(selectedNode.id) ? '#ff4d4f' : '#52c41a'
                }}
              >
                {selectedContextNodes.includes(selectedNode.id) ? '从上下文移除' : '添加到上下文'}
              </Button>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={1} size="small">
            <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Space>
                {nodeTypeIcons[selectedNode.type]}
                {nodeTypeNames[selectedNode.type]}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="标签">{selectedNode.label}</Descriptions.Item>
          </Descriptions>

          {Object.keys(selectedNode.properties).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Title level={5}>属性</Title>
              <Descriptions column={1} size="small">
                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </div>
          )}
        </Card>

        {nodeNeighbors && (
          <Card title="关联实体" size="small">
            <List
              dataSource={nodeNeighbors.neighbors}
              renderItem={(neighbor) => (
                <List.Item
                  key={neighbor.id}
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleNodeClick(neighbor)}
                    >
                      查看
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{ backgroundColor: nodeTypeColors[neighbor.type] }}
                        icon={nodeTypeIcons[neighbor.type]}
                        size="small"
                      />
                    }
                    title={renderNodeTag(neighbor)}
                    description={
                      <Space wrap>
                        {nodeNeighbors.edges
                          .filter(edge =>
                            (edge.source === selectedNode.id && edge.target === neighbor.id) ||
                            (edge.target === selectedNode.id && edge.source === neighbor.id)
                          )
                          .map(edge => (
                            <Tag key={edge.id} size="small">
                              {edge.relationship}
                            </Tag>
                          ))}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>
    )
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: (
        <Space>
          <BulbOutlined />
          概览
        </Space>
      ),
      children: renderOverview()
    },
    {
      key: 'search',
      label: (
        <Space>
          <SearchOutlined />
          搜索
        </Space>
      ),
      children: renderSearch()
    },
    {
      key: 'detail',
      label: (
        <Space>
          <InfoCircleOutlined />
          详情
        </Space>
      ),
      children: renderNodeDetail()
    }
  ]

  // 更多操作菜单
  const moreMenuItems: AntdMenuProps['items'] = [
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新数据',
      onClick: loadStatistics
    },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: '导出图谱',
      onClick: () => message.info('导出功能开发中')
    },
    {
      key: 'fullscreen',
      icon: <FullscreenOutlined />,
      label: '全屏查看',
      onClick: () => message.info('全屏功能开发中')
    }
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card
        title={
          <Space>
            <BranchesOutlined />
            <span>知识图谱</span>
            <Badge count={statistics?.total_nodes || 0} />
          </Space>
        }
        size="small"
        extra={
          <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
            <Button type="text" icon={<FilterOutlined />} />
          </Dropdown>
        }
        style={{ flex: 1, overflow: 'hidden' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          style={{ height: '100%' }}
          items={tabItems}
        />
      </Card>
    </div>
  )
}

export default KnowledgeGraphPanel