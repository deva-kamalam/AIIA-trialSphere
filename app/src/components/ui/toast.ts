import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => {})

/** Show a short confirmation or error message. Wording should match the action that triggered it. */
export const useToast = () => useContext(ToastCtx)
