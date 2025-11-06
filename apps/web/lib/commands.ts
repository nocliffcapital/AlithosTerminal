export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  icon?: string;
}

export const commands: Command[] = [
  {
    id: 'new-workspace',
    name: 'New Workspace',
    description: 'Create a new workspace',
    category: 'Workspace',
    action: () => {
      console.log('New workspace');
    },
  },
  {
    id: 'save-layout',
    name: 'Save Layout',
    description: 'Save current layout',
    category: 'Workspace',
    action: () => {
      console.log('Save layout');
    },
  },
  {
    id: 'command-palette',
    name: 'Command Palette',
    description: 'Open command palette',
    category: 'General',
    keywords: ['palette', 'commands', 'cmd'],
    action: () => {
      console.log('Command palette');
    },
  },
];

export function searchCommands(query: string): Command[] {
  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))
  );
}

