'use strict';
// Seed data matching the doc's own "immediate next action": three-plus
// projects, several tasks, one overdue, one upcoming, one completed — so the
// dashboard is legible the moment it's opened, not an empty shell.

function seed(today) {
  const iso = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const userId = 'u1';

  const user = {
    id: userId, email: 'rohan.mehta@example.com', display_name: 'Rohan',
    timezone: 'Europe/London', auth_provider: 'google',
    notification_defaults: JSON.stringify({ mode: 'before', offsetDays: 1, atHour: 9 }),
    created_at: iso(-40)
  };

  const projects = [
    { id: 'pr1', user_id: userId, name: 'Job Search', description: 'Land a senior role by the end of the quarter.', life_area: 'Work', status_override: null, reminder_default: null, archived_at: null, created_at: iso(-30) },
    { id: 'pr2', user_id: userId, name: 'Move to a New Apartment', description: 'Signed lease starts the 1st — everything ready before then.', life_area: 'Home', status_override: null, reminder_default: null, archived_at: null, created_at: iso(-21) },
    { id: 'pr3', user_id: userId, name: 'Health', description: 'Stay ahead of check-ups instead of catching up on them.', life_area: 'Health', status_override: null, reminder_default: JSON.stringify({ mode: 'before', offsetDays: 2, atHour: 9 }), archived_at: null, created_at: iso(-60) },
    { id: 'pr4', user_id: userId, name: 'Client Launch', description: 'Ship the Meridian onboarding flow.', life_area: 'Work', status_override: null, reminder_default: null, archived_at: null, created_at: iso(-14) }
  ];

  const tasks = [
    // Job Search — one overdue -> red
    { id: 't1', project_id: 'pr1', title: 'Follow up with Anthropic recruiter', notes: 'They said "end of last week."', due_at: iso(-3), priority: 'high', status: 'open', blocked: 0, reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-10) },
    { id: 't2', project_id: 'pr1', title: 'Tailor resume for the Stripe role', notes: '', due_at: iso(4), priority: 'normal', status: 'open', blocked: 0, reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-8) },
    { id: 't3', project_id: 'pr1', title: 'Submitted application to Figma', notes: '', due_at: iso(-6), priority: 'normal', status: 'completed', blocked: 0, reminder: null, calendar_event_id: null, completed_at: iso(-6), created_at: iso(-12) },

    // Move — due soon -> yellow
    { id: 't4', project_id: 'pr2', title: 'Call the utility company', notes: 'Set up the account before move-in day.', due_at: iso(2), priority: 'normal', status: 'open', blocked: 0, reminder: JSON.stringify({ mode: 'before', offsetDays: 1, atHour: 9 }), calendar_event_id: null, completed_at: null, created_at: iso(-5) },
    { id: 't5', project_id: 'pr2', title: 'Book the moving van', notes: '', due_at: iso(6), priority: 'normal', status: 'open', blocked: 0, reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-4) },
    { id: 't6', project_id: 'pr2', title: 'Forward mail with the post office', notes: '', due_at: null, priority: 'low', status: 'open', blocked: 0, reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-3) },

    // Health — nothing pressing -> green
    { id: 't7', project_id: 'pr3', title: 'Schedule annual eye exam', notes: '', due_at: iso(18), priority: 'normal', status: 'open', blocked: 0, reminder: null, calendar_event_id: 'gcal_mock_9182', completed_at: null, created_at: iso(-20) },
    { id: 't8', project_id: 'pr3', title: 'Refill prescription', notes: '', due_at: iso(-9), priority: 'normal', status: 'completed', blocked: 0, reminder: null, calendar_event_id: null, completed_at: iso(-9), created_at: iso(-25) },

    // Client Launch — blocked -> yellow
    { id: 't9', project_id: 'pr4', title: 'Get sign-off from legal on the copy', notes: 'Waiting on their review.', due_at: iso(9), priority: 'normal', status: 'open', blocked: 1, reminder: null, calendar_event_id: null, completed_at: null, created_at: iso(-7) },
    { id: 't10', project_id: 'pr4', title: 'Draft the onboarding checklist', notes: '', due_at: iso(-1), priority: 'normal', status: 'completed', blocked: 0, reminder: null, calendar_event_id: null, completed_at: iso(-1), created_at: iso(-13) }
  ];

  return { user, projects, tasks };
}

module.exports = { seed };
