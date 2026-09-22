'use strict';
// Seed data matching the doc's own "immediate next action": three example
// segments, at least eight tasks, one overdue, two approaching, one completed.

function seed(today) {
  const iso = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const userId = 'u1';

  const user = {
    id: userId, email: 'rohan.mehta@example.com', display_name: 'Rohan',
    age_range: '25 to 34', life_stage: JSON.stringify(['Working', 'Homeowner or renter']),
    goals: JSON.stringify(['Reduce stress', 'Organize multiple responsibilities']),
    timezone: 'Europe/London',
    preferences: JSON.stringify({ reminderDefault: { mode: 'before', offsetDays: 1, atHour: 9 }, voiceSpoken: false, privateMode: false }),
    created_at: iso(-40)
  };

  const segments = [
    { id: 's1', user_id: userId, name: 'Work', description: 'Everything that keeps the day job moving.', icon: 'briefcase', color: '#3B6FD9', kind: 'ongoing', sort_order: 0, status: 'active', archived_at: null, created_at: iso(-30) },
    { id: 's2', user_id: userId, name: 'Home', description: 'Upkeep, bills, and the small things a home needs.', icon: 'home', color: '#D98324', kind: 'ongoing', sort_order: 1, status: 'active', archived_at: null, created_at: iso(-30) },
    { id: 's3', user_id: userId, name: 'Health', description: 'Appointments and the routine stuff, before it’s urgent.', icon: 'heart', color: '#2E9E6C', kind: 'ongoing', sort_order: 2, status: 'active', archived_at: null, created_at: iso(-30) },
    { id: 's4', user_id: userId, name: 'Finances', description: 'Bills, filings, and keeping an eye on savings.', icon: 'wallet', color: '#8654C7', kind: 'ongoing', sort_order: 3, status: 'active', archived_at: null, created_at: iso(-30) },
    { id: 's5', user_id: userId, name: 'Kitchen Remodel', description: 'A proper project with an end in sight — new counters, cabinets, and a working sink by the end of the month.', icon: 'hammer', color: '#C1613F', kind: 'project', sort_order: 4, status: 'active', archived_at: null, created_at: iso(-18) }
  ];

  const tasks = [
    { id: 't1', segment_id: 's1', title: 'Send the quarterly report', notes: '', due_at: iso(-2), priority: 'high', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-10) },
    { id: 't2', segment_id: 's1', title: 'Reply to the client proposal', notes: '', due_at: iso(3), priority: 'normal', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-6) },
    { id: 't3', segment_id: 's1', title: 'Book flights for the conference', notes: '', due_at: iso(20), priority: 'normal', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-5) },
    { id: 't4', segment_id: 's1', title: 'Finished the onboarding deck', notes: '', due_at: iso(-4), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-1), created_at: iso(-12) },

    { id: 't5', segment_id: 's2', title: 'Pay the electricity bill', notes: '', due_at: iso(2), priority: 'high', status: 'open', reminder: JSON.stringify({ mode: 'before', offsetDays: 1, atHour: 9 }), calendar_event_id: null, completed_at: null, created_at: iso(-4) },
    { id: 't6', segment_id: 's2', title: 'Fix the leaking kitchen tap', notes: '', due_at: null, priority: 'normal', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-3) },
    { id: 't7', segment_id: 's2', title: 'Order a new air filter', notes: '', due_at: iso(15), priority: 'low', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-2) },

    { id: 't8', segment_id: 's3', title: 'Book dentist visit', notes: '', due_at: iso(5), priority: 'normal', status: 'open', reminder: null, calendar_event_id: 'gcal_mock_7731', completed_at: null, created_at: iso(-8) },
    { id: 't9', segment_id: 's3', title: 'Refill prescription', notes: '', due_at: iso(-1), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-1), created_at: iso(-9) },

    { id: 't10', segment_id: 's4', title: 'Submit expense report', notes: '', due_at: iso(-1), priority: 'normal', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-3) },
    { id: 't11', segment_id: 's4', title: 'Review the ISA contribution', notes: '', due_at: iso(30), priority: 'low', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-1) },

    // Kitchen Remodel — a project with a clear start and finish, most of the
    // way there, so the turtle sits well past the midpoint of its path.
    { id: 't12', segment_id: 's5', title: 'Measure the space and set a budget', notes: '', due_at: iso(-16), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-16), created_at: iso(-18) },
    { id: 't13', segment_id: 's5', title: 'Choose the countertop material', notes: '', due_at: iso(-12), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-12), created_at: iso(-17) },
    { id: 't14', segment_id: 's5', title: 'Order the cabinets', notes: '', due_at: iso(-8), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-7) , created_at: iso(-15) },
    { id: 't15', segment_id: 's5', title: 'Book the plumber for the sink', notes: '', due_at: iso(-9), priority: 'normal', status: 'completed', reminder: null, calendar_event_id: null, completed_at: iso(-3), created_at: iso(-14) },
    { id: 't16', segment_id: 's5', title: 'Install the countertops', notes: '', due_at: iso(4), priority: 'high', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-10) },
    { id: 't17', segment_id: 's5', title: 'Final plumbing check and sign-off', notes: '', due_at: iso(9), priority: 'normal', status: 'open', reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-10) }
  ];

  return { user, segments, tasks };
}

module.exports = { seed };
