import { createTool } from "@mastra/core";
import { z } from "zod";
import { loadStoredTokens } from "../lib/tokenManager";
import { 
  googleFreeBusyTool,
  googleCreateEventTool,
  googleListEventsTool,
  googleUpdateEventTool,
  googleDeleteEventTool
} from "./calendar-tools";

// Auto-wrapper que inyecta tokens automáticamente
function createAutoTool<T extends z.ZodSchema>(
  originalTool: any,
  inputSchema: T
) {
  return createTool({
    id: `auto-${originalTool.id}`,
    description: originalTool.description,
    execute: async (context: z.infer<T>) => {
      const tokens = loadStoredTokens();
      
      if (!tokens) {
        return {
          success: false,
          error: "No OAuth tokens found. Run: node start-oauth.js",
          message: "Authentication required"
        };
      }

      // Inyectar tokens automáticamente
      const contextWithAuth = {
        ...context,
        oauth: tokens
      };

      return await originalTool.execute(contextWithAuth);
    }
  });
}

// Schemas sin el campo oauth (se inyecta automáticamente)
const autoFreeBusyInputSchema = z.object({
  timeMinISO: z.string().describe("Inicio ISO8601, ej. 2025-08-11T09:00:00Z"),
  timeMaxISO: z.string().describe("Fin ISO8601, ej. 2025-08-11T18:00:00Z"),
  calendarIds: z.array(z.string()).default(["primary"]),
  timeZone: z.string().optional().describe("TZ para normalizar, ej. America/Los_Angeles"),
});

const autoCreateEventInputSchema = z.object({
  calendarId: z.string().default("primary"),
  summary: z.string(),
  description: z.string().optional(),
  startISO: z.string(),
  endISO: z.string(),
  timeZone: z.string().optional(),
  attendees: z.array(z.object({ 
    email: z.string(), 
    optional: z.boolean().optional() 
  })).default([]),
  location: z.string().optional(),
  conferenceData: z.object({
    createMeetLink: z.boolean().default(false),
  }).optional(),
});

const autoListEventsInputSchema = z.object({
  calendarId: z.string().default("primary"),
  timeMinISO: z.string().describe("Inicio ISO8601"),
  timeMaxISO: z.string().describe("Fin ISO8601"),
  maxResults: z.number().default(10),
  timeZone: z.string().optional(),
});

const autoUpdateEventInputSchema = z.object({
  calendarId: z.string().default("primary"),
  eventId: z.string(),
  updates: z.object({
    summary: z.string().optional(),
    description: z.string().optional(),
    startISO: z.string().optional(),
    endISO: z.string().optional(),
    timeZone: z.string().optional(),
    location: z.string().optional(),
  }),
});

const autoDeleteEventInputSchema = z.object({
  calendarId: z.string().default("primary"),
  eventId: z.string(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
});

// Tools con auto-autenticación
export const autoGoogleFreeBusyTool = createAutoTool(googleFreeBusyTool, autoFreeBusyInputSchema);
export const autoGoogleCreateEventTool = createAutoTool(googleCreateEventTool, autoCreateEventInputSchema);
export const autoGoogleListEventsTool = createAutoTool(googleListEventsTool, autoListEventsInputSchema);
export const autoGoogleUpdateEventTool = createAutoTool(googleUpdateEventTool, autoUpdateEventInputSchema);
export const autoGoogleDeleteEventTool = createAutoTool(googleDeleteEventTool, autoDeleteEventInputSchema);