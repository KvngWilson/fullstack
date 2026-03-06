import { useTranslation } from 'react-i18next';

export default function ResetPassword() {
	const { t } = useTranslation();

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold">{t('auth.resetPassword.title')}</h1>
		</div>
	);
}
