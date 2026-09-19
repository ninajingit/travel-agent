import type { AgentChannel, ChannelKind } from "./types";
import { WebChannel } from "./web";
import { WhatsAppChannel } from "./whatsapp";
import { IMessageChannel } from "./imessage";

export * from "./types";
export { WebChannel } from "./web";

// One instance per channel for the life of the process.
const channels: Record<ChannelKind, AgentChannel> = {
  web: new WebChannel(),
  whatsapp: new WhatsAppChannel(),
  imessage: new IMessageChannel(),
};

export function getChannel(kind: ChannelKind): AgentChannel {
  return channels[kind];
}
