import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography } from 'antd'

// 子页面组件
import ChatPage from './ChatPage'
import QueryHistoryPage from './QueryHistoryPage'

const { Title } = Typography

const QueriesPage: React.FC = () => {
  return (
    <div>
      <Routes>
        <Route index element={
          <div>
            <Title level={2}>智能问答</Title>
            <p>智能问答功能正在开发中...</p>
          </div>
        } />
        <Route path="chat" element={<ChatPage />} />
        <Route path="history" element={<QueryHistoryPage />} />
        <Route path="*" element={<Navigate to="/queries" replace />} />
      </Routes>
    </div>
  )
}

export default QueriesPage