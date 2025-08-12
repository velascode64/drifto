import { createTool } from "@mastra/core";
import { z } from "zod";
import { getGoogleCalendarClient } from "../lib/googleClient";

// Schema para credenciales OAuth
const oauthSchema = z.object({
    accessToken: z.string().describe("Access token de Google para Calendar"),
    refreshToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
});

// Schema para FreeBusy
const freeBusyInputSchema = z.object({
    oauth: oauthSchema,
    timeMinISO: z.string().describe("Inicio ISO8601, ej. 2025-08-11T09:00:00Z"),
    timeMaxISO: z.string().describe("Fin ISO8601, ej. 2025-08-11T18:00:00Z"),
    calendarIds: z.array(z.string()).default(["primary"]),
    timeZone: z.string().optional().describe("TZ para normalizar, ej. America/Los_Angeles"),
});

// Schema para Create Event
const createEventInputSchema = z.object({
    oauth: oauthSchema,
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

export const googleFreeBusyTool = createTool({
    id: "google-freebusy",
    description: "Obtiene disponibilidad (free/busy) para el calendario primario del usuario y/o calendars indicados dentro de un rango.",
    execute: async (context) => {
        const input = freeBusyInputSchema.parse(context);
        const { oauth, timeMinISO, timeMaxISO, calendarIds, timeZone } = input;

        const client = getGoogleCalendarClient(oauth);

        const resp = await client.freebusy.query({
            requestBody: {
                timeMin: timeMinISO,
                timeMax: timeMaxISO,
                items: calendarIds.map((id) => ({ id })),
                timeZone,
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
    },
});

export const googleCreateEventTool = createTool({
    id: "google-create-event",
    description: "Crea un evento en el calendario del usuario. Úsalo solo tras confirmación explícita del usuario.",
    execute: async (context) => {
        const input = createEventInputSchema.parse(context);
        const {
            oauth,
            calendarId,
            summary,
            description,
            startISO,
            endISO,
            timeZone,
            attendees,
            location,
            conferenceData,
        } = input;

        const client = getGoogleCalendarClient(oauth);

        const requestBody: any = {
            summary,
            description,
            start: timeZone ? { dateTime: startISO, timeZone } : { dateTime: startISO },
            end: timeZone ? { dateTime: endISO, timeZone } : { dateTime: endISO },
            attendees,
            location,
        };

        // Crear Google Meet si se pide
        if (conferenceData?.createMeetLink) {
            requestBody.conferenceData = {
                createRequest: { requestId: `drifto-${Date.now()}` },
            };
        }

        const { data } = await client.events.insert({
            calendarId,
            requestBody,
            conferenceDataVersion: conferenceData?.createMeetLink ? 1 : undefined,
            sendUpdates: "all", // o "none" si prefieres draft silencioso
        });

        return { 
            success: true,
            eventId: data.id!, 
            htmlLink: data.htmlLink,
            message: `Event "${summary}" created successfully`
        };
    },
});

export const googleListEventsTool = createTool({
    id: "google-list-events",
    description: "Lista eventos del calendario del usuario en un rango de tiempo",
    execute: async (context) => {
        const input = z.object({
            oauth: oauthSchema,
            calendarId: z.string().default("primary"),
            timeMinISO: z.string().describe("Inicio ISO8601"),
            timeMaxISO: z.string().describe("Fin ISO8601"),
            maxResults: z.number().default(10),
            timeZone: z.string().optional(),
        }).parse(context);

        const { oauth, calendarId, timeMinISO, timeMaxISO, maxResults, timeZone } = input;

        const client = getGoogleCalendarClient(oauth);

        const { data } = await client.events.list({
            calendarId,
            timeMin: timeMinISO,
            timeMax: timeMaxISO,
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
            timeZone,
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
    },
});

export const googleUpdateEventTool = createTool({
    id: "google-update-event",
    description: "Actualiza un evento existente en el calendario",
    execute: async (context) => {
        const input = z.object({
            oauth: oauthSchema,
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
        }).parse(context);

        const { oauth, calendarId, eventId, updates } = input;
        const client = getGoogleCalendarClient(oauth);

        // Primero obtener el evento actual
        const { data: currentEvent } = await client.events.get({
            calendarId,
            eventId,
        });

        // Preparar el body con las actualizaciones
        const requestBody: any = {
            ...currentEvent,
            summary: updates.summary || currentEvent.summary,
            description: updates.description || currentEvent.description,
            location: updates.location || currentEvent.location,
        };

        if (updates.startISO) {
            requestBody.start = updates.timeZone 
                ? { dateTime: updates.startISO, timeZone: updates.timeZone }
                : { dateTime: updates.startISO };
        }

        if (updates.endISO) {
            requestBody.end = updates.timeZone
                ? { dateTime: updates.endISO, timeZone: updates.timeZone }
                : { dateTime: updates.endISO };
        }

        const { data } = await client.events.update({
            calendarId,
            eventId,
            requestBody,
            sendUpdates: "all",
        });

        return {
            success: true,
            eventId: data.id!,
            htmlLink: data.htmlLink,
            message: `Event updated successfully`,
        };
    },
});

export const googleDeleteEventTool = createTool({
    id: "google-delete-event",
    description: "Elimina un evento del calendario",
    execute: async (context) => {
        const input = z.object({
            oauth: oauthSchema,
            calendarId: z.string().default("primary"),
            eventId: z.string(),
            sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
        }).parse(context);

        const { oauth, calendarId, eventId, sendUpdates } = input;
        const client = getGoogleCalendarClient(oauth);

        await client.events.delete({
            calendarId,
            eventId,
            sendUpdates,
        });

        return {
            success: true,
            message: `Event deleted successfully`,
        };
    },
});