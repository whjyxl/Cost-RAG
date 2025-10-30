import { configureStore } from '@reduxjs/toolkit'
import { authApi } from './api/authApi'
import { documentsApi } from './api/documentsApi'
import { estimatesApi } from './api/estimatesApi'
import { comparisonsApi } from './api/comparisonsApi'
import { queriesApi } from './api/queriesApi'
import { knowledgeGraphApi } from './api/knowledgeGraphApi'

// Slices
import authSlice from './slices/authSlice'
import uiSlice from './slices/uiSlice'
import notificationsSlice from './slices/notificationsSlice'

export const store = configureStore({
  reducer: {
    // RTK Query API reducers
    [authApi.reducerPath]: authApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
    [estimatesApi.reducerPath]: estimatesApi.reducer,
    [comparisonsApi.reducerPath]: comparisonsApi.reducer,
    [queriesApi.reducerPath]: queriesApi.reducer,
    [knowledgeGraphApi.reducerPath]: knowledgeGraphApi.reducer,

    // Feature slices
    auth: authSlice,
    ui: uiSlice,
    notifications: notificationsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          // RTK Query actions
          'authApi/executeQuery/pending',
          'authApi/executeQuery/fulfilled',
          'authApi/executeQuery/rejected',
          // Other RTK Query APIs
        ],
        ignoredPaths: [
          // RTK Query cache
          'authApi',
          'documentsApi',
          'estimatesApi',
          'comparisonsApi',
          'queriesApi',
          'knowledgeGraphApi',
        ],
      },
    })
      .concat(authApi.middleware)
      .concat(documentsApi.middleware)
      .concat(estimatesApi.middleware)
      .concat(comparisonsApi.middleware)
      .concat(queriesApi.middleware)
      .concat(knowledgeGraphApi.middleware),
})

// 类型定义
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// 导出选择器
export * from './selectors'

// 开发环境下的store配置
if (process.env.NODE_ENV === 'development') {
  // 开发工具
  if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: 'Cost-RAG Frontend',
      trace: true,
      traceLimit: 25,
    })
  }
}