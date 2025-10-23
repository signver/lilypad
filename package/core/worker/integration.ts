import { LilypadWorkerError } from "../error";

export interface WorkerContext {
  id: string;
}

export type PadRequestParam =
  | undefined
  | null
  | boolean
  | number
  | string
  | Array<PadRequestParam>
  | Record<string | number, PadRequest>;

export interface PadRequest {
  id: string;
  action: string;
  params: PadRequestParam;
}

export interface PadResponse {
  id: string;
  result?: unknown;
  error?: Error;
}

export function integration(params: WorkerContext) {
  const context = {
    modules: {} as Record<string, any>,
    worker: { ...params },
  };
  const dynaport = new Function("url", "return import(url)");
  const actionRouter: { [key: string]: { (...params: any[]): unknown } } = {
    getId() {
      return params.id;
    },
    async load(name: string, script: string) {
      context.modules[name] = await dynaport(script);
    },
  };

  function validRequest(value: any): value is PadRequest {
    if (typeof value?.id !== "string") return false;
    if (typeof value?.action !== "string") return false;
    return true;
  }

  self.onmessage = async (event) => {
    const { data, source } = event;
    if (!validRequest(data)) {
      return;
    }
    const { action, id, params } = data;
    const delegate = actionRouter[action];
    if (!delegate) {
      source?.postMessage({
        id,
        error: new LilypadWorkerError(),
      });
      return;
    }
    source?.postMessage({
      id,
      result: await Promise.resolve(delegate(params)),
    });
  };
}

export default async function prepareScript(context: WorkerContext) {
  prepareScript.memo =
    prepareScript.memo ??
    (await new Promise<string>((resolve, reject) => {
      const blob = new Blob(
        [
          "var main = ",
          integration.toString(),
          `; main(${JSON.stringify(context)});`,
        ],
        {
          type: "application/javascript",
        }
      );
      const reader = new FileReader();
      reader.onload = () => {
        const { result } = reader;
        if (typeof result !== "string") {
          return reject(new LilypadWorkerError());
        }
        resolve(result);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsDataURL(blob);
    }));
  return prepareScript.memo;
}

prepareScript.memo = undefined as string | undefined;
