import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { searchProductsThunk } from "@/features/products/productsThunks";
import {
  selectAllProducts,
  selectProductsError,
  selectProductsLoading,
  selectProductPagination,
} from "@/features/products/productsSlice";
import { ProductGridSkeleton } from "@/components/common/Skeleton";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { notifyInfo } from "@/utils/toast";
import { Card } from "@/components/ui";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function SearchResults() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const products = useAppSelector(selectAllProducts);
  const pagination = useAppSelector(selectProductPagination);
  const isLoading = useAppSelector(selectProductsLoading);
  const error = useAppSelector(selectProductsError);

  const query = searchParams.get("q") || "";

  useEffect(() => {
    if (!query.trim()) return;
    dispatch(searchProductsThunk({ query }));
  }, [dispatch, query]);

  const handleRetry = () => {
    if (!query.trim()) return;
    notifyInfo("Retrying search...");
    dispatch(searchProductsThunk({ query }));
  };

  return (
    <div className="landing-container section-wrap">
      <div className="rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Search
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Results for {query || "—"}
        </h1>
      </div>

      {!query.trim() && (
        <p className="mt-8 text-sm text-slate-500">Provide a search term using ?q=...</p>
      )}

      {query.trim() && isLoading && (
        <div className="mt-8">
          <ProductGridSkeleton count={6} />
        </div>
      )}

      {error && (
        <ErrorState
          title="Search failed"
          message={error}
          onRetry={handleRetry}
          className="mt-8"
        />
      )}

      {query.trim() && !isLoading && !error && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`} className="block">
                <Card className="h-full hover:-translate-y-1">
                  <p className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
                    {product.name}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">{product.brand || "No brand"}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {formatPrice(product.base_price ?? product.price ?? 0)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          {!products.length && (
            <EmptyState
              title="No search results"
              message={`No products matched "${query}". Try a different keyword.`}
              className="mt-8"
            />
          )}

          {pagination && (
            <p className="mt-6 text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} total
            </p>
          )}
        </>
      )}
    </div>
  );
}
