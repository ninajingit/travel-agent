"use client";

import { createElement } from "react";
import Script from "next/script";

// The web component Stripe ships. React has no types for it, and the
// attributes are hyphenated rather than React props, so it is rendered
// through createElement with a plain attribute bag.
type TableAttributes = {
  "pricing-table-id": string;
  "publishable-key": string;
  "client-reference-id"?: string;
  "customer-email"?: string;
  "customer-session-client-secret"?: string;
};

/**
 * Stripe's hosted pricing table, for comparison against our own page.
 *
 * Everything it shows comes from the dashboard. It renders in an iframe, so
 * none of the app's theme tokens reach it and it cannot be told which plan
 * the reader is already on.
 */
export function StripePricingTable({
  pricingTableId,
  publishableKey,
  clientReferenceId,
  customerSessionClientSecret,
}: {
  pricingTableId: string;
  publishableKey: string;
  clientReferenceId?: string;
  customerSessionClientSecret?: string;
}) {
  const attributes: TableAttributes = {
    "pricing-table-id": pricingTableId,
    "publishable-key": publishableKey,
    ...(clientReferenceId ? { "client-reference-id": clientReferenceId } : {}),
    ...(customerSessionClientSecret
      ? { "customer-session-client-secret": customerSessionClientSecret }
      : {}),
  };

  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" strategy="afterInteractive" />
      {createElement("stripe-pricing-table", attributes)}
    </>
  );
}
