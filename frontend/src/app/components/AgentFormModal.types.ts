export interface RequestTemplate {
	id?: number;
	name: string;
	description?: string;
	body: string;
	is_default?: boolean;
	capabilities?: string;
	_isNew?: boolean;
	_isEditing?: boolean;
	_isDeleted?: boolean;
}

export interface ResponseMap {
	id?: number;
	name: string;
	description?: string;
	spec: string;
	is_default?: boolean;
	capabilities?: string;
	_isNew?: boolean;
	_isEditing?: boolean;
	_isDeleted?: boolean;
}

export interface TestConnectionStatus {
	loading: boolean;
	success?: boolean;
	message?: string;
}
