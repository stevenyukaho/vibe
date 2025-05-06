import { Button, InlineLoading } from '@carbon/react';
import { Add, TestTool } from '@carbon/icons-react';
import styles from '../page.module.scss';
import EmptyState from './EmptyState';
import TableRenderer from './TableRenderer';
import { useTests } from '@/lib/AppDataContext';
import { useRouter } from 'next/navigation';

interface TestsProps {
  onAddClick: () => void;
  onEditTest: (id: number) => void;
  onDeleteTest: (id: number) => void;
}

export default function Tests({
  onAddClick,
  onEditTest,
  onDeleteTest
}: TestsProps) {
  const router = useRouter();
  const { tests, isLoading } = useTests();

  const testRows = tests.map((test) => ({
    id: test.id?.toString() || `test-${Date.now()}`,
    name: test.name,
    description: test.description || '',
    created_at: new Date(test.created_at!).toLocaleString(),
  }));

  const testHeaders = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'created_at', header: 'Created At' },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <>
      <div className={styles.panelHeader}>
        <h2>Tests</h2>
        {testRows.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button kind="secondary" renderIcon={Add} onClick={() => router.push('/tests/generate')}>
              Generate Tests
            </Button>
            <Button renderIcon={Add} onClick={onAddClick}>
              Add Test
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <InlineLoading description="Loading data..." />
      ) : testRows.length > 0 ? (
        <TableRenderer 
          headers={testHeaders} 
          rows={testRows} 
          type="test" 
          onEdit={onEditTest}
          onDelete={onDeleteTest}
        />
      ) : (
        <EmptyState
          title="Test Cases"
          description="Add your first test case with input data and expected outputs."
          icon={TestTool as React.ComponentType<{ size: number; className?: string }>}
          onAddClick={onAddClick}
        />
      )}
    </>
  );
}
