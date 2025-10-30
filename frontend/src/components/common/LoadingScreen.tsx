import React from 'react'
import { Spin } from 'antd'
import './LoadingScreen.css'

const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="64" height="64" rx="16" fill="#2563eb" />
            <path
              d="M32 16C23.1634 16 16 23.1634 16 32C16 40.8366 23.1634 48 32 48C40.8366 48 48 40.8366 48 32C48 23.1634 40.8366 16 32 16Z"
              fill="white"
            />
            <path
              d="M24 24H40V40H24V24Z"
              fill="#2563eb"
            />
          </svg>
        </div>
        <Spin size="large" />
        <div className="loading-text">
          <h2>Cost-RAG</h2>
          <p>工程造价咨询智能RAG系统</p>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen