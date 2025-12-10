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
        <Route index element={<ChatPage />} />
        <Route path="chat" element={<Navigate to="/queries" replace />} />
        <Route path="history" element={<QueryHistoryPage />} />
        <Route path="*" element={<Navigate to="/queries" replace />} />
      </Routes>
    </div>
  )
}

export default QueriesPage