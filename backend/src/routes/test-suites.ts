import { Router } from 'express';
import crudRoutes from './test-suites/crud-routes';
import testsRoutes from './test-suites/tests-routes';
import entriesRoutes from './test-suites/entries-routes';

const router = Router();

const mergeRouteStack = (target: Router, source: Router) => {
	for (const layer of (source as any).stack || []) {
		(target as any).stack.push(layer);
	}
};

// Flatten sub-router layers into the parent stack so existing route-surface tests
// can continue to introspect concrete paths from a single router instance.
mergeRouteStack(router, crudRoutes);
mergeRouteStack(router, testsRoutes);
mergeRouteStack(router, entriesRoutes);

export default router;
