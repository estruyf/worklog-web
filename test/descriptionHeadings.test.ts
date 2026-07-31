// A `## ` heading inside a task's description used to fork a new (id-less) task,
// which made the writer's idea of where the block ended differ from the reader's:
// replaceBlock truncated at the heading, orphaned the rest, and the serialized
// description appended another copy of it on every save. See src/parser/taskHeading.ts.

import { describe, expect, it } from 'vitest';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
import { replaceBlock } from '../src/parser/blocks';

const DESC = [
  'Testing out if we can get `Sites.Selected` to work with SharePoint Search.',
  '',
  '## Scripts',
  '',
  '```',
  '# PnP PowerShell login',
  '$ m365 login --appId 471406b7',
  '```',
  '',
  'Make sure you have the following API permissions scope set:',
  '![](assets/img-ms90so3m-77nbmw.png)',
  '',
  '## Resources',
  '',
  '- https://www.blimped.nl/rsc-using-delegated-sites-selected/',
].join('\n');

const FILE = `# Involv

## Involv mobiel app - sites selected
- id: t_mnhfua
- status: open
- created: 2026-07-31

${DESC}

### Notes
- 2026-07-31 17:00 — I can make use of \`m365 search\`, but it returns everything.

## Next task
- id: t_other
- status: open
`;

describe('h2 headings in a task description', () => {
  it('stay in the description instead of forking new tasks', () => {
    const { tasks } = parseTaskFile(FILE, 'clients/involv.md', 'involv');
    expect(tasks.map((t) => t.id)).toEqual(['t_mnhfua', 't_other']);
    expect(tasks[0].description).toBe(DESC);
    expect(tasks[0].notes).toHaveLength(1);
  });

  it('do not duplicate on repeated saves', () => {
    let content = FILE;
    for (let i = 0; i < 5; i++) {
      const task = parseTaskFile(content, 'clients/involv.md', 'involv').tasks[0];
      content =
        replaceBlock(content, task.id, serializeTask(task, 'involv'))!.replace(/\s*$/, '') + '\n';
    }
    expect(content.match(/## Scripts/g)).toHaveLength(1);
    expect(content.match(/## Resources/g)).toHaveLength(1);
    expect(content).toBe(FILE);
  });
});
