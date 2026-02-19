import { redirect } from 'next/navigation';

interface SuitesAliasDetailPageProps {
	params: {
		id: string;
	};
}

export default function SuitesAliasDetailPage({ params }: SuitesAliasDetailPageProps) {
	redirect(`/test-suites/${params.id}`);
}
