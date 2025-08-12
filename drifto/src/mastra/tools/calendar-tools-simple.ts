import { createTool } from "@mastra/core";
import { z } from "zod";
import { getGoogleCalendarClient } from "../lib/googleClient";
import { loadStoredTokens } from "../lib/tokenManager";

/** Util: obtener input desde Mastra - puede estar en ctx.context, ctx.input, o ctx directo */
const getToolInput = <T>(ctx: any): T => {
  // Mastra puede anidar los datos en diferentes lugares
  if (ctx && typeof ctx === "object") {
    // Caso 1: ctx.context (común en Mastra)
    if ("context" in ctx && ctx.context) {
      return ctx.context as T;
    }
    // Caso 2: ctx.input (legacy)
    if ("input" in ctx && ctx.input) {
      return ctx.input as T;
    }
  }
  // Caso 3: ctx directo
  return ctx as T;
};

/** Util: normalizar timestamps RFC3339 (quita milisegundos si vienen) */
const toRFC3339 = (iso?: string) => (iso ? iso.replace(/\.\d{3}(?=[Z+-])/, "") : "");

/** ---- Schemas ---- */
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
    optional: z.boolean().optional(),
  })).default([]),
  location: z.string().optional(),
  createMeetLink: z.boolean().default(false),
});

const listEventsSchema = z.object({
  timeMinISO: z.string().describe("Start time ISO8601"),
  timeMaxISO: z.string().describe("End time ISO8601"),
  maxResults: z.number().default(10),
  timeZone: z.string().optional(), // NO se envía a events.list; la dejo por si la usas upstream
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

/** ---- Tools ---- */

// FreeBusy
export const simpleFreeBusyTool = createTool({
  id: "simple-freebusy",
  description: "Check calendar availability for a time range",
  inputSchema: freeBusySchema,
  execute: async (context) => {
    console.log("[simple-freebusy] raw context keys:", Object.keys(context || {}));
    const rawInput = getToolInput<unknown>(context);
    console.log("[simple-freebusy] raw input:", rawInput);
    const parsed = freeBusySchema.safeParse(rawInput);
    if (!parsed.success) {
      console.error("[simple-freebusy] zod error:", parsed.error.flatten().fieldErrors);
      return { success: false, error: "invalid_input", details: parsed.error.issues };
    }
    const input = parsed.data;

    const tokens = loadStoredTokens();
    if (!tokens) return { success: false, error: "No tokens found. Run: npm run auth" };

    try {
      const client = getGoogleCalendarClient(tokens);
      const resp = await client.freebusy.query({
        requestBody: {
          timeMin: input.timeMinISO,
          timeMax: input.timeMaxISO,
          items: input.calendarIds.map((id) => ({ id })),
          timeZone: input.timeZone, // permitido por freebusy.query
        },
      });

      const fb = resp.data.calendars ?? {};
      const busy = Object.entries(fb).flatMap(([calId, v]: any) =>
        (v.busy ?? []).map((b: any) => ({ start: b.start, end: b.end, calendarId: calId })),
      );

      return { success: true, busy, message: `Found ${busy.length} busy time slots` };
    } catch (error: any) {
      console.error("[simple-freebusy] error:", error?.response?.data || error?.message || error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  },
});

// Create Event
export const simpleCreateEventTool = createTool({
  id: "simple-create-event",
  description: "Create a calendar event",
  inputSchema: createEventSchema,
  execute: async (context) => {
    console.log("[simple-create-event] raw context keys:", Object.keys(context || {}));
    const rawInput = getToolInput<unknown>(context);
    console.log("[simple-create-event] raw input:", rawInput);
    const parsed = createEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      console.error("[simple-create-event] zod error:", parsed.error.flatten().fieldErrors);
      return { success: false, error: "invalid_input", details: parsed.error.issues };
    }
    const input = parsed.data;

    const tokens = loadStoredTokens();
    if (!tokens) return { success: false, error: "No tokens found. Run: npm run auth" };

    try {
      const client = getGoogleCalendarClient(tokens);

      const requestBody: any = {
        summary: input.summary,
        description: input.description,
        start: { dateTime: toRFC3339(input.startISO), ...(input.timeZone && { timeZone: input.timeZone }) },
        end: { dateTime: toRFC3339(input.endISO), ...(input.timeZone && { timeZone: input.timeZone }) },
        attendees: input.attendees,
        location: input.location,
      };

      if (input.createMeetLink) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `drifto-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" }, // recomendado
          },
        };
      }

      const { data } = await client.events.insert({
        calendarId: "primary",
        requestBody,
        conferenceDataVersion: input.createMeetLink ? 1 : undefined,
        sendUpdates: "all",
      });

      return { success: true, eventId: data.id!, htmlLink: data.htmlLink, message: `Event "${input.summary}" created successfully` };
    } catch (error: any) {
      console.error("[simple-create-event] error:", error?.response?.data || error?.message || error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  },
});

// List Events
export const simpleListEventsTool = createTool({
  id: "simple-list-events",
  description: "List calendar events in a time range",
  inputSchema: listEventsSchema,
  execute: async (context) => {
    console.log("[simple-list-events] raw context keys:", Object.keys(context || {}));
    const rawInput = getToolInput<unknown>(context);
    console.log("[simple-list-events] raw input:", rawInput);
    const parsed = listEventsSchema.safeParse(rawInput);
    if (!parsed.success) {
      console.error("[simple-list-events] zod error:", parsed.error.flatten().fieldErrors);
      return { success: false, error: "invalid_input", details: parsed.error.issues };
    }
    const input = parsed.data;

    const tokens = loadStoredTokens();
    if (!tokens) return { success: false, error: "No tokens found. Run: npm run auth" };

    try {
      const client = getGoogleCalendarClient(tokens);

      const { data } = await client.events.list({
        calendarId: "primary",
        timeMin: input.timeMinISO,
        timeMax: input.timeMaxISO,
        maxResults: input.maxResults,
        singleEvents: true,
        orderBy: "startTime",
        // OJO: events.list no soporta 'timeZone'. Si necesitas TZ, normaliza tus ISO antes.
      });

      const events = (data.items || []).map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        attendees: event.attendees?.map((a) => ({ email: a.email, responseStatus: a.responseStatus })),
        meetLink: event.hangoutLink,
      }));

      return { success: true, events, message: `Found ${events.length} events` };
    } catch (error: any) {
      console.error("[simple-list-events] error:", error?.response?.data || error?.message || error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  },
});

// Update Event
export const simpleUpdateEventTool = createTool({
  id: "simple-update-event",
  description: "Update an existing calendar event",
  inputSchema: updateEventSchema,
  execute: async (context) => {
    console.log("[simple-update-event] raw context keys:", Object.keys(context || {}));
    const rawInput = getToolInput<unknown>(context);
    console.log("[simple-update-event] raw input:", rawInput);
    const parsed = updateEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      console.error("[simple-update-event] zod error:", parsed.error.flatten().fieldErrors);
      return { success: false, error: "invalid_input", details: parsed.error.issues };
    }
    const input = parsed.data;

    const tokens = loadStoredTokens();
    if (!tokens) return { success: false, error: "No tokens found. Run: npm run auth" };

    try {
      const client = getGoogleCalendarClient(tokens);

      // Cargamos el evento actual para preservar campos no enviados
      const { data: currentEvent } = await client.events.get({
        calendarId: "primary",
        eventId: input.eventId,
      });

      const requestBody: any = {
        ...currentEvent,
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.location !== undefined && { location: input.location }),
      };

      if (input.startISO) {
        requestBody.start = { dateTime: toRFC3339(input.startISO), ...(input.timeZone && { timeZone: input.timeZone }) };
      }
      if (input.endISO) {
        requestBody.end = { dateTime: toRFC3339(input.endISO), ...(input.timeZone && { timeZone: input.timeZone }) };
      }

      const { data } = await client.events.update({
        calendarId: "primary",
        eventId: input.eventId,
        requestBody,
        sendUpdates: "all",
      });

      return { success: true, eventId: data.id!, htmlLink: data.htmlLink, message: "Event updated successfully" };
    } catch (error: any) {
      console.error("[simple-update-event] error:", error?.response?.data || error?.message || error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  },
});

// Delete Event
export const simpleDeleteEventTool = createTool({
  id: "simple-delete-event",
  description: "Delete a calendar event",
  inputSchema: deleteEventSchema,
  execute: async (context) => {
    console.log("[simple-delete-event] raw context keys:", Object.keys(context || {}));
    const rawInput = getToolInput<unknown>(context);
    console.log("[simple-delete-event] raw input:", rawInput);
    const parsed = deleteEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      console.error("[simple-delete-event] zod error:", parsed.error.flatten().fieldErrors);
      return { success: false, error: "invalid_input", details: parsed.error.issues };
    }
    const input = parsed.data;

    const tokens = loadStoredTokens();
    if (!tokens) return { success: false, error: "No tokens found. Run: npm run auth" };

    try {
      const client = getGoogleCalendarClient(tokens);
      await client.events.delete({
        calendarId: "primary",
        eventId: input.eventId,
        sendUpdates: input.sendUpdates,
      });
      return { success: true, message: "Event deleted successfully" };
    } catch (error: any) {
      console.error("[simple-delete-event] error:", error?.response?.data || error?.message || error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  },
});