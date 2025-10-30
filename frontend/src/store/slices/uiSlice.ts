import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface ThemeState {
  mode: 'light' | 'dark' | 'auto'
  primaryColor: string
  borderRadius: number
}

export interface LayoutState {
  sidebarCollapsed: boolean
  sidebarWidth: number
  headerHeight: number
  contentPadding: number
}

export interface UIState {
  theme: ThemeState
  layout: LayoutState
  loading: {
    global: boolean
    [key: string]: boolean
  }
  modals: {
    [key: string]: boolean
  }
  notifications: {
    position: 'topRight' | 'bottomRight' | 'topLeft' | 'bottomLeft'
  }
}

const initialState: UIState = {
  theme: {
    mode: 'light',
    primaryColor: '#2563eb',
    borderRadius: 8,
  },
  layout: {
    sidebarCollapsed: false,
    sidebarWidth: 240,
    headerHeight: 64,
    contentPadding: 24,
  },
  loading: {
    global: false,
  },
  modals: {},
  notifications: {
    position: 'topRight',
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // 主题相关
    setThemeMode: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme.mode = action.payload
      // 应用主题到document
      const root = document.documentElement
      if (action.payload === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },

    setPrimaryColor: (state, action: PayloadAction<string>) => {
      state.theme.primaryColor = action.payload
    },

    setBorderRadius: (state, action: PayloadAction<number>) => {
      state.theme.borderRadius = action.payload
    },

    // 布局相关
    toggleSidebar: (state) => {
      state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed
      state.layout.sidebarWidth = state.layout.sidebarCollapsed ? 80 : 240
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.layout.sidebarCollapsed = action.payload
      state.layout.sidebarWidth = action.payload ? 80 : 240
    },

    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.layout.sidebarWidth = action.payload
    },

    setHeaderHeight: (state, action: PayloadAction<number>) => {
      state.layout.headerHeight = action.payload
    },

    setContentPadding: (state, action: PayloadAction<number>) => {
      state.layout.contentPadding = action.payload
    },

    // 加载状态
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload
    },

    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload
      state.loading[key] = loading
    },

    clearLoading: (state, action: PayloadAction<string>) => {
      const key = action.payload
      delete state.loading[key]
    },

    // 模态框状态
    openModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = true
    },

    closeModal: (state, action: PayloadAction<string>) => {
      state.modals[action.payload] = false
    },

    toggleModal: (state, action: PayloadAction<string>) => {
      const modalKey = action.payload
      state.modals[modalKey] = !state.modals[modalKey]
    },

    closeAllModals: (state) => {
      state.modals = {}
    },

    // 通知设置
    setNotificationPosition: (
      state,
      action: PayloadAction<'topRight' | 'bottomRight' | 'topLeft' | 'bottomLeft'>
    ) => {
      state.notifications.position = action.payload
    },

    // 重置UI状态
    resetUIState: () => {
      return initialState
    },
  },
})

export const {
  setThemeMode,
  setPrimaryColor,
  setBorderRadius,
  toggleSidebar,
  setSidebarCollapsed,
  setSidebarWidth,
  setHeaderHeight,
  setContentPadding,
  setGlobalLoading,
  setLoading,
  clearLoading,
  openModal,
  closeModal,
  toggleModal,
  closeAllModals,
  setNotificationPosition,
  resetUIState,
} = uiSlice.actions

// 选择器
export const selectTheme = (state: { ui: UIState }) => state.ui.theme
export const selectLayout = (state: { ui: UIState }) => state.ui.layout
export const selectLoading = (state: { ui: UIState }) => state.ui.loading
export const selectModals = (state: { ui: UIState }) => state.ui.modals
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications

// 便捷选择器
export const selectThemeMode = (state: { ui: UIState }) => state.ui.theme.mode
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.layout.sidebarCollapsed
export const selectSidebarWidth = (state: { ui: UIState }) => state.ui.layout.sidebarWidth
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.loading.global

export default uiSlice.reducer