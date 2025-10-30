import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Notification, NotificationType } from '@/types'

export interface NotificationState {
  items: Notification[]
  unreadCount: number
  maxNotifications: number
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
  maxNotifications: 50,
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // 添加通知
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'created_at'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
      }

      state.items.unshift(notification)
      state.unreadCount += 1

      // 限制最大通知数量
      if (state.items.length > state.maxNotifications) {
        state.items = state.items.slice(0, state.maxNotifications)
      }
    },

    // 标记为已读
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.items.find((item) => item.id === action.payload)
      if (notification && !notification.is_read) {
        notification.is_read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },

    // 标记所有为已读
    markAllAsRead: (state) => {
      state.items.forEach((notification) => {
        notification.is_read = true
      })
      state.unreadCount = 0
    },

    // 删除通知
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex((item) => item.id === action.payload)
      if (index !== -1) {
        const notification = state.items[index]
        if (!notification.is_read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        state.items.splice(index, 1)
      }
    },

    // 清空所有通知
    clearNotifications: (state) => {
      state.items = []
      state.unreadCount = 0
    },

    // 清空已读通知
    clearReadNotifications: (state) => {
      state.items = state.items.filter((notification) => !notification.is_read)
    },

    // 设置最大通知数量
    setMaxNotifications: (state, action: PayloadAction<number>) => {
      state.maxNotifications = action.payload
      // 调整当前通知数量
      if (state.items.length > action.payload) {
        state.items = state.items.slice(0, action.payload)
      }
    },

    // 批量添加通知（用于从服务器同步）
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.items = action.payload
      state.unreadCount = action.payload.filter((item) => !item.is_read).length
    },

    // 更新通知
    updateNotification: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Notification> }>
    ) => {
      const { id, updates } = action.payload
      const notification = state.items.find((item) => item.id === id)
      if (notification) {
        Object.assign(notification, updates)
        // 如果更新了已读状态，需要更新未读数量
        if ('is_read' in updates) {
          if (updates.is_read && !notification.is_read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1)
          } else if (!updates.is_read && notification.is_read) {
            state.unreadCount += 1
          }
        }
      }
    },
  },
})

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearNotifications,
  clearReadNotifications,
  setMaxNotifications,
  setNotifications,
  updateNotification,
} = notificationsSlice.actions

// 便捷action creators
export const addSuccessNotification = (message: string, title?: string) =>
  addNotification({
    title: title || '成功',
    message,
    type: NotificationType.SUCCESS,
    is_read: false,
  })

export const addErrorNotification = (message: string, title?: string) =>
  addNotification({
    title: title || '错误',
    message,
    type: NotificationType.ERROR,
    is_read: false,
  })

export const addWarningNotification = (message: string, title?: string) =>
  addNotification({
    title: title || '警告',
    message,
    type: NotificationType.WARNING,
    is_read: false,
  })

export const addInfoNotification = (message: string, title?: string) =>
  addNotification({
    title: title || '信息',
    message,
    type: NotificationType.INFO,
    is_read: false,
  })

// 选择器
export const selectNotifications = (state: { notifications: NotificationState }) => state.notifications.items
export const selectUnreadCount = (state: { notifications: NotificationState }) => state.notifications.unreadCount
export const selectMaxNotifications = (state: { notifications: NotificationState }) => state.notifications.maxNotifications

// 便捷选择器
export const selectUnreadNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.items.filter((item) => !item.is_read)
export const selectReadNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.items.filter((item) => item.is_read)
export const selectNotificationsByType = (type: NotificationType) => (state: { notifications: NotificationState }) =>
  state.notifications.items.filter((item) => item.type === type)

export default notificationsSlice.reducer