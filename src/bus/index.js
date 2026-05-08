import { EventEmitter } from "node:events";
const globalBus = new EventEmitter();
globalBus.setMaxListeners(50);
export default globalBus;
