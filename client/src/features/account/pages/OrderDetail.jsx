import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { Link, useParams } from 'react-router-dom';
import { fetchOrderByIdThunk, trackOrderThunk } from '@/features/orders/ordersThunks';
import {
	selectCurrentOrder,
	selectOrderTrackingById,
	selectOrdersError,
	selectOrdersIsLoading,
} from '@/features/orders/ordersSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';
import { paymentsService } from '@/services/api/paymentsService';
import { getStoredCurrency } from '@/preferences';
import { formatPrice } from '@/utils/format';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

export default function OrderDetail() {
	const dispatch = useAppDispatch();
	const { id } = useParams();
	const order = useAppSelector(selectCurrentOrder);
	const trackingByOrderId = useAppSelector(selectOrderTrackingById);
	const isLoading = useAppSelector(selectOrdersIsLoading);
	const error = useAppSelector(selectOrdersError);
	const [paymentStatus, setPaymentStatus] = useState('');
	const { t } = useAppPreferences();

	const currency = getStoredCurrency();

	useEffect(() => {
		if (!id) return;
		dispatch(fetchOrderByIdThunk(Number(id)));
		dispatch(trackOrderThunk(Number(id)));
	}, [dispatch, id]);

	useEffect(() => {
		let isActive = true;

		const loadPaymentStatus = async () => {
			if (!id) {
				if (isActive) setPaymentStatus('');
				return;
			}

			try {
				const latestPayment = await paymentsService.getLatestPaymentForOrder(Number(id));
				if (!isActive) return;
				setPaymentStatus(latestPayment?.status || '');
			} catch {
				if (isActive) {
					setPaymentStatus('');
				}
			}
		};

		loadPaymentStatus();

		return () => {
			isActive = false;
		};
	}, [id]);

	const tracking = id ? trackingByOrderId[id] || trackingByOrderId[Number(id)] : null;

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">{t('orderDetail.title')}</h1>

			{isLoading && (
				<div className="mt-4">
					<TextBlockSkeleton />
				</div>
			)}
			{error && <ErrorState className="mt-4" title={t('orderDetail.failedLoad')} message={error} onRetry={() => dispatch(fetchOrderByIdThunk(Number(id)))} />}

			{!isLoading && !error && order && (
				<div className="mt-4 rounded-md border p-4">
					<p className="font-medium">{t('orders.orderNumber', { id: order.id })}</p>
					<p className="mt-1 text-sm text-muted-foreground">{t('orderDetail.status', { status: order.status || t('common.pending') })}</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{t('orderDetail.payment', {
							payment: paymentStatus || order.payment_status || t('common.pending'),
						})}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{t('orderDetail.total', {
							total: formatPrice(Number(order.total_amount ?? order.net_amount ?? order.total ?? 0), currency),
						})}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">{t('orderDetail.created', { created: order.created_at || t('common.notAvailable') })}</p>

					{tracking && (
						<div className="mt-4 rounded-md border p-3">
							<p className="font-medium">{t('orderDetail.tracking')}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t('orderDetail.trackingStatus', { status: tracking.status || t('common.notAvailable') })}</p>
							{tracking.tracking_url && (
								<a
									href={tracking.tracking_url}
									target="_blank"
									rel="noreferrer"
									className="mt-2 inline-block text-sm underline"
								>
									{t('orderDetail.openTrackingLink')}
								</a>
							)}
							{id && (
								<Link to={`/account/orders/${id}/tracking`} className="mt-2 block text-sm underline">
									{t('orderDetail.openFullTrackingPage')}
								</Link>
							)}
						</div>
					)}
				</div>
			)}

			{!isLoading && !error && !order && (
				<EmptyState title={t('orderDetail.notFoundTitle')} message={t('orderDetail.notFoundMessage')} className="mt-4" />
			)}
		</div>
	);
}
