/**
 * 回归测试：错误边界组件
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('ErrorBoundary回归测试', () => {
  it('应该正常渲染子组件', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    )

    expect(container.textContent).toContain('正常内容')
  })

  it('应该在子组件抛出错误时显示错误UI', () => {
    const ThrowError = () => {
      throw new Error('测试错误')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    // 应该显示错误信息
    expect(screen.getByText(/页面出现了错误/i)).toBeInTheDocument()
  })

  it('应该支持自定义降级UI', () => {
    const customFallback = <div>自定义错误UI</div>

    const ThrowError = () => {
      throw new Error('测试错误')
    }

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('自定义错误UI')).toBeInTheDocument()
  })
})









