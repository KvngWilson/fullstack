import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { searchProductsThunk } from '@/features/products/productsThunks';
import {
  selectProducts,
  selectProductsError,
  selectProductsIsLoading,
  selectProductsPagination,
} from '@/features/products/productsSelectors';

export default function SearchResults() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const products = useAppSelector(selectProducts);
  const pagination = useAppSelector(selectProductsPagination);
  const isLoading = useAppSelector(selectProductsIsLoading);
  const error = useAppSelector(selectProductsError);

  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (!query.trim()) return;
    dispatch(searchProductsThunk({ query }));
  }, [dispatch, query]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Search Results</h1>
      <p className="mt-2 text-sm text-muted-foreground">Query: {query || 'N/A'}</p>

      {!query.trim() && (
        <p className="mt-4 text-sm text-muted-foreground">Provide a search term using ?q=...</p>
      )}

      {query.trim() && isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Searching products...</p>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {query.trim() && !isLoading && !error && (
        <>
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
          </div>

          {!products.length && <p className="mt-4 text-sm text-muted-foreground">No results found.</p>}

          {pagination && (
            <p className="mt-4 text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} total
            </p>
          )}
        </>
      )}
    </div>
  );
}
