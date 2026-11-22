import { ensureDemo } from "./demo";
import { ensureEvent } from "./event";
import { ensureWaiverExample } from "./waiver-template";

const globalState = globalThis as unknown as { __remReady?: Promise<void> };

export function ready() {
  globalState.__remReady ??= (async () => {
    await ensureEvent();
    await ensureWaiverExample();
    await ensureDemo();
  })().catch((error: unknown) => {
    globalState.__remReady = undefined;
    throw error;
  });
  return globalState.__remReady;
}
