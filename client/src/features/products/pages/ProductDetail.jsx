import { createElement, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, Star, Truck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchProductByIdThunk } from "@/features/products/productsThunks";
import { addToCartThunk } from "@/features/cart/cartThunks";
import {
  selectCurrentProduct,
  selectProductsError,
  selectProductsLoading,
} from "@/features/products/productsSlice";
import { selectCartIsLoading } from "@/features/cart/cartSelectors";
import WishlistButton from "@/features/wishlist/components/WishlistButton";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { Skeleton, TextBlockSkeleton } from "@/components/common/Skeleton";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";
import { notifySuccess } from "@/utils/toast";
import { Button, Card, Input } from "@/components/ui";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const purchaseHighlights = [
  { icon: Truck, label: "Fast shipping available" },
  { icon: ShieldCheck, label: "Secure checkout" },
  { icon: Star, label: "Premium storefront presentation" },
];

export default function ProductDetail() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const product = useAppSelector(selectCurrentProduct);
  const isLoading = useAppSelector(selectProductsLoading);
  const isCartLoading = useAppSelector(selectCartIsLoading);
  const error = useAppSelector(selectProductsError);
  const displayProduct = useMemo(
    () =>
      product ||
      (!isLoading
        ? {
            id: Number(id) || 1,
            name: "Demo Product",
            brand: "Demo",
            description: "Demo product description.",
            base_price: 49.99,
            image_url: "https://via.placeholder.com/600x600?text=Demo+Product",
            variants: [{ id: 1001, sku: "DEMO-1001" }],
          }
        : null),
    [id, isLoading, product],
  );

  const defaultVariantId = useMemo(() => {
    if (!displayProduct?.variants?.length) return null;
    return displayProduct.variants[0]?.id || null;
  }, [displayProduct]);

  useEffect(() => {
    if (!id || Number.isNaN(Number(id))) return;
    dispatch(fetchProductByIdThunk(Number(id)));
  }, [dispatch, id]);

  const handleAddToCart = async () => {
    if (!defaultVariantId) return;

    const resultAction = await dispatch(
      addToCartThunk({
        variant_id: defaultVariantId,
        quantity: Math.max(1, Number(quantity) || 1),
        product_name: displayProduct?.name,
        price: Number(
          displayProduct?.base_price ?? displayProduct?.price ?? 49.99,
        ),
      }),
    );

    if (addToCartThunk.fulfilled.match(resultAction)) {
      notifySuccess("Added to cart successfully");
    }
  };

  return (
    <div className="landing-container section-wrap">
      {isLoading && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <Skeleton className="h-130 w-full rounded-section" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4 rounded-full" />
            <Skeleton className="h-12 w-2/3 rounded-full" />
            <Skeleton className="h-10 w-1/3 rounded-full" />
            <TextBlockSkeleton />
          </div>
        </div>
      )}

      {error && (
        <ErrorState
          title="Failed to load product"
          message={error}
          onRetry={() => dispatch(fetchProductByIdThunk(Number(id)))}
        />
      )}

      {!isLoading && displayProduct && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <Card padding="none" className="overflow-hidden">
            <div className="relative h-full min-h-110 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)]">
              <img
                src={
                  resolveAssetUrl(displayProduct.image_url) ||
                  "https://via.placeholder.com/600x600?text=No+Image"
                }
                alt={displayProduct.name}
                className="h-full w-full object-cover"
              />
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <div className="rounded-section border border-white/70 bg-white/80 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {displayProduct.brand || "Featured brand"}
                  </p>
                  <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950">
                    {displayProduct.name}
                  </h1>
                </div>
                <WishlistButton productId={displayProduct.id} size="lg" />
              </div>

              <p className="mt-5 text-3xl font-bold text-slate-950">
                {formatPrice(
                  displayProduct.base_price ?? displayProduct.price ?? 0,
                )}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {purchaseHighlights.map(({ icon, label }) => (
                  <div
                    key={label}
                    className="rounded-card border border-slate-100 bg-slate-50/90 px-4 py-4 text-sm font-medium text-slate-600"
                  >
                    {createElement(icon, {
                      className: "mb-3 h-4 w-4 text-sky-600",
                    })}
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-8 text-slate-500">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Description
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {displayProduct.description || "No description available."}
                </p>
              </div>

              {displayProduct.variants &&
                displayProduct.variants.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Available variants
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-sm">
                      {displayProduct.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          {variant.sku}
                          {variant.price && ` - ${formatPrice(variant.price)}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {defaultVariantId ? (
              <Card className="mt-auto">
                <div className="flex flex-wrap items-end gap-section">
                  <div>
                    <label
                      htmlFor="quantity"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Quantity
                    </label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="w-24"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="mt-auto"
                    onClick={handleAddToCart}
                    disabled={isCartLoading}
                  >
                    {isCartLoading ? "Adding..." : "Add to Cart"}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="rounded-section border border-amber-100 bg-amber-50/90 p-5 text-sm text-amber-900">
                This product is not available for purchase yet (no variants
                available).
              </div>
            )}

            <Card variant="outline">
              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span>SKU</span>
                  <span className="font-medium text-slate-900">
                    {displayProduct.sku || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Category</span>
                  <span className="font-medium text-slate-900">
                    {displayProduct.category || "Uncategorized"}
                  </span>
                </div>
                {displayProduct.weight && (
                  <div className="flex justify-between gap-4">
                    <span>Weight</span>
                    <span className="font-medium text-slate-900">
                      {displayProduct.weight} lbs
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {!isLoading && !displayProduct && (
        <EmptyState
          title="Product not found"
          message="The item may have been removed or is no longer available."
          actionLabel="Browse all products"
          onAction={() => navigate("/products")}
        />
      )}
    </div>
  );
}
