import { createMcpHandler } from "mcp-handler";
import {
  registerEmailmdTools,
  EMAILMD_MCP_INSTRUCTIONS,
  EMAILMD_MCP_SERVER_INFO,
} from "emailmd/mcp";

// Stateless Streamable HTTP MCP server at /api/mcp: render and lint are pure
// functions, so every request is independent (no sessions, no Redis).
const handler = createMcpHandler(
  (server) => {
    registerEmailmdTools(server);
  },
  {
    serverInfo: EMAILMD_MCP_SERVER_INFO,
    instructions: EMAILMD_MCP_INSTRUCTIONS,
  },
  {
    basePath: "/api",
    disableSse: true,
  }
);

// A render is ~50-300ms of CPU; anything that runs longer is a pathological
// input, not a legitimate email.
export const maxDuration = 15;

export { handler as GET, handler as POST, handler as DELETE };
