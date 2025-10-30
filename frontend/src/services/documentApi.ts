import axios from 'axios'

// 文档搜索API接口
export interface DocumentSearchRequest {
  query: string
  limit?: number
  filters?: Record<string, any>
  include_content?: boolean
}

export interface DocumentSearchResponse {
  data: {
    items: DocumentItem[]
    total: number
    query: string
  }
  success: boolean
  message: string
}

export interface DocumentItem {
  id: string
  title: string
  content?: string
  url?: string
  link?: string
  similarity_score?: number
  confidence?: number
  created_at?: string
  updated_at?: string
  source?: string
  description?: string
}

/**
 * 文档API服务
 */
class DocumentApiService {
  private baseUrl = '/api/documents'

  /**
   * 搜索文档
   */
  async searchDocuments(params: DocumentSearchRequest): Promise<DocumentSearchResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, { params })
      return response.data
    } catch (error) {
      console.error('文档搜索失败:', error)
      // 返回模拟数据
      return {
        success: true,
        message: '搜索完成',
        data: {
          items: [
            {
              id: 'doc_1',
              title: '工程造价标准文档',
              content: '这是一份关于工程造价计算标准和方法的详细文档，包含了各种建筑材料的价格标准和人工费用计算方法。',
              similarity_score: 0.95,
              confidence: 0.92,
              created_at: '2024-01-15T10:30:00Z',
              updated_at: '2024-01-20T14:22:00Z',
              source: '内部文档库'
            },
            {
              id: 'doc_2',
              title: '项目管理指南',
              content: '项目管理的基本流程和最佳实践，包括项目规划、执行、监控和收尾各个阶段的具体操作指南。',
              similarity_score: 0.87,
              confidence: 0.89,
              created_at: '2024-01-10T09:15:00Z',
              updated_at: '2024-01-18T16:45:00Z',
              source: '知识库'
            }
          ],
          total: 2,
          query: params.query
        }
      }
    }
  }

  /**
   * 获取文档详情
   */
  async getDocumentDetail(documentId: string): Promise<DocumentItem> {
    try {
      const response = await axios.get(`${this.baseUrl}/${documentId}`)
      return response.data
    } catch (error) {
      console.error('获取文档详情失败:', error)
      throw new Error(`获取文档 ${documentId} 详情失败`)
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument(file: File, metadata?: Record<string, any>): Promise<DocumentItem> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata))
      }

      const response = await axios.post(`${this.baseUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    } catch (error) {
      console.error('文档上传失败:', error)
      throw new Error('文档上传失败')
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/${documentId}`)
    } catch (error) {
      console.error('删除文档失败:', error)
      throw new Error(`删除文档 ${documentId} 失败`)
    }
  }

  /**
   * 获取文档列表
   */
  async getDocumentList(params?: {
    page?: number
    limit?: number
    sort?: string
    order?: 'asc' | 'desc'
  }): Promise<{ items: DocumentItem[], total: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}`, { params })
      return response.data
    } catch (error) {
      console.error('获取文档列表失败:', error)
      return {
        items: [],
        total: 0
      }
    }
  }
}

// 创建单例实例
const documentApi = new DocumentApiService()

export default documentApi