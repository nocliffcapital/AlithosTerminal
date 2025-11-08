'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaces, useUpdateWorkspace, useCreateWorkspace } from '@/lib/hooks/useWorkspace';
import { useLayoutStore } from '@/stores/layout-store';
import { X, Lock, Unlock, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function WorkspaceTabs() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspace } = useLayoutStore();
  const layoutStore = useLayoutStore();
  const updateWorkspace = useUpdateWorkspace();
  const createWorkspace = useCreateWorkspace();
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(new Set());
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [insertBefore, setInsertBefore] = useState<boolean>(false); // true = insert before, false = insert after
  const [insertPosition, setInsertPosition] = useState<{ tabId: string; before: boolean } | null>(null); // Clear insertion indicator position
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  
  const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId);

  // Debug logging
  useEffect(() => {
    console.log('[WorkspaceTabs] State:', {
      workspacesCount: workspaces.length,
      currentWorkspaceId,
      hiddenTabsCount: hiddenTabs.size,
      hiddenTabs: Array.from(hiddenTabs),
      isLoading,
    });
  }, [workspaces.length, currentWorkspaceId, hiddenTabs.size, isLoading]);

  // Auto-select first workspace if none is selected and workspaces exist
  useEffect(() => {
    if (!isLoading && workspaces.length > 0 && !currentWorkspaceId) {
      // Find first visible workspace (not hidden)
      const visibleWorkspaces = workspaces.filter((w: any) => !hiddenTabs.has(w.id));
      if (visibleWorkspaces.length > 0) {
        const firstVisible = visibleWorkspaces[0];
        console.log('[WorkspaceTabs] Auto-selecting first visible workspace:', firstVisible.id);
        setCurrentWorkspace(firstVisible.id).catch((err) => {
          console.error('[WorkspaceTabs] Failed to auto-select workspace:', err);
        });
      } else if (workspaces.length > 0) {
        // If all are hidden, show the first one and clear hidden state
        console.log('[WorkspaceTabs] All workspaces hidden, showing first one:', workspaces[0].id);
        setHiddenTabs(new Set());
        setCurrentWorkspace(workspaces[0].id).catch((err) => {
          console.error('[WorkspaceTabs] Failed to auto-select workspace:', err);
        });
      }
    }
  }, [isLoading, workspaces.length, currentWorkspaceId, hiddenTabs, setCurrentWorkspace]);

  // Load tab order from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('workspace-tab-order');
    if (stored) {
      try {
        const order = JSON.parse(stored);
        if (Array.isArray(order)) {
          setTabOrder(order);
        }
      } catch (error) {
        console.error('Failed to load tab order:', error);
      }
    }
  }, []);

  // Save tab order to localStorage whenever it changes
  useEffect(() => {
    if (tabOrder.length > 0) {
      localStorage.setItem('workspace-tab-order', JSON.stringify(tabOrder));
    }
  }, [tabOrder]);

  // Load hidden tabs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hidden-workspace-tabs');
    if (stored) {
      try {
        const hiddenIds = JSON.parse(stored);
        if (Array.isArray(hiddenIds)) {
          setHiddenTabs(new Set(hiddenIds));
        }
      } catch (error) {
        console.error('Failed to load hidden tabs:', error);
      }
    }
  }, []);

  // Clean up hidden tabs - remove any that don't exist in current workspaces
  useEffect(() => {
    if (!isLoading && workspaces.length > 0) {
      setHiddenTabs((prev) => {
        const validWorkspaceIds = new Set(workspaces.map((w: any) => w.id));
        const cleaned = new Set(
          Array.from(prev).filter((id) => validWorkspaceIds.has(id))
        );
        // If all workspaces would be hidden, show at least one
        if (cleaned.size >= workspaces.length) {
          console.log('[WorkspaceTabs] All workspaces were hidden, showing first one');
          return new Set();
        }
        return cleaned;
      });
    }
  }, [isLoading, workspaces]);

  // Save hidden tabs to localStorage whenever it changes
  useEffect(() => {
    if (hiddenTabs.size > 0) {
      localStorage.setItem('hidden-workspace-tabs', JSON.stringify(Array.from(hiddenTabs)));
    } else {
      localStorage.removeItem('hidden-workspace-tabs');
    }
  }, [hiddenTabs]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    try {
      console.log('[WorkspaceTabs] Selecting workspace:', workspaceId);
      await setCurrentWorkspace(workspaceId);
      console.log('[WorkspaceTabs] Workspace selected successfully:', workspaceId);
    } catch (error) {
      console.error('[WorkspaceTabs] Failed to select workspace:', error);
      // Still update the current workspace ID even if layout load fails
      // This ensures the tab appears selected
      layoutStore.setState({ currentWorkspaceId: workspaceId });
    }
  };

  const handleRemoveTab = (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent hiding the last visible tab - always keep at least one tab visible
    const wouldBeVisible = workspaces.filter(
      (w: any) => !hiddenTabs.has(w.id) && w.id !== workspaceId
    );
    
    // Don't allow hiding if it would leave no tabs visible
    if (wouldBeVisible.length === 0) {
      return;
    }
    
    setHiddenTabs((prev) => new Set([...prev, workspaceId]));
    // If removing the active tab, switch to first visible workspace
    if (workspaceId === currentWorkspaceId) {
      if (wouldBeVisible.length > 0) {
        setCurrentWorkspace(wouldBeVisible[0].id);
      }
    }
  };

  const handleToggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWorkspaceId || !currentWorkspace) return;
    
    try {
      await updateWorkspace.mutateAsync({
        id: currentWorkspaceId,
        locked: !currentWorkspace.locked,
      });
    } catch (error) {
      console.error('Failed to toggle workspace lock:', error);
    }
  };


  const handleAddExistingWorkspace = (workspaceId: string) => {
    setHiddenTabs((prev) => {
      const newSet = new Set(prev);
      newSet.delete(workspaceId);
      return newSet;
    });
    setAddMenuOpen(false);
    // Switch to the added workspace
    setCurrentWorkspace(workspaceId);
  };

  const handleCreateNewWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      return;
    }

    try {
      const result = await createWorkspace.mutateAsync({
        name: newWorkspaceName.trim(),
      });
      setNewWorkspaceName('');
      setShowCreateDialog(false);
      setAddMenuOpen(false);
      // Switch to the newly created workspace
      if (result?.workspace?.id) {
        await setCurrentWorkspace(result.workspace.id);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  // Get hidden workspaces that can be added back
  const hiddenWorkspaces = workspaces.filter((w: any) => hiddenTabs.has(w.id));

  // Ensure current workspace is always visible - remove it from hidden tabs if present
  useEffect(() => {
    if (currentWorkspaceId && hiddenTabs.has(currentWorkspaceId)) {
      setHiddenTabs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentWorkspaceId);
        return newSet;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId]);

  // Filter out hidden workspaces, but always include the current workspace
  let visibleWorkspaces = workspaces.filter((w: any) => {
    // Always show the current workspace
    if (w.id === currentWorkspaceId) {
      return true;
    }
    // Show other workspaces that aren't hidden
    return !hiddenTabs.has(w.id);
  });
  
  // Apply custom tab order if available
  if (tabOrder.length > 0) {
    const orderedWorkspaces: any[] = [];
    const unorderedWorkspaces: any[] = [];
    
    // Add workspaces in the order specified by tabOrder
    tabOrder.forEach((workspaceId) => {
      const workspace = visibleWorkspaces.find((w: any) => w.id === workspaceId);
      if (workspace) {
        orderedWorkspaces.push(workspace);
      }
    });
    
    // Add any workspaces not in the order (new workspaces)
    visibleWorkspaces.forEach((workspace: any) => {
      if (!tabOrder.includes(workspace.id)) {
        unorderedWorkspaces.push(workspace);
      }
    });
    
    visibleWorkspaces = [...orderedWorkspaces, ...unorderedWorkspaces];
  }
  
  // If all tabs would be hidden, show at least the first workspace or current workspace
  if (visibleWorkspaces.length === 0 && workspaces.length > 0) {
    const workspaceToShow = workspaces.find((w: any) => w.id === currentWorkspaceId) || workspaces[0];
    visibleWorkspaces = [workspaceToShow];
    // Reset hidden tabs to exclude this workspace
    setHiddenTabs(new Set(workspaces.filter((w: any) => w.id !== workspaceToShow.id).map((w: any) => w.id)));
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, workspaceId: string) => {
    setDraggedTabId(workspaceId);
    (window as any)._lastDragStart = Date.now();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', workspaceId);
  };

  const handleDragOver = (e: React.DragEvent, targetWorkspaceId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedTabId || draggedTabId === targetWorkspaceId) {
      setDragOverTabId(null);
      setInsertPosition(null);
      return;
    }
    
    // Determine if we should insert before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const tabCenter = rect.left + rect.width / 2;
    const shouldInsertBefore = mouseX < tabCenter;
    
    setDragOverTabId(targetWorkspaceId);
    setInsertBefore(shouldInsertBefore);
    setInsertPosition({ tabId: targetWorkspaceId, before: shouldInsertBefore });
  };

  const handleDragLeave = (e: React.DragEvent, workspaceId: string) => {
    // Only clear if we're actually leaving the tab area (not just moving to a child element)
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    
    // Check if we're leaving the tab itself (not just moving to a child element)
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      // Only clear if mouse actually left the tab bounds
      const rect = currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      // Clear if mouse is outside the tab bounds
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        if (dragOverTabId === workspaceId) {
          setDragOverTabId(null);
          setInsertPosition(null);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetWorkspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTabId || draggedTabId === targetWorkspaceId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    const currentOrder = tabOrder.length > 0 ? [...tabOrder] : visibleWorkspaces.map((w: any) => w.id);
    const draggedIndex = currentOrder.indexOf(draggedTabId);
    const targetIndex = currentOrder.indexOf(targetWorkspaceId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    // Remove dragged tab from current position
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    
    // Insert at target position based on insertBefore flag
    let newTargetIndex: number;
    if (draggedIndex < targetIndex) {
      // Moving right: insert after target, but adjust for removed item
      newTargetIndex = insertBefore ? targetIndex - 1 : targetIndex;
    } else {
      // Moving left: insert before or after target
      newTargetIndex = insertBefore ? targetIndex : targetIndex + 1;
    }
    
    newOrder.splice(newTargetIndex, 0, draggedTabId);

    // Add any missing workspace IDs
    visibleWorkspaces.forEach((w: any) => {
      if (!newOrder.includes(w.id)) {
        newOrder.push(w.id);
      }
    });

    setTabOrder(newOrder);
    setDragOverTabId(null);
    
    // Use setTimeout to clear draggedTabId after click event is processed
    setTimeout(() => {
      setDraggedTabId(null);
    }, 0);
  };

  const handleDragEnd = () => {
    // Clear drag state with a small delay to prevent click events from firing
    setTimeout(() => {
      setDraggedTabId(null);
      setDragOverTabId(null);
      setInsertPosition(null);
      delete (window as any)._lastDragStart;
    }, 50);
  };

  const handleDoubleClick = (e: React.MouseEvent, workspaceId: string, currentName: string) => {
    e.stopPropagation();
    setEditingTabId(workspaceId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async (workspaceId: string) => {
    if (!editingName.trim()) {
      // If empty, revert to original name
      const workspace = workspaces.find((w: any) => w.id === workspaceId);
      setEditingTabId(null);
      return;
    }

    try {
      await updateWorkspace.mutateAsync({
        id: workspaceId,
        name: editingName.trim(),
      });
      setEditingTabId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      // Revert to original name on error
      const workspace = workspaces.find((w: any) => w.id === workspaceId);
      if (workspace) {
        setEditingName(workspace.name);
      }
    }
  };

  const handleCancelEdit = (workspaceId: string) => {
    const workspace = workspaces.find((w: any) => w.id === workspaceId);
    if (workspace) {
      setEditingName(workspace.name);
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, workspaceId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(workspaceId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit(workspaceId);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  // Focus create input when dialog opens
  useEffect(() => {
    if (showCreateDialog && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateDialog]);
  
  // Ensure we always have at least one tab visible
  const canRemoveTab = visibleWorkspaces.length > 1;

  if (isLoading) {
    return (
      <div className="border-b border-border bg-background px-4 py-2">
        <div className="text-xs text-muted-foreground">Loading workspaces...</div>
      </div>
    );
  }

  // Always show the tab bar, even if there are no workspaces
  // If no workspaces, show a placeholder tab
  const hasWorkspaces = visibleWorkspaces.length > 0;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm relative">
      <div className="flex items-end gap-0 px-2 py-0 overflow-x-auto scrollbar-hide">
        {hasWorkspaces ? (
          visibleWorkspaces.map((workspace: any, index: number) => {
            const isActive = workspace.id === currentWorkspaceId;
            const isFirst = index === 0;
            const isDragged = draggedTabId === workspace.id;
            const isDragOver = dragOverTabId === workspace.id;
            
            // Calculate transform for smooth sliding animation
            // Animate all tabs that need to move to make space for the dragged tab
            let transform = '';
            if (draggedTabId && draggedTabId !== workspace.id && insertPosition) {
              const currentOrder = tabOrder.length > 0 ? [...tabOrder] : visibleWorkspaces.map((w: any) => w.id);
              const draggedIndex = currentOrder.indexOf(draggedTabId);
              const thisIndex = currentOrder.indexOf(workspace.id);
              const insertTabIndex = currentOrder.indexOf(insertPosition.tabId);
              
              if (draggedIndex !== -1 && thisIndex !== -1 && insertTabIndex !== -1) {
                // Calculate where the dragged tab will be inserted
                let insertIndex: number;
                if (draggedIndex < insertTabIndex) {
                  insertIndex = insertPosition.before ? insertTabIndex - 1 : insertTabIndex;
                } else {
                  insertIndex = insertPosition.before ? insertTabIndex : insertTabIndex + 1;
                }
                
                // Animate tabs that need to move
                if (thisIndex < draggedIndex && thisIndex >= insertIndex) {
                  // Tab is to the left of dragged tab and will be pushed right
                  transform = 'translateX(180px)';
                } else if (thisIndex > draggedIndex && thisIndex <= insertIndex) {
                  // Tab is to the right of dragged tab and will be pushed left
                  transform = 'translateX(-180px)';
                }
              }
            }
            
            // Show insertion indicator
            const showInsertBefore = insertPosition && insertPosition.tabId === workspace.id && insertPosition.before;
            const showInsertAfter = insertPosition && insertPosition.tabId === workspace.id && !insertPosition.before;

            return (
              <ContextMenu key={workspace.id}>
                <ContextMenuTrigger asChild>
                  <div
                    draggable={editingTabId !== workspace.id}
                    onDragStart={(e) => handleDragStart(e, workspace.id)}
                    onDragOver={(e) => handleDragOver(e, workspace.id)}
                    onDragLeave={(e) => handleDragLeave(e, workspace.id)}
                    onDrop={(e) => handleDrop(e, workspace.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      transform: transform || undefined,
                      transition: draggedTabId && transform ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                      willChange: draggedTabId ? 'transform' : 'auto',
                      position: 'relative' as const,
                    }}
                    className={`
                      flex items-center justify-between gap-2 px-4 py-3 transition-all duration-200 group relative
                      min-w-[180px] h-[44px]
                      ${editingTabId === workspace.id ? 'cursor-default' : 'cursor-move'}
                      ${isDragged ? 'opacity-50 z-50' : ''}
                      ${isDragOver && !isDragged ? 'ring-2 ring-primary/50' : ''}
                      ${editingTabId === workspace.id 
                        ? isActive
                          ? 'bg-primary/10 border-t-2 border-l border-r border-t-primary border-primary/50 text-foreground z-10 border-b border-b-card -mb-[1px] shadow-lg ring-2 ring-primary/30'
                          : 'bg-primary/10 border-t border-l border-r border-primary/50 text-foreground shadow-md ring-2 ring-primary/30'
                        : isActive 
                        ? 'bg-card border-t-2 border-l border-r border-t-primary border-border text-foreground z-10 border-b border-b-card -mb-[1px] shadow-sm' 
                        : `bg-accent/20 border-t border-l border-r border-border/40 text-muted-foreground/80 hover:bg-accent/35 hover:text-foreground/90 hover:border-border/60 ${!isFirst ? 'ml-[-1px]' : ''}`
                      }
                    `}
                    onMouseDown={(e) => {
                      // Prevent selection during drag or when editing
                      if (draggedTabId || editingTabId) {
                        e.preventDefault();
                      }
                    }}
                    onMouseUp={(e) => {
                      // Clear draggedTabId if mouse is released (handles incomplete drags)
                      if (draggedTabId && !e.defaultPrevented) {
                        // Small delay to allow drag handlers to complete
                        setTimeout(() => {
                          if (draggedTabId) {
                            setDraggedTabId(null);
                            setDragOverTabId(null);
                            setInsertPosition(null);
                          }
                        }, 100);
                      }
                    }}
                    onClick={(e) => {
                      // Don't select if editing this tab
                      if (editingTabId === workspace.id) {
                        e.preventDefault();
                        return;
                      }
                      // Only prevent if we're actively dragging (not just stuck)
                      // Allow click if it's been more than 200ms since drag started
                      if (draggedTabId) {
                        // Check if this is a real drag or just a stuck state
                        // If mouse hasn't moved much, allow the click
                        const timeSinceDrag = (window as any)._lastDragStart 
                          ? Date.now() - (window as any)._lastDragStart 
                          : Infinity;
                        if (timeSinceDrag < 200) {
                          e.preventDefault();
                          return;
                        }
                        // Clear stuck draggedTabId - it's been too long, treat as stuck
                        console.log('[WorkspaceTabs] Clearing stuck draggedTabId, timeSinceDrag:', timeSinceDrag);
                        setDraggedTabId(null);
                        setDragOverTabId(null);
                        setInsertPosition(null);
                        delete (window as any)._lastDragStart;
                      }
                      console.log('[WorkspaceTabs] Clicking workspace tab:', workspace.id);
                      handleSelectWorkspace(workspace.id);
                    }}
                  >
                {/* Insertion indicator - shows where the tab will be inserted */}
                {showInsertBefore && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-50 shadow-lg shadow-primary/50" />
                )}
                {showInsertAfter && (
                  <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary z-50 shadow-lg shadow-primary/50" />
                )}
                {editingTabId === workspace.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleSaveEdit(workspace.id)}
                    onKeyDown={(e) => handleKeyDown(e, workspace.id)}
                    className="text-xs flex-1 min-w-0 bg-primary/5 border border-primary/40 rounded px-2 py-1 outline-none font-semibold focus:border-primary focus:bg-primary/10 focus:ring-1 focus:ring-primary/50 transition-all"
                    style={{ width: '100%' }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="text-xs whitespace-nowrap truncate flex-1 min-w-0 text-left flex items-center gap-1.5"
                    onDoubleClick={(e) => handleDoubleClick(e, workspace.id, workspace.name)}
                  >
                    <span className={isActive ? 'font-semibold' : 'font-normal'}>{workspace.name}</span>
                  </span>
                )}
                {canRemoveTab && (
                  <button
                    onClick={(e) => handleRemoveTab(workspace.id, e)}
                    className={`flex-shrink-0 p-1 transition-all duration-150 opacity-0 group-hover:opacity-100 active:scale-95 ${
                      isActive 
                        ? 'hover:bg-accent/40' 
                        : 'hover:bg-accent/60'
                    }`}
                    title="Remove from tabs"
                    aria-label="Remove tab"
                  >
                    <X className={`h-3.5 w-3.5 ${isActive ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/60 hover:text-foreground'}`} />
                  </button>
                )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDoubleClick(e as any, workspace.id, workspace.name);
                    }}
                    className="cursor-pointer"
                  >
                    Rename
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        ) : (
          // Show a placeholder tab when there are no workspaces
          <div className="flex items-center justify-center gap-2 px-4 py-3 min-w-[180px] h-[44px] bg-card border-t-2 border-l border-r border-t-primary border-border text-foreground z-10 border-b border-b-card -mb-[1px] shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">No workspaces</span>
          </div>
        )}
        
        {/* Add Workspace Button */}
        <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center gap-1.5 px-3 py-3 h-[44px] transition-all duration-200 bg-accent/20 hover:bg-accent/35 border-t border-l border-r border-border/40 text-muted-foreground/80 hover:text-foreground/90 hover:border-border/60 ml-[-1px] min-w-[48px]"
              title="Add workspace"
              aria-label="Add workspace"
            >
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                setShowCreateDialog(true);
                setAddMenuOpen(false);
              }}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new workspace
            </DropdownMenuItem>
            {hiddenWorkspaces.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Add existing workspace
                  </div>
                  {hiddenWorkspaces.map((workspace: any) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => handleAddExistingWorkspace(workspace.id)}
                      className="cursor-pointer text-xs"
                    >
                      {workspace.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setNewWorkspaceName('');
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Enter a name for your new workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Workspace Name</label>
              <input
                ref={createInputRef}
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateNewWorkspace();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowCreateDialog(false);
                    setNewWorkspaceName('');
                  }
                }}
                placeholder="Enter workspace name..."
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setShowCreateDialog(false);
                setNewWorkspaceName('');
              }}
              className="px-4 py-2 text-sm border border-border rounded hover:bg-accent/60 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNewWorkspace}
              disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {createWorkspace.isPending ? 'Creating...' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Lock icon in bottom right */}
      {currentWorkspace && (
        <div className="absolute bottom-2 right-2 z-20">
          <button
            onClick={handleToggleLock}
            className="p-1.5 transition-all duration-150 hover:bg-accent/60 active:scale-95"
            title={currentWorkspace.locked ? 'Unlock workspace' : 'Lock workspace'}
            aria-label={currentWorkspace.locked ? 'Unlock workspace' : 'Lock workspace'}
          >
            {currentWorkspace.locked ? (
              <Lock className="h-4 w-4 text-status-warning" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

