import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography } from 'antd'

// 子页面组件
import CreateEstimatePage from './CreateEstimatePage'
import EstimateListPage from './EstimateListPage'
import EstimateTemplatesPage from './EstimateTemplatesPage'
import ProjectComparisonPage from './ProjectComparisonPage'
import HistoricalDataPage from './HistoricalDataPage'
import SmartEstimatePage from './SmartEstimatePage'

const { Title } = Typography

const EstimatesPage: React.FC = () => {
  return (
    <div>
      <Routes>
        <Route index element={
          <div>
            <Title level={2}>成本估算</Title>
            <p>成本估算功能正在开发中...</p>
          </div>
        } />
        <Route path="create" element={<CreateEstimatePage />} />
        <Route path="list" element={<EstimateListPage />} />
        <Route path="templates" element={<EstimateTemplatesPage />} />
        <Route path="comparisons" element={<ProjectComparisonPage />} />
        <Route path="historical-data/*" element={<HistoricalDataPage />} />
        <Route path="smart-estimate" element={<SmartEstimatePage />} />
        <Route path="*" element={<Navigate to="/estimates" replace />} />
      </Routes>
    </div>
  )
}

export default EstimatesPage