export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
	if (!value || !value.trim()) {
		return fallback;
	}
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
};

export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	return JSON.stringify(error);
};
