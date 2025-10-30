import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

import App from './App'
import { store } from './store'
import './styles/globals.css'
import './styles/antd-theme.css'

// 设置dayjs中文
dayjs.locale('zh-cn')

// Ant Design主题配置
const antdTheme = {
  token: {
    colorPrimary: '#2563eb',
    borderRadius: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Card: {
      borderRadius: 12,
    },
    Modal: {
      borderRadius: 12,
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider locale={zhCN} theme={antdTheme}>
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)