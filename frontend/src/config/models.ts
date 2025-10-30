import {
  LLMProvider,
  LLMModel,
  ModelCapabilities,
  ModelPricing,
  EmbeddingProvider,
  EmbeddingModel,
  EmbeddingCapabilities,
  EmbeddingPricing,
  EmbeddingProviderType
} from '../types'

// ====== 国产LLM模型配置 ======

// 智谱AI GLM模型配置
export const GLM_PROVIDER: LLMProvider = {
  id: 'glm',
  name: '智谱AI',
  type: 'glm',
  displayName: '智谱AI',
  logo: '/logos/glm.png',
  description: '智谱AI是一家中国领先的人工智能公司，专注于大语言模型研发',
  website: 'https://zhipuai.cn',
  docsUrl: 'https://open.bigmodel.cn/dev/api#glm4',
  apiKeyRequired: true,
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'glm-4',
      name: 'GLM-4',
      displayName: 'GLM-4',
      provider: 'glm',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.1,
        output: 0.1,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: '智谱AI最新旗舰模型，支持长上下文理解和生成',
      tags: ['旗舰', '长上下文', '多轮对话'],
      status: 'active',
      releaseDate: '2024-01-17'
    },
    {
      id: 'glm-3-turbo',
      name: 'GLM-3-turbo',
      displayName: 'GLM-3-turbo',
      provider: 'glm',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.005,
        output: 0.005,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: '智谱AI高性价比模型，适合日常对话和文本处理',
      tags: ['高性价比', '轻量级', '多轮对话'],
      status: 'active',
      releaseDate: '2023-10-27'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 月之暗面 Kimi模型配置
export const KIMI_PROVIDER: LLMProvider = {
  id: 'kimi',
  name: '月之暗面',
  type: 'kimi',
  displayName: 'Kimi',
  logo: '/logos/kimi.png',
  description: '月之暗面专注于长上下文大语言模型，支持超长文本理解',
  website: 'https://www.moonshot.cn',
  docsUrl: 'https://platform.moonshot.cn/docs',
  apiKeyRequired: true,
  baseUrl: 'https://api.moonshot.cn/v1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'moonshot-v1-8k',
      name: 'Kimi 8K',
      displayName: 'Kimi 8K',
      provider: 'kimi',
      contextLength: 8000,
      maxTokens: 4096,
      pricing: {
        input: 0.012,
        output: 0.034,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: false,
        multimodal: false,
        function_calling: false
      },
      description: '支持8K上下文的对话模型，适合日常对话',
      tags: ['标准版', '日常对话'],
      status: 'active',
      releaseDate: '2023-10-10'
    },
    {
      id: 'moonshot-v1-32k',
      name: 'Kimi 32K',
      displayName: 'Kimi 32K',
      provider: 'kimi',
      contextLength: 32000,
      maxTokens: 4096,
      pricing: {
        input: 0.06,
        output: 0.18,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: '支持32K超长上下文，适合文档分析和长文本处理',
      tags: ['长上下文', '文档分析', '研究报告'],
      status: 'active',
      releaseDate: '2023-10-10'
    },
    {
      id: 'moonshot-v1-128k',
      name: 'Kimi 128K',
      displayName: 'Kimi 128K',
      provider: 'kimi',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.25,
        output: 0.75,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: '支持128K超长上下文，专业级长文本处理能力',
      tags: ['超长上下文', '专业版', '复杂文档'],
      status: 'active',
      releaseDate: '2024-03-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 阿里千问 Qwen模型配置
export const QWEN_PROVIDER: LLMProvider = {
  id: 'qwen',
  name: '阿里云',
  type: 'qwen',
  displayName: '通义千问',
  logo: '/logos/qwen.png',
  description: '阿里云通义千问系列大语言模型，覆盖多种应用场景',
  website: 'https://qwen.aliyun.com',
  docsUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/quick-start',
  apiKeyRequired: true,
  baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'qwen-plus',
      name: 'Qwen Plus',
      displayName: '通义千问-Plus',
      provider: 'qwen',
      contextLength: 32768,
      maxTokens: 6000,
      pricing: {
        input: 0.004,
        output: 0.012,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: '通义千问增强版，支持更长的上下文和更强的推理能力',
      tags: ['增强版', '长上下文', '多场景'],
      status: 'active',
      releaseDate: '2023-08-03'
    },
    {
      id: 'qwen-turbo',
      name: 'Qwen Turbo',
      displayName: '通义千问-Turbo',
      provider: 'qwen',
      contextLength: 8192,
      maxTokens: 1500,
      pricing: {
        input: 0.002,
        output: 0.006,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: false,
        code: false,
        analysis: true,
        translation: true,
        long_context: false,
        multimodal: false,
        function_calling: false
      },
      description: '通义千问高速版，适合快速响应的对话场景',
      tags: ['高速版', '轻量级', '快速响应'],
      status: 'active',
      releaseDate: '2023-08-03'
    },
    {
      id: 'qwen-max',
      name: 'Qwen Max',
      displayName: '通义千问-Max',
      provider: 'qwen',
      contextLength: 6000,
      maxTokens: 2000,
      pricing: {
        input: 0.02,
        output: 0.06,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: false,
        multimodal: false,
        function_calling: true
      },
      description: '通义千问旗舰版，最强大的理解和生成能力',
      tags: ['旗舰版', '最强性能', '专业场景'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN', 'Global'],
  status: 'active'
}

// 百度文心一言模型配置
export const WENXIN_PROVIDER: LLMProvider = {
  id: 'wenxin',
  name: '百度',
  type: 'wenxin',
  displayName: '文心一言',
  logo: '/logos/wenxin.png',
  description: '百度文心一言系列大语言模型，基于文心大模型技术',
  website: 'https://yiyan.baidu.com',
  docsUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP/getting-started',
  apiKeyRequired: true,
  baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'ernie-bot',
      name: 'ERNIE-Bot',
      displayName: '文心一言-3.5',
      provider: 'wenxin',
      contextLength: 128000,
      maxTokens: 2048,
      pricing: {
        input: 0.008,
        output: 0.024,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: '文心一言3.5版本，增强的对话和理解能力',
      tags: ['3.5版本', '增强理解', '多轮对话'],
      status: 'active',
      releaseDate: '2023-08-16'
    },
    {
      id: 'ernie-bot-turbo',
      name: 'ERNIE-Bot-turbo',
      displayName: '文心一言-Turbo',
      provider: 'wenxin',
      contextLength: 128000,
      maxTokens: 2048,
      pricing: {
        input: 0.004,
        output: 0.012,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: false,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: '文心一言高速版，适合快速响应场景',
      tags: ['高速版', '轻量级', '快速响应'],
      status: 'active',
      releaseDate: '2023-08-16'
    },
    {
      id: 'ernie-bot-4',
      name: 'ERNIE-Bot-4',
      displayName: '文心一言-4.0',
      provider: 'wenxin',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.12,
        output: 0.36,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: '文心一言4.0版本，最强大的理解和生成能力',
      tags: ['4.0版本', '旗舰版', '多模态'],
      status: 'beta',
      releaseDate: '2024-05-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 深度求索 DeepSeek模型配置
export const DEEPSEEK_PROVIDER: LLMProvider = {
  id: 'deepseek',
  name: '深度求索',
  type: 'deepseek',
  displayName: 'DeepSeek',
  logo: '/logos/deepseek.png',
  description: '深度求索专注于高性能推理和代码生成的大语言模型',
  website: 'https://www.deepseek.com',
  docsUrl: 'https://platform.deepseek.com/api-docs/',
  apiKeyRequired: true,
  baseUrl: 'https://api.deepseek.com/v1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'deepseek-chat',
      name: 'deepseek-chat',
      displayName: 'DeepSeek Chat',
      provider: 'deepseek',
      contextLength: 32768,
      maxTokens: 4096,
      pricing: {
        input: 0.001,
        output: 0.002,
        currency: 'USD',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: 'DeepSeek对话模型，支持长上下文理解和生成',
      tags: ['对话模型', '长上下文', '性价比'],
      status: 'active',
      releaseDate: '2024-01-05'
    },
    {
      id: 'deepseek-coder',
      name: 'deepseek-coder',
      displayName: 'DeepSeek Coder',
      provider: 'deepseek',
      contextLength: 16384,
      maxTokens: 4096,
      pricing: {
        input: 0.001,
        output: 0.002,
        currency: 'USD',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: true,
        analysis: true,
        translation: false,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: 'DeepSeek代码生成模型，专业的代码理解和生成能力',
      tags: ['代码生成', '编程助手', '开发工具'],
      status: 'active',
      releaseDate: '2024-01-05'
    }
  ],
  supportedRegions: ['CN', 'Global'],
  status: 'active'
}

// 零一万物 Yi模型配置
export const YI_PROVIDER: LLMProvider = {
  id: 'yi',
  name: '零一万物',
  type: 'yi',
  displayName: 'Yi系列',
  logo: '/logos/yi.png',
  description: '零一万物Yi系列大语言模型，专注于高质量对话生成',
  website: 'https://01.ai',
  docsUrl: 'https://platform.lingyiwanwu.com/docs',
  apiKeyRequired: true,
  baseUrl: 'https://api.lingyiwanwu.com/v1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'yi-34b-chat',
      name: 'Yi-34B-Chat',
      displayName: 'Yi-34B-Chat',
      provider: 'yi',
      contextLength: 200000,
      maxTokens: 4096,
      pricing: {
        input: 0.003,
        output: 0.006,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: 'Yi-34B对话模型，支持超长上下文理解',
      tags: ['34B参数', '长上下文', '大模型'],
      status: 'active',
      releaseDate: '2023-11-20'
    },
    {
      id: 'yi-6b-chat',
      name: 'Yi-6B-Chat',
      displayName: 'Yi-6B-Chat',
      provider: 'yi',
      contextLength: 128000,
      maxTokens: 4096,
      pricing: {
        input: 0.0005,
        output: 0.001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: false
      },
      description: 'Yi-6B轻量级对话模型，适合日常使用',
      tags: ['6B参数', '轻量级', '高性价比'],
      status: 'active',
      releaseDate: '2023-11-20'
    }
  ],
  supportedRegions: ['CN', 'Global'],
  status: 'active'
}

// 科大讯飞星火模型配置
export const SPARK_PROVIDER: LLMProvider = {
  id: 'spark',
  name: '科大讯飞',
  type: 'spark',
  displayName: '星火',
  logo: '/logos/spark.png',
  description: '科大讯飞星火认知大模型，中文理解和生成能力强',
  website: 'https://xinghuo.xfyun.cn',
  docsUrl: 'https://www.xfyun.cn/doc/spark/quickstart.html',
  apiKeyRequired: true,
  baseUrl: 'https://spark-api.xf-yun.com/v3.1',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'spark-3.5',
      name: 'Spark-3.5',
      displayName: '星火认知大模型3.5',
      provider: 'spark',
      contextLength: 28000,
      maxTokens: 4096,
      pricing: {
        input: 0.018,
        output: 0.018,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: '星火认知大模型3.5版本，增强的中文理解和生成能力',
      tags: ['3.5版本', '中文强化', '认知能力'],
      status: 'active',
      releaseDate: '2024-01-30'
    },
    {
      id: 'spark-pro',
      name: 'Spark-Pro',
      displayName: '星火认知大模型Pro',
      provider: 'spark',
      contextLength: 16000,
      maxTokens: 4096,
      pricing: {
        input: 0.015,
        output: 0.015,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        chat: true,
        reasoning: true,
        code: false,
        analysis: true,
        translation: true,
        long_context: true,
        multimodal: false,
        function_calling: true
      },
      description: '星火认知大模型专业版，适合企业级应用',
      tags: ['专业版', '企业级', '多场景'],
      status: 'active',
      releaseDate: '2023-09-05'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 所有提供商配置数组
export const CHINESE_LLM_PROVIDERS: LLMProvider[] = [
  GLM_PROVIDER,
  KIMI_PROVIDER,
  QWEN_PROVIDER,
  WENXIN_PROVIDER,
  DEEPSEEK_PROVIDER,
  YI_PROVIDER,
  SPARK_PROVIDER
]

// 所有模型配置数组（平铺所有模型）
export const ALL_CHINESE_MODELS: LLMModel[] = [
  ...GLM_PROVIDER.models.map(model => ({ ...model, provider: 'glm' as const })),
  ...KIMI_PROVIDER.models.map(model => ({ ...model, provider: 'kimi' as const })),
  ...QWEN_PROVIDER.models.map(model => ({ ...model, provider: 'qwen' as const })),
  ...WENXIN_PROVIDER.models.map(model => ({ ...model, provider: 'wenxin' as const })),
  ...DEEPSEEK_PROVIDER.models.map(model => ({ ...model, provider: 'deepseek' as const })),
  ...YI_PROVIDER.models.map(model => ({ ...model, provider: 'yi' as const })),
  ...SPARK_PROVIDER.models.map(model => ({ ...model, provider: 'spark' as const }))
]

// 默认配置
export const DEFAULT_CHINESE_CONFIG = {
  provider: 'glm' as LLMProviderType,
  model: 'glm-3-turbo',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000,
  retryCount: 3,
  enableCache: true
}

// 模型能力映射
export const MODEL_CAPABILITY_TAGS = {
  chat: { label: '对话', color: 'blue' },
  reasoning: { label: '推理', color: 'purple' },
  code: { label: '代码', color: 'green' },
  analysis: { label: '分析', color: 'orange' },
  translation: { label: '翻译', color: 'cyan' },
  long_context: { label: '长上下文', color: 'red' },
  multimodal: { label: '多模态', color: 'magenta' },
  function_calling: { label: '函数调用', color: 'teal' }
}

// 提供商信息映射
export const PROVIDER_INFO = {
  glm: {
    name: '智谱AI',
    website: 'https://zhipuai.cn',
    supportEmail: 'support@zhipuai.ai',
    status: 'active'
  },
  kimi: {
    name: '月之暗面',
    website: 'https://www.moonshot.cn',
    supportEmail: 'support@moonshot.cn',
    status: 'active'
  },
  qwen: {
    name: '阿里云通义千问',
    website: 'https://qwen.aliyun.com',
    supportEmail: 'qwen@service.aliyun.com',
    status: 'active'
  },
  wenxin: {
    name: '百度文心一言',
    website: 'https://yiyan.baidu.com',
    supportEmail: 'wenxin@baidu.com',
    status: 'active'
  },
  deepseek: {
    name: '深度求索',
    website: 'https://www.deepseek.com',
    supportEmail: 'support@deepseek.com',
    status: 'active'
  },
  yi: {
    name: '零一万物',
    website: 'https://01.ai',
    supportEmail: 'support@01.ai',
    status: 'active'
  },
  spark: {
    name: '科大讯飞星火',
    website: 'https://xinghuo.xfyun.cn',
    supportEmail: 'spark@iflytek.com',
    status: 'active'
  }
}

// ====== Embedding模型配置 ======

// 智谱AI Embedding模型配置
export const GLM_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'glm',
  name: '智谱AI',
  type: 'glm',
  displayName: '智谱AI Embedding',
  logo: '/logos/glm.png',
  description: '智谱AI的文本嵌入模型，支持中英文文本向量化',
  website: 'https://zhipuai.cn',
  docsUrl: 'https://open.bigmodel.cn/dev/api#embedding',
  apiKeyRequired: true,
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'embedding-2',
      name: 'BGE-Large-zh',
      displayName: 'BGE-Large-zh',
      provider: 'glm',
      dimensions: 1024,
      maxTokens: 8192,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: true,
        long_text: false,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '中文文本嵌入模型，适合语义搜索和文本分类',
      tags: ['中文', '语义搜索', '文本分类'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 月之暗面 Embedding模型配置
export const KIMI_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'kimi',
  name: '月之暗面',
  type: 'kimi',
  displayName: 'Kimi Embedding',
  logo: '/logos/kimi.png',
  description: '月之暗面的文本嵌入模型，支持长文本处理',
  website: 'https://www.moonshot.cn',
  docsUrl: 'https://platform.moonshot.cn/docs/embedding',
  apiKeyRequired: true,
  baseUrl: 'https://api.moonshot.cn/v1/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'text-embedding-ada-002',
      name: 'Kimi Embedding',
      displayName: 'Kimi Embedding',
      provider: 'kimi',
      dimensions: 1536,
      maxTokens: 8191,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: true,
        long_text: true,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '支持长文本的嵌入模型，适合文档处理和语义搜索',
      tags: ['长文本', '语义搜索', '多语言'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 阿里云千问 Embedding模型配置
export const QWEN_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'qwen',
  name: '阿里云千问',
  type: 'qwen',
  displayName: '千问 Embedding',
  logo: '/logos/qwen.png',
  description: '阿里云千问的文本嵌入模型，提供高性能向量服务',
  website: 'https://qwen.aliyun.com',
  docsUrl: 'https://help.aliyun.com/zh/model-developer/user-guide/text-embedding',
  apiKeyRequired: true,
  baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {apiKey}'
  },
  models: [
    {
      id: 'text-embedding-v1',
      name: 'text-embedding-v1',
      displayName: '千问文本嵌入v1',
      provider: 'qwen',
      dimensions: 1536,
      maxTokens: 2048,
      pricing: {
        input: 0.0007,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: true,
        long_text: false,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '千问文本嵌入模型，适合语义搜索和分类任务',
      tags: ['语义搜索', '文本分类', '高精度'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 百度文心一言 Embedding模型配置
export const WENXIN_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'wenxin',
  name: '百度文心一言',
  type: 'wenxin',
  displayName: '文心 Embedding',
  logo: '/logos/wenxin.png',
  description: '百度文心一言的文本嵌入模型，提供专业的中文向量化服务',
  website: 'https://yiyan.baidu.com',
  docsUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP/s/jlil56u11',
  apiKeyRequired: true,
  baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'bge-large-zh',
      name: 'bge-large-zh',
      displayName: 'BGE-Large-zh',
      provider: 'wenxin',
      dimensions: 1024,
      maxTokens: 512,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: false,
        long_text: false,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '百度优化的中文嵌入模型，适合中文语义理解',
      tags: ['中文', '语义理解', '高精度'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 深度求索 Embedding模型配置
export const DEEPSEEK_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'deepseek',
  name: '深度求索',
  type: 'deepseek',
  displayName: 'DeepSeek Embedding',
  logo: '/logos/deepseek.png',
  description: '深度求索的文本嵌入模型，提供高质量的向量服务',
  website: 'https://www.deepseek.com',
  docsUrl: 'https://platform.deepseek.com/api-docs/embeddings',
  apiKeyRequired: true,
  baseUrl: 'https://api.deepseek.com/v1/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'deepseek-chat',
      name: 'deepseek-chat',
      displayName: 'DeepSeek Embedding',
      provider: 'deepseek',
      dimensions: 1536,
      maxTokens: 8192,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: true,
        long_text: true,
        code_embedding: true,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '深度求索文本嵌入模型，支持代码和多语言处理',
      tags: ['代码', '多语言', '长文本'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 零一万物 Embedding模型配置
export const YI_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'yi',
  name: '零一万物',
  type: 'yi',
  displayName: 'Yi Embedding',
  logo: '/logos/yi.png',
  description: '零一万物的文本嵌入模型，提供高效的向量化服务',
  website: 'https://01.ai',
  docsUrl: 'https://platform.01.ai/docs/embeddings',
  apiKeyRequired: true,
  baseUrl: 'https://api.lingyiwanwu.com/v1/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'yi-large',
      name: 'yi-large',
      displayName: 'Yi Large Embedding',
      provider: 'yi',
      dimensions: 2048,
      maxTokens: 8192,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: true,
        long_text: true,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '零一万物大型嵌入模型，适合高精度语义搜索',
      tags: ['高精度', '长文本', '多语言'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 科大讯飞星火 Embedding模型配置
export const SPARK_EMBEDDING_PROVIDER: EmbeddingProvider = {
  id: 'spark',
  name: '科大讯飞星火',
  type: 'spark',
  displayName: '星火 Embedding',
  logo: '/logos/spark.png',
  description: '科大讯飞星火的文本嵌入模型，专业的中文向量化服务',
  website: 'https://xinghuo.xfyun.cn',
  docsUrl: 'https://www.xfyun.cn/doc/spark/Embedding.html',
  apiKeyRequired: true,
  baseUrl: 'https://spark-api-open.xf-yun.com/v1/embeddings',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  models: [
    {
      id: 'spark-embedding',
      name: 'spark-embedding',
      displayName: '星火文本嵌入',
      provider: 'spark',
      dimensions: 1024,
      maxTokens: 8192,
      pricing: {
        input: 0.0001,
        currency: 'CNY',
        unit: 'tokens'
      },
      capabilities: {
        multilingual: false,
        long_text: true,
        code_embedding: false,
        semantic_search: true,
        classification: true,
        clustering: true,
        reranking: false
      },
      description: '科大讯飞星火文本嵌入模型，专业中文语义理解',
      tags: ['中文', '长文本', '语义理解'],
      status: 'active',
      releaseDate: '2024-01-01'
    }
  ],
  supportedRegions: ['CN'],
  status: 'active'
}

// 国产Embedding模型提供商数组
export const CHINESE_EMBEDDING_PROVIDERS: EmbeddingProvider[] = [
  GLM_EMBEDDING_PROVIDER,
  KIMI_EMBEDDING_PROVIDER,
  QWEN_EMBEDDING_PROVIDER,
  WENXIN_EMBEDDING_PROVIDER,
  DEEPSEEK_EMBEDDING_PROVIDER,
  YI_EMBEDDING_PROVIDER,
  SPARK_EMBEDDING_PROVIDER
]

// 所有国产Embedding模型
export const ALL_CHINESE_EMBEDDING_MODELS: EmbeddingModel[] = CHINESE_EMBEDDING_PROVIDERS.flatMap(provider => provider.models)

// 默认Embedding配置
export const DEFAULT_EMBEDDING_CONFIG = {
  provider: 'glm' as EmbeddingProviderType,
  model: 'embedding-2',
  maxTokens: 8192,
  timeout: 30000,
  retryCount: 3,
  enableCache: true,
  batchSize: 100
}

export default {
  providers: CHINESE_LLM_PROVIDERS,
  models: ALL_CHINESE_MODELS,
  defaultConfig: DEFAULT_CHINESE_CONFIG,
  capabilityTags: MODEL_CAPABILITY_TAGS,
  providerInfo: PROVIDER_INFO,
  // Embedding相关
  embeddingProviders: CHINESE_EMBEDDING_PROVIDERS,
  embeddingModels: ALL_CHINESE_EMBEDDING_MODELS,
  defaultEmbeddingConfig: DEFAULT_EMBEDDING_CONFIG
}

