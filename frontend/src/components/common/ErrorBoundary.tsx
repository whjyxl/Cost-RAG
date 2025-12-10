import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button } from 'antd'
import logger from '@/utils/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * 全局错误边界组件
 * 捕获子组件树中的JavaScript错误，记录错误并显示降级UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state，使下一次渲染能够显示降级UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误到日志服务
    logger.error('ErrorBoundary捕获到错误:', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    this.setState({
      error,
      errorInfo,
    })

    // 生产环境可以将错误发送到错误追踪服务
    if (import.meta.env.PROD) {
      // TODO: 集成错误追踪服务（如Sentry）
      // Sentry.captureException(error, { extra: errorInfo })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级UI，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误UI
      return (
        <Result
          status="error"
          title="页面出现了错误"
          subTitle={
            this.state.error
              ? this.state.error.message || '发生了一些意外情况，请稍后重试'
              : '发生了一些意外情况，请稍后重试'
          }
          extra={[
            <Button type="primary" key="reload" onClick={this.handleReload}>
              刷新页面
            </Button>,
            <Button key="reset" onClick={this.handleReset}>
              重试
            </Button>,
          ]}
        >
          {import.meta.env.DEV && this.state.error && (
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                  <strong>错误详情（开发模式）</strong>
                </summary>
                <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {this.state.error.toString()}
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>
          )}
        </Result>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary









