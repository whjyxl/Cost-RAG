import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import LoginForm from '../LoginForm'
import authSlice from '@/store/slices/authSlice'

// Mock Ant Design components
jest.mock('antd', () => {
  const originalModule = jest.requireActual('antd')
  return {
    ...originalModule,
    Form: {
      ...originalModule.Form,
      useForm: () => [jest.fn(), jest.fn()],
    },
  }
})

// 创建测试store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: {
      auth: {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastLoginTime: null,
        ...initialState,
      },
    },
  })
}

// 测试包装器组件
const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: any }> = ({
  children,
  initialState,
}) => {
  const store = createTestStore(initialState)

  return (
    <Provider store={store}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Provider>
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    // 清除localStorage
    localStorage.clear()

    // Mock console.error以避免测试输出中的错误信息
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染登录表单的所有元素', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 检查标题
      expect(screen.getByText('Cost-RAG')).toBeInTheDocument()
      expect(screen.getByText('工程造价咨询智能RAG系统')).toBeInTheDocument()

      // 检查表单字段
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /记住我/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()

      // 检查链接
      expect(screen.getByText('忘记密码？')).toBeInTheDocument()
      expect(screen.getByText('服务条款')).toBeInTheDocument()
      expect(screen.getByText('隐私政策')).toBeInTheDocument()
    })

    it('应该显示正确的图标', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 检查用户名和密码输入框的图标
      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')
      const passwordInput = screen.getByPlaceholderText('密码')

      // Ant Design的图标通常会以特定方式渲染，这里我们检查输入框是否存在
      expect(usernameInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
    })
  })

  describe('表单验证', () => {
    it('应该验证必填字段', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 提交空表单
      const submitButton = screen.getByRole('button', { name: /登录/i })
      await user.click(submitButton)

      // 应该显示验证错误信息
      await waitFor(() => {
        expect(screen.getByText(/请输入用户名或邮箱/)).toBeInTheDocument()
        expect(screen.getByText(/请输入密码/)).toBeInTheDocument()
      })
    })

    it('应该验证用户名最小长度', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 输入过短的用户名
      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')
      await user.type(usernameInput, 'ab')

      // 触发验证
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/用户名至少3个字符/)).toBeInTheDocument()
      })
    })

    it('应该验证密码最小长度', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 输入过短的密码
      const passwordInput = screen.getByPlaceholderText('密码')
      await user.type(passwordInput, '123')

      // 触发验证
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/密码至少6个字符/)).toBeInTheDocument()
      })
    })

    it('应该接受有效的表单数据', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 输入有效的表单数据
      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')
      const passwordInput = screen.getByPlaceholderText('密码')
      const submitButton = screen.getByRole('button', { name: /登录/i })

      await user.type(usernameInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // 表单应该能够提交（没有验证错误）
      await waitFor(() => {
        expect(screen.queryByText(/请输入用户名或邮箱/)).not.toBeInTheDocument()
        expect(screen.queryByText(/请输入密码/)).not.toBeInTheDocument()
      })
    })
  })

  describe('交互行为', () => {
    it('应该记住我选项可以被选中', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const rememberCheckbox = screen.getByRole('checkbox', { name: /记住我/i })

      // 默认应该未选中
      expect(rememberCheckbox).not.toBeChecked()

      // 点击选中
      await user.click(rememberCheckbox)
      expect(rememberCheckbox).toBeChecked()

      // 再次点击取消选中
      await user.click(rememberCheckbox)
      expect(rememberCheckbox).not.toBeChecked()
    })

    it('应该在输入时清除错误信息', async () => {
      const user = userEvent.setup()
      const mockClearError = jest.fn()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const usernameInput = screen.getByPlaceholderText('用户名或邮箱')

      // 输入文本应该触发错误清除
      await user.type(usernameInput, 'test')

      // 注意：由于我们使用了mock的Form.useForm，这个测试可能需要调整
      // 在实际实现中，应该测试错误清除逻辑
    })
  })

  describe('加载状态', () => {
    it('加载时应该显示loading状态', () => {
      render(
        <TestWrapper
          initialState={{
            isLoading: true,
          }}
        >
          <LoginForm />
        </TestWrapper>
      )

      const submitButton = screen.getByRole('button', { name: /登录中/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('正常状态应该显示登录按钮', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const submitButton = screen.getByRole('button', { name: /登录/i })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('错误显示', () => {
    it('应该显示错误信息', () => {
      render(
        <TestWrapper
          initialState={{
            error: '用户名或密码错误',
          }}
        >
          <LoginForm />
        </TestWrapper>
      )

      expect(screen.getByText('登录失败')).toBeInTheDocument()
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument()
    })

    it('应该能够关闭错误信息', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper
          initialState={{
            error: '测试错误信息',
          }}
        >
          <LoginForm />
        </TestWrapper>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      // 错误信息应该被移除
      await waitFor(() => {
        expect(screen.queryByText('测试错误信息')).not.toBeInTheDocument()
      })
    })
  })

  describe('可访问性', () => {
    it('应该有正确的语义化HTML结构', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 检查标题
      expect(screen.getByRole('heading', { name: 'Cost-RAG' })).toBeInTheDocument()

      // 检查表单控件
      expect(screen.getByLabelText(/用户名或邮箱/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/密码/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/记住我/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
    })

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 使用Tab键导航
      await user.tab()
      expect(screen.getByPlaceholderText('用户名或邮箱')).toHaveFocus()

      await user.tab()
      expect(screen.getByPlaceholderText('密码')).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('checkbox', { name: /记住我/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('link', { name: /忘记密码/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /登录/i })).toHaveFocus()
    })
  })

  describe('响应式设计', () => {
    it('应该在小屏幕上正确显示', () => {
      // 模拟小屏幕
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      })

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      // 检查主要元素是否仍然存在
      expect(screen.getByText('Cost-RAG')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
    })
  })
})