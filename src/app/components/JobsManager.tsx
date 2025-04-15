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
import { ViewFilled, Renew, PlayFilled, TrashCan, StopFilled } from '@carbon/icons-react';
import { api, Job, JobStatus } from '@/lib/api';
import styles from './JobsManager.module.scss';
import { useAgents, useTests } from '@/lib/AppDataContext';

interface JobsManagerProps {
  onRefresh: () => void;
  onResultView: (resultId: number) => void;
}

export default function JobsManager({ 
  onRefresh, 
  onResultView 
}: JobsManagerProps) {
  // Get data from context
  const { agents } = useAgents();
  const { tests } = useTests();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerunningJob, setRerunningJob] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);
  const [cancelingJob, setCancelingJob] = useState(false);

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

  // Re-run a job with the same agent and test
  const handleRerunJob = async () => {
    if (!selectedJob) return;
    
    setRerunningJob(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const newJob = await api.createJob(selectedJob.agent_id, selectedJob.test_id);
      setSuccessMessage(`New job #${newJob.id} created successfully and is now queued for execution`);
      fetchJobs();
      onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to re-run job');
    } finally {
      setRerunningJob(false);
    }
  };

  // Delete a job
  const handleDeleteJob = async (jobId: number) => {
    if (window.confirm('Are you sure you want to delete this job? This will permanently remove it from the system.')) {
      setDeletingJob(true);
      setError(null);
      setSuccessMessage(null);
      
      try {
        await api.deleteJob(jobId);
        fetchJobs();
        onRefresh();
        setSuccessMessage('Job deleted successfully');
      } catch (error) {
        console.error('Error deleting job:', error);
        setError(error instanceof Error ? error.message : 'Failed to delete job');
      } finally {
        setDeletingJob(false);
      }
    }
  };

  // Cancel a job
  const handleCancelJob = async (jobId: number) => {
    if (window.confirm('Are you sure you want to cancel this job? This will stop the job execution.')) {
      setCancelingJob(true);
      setError(null);
      setSuccessMessage(null);
      
      try {
        await api.cancelJob(jobId);
        fetchJobs();
        onRefresh();
        setSuccessMessage('Job canceled successfully');
      } catch (error) {
        console.error('Error canceling job:', error);
        setError(error instanceof Error ? error.message : 'Failed to cancel job');
      } finally {
        setCancelingJob(false);
      }
    }
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
    
    const isPendingOrRunning = job.status === 'pending' || job.status === 'running';
    
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            kind="ghost" 
            size="sm" 
            renderIcon={ViewFilled} 
            onClick={() => handleViewJob(job.id)}
            iconDescription="View job details"
            hasIconOnly
          />
          <Button 
            kind="ghost" 
            size="sm" 
            renderIcon={PlayFilled} 
            onClick={() => {
              setRerunningJob(true);
              api.createJob(job.agent_id, job.test_id)
                .then(() => {
                  fetchJobs();
                  onRefresh();
                })
                .catch(err => {
                  console.error('Error re-running job:', err);
                  setError(err instanceof Error ? err.message : 'Failed to re-run job');
                })
                .finally(() => {
                  setRerunningJob(false);
                });
            }}
            iconDescription="Re-run this job"
            disabled={rerunningJob}
            hasIconOnly
          />
          {isPendingOrRunning && (
            <Button 
              kind="danger" 
              size="sm" 
              renderIcon={StopFilled} 
              onClick={() => handleCancelJob(job.id)}
              iconDescription="Cancel this job"
              disabled={cancelingJob}
              hasIconOnly
            />
          )}
          <Button 
            kind="danger--ghost" 
            size="sm" 
            renderIcon={TrashCan} 
            onClick={() => handleDeleteJob(job.id)}
            iconDescription="Delete this job"
            disabled={deletingJob}
            hasIconOnly
          />
        </div>
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

              {/* Re-run button */}
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start', gap: '1rem' }}>
                <Button 
                  kind="primary" 
                  size="sm" 
                  renderIcon={PlayFilled}
                  onClick={handleRerunJob}
                  disabled={rerunningJob}
                >
                  {rerunningJob ? <InlineLoading description="Creating job..." /> : 'Re-run Job'}
                </Button>
                
                {(selectedJob.status === 'pending' || selectedJob.status === 'running') && (
                  <Button 
                    kind="danger" 
                    size="sm" 
                    renderIcon={StopFilled}
                    onClick={() => {
                      if (selectedJob) {
                        handleCancelJob(selectedJob.id);
                        setJobModalOpen(false);
                      }
                    }}
                    disabled={cancelingJob}
                  >
                    {cancelingJob ? <InlineLoading description="Canceling..." /> : 'Cancel Job'}
                  </Button>
                )}
                
                <Button 
                  kind="danger" 
                  size="sm" 
                  renderIcon={TrashCan}
                  onClick={() => {
                    if (selectedJob) {
                      handleDeleteJob(selectedJob.id);
                      setJobModalOpen(false);
                    }
                  }}
                  disabled={deletingJob}
                >
                  {deletingJob ? <InlineLoading description="Deleting..." /> : 'Delete Job'}
                </Button>
              </div>
              
              {/* Success or error message */}
              {successMessage && (
                <InlineNotification
                  kind="success"
                  title="Success"
                  subtitle={successMessage}
                  hideCloseButton={true}
                  style={{ marginTop: '1rem' }}
                />
              )}
              
              {error && (
                <InlineNotification
                  kind="error"
                  title="Error"
                  subtitle={error}
                  hideCloseButton={true}
                  style={{ marginTop: '1rem' }}
                />
              )}
              
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
