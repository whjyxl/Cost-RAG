// Redux selectors
import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'

// Auth selectors
export const selectAuth = (state: RootState) => state.auth
export const selectUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated
export const selectAuthLoading = (state: RootState) => state.auth.isLoading
export const selectAuthError = (state: RootState) => state.auth.error
export const selectAccessToken = (state: RootState) => state.auth.accessToken
export const selectRefreshToken = (state: RootState) => state.auth.refreshToken

// UI selectors
export const selectUI = (state: RootState) => state.ui
export const selectSidebarCollapsed = (state: RootState) => state.ui.sidebarCollapsed
export const selectThemeMode = (state: RootState) => state.ui.themeMode
export const selectLoading = (state: RootState) => state.ui.loading

// Notifications selectors
export const selectNotifications = (state: RootState) => state.notifications
export const selectUnreadCount = (state: RootState) => state.notifications.unreadCount

// API selectors
export const selectApiStatus = (state: RootState) => state.api

// Documents selectors
export const selectDocuments = (state: RootState) => state.documentsApi

// Estimates selectors
export const selectEstimates = (state: RootState) => state.estimatesApi

// Comparisons selectors
export const selectComparisons = (state: RootState) => state.comparisonsApi

// Queries selectors
export const selectQueries = (state: RootState) => state.queriesApi

// Knowledge Graph selectors
export const selectKnowledgeGraph = (state: RootState) => state.knowledgeGraphApi

// Combined selectors
export const selectCurrentUserWithPermissions = createSelector(
  [selectUser],
  (user) => ({
    ...user,
    canUploadDocuments: user?.role === 'admin' || user?.role === 'editor',
    canManageUsers: user?.role === 'admin',
    canViewReports: user?.role !== 'viewer',
  })
)

export const selectSystemHealth = createSelector(
  [
    (state: RootState) => state.documentsApi,
    (state: RootState) => state.estimatesApi,
    (state: RootState) => state.queriesApi,
  ],
  (documents, estimates, queries) => ({
    documents: {
      status: documents.isLoading ? 'loading' : 'ready',
      error: documents.error,
    },
    estimates: {
      status: estimates.isLoading ? 'loading' : 'ready',
      error: estimates.error,
    },
    queries: {
      status: queries.isLoading ? 'loading' : 'ready',
      error: queries.error,
    },
  })
)