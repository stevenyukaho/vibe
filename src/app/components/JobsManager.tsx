'use client';

import { useState, useEffect } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  Tag,
  Modal,
  ModalBody,
  InlineLoading,
  CodeSnippet,
  InlineNotification,
} from '@carbon/react';
import { ViewFilled, Renew } from '@carbon/icons-react';
import { api, Job, JobStatus } from '@/lib/api';
import { Agent, Test } from '../../../../backend/src/db/queries';
import styles from './JobsManager.module.scss';

interface JobsManagerProps {
  agents: Agent[];
  tests: Test[];
  onRefresh: () => void;
  onResultView: (resultId: number) => void;
}

export default function JobsManager({ agents, tests, onRefresh, onResultView }: JobsManagerProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs
  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const fetchedJobs = await api.getJobs();
      setJobs(fetchedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  };

  // Start polling for job status updates
  useEffect(() => {
    fetchJobs();

    // Set up polling for job updates
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some(job => job.status === 'pending' || job.status === 'running');
      if (hasActiveJobs) {
        fetchJobs();
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // Handle job selection for viewing details
  const handleViewJob = (jobId: number) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setJobModalOpen(true);
    }
  };

  // Get job status tag type
  const getStatusTagType = (status: JobStatus) => {
    switch (status) {
      case 'pending': return 'purple';
      case 'running': return 'blue';
      case 'completed': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  // View result when available
  const handleViewResult = () => {
    if (selectedJob && selectedJob.result_id) {
      onResultView(selectedJob.result_id);
      setJobModalOpen(false);
    }
  };

  // Refresh job list
  const handleRefresh = () => {
    fetchJobs();
    onRefresh();
  };

  // Define table headers
  const headers = [
    { key: 'id', header: 'ID' },
    { key: 'agent', header: 'Agent' },
    { key: 'test', header: 'Test' },
    { key: 'status', header: 'Status' },
    { key: 'created_at', header: 'Created' },
    { key: 'actions', header: 'Actions' },
  ];

  // Map jobs to table rows
  const rows = jobs.map(job => {
    const agent = agents.find(a => a.id === job.agent_id);
    const test = tests.find(t => t.id === job.test_id);
    
    return {
      id: job.id.toString(),
      agent: agent ? `${agent.name} (v${agent.version})` : `Agent ${job.agent_id}`,
      test: test ? test.name : `Test ${job.test_id}`,
      status: (
        <Tag type={getStatusTagType(job.status)}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </Tag>
      ),
      created_at: new Date(job.created_at).toLocaleString(),
      actions: (
        <Button 
          kind="ghost" 
          size="sm" 
          renderIcon={ViewFilled} 
          onClick={() => handleViewJob(job.id)}
          iconDescription="View job details"
        >
          View
        </Button>
      ),
    };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Test Jobs</h3>
        <Button 
          kind="ghost" 
          size="sm" 
          renderIcon={Renew} 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? <InlineLoading description="Refreshing..." /> : 'Refresh'}
        </Button>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          hideCloseButton={false}
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {jobs.length === 0 ? (
        <p>No jobs found. Start a new test execution to create a job.</p>
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(header => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map(cell => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <Modal
          open={jobModalOpen}
          onRequestClose={() => setJobModalOpen(false)}
          modalHeading={`Job #${selectedJob.id} Details`}
          primaryButtonText={selectedJob.result_id ? "View Result" : null}
          primaryButtonDisabled={!selectedJob.result_id}
          onRequestSubmit={handleViewResult}
          secondaryButtonText="Close"
          onSecondarySubmit={() => setJobModalOpen(false)}
        >
          <ModalBody>
            <div>
              <h5 className={styles.jobDetailsHeading}>Job Information</h5>
              <Table size="sm" useZebraStyles={false}>
                <TableHead>
                  <TableRow>
                    <TableHeader>Field</TableHeader>
                    <TableHeader>Value</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Agent</TableCell>
                    <TableCell>
                      {agents.find(a => a.id === selectedJob.agent_id)?.name || `Agent ${selectedJob.agent_id}`}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell>
                      {tests.find(t => t.id === selectedJob.test_id)?.name || `Test ${selectedJob.test_id}`}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>
                      <Tag type={getStatusTagType(selectedJob.status)}>
                        {selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1)}
                      </Tag>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Created</TableCell>
                    <TableCell>
                      {new Date(selectedJob.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Last Updated</TableCell>
                    <TableCell>
                      {new Date(selectedJob.updated_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {selectedJob.result_id && (
                    <TableRow>
                      <TableCell>Result ID</TableCell>
                      <TableCell>{selectedJob.result_id}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {selectedJob.error && (
                <div className={styles.errorSection}>
                  <h5>Error</h5>
                  <CodeSnippet type="inline" className="error-snippet">
                    {selectedJob.error}
                  </CodeSnippet>
                </div>
              )}
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
