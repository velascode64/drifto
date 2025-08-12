import { createTool } from "@mastra/core";
import { z } from "zod";
import { getGoogleCalendarClient } from "../lib/googleClient";
import { loadStoredTokens } from "../lib/tokenManager";

// Define schemas first
const freeBusySchema = z.object({
  timeMinISO: z.string().describe("Start time ISO8601"),
  timeMaxISO: z.string().describe("End time ISO8601"),
  calendarIds: z.array(z.string()).default(["primary"]),
  timeZone: z.string().optional(),
});

const createEventSchema = z.object({
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
  createMeetLink: z.boolean().default(false),
});

const listEventsSchema = z.object({
  timeMinISO: z.string().describe("Start time ISO8601"),
  timeMaxISO: z.string().describe("End time ISO8601"),
  maxResults: z.number().default(10),
  timeZone: z.string().optional(),
});

const updateEventSchema = z.object({
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startISO: z.string().optional(),
  endISO: z.string().optional(),
  timeZone: z.string().optional(),
  location: z.string().optional(),
});

const deleteEventSchema = z.object({
  eventId: z.string(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
});

// Tool de FreeBusy simplificado con tokens automáticos
export const simpleFreeBusyTool = createTool({
  id: "simple-freebusy",
  description: "Check calendar availability for a time range",
  inputSchema: freeBusySchema,
  execute: async (context) => {
    // Type-safe input
    const input = context as z.infer<typeof freeBusySchema>;
    
    // Cargar tokens automáticamente
    const tokens = loadStoredTokens();
    if (!tokens) {
      return {
        success: false,
        error: "No tokens found. Run: npm run auth",
      };
    }

    try {
      const client = getGoogleCalendarClient(tokens);
      const resp = await client.freebusy.query({
        requestBody: {
          timeMin: input.timeMinISO,
          timeMax: input.timeMaxISO,
          items: input.calendarIds.map((id) => ({ id })),
          timeZone: input.timeZone,
        },
      });

      const fb = resp.data.calendars ?? {};
      const busy = Object.entries(fb).flatMap(([calId, v]: any) =>
        (v.busy ?? []).map((b: any) => ({ 
          start: b.start, 
          end: b.end, 
          calendarId: calId 
        })),
      );

      return { 
        success: true,
        busy,
        message: `Found ${busy.length} busy time slots` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  },
});

// Tool de Create Event simplificado
export const simpleCreateEventTool = createTool({
  id: "simple-create-event",
  description: "Create a calendar event",
  inputSchema: createEventSchema,
  execute: async (context) => {
    const input = context as z.infer<typeof createEventSchema>;
    const tokens = loadStoredTokens();
    if (!tokens) {
      return {
        success: false,
        error: "No tokens found. Run: npm run auth",
      };
    }

    try {
      const client = getGoogleCalendarClient(tokens);
      
      // Ensure ISO format is correct (remove milliseconds if present)
      const formatDateTime = (iso: string | undefined) => {
        if (!iso) return '';
        // Remove milliseconds (.000) if present
        return iso.replace(/\.\d{3}/, '');
      };

      const requestBody: any = {
        summary: input.summary,
        description: input.description,
        start: { 
          dateTime: formatDateTime(input.startISO),
          ...(input.timeZone && { timeZone: input.timeZone })
        },
        end: { 
          dateTime: formatDateTime(input.endISO),
          ...(input.timeZone && { timeZone: input.timeZone })
        },
        attendees: input.attendees,
        location: input.location,
      };

      if (input.createMeetLink) {
        requestBody.conferenceData = {
          createRequest: { requestId: `drifto-${Date.now()}` },
        };
      }

      const { data } = await client.events.insert({
        calendarId: "primary",
        requestBody,
        conferenceDataVersion: input.createMeetLink ? 1 : undefined,
        sendUpdates: "all",
      });

      return { 
        success: true,
        eventId: data.id!, 
        htmlLink: data.htmlLink,
        message: `Event "${input.summary}" created successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  },
});

// Tool de List Events simplificado
export const simpleListEventsTool = createTool({
  id: "simple-list-events",
  description: "List calendar events in a time range",
  inputSchema: listEventsSchema,
  execute: async (context) => {
    const input = context as z.infer<typeof listEventsSchema>;
    const tokens = loadStoredTokens();
    if (!tokens) {
      return {
        success: false,
        error: "No tokens found. Run: npm run auth",
      };
    }

    try {
      const client = getGoogleCalendarClient(tokens);
      
      const { data } = await client.events.list({
        calendarId: "primary",
        timeMin: input.timeMinISO,
        timeMax: input.timeMaxISO,
        maxResults: input.maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: input.timeZone,
      });

      const events = (data.items || []).map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        attendees: event.attendees?.map(a => ({
          email: a.email,
          responseStatus: a.responseStatus,
        })),
        meetLink: event.hangoutLink,
      }));

      return {
        success: true,
        events,
        message: `Found ${events.length} events`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  },
});

// Tool de Update Event simplificado
export const simpleUpdateEventTool = createTool({
  id: "simple-update-event",
  description: "Update an existing calendar event",
  inputSchema: updateEventSchema,
  execute: async (context) => {
    const input = context as z.infer<typeof updateEventSchema>;
    const tokens = loadStoredTokens();
    if (!tokens) {
      return {
        success: false,
        error: "No tokens found. Run: npm run auth",
      };
    }

    try {
      const client = getGoogleCalendarClient(tokens);
      
      // Get current event
      const { data: currentEvent } = await client.events.get({
        calendarId: "primary",
        eventId: input.eventId,
      });

      // Prepare updates
      const requestBody: any = {
        ...currentEvent,
        summary: input.summary || currentEvent.summary,
        description: input.description || currentEvent.description,
        location: input.location || currentEvent.location,
      };

      // Ensure ISO format is correct (remove milliseconds if present)
      const formatDateTime = (iso: string | undefined) => {
        if (!iso) return '';
        return iso.replace(/\.\d{3}/, '');
      };

      if (input.startISO) {
        requestBody.start = { 
          dateTime: formatDateTime(input.startISO),
          ...(input.timeZone && { timeZone: input.timeZone })
        };
      }

      if (input.endISO) {
        requestBody.end = {
          dateTime: formatDateTime(input.endISO),
          ...(input.timeZone && { timeZone: input.timeZone })
        };
      }

      const { data } = await client.events.update({
        calendarId: "primary",
        eventId: input.eventId,
        requestBody,
        sendUpdates: "all",
      });

      return {
        success: true,
        eventId: data.id!,
        htmlLink: data.htmlLink,
        message: `Event updated successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  },
});

// Tool de Delete Event simplificado
export const simpleDeleteEventTool = createTool({
  id: "simple-delete-event",
  description: "Delete a calendar event",
  inputSchema: deleteEventSchema,
  execute: async (context) => {
    const input = context as z.infer<typeof deleteEventSchema>;
    const tokens = loadStoredTokens();
    if (!tokens) {
      return {
        success: false,
        error: "No tokens found. Run: npm run auth",
      };
    }

    try {
      const client = getGoogleCalendarClient(tokens);
      
      await client.events.delete({
        calendarId: "primary",
        eventId: input.eventId,
        sendUpdates: input.sendUpdates,
      });

      return {
        success: true,
        message: `Event deleted successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  },
});