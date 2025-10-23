import { PadResponse } from "./integration";

export class WorkerEvent extends CustomEvent<PadResponse> {}
