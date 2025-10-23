import { WorkerEvent } from "./event";
import integrationScript, {
  PadRequest,
  PadRequestParam,
  type PadResponse,
} from "./integration";

export class Pad {
  static #registry = new Map<string, Worker>();

  async compose() {
    const id = crypto.randomUUID();
    const worker = new Worker(await integrationScript({ id }), {
      type: "module",
    });
    // Convert messages to response events
    worker.addEventListener("message", ({ data }) => {
      const { id } = data;
      worker.dispatchEvent(
        new WorkerEvent(id, { detail: data as PadResponse })
      );
    });
    Pad.#registry.set(id, worker);
    return id;
  }

  async exec<T = unknown>(workerId: string, action: string, params: PadRequestParam) {
    const worker = Pad.#registry.get(workerId);
    if (!worker) {
      return;
    }
    return new Promise<T>((resolve, reject) => {
      const id = crypto.randomUUID();
      worker.addEventListener(
        id,
        (event) => {
          const {
            detail: { error, result },
          } = event as WorkerEvent;
          if (error) {
            return reject(error);
          }
          resolve(result as T);
        },
        { once: true }
      );
      worker.postMessage({
        id,
        action,
        params,
      } satisfies PadRequest);
    });
  }
}
