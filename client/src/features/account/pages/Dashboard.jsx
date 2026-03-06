import { Link } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { selectUser } from '@/features/auth/authSelectors';

export default function Dashboard() {
	const user = useAppSelector(selectUser);

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">Welcome</h1>
			<p className="mt-2 text-muted-foreground">
				{user?.email ? `Signed in as ${user.email}` : 'You are signed in.'}
			</p>
			<div className="mt-6 flex gap-3">
				<Link to="/products" className="btn-primary">Shop</Link>
				<Link to="/account/orders" className="btn-ghost">View Orders</Link>
			</div>
		</div>
	);
}
