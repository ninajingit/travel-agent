import { type AgentChannel, NotImplementedError } from "./types";

// Placeholder for iMessage delivery. Same shape as the others; no transport.
export class IMessageChannel implements AgentChannel {
  readonly kind = "imessage" as const;

  async send(): Promise<void> {
    throw new NotImplementedError(this.kind);
  }
}
