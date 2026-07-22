# MCP server image for emailmd.
#
# Runs the stdio MCP server that ships inside the `emailmd` npm package
# (`emailmd mcp`, see packages/emailmd/src/mcp.ts). Used by MCP directories
# that start the server in a container and introspect its tool list.
#
# The server is stateless and needs no credentials: `render` and `lint` run
# entirely locally, and `read_docs` fetches public pages from emailmd.dev.
#
#   docker build -t emailmd-mcp .
#   docker run -i --rm emailmd-mcp
#
# There is also a hosted endpoint at https://www.emailmd.dev/api/mcp for
# clients that prefer streamable-http over stdio.

FROM node:lts-alpine

# Pinned so the image matches the version published to the MCP registry.
# Bump alongside packages/emailmd/package.json on release.
ENV EMAILMD_VERSION=0.9.1

RUN npm install -g "emailmd@${EMAILMD_VERSION}"

# stdio transport: the client speaks JSON-RPC over stdin/stdout.
ENTRYPOINT ["emailmd", "mcp"]
