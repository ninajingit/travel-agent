// A channel is a place Nomi can talk to a person: the chat in this app,
// WhatsApp, iMessage. The agent speaks to one interface; each adapter knows
// how to deliver on its own network.

export type ChannelKind = "web" | "whatsapp" | "imessage";

export type OutboundMessage = {
  userId: number;
  body: string;
};

export interface AgentChannel {
  readonly kind: ChannelKind;
  // Deliver one message to the person. Resolves when the channel has
  // accepted it, not when the person has read it.
  send(message: OutboundMessage): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(kind: ChannelKind) {
    super(`The ${kind} channel is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
