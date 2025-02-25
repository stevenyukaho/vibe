'use client';

import { useState } from 'react';
import {
  Form,
  Select,
  SelectItem,
  Button,
  InlineLoading,
  Tile,
  Tag,
  CodeSnippet,
  Modal,
  ModalBody,
  ModalFooter,
} from '@carbon/react';
import { PlayFilled, Information } from '@carbon/icons-react';
import { api } from '@/lib/api';
import { Agent, Test, TestResult } from '../../../../backend/src/db/queries';

interface IntermediateStepData {
  timestamp: string;
  agent_id: number;
  action: string;
  output: string;
}

interface TestExecutorProps {
  agents: Agent[];
  tests: Test[];
  onResultCreated: (result: TestResult) => void;
}

export default function TestExecutor({ agents, tests, onResultCreated }: TestExecutorProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [selectedTestId, setSelectedTestId] = useState<number | undefined>();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleAgentChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAgentId(Number(event.target.value));
  };

  const handleTestChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTestId(Number(event.target.value));
  };

  const executeTest = async () => {
    if (!selectedAgentId || !selectedTestId) {
      setError('Please select both an agent and a test');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const result = await api.executeTest(selectedAgentId, selectedTestId);
      setResult(result);
      onResultCreated(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to execute test');
    } finally {
      setIsExecuting(false);
    }
  };

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
  const selectedTest = tests.find(test => test.id === selectedTestId);

  return (
    <div>
      <Form>
        <div style={{ marginBottom: '1rem' }}>
          <Select
            id="agent-select"
            labelText="Select Agent"
            helperText="Choose an agent to execute the test"
            value={selectedAgentId || ''}
            onChange={handleAgentChange}
          >
            <SelectItem value="" text="Choose an agent" disabled />
            {agents.map(agent => (
              <SelectItem
                key={agent.id}
                value={agent.id}
                text={`${agent.name} (v${agent.version})`}
              />
            ))}
          </Select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <Select
            id="test-select"
            labelText="Select Test"
            helperText="Choose a test to execute"
            value={selectedTestId || ''}
            onChange={handleTestChange}
          >
            <SelectItem value="" text="Choose a test" disabled />
            {tests.map(test => (
              <SelectItem
                key={test.id}
                value={test.id}
                text={test.name}
              />
            ))}
          </Select>
        </div>

        <Button
          kind="primary"
          onClick={executeTest}
          disabled={isExecuting || !selectedAgentId || !selectedTestId}
          renderIcon={PlayFilled}
        >
          {isExecuting ? <InlineLoading description="Executing..." /> : 'Execute Test'}
        </Button>
      </Form>

      {error && (
        <Tile className="error-tile" style={{ marginTop: '1rem', backgroundColor: '#fff1f1', color: '#da1e28' }}>
          {error}
        </Tile>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <Tile>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4>Test Result</h4>
              <div>
                <Tag type={result.success ? 'green' : 'red'}>
                  {result.success ? 'Success' : 'Failed'}
                </Tag>
                {result.execution_time !== undefined && (
                  <Tag type="blue">
                    {result.execution_time.toFixed(2)}s
                  </Tag>
                )}
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Information}
                  onClick={() => setShowDetails(true)}
                >
                  Details
                </Button>
              </div>
            </div>
            
            <h5>Output:</h5>
            <CodeSnippet type="multi">
              {result.output}
            </CodeSnippet>
          </Tile>
        </div>
      )}

      {/* Details Modal */}
      {result && (
        <Modal
          open={showDetails}
          onRequestClose={() => setShowDetails(false)}
          modalHeading="Test Execution Details"
          size="lg"
        >
          <ModalBody>
            <h5>Test Information</h5>
            <table className="details-table">
              <tbody>
                <tr>
                  <td>Agent</td>
                  <td>{selectedAgent?.name} (v{selectedAgent?.version})</td>
                </tr>
                <tr>
                  <td>Test</td>
                  <td>{selectedTest?.name}</td>
                </tr>
                <tr>
                  <td>Success</td>
                  <td>
                    <Tag type={result.success ? 'green' : 'red'}>
                      {result.success ? 'Success' : 'Failed'}
                    </Tag>
                  </td>
                </tr>
                {result.execution_time !== undefined && (
                  <tr>
                    <td>Execution Time</td>
                    <td>{result.execution_time.toFixed(2)}s</td>
                  </tr>
                )}
              </tbody>
            </table>

            {result.intermediate_steps && (
              <>
                <h5 style={{ marginTop: '1rem' }}>Intermediate Steps</h5>
                <table className="steps-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Agent</th>
                      <th>Action</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {JSON.parse(result.intermediate_steps).map((step: IntermediateStepData, index: number) => (
                      <tr key={index}>
                        <td>{new Date(step.timestamp).toLocaleTimeString()}</td>
                        <td>Agent {step.agent_id}</td>
                        <td>{step.action}</td>
                        <td>
                          <CodeSnippet type="single">
                            {step.output.length > 50 ? `${step.output.substring(0, 50)}...` : step.output}
                          </CodeSnippet>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
} 