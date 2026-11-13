/** Dependency-free MDriven MCP client (Node 18+). */
export class MDrivenClient {
  constructor({ port = 9999, host = 'localhost', route = '/mcp/api', debug = false } = {}) {
    this.baseUrl = `http://${host}:${port}${route.startsWith('/') ? route : '/' + route}`;
    this.sessionId = null;
    this.serverInfo = null;
    this.protocolVersion = '2024-11-05';
    this.debug = debug;
    this.requestId = 0;
  }

  async #post(payload) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-protocol-version': this.protocolVersion,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    const res = await fetch(this.baseUrl, {
      method: 'POST', headers,
      body: JSON.stringify(payload.id === undefined ? payload : { ...payload, id: ++this.requestId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from ${this.baseUrl}`);
    const sid = res.headers.get('Mcp-Session-Id');
    if (sid) this.sessionId = sid;
    const text = (await res.text()).trim();
    if (!text) return null;
    // Some Designer transports return SSE even for a single JSON-RPC response.
    let json;
    if (text.startsWith('event:') || text.startsWith('data:') || text.startsWith(':')) {
      const messages = text.split(/\r?\n\r?\n/).map(block => block.split(/\r?\n/)
        .filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'))
        .filter(Boolean).map(data => JSON.parse(data));
      json = messages.reverse().find(message => message.id !== undefined);
      if (!json) throw new Error('Missing MCP response in SSE stream');
    } else {
      json = JSON.parse(text);
    }
    if (json.error) throw new Error(`MCP Error [${json.error.code}]: ${json.error.message}`);
    return json.result;
  }

  async connect() {
    if (this.serverInfo) return this.serverInfo;
    const init = await this.#post({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: this.protocolVersion, capabilities: {},
        clientInfo: { name: 'antigravity-mdriven-client', version: '2.1' },
      },
    });
    if (!init?.serverInfo) throw new Error('Invalid MCP initialization response');
    if (init.protocolVersion) this.protocolVersion = init.protocolVersion;
    await this.#post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    this.serverInfo = init.serverInfo;
    return this.serverInfo;
  }

  async listTools() {
    await this.connect();
    const tools = [];
    let cursor;
    do {
      const res = await this.#post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: cursor ? { cursor } : {} });
      if (!Array.isArray(res?.tools)) throw new Error('Invalid MCP tools/list response');
      tools.push(...res.tools);
      cursor = res.nextCursor;
    } while (cursor);
    return tools;
  }

  async evaluateOCL(expression, options = {}) {
    return this.#evaluate('MCPTool_MDrivenDesigner_EvaluateOCLOnMetaModel', expression, options);
  }

  async evaluateAction(expression, options = {}) {
    return this.#evaluate('MCPTool_MDrivenDesigner_EvaluateActionLanguageOnMetaModel', expression, options);
  }

  async #evaluate(name, expression, { context = '', returnAggregates = false } = {}) {
    await this.connect();
    const res = await this.#post({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name, arguments: {
        OCLOrActionExpression: expression,
        ContextForSelfNameOrId: context,
        ReturnObjectAggregatesNotJustTheObject: returnAggregates,
      } },
    });
    if (res?.isError) throw new Error(`MCP tool error: ${(res.content || []).filter(item => item.text).map(item => item.text).join('\n') || 'Unknown error'}`);
    const item = res?.content?.find(item => item.text);
    if (!item) throw new Error('Missing evaluator text response');
    let parsed, inner;
    try {
      parsed = JSON.parse(item.text);
      inner = parsed.RawJson !== undefined ? JSON.parse(parsed.RawJson) : parsed;
    } catch (error) {
      throw new Error(`Invalid evaluator JSON: ${error.message}`);
    }
    if (!inner || typeof inner !== 'object' || (!Object.hasOwn(inner, 'resultfromexpression') && !inner.expressionError)) {
      throw new Error('Invalid evaluator response envelope');
    }
    const errors = inner.modelwideErrors || [];
    const createdObjects = inner.createdobjects || [];
    const result = {
      ok: !inner.expressionError, result: inner.resultfromexpression, errors, modelErrorCount: errors.length,
      ...(createdObjects.length ? { createdObjects } : {}),
      ...(this.debug ? { expression: parsed.OCLOrActionExpression, rawInner: inner } : {}),
    };
    if (inner.expressionError) {
      const error = new Error(`Expression error: ${typeof inner.expressionError === 'string' ? inner.expressionError : JSON.stringify(inner.expressionError)}`);
      error.evaluation = { ...result, expressionError: inner.expressionError };
      throw error;
    }
    return result;
  }
}
