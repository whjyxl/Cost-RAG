import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

// 配置testing-library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
})

// Mock matchMedia - 修复antd responsiveObserver的问题
// antd的responsiveObserver期望matchMedia返回的对象有matches属性
import { vi } from 'vitest'

// 创建一个全局的matchMedia mock
const createMatchMedia = (query: string) => {
  const mediaQuery = {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn((event: string, callback: () => void) => {
      // 存储callback以便后续调用
      if (!mediaQuery.listeners) {
        mediaQuery.listeners = []
      }
      mediaQuery.listeners.push(callback)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    listeners: [] as (() => void)[],
  }
  return mediaQuery
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: createMatchMedia,
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock console methods in test environment
global.console = {
  ...console,
  // 保留error和warn用于调试
  error: vi.fn(),
  warn: vi.fn(),
  // 静默其他方法
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Array(4),
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }),
  writable: true,
})

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'mock-url'),
  writable: true,
})

Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
})

// 清理函数
import { afterEach } from 'vitest'
afterEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})