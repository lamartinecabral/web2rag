# web2rag

A Netlify edge function that fetches any public web page and returns its content as clean, Markdown-formatted plain text — ready to feed into RAG (Retrieval-Augmented Generation) pipelines or LLM prompts.

## How it works

Send a `GET` request with a `url` query parameter. The function fetches the target page, builds a DOM with [happy-dom](https://github.com/capricorn86/happy-dom), then parses and extracts the content using [@lamartinecabral/extract-content](https://www.github.com/lamartinecabral/extract-content), converting the structure into readable Markdown:

- Headings → `#` / `##` / … prefixes
- Bold / italic / strikethrough / inline code → `**` / `_` / `~` / `` ` ``
- Lists → `-` (unordered) or `1.` (ordered)
- Tables → pipe-separated Markdown tables
- Code blocks → fenced ` ``` ` blocks
- Block-level elements (`<p>`, `<section>`, `<article>`) → separated paragraphs
- Hidden elements, scripts, styles, forms, iframes, and SVGs are stripped

## Usage

```
GET /?url=<encoded-target-url>
```

### Example

```bash
curl "https://web2rag.netlify.app/?url=https%3A%2F%2Fexample.com"
```

The response body is `text/plain; charset=utf-8` Markdown text.

### Error responses

| Status | Cause                                                        |
| ------ | ------------------------------------------------------------ |
| 400    | Missing or invalid `url` parameter, or non-http/https scheme |
| 405    | Non-GET request (other than OPTIONS pre-flight)              |
| 502    | Upstream fetch failed                                        |

CORS headers (`Access-Control-Allow-Origin: *`) are included on all responses.

## Deployment

The function is deployed automatically by Netlify from the `netlify/edge-functions/main.ts` entry point and is served at the site root (`/`).

```bash
# Install Netlify CLI
npm install

# Run locally
npx netlify dev
```

## Tech stack

- [Netlify Edge Functions](https://docs.netlify.com/edge-functions/overview/) (Deno runtime)
- [@lamartinecabral/extract-content](https://www.github.com/lamartinecabral/extract-content) for content parsing and Markdown extraction
- [happy-dom](https://github.com/capricorn86/happy-dom) for server-side DOM support

## License

[MIT](LICENSE)
