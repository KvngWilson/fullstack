import { useState } from 'react';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

const initialAddress = {
	fullName: '',
	line1: '',
	line2: '',
	city: '',
	state: '',
	postalCode: '',
	country: '',
	phone: '',
};

export default function Addresses() {
	const { t } = useAppPreferences();
	const [addresses, setAddresses] = useState([]);
	const [form, setForm] = useState(initialAddress);
	const [editingId, setEditingId] = useState(null);

	const onChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const resetForm = () => {
		setForm(initialAddress);
		setEditingId(null);
	};

	const handleSubmit = (event) => {
		event.preventDefault();

		if (editingId) {
			setAddresses((prev) =>
				prev.map((address) =>
					address.id === editingId
						? {
								...address,
								...form,
							}
						: address,
				),
			);
			resetForm();
			return;
		}

		setAddresses((prev) => [
			...prev,
			{
				id: Date.now(),
				...form,
			},
		]);
		resetForm();
	};

	const handleEdit = (address) => {
		setEditingId(address.id);
		setForm({
			fullName: address.fullName,
			line1: address.line1,
			line2: address.line2,
			city: address.city,
			state: address.state,
			postalCode: address.postalCode,
			country: address.country,
			phone: address.phone,
		});
	};

	const handleDelete = (addressId) => {
		setAddresses((prev) => prev.filter((address) => address.id !== addressId));
		if (editingId === addressId) {
			resetForm();
		}
	};

	return (
		<div className="mx-auto max-w-4xl px-4 py-8">
			<h1 className="text-3xl font-bold">{t('addresses.title')}</h1>
			<p className="mt-2 text-muted-foreground">{t('addresses.subtitle')}</p>

			<div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
				<form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 shadow-sm">
					<h2 className="text-xl font-semibold">
						{editingId ? t('addresses.editAddress') : t('addresses.addAddress')}
					</h2>

					<div className="mt-5 grid gap-4">
						<label className="space-y-1">
							<span className="text-sm font-medium">{t('addresses.fields.fullName')}</span>
							<input
								type="text"
								name="fullName"
								value={form.fullName}
								onChange={onChange}
								className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								required
							/>
						</label>

						<label className="space-y-1">
							<span className="text-sm font-medium">{t('addresses.fields.line1')}</span>
							<input
								type="text"
								name="line1"
								value={form.line1}
								onChange={onChange}
								className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								required
							/>
						</label>

						<label className="space-y-1">
							<span className="text-sm font-medium">{t('addresses.fields.line2')}</span>
							<input
								type="text"
								name="line2"
								value={form.line2}
								onChange={onChange}
								className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</label>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className="space-y-1">
								<span className="text-sm font-medium">{t('addresses.fields.city')}</span>
								<input
									type="text"
									name="city"
									value={form.city}
									onChange={onChange}
									className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
									required
								/>
							</label>

							<label className="space-y-1">
								<span className="text-sm font-medium">{t('addresses.fields.state')}</span>
								<input
									type="text"
									name="state"
									value={form.state}
									onChange={onChange}
									className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								/>
							</label>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className="space-y-1">
								<span className="text-sm font-medium">{t('addresses.fields.postalCode')}</span>
								<input
									type="text"
									name="postalCode"
									value={form.postalCode}
									onChange={onChange}
									className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
									required
								/>
							</label>

							<label className="space-y-1">
								<span className="text-sm font-medium">{t('addresses.fields.country')}</span>
								<input
									type="text"
									name="country"
									value={form.country}
									onChange={onChange}
									className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
									required
								/>
							</label>
						</div>

						<label className="space-y-1">
							<span className="text-sm font-medium">{t('addresses.fields.phone')}</span>
							<input
								type="tel"
								name="phone"
								value={form.phone}
								onChange={onChange}
								className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</label>
					</div>

					<div className="mt-6 flex flex-wrap gap-3">
						<button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
							{editingId ? t('addresses.actions.update') : t('addresses.actions.save')}
						</button>
						{editingId ? (
							<button
								type="button"
								onClick={resetForm}
								className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
							>
								{t('addresses.actions.cancel')}
							</button>
						) : null}
					</div>
				</form>

				<section className="rounded-lg border border-border bg-card p-6 shadow-sm">
					<h2 className="text-xl font-semibold">{t('addresses.savedAddresses')}</h2>

					{addresses.length === 0 ? (
						<p className="mt-4 text-sm text-muted-foreground">{t('addresses.empty')}</p>
					) : (
						<ul className="mt-4 space-y-3">
							{addresses.map((address) => (
								<li key={address.id} className="rounded-md border border-border bg-background p-4">
									<p className="font-medium">{address.fullName}</p>
									<p className="text-sm text-muted-foreground">{address.line1}</p>
									{address.line2 ? <p className="text-sm text-muted-foreground">{address.line2}</p> : null}
									<p className="text-sm text-muted-foreground">
										{address.city}, {address.state} {address.postalCode}
									</p>
									<p className="text-sm text-muted-foreground">{address.country}</p>
									{address.phone ? <p className="text-sm text-muted-foreground">{address.phone}</p> : null}

									<div className="mt-3 flex gap-3">
										<button
											type="button"
											onClick={() => handleEdit(address)}
											className="text-sm font-medium text-primary hover:underline"
										>
											{t('addresses.actions.edit')}
										</button>
										<button
											type="button"
											onClick={() => handleDelete(address.id)}
											className="text-sm font-medium text-destructive hover:underline"
										>
											{t('addresses.actions.delete')}
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}
