import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { trackOrderThunk } from '@/features/orders/ordersThunks';
import { selectOrderTrackingById, selectOrdersError, selectOrdersIsLoading } from '@/features/orders/ordersSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

export default function OrderTracking() {
	const dispatch = useAppDispatch();
	const { id } = useParams();
	const trackingByOrderId = useAppSelector(selectOrderTrackingById);
	const isLoading = useAppSelector(selectOrdersIsLoading);
	const error = useAppSelector(selectOrdersError);
	const { t } = useAppPreferences();

	useEffect(() => {
		if (!id) return;
		dispatch(trackOrderThunk(Number(id)));
	}, [dispatch, id]);

	const tracking = id ? trackingByOrderId[id] || trackingByOrderId[Number(id)] : null;

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">{t('orderTracking.title')}</h1>

			{isLoading && (
				<div className="mt-4">
					<TextBlockSkeleton />
				</div>
			)}
			{error && <ErrorState className="mt-4" title={t('orderTracking.failedLoad')} message={error} onRetry={() => dispatch(trackOrderThunk(Number(id)))} />}

			{!isLoading && !error && tracking && (
				<div className="mt-4 rounded-md border p-4">
					<p className="font-medium">{t('orders.orderNumber', { id })}</p>
					<p className="mt-1 text-sm text-muted-foreground">{t('orderTracking.status', { status: tracking.status || t('common.notAvailable') })}</p>
					<p className="mt-1 text-sm text-muted-foreground">{t('orderTracking.lastUpdate', { lastUpdate: tracking.updated_at || t('common.notAvailable') })}</p>
					{tracking.tracking_url && (
						<a
							href={tracking.tracking_url}
							target="_blank"
							rel="noreferrer"
							className="mt-2 inline-block text-sm underline"
						>
							{t('orderTracking.openCarrierLink')}
						</a>
					)}
					<Link to={`/account/orders/${id}`} className="mt-2 block text-sm underline">
						{t('orderTracking.backToOrder')}
					</Link>
				</div>
			)}

			{!isLoading && !error && !tracking && (
				<EmptyState
					className="mt-4"
					title={t('orderTracking.notFoundTitle')}
					message={t('orderTracking.notFoundMessage')}
				/>
			)}
		</div>
	);
}
