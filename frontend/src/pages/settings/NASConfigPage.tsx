/**
 * NAS配置页面
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  InputNumber,
  message,
  Space,
  Divider,
  Alert,
  Spin,
  Tag,
  Descriptions,
} from 'antd';
import {
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { nasConfigAPI } from '@/services/nasConfig';

interface NASConfig {
  host: string;
  port: number;
  share_name: string;
  username: string;
  password: string;
  mount_point_win: string;
  mount_point_linux: string;
  auto_import: boolean;
  watch_interval: number;
}

const NASConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [config, setConfig] = useState<NASConfig | null>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await nasConfigAPI.getConfig();
      setConfig(data);
      form.setFieldsValue(data);
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    setTesting(true);
    try {
      const values = form.getFieldsValue();
      const result = await nasConfigAPI.testConnection(values);
      setConnectionStatus(result);
      if (result.connected) {
        message.success('连接成功！');
      } else {
        message.error('连接失败：' + result.message);
      }
    } catch (error: any) {
      setConnectionStatus({
        connected: false,
        message: error.message || '连接测试失败',
      });
      message.error('连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await nasConfigAPI.updateConfig(values);
      message.success('配置保存成功！');
      loadConfig();
    } catch (error) {
      message.error('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置配置
  const handleReset = () => {
    form.resetFields();
    if (config) {
      form.setFieldsValue(config);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <CloudServerOutlined />
            <span>NAS配置管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              保存配置
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {/* 连接状态提示 */}
          {connectionStatus && (
            <Alert
              message={
                connectionStatus.connected ? '连接成功' : '连接失败'
              }
              description={connectionStatus.message}
              type={connectionStatus.connected ? 'success' : 'error'}
              icon={
                connectionStatus.connected ? (
                  <CheckCircleOutlined />
                ) : (
                  <CloseCircleOutlined />
                )
              }
              showIcon
              closable
              style={{ marginBottom: 24 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              port: 445,
              mount_point_win: 'Z:',
              mount_point_linux: '/mnt/nas_knowledge',
              auto_import: true,
              watch_interval: 60,
            }}
          >
            {/* 基本连接配置 */}
            <Divider orientation="left">基本连接配置</Divider>

            <Form.Item
              label="NAS主机地址"
              name="host"
              rules={[
                { required: true, message: '请输入NAS主机地址' },
                {
                  pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
                  message: '请输入有效的IP地址',
                },
              ]}
              extra="例如：192.168.1.100"
            >
              <Input
                placeholder="192.168.1.100"
                prefix={<CloudServerOutlined />}
              />
            </Form.Item>

            <Form.Item
              label="SMB端口"
              name="port"
              rules={[{ required: true, message: '请输入端口号' }]}
              extra="默认445端口"
            >
              <InputNumber
                min={1}
                max={65535}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              label="共享文件夹名称"
              name="share_name"
              rules={[{ required: true, message: '请输入共享文件夹名称' }]}
              extra="NAS上创建的共享文件夹名称"
            >
              <Input placeholder="knowledge_data" />
            </Form.Item>

            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="admin" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            {/* 挂载点配置 */}
            <Divider orientation="left">挂载点配置</Divider>

            <Form.Item
              label="Windows挂载点"
              name="mount_point_win"
              extra="Windows系统映射的网络驱动器盘符"
            >
              <Input placeholder="Z:" />
            </Form.Item>

            <Form.Item
              label="Linux挂载点"
              name="mount_point_linux"
              extra="Linux系统挂载的目录路径"
            >
              <Input placeholder="/mnt/nas_knowledge" />
            </Form.Item>

            {/* 自动导入配置 */}
            <Divider orientation="left">自动导入配置</Divider>

            <Form.Item
              label="启用自动导入"
              name="auto_import"
              valuePropName="checked"
              extra="开启后系统会自动监控NAS目录并导入新文件"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="监控间隔（秒）"
              name="watch_interval"
              extra="系统扫描NAS目录的时间间隔"
            >
              <InputNumber
                min={10}
                max={3600}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {/* 操作按钮 */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={testConnection}
                  loading={testing}
                >
                  测试连接
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>

          {/* 配置说明 */}
          <Divider orientation="left">配置说明</Divider>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="支持的NAS品牌">
              群晖(Synology)、威联通(QNAP)、铁威马等支持SMB协议的NAS
            </Descriptions.Item>
            <Descriptions.Item label="目录结构">
              knowledge_data/[专业]/[数据类型]/文件
            </Descriptions.Item>
            <Descriptions.Item label="支持的文件格式">
              <Space>
                <Tag color="blue">JSON</Tag>
                <Tag color="green">Excel</Tag>
                <Tag color="orange">CSV</Tag>
                <Tag color="purple">Markdown</Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="专业类型">
              door_window(门窗)、plumbing(水电)、hvac(暖通)、decoration(装饰)
            </Descriptions.Item>
            <Descriptions.Item label="数据类型">
              standards(规范)、processes(工艺)、materials(材料)、costs(成本)、optimizations(优化)
            </Descriptions.Item>
          </Descriptions>
        </Spin>
      </Card>
    </div>
  );
};

export default NASConfigPage;
