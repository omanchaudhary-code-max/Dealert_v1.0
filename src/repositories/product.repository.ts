import { ObjectId } from 'mongodb'
import { getMongoDb } from '@/lib/mongodb'
import type { Product, PriceHistory } from '@/types/product'

// ---------------------------------------------------------------------------
// Raw document shapes — exactly what the Python/Selenium crawler writes to
// MongoDB. All fields are snake_case. These interfaces never leave this file;
// every public method maps into the camelCase Product/PriceHistory types.
// ---------------------------------------------------------------------------

interface RawProduct {
  _id: ObjectId
  item_id: string
  title: string
  url: string
  category: string
  seller_name: string
  last_seen: Date
  last_price: number
  first_seen: Date
  image_url: string
  image_verified: boolean
  is_delisted: boolean
}

interface RawPriceHistory {
  _id: ObjectId
  item_id: string
  crawl_run_id: string
  scraped_at: Date
  current_price: number
  original_price: number
  is_promotional: boolean
  category: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function categoryFilter(category: string) {
  // Case-insensitive exact match: crawler stores 'laptops', UI sends 'Laptops'.
  return { $regex: `^${escapeRegex(category.trim())}$`, $options: 'i' }
}

function searchFilter(search: string) {
  return { $regex: escapeRegex(search.trim()), $options: 'i' }
}

// Valid camelCase sort fields that exist on the projected document shape.
// Anything not in this set falls back to lastCrawledAt.
const VALID_SORT_FIELDS = new Set([
  'lastCrawledAt',
  'currentPrice',
  'discountPercentage',
])

// ---------------------------------------------------------------------------
// Pipeline stage builders
//
// buildProductPipeline is split into three parts so callers can insert
// $sample (or any other stage) *between* the $match and the expensive
// $lookup. Calling the full pipeline with $sample after $match but before
// $lookup means we only join the N documents we actually need instead of
// joining the whole collection then sampling — much cheaper.
//
//   matchStages(filter)   →  [ $match ]
//   joinAndProjectStages  →  [ $lookup, $unwind, $addFields, $project ]
//   buildProductPipeline  →  matchStages + joinAndProjectStages  (convenience)
// ---------------------------------------------------------------------------

function matchStages(match: Record<string, unknown>) {
  return [{ $match: match }]
}

function joinAndProjectStages() {
  return [
    // Join with the single most recent price_history record per product.
    // Pricing data (current_price, original_price) only lives here —
    // products.last_price is a snapshot fallback only.
    {
      $lookup: {
        from: 'price_history',
        let: { itemId: '$item_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
          { $sort: { scraped_at: -1 } },
          { $limit: 1 },
        ],
        as: 'latestPrice',
      },
    },
    { $unwind: { path: '$latestPrice', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        computedCurrentPrice: {
          $ifNull: ['$latestPrice.current_price', '$last_price'],
        },
        computedOriginalPrice: {
          $ifNull: ['$latestPrice.original_price', '$last_price'],
        },
        computedDiscountPercentage: {
          $cond: [
            {
              $and: [
                { $ne: ['$latestPrice.original_price', null] },
                { $gt: ['$latestPrice.original_price', 0] },
              ],
            },
            {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        {
                          $subtract: [
                            '$latestPrice.original_price',
                            '$latestPrice.current_price',
                          ],
                        },
                        '$latestPrice.original_price',
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            0,
          ],
        },
      },
    },
    // $project translates snake_case crawler fields → camelCase Product type.
    {
      $project: {
        _id: { $toString: '$_id' },
        id: { $toString: '$_id' },
        itemId: '$item_id',
        name: '$title',
        currentPrice: '$computedCurrentPrice',
        originalPrice: '$computedOriginalPrice',
        discountPercentage: '$computedDiscountPercentage',
        imageUrl: '$image_url',
        productUrl: '$url',
        category: '$category',
        sellerName: '$seller_name',
        inStock: { $eq: ['$is_delisted', false] },
        lastCrawledAt: '$last_seen',
        createdAt: '$first_seen',
      },
    },
  ]
}

function buildProductPipeline(match: Record<string, unknown>) {
  return [...matchStages(match), ...joinAndProjectStages()]
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ProductRepository {
  private async getCollection() {
    const db = await getMongoDb()
    return db.collection<RawProduct>('products')
  }

  private async getPriceHistoryCollection() {
    const db = await getMongoDb()
    return db.collection<RawPriceHistory>('price_history')
  }

  async findById(id: string): Promise<Product | null> {
    const col = await this.getCollection()
    const match = { _id: ObjectId.isValid(id) ? new ObjectId(id) : id }
    const results = await col
      .aggregate<Product>(buildProductPipeline(match))
      .toArray()
    return results[0] ?? null
  }

  async findByItemId(itemId: string): Promise<Product | null> {
    const col = await this.getCollection()
    const results = await col
      .aggregate<Product>(buildProductPipeline({ item_id: itemId }))
      .toArray()
    return results[0] ?? null
  }

  async findMany(options: {
    category?: string
    search?: string
    skip?: number
    limit?: number
    sortBy?: string
    sortOrder?: 1 | -1
  }): Promise<Product[]> {
    const col = await this.getCollection()

    const match: Record<string, unknown> = { is_delisted: false }
    if (options.category) match.category = categoryFilter(options.category)
    if (options.search) match.title = searchFilter(options.search)

    const limit = options.limit ?? 20
    const skip = options.skip ?? 0

    // --- Random sort path ---------------------------------------------------
    // $sample runs AFTER $match but BEFORE $lookup so we only join the N
    // documents we actually need. Pagination is intentionally disabled for
    // random: $sample re-draws on every request, so "page 2" would just
    // repeat documents from page 1 anyway.
    if (options.sortBy === 'random') {
      return col
        .aggregate<Product>([
          ...matchStages(match),
          { $sample: { size: limit } },
          ...joinAndProjectStages(),
        ])
        .toArray()
    }

    // --- Deterministic sort path --------------------------------------------
    // Unknown sortBy values fall back to lastCrawledAt so arbitrary query
    // strings can't inject field names directly into the $sort stage.
    const sortField = VALID_SORT_FIELDS.has(options.sortBy ?? '')
      ? (options.sortBy as string)
      : 'lastCrawledAt'

    // _id is a secondary tiebreaker: many products share the same last_seen
    // timestamp (written in one crawl run), so without it MongoDB's page
    // boundary is arbitrary and the same document appears on page 1 AND
    // page 2, causing React's "duplicate key" warning.
    return col
      .aggregate<Product>([
        ...buildProductPipeline(match),
        { $sort: { [sortField]: options.sortOrder ?? -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray()
  }

  async countMany(options: { category?: string; search?: string }) {
    const col = await this.getCollection()
    const filter: Record<string, unknown> = { is_delisted: false }
    if (options.category) filter.category = categoryFilter(options.category)
    if (options.search) filter.title = searchFilter(options.search)
    return col.countDocuments(filter)
  }

  async findTrending(limit = 10): Promise<Product[]> {
    const col = await this.getCollection()
    return col
      .aggregate<Product>([
        ...buildProductPipeline({ is_delisted: false }),
        { $match: { discountPercentage: { $gte: 10 } } },
        { $sort: { discountPercentage: -1, _id: -1 } },
        { $limit: limit },
      ])
      .toArray()
  }

  async getPriceHistory(itemId: string): Promise<PriceHistory[]> {
    const col = await this.getPriceHistoryCollection()
    return col
      .aggregate<PriceHistory>([
        { $match: { item_id: itemId } },
        { $sort: { scraped_at: 1 } },
        {
          $project: {
            _id: { $toString: '$_id' },
            productId: '$item_id',
            price: '$current_price',
            recordedAt: '$scraped_at',
          },
        },
      ])
      .toArray()
  }

  async getCategoryAverages() {
    const col = await this.getPriceHistoryCollection()
    // Average must come from price_history (not products) because that's
    // the only place current_price lives. We take each item's most recent
    // snapshot before grouping by category to avoid old snapshots skewing
    // the average.
    return col
      .aggregate([
        { $sort: { scraped_at: -1 } },
        {
          $group: {
            _id: '$item_id',
            category: { $first: '$category' },
            current_price: { $first: '$current_price' },
          },
        },
        {
          $group: {
            _id: '$category',
            avgPrice: { $avg: '$current_price' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray()
  }
}

export const productRepository = new ProductRepository()