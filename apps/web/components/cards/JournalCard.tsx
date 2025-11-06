'use client';

import React, { useState } from 'react';
import { useJournalEntries, useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry, JournalEntry } from '@/lib/hooks/useJournal';
import { useMarketStore } from '@/stores/market-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2, Plus, Trash2, Edit2, Save, X, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/Toast';

function JournalCardComponent() {
  const { selectedMarketId } = useMarketStore();
  const { dbUser } = useAuth();
  const { success, error: showError } = useToast();
  const { data, isLoading } = useJournalEntries({
    marketId: selectedMarketId || undefined,
    limit: 50,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({
    note: '',
    timestamp: new Date().toISOString(),
  });
  const [editEntry, setEditEntry] = useState({
    note: '',
    timestamp: '',
  });

  const createEntryMutation = useCreateJournalEntry();
  const updateEntryMutation = useUpdateJournalEntry();
  const deleteEntryMutation = useDeleteJournalEntry();

  const handleCreateEntry = async () => {
    if (!newEntry.note.trim()) {
      showError('Invalid input', 'Please enter a note');
      return;
    }

    try {
      await createEntryMutation.mutateAsync({
        marketId: selectedMarketId || undefined,
        timestamp: newEntry.timestamp,
        note: newEntry.note,
      });
      success('Entry created', 'Journal entry has been created successfully.');
      setNewEntry({ note: '', timestamp: new Date().toISOString() });
      setShowCreate(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create entry';
      showError('Failed to create entry', errorMessage);
    }
  };

  const handleUpdateEntry = async (entryId: string) => {
    if (!editEntry.note.trim()) {
      showError('Invalid input', 'Please enter a note');
      return;
    }

    try {
      await updateEntryMutation.mutateAsync({
        entryId,
        data: {
          note: editEntry.note,
          timestamp: editEntry.timestamp,
        },
      });
      success('Entry updated', 'Journal entry has been updated successfully.');
      setEditingId(null);
      setEditEntry({ note: '', timestamp: '' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update entry';
      showError('Failed to update entry', errorMessage);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await deleteEntryMutation.mutateAsync(entryId);
      success('Entry deleted', 'Journal entry has been deleted successfully.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete entry';
      showError('Failed to delete entry', errorMessage);
    }
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditEntry({
      note: entry.note,
      timestamp: entry.timestamp,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entries = data?.entries || [];

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold">Journal</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="text-xs h-6 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          New Entry
        </Button>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-auto space-y-2">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <p>No journal entries</p>
              <p className="text-xs mt-1">Create an entry to track your trading notes</p>
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded border border-border hover:bg-muted/50 transition-colors"
            >
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs mb-1">Timestamp</Label>
                    <Input
                      type="datetime-local"
                      value={new Date(editEntry.timestamp).toISOString().slice(0, 16)}
                      onChange={(e) => setEditEntry({ ...editEntry, timestamp: new Date(e.target.value).toISOString() })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Note</Label>
                    <textarea
                      value={editEntry.note}
                      onChange={(e) => setEditEntry({ ...editEntry, note: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background resize-none"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditEntry({ note: '', timestamp: '' });
                      }}
                      className="flex-1 text-xs h-6"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateEntry(entry.id)}
                      disabled={updateEntryMutation.isPending}
                      className="flex-1 text-xs h-6"
                    >
                      {updateEntryMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(entry.timestamp)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(entry)}
                        className="h-5 w-5 p-0"
                        title="Edit entry"
                      >
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleteEntryMutation.isPending}
                        className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs whitespace-pre-wrap break-words">{entry.note}</div>
                  {entry.attachments && Object.keys(entry.attachments).length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {Object.keys(entry.attachments).length} attachment(s)
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Entry Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">New Journal Entry</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1">Timestamp</Label>
                <Input
                  type="datetime-local"
                  value={new Date(newEntry.timestamp).toISOString().slice(0, 16)}
                  onChange={(e) => setNewEntry({ ...newEntry, timestamp: new Date(e.target.value).toISOString() })}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Note</Label>
                <textarea
                  value={newEntry.note}
                  onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })}
                  placeholder="Enter your trading notes..."
                  className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background resize-none"
                  rows={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setNewEntry({ note: '', timestamp: new Date().toISOString() });
                  }}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEntry}
                  disabled={!newEntry.note.trim() || createEntryMutation.isPending}
                  className="flex-1 text-xs"
                >
                  {createEntryMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Create
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalCardComponent;

