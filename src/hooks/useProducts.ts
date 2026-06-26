import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import type { Product, PriceHistory, ProductWithHistory } from '@/types/product'

export type { Product, PriceHistory, ProductWithHistory }

export interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const PAGE_LIMIT = 20

function buildParams(
  filters: {
    search?: string
    category?: string
    sortBy?: string
    limit?: number
  } | undefined,
  page: number
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters?.search) params.append('search', filters.search)
  if (filters?.category && filters.category !== 'All') {
    params.append('category', filters.category)
  }
  if (filters?.sortBy && filters.sortBy !== 'default') {
    if (filters.sortBy === 'price-low') {
      params.append('sortBy', 'currentPrice')
      params.append('sortOrder', 'asc')
    } else if (filters.sortBy === 'price-high') {
      params.append('sortBy', 'currentPrice')
      params.append('sortOrder', 'desc')
    } else if (filters.sortBy === 'discount') {
      params.append('sortBy', 'discountPercentage')
      params.append('sortOrder', 'desc')
    } else {
      params.append('sortBy', filters.sortBy)
    }
  } else {
    // "default" / no sort → tell backend to randomize
    params.append('sortBy', 'random')
  }
  params.append('limit', String(filters?.limit ?? PAGE_LIMIT))
  params.append('page', String(page))
  return params
}

function normalizeProduct(p: any): Product {
  return { ...p, id: p._id || p.id }
}

/** Infinite-scroll version — use this on the full products listing page */
export function useInfiniteProducts(filters?: {
  search?: string
  category?: string
  sortBy?: string
}) {
  return useInfiniteQuery<ProductsResponse>({
    queryKey: ['products-infinite', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = buildParams(filters, pageParam as number)
      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch products')
      const data: ProductsResponse = await res.json()
      return {
        ...data,
        products: data.products.map(normalizeProduct),
      }
    },
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination
      return page < totalPages ? page + 1 : undefined
    },
  })
}

/** Simple single-page version — kept for landing page / small slices */
export function useProducts(filters?: {
  search?: string
  category?: string
  sortBy?: string
  limit?: number
}) {
  return useQuery<Product[]>({
    queryKey: ['products', filters],
    queryFn: async () => {
      const params = buildParams(filters, 1)
      // Override limit for one-shot usage (landing page uses slice(0,4) anyway)
      if (filters?.limit) params.set('limit', String(filters.limit))
      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch products')
      const data: ProductsResponse = await res.json()
      return data.products.map(normalizeProduct)
    },
  })
}

export function useProductDetails(itemId: string) {
  return useQuery<ProductWithHistory>({
    queryKey: ['product', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${itemId}`)
      if (!res.ok) throw new Error('Product not found')
      const p = await res.json()
      return { ...p, id: p._id || p.id }
    },
    enabled: !!itemId,
  })
}