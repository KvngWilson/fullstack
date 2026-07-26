import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchProductsThunk } from "@/features/products/productsThunks";
import {
  selectAllProducts,
  selectProductsError,
  selectProductsLoading,
} from "@/features/products/productsSlice";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { ProductGridSkeleton } from "@/components/common/Skeleton";
import { Card } from "@/components/ui";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function CategoryPage() {
  const dispatch = useAppDispatch();
  const { slug } = useParams();
  const products = useAppSelector(selectAllProducts);
  const isLoading = useAppSelector(selectProductsLoading);
  const error = useAppSelector(selectProductsError);
  const isCategoryId = /^\d+$/.test(slug || "");

  useEffect(() => {
    if (!slug) return;
    dispatch(fetchProductsThunk(isCategoryId ? { category: slug } : {}));
  }, [dispatch, slug, isCategoryId]);

  const displayProducts = isCategoryId
    ? products
    : products.filter((product) => {
        const categoryName = (product.category_name || product.category || "")
          .toString()
          .toLowerCase();
        return categoryName === (slug || "").toLowerCase();
      });

  return (
    <div className="landing-container section-wrap">
      <div className="rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Category
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {slug}
        </h1>
      </div>

      {isLoading && (
        <div className="mt-8">
          <ProductGridSkeleton count={6} />
        </div>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title="Failed to load category products"
          message={error}
          onRetry={() => dispatch(fetchProductsThunk({ category: slug }))}
        />
      )}

      {!isLoading && !error && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayProducts.map((product) => (
            <Link key={product.id} to={`/products/${product.id}`} className="block">
              <Card className="h-full hover:-translate-y-1">
                <p className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
                  {product.name}
                </p>
                <p className="mt-3 text-sm text-slate-500">{product.brand || "No brand"}</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {formatPrice(product.min_price ?? product.base_price ?? product.price ?? 0)}
                </p>
              </Card>
            </Link>
          ))}

          {!displayProducts.length && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState
                title="No products in this category"
                message="Try a different category or browse all products."
                actionLabel="Browse all products"
                onAction={() => {
                  window.location.href = "/products";
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
