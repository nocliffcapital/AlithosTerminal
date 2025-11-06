'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaces, useCreateWorkspace, useUpdateWorkspace, useDeleteWorkspace } from '@/lib/hooks/useWorkspace';
import { useTemplates, useCreateTemplate } from '@/lib/hooks/useTemplate';
import { useLayoutStore } from '@/stores/layout-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { ChevronDown, Plus, X, Edit2, Trash2, Check, Loader2, Save, FileText, Lock, Unlock } from 'lucide-react';

export function WorkspaceSelector() {
  const { data: workspaces = [], isLoading, error } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspace } = useLayoutStore();
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: templates = [] } = useTemplates(false);
  const createTemplate = useCreateTemplate();
  const { currentLayout } = useLayoutStore();
  const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId);

  // Debug logging
  useEffect(() => {
    if (dropdownOpen) {
      console.log('Workspaces dropdown opened:');
      console.log('  Workspaces:', workspaces);
      console.log('  Workspaces count:', workspaces.length);
      console.log('  Is loading:', isLoading);
      console.log('  Error:', error);
    }
  }, [dropdownOpen, workspaces, isLoading, error]);

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      console.error('Template name is required');
      return;
    }

    if (!currentLayout) {
      console.error('No current layout to save');
      return;
    }

    console.log('Saving template:', {
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      layout: currentLayout,
      cardsCount: currentLayout.cards?.length || 0,
    });

    try {
      const result = await createTemplate.mutateAsync({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        config: currentLayout,
      });
      console.log('Template saved successfully:', result);
      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      console.error('Failed to save template:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Show error to user (could add a toast notification here)
      alert(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      return; // Don't create with empty name
    }
    
    try {
      const result = await createWorkspace.mutateAsync({
        name: workspaceName.trim(),
        type: 'CUSTOM',
        templateId: selectedTemplateId || undefined,
      });
      if (result?.workspace) {
        await setCurrentWorkspace(result.workspace.id);
        setShowCreateDialog(false);
        setWorkspaceName('');
        setSelectedTemplateId(null);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (editingWorkspaceId) return; // Don't select if editing
    await setCurrentWorkspace(workspaceId);
    setDropdownOpen(false);
  };

  const handleStartEdit = (workspaceId: string, currentName: string) => {
    setEditingWorkspaceId(workspaceId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async (workspaceId: string) => {
    if (!editingName.trim()) {
      setEditingWorkspaceId(null);
      return;
    }

    try {
      await updateWorkspace.mutateAsync({
        id: workspaceId,
        name: editingName.trim(),
      });
      setEditingWorkspaceId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update workspace:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingWorkspaceId(null);
    setEditingName('');
  };

  const handleToggleLock = async (workspaceId: string, currentlyLocked: boolean) => {
    try {
      await updateWorkspace.mutateAsync({
        id: workspaceId,
        locked: !currentlyLocked,
      });
    } catch (error) {
      console.error('Failed to toggle workspace lock:', error);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    try {
      await deleteWorkspace.mutateAsync(workspaceId);
      setShowDeleteConfirm(null);
      // If deleting current workspace, switch to first available
      if (workspaceId === currentWorkspaceId) {
        const remainingWorkspaces = workspaces.filter((w: any) => w.id !== workspaceId);
        if (remainingWorkspaces.length > 0) {
          await setCurrentWorkspace(remainingWorkspaces[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" title="Workspace Manager" aria-label="Workspace Manager">
            <span className="text-xs">
              Workspace Manager
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">Loading workspaces...</span>
            </DropdownMenuItem>
          ) : workspaces.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">No workspaces yet</span>
            </DropdownMenuItem>
          ) : (
            workspaces.map((workspace: any) => {
              const isEditing = editingWorkspaceId === workspace.id;
              const isCurrent = workspace.id === currentWorkspaceId;
              
              return (
                <div key={workspace.id} className="relative">
                  <DropdownMenuItem
                    onClick={(e) => {
                      if (!isEditing) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectWorkspace(workspace.id);
                      }
                    }}
                    className={`cursor-pointer ${
                      isCurrent ? 'bg-accent' : ''
                    } ${isEditing ? 'cursor-default' : ''}`}
                    onSelect={(e) => {
                      if (isEditing) e.preventDefault();
                    }}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full pr-8">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(workspace.id);
                            }
                            if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2.5 py-1.5 text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveEdit(workspace.id);
                          }}
                          disabled={updateWorkspace.isPending}
                          className="p-1 hover:bg-accent"
                        >
                          {updateWorkspace.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3 text-green-500" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-1 hover:bg-accent"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full group">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-xs font-medium truncate">{workspace.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {workspace.type || 'CUSTOM'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleLock(workspace.id, workspace.locked || false);
                            }}
                            className="p-1 hover:bg-accent"
                            title={workspace.locked ? 'Unlock workspace' : 'Lock workspace'}
                          >
                            {workspace.locked ? (
                              <Lock className="h-3 w-3 text-yellow-500" />
                            ) : (
                              <Unlock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartEdit(workspace.id, workspace.name);
                            }}
                            className="p-1 hover:bg-accent"
                            title="Edit workspace"
                            disabled={workspace.locked}
                          >
                            <Edit2 className={`h-3 w-3 ${workspace.locked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowDeleteConfirm(workspace.id);
                            }}
                            className="p-1 hover:bg-accent"
                            title="Delete workspace"
                            disabled={workspace.locked}
                          >
                            <Trash2 className={`h-3 w-3 ${workspace.locked ? 'text-destructive/50' : 'text-destructive'}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </DropdownMenuItem>
                </div>
              );
            })
          )}
          <DropdownMenuSeparator />
          {currentLayout && currentLayout.cards.length > 0 && (
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setDropdownOpen(false);
                setShowSaveTemplateDialog(true);
              }}
              className="cursor-pointer"
            >
              <Save className="h-3 w-3 mr-2" />
              <span className="text-xs">Save as Template</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setDropdownOpen(false);
              setShowCreateDialog(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="h-3 w-3 mr-2" />
            <span className="text-xs">New Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      {showCreateDialog && mounted ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateDialog(false)}
          />
          <div className="relative z-50 w-full max-w-md m-4 border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Create New Workspace</h2>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setWorkspaceName('');
                  setSelectedTemplateId(null);
                }}
                className="p-1.5 hover:bg-accent/60 transition-all duration-150 active:scale-95"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && workspaceName.trim()) {
                      handleCreateWorkspace();
                    }
                    if (e.key === 'Escape') {
                      setShowCreateDialog(false);
                    }
                  }}
                  placeholder="Enter workspace name..."
                  className="w-full px-3 py-2.5 text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Create from Template (optional)
                </label>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No templates available. Create a template by saving a workspace design.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    <button
                      onClick={() => setSelectedTemplateId(null)}
                      className={`w-full text-left px-3 py-2 text-sm border transition-colors ${
                        selectedTemplateId === null
                          ? 'border-primary bg-accent/50'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 border border-border" />
                        <span>Empty Workspace</span>
                      </div>
                    </button>
                    {templates.map((template: any) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full text-left px-3 py-2 text-sm border transition-colors ${
                          selectedTemplateId === template.id
                            ? 'border-primary bg-accent/50'
                            : 'border-border hover:bg-accent/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{template.name}</div>
                            {template.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {template.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setWorkspaceName('');
                    setSelectedTemplateId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim() || createWorkspace.isPending}
                >
                  {createWorkspace.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Save Template Dialog */}
      {showSaveTemplateDialog && mounted ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSaveTemplateDialog(false)}
          />
          <div className="relative z-50 w-full max-w-md m-4 border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Save Workspace as Template</h2>
              <button
                onClick={() => setShowSaveTemplateDialog(false)}
                className="p-1.5 hover:bg-accent/60 transition-all duration-150 active:scale-95"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      handleSaveAsTemplate();
                    }
                    if (e.key === 'Escape') {
                      setShowSaveTemplateDialog(false);
                    }
                  }}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Enter template description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSaveTemplateDialog(false);
                    setTemplateName('');
                    setTemplateDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  disabled={!templateName.trim() || createTemplate.isPending}
                >
                  {createTemplate.isPending ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && mounted ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative z-50 w-full max-w-md m-4 border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Delete Workspace</h2>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="p-1.5 hover:bg-accent/60 transition-all duration-150 active:scale-95"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this workspace? This will also delete all layouts
                associated with it. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deleteWorkspace.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleteWorkspace.isPending}
                >
                  {deleteWorkspace.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

