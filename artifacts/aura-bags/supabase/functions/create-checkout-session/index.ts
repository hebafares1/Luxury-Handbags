import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type CartLine = { id: number; quantity: number };
type Product = {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
};

// Keep USD test prices equivalent to the storefront's existing KWD conversion rate.
const USD_TO_KWD_RATE = 0.310519;

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getAllowedOrigin(req: Request): string | null {
  const rawOrigin = req.headers.get("origin");
  if (!rawOrigin) return null;

  try {
    const url = new URL(rawOrigin);
    const host = url.hostname.toLowerCase();
    const localHost = host === "localhost" || host === "127.0.0.1";
    const replitHost = [".replit.dev", ".replit.app", ".repl.co"].some((suffix) =>
      host.endsWith(suffix)
    );
    const productionOrigin =
      url.origin === "https://luxury-handbags-1l95d7o6w-heba-3dad.vercel.app";

    if (
      url.origin !== rawOrigin ||
      (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) ||
      (!localHost && !replitHost && !productionOrigin)
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getPublishableKeys(): Set<string> {
  const keys = new Set<string>();
  const keyMap = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keyMap) {
    try {
      const parsed: unknown = JSON.parse(keyMap);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        for (const value of Object.values(parsed)) {
          if (typeof value === "string" && value.length > 0) keys.add(value);
        }
      }
    } catch {
      // Ignore malformed optional key maps; the direct/legacy variables may still exist.
    }
  }

  for (const name of ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) {
    const value = Deno.env.get(name);
    if (value) keys.add(value);
  }
  return keys;
}

function getTestStripeKey(): string | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key || !(key.startsWith("sk_test_") || key.startsWith("rk_test_"))) return null;
  return key;
}

function parseCartItems(value: unknown): CartLine[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;

  const quantities = new Map<number, number>();
  let totalQuantity = 0;

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      !Number.isSafeInteger((item as Record<string, unknown>).id) ||
      !Number.isSafeInteger((item as Record<string, unknown>).quantity)
    ) {
      return null;
    }

    const id = (item as Record<string, number>).id;
    const quantity = (item as Record<string, number>).quantity;
    if (id < 1 || quantity < 1 || quantity > 99) return null;

    const nextQuantity = (quantities.get(id) ?? 0) + quantity;
    if (nextQuantity > 99) return null;
    quantities.set(id, nextQuantity);
    totalQuantity += quantity;
    if (totalQuantity > 99) return null;
  }

  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

function getUsdUnitAmountFromKwd(kwdPrice: string | number): number | null {
  const numericKwdPrice = Number(kwdPrice);
  if (!Number.isFinite(numericKwdPrice) || numericKwdPrice <= 0) return null;

  const amount = Math.round((numericKwdPrice / USD_TO_KWD_RATE) * 100);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99_999_999) return null;
  return amount;
}

async function readProducts(
  lines: CartLine[],
  publishableKey: string,
  authorization: string | null,
): Promise<Product[] | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return null;

  const url = new URL("/rest/v1/products", supabaseUrl);
  url.searchParams.set("select", "id,name,description,price,currency");
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("id", `in.(${lines.map((line) => line.id).join(",")})`);

  const headers = new Headers({
    apikey: publishableKey,
    "Accept-Profile": "public",
    Accept: "application/json",
  });
  if (authorization?.startsWith("Bearer ")) {
    const bearerValue = authorization.slice("Bearer ".length);
    if (!getPublishableKeys().has(bearerValue)) {
      headers.set("Authorization", authorization);
    }
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    return rows as Product[];
  } catch {
    return null;
  }
}

async function verifyCheckoutSession(sessionId: string, stripeKey: string) {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { paid: false, status: 400 };
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` }, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) return { paid: false, status: 400 };

    const session: unknown = await response.json();
    if (typeof session !== "object" || session === null) {
      return { paid: false, status: 400 };
    }
    const record = session as Record<string, unknown>;
    return {
      paid: record.mode === "payment" && record.payment_status === "paid",
      status: 200,
    };
  } catch {
    return { paid: false, status: 502 };
  }
}

Deno.serve(async (req: Request) => {
  const origin = getAllowedOrigin(req);
  if (!origin) return new Response("Origin not allowed", { status: 403 });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  const callerKey = req.headers.get("apikey");
  const publishableKeys = getPublishableKeys();
  if (!callerKey || publishableKeys.size === 0 || !publishableKeys.has(callerKey)) {
    return jsonResponse({ error: "Unauthorized." }, 401, origin);
  }

  const stripeKey = getTestStripeKey();
  if (!stripeKey) {
    console.error("Stripe Test Mode secret is not configured.");
    return jsonResponse({ error: "Checkout is not configured for Test Mode." }, 503, origin);
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await req.text();
    if (rawBody.length > 20_000) {
      return jsonResponse({ error: "Request is too large." }, 413, origin);
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return jsonResponse({ error: "Invalid request." }, 400, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400, origin);
  }

  if (body.action === "verify") {
    if (typeof body.sessionId !== "string") {
      return jsonResponse({ error: "Invalid checkout session." }, 400, origin);
    }
    const result = await verifyCheckoutSession(body.sessionId, stripeKey);
    return jsonResponse({ paid: result.paid }, result.status, origin);
  }

  if (body.action !== "create") {
    return jsonResponse({ error: "Invalid checkout action." }, 400, origin);
  }

  const lines = parseCartItems(body.items);
  if (!lines) return jsonResponse({ error: "Your bag could not be validated." }, 400, origin);

  const products = await readProducts(lines, callerKey, req.headers.get("authorization"));
  if (!products) {
    return jsonResponse({ error: "The product catalog is temporarily unavailable." }, 503, origin);
  }
  if (products.length !== lines.length) {
    return jsonResponse({ error: "One or more items are no longer available." }, 400, origin);
  }

  const productById = new Map(products.map((product) => [Number(product.id), product]));
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/?checkout=cancelled`);
  form.set("billing_address_collection", "auto");
  form.set("metadata[store]", "ROSE");

  for (const [index, line] of lines.entries()) {
    const product = productById.get(line.id);
    if (!product || product.currency !== "KWD" || typeof product.name !== "string") {
      return jsonResponse({ error: "One or more items cannot be checked out." }, 400, origin);
    }

    const unitAmount = getUsdUnitAmountFromKwd(product.price);
    if (unitAmount === null) {
      return jsonResponse({ error: "A product price is invalid." }, 400, origin);
    }

    const prefix = `line_items[${index}]`;
    form.set(`${prefix}[quantity]`, String(line.quantity));
    form.set(`${prefix}[price_data][currency]`, "usd");
    form.set(`${prefix}[price_data][unit_amount]`, String(unitAmount));
    form.set(`${prefix}[price_data][product_data][name]`, product.name.slice(0, 200));
    if (typeof product.description === "string" && product.description.trim()) {
      form.set(
        `${prefix}[price_data][product_data][description]`,
        product.description.trim().slice(0, 500),
      );
    }
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const stripeError = typeof errorBody === "object" && errorBody !== null
        ? (errorBody as Record<string, unknown>).error
        : null;
      const safeErrorField = (value: unknown) =>
        typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value)
          ? value
          : undefined;
      const safeStripeError = typeof stripeError === "object" && stripeError !== null
        ? stripeError as Record<string, unknown>
        : {};
      const stripeMessage = typeof safeStripeError.message === "string"
        ? safeStripeError.message
          .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b/g, "[redacted]")
          .slice(0, 180)
        : undefined;
      console.error("Stripe checkout session request failed.", {
        status: response.status,
        type: safeErrorField(safeStripeError.type),
        code: safeErrorField(safeStripeError.code),
        param: safeErrorField(safeStripeError.param),
      });
      if (/invalid currency:\s*kwd/i.test(stripeMessage ?? "")) {
        return jsonResponse(
          { error: "KWD is not enabled in this Stripe Test Mode account. Enable KWD in Stripe account settings, then try again." },
          409,
          origin,
        );
      }
      return jsonResponse({ error: "Stripe could not start checkout. Please try again." }, 502, origin);
    }

    const session: unknown = await response.json();
    if (typeof session !== "object" || session === null) {
      return jsonResponse({ error: "Stripe returned an invalid checkout response." }, 502, origin);
    }
    const checkoutUrl = (session as Record<string, unknown>).url;
    if (typeof checkoutUrl !== "string") {
      return jsonResponse({ error: "Stripe did not return a checkout link." }, 502, origin);
    }

    const parsedUrl = new URL(checkoutUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.stripe.com") {
      return jsonResponse({ error: "Stripe returned an invalid checkout link." }, 502, origin);
    }

    return jsonResponse({ url: parsedUrl.toString() }, 200, origin);
  } catch {
    console.error("Stripe checkout session request could not be completed.");
    return jsonResponse({ error: "Checkout could not be started. Please try again." }, 502, origin);
  }
});
