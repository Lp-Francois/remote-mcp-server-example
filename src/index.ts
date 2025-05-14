import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import OAuthProvider from "@cloudflare/workers-oauth-provider";

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Demo",
		version: "1.0.0",
	});

	async init() {
		this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}));

		this.server.tool(
      "getPokemonInfo",
      "Get information about a Pokemon from PokeAPI",
      {
        pokemon: z.string().describe("The name or ID of the Pokemon to query"),
      },
      async ({ pokemon }) => {
        try {
          const response = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${pokemon.toLowerCase()}`
          );
          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text",
                  text: `Error fetching Pokemon data: ${response.status} ${errorText}`,
                },
              ],
            };
          }
          const data: { name: string; base_experience: number } =
            await response.json();
          const name = data.name;
          const baseExperience = data.base_experience;
          return {
            content: [
              {
                type: "text",
                text: `Pokemon: ${name}, Base Experience: ${baseExperience}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to query PokeAPI: ${error.message}`,
              },
            ],
          };
        }
      }
    );
	}
}

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: "/sse",
	// TODO: fix these types
	// @ts-ignore
	apiHandler: MyMCP.mount("/sse"),
	// @ts-ignore
	defaultHandler: app,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
