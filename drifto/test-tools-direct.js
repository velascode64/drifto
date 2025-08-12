#!/usr/bin/env node

import { simpleListEventsTool, simpleCreateEventTool } from './src/mastra/tools/calendar-tools-simple.js';

console.log('🧪 Testing Calendar Tools Directly\n');

// Test 1: List Events
console.log('📋 Test 1: Listing events for this week...');
try {
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  
  const listResult = await simpleListEventsTool.execute({
    timeMinISO: now.toISOString(),
    timeMaxISO: endOfWeek.toISOString(),
    maxResults: 10
  });
  
  console.log('List Events Result:', JSON.stringify(listResult, null, 2));
  
  if (listResult.success) {
    console.log(`✅ Successfully listed ${listResult.events?.length || 0} events`);
  } else {
    console.log(`❌ Failed to list events: ${listResult.error}`);
  }
} catch (error) {
  console.error('❌ Error listing events:', error);
}

console.log('\n---\n');

// Test 2: Create Event
console.log('📅 Test 2: Creating a test event...');
try {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 1); // Tomorrow
  startTime.setHours(14, 0, 0, 0); // 2 PM
  
  const endTime = new Date(startTime);
  endTime.setHours(15, 0, 0, 0); // 3 PM
  
  const createResult = await simpleCreateEventTool.execute({
    summary: 'Test Event from Direct Tool Test',
    description: 'This is a test event created by testing the tool directly',
    startISO: startTime.toISOString(),
    endISO: endTime.toISOString(),
    createMeetLink: true
  });
  
  console.log('Create Event Result:', JSON.stringify(createResult, null, 2));
  
  if (createResult.success) {
    console.log(`✅ Successfully created event with ID: ${createResult.eventId}`);
    console.log(`   Link: ${createResult.htmlLink}`);
  } else {
    console.log(`❌ Failed to create event: ${createResult.error}`);
  }
} catch (error) {
  console.error('❌ Error creating event:', error);
}

console.log('\n---\n');

// Test 3: Test with different input formats to see what works
console.log('🔬 Test 3: Testing different input formats...');

// Test with object directly
console.log('\n3a. Testing with direct object:');
try {
  const directResult = await simpleListEventsTool.execute({
    timeMinISO: new Date().toISOString(),
    timeMaxISO: new Date(Date.now() + 86400000).toISOString(),
    maxResults: 5
  });
  console.log('Direct object result:', directResult.success ? '✅ Success' : `❌ Failed: ${directResult.error}`);
} catch (error) {
  console.error('Direct object error:', error.message);
}

// Test with wrapped input
console.log('\n3b. Testing with wrapped input:');
try {
  const wrappedResult = await simpleListEventsTool.execute({
    input: {
      timeMinISO: new Date().toISOString(),
      timeMaxISO: new Date(Date.now() + 86400000).toISOString(),
      maxResults: 5
    }
  });
  console.log('Wrapped input result:', wrappedResult.success ? '✅ Success' : `❌ Failed: ${wrappedResult.error}`);
} catch (error) {
  console.error('Wrapped input error:', error.message);
}

console.log('\n✨ Testing complete!');