import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchProductsThunk } from '@/features/products/productsThunks';
import {
  selectProducts,
  selectProductsError,
  selectProductsIsLoading,
} from '@/features/products/productsSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { ProductGridSkeleton } from '@/components/common/Skeleton';

export default function CategoryPage() {
  const dispatch = useAppDispatch();
  const { slug } = useParams();
  const products = useAppSelector(selectProducts);
  const isLoading = useAppSelector(selectProductsIsLoading);
  const error = useAppSelector(selectProductsError);

  useEffect(() => {
    if (!slug) return;
    dispatch(fetchProductsThunk({ category: slug }));
  }, [dispatch, slug]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Category: {slug}</h1>

      {isLoading && (
        <div className="mt-6">
          <ProductGridSkeleton count={6} />
        </div>
      )}

      {error && (
        <ErrorState
          className="mt-4"
          title="Failed to load category products"
          message={error}
          onRetry={() => dispatch(fetchProductsThunk({ category: slug }))}
        />
      )}

      {!isLoading && !error && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="rounded-md border p-3 hover:bg-accent"
            >
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.brand || 'No brand'}</p>
              <p className="text-sm text-muted-foreground">${product.base_price ?? product.price ?? 0}</p>
            </Link>
          ))}

          {!products.length && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState
                title="No products in this category"
                message="Try a different category or browse all products."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
