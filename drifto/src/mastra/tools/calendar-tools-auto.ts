import { createTool } from "@mastra/core";
import { z } from "zod";
import { loadStoredTokens, loadUserTokens, listActiveUsers } from "../lib/tokenManager";
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
    description: `${originalTool.description} (Auto-authenticated)`,
    inputSchema: inputSchema,
    execute: async (context: any) => {
      // Parse context with schema
      const parsedContext = inputSchema.parse(context);
      
      let tokens = null;
      
      // Si se proporciona userId, usarlo
      if (parsedContext.userId) {
        tokens = loadUserTokens(parsedContext.userId);
        if (!tokens) {
          return {
            success: false,
            error: `No OAuth tokens found for user: ${parsedContext.userId}`,
            message: "User not authenticated. Visit auth server to get authenticated.",
          };
        }
      } else {
        // Intentar tokens legacy primero
        tokens = loadStoredTokens();
        
        // Si no hay tokens legacy, intentar encontrar un usuario activo
        if (!tokens) {
          const activeUsers = listActiveUsers();
          if (activeUsers.length === 1) {
            // Si solo hay un usuario activo, usarlo automáticamente
            tokens = loadUserTokens(activeUsers[0]);
            console.log(`🔄 Auto-selected user: ${activeUsers[0]}`);
          } else if (activeUsers.length > 1) {
            return {
              success: false,
              error: "Multiple users available. Please specify userId parameter.",
              message: `Available users: ${activeUsers.join(', ')}. Add userId to your request.`,
              availableUsers: activeUsers,
            };
          }
        }
        
        if (!tokens) {
          return {
            success: false,
            error: "No OAuth tokens found. Run: node auth-server.js",
            message: "Authentication required. Visit the auth server to authenticate.",
            instruction: "Start auth server with: node auth-server.js"
          };
        }
      }

      // Inyectar tokens automáticamente
      const contextWithAuth = {
        ...parsedContext,
        oauth: tokens
      };

      return await originalTool.execute(contextWithAuth);
    }
  });
}

// Schemas sin el campo oauth (se inyecta automáticamente)
const autoFreeBusyInputSchema = z.object({
  userId: z.string().optional().describe("User ID from auth server (optional - will auto-select if only one user)"),
  timeMinISO: z.string().describe("Start time ISO8601, e.g. 2025-08-11T09:00:00Z"),
  timeMaxISO: z.string().describe("End time ISO8601, e.g. 2025-08-11T18:00:00Z"),
  calendarIds: z.array(z.string()).default(["primary"]),
  timeZone: z.string().optional().describe("Timezone for normalization, e.g. America/Los_Angeles"),
});

const autoCreateEventInputSchema = z.object({
  userId: z.string().optional().describe("User ID from auth server (optional - will auto-select if only one user)"),
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
  userId: z.string().optional().describe("User ID from auth server (optional - will auto-select if only one user)"),
  calendarId: z.string().default("primary"),
  timeMinISO: z.string().describe("Start time ISO8601"),
  timeMaxISO: z.string().describe("End time ISO8601"),
  maxResults: z.number().default(10),
  timeZone: z.string().optional(),
});

const autoUpdateEventInputSchema = z.object({
  userId: z.string().optional().describe("User ID from auth server (optional - will auto-select if only one user)"),
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
  userId: z.string().optional().describe("User ID from auth server (optional - will auto-select if only one user)"),
  calendarId: z.string().default("primary"),
  eventId: z.string(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
});

// Tools with auto-authentication
export const autoGoogleFreeBusyTool = createAutoTool(googleFreeBusyTool, autoFreeBusyInputSchema);
export const autoGoogleCreateEventTool = createAutoTool(googleCreateEventTool, autoCreateEventInputSchema);
export const autoGoogleListEventsTool = createAutoTool(googleListEventsTool, autoListEventsInputSchema);
export const autoGoogleUpdateEventTool = createAutoTool(googleUpdateEventTool, autoUpdateEventInputSchema);
export const autoGoogleDeleteEventTool = createAutoTool(googleDeleteEventTool, autoDeleteEventInputSchema);