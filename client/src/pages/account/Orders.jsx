import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchOrdersThunk } from '@/features/orders/ordersThunks';
import {
  selectOrders,
  selectOrdersError,
  selectOrdersIsLoading,
  selectOrdersPagination,
} from '@/features/orders/ordersSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';

export default function Orders() {
  const dispatch = useAppDispatch();
  const orders = useAppSelector(selectOrders);
  const pagination = useAppSelector(selectOrdersPagination);
  const isLoading = useAppSelector(selectOrdersIsLoading);
  const error = useAppSelector(selectOrdersError);

  useEffect(() => {
    dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }));
  }, [dispatch]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Orders</h1>

      {isLoading && (
        <div className="mt-4 space-y-4">
          <TextBlockSkeleton />
          <TextBlockSkeleton />
        </div>
      )}
      {error && <ErrorState className="mt-4" title="Failed to load orders" message={error} onRetry={() => dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }))} />}

      {!isLoading && !error && (
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/account/orders/${order.id}`}
              className="block rounded-md border p-3 hover:bg-accent"
            >
              <p className="font-medium">Order #{order.id}</p>
              <p className="text-sm text-muted-foreground">
                Status: {order.status || 'pending'} · Total: ${order.total_amount ?? 0}
              </p>
            </Link>
          ))}

          {!orders.length && (
            <EmptyState
              title="No orders yet"
              message="Your purchases will appear here once you place an order."
            />
          )}

          {pagination && (
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
