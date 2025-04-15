import { InlineLoading } from '@carbon/react';
import { Report } from '@carbon/icons-react';
import styles from '../page.module.scss';
import EmptyState from './EmptyState';
import TableRenderer from './TableRenderer';
import { useResults, useAgents, useTests } from '@/lib/AppDataContext';

interface ResultsProps {
  onViewResult: (id: number) => void;
  onAddTestClick: () => void;
}

export default function Results({
  onViewResult,
  onAddTestClick
}: ResultsProps) {
  // Get data from context
  const { results, isLoading } = useResults();
  const { agents } = useAgents();
  const { tests } = useTests();

  const resultRows = results.map((result) => ({
    id: result.id?.toString() || `result-${Date.now()}`,
    agent_name: agents.find(a => a.id === result.agent_id)?.name || 'Unknown',
    test_name: tests.find(t => t.id === result.test_id)?.name || 'Unknown',
    success: result.success,
    execution_time: result.execution_time ? result.execution_time.toFixed(3) : '0.000',
    created_at: new Date(result.created_at!).toLocaleString(),
  }));

  const resultHeaders = [
    { key: 'agent_name', header: 'Agent' },
    { key: 'test_name', header: 'Test' },
    { key: 'success', header: 'Success' },
    { key: 'execution_time', header: 'Time (s)' },
    { key: 'created_at', header: 'Created At' },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <>
      <div className={styles.panelHeader}>
        <h2>Results</h2>
      </div>
      {isLoading ? (
        <InlineLoading description="Loading data..." />
      ) : resultRows.length > 0 ? (
        <TableRenderer 
          headers={resultHeaders} 
          rows={resultRows} 
          type="result" 
          onView={onViewResult}
        />
      ) : (
        <EmptyState
          title="Test Results"
          description="Run tests against your agents to see results here."
          icon={Report as React.ComponentType<{ size: number; className?: string }>}
          onAddClick={onAddTestClick}
        />
      )}
    </>
  );
}
