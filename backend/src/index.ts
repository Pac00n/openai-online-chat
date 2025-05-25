import WebSocket, { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  console.error('[DOTENV_DEBUG] Error loading .env file:', dotenvResult.error);
} else {
  console.log('[DOTENV_DEBUG] .env file loaded. Parsed variables (if any):', dotenvResult.parsed);
  if (process.env.OPENAI_API_KEY) {
    console.log('[DOTENV_DEBUG] OPENAI_API_KEY found in process.env');
  } else {
    console.warn('[DOTENV_DEBUG] OPENAI_API_KEY NOT found in process.env');
  }
  if (process.env.BRAVE_API_KEY) {
    console.log('[DOTENV_DEBUG] BRAVE_API_KEY found in process.env');
  } else {
    console.warn('[DOTENV_DEBUG] BRAVE_API_KEY NOT found in process.env');
  }
}

const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

if (!OPENAI_API_KEY) {
    console.error("CRITICAL ERROR: OPENAI_API_KEY is not defined. Please set it in backend/.env");
    process.exit(1);
}
if (!BRAVE_API_KEY) {
    console.warn("WARNING: BRAVE_API_KEY is not defined. Brave Search MCP tool will not be available.");
}

const wss = new WebSocketServer({ port: PORT as number });
console.log(`Backend WebSocket server starting on ws://localhost:${PORT}/chat ...`);

interface ClientSessionData { model?: string; }
const clientSessions = new Map<WebSocket, ClientSessionData>();

interface MCPTool { name: string; description: string; inputSchema: any; }
let braveMcpTools: MCPTool[] = [];
let braveMcpProcess: ChildProcessWithoutNullStreams | null = null;
let mcpRequestIdCounter = 0;
const mcpPendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

function startBraveMcpServer() {
    if (!BRAVE_API_KEY) {
        console.log("Brave MCP Server cannot start: BRAVE_API_KEY is not set.");
        return;
    }
    console.log("Attempting to start Brave Search MCP server...");
    braveMcpProcess = spawn('npx', ['@modelcontextprotocol/server-brave-search'], {
        env: { ...process.env, BRAVE_API_KEY },
        shell: process.platform === 'win32'
    });

    braveMcpProcess.on('error', (err) => {
        console.error('Failed to start Brave MCP server process:', err);
        braveMcpProcess = null;
    });

    let stdoutBuffer = '';
    braveMcpProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        let newlineIndex;
        while ((newlineIndex = stdoutBuffer.indexOf('
')) >= 0) {
            const messageStr = stdoutBuffer.substring(0, newlineIndex).trim();
            stdoutBuffer = stdoutBuffer.substring(newlineIndex + 1);
            if (!messageStr) continue;

            console.log('[BraveMCP STDOUT Raw]:', messageStr);
            try {
                const message = JSON.parse(messageStr);
                if (message.id && mcpPendingRequests.has(message.id)) {
                    const promiseHandlers = mcpPendingRequests.get(message.id);
                    if (message.status === 'success') {
                        promiseHandlers?.resolve(message.results || message.content);
                    } else if (message.tools) {
                        promiseHandlers?.resolve(message.tools);
                    } else {
                        promiseHandlers?.reject(new Error(message.error || 'Brave MCP Error'));
                    }
                    mcpPendingRequests.delete(message.id);
                } else if (message.tools && !message.id) {
                    console.log("Received tools from Brave MCP (auto-list):");
                    braveMcpTools = message.tools.map((t: any) => ({
                        name: t.tool_name || t.name,
                        description: t.description,
                        inputSchema: t.input_schema || t.inputSchema
                    }));
                    console.log("Brave MCP Tools registered (auto-list):", JSON.stringify(braveMcpTools, null, 2));
                } else {
                    console.warn("[BraveMCP STDOUT Parsed] Received unhandled message:", message);
                }
            } catch (e) {
                console.error("[BraveMCP STDOUT] Error parsing JSON from stdout:", messageStr, e);
            }
        }
    });

    braveMcpProcess.stderr.on('data', (data) => { console.error('[BraveMCP STDERR]:', data.toString()); });
    braveMcpProcess.on('close', (code) => {
        console.log(`Brave MCP server process exited with code ${code}`);
        braveMcpProcess = null; braveMcpTools = [];
    });

    setTimeout(() => {
        if (braveMcpProcess && braveMcpProcess.stdin.writable) {
            console.log("Explicitly sending list_tools to Brave MCP server...");
            sendToBraveMcp({ action: 'list_tools' })
                .then(tools => {
                    if (Array.isArray(tools)) {
                        braveMcpTools = tools.map((t: any) => ({
                            name: t.tool_name || t.name,
                            description: t.description,
                            inputSchema: t.input_schema || t.inputSchema
                        }));
                        console.log("Brave MCP Tools discovered via explicit list_tools:", JSON.stringify(braveMcpTools, null, 2));
                    } else {
                        console.warn("list_tools response from Brave MCP was not an array:", tools);
                    }
                })
                .catch(err => console.error("Error explicitly listing Brave MCP tools:", err));
        }
    }, 3000);
}

async function sendToBraveMcp(payload: { action: 'list_tools' } | { action: 'invoke', tool_name: string, arguments: any }): Promise<any> {
    if (!braveMcpProcess || !braveMcpProcess.stdin.writable) {
        return Promise.reject(new Error("Brave MCP process not available"));
    }
    const id = `mcp_req_${mcpRequestIdCounter++}`;
    const message = JSON.stringify({ protocol: 'mcp', version: 1, id, ...payload });
    console.log(`[BraveMCP SENDING (id: ${id})]: ${message}`);
    braveMcpProcess.stdin.write(message + '
');
    return new Promise((resolve, reject) => {
        mcpPendingRequests.set(id, { resolve, reject });
        setTimeout(() => {
            if (mcpPendingRequests.has(id)) {
                mcpPendingRequests.delete(id);
                reject(new Error(`Timeout for Brave MCP req id ${id}`));
            }
        }, 15000);
    });
}

if (BRAVE_API_KEY) startBraveMcpServer();

wss.on('connection', (ws) => {
    console.log('Frontend client connected');
    clientSessions.set(ws, { model: 'gpt-4o-mini' });

    ws.on('message', async (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message.toString());
            console.log('FE msg:', parsedMessage);
        } catch (error) {
            console.error('FE msg parse error:', message.toString(), error);
            ws.send(JSON.stringify({ type: 'ERROR', payload: { error: 'Invalid JSON' } }));
            return;
        }

        const messageId = parsedMessage.messageId;
        const sessionData = clientSessions.get(ws);
        if (!sessionData) { console.error('No session data'); ws.terminate(); return; }

        if (parsedMessage.type === 'INIT') {
            if (parsedMessage.payload?.model) sessionData.model = parsedMessage.payload.model;
            console.log(`Client model: ${sessionData.model}`);
        } else if (parsedMessage.type === 'USER_MESSAGE') {
            if (!parsedMessage.payload || typeof parsedMessage.payload.content !== 'string') {
                ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: 'Invalid user msg content' } }));
                return;
            }
            const userContent: string = parsedMessage.payload.content;
            const history: any[] = (parsedMessage.payload.history || []).map((h: any) => ({ role: h.role, content: h.content }));
            const currentModel: string = sessionData.model || 'gpt-4o-mini';
            console.log(`Processing: "${userContent}", model: ${currentModel}, BraveTools: ${braveMcpTools.length}`);

            try {
                const messagesForOpenAI = [{ role: 'system', content: 'Asistente útil. Usa herramientas web si es necesario.' }, ...history.slice(-10), { role: 'user', content: userContent }];
                const openaiPayload: any = { model: currentModel, messages: messagesForOpenAI };
                if (braveMcpTools.length > 0) {
                    openaiPayload.tools = braveMcpTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
                    openaiPayload.tool_choice = "auto";
                }

                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(openaiPayload),
                });

                if (!openaiResponse.ok) {
                    const err = await openaiResponse.json().catch(() => ({})) as any;
                    console.error('OpenAI API err:', openaiResponse.status, err);
                    ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: `OpenAI Error: ${err.error?.message || openaiResponse.statusText}` } }));
                    return;
                }

                const responseData = await openaiResponse.json() as any;
                const assistantMessage = responseData.choices[0]?.message;

                if (assistantMessage.tool_calls && braveMcpProcess) {
                    console.log("OpenAI tool_calls:", assistantMessage.tool_calls);
                    const toolCall = assistantMessage.tool_calls[0];
                    const toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments);

                    if (braveMcpTools.some(t => t.name === toolName)) {
                        try {
                            console.log(`Invoking Brave: ${toolName}, args:`, toolArgs);
                            const toolResults = await sendToBraveMcp({ action: 'invoke', tool_name: toolName, arguments: toolArgs });
                            console.log("Brave result:", toolResults);
                            const messagesWithToolResult = [...messagesForOpenAI, assistantMessage, { role: 'tool', tool_call_id: toolCall.id, name: toolName, content: JSON.stringify(toolResults) }];
                            const secondResp = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model: currentModel, messages: messagesWithToolResult }),
                            });
                            if (!secondResp.ok) {
                                const err = await secondResp.json().catch(() => ({})) as any;
                                console.error('OpenAI 2nd call err:', secondResp.status, err);
                                ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: `OpenAI Error (2nd call): ${err.error?.message || secondResp.statusText}` } }));
                                return;
                            }
                            const finalData = await secondResp.json() as any;
                            ws.send(JSON.stringify({ type: 'ASSISTANT_RESPONSE', messageId, payload: { content: finalData.choices[0]?.message?.content } }));
                        } catch (toolError: any) {
                            console.error(`Brave tool ${toolName} err:`, toolError);
                            ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: `Tool ${toolName} Error: ${toolError.message}` } }));
                        }
                    } else {
                        console.warn(`OpenAI tool ${toolName} not in Brave tools.`);
                        ws.send(JSON.stringify({ type: 'ASSISTANT_RESPONSE', messageId, payload: { content: "Intenté usar herramienta desconocida." } }));
                    }
                } else if (assistantMessage.content) {
                    ws.send(JSON.stringify({ type: 'ASSISTANT_RESPONSE', messageId, payload: { content: assistantMessage.content } }));
                } else {
                    console.error('No content/tool_calls in OpenAI resp:', responseData);
                    ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: 'OpenAI respuesta inesperada' } }));
                }
            } catch (error: any) {
                console.error('General processing err:', error);
                ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: error.message || 'Backend error' } }));
            }
        } else {
            console.warn('Unknown FE msg type:', parsedMessage.type);
            ws.send(JSON.stringify({ type: 'ERROR', messageId, payload: { error: `Unknown msg type: ${parsedMessage.type}` } }));
        }
    });
    ws.on('close', () => { console.log('FE client disconnected'); clientSessions.delete(ws); });
    ws.on('error', (err) => { console.error('Client WebSocket err:', err); });
});

console.log(`Backend WebSocket server listening on port ${PORT}`);
process.on('SIGINT', () => {
    console.log('SIGINT. Shutting down...');
    if (braveMcpProcess) { console.log('Killing Brave MCP...'); braveMcpProcess.kill(); }
    wss.clients.forEach(c => c.close());
    wss.close(() => { console.log('WebSocket server closed.'); process.exit(0); });
});
