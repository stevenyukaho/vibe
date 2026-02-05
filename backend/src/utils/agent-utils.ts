/**
 * Utility functions for agent-related operations
 */

export type AgentJobType = 'crewai' | 'external_api';

/**
 * Determine the job type for an agent based on its settings
 * @param agentSettings The agent settings JSON string
 * @returns The job type ('crewai' or 'external_api')
 */
export function getAgentJobType(agentSettings: string): AgentJobType {
	try {
		const settings = JSON.parse(agentSettings);
		const type = settings.type || 'crewai';

		// Validate the type is one of the expected values
		if (type === 'crewai' || type === 'external_api') {
			return type;
		}

		return 'crewai';
	} catch {
		return 'crewai';
	}
}
