import { request } from '@/utils/request'

// AI模型提供商状态接口
export interface AIModelStatus {
  provider: string
  providerName: string
  models: string[]
  configured: boolean
  enabled: boolean
  apiKeyLength?: number
  lastTested?: string
  testStatus?: 'success' | 'failed' | 'pending'
  errorMessage?: string
}

// 获取AI模型状态
export async function getAIModelStatus(): Promise<AIModelStatus[]> {
  try {
    const response = await request('/api/v1/ai-models/providers', {
      method: 'GET'
    })

    // response本身就是后端返回的数据（经过axios拦截器处理）
    // 响应结构: { providers: {...}, configured_count: N, total_count: N }
    if (response && response.providers) {
      return Object.entries(response.providers).map(([provider, data]: [string, any]) => ({
        provider,
        providerName: data.name || provider,
        models: data.models || [],
        // 使用后端返回的configured字段（已经是布尔值）
        configured: Boolean(data.configured),
        // 处理enabled可能是字符串"True"的情况
        enabled: data.enabled === true || data.enabled === 'True' || data.enabled === 'true',
        apiKeyLength: data.api_key ? data.api_key.length : 0,
        testStatus: data.configured ? 'success' : 'failed',
        errorMessage: data.configured ? undefined : '未配置API密钥'
      }))
    }

    return []
  } catch (error) {
    console.error('获取AI模型状态失败:', error)
    return []
  }
}

// 测试特定AI模型
export async function testAIModel(provider: string): Promise<boolean> {
  try {
    const response = await request(`/api/v1/ai-models/test/${provider}`, {
      method: 'POST'
    })

    return response.success !== false
  } catch (error) {
    console.error(`测试${provider}模型失败:`, error)
    return false
  }
}

// 获取已配置的AI模型列表
export async function getConfiguredModels(): Promise<AIModelStatus[]> {
  const allModels = await getAIModelStatus()
  return allModels.filter(model => model.configured && model.enabled)
}

// 获取推荐的AI模型（按优先级排序）
export async function getRecommendedModel(): Promise<AIModelStatus | null> {
  const configuredModels = await getConfiguredModels()

  // 优先级（使用后端provider名称）：moonshot > zhipuai > dashscope > deepseek > yi > baidu > spark
  const priorityOrder = ['moonshot', 'zhipuai', 'dashscope', 'deepseek', 'yi', 'baidu', 'spark']

  for (const provider of priorityOrder) {
    const model = configuredModels.find(m => m.provider === provider)
    if (model) {
      return model
    }
  }

  return configuredModels[0] || null
}