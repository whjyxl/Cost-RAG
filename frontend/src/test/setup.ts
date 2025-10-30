import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// 配置testing-library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock console methods in test environment
global.console = {
  ...console,
  // 保留error和warn用于调试
  error: jest.fn(),
  warn: jest.fn(),
  // 静默其他方法
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Mock next/navigation (React 18+)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
})

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Array(4),
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => ({ data: new Array(4) })),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  }),
  writable: true,
})

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: jest.fn(() => 'mock-url'),
  writable: true,
})

Object.defineProperty(URL, 'revokeObjectURL', {
  value: jest.fn(),
  writable: true,
})

// Ant Design测试配置
// Mock antd message
jest.mock('antd', () => {
  const antd = jest.requireActual('antd')
  return {
    ...antd,
    message: {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
      loading: jest.fn(),
    },
    notification: {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
      open: jest.fn(),
    },
  }
})

// Mock dayjs
jest.mock('dayjs', () => {
  const originalDayjs = jest.requireActual('dayjs')
  return (date?: any) => {
    const dayjsInstance = originalDayjs(date)
    return {
      ...dayjsInstance,
      format: jest.fn(() => '2024-01-01'),
      valueOf: jest.fn(() => Date.now()),
    }
  }
})

// 清理函数
afterEach(() => {
  jest.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})