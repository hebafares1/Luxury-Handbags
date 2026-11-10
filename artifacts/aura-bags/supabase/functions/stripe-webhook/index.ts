import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_BODY_BYTES = 256 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

type StripeLineItem = {
  description?: unknown;
  quantity?: unknown;
  amount_subtotal?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  price?: unknown;
};

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  livemode?: unknown;
  data?: { object?: unknown };
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getTestStripeKey(): string | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  return key && (key.startsWith("sk_test_") || key.startsWith("rk_test_"))
    ? key
    : null;
}

function getWebhookSecret(): string | null {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  return secret?.startsWith("whsec_") ? secret : null;
}

function getSupabaseAdminKey(): { key: string; useBearer: boolean } | null {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysJson) {
    try {
      const parsed: unknown = JSON.parse(secretKeysJson);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const key = (parsed as Record<string, unknown>).default;
        if (typeof key === "string" && key.startsWith("sb_secret_")) {
          return { key, useBearer: false };
        }
      }
    } catch {
      // Try the legacy service-role variable below.
    }
  }

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return { key: legacyKey, useBearer: true };
  return null;
}

async function readBoundedBody(req: Request): Promise<{
  body: Uint8Array | null;
  tooLarge: boolean;
}> {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { body: null, tooLarge: true };
  }
  if (!req.body) return { body: new Uint8Array(), tooLarge: false };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel();
      return { body: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body, tooLarge: false };
}

function parseSignatureHeader(header: string): {
  timestamp: number;
  signatures: string[];
} | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value);
  }

  if (!Number.isSafeInteger(timestamp) || signatures.length === 0) return null;
  return { timestamp: timestamp as number, signatures };
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyStripeSignature(
  rawBody: Uint8Array,
  header: string,
  webhookSecret: string,
): Promise<boolean> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const prefix = encoder.encode(`${parsed.timestamp}.`);
  const signedPayload = new Uint8Array(prefix.byteLength + rawBody.byteLength);
  signedPayload.set(prefix);
  signedPayload.set(rawBody, prefix.byteLength);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, signedPayload);
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return parsed.signatures.some((signature) => constantTimeHexEqual(signature, expected));
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const id = (value as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function normalizeLineItems(value: unknown): Record<string, unknown>[] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>).data)
  ) {
    return null;
  }

  const data = (value as { data: StripeLineItem[] }).data;
  if (data.length < 1 || data.length > 100) return null;

  const items: Record<string, unknown>[] = [];
  for (const item of data) {
    const quantity = item.quantity;
    const amountSubtotal = item.amount_subtotal;
    const amountTotal = item.amount_total;
    const currency = item.currency;

    if (
      !Number.isSafeInteger(quantity) ||
      !Number.isSafeInteger(amountSubtotal) ||
      !Number.isSafeInteger(amountTotal) ||
      (quantity as number) < 1 ||
      (amountSubtotal as number) < 0 ||
      (amountTotal as number) < 0 ||
      currency !== "usd"
    ) {
      return null;
    }

    const price = typeof item.price === "object" && item.price !== null
      ? item.price as Record<string, unknown>
      : {};

    items.push({
      description: typeof item.description === "string"
        ? item.description.slice(0, 200)
        : "ROSE product",
      quantity,
      amount_subtotal: amountSubtotal,
      amount_total: amountTotal,
      currency,
      stripe_price_id: typeof price.id === "string" ? price.id : null,
      stripe_product_id: stripeObjectId(price.product),
    });
  }

  return items;
}

async function fetchStripeLineItems(
  sessionId: string,
  stripeKey: string,
): Promise<Record<string, unknown>[] | null> {
  const url = new URL(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items`,
    "https://api.stripe.com",
  );
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${stripeKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error("Could not retrieve Stripe Checkout line items.", {
      status: response.status,
    });
    return null;
  }

  const payload: unknown = await response.json();
  return normalizeLineItems(payload);
}

async function insertOrder(order: Record<string, unknown>): Promise<
  "inserted" | "duplicate" | "failed"
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const admin = getSupabaseAdminKey();
  if (!supabaseUrl || !admin) return "failed";

  const headers = new Headers({
    apikey: admin.key,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  });
  if (admin.useBearer) headers.set("Authorization", `Bearer ${admin.key}`);

  const response = await fetch(new URL("/rest/v1/orders", supabaseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(order),
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 409) return "duplicate";
  if (!response.ok) {
    console.error("Supabase order insert failed.", { status: response.status });
    return "failed";
  }
  return "inserted";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const stripeKey = getTestStripeKey();
  const webhookSecret = getWebhookSecret();
  if (!stripeKey || !webhookSecret) {
    console.error("Stripe Test Mode webhook secrets are not configured.");
    return jsonResponse({ error: "Webhook is not configured." }, 503);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return jsonResponse({ error: "Missing Stripe signature." }, 400);

  const { body, tooLarge } = await readBoundedBody(req);
  if (tooLarge) return jsonResponse({ error: "Webhook payload is too large." }, 413);
  if (!body || body.byteLength === 0) {
    return jsonResponse({ error: "Missing webhook payload." }, 400);
  }

  const signatureValid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!signatureValid) return jsonResponse({ error: "Invalid Stripe signature." }, 400);

  let event: StripeEvent;
  try {
    event = JSON.parse(new TextDecoder().decode(body)) as StripeEvent;
  } catch {
    return jsonResponse({ error: "Invalid webhook payload." }, 400);
  }

  if (event.livemode !== false) {
    return jsonResponse({ error: "Only Stripe Test Mode events are accepted." }, 400);
  }
  if (event.type !== "checkout.session.completed") {
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  const eventId = event.id;
  const session = typeof event.data?.object === "object" && event.data.object !== null
    ? event.data.object as Record<string, unknown>
    : null;

  if (
    typeof eventId !== "string" ||
    !/^evt_[A-Za-z0-9]+$/.test(eventId) ||
    !session ||
    typeof session.id !== "string" ||
    !/^cs_test_[A-Za-z0-9_]+$/.test(session.id)
  ) {
    return jsonResponse({ error: "Invalid Checkout event." }, 400);
  }

  if (
    session.object !== "checkout.session" ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.livemode !== false ||
    session.currency !== "usd" ||
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total as number) < 1
  ) {
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  const metadata = typeof session.metadata === "object" && session.metadata !== null
    ? session.metadata as Record<string, unknown>
    : {};
  if (metadata.store !== "ROSE") {
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  const lineItems = await fetchStripeLineItems(session.id, stripeKey);
  if (!lineItems) return jsonResponse({ error: "Could not verify order items." }, 502);

  const insertResult = await insertOrder({
    stripe_event_id: eventId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: stripeObjectId(session.payment_intent),
    amount_total: session.amount_total,
    currency: "usd",
    payment_status: "paid",
    line_items: lineItems,
    livemode: false,
  });

  if (insertResult === "failed") {
    return jsonResponse({ error: "Could not save the order. Stripe may retry this event." }, 500);
  }

  return jsonResponse({
    received: true,
    duplicate: insertResult === "duplicate",
  }, 200);
});
