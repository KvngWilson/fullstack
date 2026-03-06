import { useEffect, useMemo, useState } from 'react';
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
import { paymentsService } from '@/services/api/paymentsService';
import { getStoredCurrency } from '@/preferences';
import { formatPrice } from '@/utils/format';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

export default function Orders() {
	const dispatch = useAppDispatch();
	const orders = useAppSelector(selectOrders);
	const pagination = useAppSelector(selectOrdersPagination);
	const isLoading = useAppSelector(selectOrdersIsLoading);
	const error = useAppSelector(selectOrdersError);
	const [paymentStatusByOrderId, setPaymentStatusByOrderId] = useState({});
	const { t } = useAppPreferences();

	const currency = getStoredCurrency();

	const visibleOrderIds = useMemo(
		() => orders.map((order) => Number(order.id)).filter((id) => Number.isFinite(id)),
		[orders],
	);

	useEffect(() => {
		dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }));
	}, [dispatch]);

	useEffect(() => {
		let isActive = true;

		const loadPaymentStatuses = async () => {
			if (!visibleOrderIds.length) {
				if (isActive) {
					setPaymentStatusByOrderId({});
				}
				return;
			}

			try {
				const payments = await paymentsService.listPayments({ page: 1, pageSize: 100 });

				if (!isActive) return;

				const statuses = {};
				payments.forEach((payment) => {
					const orderId = Number(payment.order_id);
					if (!visibleOrderIds.includes(orderId)) return;

					const createdAt = new Date(payment.created_at || 0).getTime();
					const current = statuses[orderId];

					if (!current || createdAt > current.createdAt) {
						statuses[orderId] = {
							status: payment.status || 'pending',
							createdAt,
						};
					}
				});

				const normalized = Object.entries(statuses).reduce((acc, [orderId, value]) => {
					acc[orderId] = value.status;
					return acc;
				}, {});

				setPaymentStatusByOrderId(normalized);
			} catch {
				if (isActive) {
					setPaymentStatusByOrderId({});
				}
			}
		};

		loadPaymentStatuses();

		return () => {
			isActive = false;
		};
	}, [visibleOrderIds]);

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">{t('orders.title')}</h1>

			{isLoading && (
				<div className="mt-4 space-y-4">
					<TextBlockSkeleton />
					<TextBlockSkeleton />
				</div>
			)}
			{error && <ErrorState className="mt-4" title={t('orders.failedLoad')} message={error} onRetry={() => dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }))} />}

			{!isLoading && !error && (
				<div className="mt-4 space-y-3">
					{orders.map((order) => (
						<Link
							key={order.id}
							to={`/account/orders/${order.id}`}
							className="block rounded-md border p-3 hover:bg-accent"
						>
							<p className="font-medium">{t('orders.orderNumber', { id: order.id })}</p>
							<p className="text-sm text-muted-foreground">
								{t('orders.statusLine', {
									status: order.status || t('common.pending'),
									payment: paymentStatusByOrderId[order.id] || order.payment_status || t('common.pending'),
									total: formatPrice(Number(order.total_amount ?? order.total ?? 0), currency),
								})}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">{t('orders.trackHint', { id: order.id })}</p>
						</Link>
					))}

					{!orders.length && (
						<EmptyState
							title={t('orders.noOrdersTitle')}
							message={t('orders.noOrdersMessage')}
						/>
					)}

					{pagination && (
						<p className="text-sm text-muted-foreground">
							{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
