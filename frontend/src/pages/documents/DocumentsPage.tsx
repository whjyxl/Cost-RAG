import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography } from 'antd'

// 子页面组件
import KnowledgeGraphPage from './KnowledgeGraphPage'
import DocumentUploadPage from './DocumentUploadPage'
import DocumentListPage from './DocumentListPage'
import DocumentProcessPage from './DocumentProcessPage'
import NASImportPage from './NASImportPage'

// 引入样式
import './Documents.css'

const { Title } = Typography

const DocumentsPage: React.FC = () => {
  return (
    <div className="documents-container">
      <Routes>
        <Route index element={
          <div>
            <Title level={2} className="documents-title">文档管理</Title>
            <p style={{ color: '#666' }}>选择左侧菜单开始管理文档</p>
          </div>
        } />
        <Route path="upload" element={<DocumentUploadPage />} />
        <Route path="list" element={<DocumentListPage />} />
        <Route path="process" element={<DocumentProcessPage />} />
        <Route path="knowledge-graph" element={<KnowledgeGraphPage />} />
        <Route path="nas-import" element={<NASImportPage />} />
        <Route path="*" element={<Navigate to="/documents" replace />} />
      </Routes>
    </div>
  )
}

export default DocumentsPage