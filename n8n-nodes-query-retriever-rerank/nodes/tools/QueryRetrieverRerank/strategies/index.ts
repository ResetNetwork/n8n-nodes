import type { QueryStrategy } from '../shared/types';
import { SimpleQueryStrategy } from './SimpleQueryStrategy';
import { MultiQueryStrategy } from './MultiQueryStrategy';
import { NoneStrategy } from './NoneStrategy';

// Strategy registry
export class StrategyRegistry {
	private static strategies = new Map<string, () => QueryStrategy>([
		['simple_query', () => new SimpleQueryStrategy()],
		['multi_query', () => new MultiQueryStrategy()],
		['none', () => new NoneStrategy()],
	]);

	// Get strategy instance by name
	static getStrategy(strategyType: string): QueryStrategy {
		const strategyFactory = this.strategies.get(strategyType);
		
		if (!strategyFactory) {
			throw new Error(`Unknown strategy type: ${strategyType}. Available strategies: ${Array.from(this.strategies.keys()).join(', ')}`);
		}
		
		return strategyFactory();
	}

	// Register a new strategy
	static registerStrategy(name: string, factory: () => QueryStrategy): void {
		this.strategies.set(name, factory);
	}

	// Get all available strategy names
	static getAvailableStrategies(): string[] {
		return Array.from(this.strategies.keys());
	}

	// Get strategy info for UI options
	static getStrategyOptions(): Array<{name: string, value: string, description: string}> {
		const options: Array<{name: string, value: string, description: string}> = [];
		
		for (const [key] of this.strategies) {
			const strategy = this.getStrategy(key);
			options.push({
				name: this.getStrategyDisplayName(key),
				value: key,
				description: strategy.getDescription()
			});
		}
		
		return options;
	}

	// Convert strategy key to display name
	private static getStrategyDisplayName(key: string): string {
		switch (key) {
			case 'simple_query': return 'Simple Query';
			case 'multi_query': return 'Multi-Query';
			case 'none': return 'None';
			default: return key;
		}
	}
}

// Export all strategies for convenience
export { SimpleQueryStrategy } from './SimpleQueryStrategy';
export { MultiQueryStrategy } from './MultiQueryStrategy';
export { NoneStrategy } from './NoneStrategy';
export { BaseStrategy } from './BaseStrategy';