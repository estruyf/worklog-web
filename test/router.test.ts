// Route parsing for the /app island. The form routes (/app/new and
// /app/task/<id>/edit) sit next to the single-task route, so the ordering of the
// two /task/ patterns is what keeps an edit URL from reading as a task id.
//
// An open list is a view route carrying an id rather than a route of its own,
// which is what keeps the nav rail and the view mirror in WorklogContext working
// off `route.view` alone.

import { describe, it, expect } from 'vitest';
import { parseRoute } from '../src/ui/router';

describe('parseRoute', () => {
  it('maps the base path to the day view', () => {
    expect(parseRoute('/app')).toEqual({ name: 'view', view: 'day' });
    expect(parseRoute('/app/')).toEqual({ name: 'view', view: 'day' });
  });

  it('maps the other dashboard views', () => {
    expect(parseRoute('/app/todos')).toEqual({ name: 'view', view: 'todos' });
    expect(parseRoute('/app/overdue')).toEqual({ name: 'view', view: 'overdue' });
    expect(parseRoute('/app/upcoming')).toEqual({ name: 'view', view: 'upcoming' });
    expect(parseRoute('/app/shortcuts')).toEqual({ name: 'view', view: 'shortcuts' });
    expect(parseRoute('/app/settings/')).toEqual({ name: 'view', view: 'settings' });
  });

  it('reads an open list as the Lists view with that list open', () => {
    expect(parseRoute('/app/lists')).toEqual({ name: 'view', view: 'lists' });
    expect(parseRoute('/app/lists/release')).toEqual({ name: 'view', view: 'lists', listId: 'release' });
    expect(parseRoute('/app/lists/release/')).toEqual({ name: 'view', view: 'lists', listId: 'release' });
    expect(parseRoute('/app/lists/cycling%20trip')).toEqual({ name: 'view', view: 'lists', listId: 'cycling trip' });
  });

  it('reads a single task', () => {
    expect(parseRoute('/app/task/t-1')).toEqual({ name: 'task', taskId: 't-1' });
    expect(parseRoute('/app/task/t-1/')).toEqual({ name: 'task', taskId: 't-1' });
  });

  it('reads the new-task form', () => {
    expect(parseRoute('/app/new')).toEqual({ name: 'taskForm', taskId: null });
    expect(parseRoute('/app/new/')).toEqual({ name: 'taskForm', taskId: null });
  });

  it('reads the edit form as a form, not as a task', () => {
    expect(parseRoute('/app/task/t-1/edit')).toEqual({ name: 'taskForm', taskId: 't-1' });
    expect(parseRoute('/app/task/t-1/edit/')).toEqual({ name: 'taskForm', taskId: 't-1' });
  });

  it('decodes task ids', () => {
    expect(parseRoute('/app/task/a%2Fb')).toEqual({ name: 'task', taskId: 'a/b' });
    expect(parseRoute('/app/task/a%2Fb/edit')).toEqual({ name: 'taskForm', taskId: 'a/b' });
  });

  it('404s on anything else', () => {
    expect(parseRoute('/app/nope')).toEqual({ name: 'notFound' });
    expect(parseRoute('/app/task/t-1/edit/extra')).toEqual({ name: 'notFound' });
    expect(parseRoute('/app/task//edit')).toEqual({ name: 'notFound' });
    expect(parseRoute('/app/lists/a/b')).toEqual({ name: 'notFound' });
  });
});
