import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// 子页面组件
import SmartEstimatePage from './SmartEstimatePage'
import HistoricalDataPage from './HistoricalDataPage'
import ProjectComparisonPage from './ProjectComparisonPage'

// 引入样式
import './Estimates.css'

const EstimatesPage: React.FC = () => {
  return (
    <div className="estimates-container">
      <Routes>
        {/* 默认重定向到智能估算 */}
        <Route index element={<Navigate to="/estimates/smart-estimate" replace />} />

        {/* 智能估算 - 核心功能，优先展示 */}
        <Route path="smart-estimate" element={<SmartEstimatePage />} />

        {/* 历史数据管理 - 模板数据管理 */}
        <Route path="historical-data/*" element={<HistoricalDataPage />} />

        {/* 项目对比 - 分析工具 */}
        <Route path="comparisons" element={<ProjectComparisonPage />} />

        {/* 未匹配路由重定向到智能估算 */}
        <Route path="*" element={<Navigate to="/estimates/smart-estimate" replace />} />
      </Routes>
    </div>
  )
}

export default EstimatesPage
