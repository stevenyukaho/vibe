export const shouldLog = process.env.NODE_ENV !== 'test';

export const logError = (...args: unknown[]) => {
	/* istanbul ignore next */
	if (shouldLog) console.error(...args);
};

export const logWarn = (...args: unknown[]) => {
	/* istanbul ignore next */
	if (shouldLog) console.warn(...args);
};
