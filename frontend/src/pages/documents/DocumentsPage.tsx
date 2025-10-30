import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography } from 'antd'

// 子页面组件
import KnowledgeGraphPage from './KnowledgeGraphPage'
import DocumentUploadPage from './DocumentUploadPage'
import DocumentListPage from './DocumentListPage'
import DocumentProcessPage from './DocumentProcessPage'

const { Title } = Typography

const DocumentsPage: React.FC = () => {
  return (
    <div>
      <Routes>
        <Route index element={
          <div>
            <Title level={2}>文档管理</Title>
            <p>文档管理功能正在开发中...</p>
          </div>
        } />
        <Route path="upload" element={<DocumentUploadPage />} />
        <Route path="list" element={<DocumentListPage />} />
        <Route path="process" element={<DocumentProcessPage />} />
        <Route path="knowledge-graph" element={<KnowledgeGraphPage />} />
        <Route path="*" element={<Navigate to="/documents" replace />} />
      </Routes>
    </div>
  )
}

export default DocumentsPage