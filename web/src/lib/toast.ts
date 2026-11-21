import { createContext, useContext } from 'react'

export type ShowToast = (message: string, undo?: () => void) => void

export const ToastContext = createContext<ShowToast>(() => {})

/** Show the 5-second toast, optionally with Undo. */
export const useToast = () => useContext(ToastContext)
