import { Router } from 'express';
import crudRoutes from './agents/crud-routes';
import templatesRoutes from './agents/templates-routes';
import responseMapsRoutes from './agents/response-maps-routes';

const router = Router();

const mergeRouteStack = (target: Router, source: Router) => {
	for (const layer of (source as any).stack || []) {
		(target as any).stack.push(layer);
	}
};

// Flatten sub-router layers into the parent stack so existing route-surface tests
// can continue to introspect concrete paths from a single router instance.
mergeRouteStack(router, crudRoutes);
mergeRouteStack(router, templatesRoutes);
mergeRouteStack(router, responseMapsRoutes);

export default router;
