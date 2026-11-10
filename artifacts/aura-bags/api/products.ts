type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader(name: string, value: string): unknown;
  status(code: number): VercelResponse;
  json(body: unknown): unknown;
};

type StoreProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: "KWD";
  image: string;
  category: string;
  turntableSlug: string;
  sortOrder: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapProduct(value: unknown): StoreProduct {
  if (!isRecord(value)) {
    throw new Error("Supabase returned an invalid product row");
  }

  const product = {
    id: Number(value.id),
    slug: value.slug,
    name: value.name,
    description: value.description,
    price: Number(value.price),
    currency: value.currency,
    image: value.image,
    category: value.category,
    turntableSlug: value.turntable_slug,
    sortOrder: Number(value.sort_order),
  };

  if (
    !Number.isInteger(product.id) ||
    typeof product.slug !== "string" ||
    typeof product.name !== "string" ||
    typeof product.description !== "string" ||
    !Number.isFinite(product.price) ||
    product.currency !== "KWD" ||
    typeof product.image !== "string" ||
    typeof product.category !== "string" ||
    typeof product.turntableSlug !== "string" ||
    !Number.isInteger(product.sortOrder)
  ) {
    throw new Error("Supabase returned a product with an invalid shape");
  }

  return product as StoreProduct;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    console.error("Supabase catalog is not configured for this Vercel deployment");
    response.status(503).json({ error: "Product catalog is temporarily unavailable." });
    return;
  }

  try {
    const url = new URL("/rest/v1/products", supabaseUrl);
    url.searchParams.set(
      "select",
      "id,slug,name,description,price,currency,image,category,turntable_slug,sort_order",
    );
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("order", "sort_order.asc");

    const result = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Accept-Profile": "public",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!result.ok) {
      console.error("Supabase product query failed", { statusCode: result.status });
      response.status(503).json({ error: "Product catalog is temporarily unavailable." });
      return;
    }

    const rows: unknown = await result.json();
    if (!Array.isArray(rows)) {
      throw new Error("Supabase returned an unexpected product list");
    }

    const products = rows.map(mapProduct);
    response.status(200).json(products);
  } catch (error) {
    console.error(
      "Supabase product catalog is unavailable",
      error instanceof Error ? error.message : "Unknown error",
    );
    response.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
}
