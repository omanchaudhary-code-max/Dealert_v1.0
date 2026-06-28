"use client";

import Link from "next/link";
import { Suspense, useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInfiniteProducts } from "@/hooks/useProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, SlidersHorizontal, ArrowDownRight,
  Heart, ShoppingBag, Eye, X
} from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

const SORT_OPTIONS = [
  { value: "default",    label: "Featured (Random)",   sortBy: "random",             isRandom: true  },
  { value: "price-low",  label: "Price: Low to High",  sortBy: "currentPrice",       isRandom: false },
  { value: "price-high", label: "Price: High to Low",  sortBy: "currentPrice",       isRandom: false },
  { value: "discount",   label: "Biggest Discount %",  sortBy: "discountPercentage", isRandom: false },
  { value: "recent",     label: "Recently Updated",    sortBy: "lastCrawledAt",      isRandom: false },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function getSortOption(value: string) {
  return SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
}

// ✅ All useSearchParams logic lives here, inside the Suspense boundary
function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlSearch   = searchParams.get("search")   || "";
  const urlCategory = searchParams.get("category") || "All";
  const urlSort     = (searchParams.get("sortBy")  || "default") as SortValue;

  const [searchInput,     setSearchInput]     = useState(urlSearch);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [priceRange,      setPriceRange]      = useState<number>(200000);

  const { wishlistItems, toggleWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const activeSortOption = getSortOption(urlSort);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    error,
  } = useInfiniteProducts({
    search:   urlSearch   || undefined,
    category: urlCategory === "All" ? undefined : urlCategory,
    sortBy:   activeSortOption.sortBy,
  });

  const allProducts = useMemo(() => {
    const pages = data?.pages.flatMap((p) => p.products) ?? [];
    const seen  = new Set<string>();
    return pages.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [data]);

  const filteredProducts = useMemo(
    () =>
      allProducts.filter((p) => {
        if (showInStockOnly && !p.inStock)  return false;
        if (p.currentPrice > priceRange)    return false;
        return true;
      }),
    [allProducts, showInStockOnly, priceRange]
  );

  const totalCount = data?.pages[0]?.pagination.total ?? 0;
  const canLoadMore = hasNextPage && !activeSortOption.isRandom;

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && canLoadMore && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [canLoadMore, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [handleObserver]);

  const updateFilters = (newParams: {
    search?:   string;
    category?: string;
    sortBy?:   string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newParams.search !== undefined) {
      if (newParams.search) params.set("search", newParams.search);
      else params.delete("search");
    }
    if (newParams.category !== undefined) {
      if (newParams.category && newParams.category !== "All")
        params.set("category", newParams.category);
      else params.delete("category");
    }
    if (newParams.sortBy !== undefined) {
      if (newParams.sortBy && newParams.sortBy !== "default")
        params.set("sortBy", newParams.sortBy);
      else params.delete("sortBy");
    }
    router.push(`/products?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setShowInStockOnly(false);
    setPriceRange(200000);
    router.push("/products");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

      {/* Filter sidebar */}
      <aside className="lg:col-span-1 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-6 bg-card border border-border p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span>Filters</span>
          </h3>
          <button
            onClick={handleClearFilters}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-bold uppercase"
          >
            Clear All
          </button>
        </div>

        <hr className="border-border/60" />

        {/* Search */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Search</label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              key={urlSearch}
              type="text"
              placeholder="Product name..."
              className="w-full pl-3 pr-8 py-2 text-xs rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-foreground"
              defaultValue={urlSearch}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); updateFilters({ search: "" }); }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Category</label>
          <div className="flex flex-col space-y-1">
            {["All", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => updateFilters({ category: cat })}
                className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                  urlCategory === cat
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-foreground">Max Price</span>
            <span className="text-primary font-bold">{formatCurrency(priceRange)}</span>
          </div>
          <input
            type="range"
            min="500"
            max="200000"
            step="1000"
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            value={priceRange}
            onChange={(e) => setPriceRange(Number(e.target.value))}
          />
        </div>

        {/* Stock Toggle */}
        <div className="flex items-center justify-between pt-2">
          <label className="text-xs font-semibold text-foreground cursor-pointer" htmlFor="stockToggle">
            In Stock Only
          </label>
          <input
            type="checkbox"
            id="stockToggle"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            checked={showInStockOnly}
            onChange={(e) => setShowInStockOnly(e.target.checked)}
          />
        </div>
      </aside>

      {/* Product grid */}
      <div className="lg:col-span-3 space-y-6">

        {/* Sort bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-bold text-foreground">{filteredProducts.length}</span>
            {totalCount > 0 && (
              <> of <span className="font-bold text-foreground">{totalCount}</span></>
            )}{" "}
            products
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Sort By:</span>
            <select
              className="bg-muted border border-border text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-foreground font-medium"
              value={urlSort}
              onChange={(e) => updateFilters({ sortBy: e.target.value })}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="rounded-xl border border-border p-4 space-y-4 animate-pulse">
                <div className="aspect-video bg-muted rounded-lg" />
                <div className="h-4 bg-muted w-2/3 rounded" />
                <div className="h-3 bg-muted w-full rounded" />
                <div className="h-5 bg-muted w-1/2 rounded" />
              </div>
            ))}
          </div>

        ) : error ? (
          <div className="text-center p-12 bg-card border border-border rounded-2xl">
            <p className="text-destructive font-semibold">Error loading products.</p>
            <button onClick={() => refetch()} className="text-xs text-primary font-bold mt-2 hover:underline">
              Try again
            </button>
          </div>

        ) : filteredProducts.length === 0 ? (
          <div className="text-center p-16 bg-card border border-border rounded-2xl space-y-4">
            <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-semibold text-foreground">No products match your criteria</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try widening your price range, selecting another category, or clearing search filters.
            </p>
            <button
              onClick={handleClearFilters}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl"
            >
              Clear All Filters
            </button>
          </div>

        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filteredProducts.map((product) => {
                const wish = wishlistItems.includes(product.id);
                return (
                  <div
                    key={product.id}
                    className="rounded-xl border border-border bg-card shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col justify-between overflow-hidden relative group"
                  >
                    {!product.inStock ? (
                      <div className="absolute top-3 left-3 z-10 bg-muted/90 text-muted-foreground text-[9px] font-bold px-2 py-1 rounded-full">
                        OUT OF STOCK
                      </div>
                    ) : product.discountPercentage > 0 ? (
                      <div className="absolute top-3 left-3 z-10 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5">
                        <ArrowDownRight className="h-3 w-3" />
                        <span>{product.discountPercentage}% OFF</span>
                      </div>
                    ) : null}

                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (!isAuthenticated) {
                            router.push(`/login?redirect=/products`);
                          } else {
                            toggleWishlist(product.id);
                          }
                        }}
                        className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors cursor-pointer border ${
                          wish
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background/80 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        <Heart className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider truncate">
                            {product.category}
                          </span>
                          {product.sellerName && (
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium text-foreground shrink-0 max-w-[45%] truncate">
                              {product.sellerName}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/products/${product.id}`}
                          className="block font-bold text-foreground text-sm hover:text-primary transition-colors line-clamp-2"
                        >
                          {product.name}
                        </Link>
                      </div>

                      <div className="flex items-end justify-between pt-2 border-t border-border/50">
                        <div>
                          {product.discountPercentage > 0 && product.originalPrice ? (
                            <span className="text-[10px] text-muted-foreground line-through block">
                              {formatCurrency(product.originalPrice)}
                            </span>
                          ) : null}
                          <span className="text-base font-extrabold text-foreground">
                            {formatCurrency(product.currentPrice)}
                          </span>
                        </div>
                        <Link
                          href={`/products/${product.id}`}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>Compare</span>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-12 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more products...</span>
                </div>
              )}
              {activeSortOption.isRandom && !isFetchingNextPage && filteredProducts.length > 0 && (
                <button onClick={() => refetch()} className="text-xs text-primary font-semibold hover:underline">
                  Refresh for new products
                </button>
              )}
              {!canLoadMore && !activeSortOption.isRandom && filteredProducts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  You&apos;ve seen all {filteredProducts.length} products
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ✅ Default export wraps everything in Suspense
export default function ProductsPage() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Compare Prices in Nepal
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Compare real-time prices across various sellers and select target thresholds for alert notifications.
        </p>
      </div>
      <Suspense fallback={
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 bg-card border border-border p-6 rounded-2xl animate-pulse h-96" />
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 space-y-4 animate-pulse">
                <div className="aspect-video bg-muted rounded-lg" />
                <div className="h-4 bg-muted w-2/3 rounded" />
                <div className="h-3 bg-muted w-full rounded" />
                <div className="h-5 bg-muted w-1/2 rounded" />
              </div>
            ))}
          </div>
        </div>
      }>
        <ProductsContent />
      </Suspense>
    </div>
  );
}
