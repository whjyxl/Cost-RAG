/**
 * NAS数据导入页面
 */
import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Alert,
  Empty,
  Descriptions,
} from 'antd';
import {
  CloudUploadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FolderOutlined,
} from '@ant-design/icons';

const NASImportPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [importLogs] = useState<any[]>([]);

  // 开始导入
  const handleStartImport = async () => {
    setLoading(true);
    try {
      // TODO: 调用后端API开始导入
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('导入失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新状态
  const handleRefresh = () => {
    // TODO: 刷新导入状态
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text: string) => (
        <Space>
          <FolderOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '专业',
      dataIndex: 'profession',
      key: 'profession',
      render: (text: string) => {
        const professionMap: Record<string, string> = {
          door_window: '门窗工程',
          curtain_wall: '幕墙工程',
          steel_structure: '钢结构',
        };
        return professionMap[text] || text;
      },
    },
    {
      title: '数据类型',
      dataIndex: 'data_type',
      key: 'data_type',
      render: (text: string) => {
        const typeMap: Record<string, string> = {
          materials: '材料',
          processes: '工艺',
          standards: '规范',
        };
        return typeMap[text] || text;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; icon: any; text: string }> = {
          success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          processing: { color: 'processing', icon: <SyncOutlined spin />, text: '处理中' },
        };
        const config = statusConfig[status] || statusConfig.processing;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '节点数',
      dataIndex: 'nodes_count',
      key: 'nodes_count',
    },
    {
      title: '关系数',
      dataIndex: 'relations_count',
      key: 'relations_count',
    },
    {
      title: '导入时间',
      dataIndex: 'imported_at',
      key: 'imported_at',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <CloudUploadOutlined />
            <span>NAS数据导入</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={handleStartImport}
              loading={loading}
            >
              开始导入
            </Button>
          </Space>
        }
      >
        <Alert
          message="功能开发中"
          description="NAS数据导入功能正在开发中。配置NAS连接后，系统将自动从指定目录导入知识图谱数据。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Descriptions title="NAS连接状态" bordered column={2} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="连接状态">
            <Tag color="default">未配置</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="NAS地址">-</Descriptions.Item>
          <Descriptions.Item label="共享目录">-</Descriptions.Item>
          <Descriptions.Item label="自动导入">
            <Tag color="default">未启用</Tag>
          </Descriptions.Item>
        </Descriptions>

        {importLogs.length > 0 ? (
          <Table
            columns={columns}
            dataSource={importLogs}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        ) : (
          <Empty
            description="暂无导入记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </div>
  );
};

export default NASImportPage;
