function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapProduct(value) {
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

  return product;
}

export default async function handler(request, response) {
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

    const rows = await result.json();
    if (!Array.isArray(rows)) {
      throw new Error("Supabase returned an unexpected product list");
    }

    response.status(200).json(rows.map(mapProduct));
  } catch (error) {
    console.error(
      "Supabase product catalog is unavailable",
      error instanceof Error ? error.message : "Unknown error",
    );
    response.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
}
