import { useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchProductsThunk,
  searchProductsThunk,
} from "@/features/products/productsThunks";
import {
  selectAllProducts,
  selectProductsError,
  selectProductsLoading,
  selectProductPagination,
} from "@/features/products/productsSlice";
import { addToCartThunk } from "@/features/cart/cartThunks";
import WishlistButton from "@/features/wishlist/components/WishlistButton";
import { ProductGridSkeleton } from "@/components/common/Skeleton";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";
import { notifyInfo, notifySuccess } from "@/utils/toast";
import { Button, Card } from "@/components/ui";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function ProductList() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const products = useAppSelector(selectAllProducts);
  const pagination = useAppSelector(selectProductPagination);
  const isLoading = useAppSelector(selectProductsLoading);
  const error = useAppSelector(selectProductsError);

  const category = searchParams.get("category");
  const query = searchParams.get("q");
  const fallbackProducts = [
    {
      id: 1,
      name: "Demo Product",
      brand: "Demo",
      base_price: 49.99,
      image_url: "https://via.placeholder.com/300x300?text=Demo+Product",
      variant_id: 1001,
      variants: [{ id: 1001 }],
    },
    {
      id: 2,
      name: "Demo Product 2",
      brand: "Demo",
      base_price: 79.99,
      image_url: "https://via.placeholder.com/300x300?text=Demo+Product+2",
      variant_id: 1002,
      variants: [{ id: 1002 }],
    },
  ];
  const displayProducts = products.length ? products : fallbackProducts;

  const loadProducts = useCallback(() => {
    if (query) {
      dispatch(
        searchProductsThunk({
          query,
          filters: category ? { category } : {},
        }),
      );
      return;
    }

    dispatch(fetchProductsThunk(category ? { category } : {}));
  }, [dispatch, category, query]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resolveVariantId = (product) => {
    if (product?.variant_id) return product.variant_id;
    if (product?.default_variant_id) return product.default_variant_id;
    if (Array.isArray(product?.variants) && product.variants.length > 0) {
      return product.variants[0]?.id;
    }
    return null;
  };

  const handleAddToCart = async (event, product) => {
    event.preventDefault();
    event.stopPropagation();

    const variantId = resolveVariantId(product);
    if (!variantId) {
      notifyInfo("Please open the product to choose a variant.");
      return;
    }

    const resultAction = await dispatch(
      addToCartThunk({
        variant_id: variantId,
        quantity: 1,
        product_name: product?.name,
        price: Number(product?.base_price ?? product?.price ?? 49.99),
      }),
    );

    if (addToCartThunk.fulfilled.match(resultAction)) {
      notifySuccess("Added to cart successfully");
    }
  };

  const handleRetry = () => {
    notifyInfo("Retrying product request...");
    loadProducts();
  };

  return (
    <div className="landing-container section-wrap">
      <div className="rounded-section border border-white/70 bg-white/80 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="tag-soft">
              <Search className="h-3.5 w-3.5" />
              Browse catalog
            </span>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {query
                ? `Results for "${query}"`
                : category
                  ? `${category} collection`
                  : "All products"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
              A cleaner browse view with stronger hierarchy, softer cards, and modern
              spacing to keep discovery feeling premium.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-sm font-medium text-slate-600">
              <SlidersHorizontal className="h-4 w-4 text-sky-600" />
              {pagination ? `${pagination.totalCount} items` : `${displayProducts.length} items`}
            </span>
            {category && <span className="pill pill-active">{category}</span>}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8">
          <ProductGridSkeleton count={8} />
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load products"
          message={error}
          onRetry={handleRetry}
          className="mt-8"
        />
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {displayProducts.map((product) => (
              <Card key={product.id} className="group flex h-full flex-col">
                <Link to={`/products/${product.id}`} className="block flex-1">
                  <div className="relative aspect-square overflow-hidden rounded-surface bg-slate-100">
                    <img
                      src={
                        resolveAssetUrl(product.image_url) ||
                        "https://via.placeholder.com/300x300?text=No+Image"
                      }
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute right-section top-section">
                      <WishlistButton productId={product.id} size="sm" />
                    </div>
                  </div>
                  <div className="mt-5 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {product.brand || "Featured brand"}
                    </p>
                    <h3 className="mt-3 line-clamp-2 font-heading text-xl font-semibold tracking-tight text-slate-950">
                      {product.name}
                    </h3>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xl font-bold text-slate-950">
                        {formatPrice(product.base_price ?? product.price ?? 0)}
                      </p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Ready to ship
                      </span>
                    </div>
                  </div>
                </Link>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-5 w-full"
                  onClick={(event) => handleAddToCart(event, product)}
                >
                  Add to Cart
                </Button>
              </Card>
            ))}
          </div>

          {!products.length && (
            <EmptyState
              title="No products found"
              message="Try changing category filters or search terms."
              actionLabel="Browse All Products"
              onAction={() => {
                window.location.href = "/products";
              }}
              className="mt-8"
            />
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-section">
              <Button
                variant="ghost"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set("page", String(pagination.page - 1));
                  window.location.search = newParams.toString();
                }}
              >
                Previous
              </Button>
              <span className="text-sm font-medium text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set("page", String(pagination.page + 1));
                  window.location.search = newParams.toString();
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
