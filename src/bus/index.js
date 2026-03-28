import { EventEmitter } from "node:events";
// Global Event Bus, all components broadcast internal state changes here
const globalBus = new EventEmitter();
// Increased max listeners since all channels and core services hook in
globalBus.setMaxListeners(50);
export default globalBus;
