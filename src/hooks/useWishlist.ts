import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Product } from './useProducts'
import { useAuthStore } from '@/hooks/useAuth'

export function useWishlist() {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data: wishlistProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const res = await fetch('/api/wishlist')
      if (!res.ok) {
        if (res.status === 401) return []
        throw new Error('Failed to fetch wishlist')
      }
      const data = await res.json()
      return data.map((p: any) => ({ ...p, id: p._id || p.id }))
    },
    enabled: isAuthenticated, // ✅ skip the request entirely when logged out
    retry: false,
  })

  const wishlistItems = wishlistProducts.map((p) => p.id)

  const isWishlisted = (productId: string) => wishlistItems.includes(productId)

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch('/api/wishlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add to wishlist')
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch('/api/wishlist/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to remove from wishlist')
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const bulkAddMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const res = await fetch('/api/wishlist/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to bulk add to wishlist')
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const toggleWishlist = async (productId: string) => {
    if (isWishlisted(productId)) {
      await removeMutation.mutateAsync(productId)
    } else {
      await addMutation.mutateAsync(productId)
    }
  }

  return {
    wishlistProducts,
    wishlistItems,
    isLoading,
    isWishlisted,
    addToWishlist: addMutation.mutateAsync,
    removeFromWishlist: removeMutation.mutateAsync,
    bulkAddToWishlist: bulkAddMutation.mutateAsync,
    toggleWishlist,
  }
}