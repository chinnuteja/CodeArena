import { DockerEngine } from './docker.engine.js';
import { ExecutionEngine } from './execution.interface.js';

export const engine: ExecutionEngine = new DockerEngine();
