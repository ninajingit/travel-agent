import { type AgentChannel, NotImplementedError } from "./types";

// Placeholder for the Twilio WhatsApp integration. Exists so the rest of the
// app can be written against every channel now.
export class WhatsAppChannel implements AgentChannel {
  readonly kind = "whatsapp" as const;

  async send(): Promise<void> {
    throw new NotImplementedError(this.kind);
  }
}
