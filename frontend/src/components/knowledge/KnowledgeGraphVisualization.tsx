import React, { useEffect, useRef, useState } from 'react'
import { Spin, Card, Space, Button, Select, Slider, Switch, Input, message, Tooltip } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'

const { Option } = Select
const { Search } = Input

interface GraphData {
  nodes: any[]
  edges: any[]
}

interface Props {
  data: GraphData
  loading?: boolean
  height?: number
  onNodeClick?: (nodeId: string) => void
}

const KnowledgeGraphVisualization: React.FC<Props> = ({
  data,
  loading = false,
  height = 600,
  onNodeClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const layoutType = 'force'  // 固定使用力导向图布局
  const [nodeSize, setNodeSize] = useState(30)
  const [showLabels, setShowLabels] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [layoutLoading, setLayoutLoading] = useState(false)

  // 节点颜色映射（与后端knowledge_graph_service.py和KnowledgeGraphPage.tsx保持一致）
  const getTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'project': '#fa8c16',      // 橙色 - 项目
      'material': '#13c2c2',     // 青色 - 材料
      'equipment': '#eb2f96',    // 洋红 - 设备
      'organization': '#faad14', // 金色 - 组织
      'person': '#2f54eb',       // 蓝色 - 人物
      'location': '#a0d911',     // 黄绿 - 地点
      'standard': '#722ed1',     // 紫色 - 标准
      'technology': '#13c2c2',   // 青色 - 技术
      'process': '#fa541c',      // 深橙 - 流程
      'cost': '#f5222d',         // 红色 - 成本
      'document': '#1890ff',     // 蓝色 - 文档
      'concept': '#52c41a',      // 绿色 - 概念
      'entity': '#722ed1'        // 紫色 - 实体
    }
    return colorMap[type] || '#666'  // 默认灰色
  }

  useEffect(() => {
    if (!containerRef.current || loading || !data.nodes.length) return

    setLayoutLoading(true)

    // 节点过多时的处理策略
    if (data.nodes.length > 500 && layoutType !== 'force') {
      message.warning(`节点数量较多(${data.nodes.length}个)，建议使用"力导向"布局以获得更好性能`)

      // 对于超大图谱，非force布局可能导致卡顿，给予更明确的提示
      if (data.nodes.length > 1000) {
        const complexLayouts = ['radial', 'dagre', 'concentric']
        const waitTime = complexLayouts.includes(layoutType) ? '60-90秒' : '30-60秒'
        message.info(`正在计算${layoutType}布局，请耐心等待${waitTime}...页面可能会短暂卡顿，请勿刷新！`, 8)
      }
    }

    // 延迟执行以显示加载状态
    setTimeout(() => {
      import('@antv/g6').then((G6Module) => {
        const G6 = G6Module.default || G6Module

        if (graphRef.current) graphRef.current.destroy()

      // 增强的节点数据
      const enhancedData = {
        nodes: data.nodes.map((node: any, index: number) => ({
          ...node,
          id: node.id || `node-${index}`,  // 确保有ID
          size: nodeSize + (node.connections || 0) * 2,
          label: showLabels ? node.name || node.label : '',
          // 添加初始坐标，避免G6报错
          x: undefined,
          y: undefined,
          style: {
            fill: getTypeColor(node.type),
            stroke: '#fff',
            lineWidth: 2
          }
        })),
        edges: data.edges.map((edge: any, index: number) => ({
          ...edge,
          id: edge.id || `edge-${index}`,  // 确保边也有ID
          source: edge.source?.toString(),
          target: edge.target?.toString()
        }))
      }

      // 力导向图布局配置
      const layoutConfig = {
        type: 'force',
        preventOverlap: true,
        nodeSpacing: 60,
        linkDistance: 150,
        nodeStrength: -300,
        edgeStrength: 0.2,
        alphaDecay: 0.028
      }

      const graph = new G6.Graph({
        container: containerRef.current,
        width: containerRef.current.offsetWidth,
        height,
        modes: {
          default: [
            'drag-canvas',
            'zoom-canvas',
            'drag-node',
            {
              type: 'tooltip',
              formatText: (model: any) => {
                return `<div style="padding:8px"><b>${model.name || model.label}</b><br/>类型: ${model.type}<br/>连接: ${model.connections || 0}</div>`
              }
            },
            {
              type: 'activate-relations',
              trigger: 'mouseenter',
              activeState: 'active',
              inactiveState: 'inactive'
            }
          ]
        },
        layout: layoutConfig,
        defaultNode: {
          labelCfg: {
            position: 'bottom',
            offset: 5,
            style: { fontSize: 12, fill: '#333', background: { fill: '#fff', padding: [2, 4] } }
          }
        },
        defaultEdge: {
          style: {
            stroke: '#b3b3b3',
            lineWidth: 1.5,
            opacity: 0.6,
            endArrow: { path: G6.Arrow.triangle(8, 10, 0), fill: '#b3b3b3' }
          }
        },
        nodeStateStyles: {
          active: { stroke: '#f00', lineWidth: 3 },
          inactive: { opacity: 0.2 },
          selected: { stroke: '#f00', lineWidth: 3, shadowBlur: 10 }
        },
        edgeStateStyles: {
          active: { stroke: '#f00', lineWidth: 2 },
          inactive: { opacity: 0.1 }
        }
      })

      graph.data(enhancedData)
      graph.render()
      graphRef.current = graph

      // 监听布局完成事件
      let layoutCompleted = false
      graph.on('afterlayout', () => {
        if (!layoutCompleted) {
          layoutCompleted = true
          setLayoutLoading(false)
          // 布局完成后自动适应视图
          setTimeout(() => {
            graph.fitView(20)
          }, 100)
        }
      })

      // 如果布局算法不触发afterlayout事件，设置超时
      // 根据节点数量和布局类型动态调整超时时间
      const getTimeoutDuration = () => {
        const baseTimeout = data.nodes.length > 1000 ? 60000 :  // 60秒
                           data.nodes.length > 500 ? 30000 :   // 30秒
                           10000                               // 10秒

        // 某些布局算法需要更长时间
        const complexLayouts = ['radial', 'dagre', 'concentric']
        if (complexLayouts.includes(layoutType) && data.nodes.length > 1000) {
          return 90000  // 90秒
        }

        return baseTimeout
      }

      const timeoutDuration = getTimeoutDuration()
      const layoutTimeout = setTimeout(() => {
        if (!layoutCompleted) {
          layoutCompleted = true
          setLayoutLoading(false)
          // 如果超时仍未完成，可能是布局计算卡住了
          if (data.nodes.length > 500) {
            message.warning('布局计算时间较长，已强制完成。如遇卡顿，请尝试"力导向"布局')
          }
          // 超时后也尝试适应视图
          setTimeout(() => {
            graph.fitView(20)
          }, 100)
        }
      }, timeoutDuration)

      // 初始也调用一次fitView，以防布局事件不触发
      setTimeout(() => {
        graph.fitView(20)
      }, 500)

      graph.on('node:click', (evt: any) => {
        const node = evt.item
        graph.setItemState(node, 'selected', true)
        if (onNodeClick) onNodeClick(evt.item.getModel().id)
      })

      graph.on('canvas:click', () => {
        graph.findAllByState('node', 'selected').forEach((node: any) => {
          graph.setItemState(node, 'selected', false)
        })
      })

      const handleResize = () => {
        if (containerRef.current && graph) {
          graph.changeSize(containerRef.current.offsetWidth, height)
        }
      }
      window.addEventListener('resize', handleResize)

      return () => {
        clearTimeout(layoutTimeout)  // 清除布局超时
        window.removeEventListener('resize', handleResize)
        if (graph && !graph.destroyed) graph.destroy()
      }
    }).catch((error) => {
      console.error('G6加载失败:', error)
      setLayoutLoading(false)
      message.error('图谱可视化加载失败')
    })
    }, 100) // 延迟100ms以显示加载状态

    return () => {
      if (graphRef.current && !graphRef.current.destroyed) graphRef.current.destroy()
    }
  }, [data, loading, height, layoutType, nodeSize, showLabels])

  const handleZoom = (type: 'in' | 'out' | 'fit') => {
    if (!graphRef.current) return
    const graph = graphRef.current
    if (type === 'in') graph.zoom(1.2)
    else if (type === 'out') graph.zoom(0.8)
    else graph.fitView(20)
  }

  const handleSearch = (value: string) => {
    if (!graphRef.current || !value) return
    const nodes = graphRef.current.getNodes().filter((node: any) => {
      const model = node.getModel()
      return model.name && model.name.toLowerCase().includes(value.toLowerCase())
    })
    if (nodes.length > 0) {
      graphRef.current.focusItem(nodes[0])
      message.success(`找到 ${nodes.length} 个节点`)
    } else {
      message.warning('未找到匹配节点')
    }
  }

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 500 }}>布局: 力导向图</span>
          <span>大小:</span>
          <Slider value={nodeSize} onChange={setNodeSize} min={20} max={60} style={{ width: 100 }} disabled={layoutLoading} />
          <Switch checked={showLabels} onChange={setShowLabels} checkedChildren="标签" unCheckedChildren="标签" disabled={layoutLoading} />
          <Button icon={<ZoomInOutlined />} onClick={() => handleZoom('in')} disabled={layoutLoading} />
          <Button icon={<ZoomOutOutlined />} onClick={() => handleZoom('out')} disabled={layoutLoading} />
          <Button icon={<ReloadOutlined />} onClick={() => handleZoom('fit')} disabled={layoutLoading}>适应</Button>
          <Search placeholder="搜索节点" onSearch={handleSearch} style={{ width: 200 }} disabled={layoutLoading} />
        </Space>
      </div>
      <Spin spinning={loading || layoutLoading} tip={layoutLoading ? '正在计算布局...' : '加载中...'}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            backgroundColor: '#fafafa'
          }}
        />
      </Spin>
      <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
        节点: {data.nodes.length} | 关系: {data.edges.length}
      </div>
    </Card>
  )
}

export default KnowledgeGraphVisualization
