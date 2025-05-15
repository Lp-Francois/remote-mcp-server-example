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
      "Get information about a Pokemon from PokeAPI, including abilities and their effects.",
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
          const data: {
            name: string;
            base_experience: number;
            abilities: { ability: { name: string; url: string } }[];
          } = await response.json();
          const name = data.name;
          const baseExperience = data.base_experience;
          const abilities = data.abilities;

          // Fetch ability details in parallel
          const abilityDetails = await Promise.all(
            abilities.map(async (ab) => {
              const abilityRes = await fetch(ab.ability.url);
              if (!abilityRes.ok) return null;
              const abilityData: {
                names: { name: string; language: { name: string } }[];
                effect_entries: {
                  effect: string;
                  short_effect: string;
                  language: { name: string };
                }[];
                flavor_text_entries?: {
                  flavor_text: string;
                  language: { name: string };
                }[];
              } = await abilityRes.json();
              // Find English name, effect, and flavor text
              const nameEntry = abilityData.names.find(
                (n: any) => n.language.name === "en"
              );
              const effectEntry = abilityData.effect_entries.find(
                (e: any) => e.language.name === "en"
              );
              const flavorEntry = abilityData.flavor_text_entries?.find(
                (f: any) => f.language.name === "en"
              );
              return {
                name: nameEntry?.name || ab.ability.name,
                effect: effectEntry?.effect || "",
                short_effect: effectEntry?.short_effect || "",
                flavor_text: flavorEntry?.flavor_text || "",
              };
            })
          );

          const abilityDescriptions = abilityDetails
            .filter(Boolean)
            .map(
              (ad) =>
                `Ability: ${ad!.name}\nEffect: ${ad!.short_effect}\n${
                  ad!.flavor_text ? `Flavor: ${ad!.flavor_text}` : ""
                }`
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text",
                text: `Pokemon: ${name}, Base Experience: ${baseExperience}\n\n${abilityDescriptions}`,
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
