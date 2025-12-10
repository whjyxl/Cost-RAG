import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Typography, Card, Row, Col, Button, Select, Tag, Spin, Space, Tooltip, Input, Alert, Modal, Form, message, Popconfirm, Descriptions, List, Divider } from 'antd'
import { SearchOutlined, FilterOutlined, ZoomInOutlined, ZoomOutOutlined, DownloadOutlined, ReloadOutlined, ShareAltOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

// 懒加载知识图谱可视化组件
const KnowledgeGraphVisualization = lazy(() => 
  import('@/components/knowledge/KnowledgeGraphVisualization').catch(() => ({
    default: () => (
      <Alert
        message="图谱可视化组件加载失败"
        description="请检查 @antv/g6 依赖是否正确安装"
        type="error"
        showIcon
      />
    )
  }))
)

// 引入样式
import './Documents.css'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

interface GraphNode {
  id: string
  name: string
  type: 'document' | 'concept' | 'entity'
  category?: string
  importance: 'high' | 'medium' | 'low'
  connections: number
  domains?: Array<{
    domain_code: string
    domain_name: string
    color: string
    is_primary: boolean
    confidence: number
  }>
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)
  
  // 节点详情和编辑相关状态
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [selectedNodeRelations, setSelectedNodeRelations] = useState<any[]>([])
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [batchDeleteModalVisible, setBatchDeleteModalVisible] = useState(false)
  const [editForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [batchDeleteForm] = Form.useForm()

  // 批量删除相关状态
  const [deleteMode, setDeleteMode] = useState<'ids' | 'type' | 'pattern' | 'quality'>('type')
  const [nodeTypes, setNodeTypes] = useState<any[]>([])
  const [previewData, setPreviewData] = useState<any>(null)

  // 领域筛选相关状态
  const [domains, setDomains] = useState<any[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('all')

  // 一键清空相关状态
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false)
  const [clearPreviewData, setClearPreviewData] = useState<any>(null)

  useEffect(() => {
    loadKnowledgeGraph()
    loadDomains()
  }, [])

  // 加载领域列表
  const loadDomains = async () => {
    try {
      const response = await fetch('/api/v1/domains/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDomains(data.data || [])
      }
    } catch (error) {
      console.error('加载领域列表失败:', error)
    }
  }

  const loadKnowledgeGraph = async () => {
    setLoading(true)
    try {
      // 调用真实API获取知识图谱节点
      const nodesResponse = await fetch('/api/v1/knowledge-graph/nodes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!nodesResponse.ok) {
        throw new Error(`获取节点失败: ${nodesResponse.status}`)
      }

      const nodesData = await nodesResponse.json()
      console.log('API返回的节点数据:', nodesData) // 调试日志

      // 调用真实API获取知识图谱关系
      const edgesResponse = await fetch('/api/v1/knowledge-graph/relations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!edgesResponse.ok) {
        throw new Error(`获取关系失败: ${edgesResponse.status}`)
      }

      const edgesData = await edgesResponse.json()
      console.log('API返回的关系数据:', edgesData) // 调试日志

      // 转换后端数据格式为前端格式
      // API直接返回数组，不是 {nodes: [...]} 格式
      const rawNodes = Array.isArray(nodesData) ? nodesData : (nodesData.nodes || [])
      console.log('原始节点数据:', rawNodes)
      console.log('节点数量:', rawNodes.length)
      
      const formattedNodes: GraphNode[] = rawNodes.map((node: any) => {
        console.log('处理节点:', node)
        // 映射节点类型
        const mapType = (type: string): 'document' | 'concept' | 'entity' => {
          if (type === 'document') return 'document'
          if (type === 'concept') return 'concept'
          // 简化模式的类型映射
          if (type === 'standard') return 'document'  // 标准规范 -> 文档
          if (type === 'material') return 'entity'    // 材料 -> 实体
          if (type === 'project_type') return 'concept'  // 工程类型 -> 概念
          if (type === 'entity') return 'entity'
          return 'entity' // 默认
        }

        // 映射重要性
        const mapImportance = (importance: string | number): 'high' | 'medium' | 'low' => {
          if (typeof importance === 'number') {
            if (importance >= 0.7) return 'high'
            if (importance >= 0.4) return 'medium'
            return 'low'
          }
          if (importance === 'high') return 'high'
          if (importance === 'medium') return 'medium'
          if (importance === 'low') return 'low'
          return 'medium' // 默认
        }

        const formatted = {
          id: node.id?.toString() || node.node_id?.toString() || '',
          name: node.name || node.label || '未命名节点',
          type: mapType(node.type || node.node_type || 'entity'),
          category: node.category || node.properties?.category || undefined,
          importance: mapImportance(node.importance || node.score || node.confidence || 0.5),
          connections: node.connections || node.degree || 0,
          domains: node.domains || [],
        }
        console.log('格式化后的节点:', formatted)
        return formatted
      })
      
      console.log('最终节点列表:', formattedNodes)

      // API可能直接返回数组，也可能返回 {relations: [...]} 格式
      const rawEdges = Array.isArray(edgesData) ? edgesData : (edgesData.relations || [])
      const formattedEdges: GraphEdge[] = rawEdges.map((edge: any) => {
        // 映射关系类型
        const mapRelationType = (type: string): 'reference' | 'dependency' | 'relationship' => {
          if (type === 'reference' || type === 'refers_to') return 'reference'
          if (type === 'dependency' || type === 'depends_on') return 'dependency'
          if (type === 'relationship' || type === 'related_to') return 'relationship'
          return 'relationship' // 默认
        }

        return {
          source: edge.source?.toString() || edge.from_node?.toString() || '',
          target: edge.target?.toString() || edge.to_node?.toString() || '',
          type: mapRelationType(edge.type || edge.relation_type || 'relationship'),
          weight: edge.weight || edge.score || 0.5,
        }
      })

      setNodes(formattedNodes)
      setEdges(formattedEdges)
    } catch (error: any) {
      console.error('获取知识图谱失败:', error)
      // 失败时显示空图谱
      setNodes([])
      setEdges([])
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

  // 查看节点详情
  const handleViewNode = async (nodeId: string) => {
    try {
      // 确保nodeId是有效的
      if (!nodeId) {
        message.error('无效的节点ID')
        return
      }

      // 获取节点详情
      const nodeResponse = await fetch(`/api/v1/knowledge-graph/nodes/${nodeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!nodeResponse.ok) {
        const errorData = await nodeResponse.json().catch(() => ({}))
        console.error('节点详情API错误:', nodeResponse.status, errorData)
        throw new Error(errorData.detail || `获取节点详情失败 (${nodeResponse.status})`)
      }

      const nodeData = await nodeResponse.json()
      console.log('节点详情数据:', nodeData)
      setSelectedNode(nodeData)

      // 获取节点相关的关系（incoming + outgoing）
      try {
        const relationsResponse = await fetch(`/api/v1/knowledge-graph/relations?node_id=${nodeId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        })

        if (relationsResponse.ok) {
          const relationsData = await relationsResponse.json()
          console.log('节点关系数据:', relationsData)
          // API可能返回 {relations: [...]} 或直接返回数组
          const relations = Array.isArray(relationsData) ? relationsData : (relationsData.relations || [])
          
          // 前端去重：使用 (source_id, target_id, type) 作为唯一键
          const uniqueRelations = new Map()
          relations.forEach((relation: any) => {
            const key = `${relation.source_node_id || relation.source_node?.id}-${relation.target_node_id || relation.target_node?.id}-${relation.type}`
            if (!uniqueRelations.has(key)) {
              uniqueRelations.set(key, relation)
            } else {
              // 如果已存在，保留置信度更高的
              const existing = uniqueRelations.get(key)
              if ((relation.confidence || 0) > (existing.confidence || 0)) {
                uniqueRelations.set(key, relation)
              }
            }
          })
          
          const deduplicatedRelations = Array.from(uniqueRelations.values())
          console.log(`关系去重: ${relations.length} -> ${deduplicatedRelations.length}`)
          setSelectedNodeRelations(deduplicatedRelations)
        } else {
          console.warn('获取节点关系失败:', relationsResponse.status)
          setSelectedNodeRelations([])
        }
      } catch (error) {
        console.error('获取节点关系失败:', error)
        setSelectedNodeRelations([])
      }

      setDetailModalVisible(true)
    } catch (error: any) {
      const errorMessage = error.message || '获取节点详情失败'
      message.error(errorMessage)
      console.error('handleViewNode错误:', error)
    }
  }

  // 编辑节点
  const handleEditNode = (node: any) => {
    setSelectedNode(node)
    editForm.setFieldsValue({
      name: node.name,
      type: node.node_type || node.type,
      description: node.description || node.properties?.description || '',
    })
    setEditModalVisible(true)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields()
      
      const response = await fetch(`/api/v1/knowledge-graph/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })
      
      if (!response.ok) {
        throw new Error('更新节点失败')
      }
      
      message.success('节点更新成功')
      setEditModalVisible(false)
      loadKnowledgeGraph() // 重新加载数据
    } catch (error) {
      message.error('更新节点失败')
      console.error(error)
    }
  }

  // 删除节点
  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/v1/knowledge-graph/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('删除节点失败')
      }
      
      message.success('节点删除成功')
      loadKnowledgeGraph() // 重新加载数据
    } catch (error) {
      message.error('删除节点失败')
      console.error(error)
    }
  }

  // 创建新节点
  const handleCreateNode = async () => {
    try {
      const values = await createForm.validateFields()

      const response = await fetch('/api/v1/knowledge-graph/entities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        throw new Error('创建节点失败')
      }

      message.success('节点创建成功')
      setCreateModalVisible(false)
      createForm.resetFields()
      loadKnowledgeGraph() // 重新加载数据
    } catch (error) {
      message.error('创建节点失败')
      console.error(error)
    }
  }

  // 批量删除 - 打开对话框并获取节点类型统计
  const handleOpenBatchDelete = async () => {
    try {
      const response = await fetch('/api/v1/knowledge-graph/nodes/types', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNodeTypes(data.type_statistics || [])
      }
      setBatchDeleteModalVisible(true)
    } catch (error) {
      console.error('获取节点类型统计失败:', error)
      setBatchDeleteModalVisible(true)
    }
  }

  // 批量删除 - 预览
  const handlePreviewBatchDelete = async () => {
    try {
      const values = await batchDeleteForm.validateFields()

      // 根据删除模式构建请求参数
      const requestData: any = {
        dry_run: true,
        cascade_delete_relations: true,
      }

      if (deleteMode === 'type') {
        requestData.node_types = values.node_types
      } else if (deleteMode === 'pattern') {
        requestData.name_pattern = values.name_pattern
      } else if (deleteMode === 'quality') {
        requestData.min_quality_score = values.min_quality_score
      }

      const response = await fetch('/api/v1/knowledge-graph/nodes/batch-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error('预览失败')
      }

      const data = await response.json()
      setPreviewData(data)
      message.success(`找到 ${data.deleted_nodes_count} 个符合条件的节点`)
    } catch (error: any) {
      message.error(error.message || '预览失败')
      console.error(error)
    }
  }

  // 批量删除 - 执行
  const handleExecuteBatchDelete = async () => {
    try {
      const values = await batchDeleteForm.validateFields()

      // 根据删除模式构建请求参数
      const requestData: any = {
        dry_run: false,
        cascade_delete_relations: true,
      }

      if (deleteMode === 'type') {
        requestData.node_types = values.node_types
      } else if (deleteMode === 'pattern') {
        requestData.name_pattern = values.name_pattern
      } else if (deleteMode === 'quality') {
        requestData.min_quality_score = values.min_quality_score
      }

      const response = await fetch('/api/v1/knowledge-graph/nodes/batch-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error('批量删除失败')
      }

      const data = await response.json()
      message.success(`成功删除 ${data.deleted_nodes_count} 个节点，${data.deleted_relations_count} 个关系`)
      setBatchDeleteModalVisible(false)
      setPreviewData(null)
      batchDeleteForm.resetFields()
      loadKnowledgeGraph() // 重新加载数据
    } catch (error: any) {
      message.error(error.message || '批量删除失败')
      console.error(error)
    }
  }

  // 一键清空 - 获取预览
  const handleOpenClearAll = async () => {
    try {
      const response = await fetch('/api/v1/knowledge-graph/nodes/clear-preview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('获取清空预览失败')
      }

      const data = await response.json()
      setClearPreviewData(data)
      setClearAllModalVisible(true)
    } catch (error: any) {
      message.error(error.message || '获取清空预览失败')
      console.error(error)
    }
  }

  // 一键清空 - 执行
  const handleExecuteClearAll = async () => {
    try {
      const response = await fetch('/api/v1/knowledge-graph/nodes/clear-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation_token: 'CONFIRM_CLEAR_ALL',
          clear_domain_mappings: true,
          clear_neo4j: false,
        }),
      })

      if (!response.ok) {
        throw new Error('清空失败')
      }

      const data = await response.json()
      message.success(`成功清空！删除了 ${data.deleted_nodes} 个节点、${data.deleted_relations} 个关系`)
      setClearAllModalVisible(false)
      setClearPreviewData(null)
      loadKnowledgeGraph() // 重新加载数据
    } catch (error: any) {
      message.error(error.message || '清空失败')
      console.error(error)
    }
  }

  const getFilteredNodes = () => {
    return nodes.filter(node => {
      const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory
      const matchesType = selectedType === 'all' || node.type === selectedType
      const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDomain = selectedDomain === 'all' || 
        (node.domains && node.domains.some(d => d.domain_code === selectedDomain))
      return matchesCategory && matchesType && matchesSearch && matchesDomain
    })
  }

  const getPaginatedNodes = () => {
    const filtered = getFilteredNodes()
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filtered.slice(startIndex, endIndex)
  }

  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page)
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize)
      setCurrentPage(1) // 重置到第一页
    }
  }

  const getTypeColor = (type: string) => {
    // 映射13种实体类型到颜色（与后端knowledge_graph_service.py中的getTypeColor保持一致）
    switch (type) {
      case 'project': return '#fa8c16'      // 橙色 - 项目
      case 'material': return '#13c2c2'     // 青色 - 材料
      case 'equipment': return '#eb2f96'    // 洋红 - 设备
      case 'organization': return '#faad14' // 金色 - 组织
      case 'person': return '#2f54eb'       // 蓝色 - 人物
      case 'location': return '#a0d911'     // 黄绿 - 地点
      case 'standard': return '#722ed1'     // 紫色 - 标准
      case 'technology': return '#13c2c2'   // 青色 - 技术
      case 'process': return '#fa541c'      // 深橙 - 流程
      case 'cost': return '#f5222d'         // 红色 - 成本
      case 'document': return '#1890ff'     // 蓝色 - 文档
      case 'concept': return '#52c41a'      // 绿色 - 概念
      case 'entity': return '#722ed1'       // 紫色 - 实体
      default: return '#666'                // 灰色 - 未知
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
        <Title level={2} className="documents-title">知识图谱</Title>
        <Text type="secondary">可视化文档、概念和实体之间的关系网络</Text>
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
              <Select
                placeholder="知识领域"
                value={selectedDomain}
                onChange={setSelectedDomain}
                style={{ width: 150 }}
                allowClear
              >
                <Option value="all">全部领域</Option>
                {domains.map(domain => (
                  <Option key={domain.domain_code} value={domain.domain_code}>
                    <Tag color={domain.color}>{domain.domain_name}</Tag>
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={18} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建节点
              </Button>
              <Tooltip title="批量删除节点">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleOpenBatchDelete}
                >
                  批量删除
                </Button>
              </Tooltip>
              <Tooltip title="清空所有知识图谱数据（危险操作）">
                <Popconfirm
                  title="确认清空所有数据？"
                  description="此操作将删除所有节点和关系，不可恢复！"
                  onConfirm={handleOpenClearAll}
                  okText="确认"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    type="dashed"
                  >
                    一键清空
                  </Button>
                </Popconfirm>
              </Tooltip>
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
      <Card title="知识图谱网络" extra={
        <Space>
          <Tooltip title="缩放适应">
            <Button icon={<ZoomInOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="重置布局">
            <Button icon={<ReloadOutlined />} size="small" onClick={handleRefresh} />
          </Tooltip>
        </Space>
      }>
        {getFilteredNodes().length === 0 ? (
          <div style={{ 
            height: 600, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#999'
          }}>
            <Text>暂无匹配的节点</Text>
          </div>
        ) : (
          <Suspense fallback={<Spin spinning tip="加载图谱可视化组件..."><div style={{ height: 600 }} /></Spin>}>
            <KnowledgeGraphVisualization
              onNodeClick={handleViewNode}
              data={{
                nodes: getFilteredNodes().map(node => ({
                  id: node.id,
                  name: node.name,
                  label: node.name,
                  type: node.type,
                  connections: node.connections,
                  style: {
                    fill: getTypeColor(node.type),
                    stroke: getTypeColor(node.type),
                    lineWidth: node.importance === 'high' ? 3 : 2
                  },
                  size: node.importance === 'high' ? 40 : node.importance === 'medium' ? 30 : 25
                })),
                edges: edges
                  .filter(edge =>
                    getFilteredNodes().some(n => n.id === edge.source) &&
                    getFilteredNodes().some(n => n.id === edge.target)
                  )
                  .map(edge => ({
                    source: edge.source,
                    target: edge.target,
                    label: edge.type,
                    style: {
                      lineWidth: edge.weight * 3,
                      stroke: '#b5b5b5'
                    }
                  }))
              }}
              loading={loading}
              height={600}
            />
          </Suspense>
        )}
      </Card>

      {/* 节点详情弹窗 */}
      <Modal
        title={`节点详情 - ${selectedNode?.name || ''}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false)
              handleEditNode(selectedNode)
            }}
          >
            编辑
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除这个节点吗？"
            description="删除后将无法恢复，相关的关系也会被删除。"
            onConfirm={() => {
              handleDeleteNode(selectedNode?.id)
              setDetailModalVisible(false)
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ]}
        width={800}
      >
        {selectedNode && (
          <>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
              <Descriptions.Item label="名称">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={getTypeColor(selectedNode.node_type || selectedNode.type)}>
                  {selectedNode.node_type || selectedNode.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {(selectedNode.confidence || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="所属领域" span={2}>
                {selectedNode.domains && selectedNode.domains.length > 0 ? (
                  <Space size={8} wrap>
                    {selectedNode.domains.map((domain: any) => (
                      <Tag 
                        key={domain.domain_code} 
                        color={domain.color}
                      >
                        {domain.domain_name}
                        {domain.is_primary && ' (主领域)'}
                        <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                          ({(domain.confidence * 100).toFixed(0)}%)
                        </Text>
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">未分类</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedNode.description || selectedNode.properties?.description || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedNode.created_at ? new Date(selectedNode.created_at).toLocaleString('zh-CN') : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedNode.updated_at ? new Date(selectedNode.updated_at).toLocaleString('zh-CN') : '未知'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">关联关系 ({selectedNodeRelations.length})</Divider>

            {selectedNodeRelations.length > 0 ? (
              <List
                size="small"
                dataSource={selectedNodeRelations}
                renderItem={(relation: any) => {
                  const isOutgoing = relation.source_node?.id === selectedNode.id
                  const otherNode = isOutgoing ? relation.target_node : relation.source_node

                  return (
                    <List.Item
                      actions={[
                        <Tooltip title="查看关联节点">
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => {
                              setDetailModalVisible(false)
                              handleViewNode(otherNode?.id)
                            }}
                          />
                        </Tooltip>
                      ]}
                    >
                      <Space>
                        {isOutgoing ? (
                          <>
                            <Tag color="blue">{selectedNode.name}</Tag>
                            <ArrowRightOutlined style={{ color: '#1890ff' }} />
                            <Tag color="purple">{relation.relation_type || relation.type}</Tag>
                            <ArrowRightOutlined style={{ color: '#1890ff' }} />
                            <Tag color="green">{otherNode?.name || 'N/A'}</Tag>
                          </>
                        ) : (
                          <>
                            <Tag color="green">{otherNode?.name || 'N/A'}</Tag>
                            <ArrowRightOutlined style={{ color: '#1890ff' }} />
                            <Tag color="purple">{relation.relation_type || relation.type}</Tag>
                            <ArrowRightOutlined style={{ color: '#1890ff' }} />
                            <Tag color="blue">{selectedNode.name}</Tag>
                          </>
                        )}
                        {relation.confidence && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            (置信度: {relation.confidence.toFixed(2)})
                          </Text>
                        )}
                      </Space>
                    </List.Item>
                  )
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                暂无关联关系
              </div>
            )}
          </>
        )}
      </Modal>

      {/* 编辑节点弹窗 */}
      <Modal
        title="编辑节点"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveEdit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="节点名称"
            rules={[{ required: true, message: '请输入节点名称' }, { min: 2, message: '节点名称至少2个字符' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="节点类型"
            rules={[{ required: true, message: '请选择节点类型' }]}
          >
            <Select placeholder="请选择节点类型" showSearch>
              <Option value="project">项目</Option>
              <Option value="material">材料</Option>
              <Option value="equipment">设备</Option>
              <Option value="organization">组织</Option>
              <Option value="person">人物</Option>
              <Option value="location">地点</Option>
              <Option value="standard">标准/规范</Option>
              <Option value="technology">技术</Option>
              <Option value="process">流程/工艺</Option>
              <Option value="cost">成本</Option>
              <Option value="document">文档</Option>
              <Option value="concept">概念</Option>
              <Option value="entity">实体</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={4} placeholder="请输入节点描述" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建节点弹窗 */}
      <Modal
        title="创建新节点"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        onOk={handleCreateNode}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="节点名称"
            rules={[{ required: true, message: '请输入节点名称' }, { min: 2, message: '节点名称至少2个字符' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="节点类型"
            rules={[{ required: true, message: '请选择节点类型' }]}
            initialValue="concept"
          >
            <Select placeholder="请选择节点类型" showSearch>
              <Option value="project">项目</Option>
              <Option value="material">材料</Option>
              <Option value="equipment">设备</Option>
              <Option value="organization">组织</Option>
              <Option value="person">人物</Option>
              <Option value="location">地点</Option>
              <Option value="standard">标准/规范</Option>
              <Option value="technology">技术</Option>
              <Option value="process">流程/工艺</Option>
              <Option value="cost">成本</Option>
              <Option value="document">文档</Option>
              <Option value="concept">概念</Option>
              <Option value="entity">实体</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={4} placeholder="请输入节点描述（选填）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量删除弹窗 */}
      <Modal
        title="批量删除节点"
        open={batchDeleteModalVisible}
        onCancel={() => {
          setBatchDeleteModalVisible(false)
          setPreviewData(null)
          batchDeleteForm.resetFields()
        }}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => {
            setBatchDeleteModalVisible(false)
            setPreviewData(null)
            batchDeleteForm.resetFields()
          }}>
            取消
          </Button>,
          <Button key="preview" onClick={handlePreviewBatchDelete}>
            预览
          </Button>,
          <Popconfirm
            key="delete"
            title="确认批量删除"
            description="此操作不可撤销，确定要删除这些节点吗？"
            onConfirm={handleExecuteBatchDelete}
            okText="确认删除"
            cancelText="取消"
          >
            <Button type="primary" danger disabled={!previewData}>
              执行删除
            </Button>
          </Popconfirm>
        ]}
      >
        <Form form={batchDeleteForm} layout="vertical">
          <Form.Item label="删除方式">
            <Select value={deleteMode} onChange={setDeleteMode}>
              <Option value="type">按节点类型删除</Option>
              <Option value="pattern">按名称模糊匹配删除</Option>
              <Option value="quality">按质量分数删除</Option>
            </Select>
          </Form.Item>

          {deleteMode === 'type' && (
            <Form.Item
              name="node_types"
              label="选择要删除的节点类型"
              rules={[{ required: true, message: '请至少选择一种节点类型' }]}
            >
              <Select mode="multiple" placeholder="请选择节点类型">
                <Option value="project">项目</Option>
                <Option value="material">材料</Option>
                <Option value="equipment">设备</Option>
                <Option value="organization">组织</Option>
                <Option value="person">人物</Option>
                <Option value="location">地点</Option>
                <Option value="standard">标准/规范</Option>
                <Option value="technology">技术</Option>
                <Option value="process">流程/工艺</Option>
                <Option value="cost">成本</Option>
                <Option value="document">文档</Option>
                <Option value="concept">概念</Option>
                <Option value="entity">实体</Option>
              </Select>
            </Form.Item>
          )}

          {deleteMode === 'pattern' && (
            <Form.Item
              name="name_pattern"
              label="节点名称关键词"
              rules={[{ required: true, message: '请输入关键词' }]}
            >
              <Input placeholder="输入节点名称关键词（如：混凝土、钢筋）" />
            </Form.Item>
          )}

          {deleteMode === 'quality' && (
            <Form.Item
              name="min_quality_score"
              label="最低质量分数"
              rules={[{ required: true, message: '请输入质量分数' }]}
              initialValue={0.3}
            >
              <Input type="number" min={0} max={1} step={0.1} placeholder="删除低于此分数的节点（0-1）" />
            </Form.Item>
          )}

          {/* 节点类型统计 */}
          {nodeTypes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>当前节点类型统计：</Text>
              <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                {nodeTypes.map((stat: any) => (
                  <div key={stat.node_type} style={{ padding: '4px 0' }}>
                    <Tag color={getTypeColor(stat.node_type)}>
                      {stat.node_type}
                    </Tag>
                    <Text> 数量: {stat.count}</Text>
                    {stat.avg_quality && <Text type="secondary"> | 平均质量: {stat.avg_quality.toFixed(2)}</Text>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 预览结果 */}
          {previewData && (
            <Alert
              type="warning"
              message={`将删除 ${previewData.deleted_nodes_count} 个节点，${previewData.deleted_relations_count} 个关系`}
              description={
                previewData.preview_nodes && previewData.preview_nodes.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                    <Text strong>预览节点（前10个）：</Text>
                    <List
                      size="small"
                      dataSource={previewData.preview_nodes.slice(0, 10)}
                      renderItem={(node: any) => (
                        <List.Item>
                          <Tag color={getTypeColor(node.type)}>{node.type}</Tag>
                          {node.name}
                        </List.Item>
                      )}
                    />
                  </div>
                )
              }
              showIcon
            />
          )}
        </Form>
      </Modal>

      {/* 一键清空弹窗 */}
      <Modal
        title="⚠️ 一键清空知识图谱"
        open={clearAllModalVisible}
        onCancel={() => {
          setClearAllModalVisible(false)
          setClearPreviewData(null)
        }}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => {
            setClearAllModalVisible(false)
            setClearPreviewData(null)
          }}>
            取消
          </Button>,
          <Popconfirm
            key="clear"
            title="最后确认"
            description="此操作将永久删除所有知识图谱数据，不可恢复！确定继续吗？"
            onConfirm={handleExecuteClearAll}
            okText="确认清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="primary" danger>
              确认清空
            </Button>
          </Popconfirm>
        ]}
      >
        {clearPreviewData && (
          <div>
            <Alert
              type="error"
              message="警告：此操作不可恢复！"
              description={clearPreviewData.warning_message}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="总节点数">{clearPreviewData.total_nodes?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="总关系数">{clearPreviewData.total_relations?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="领域映射数">{clearPreviewData.total_domain_mappings?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="时间范围">
                {clearPreviewData.oldest_node_date && clearPreviewData.newest_node_date ? (
                  <>
                    {new Date(clearPreviewData.oldest_node_date).toLocaleDateString()} - {new Date(clearPreviewData.newest_node_date).toLocaleDateString()}
                  </>
                ) : '无'}
              </Descriptions.Item>
            </Descriptions>

            {clearPreviewData.node_type_distribution && clearPreviewData.node_type_distribution.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>节点类型分布（Top 10）：</Text>
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {clearPreviewData.node_type_distribution.slice(0, 10).map((item: any) => (
                    <div key={item.node_type || 'unknown'} style={{ padding: '4px 0' }}>
                      <Tag color={getTypeColor(item.node_type)}>
                        {item.node_type || '[未分类]'}
                      </Tag>
                      <Text> {item.count?.toLocaleString()} 个 </Text>
                      <Text type="secondary">
                        ({((item.count / clearPreviewData.total_nodes) * 100).toFixed(1)}%)
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clearPreviewData.domain_distribution && clearPreviewData.domain_distribution.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>领域分布（Top 10）：</Text>
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {clearPreviewData.domain_distribution.slice(0, 10).map((item: any) => (
                    <div key={item.domain_name} style={{ padding: '4px 0' }}>
                      <Tag color={domains.find(d => d.domain_name === item.domain_name)?.color}>
                        {item.domain_name}
                      </Tag>
                      <Text> {item.count?.toLocaleString()} 个 </Text>
                      <Text type="secondary">
                        ({((item.count / clearPreviewData.total_domain_mappings) * 100).toFixed(1)}%)
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default KnowledgeGraphPage