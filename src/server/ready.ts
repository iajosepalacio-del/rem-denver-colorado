import { ensureDemo } from "./demo";
import { ensureEvent } from "./event";

const globalState = globalThis as unknown as { __remReady?: Promise<void> };

export function ready() {
  globalState.__remReady ??= (async () => {
    await ensureEvent();
    await ensureDemo();
  })().catch((error: unknown) => {
    globalState.__remReady = undefined;
    throw error;
  });
  return globalState.__remReady;
}
