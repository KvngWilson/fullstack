import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchWishlistThunk } from '@/features/wishlist/wishlistThunks';
import {
	selectWishlistItems,
	selectWishlistError,
	selectWishlistIsLoading,
} from '@/features/wishlist/wishlistSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';
import { getStoredCurrency } from '@/preferences';
import { formatPrice } from '@/utils/format';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

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
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">{t('wishlist.title')}</h1>

			{isLoading && (
				<div className="mt-4 space-y-3">
					<TextBlockSkeleton />
					<TextBlockSkeleton />
				</div>
			)}
			{error && <ErrorState className="mt-4" title={t('wishlist.failedLoad')} message={error} onRetry={() => dispatch(fetchWishlistThunk())} />}

			{!isLoading && !error && (
				<div className="mt-4 space-y-3">
					{items.map((entry) => {
						const product = entry.product || entry;
						return (
							<Link
								key={entry.id || product.id}
								to={`/products/${product.id}`}
								className="block rounded-md border p-3 hover:bg-accent"
							>
								<p className="font-medium">{product.name}</p>
								<p className="text-sm text-muted-foreground">
									{formatPrice(Number(product.price || 0), currency)}
								</p>
							</Link>
						);
					})}

					{!items.length && (
						<EmptyState
							title={t('wishlist.emptyTitle')}
							message={t('wishlist.emptyMessage')}
						/>
					)}
				</div>
			)}
		</div>
	);
}
