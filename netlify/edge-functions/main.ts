import { Window as HappyWindow } from "happy-dom";
import type { Config } from "@netlify/edge-functions";
import { extractContent } from "@lamartinecabral/extract-content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return new Response(null, {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required query parameter: url" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return new Response(
      JSON.stringify({ error: "Only http and https URLs are allowed" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let html: string;
  try {
    const response = await fetch(parsedUrl.toString());
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Upstream request failed: ${response.status} ${response.statusText}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    html = await response.text();
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `Failed to fetch URL: ${(err as Error).message}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const happyWindow = new HappyWindow({ url: parsedUrl.toString() });
  happyWindow.document.write(html);

  const { content } = extractContent(happyWindow.document);

  await happyWindow.happyDOM.close();

  return new Response(content, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config: Config = {
  path: "/",
};
