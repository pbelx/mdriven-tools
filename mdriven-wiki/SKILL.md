---
name: mdriven-wiki
description: Search and read the public MDriven Wiki through its MCP endpoint. Use for MDriven documentation research, exact wiki page retrieval, namespace or category browsing, page-link exploration, and public wiki file lookup.
---

# MDriven Wiki MCP

Use the live MCP endpoint at `https://wiki.mdriven.net/mcp/public`; do not rely on remembered wiki content or scrape the website when MCP is available.

Initialize MCP, send `notifications/initialized`, then discover capabilities with `tools/list`. The endpoint currently supports MCP protocol `2025-06-18` and identifies itself as `mdriven-wiki`, but treat live handshake data and tool schemas as authoritative.

For research:

- Start with `wiki_search` unless the exact page title is already known.
- Use `wiki_get_page` with `html` for reading rendered prose and `wikitext` when source markup matters.
- Use `wiki_list_namespaces` before restricting searches or listings by namespace id.
- Use `wiki_page_links` to explore related pages, `wiki_category_members` for a category, and `wiki_get_file` for file metadata or content.
- Cite the page URLs returned by MCP when reporting findings.

These public tools are for reading. Do not infer authorization to create, edit, or upload wiki content; those operations require an authenticated account and are not exposed by this endpoint.

When a native MCP connection is unavailable, run the bundled client:

```powershell
node scripts/mdriven_wiki.mjs tools
'{"query":"ViewModels","limit":5}' | node scripts/mdriven_wiki.mjs call wiki_search -
'{"title":"Documentation:ViewModels","format":"html"}' | node scripts/mdriven_wiki.mjs call wiki_get_page -
```

Report connection or protocol failures plainly. A successful HTTP response alone is insufficient verification: require a valid MCP `initialize` result and a successful `tools/list` response.
