import type { Career, Input } from "./shared/engine.mjs";
import type { Snapshot } from "./shared/rooms.mjs";

export type ResponseData = {
  room?: Snapshot;
  career?: Career;
  rooms?: { id: string; mode: string; missionId: string; players: number }[];
  playerId?: string;
  activeRoom?: string | null;
};
export type Transport = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<ResponseData>;
export const httpTransport: Transport = async (action, payload = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("/api/city", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    const data = (await response.json()) as ResponseData & { error?: string };
    if (!response.ok || data.error)
      throw Error(data.error || "City service is unavailable.");
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw Error("Connection timed out. Check your network and retry.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

export class CityConnection {
  private stopped = false;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private input: Input = {
    x: 0,
    y: 0,
    yaw: 0,
    fast: false,
    brake: false,
    seq: 0,
  };
  private action = "";
  private actionSeq = Date.now() * 1000;
  constructor(
    private transport: Transport,
    public roomId: string,
    private onState: (r: Snapshot, c?: Career) => void,
    private onError: (message: string) => void,
  ) {}
  controls(input: Input) {
    this.input = { ...input };
  }
  interact(action: string) {
    this.action = action;
    this.actionSeq++;
  }
  start() {
    this.timer = setInterval(() => void this.tick(), 125);
    void this.tick();
  }
  private async tick() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const seq = this.actionSeq,
      action = this.action;
    try {
      const r = await this.transport("input", {
        roomId: this.roomId,
        input: this.input,
        actionSeq: seq,
        interaction: action,
      });
      if (this.stopped) return;
      if (r.room) this.onState(r.room, r.career);
      if (this.actionSeq === seq) this.action = "";
      this.onError("");
    } catch (e) {
      if (!this.stopped)
        this.onError(
          e instanceof Error ? e.message : "Connection interrupted.",
        );
    } finally {
      this.busy = false;
    }
  }
  async command(action: string, payload: Record<string, unknown> = {}) {
    const r = await this.transport(action, { roomId: this.roomId, ...payload });
    if (!this.stopped && r.room) this.onState(r.room, r.career);
    return r;
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
}
