import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'
import type { RootState, AppDispatch } from '../store'

// 类型安全的hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// 便捷的hooks
export const useAuth = () => {
  const auth = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()

  return {
    ...auth,
    dispatch,
  }
}

export const useUi = () => {
  const ui = useAppSelector((state) => state.ui)
  const dispatch = useAppDispatch()

  return {
    ...ui,
    dispatch,
  }
}

export const useNotifications = () => {
  const notifications = useAppSelector((state) => state.notifications)
  const dispatch = useAppDispatch()

  return {
    ...notifications,
    dispatch,
  }
}