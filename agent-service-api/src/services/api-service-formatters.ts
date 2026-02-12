import { extractByPath } from '@ibm-vibe/utils';

export const escapeForJsonTemplate = (value: string): string => {
	return JSON.stringify(value).slice(1, -1);
};

export const formatRequest = (input: string, template: string): any => {
	try {
		const escapedInput = escapeForJsonTemplate(input);
		const formattedTemplate = template.replace(/{{input}}/g, escapedInput);
		return JSON.parse(formattedTemplate);
	} catch {
		return { input };
	}
};

export const compareValues = (left: any, operator: string, right: any): boolean => {
	switch (operator) {
		case '==':
			return left == right;
		case '===':
			return left === right;
		case '!=':
			return left != right;
		case '!==':
			return left !== right;
		case '>':
			return left > right;
		case '>=':
			return left >= right;
		case '<':
			return left < right;
		case '<=':
			return left <= right;
		default:
			return false;
	}
};

export const formatConversationRequestWithVars = (
	currentInput: string,
	conversationHistory: string,
	template: string,
	variables: Record<string, any>
): any => {
	try {
		const escapedCurrentInput = escapeForJsonTemplate(currentInput);
		const escapedHistory = escapeForJsonTemplate(conversationHistory);

		let formatted = template
			.replace(/{{\s*input\s*}}/g, escapedCurrentInput)
			.replace(/{{\s*conversation_history\s*}}/g, escapedHistory);

		formatted = formatted.replace(/{{\s*([a-zA-Z0-9_.['"\]]+)\s*}}/g, (match, path: string) => {
			if (path === 'input' || path === 'conversation_history') {
				return match;
			}

			const value = extractByPath(variables, path);
			if (value === undefined || value === null) {
				return '';
			}

			if (typeof value === 'string') {
				return escapeForJsonTemplate(value);
			}
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		});

		return JSON.parse(formatted);
	} catch {
		return { input: currentInput, variables };
	}
};
