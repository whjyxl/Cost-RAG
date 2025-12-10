import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  Button,
  Space,
  Spin,
  Tag,
  List,
  Tooltip,
  message,
  Divider,
  Progress,
  Badge,
  Empty,
  Switch,
  InputNumber,
  Modal,
  Form,
  Select,
} from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  SettingOutlined,
  DashboardOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import APIStatusIndicator from '../../components/api/APIStatusIndicator'
import { useAllAPIStatus, useSingleAPIStatus } from '../../hooks/useAPIStatus'
import type { APIStatus } from '../../components/api/APIStatusIndicator'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const APIStatusDashboardPage: React.FC = () => {
  // 状态管理
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [refreshInterval, setRefreshInterval] = useState<number>(30)
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false)
  const [selectedStatus, setSelectedStatus] = useState<APIStatus | null>(null)

  // 使用Hook获取所有API状态
  const {
    allStatuses,
    loading,
    error,
    testConnection,
    refreshStatus,
    clearCache,
    isHealthy,
    lastUpdate
  } = useAllAPIStatus({
    autoRefresh,
    refreshInterval: refreshInterval * 1000, // 转换为毫秒
    showToast: false
  })

  // 使用Hook获取单个提供商状态（用于详情模态框）
  const {
    status: detailedStatus,
    testConnection: testSingleConnection
  } = useSingleAPIStatus(selectedProvider, {
    autoRefresh: false,
    showToast: true
  })

  // 计算统计信息
  const statistics = {
    total: allStatuses.length,
    connected: allStatuses.filter(s => s.status === 'connected').length,
    disconnected: allStatuses.filter(s => s.status === 'disconnected').length,
    unknown: allStatuses.filter(s => s.status === 'unknown').length,
    configured: allStatuses.filter(s => s.configured).length,
  }

  // 获取整体健康状态
  const getOverallHealthStatus = () => {
    if (statistics.connected === statistics.total && statistics.total > 0) {
      return { status: 'healthy', color: '#52c41a', text: '系统健康', icon: <CheckCircleOutlined /> }
    } else if (statistics.disconnected > 0) {
      return { status: 'unhealthy', color: '#ff4d4f', text: '系统异常', icon: <CloseCircleOutlined /> }
    } else if (statistics.unknown > 0) {
      return { status: 'warning', color: '#faad14', text: '状态未知', icon: <WarningOutlined /> }
    } else {
      return { status: 'unknown', color: '#d9d9d9', text: '无数据', icon: <QuestionCircleOutlined /> }
    }
  }

  // 处理连接测试
  const handleTestConnection = async (provider: string) => {
    await testConnection(provider)
  }

  // 处理刷新
  const handleRefresh = async () => {
    await refreshStatus()
    message.success('状态已刷新')
  }

  // 处理清除缓存
  const handleClearCache = () => {
    clearCache()
    message.success('缓存已清除')
  }

  // 显示详情模态框
  const showDetailModal = (status: APIStatus) => {
    setSelectedStatus(status)
    setSelectedProvider(status.provider)
    setDetailModalVisible(true)
  }

  // 获取状态图标
  const getStatusIcon = (status: APIStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'disconnected':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'testing':
        return <ReloadOutlined spin style={{ color: '#1890ff' }} />
      default:
        return <QuestionCircleOutlined style={{ color: '#faad14' }} />
    }
  }

  // 获取健康度百分比
  const getHealthPercentage = () => {
    if (statistics.total === 0) return 0
    return Math.round((statistics.connected / statistics.total) * 100)
  }

  const healthStatus = getOverallHealthStatus()

  return (
    <div>
      {/* 页面标题和操作区 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <DashboardOutlined /> API状态监控
          </Title>
          <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
            实时监控各个AI服务提供商的API连接状态
            {lastUpdate && (
              <Text type="secondary" style={{ marginLeft: 16 }}>
                <ClockCircleOutlined /> 最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
              </Text>
            )}
          </Paragraph>
        </div>

        <Space>
          <Tooltip title="设置">
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsVisible(true)}
            >
              设置
            </Button>
          </Tooltip>
          <Tooltip title="清除缓存">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleClearCache}
            >
              清除缓存
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRefresh}
          >
            刷新状态
          </Button>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="获取状态失败"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 整体状态概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="整体状态"
              value={healthStatus.text}
              prefix={healthStatus.icon}
              valueStyle={{ color: healthStatus.color }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="健康度"
              value={getHealthPercentage()}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: getHealthPercentage() >= 80 ? '#3f8600' : getHealthPercentage() >= 50 ? '#faad14' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已连接"
              value={statistics.connected}
              suffix={`/ ${statistics.total}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="连接失败"
              value={statistics.disconnected}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 健康度进度条 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text strong>系统健康度</Text>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">
                {statistics.connected} 个正常 / {statistics.total} 个总计
              </Text>
            </div>
          </div>
          <div style={{ flex: 1, marginLeft: 24, marginRight: 24 }}>
            <Progress
              percent={getHealthPercentage()}
              status={getHealthPercentage() === 100 ? 'success' : getHealthPercentage() === 0 ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a',
              }}
            />
          </div>
          <Badge status={healthStatus.status as any} text={healthStatus.text} />
        </div>
      </Card>

      {/* API状态列表 */}
      <Row gutter={16}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                <span>API服务状态</span>
                <Badge count={statistics.total} showZero />
              </Space>
            }
            extra={
              <Space>
                <Badge status="success" text={`正常 ${statistics.connected}`} />
                <Badge status="error" text={`异常 ${statistics.disconnected}`} />
                <Badge status="default" text={`未知 ${statistics.unknown}`} />
              </Space>
            }
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">正在检查API状态...</Text>
                </div>
              </div>
            ) : allStatuses.length === 0 ? (
              <Empty
                description="暂无API状态数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={allStatuses}
                renderItem={(apiStatus) => (
                  <List.Item
                    actions={[
                      <Tooltip title="测试连接">
                        <Button
                          type="text"
                          icon={<ThunderboltOutlined />}
                          loading={apiStatus.status === 'testing'}
                          onClick={() => handleTestConnection(apiStatus.provider)}
                        />
                      </Tooltip>,
                      <Tooltip title="查看详情">
                        <Button
                          type="text"
                          icon={<ApiOutlined />}
                          onClick={() => showDetailModal(apiStatus)}
                        />
                      </Tooltip>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(apiStatus.status)}
                      title={
                        <Space>
                          <Text strong>{apiStatus.provider}</Text>
                          {!apiStatus.configured && <Tag color="orange">未配置</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Text type="secondary">
                            状态: {apiStatus.status === 'connected' ? '已连接' :
                                  apiStatus.status === 'disconnected' ? '连接失败' : '未知'}
                          </Text>
                          {apiStatus.lastCheck && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              最后检查: {apiStatus.lastCheck}
                            </Text>
                          )}
                          {apiStatus.responseTime && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              响应时间: {apiStatus.responseTime}ms
                            </Text>
                          )}
                          {apiStatus.error && (
                            <Text type="danger" style={{ fontSize: '12px' }}>
                              错误: {apiStatus.error}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 设置模态框 */}
      <Modal
        title="监控设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsVisible(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => setSettingsVisible(false)}>
            确定
          </Button>,
        ]}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>自动刷新</Text>
            <div style={{ marginTop: 8 }}>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
              <Text type="secondary" style={{ marginLeft: 8 }}>
                启用后将自动定期刷新API状态
              </Text>
            </div>
          </div>

          <div>
            <Text strong>刷新间隔</Text>
            <div style={{ marginTop: 8 }}>
              <InputNumber
                value={refreshInterval}
                onChange={(value) => setRefreshInterval(value || 30)}
                min={10}
                max={300}
                suffix="秒"
                disabled={!autoRefresh}
                style={{ width: 200 }}
              />
              <Text type="secondary" style={{ marginLeft: 8 }}>
                自动刷新的时间间隔
              </Text>
            </div>
          </div>
        </Space>
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title={`API详情 - ${selectedStatus?.provider}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="test"
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={detailedStatus?.status === 'testing'}
            onClick={() => selectedProvider && testSingleConnection(selectedProvider)}
          >
            测试连接
          </Button>,
        ]}
        width={600}
      >
        {selectedStatus && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <APIStatusIndicator
              status={selectedStatus}
              onTest={() => selectedProvider && testSingleConnection(selectedProvider)}
            />

            <Divider />

            <div>
              <Text strong>详细信息</Text>
              <div style={{ marginTop: 8 }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>提供商:</Text>
                    <Text strong>{selectedStatus.provider}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>状态:</Text>
                    <Space>
                      {getStatusIcon(selectedStatus.status)}
                      <Text>{selectedStatus.status === 'connected' ? '已连接' :
                               selectedStatus.status === 'disconnected' ? '连接失败' : '未知'}</Text>
                    </Space>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>配置状态:</Text>
                    <Tag color={selectedStatus.configured ? 'green' : 'orange'}>
                      {selectedStatus.configured ? '已配置' : '未配置'}
                    </Tag>
                  </div>
                  {selectedStatus.responseTime && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>响应时间:</Text>
                      <Text>{selectedStatus.responseTime}ms</Text>
                    </div>
                  )}
                  {selectedStatus.lastCheck && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>最后检查:</Text>
                      <Text>{selectedStatus.lastCheck}</Text>
                    </div>
                  )}
                </Space>
              </div>
            </div>

            {selectedStatus.error && (
              <>
                <Divider />
                <div>
                  <Text strong>错误信息</Text>
                  <div style={{ marginTop: 8 }}>
                    <Alert
                      message={selectedStatus.error}
                      type="error"
                      showIcon
                    />
                  </div>
                </div>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default APIStatusDashboardPage