'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { commands, searchCommands } from '@/lib/commands';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const filteredCommands = search ? searchCommands(search) : commands;
  const grouped = filteredCommands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, typeof commands>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <Command className="relative z-50 w-full max-w-2xl overflow-hidden border border-border bg-popover shadow-xl">
        <div className="flex items-center border-b border-border px-4 bg-accent/10">
          <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:ring-0"
          />
          <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 border border-border bg-card px-2 font-medium text-xs opacity-70 sm:flex">
            <span>ESC</span>
          </kbd>
        </div>
        <Command.List className="max-h-[400px] overflow-y-auto p-2 scrollbar-hide">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <Command.Group heading={category} className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {cmds.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => {
                      cmd.action();
                      onOpenChange(false);
                    }}
                    className="relative flex cursor-pointer select-none items-center px-3 py-2.5 text-sm outline-none transition-all duration-150 aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/60 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 active:scale-[0.98]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{cmd.name}</span>
                      <span className="text-xs text-muted-foreground">{cmd.description}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <Command.Empty className="py-8 text-center">
              <div className="text-sm text-muted-foreground">No commands found.</div>
              <div className="text-xs text-muted-foreground/70 mt-1">Try a different search term</div>
            </Command.Empty>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

