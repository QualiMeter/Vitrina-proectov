import type { DemoMode } from '../cases/mockRepository';
import type { ExecutionRepository } from './repository';

/** Load fixtures only when opening day four; other company screens keep their existing bundle. */
export function createLazyExecution(mode: DemoMode): ExecutionRepository {
  let instance: Promise<ExecutionRepository> | undefined;
  const get = () => instance ??= import('./mockExecution').then(module => module.createExecutionDemo(mode));
  return {
    snapshot: async (...args) => (await get()).snapshot(...args),
    versions: async (...args) => (await get()).versions(...args),
    file: async (...args) => (await get()).file(...args),
    closeCheckpoint: async (...args) => (await get()).closeCheckpoint(...args),
    select: async (...args) => (await get()).select(...args),
    exclude: async (...args) => (await get()).exclude(...args),
    closeFinal: async (...args) => (await get()).closeFinal(...args),
    beginEvaluation: async (...args) => (await get()).beginEvaluation(...args),
    review: async (...args) => (await get()).review(...args),
    awards: async (...args) => (await get()).awards(...args),
  };
}
