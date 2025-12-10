/**
 * NAS配置服务
 */
import axios from 'axios';

const API_BASE_URL = '/api/v1/nas-config';

export interface NASConfig {
  host: string;
  port: number;
  share_name: string;
  username: string;
  password: string;
  auto_import: boolean;
  watch_interval: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

/**
 * 获取NAS配置
 */
export const getNASConfig = async (): Promise<NASConfig> => {
  const response = await axios.get(`${API_BASE_URL}/config`);
  return response.data;
};

/**
 * 更新NAS配置
 */
export const updateNASConfig = async (config: NASConfig): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post(`${API_BASE_URL}/config`, config);
  return response.data;
};

/**
 * 测试NAS连接
 */
export const testNASConnection = async (config: NASConfig): Promise<ConnectionTestResult> => {
  const response = await axios.post(`${API_BASE_URL}/test-connection`, config);
  return response.data;
};
