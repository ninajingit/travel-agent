import type { AgentChannel, OutboundMessage } from "./types";

// The in-app chat. There is no network to push over: the web UI asks for
// the agent's reply in the same request it sends the person's message, so
// "sending" here is handing the message back to that caller. The outbox
// makes that hand-off explicit and testable.
export class WebChannel implements AgentChannel {
  readonly kind = "web" as const;
  private readonly outbox: OutboundMessage[] = [];

  async send(message: OutboundMessage) {
    this.outbox.push(message);
  }

  // Everything sent to this person since the last drain, oldest first.
  drain(userId: number): OutboundMessage[] {
    const mine = this.outbox.filter((m) => m.userId === userId);
    for (const m of mine) {
      this.outbox.splice(this.outbox.indexOf(m), 1);
    }
    return mine;
  }
}
