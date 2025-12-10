/**
 * HistoricalDataPage 重构示例
 *
 * 这个文件展示如何将现有的HistoricalDataPage改造为使用templatesApi
 * 并添加14级成本明细展示和"用于估算"功能
 *
 * 关键改动：
 * 1. 使用 templatesApi 替代 estimatesApi
 * 2. 添加 expandedRowRender 显示14级成本明细
 * 3. 添加"用于估算"按钮跳转到SmartEstimatePage
 * 4. 简化不必要的复杂逻辑
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Table,
  Space,
  Upload,
  message,
  Modal,
  Alert,
  Tooltip,
  Tag
} from 'antd'
import {
  UploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  CalculatorOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

// ===== 1. 导入 templatesApi =====
import {
  useGetTemplatesQuery,
  useDeleteTemplateMutation,
  type ProjectTemplate,
  type ProjectTemplateCostItem
} from '@/store/api/templatesApi'

const { Title, Text } = Typography

const HistoricalDataPage: React.FC = () => {
  const navigate = useNavigate()

  // ===== 2. 状态管理 =====
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadFileList, setUploadFileList] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [searchParams, setSearchParams] = useState({
    page: 1,
    size: 20
  })

  // ===== 3. 使用 templatesApi 获取数据 =====
  const {
    data: templatesData,
    isLoading,
    error,
    refetch
  } = useGetTemplatesQuery(searchParams)

  const [deleteTemplate] = useDeleteTemplateMutation()

  // ===== 4. Excel上传处理 =====
  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      message.error('请选择要上传的Excel文件')
      return
    }

    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const file of uploadFileList) {
        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/v1/templates/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            },
            body: formData
          })

          if (response.ok) {
            const result = await response.json()
            console.log(`文件 ${file.name} 上传成功:`, result)
            successCount++
          } else {
            console.error(`文件 ${file.name} 上传失败`)
            failCount++
          }
        } catch (error) {
          console.error(`文件 ${file.name} 上传异常:`, error)
          failCount++
        }
      }

      if (successCount > 0) {
        message.success(`成功上传 ${successCount} 个文件${failCount > 0 ? `，${failCount} 个失败` : ''}`)
        setUploadModalVisible(false)
        setUploadFileList([])
        refetch()
      } else {
        message.error('所有文件上传失败')
      }
    } catch (error) {
      message.error('上传过程出错')
    } finally {
      setUploading(false)
    }
  }

  // ===== 5. 删除模板处理 =====
  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个项目模板吗？此操作不可撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTemplate(id).unwrap()
          message.success('删除成功')
          refetch()
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  // ===== 6. "用于估算"按钮处理 =====
  const handleUseForEstimation = (template: ProjectTemplate) => {
    // 跳转到SmartEstimatePage并传递参考项目数据
    navigate('/estimates/smart', {
      state: {
        referenceProject: {
          id: template.id,
          name: template.name,
          area: template.area,
          unit_cost: template.unit_cost,
          total_cost: template.total_cost,
          cost_items: template.cost_items
        }
      }
    })
  }

  // ===== 7. 14级成本明细展示 (expandedRowRender) =====
  const expandedRowRender = (record: ProjectTemplate) => {
    // 按层级分组
    const primaryItems = record.cost_items.filter(item => item.is_primary_section)
    const secondaryItems = record.cost_items.filter(item => item.is_secondary_section)

    // 组织层级数据
    const hierarchicalData = primaryItems.map(primary => {
      const children = secondaryItems.filter(
        sec => sec.primary_section_code === primary.item_code
      )

      return {
        ...primary,
        children: children.length > 0 ? children : undefined
      }
    })

    // 14级明细表格列定义
    const detailColumns: ColumnsType<ProjectTemplateCostItem> = [
      {
        title: '代码',
        dataIndex: 'item_code',
        width: 100,
        render: (code: string, item: ProjectTemplateCostItem) => (
          <Text strong={item.is_primary_section} style={{
            color: item.is_primary_section ? '#1890ff' : undefined
          }}>
            {code}
          </Text>
        )
      },
      {
        title: '项目名称',
        dataIndex: 'item_name',
        width: 300,
        render: (name: string, item: ProjectTemplateCostItem) => (
          <Text strong={item.is_primary_section}>
            {name}
          </Text>
        )
      },
      {
        title: '单价(元/m²)',
        dataIndex: 'unit_price',
        width: 150,
        align: 'right',
        render: (price: number | null) =>
          price !== null ? `¥${price.toFixed(2)}` : '-'
      },
      {
        title: '合价(元)',
        dataIndex: 'total_price',
        width: 150,
        align: 'right',
        render: (price: number | null) =>
          price !== null ? `¥${(price / 10000).toFixed(2)}万` : '-'
      },
      {
        title: '类型',
        dataIndex: 'item_type',
        width: 100,
        render: (type: string, item: ProjectTemplateCostItem) => {
          if (item.is_primary_section) {
            return <Tag color="blue">一级分部</Tag>
          } else if (item.is_secondary_section) {
            return <Tag>二级分项</Tag>
          }
          return <Tag color="default">明细</Tag>
        }
      }
    ]

    return (
      <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
        <Title level={5}>14级成本明细</Title>
        <Alert
          message="数据说明"
          description="展示该项目的完整成本结构：一级分部（1.0-14.0）和二级分项明细。第14项为总造价，等于前13项之和。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={detailColumns}
          dataSource={hierarchicalData}
          pagination={false}
          size="small"
          bordered
          rowKey="id"
          // 支持层级展开显示二级分项
          expandable={{
            childrenColumnName: 'children',
            defaultExpandAllRows: false,
            indentSize: 20
          }}
          // 行样式：一级分部加粗背景
          rowClassName={(record: ProjectTemplateCostItem) =>
            record.is_primary_section ? 'primary-section-row' : ''
          }
        />
      </div>
    )
  }

  // ===== 8. 主表格列定义 =====
  const columns: ColumnsType<ProjectTemplate> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string, record: ProjectTemplate) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          {record.source_file && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              来源: {record.source_file}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '建筑面积',
      dataIndex: 'area',
      key: 'area',
      width: 120,
      align: 'right',
      render: (area: number) => `${area.toLocaleString()} ㎡`
    },
    {
      title: '单位造价',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 130,
      align: 'right',
      render: (cost: number | null) =>
        cost ? `¥${cost.toLocaleString()}/㎡` : '-'
    },
    {
      title: '总造价',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 150,
      align: 'right',
      render: (cost: number | null) =>
        cost ? `¥${(cost / 10000).toFixed(2)}万` : '-'
    },
    {
      title: '层数',
      dataIndex: 'floors',
      key: 'floors',
      width: 120,
      render: (floors: string | null) => floors || '-'
    },
    {
      title: '成本项数量',
      key: 'cost_items_count',
      width: 120,
      align: 'center',
      render: (_, record: ProjectTemplate) => (
        <Tag color="blue">
          <DatabaseOutlined /> {record.cost_items?.length || 0}项
        </Tag>
      )
    },
    {
      title: '解析时间',
      dataIndex: 'parsed_at',
      key: 'parsed_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record: ProjectTemplate) => (
        <Space>
          <Tooltip title="使用此项目作为估算参考">
            <Button
              type="primary"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleUseForEstimation(record)}
            >
              用于估算
            </Button>
          </Tooltip>

          <Tooltip title="删除项目模板">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  // ===== 9. 渲染主界面 =====
  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>历史数据管理</Title>
        <Text type="secondary">
          管理项目模板数据，支持Excel导入和14级成本明细查看
        </Text>
      </div>

      {/* 快速操作区 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <Button
            type="primary"
            icon={<UploadOutlined />}
            size="large"
            onClick={() => setUploadModalVisible(true)}
          >
            上传Excel文件
          </Button>

          <div>
            <Text type="secondary">总计: </Text>
            <Text strong>{templatesData?.total || 0}</Text>
            <Text type="secondary"> 个项目模板</Text>
          </div>
        </Space>
      </Card>

      {/* 项目模板列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={templatesData?.templates || []}
          loading={isLoading}
          rowKey="id"
          // ===== 关键：添加 expandable 配置 =====
          expandable={{
            expandedRowRender,
            rowExpandable: (record) =>
              record.cost_items && record.cost_items.length > 0
          }}
          pagination={{
            current: searchParams.page,
            pageSize: searchParams.size,
            total: templatesData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setSearchParams({ page, size })
            }
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Excel上传弹窗 */}
      <Modal
        title="上传Excel文件"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setUploadModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploading}
            onClick={handleUpload}
            disabled={uploadFileList.length === 0}
          >
            开始上传
          </Button>
        ]}
        width={600}
      >
        <Alert
          message="支持多项目Excel格式"
          description="请上传包含工程造价数据的Excel文件。系统将自动识别并解析14级成本结构（一级分部1.0-14.0和二级分项明细）。支持同时解析多个项目（最多7个）。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Upload.Dragger
          multiple
          accept=".xlsx,.xls"
          beforeUpload={(file) => {
            const isExcel =
              file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              file.type === 'application/vnd.ms-excel'

            if (!isExcel) {
              message.error('只能上传Excel文件!')
              return false
            }

            const isLt10M = file.size / 1024 / 1024 < 10
            if (!isLt10M) {
              message.error('文件大小不能超过10MB!')
              return false
            }

            return false // 阻止自动上传
          }}
          onChange={(info) => {
            setUploadFileList(info.fileList.map(f => f.originFileObj as File))
          }}
          showUploadList={true}
        >
          <p className="ant-upload-drag-icon">
            <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传，文件大小不超过10MB
          </p>
        </Upload.Dragger>
      </Modal>

      {/* CSS样式（可选） */}
      <style>{`
        .primary-section-row {
          background-color: #e6f7ff;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}

export default HistoricalDataPage


/**
 * ============================================
 * 如何应用这些修改到现有的HistoricalDataPage.tsx
 * ============================================
 *
 * 1. 替换imports：
 *    - 删除所有 estimatesApi 相关的imports
 *    - 添加 templatesApi 的imports
 *
 * 2. 替换数据获取：
 *    - 将 useGetHistoricalProjectsQuery 改为 useGetTemplatesQuery
 *    - 将 useDeleteHistoricalProjectMutation 改为 useDeleteTemplateMutation
 *
 * 3. 添加 expandedRowRender 函数（第7步的完整代码）
 *
 * 4. 在主Table组件添加 expandable 配置：
 *    expandable={{
 *      expandedRowRender,
 *      rowExpandable: (record) => record.cost_items && record.cost_items.length > 0
 *    }}
 *
 * 5. 添加 handleUseForEstimation 函数（第6步）
 *
 * 6. 在columns的操作列添加"用于估算"按钮
 *
 * 7. 更新 handleUpload 函数使用新的API路径（已完成）
 *
 * 8. 删除不必要的复杂逻辑：
 *    - 可以删除 HistoricalProject 类型
 *    - 可以删除复杂的过滤和搜索逻辑
 *    - 简化tabs为单一列表视图
 *
 * ============================================
 * 核心改动位置总结
 * ============================================
 *
 * 位置1: Imports (第1步)
 * 位置2: 数据获取hooks (第3步)
 * 位置3: expandedRowRender函数 (第7步) - 新增约50行
 * 位置4: Table的expandable配置 - 新增3行
 * 位置5: handleUseForEstimation函数 (第6步) - 新增约15行
 * 位置6: columns中的操作列 - 修改约20行
 *
 * 总计：需要修改/新增约100行代码
 */
