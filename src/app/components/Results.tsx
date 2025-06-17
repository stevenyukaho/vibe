import { InlineLoading, Pagination } from '@carbon/react';
import { Report } from '@carbon/icons-react';
import styles from '../page.module.scss';
import EmptyState from './EmptyState';
import TableRenderer from './TableRenderer';
import { useAgents, useTests } from '@/lib/AppDataContext';
import { TestResult } from '@/lib/api';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ResultsProps {
  onViewResult: (id: number) => void;
  onAddTestClick: () => void;
}

export default function Results({
  onViewResult,
  onAddTestClick
}: ResultsProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  
  const { agents } = useAgents();
  const { tests } = useTests();

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await api.getResultsWithCount({ 
        limit: pageSize, 
        offset: currentPage * pageSize 
      });
      setResults(response.data);
      setTotalItems(response.total);
    } catch (err: unknown) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  const resultRows = results.map((result) => ({
    id: result.id?.toString() || `result-${Date.now()}`,
    agent_name: agents.find(a => a.id === result.agent_id)?.name || 'Unknown',
    test_name: tests.find(t => t.id === result.test_id)?.name || 'Unknown',
    success: result.success,
    execution_time: result.execution_time ? result.execution_time.toFixed(3) : '0.000',
    similarity_score: result,
    created_at: new Date(result.created_at!).toLocaleString(),
  }));

  const resultHeaders = [
    { key: 'agent_name', header: 'Agent' },
    { key: 'test_name', header: 'Test' },
    { key: 'success', header: 'Success' },
    { key: 'execution_time', header: 'Time (s)' },
    { key: 'similarity_score', header: 'Similarity score' },
    { key: 'created_at', header: 'Created at' },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <>
      <div className={styles.panelHeader}>
        <h2>Results</h2>
      </div>
      {resultRows.length > 0 ? (
        <>
          <TableRenderer 
            headers={resultHeaders} 
            rows={resultRows} 
            type="result" 
            onView={onViewResult}
          />
          
          {/* Pagination */}
          {totalItems > 0 && (
            <Pagination
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizes={[10, 25, 50, 100]}
              page={currentPage + 1} // Carbon uses 1-based indexing
              onChange={({ page, pageSize: newPageSize }) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                  setCurrentPage(0);
                } else {
                  setCurrentPage(page - 1); // Convert back to 0-based indexing
                }
              }}
              backwardText="Previous page"
              forwardText="Next page"
              itemsPerPageText="Items per page:"
            />
          )}
        </>
      ) : loading ? (
        <InlineLoading description="Loading data..." />
      ) : (
        <EmptyState
          title="Test Results"
          description="Run tests against your agents to see results here."
          icon={Report}
          onAddClick={onAddTestClick}
        />
      )}
    </>
  );
}
