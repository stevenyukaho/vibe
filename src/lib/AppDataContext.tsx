'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, Agent, Test, TestResult } from './api';

// Define the context state shape
interface AppDataContextState {
    // Data
    agents: Agent[];
    tests: Test[];
    results: TestResult[];

    // Loading states
    loading: {
        agents: boolean;
        tests: boolean;
        results: boolean;
    };

    // Error states
    errors: {
        agents?: string | null;
        tests?: string | null;
        results?: string | null;
    };

    // Actions
    fetchAllData: () => Promise<void>;

    // Agent actions
    createAgent: (agent: Omit<Agent, 'id' | 'created_at'>) => Promise<Agent>;
    updateAgent: (id: number, agent: Partial<Agent>) => Promise<Agent>;
    deleteAgent: (id: number) => Promise<void>;

    // Test actions
    createTest: (test: Omit<Test, 'id' | 'created_at' | 'updated_at'>) => Promise<Test>;
    updateTest: (id: number, test: Partial<Test>) => Promise<Test>;
    deleteTest: (id: number) => Promise<void>;
}

// Create the context with initial undefined value
const AppDataContext = createContext<AppDataContextState | undefined>(undefined);

// Provider props
interface AppDataProviderProps {
    children: ReactNode;
}

// Provider component
export function AppDataProvider({ children }: AppDataProviderProps) {
    // Data state
    const [agents, setAgents] = useState<Agent[]>([]);
    const [tests, setTests] = useState<Test[]>([]);
    const [results, setResults] = useState<TestResult[]>([]);

    // Loading states
    const [loading, setLoading] = useState<AppDataContextState['loading']>({
        agents: false,
        tests: false,
        results: false
    });

    // Error states
    const [errors, setErrors] = useState<AppDataContextState['errors']>({});

    // Fetch all data
    const fetchAllData = useCallback(async () => {
        await Promise.all([
            fetchAgents(),
            fetchTests(),
            fetchResults()
        ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch agents
    const fetchAgents = useCallback(async () => {
        setLoading(prev => ({ ...prev, agents: true }));
        try {
            const data = await api.getAgents();
            setAgents(data);
            setErrors(prev => ({ ...prev, agents: null }));
        } catch (error) {
            console.error('Error fetching agents:', error);
            setErrors(prev => ({
                ...prev,
                agents: error instanceof Error ? error.message : 'Failed to fetch agents'
            }));
        } finally {
            setLoading(prev => ({ ...prev, agents: false }));
        }
    }, []);

    // Fetch tests
    const fetchTests = useCallback(async () => {
        setLoading(prev => ({ ...prev, tests: true }));
        try {
            const data = await api.getTests();
            setTests(data);
            setErrors(prev => ({ ...prev, tests: null }));
        } catch (error) {
            console.error('Error fetching tests:', error);
            setErrors(prev => ({
                ...prev,
                tests: error instanceof Error ? error.message : 'Failed to fetch tests'
            }));
        } finally {
            setLoading(prev => ({ ...prev, tests: false }));
        }
    }, []);

    // Fetch results
    const fetchResults = useCallback(async () => {
        setLoading(prev => ({ ...prev, results: true }));
        try {
            const data = await api.getResults();
            setResults(data);
            setErrors(prev => ({ ...prev, results: null }));
        } catch (error) {
            console.error('Error fetching results:', error);
            setErrors(prev => ({
                ...prev,
                results: error instanceof Error ? error.message : 'Failed to fetch results'
            }));
        } finally {
            setLoading(prev => ({ ...prev, results: false }));
        }
    }, []);

    // Create agent
    const createAgent = useCallback(async (agentData: Omit<Agent, 'id' | 'created_at'>) => {
        setLoading(prev => ({ ...prev, agents: true }));
        try {
            const newAgent = await api.createAgent(agentData);
            setAgents(prev => [...prev, newAgent]);
            setErrors(prev => ({ ...prev, agents: null }));
            return newAgent;
        } catch (error) {
            console.error('Error creating agent:', error);
            setErrors(prev => ({
                ...prev,
                agents: error instanceof Error ? error.message : 'Failed to create agent'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, agents: false }));
        }
    }, []);

    // Update agent
    const updateAgent = useCallback(async (id: number, agentData: Partial<Agent>) => {
        setLoading(prev => ({ ...prev, agents: true }));
        try {
            const updatedAgent = await api.updateAgent(id, agentData);
            setAgents(prev => prev.map(agent =>
                agent.id === id ? { ...agent, ...updatedAgent } : agent
            ));
            setErrors(prev => ({ ...prev, agents: null }));
            return updatedAgent;
        } catch (error) {
            console.error('Error updating agent:', error);
            setErrors(prev => ({
                ...prev,
                agents: error instanceof Error ? error.message : 'Failed to update agent'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, agents: false }));
        }
    }, []);

    // Delete agent
    const deleteAgent = useCallback(async (id: number) => {
        setLoading(prev => ({ ...prev, agents: true }));
        try {
            await api.deleteAgent(id);
            setAgents(prev => prev.filter(agent => agent.id !== id));
            setErrors(prev => ({ ...prev, agents: null }));
        } catch (error) {
            console.error('Error deleting agent:', error);
            setErrors(prev => ({
                ...prev,
                agents: error instanceof Error ? error.message : 'Failed to delete agent'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, agents: false }));
        }
    }, []);

    // Create test
    const createTest = useCallback(async (testData: Omit<Test, 'id' | 'created_at' | 'updated_at'>) => {
        setLoading(prev => ({ ...prev, tests: true }));
        try {
            const newTest = await api.createTest(testData);
            setTests(prev => [...prev, newTest]);
            setErrors(prev => ({ ...prev, tests: null }));
            return newTest;
        } catch (error) {
            console.error('Error creating test:', error);
            setErrors(prev => ({
                ...prev,
                tests: error instanceof Error ? error.message : 'Failed to create test'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, tests: false }));
        }
    }, []);

    // Update test
    const updateTest = useCallback(async (id: number, testData: Partial<Test>) => {
        setLoading(prev => ({ ...prev, tests: true }));
        try {
            const updatedTest = await api.updateTest(id, testData);
            setTests(prev => prev.map(test =>
                test.id === id ? { ...test, ...updatedTest } : test
            ));
            setErrors(prev => ({ ...prev, tests: null }));
            return updatedTest;
        } catch (error) {
            console.error('Error updating test:', error);
            setErrors(prev => ({
                ...prev,
                tests: error instanceof Error ? error.message : 'Failed to update test'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, tests: false }));
        }
    }, []);

    // Delete test
    const deleteTest = useCallback(async (id: number) => {
        setLoading(prev => ({ ...prev, tests: true }));
        try {
            await api.deleteTest(id);
            setTests(prev => prev.filter(test => test.id !== id));
            setErrors(prev => ({ ...prev, tests: null }));
        } catch (error) {
            console.error('Error deleting test:', error);
            setErrors(prev => ({
                ...prev,
                tests: error instanceof Error ? error.message : 'Failed to delete test'
            }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, tests: false }));
        }
    }, []);

    // Initial data load
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const contextValue: AppDataContextState = {
        // Data
        agents,
        tests,
        results,

        // Loading states
        loading,

        // Error states
        errors,

        // Actions
        fetchAllData,

        // Agent actions
        createAgent,
        updateAgent,
        deleteAgent,

        // Test actions
        createTest,
        updateTest,
        deleteTest
    };

    return (
        <AppDataContext.Provider value={contextValue}>
            {children}
        </AppDataContext.Provider>
    );
}

// Custom hook for using the app data context
export function useAppData() {
    const context = useContext(AppDataContext);
    if (context === undefined) {
        throw new Error('useAppData must be used within an AppDataProvider');
    }
    return context;
}

// Specialized hooks for specific data types
export function useAgents() {
    const { agents, loading, errors, createAgent, updateAgent, deleteAgent } = useAppData();
    return {
        agents,
        isLoading: loading.agents,
        error: errors.agents,
        createAgent,
        updateAgent,
        deleteAgent
    };
}

export function useTests() {
    const { tests, loading, errors, createTest, updateTest, deleteTest } = useAppData();
    return {
        tests,
        isLoading: loading.tests,
        error: errors.tests,
        createTest,
        updateTest,
        deleteTest
    };
}

export function useResults() {
    const { results, loading, errors } = useAppData();
    return {
        results,
        isLoading: loading.results,
        error: errors.results
    };
}
