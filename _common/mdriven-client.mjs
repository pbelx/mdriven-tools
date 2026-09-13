/**
 * Fast MDriven MCP Client for Node.js (Node 18+)
 * Provides connection reuse, error unwrapping, and typed helper methods.
 */

export class MDrivenClient {
  constructor({ port = 9999, host = 'localhost', route = '/mcp/api' } = {}) {
    this.baseUrl = `http://${host}:${port}${route.startsWith('/') ? route : '/' + route}`;
    this.sessionId = null;
    this.serverInfo = null;
    this.protocolVersion = '2024-11-05';
  }

  async #post(payload) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-protocol-version': this.protocolVersion,
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${this.baseUrl}`);
    }

    const sid = res.headers.get('Mcp-Session-Id');
    if (sid) {
      this.sessionId = sid;
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      return null;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { rawText: text };
    }

    if (json.error) {
      throw new Error(`MCP Error [${json.error.code}]: ${json.error.message}`);
    }
    return json.result;
  }

  async connect() {
    const initRes = await this.#post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: this.protocolVersion,
        capabilities: {},
        clientInfo: { name: 'antigravity-mdriven-client', version: '2.0' },
      },
    });

    this.serverInfo = initRes?.serverInfo;

    // Send initialized notification
    await this.#post({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    });

    return this.serverInfo;
  }

  async listTools() {
    if (!this.serverInfo) await this.connect();
    const res = await this.#post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    return res?.tools || [];
  }

  async evaluateOCL(expression, { context = '', returnAggregates = false } = {}) {
    if (!this.serverInfo) await this.connect();
    const res = await this.#post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel',
        arguments: {
          OCLOrActionExpression: expression,
          ContextForSelfNameOrId: context,
          ReturnObjectAggregatesNotJustTheObject: returnAggregates,
        },
      },
    });
    return this.#parseResult(res);
  }

  async evaluateAction(expression, { context = '', returnAggregates = false } = {}) {
    if (!this.serverInfo) await this.connect();
    const res = await this.#post({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'MCPTool_MDrivenDesigner_EvaluateActionLanguageOnMetaModel',
        arguments: {
          OCLOrActionExpression: expression,
          ContextForSelfNameOrId: context,
          ReturnObjectAggregatesNotJustTheObject: returnAggregates,
        },
      },
    });
    return this.#parseResult(res);
  }

  #parseResult(res) {
    if (!res || !res.content) return { raw: res };
    for (const item of res.content) {
      if (item.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (parsed.RawJson) {
            try {
              const inner = JSON.parse(parsed.RawJson);
              return {
                expression: parsed.OCLOrActionExpression,
                result: inner.resultfromexpression,
                errors: inner.modelwideErrors || [],
                expressionError: inner.expressionError,
                createdObjects: inner.createdobjects || [],
                rawInner: inner,
              };
            } catch {
              return { expression: parsed.OCLOrActionExpression, rawJson: parsed.RawJson };
            }
          }
          return parsed;
        } catch {
          return { text: item.text };
        }
      }
    }
    return res;
  }
}
