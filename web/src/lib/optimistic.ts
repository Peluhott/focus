import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { ApiError } from './api'
import { useToast } from './toast'

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.'
}

let tempCounter = 0
/** Negative ids mark items that exist only in the cache until the server answers. */
export const tempId = () => -(Date.now() * 1000 + (tempCounter++ % 1000))
export const isTemp = (id: number) => id < 0

type Options<TData, TVars, TCache> = {
  /** Which cache entry this mutation edits. */
  queryKey: (vars: TVars) => QueryKey
  mutationFn: (vars: TVars) => Promise<TData>
  /** The optimistic edit: old cache value → new one. */
  apply: (old: TCache, vars: TVars) => TCache
  /** Swap the server's answer into the cache (e.g. replace a temp id). */
  settle?: (old: TCache, data: TData, vars: TVars) => TCache
  /** Other caches to refresh afterwards. */
  alsoInvalidate?: (vars: TVars) => QueryKey[]
  onSuccess?: (data: TData, vars: TVars) => void
  /**
   * Mutations with the same scope run one after another, in the order they
   * were made (their optimistic edits still apply at once). Every mutation on
   * a list shares one scope, so quick Enter-Enter-Enter keeps its order and
   * an Undo can't overtake the change it undoes.
   */
  scope?: string
  /** Extra optimistic edits to other caches (not rolled back on error; they refetch). */
  alsoApply?: (qc: QueryClient, vars: TVars) => void | Promise<void>
}

/**
 * Optimistic mutation: the UI changes instantly, the server confirms in the
 * background, and a failure rolls back with a toast. Caches are refetched
 * only once the last mutation in flight settles, so quick edits in a row
 * don't flicker.
 */
export function useOptimisticMutation<TData, TVars, TCache>(opts: Options<TData, TVars, TCache>) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationKey: ['focus-mutation'],
    scope: opts.scope ? { id: opts.scope } : undefined,
    mutationFn: opts.mutationFn,
    onMutate: async (vars: TVars) => {
      const key = opts.queryKey(vars)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TCache>(key)
      if (prev !== undefined) qc.setQueryData<TCache>(key, opts.apply(prev, vars))
      await opts.alsoApply?.(qc, vars)
      return { prev, key }
    },
    onError: (error, _vars, ctx) => {
      if (ctx && ctx.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev)
      toast(errorMessage(error))
    },
    onSuccess: (data, vars, ctx) => {
      if (opts.settle && ctx) {
        const cur = qc.getQueryData<TCache>(ctx.key)
        if (cur !== undefined) qc.setQueryData<TCache>(ctx.key, opts.settle(cur, data, vars))
      }
      opts.onSuccess?.(data, vars)
    },
    onSettled: (_data, _error, vars, ctx) => {
      const keys = [ctx?.key ?? opts.queryKey(vars), ...(opts.alsoInvalidate?.(vars) ?? [])]
      // Refetch once nothing else is in flight (this mutation still counts as 1).
      if (qc.isMutating({ mutationKey: ['focus-mutation'] }) <= 1) {
        for (const key of keys) qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/** Move an item within a list to match a new order of ids. */
export function reorder<T extends { id: number }>(list: T[], order: T[]): T[] {
  const ids = new Set(order.map((i) => i.id))
  return [...order, ...list.filter((i) => !ids.has(i.id))]
}
