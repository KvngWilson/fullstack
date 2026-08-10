import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchWishlistThunk } from "@/features/wishlist/wishlistThunks";
import {
  selectWishlistItems,
  selectWishlistError,
  selectWishlistIsLoading,
} from "@/features/wishlist/wishlistSelectors";
import AccountHeader from "@/components/layout/AccountHeader";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Card } from "@/components/ui";
import { getStoredCurrency } from "@/preferences";
import { formatPrice } from "@/utils/format";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

export default function Wishlist() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectWishlistItems);
  const isLoading = useAppSelector(selectWishlistIsLoading);
  const error = useAppSelector(selectWishlistError);
  const { t } = useAppPreferences();

  const currency = getStoredCurrency();

  useEffect(() => {
    dispatch(fetchWishlistThunk());
  }, [dispatch]);

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("wishlist.title")}
        description="Keep your favorite finds close by with a cleaner saved-items experience."
        badge="Saved products"
        stats={[{ label: "Wishlist items", value: String(items.length) }]}
      />

      {isLoading && (
        <Card className="mt-8">
          <TextBlockSkeleton />
        </Card>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title={t("wishlist.failedLoad")}
          message={error}
          onRetry={() => dispatch(fetchWishlistThunk())}
        />
      )}

      {!isLoading && !error && (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entry) => {
            const product = entry.product || entry;
            return (
              <Link key={entry.id || product.id} to={`/products/${product.id}`} className="block">
                <Card className="h-full hover:-translate-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                    Saved for later
                  </p>
                  <p className="mt-3 font-heading text-2xl font-semibold tracking-tight text-slate-950">
                    {product.name}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    {formatPrice(Number(product.price || product.base_price || 0), currency)}
                  </p>
                </Card>
              </Link>
            );
          })}

          {!items.length && (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                title={t("wishlist.emptyTitle")}
                message={t("wishlist.emptyMessage")}
                actionLabel="Explore products"
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
