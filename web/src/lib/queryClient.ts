import { QueryClient } from '@tanstack/react-query'

/**
 * The root client: who is signed in (`me`), outside any workspace. Pages
 * inside the shell use their workspace's client (workspace.ts).
 */
export const rootClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})
