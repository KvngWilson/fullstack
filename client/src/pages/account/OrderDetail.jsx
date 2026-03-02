import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { useParams } from 'react-router-dom';
import { fetchOrderByIdThunk, trackOrderThunk } from '@/features/orders/ordersThunks';
import {
  selectCurrentOrder,
  selectOrderTrackingById,
  selectOrdersError,
  selectOrdersIsLoading,
} from '@/features/orders/ordersSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';

export default function OrderDetail() {
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const order = useAppSelector(selectCurrentOrder);
  const trackingByOrderId = useAppSelector(selectOrderTrackingById);
  const isLoading = useAppSelector(selectOrdersIsLoading);
  const error = useAppSelector(selectOrdersError);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchOrderByIdThunk(Number(id)));
    dispatch(trackOrderThunk(Number(id)));
  }, [dispatch, id]);

  const tracking = id ? trackingByOrderId[id] || trackingByOrderId[Number(id)] : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Order Detail</h1>

      {isLoading && (
        <div className="mt-4">
          <TextBlockSkeleton />
        </div>
      )}
      {error && <ErrorState className="mt-4" title="Failed to load order" message={error} onRetry={() => dispatch(fetchOrderByIdThunk(Number(id)))} />}

      {!isLoading && !error && order && (
        <div className="mt-4 rounded-md border p-4">
          <p className="font-medium">Order #{order.id}</p>
          <p className="mt-1 text-sm text-muted-foreground">Status: {order.status || 'pending'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Total: ${order.total_amount ?? order.net_amount ?? 0}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Created: {order.created_at || 'N/A'}</p>

          {tracking && (
            <div className="mt-4 rounded-md border p-3">
              <p className="font-medium">Tracking</p>
              <p className="mt-1 text-sm text-muted-foreground">Status: {tracking.status || 'N/A'}</p>
              {tracking.tracking_url && (
                <a
                  href={tracking.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm underline"
                >
                  Open tracking link
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && !order && (
        <EmptyState title="Order not found" message="We couldn’t find this order in your account." className="mt-4" />
      )}
    </div>
  );
}
