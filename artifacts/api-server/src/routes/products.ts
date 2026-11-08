import { Router, type IRouter } from "express";
import { GetProductsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

router.get("/products", async (req, res): Promise<void> => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    req.log.error(
      { hasUrl: Boolean(supabaseUrl), hasPublishableKey: Boolean(publishableKey) },
      "Supabase catalog is not configured",
    );
    res.status(503).json({ error: "Product catalog is temporarily unavailable." });
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
    const response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Accept-Profile": "public",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const errorCode = isRecord(errorBody) && typeof errorBody.code === "string" ? errorBody.code : undefined;
      const errorMessage = isRecord(errorBody) && typeof errorBody.message === "string"
        ? errorBody.message.slice(0, 200)
        : undefined;
      req.log.error({ statusCode: response.status, errorCode, errorMessage }, "Supabase product query failed");
      res.status(503).json({ error: "Product catalog is temporarily unavailable." });
      return;
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Supabase returned an unexpected product list");
    const products = rows.map((value) => {
      if (!isRecord(value)) throw new Error("Supabase returned an invalid product row");
      return {
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
    });
    res.json(GetProductsResponse.parse(products));
  } catch (error) {
    req.log.error({ err: error }, "Supabase product catalog is unavailable");
    res.status(503).json({ error: "Product catalog is temporarily unavailable." });
  }
});

export default router;
