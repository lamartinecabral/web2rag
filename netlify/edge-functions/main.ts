import { Node, Window } from "https://esm.sh/happy-dom@20.10.6";
import type { Document, HTMLElement } from "https://esm.sh/happy-dom@20.10.6";
import type { Config } from "@netlify/edge-functions";
import type IHTMLElementTagNameMap from "https://esm.sh/happy-dom@20.10.6/lib/config/IHTMLElementTagNameMap.d.ts";

const extractContent = (document: Document) => {
  const title = document.title?.trim();

  const marginStart = (text = "", n = 0) => {
    let start = "";
    for (let i = 1; i <= n; i++) {
      if (!text.startsWith("\n".repeat(i))) {
        start += "\n";
      }
    }
    return start + text;
  };

  const marginEnd = (text = "", n = 0) => {
    let end = "";
    for (let i = 1; i <= n; i++) {
      if (!text.endsWith("\n".repeat(i))) {
        end += "\n";
      }
    }
    return text + end;
  };

  const line = (text = "") => {
    return marginStart(marginEnd(text, 1), 1);
  };

  const block = (text = "") => {
    return marginStart(marginEnd(text, 2), 2);
  };

  const clean = (text = "") => {
    return text.trim().replace(/\n+/g, " ");
  };

  const fixList = (text = "") => {
    return text.replace(/\n([^\-])/g, " $1");
  };

  const mark = (text = "", marker = "") => {
    if (!text.trim()) return text;
    let styled = marker + text.trim() + marker;
    if (text.startsWith(" ")) styled = " " + styled;
    if (text.endsWith(" ")) styled = styled + " ";
    return styled;
  };

  const concat = (text1 = "", text2 = "") => {
    if (text1.endsWith("\n\n") && text2.startsWith("\n\n")) {
      return text1 + text2.slice(2);
    }
    if (text1.endsWith("\n") && text2.startsWith("\n")) {
      return text1 + text2.slice(1);
    }
    return text1 + text2;
  };

  const assertElem = <T extends keyof IHTMLElementTagNameMap = "main">(
    node: Node,
    tag?: T,
  ): "main" extends T ? HTMLElement : IHTMLElementTagNameMap[T] => {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (!tag || node.nodeName === tag.toUpperCase())
    ) {
      // @ts-ignore: ignore
      return node;
    }
    throw new Error(
      `Expected element of type ${tag}, but got ${node.nodeName}`,
    );
  };

  const extractText = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const isHidden = ((e) =>
        e.style.display === "none" ||
        e.style.visibility === "hidden" ||
        e.hidden)(assertElem(node));
      if (isHidden) {
        return "";
      }

      switch (node.nodeName) {
        case "SCRIPT":
        case "NOSCRIPT":
        case "STYLE":
        case "FORM":
        case "IFRAME":
        case "SVG":
          return "";
        case "BR":
          return "\n";
        case "HR":
          return block("---");
        case "IMG":
        case "VIDEO": {
          const text = String(
            "alt" in node ? node.alt : "title" in node ? node.title : "",
          ).trim();
          return text ? `(${node.nodeName}: ${text}) ` : "";
        }
        case "SELECT": {
          const selectedOptions = [
            ...assertElem(node, "select").selectedOptions,
          ];
          return selectedOptions.length > 0
            ? selectedOptions.map((o) => o.innerText).join(",") + " "
            : "";
        }
        case "PRE":
          return block("```\n" + assertElem(node, "pre").innerText + "\n```");
        case "LI": {
          const innerText = assertElem(node, "li").innerText;
          return innerText.trim() ? line("- " + clean(innerText)) : "";
        }
      }

      let text = "";
      node.childNodes.forEach((child) => {
        const childText =
          child.nodeType === Node.TEXT_NODE
            ? child.textContent
            : extractText(child);
        if ((!text || text.endsWith("\n")) && !childText.trim()) return;
        text = concat(text, childText);
      });

      switch (node.nodeName) {
        case "SPAN":
        case "LABEL":
        case "A":
          return text;
        case "P":
        case "SECTION":
        case "ARTICLE":
        case "MAIN":
          return text.trim() ? block(text) : "";
        case "OL":
          return text.trim()
            ? block(fixList(text).replaceAll("\n- ", "\n1. "))
            : "";
        case "UL":
          return text.trim() ? block(fixList(text)) : "";
        case "TABLE":
        case "TBODY":
          return text.trim() ? block(text) : "";
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6":
          if (!text.trim()) return "";
          return block("#".repeat(+node.nodeName[1]) + " " + clean(text));
        case "TR": {
          const isHeaderRow = !!assertElem(node, "tr").querySelector("th");
          if (isHeaderRow) {
            return marginEnd(
              marginStart("| " + text.trim(), 2) +
                `\n| ${" --- |".repeat(text.split(" | ").length)}`,
              1,
            );
          }
          return line("| " + text.trim());
        }
        case "TD":
        case "TH":
          return text.trim() ? " " + clean(text) + " |" : "";
        case "B":
        case "STRONG":
          return mark(text, "**");
        case "I":
        case "EM":
          return mark(text, "_");
        case "DEL":
          return mark(text, "~");
        case "CODE":
          return mark(text, "`");
        case "BLOCKQUOTE":
          return text.trim()
            ? block(
                text
                  .trim()
                  .split("\n")
                  .map((line) => "> " + line)
                  .join("\n") + "\n",
              )
            : "";
      }

      return text.trim() ? line(text) : "";
    }

    return "";
  };

  const main = document.querySelectorAll("main");
  let text = "";

  try {
    text = extractText(main.length === 1 ? main[0] : document.body).trim();
  } catch (_) {
    text = document.body.innerText.trim();
  }

  return { title, content: text };
};

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

  const window = new Window({ url: parsedUrl.toString() });
  window.document.write(html);

  const { content } = extractContent(window.document);

  await window.happyDOM.close();

  return new Response(content, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config: Config = {
  path: "/",
};
