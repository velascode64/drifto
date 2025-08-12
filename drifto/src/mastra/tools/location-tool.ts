import { createTool } from '@mastra/core';
import { z } from 'zod';

const locationInputSchema = z.object({
  ipAddress: z.string().optional().describe('IP address to lookup (optional, will auto-detect if not provided)'),
});

const timezoneInputSchema = z.object({
  time: z.string().describe('Time to convert (e.g., "3:00 PM" or "15:00")'),
  date: z.string().optional().describe('Date (e.g., "2024-12-20" or "tomorrow"). Defaults to today.'),
  fromTimezone: z.string().describe('Source timezone (e.g., "America/New_York")'),
  toTimezone: z.string().describe('Target timezone (e.g., "Europe/London")'),
});

export const locationTool = createTool({
  id: 'detectLocation',
  description: 'Detect user location and timezone using IP geolocation API',
  execute: async (context) => {
    try {
      const { ipAddress } = locationInputSchema.parse(context);
      
      // Using ipapi.co free tier (1000 requests/day)
      // Alternative APIs: ipgeolocation.io, ip-api.com, ipinfo.io
      const url = ipAddress 
        ? `https://ipapi.co/${ipAddress}/json/`
        : 'https://ipapi.co/json/';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Location API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check for API errors
      if (data.error) {
        throw new Error(`Location detection failed: ${data.reason || 'Unknown error'}`);
      }
      
      // Return structured location data
      return {
        success: true,
        location: {
          city: data.city,
          region: data.region,
          country: data.country_name,
          countryCode: data.country_code,
          timezone: data.timezone,
          latitude: data.latitude,
          longitude: data.longitude,
          utcOffset: data.utc_offset,
        },
        ip: data.ip,
        formattedLocation: `${data.city}, ${data.region}, ${data.country_name}`,
        currentTime: new Date().toLocaleString('en-US', { 
          timeZone: data.timezone,
          dateStyle: 'medium',
          timeStyle: 'short'
        }),
      };
    } catch (error) {
      // Fallback to browser timezone if available
      const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect location',
        fallback: {
          timezone: fallbackTimezone,
          currentTime: new Date().toLocaleString('en-US', { 
            timeZone: fallbackTimezone,
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
        },
      };
    }
  },
});

export const timezoneConversionTool = createTool({
  id: 'convertTimezone',
  description: 'Convert time between different timezones',
  execute: async (context) => {
    try {
      const { time, date, fromTimezone, toTimezone } = timezoneInputSchema.parse(context);
      
      // Parse the input date or use today
      let targetDate = new Date();
      if (date) {
        if (date.toLowerCase() === 'tomorrow') {
          targetDate.setDate(targetDate.getDate() + 1);
        } else if (date.toLowerCase() === 'yesterday') {
          targetDate.setDate(targetDate.getDate() - 1);
        } else {
          targetDate = new Date(date);
        }
      }
      
      // Parse time input (supports various formats)
      const timeMatch = time.match(/(\d{1,2}):?(\d{0,2})?\s*(am|pm)?/i);
      if (!timeMatch) {
        throw new Error('Invalid time format');
      }
      
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];
      
      // Convert to 24-hour format if needed
      if (meridiem) {
        if (meridiem.toLowerCase() === 'pm' && hours !== 12) {
          hours += 12;
        } else if (meridiem.toLowerCase() === 'am' && hours === 12) {
          hours = 0;
        }
      }
      
      // Create date string in source timezone
      const dateStr = targetDate.toISOString().split('T')[0];
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      
      // Convert between timezones
      const sourceDate = new Date(dateTimeStr);
      
      // Format for source timezone
      const sourceFormatted = sourceDate.toLocaleString('en-US', {
        timeZone: fromTimezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      
      // Format for target timezone
      const targetFormatted = sourceDate.toLocaleString('en-US', {
        timeZone: toTimezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      
      // Calculate time difference
      const sourceOffset = new Date().toLocaleString('en-US', { timeZone: fromTimezone, timeZoneName: 'short' });
      const targetOffset = new Date().toLocaleString('en-US', { timeZone: toTimezone, timeZoneName: 'short' });
      
      return {
        success: true,
        conversion: {
          original: {
            time: sourceFormatted,
            timezone: fromTimezone,
            abbreviation: sourceOffset.split(' ').pop(),
          },
          converted: {
            time: targetFormatted,
            timezone: toTimezone,
            abbreviation: targetOffset.split(' ').pop(),
          },
        },
        message: `${time} in ${fromTimezone} is ${targetFormatted} in ${toTimezone}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert timezone',
      };
    }
  },
});