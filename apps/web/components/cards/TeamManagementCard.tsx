'use client';

import React, { useState } from 'react';
import { useTeams, useCreateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember, useUpdateTeamMember, Team, TeamMember } from '@/lib/hooks/useTeams';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2, Plus, Trash2, UserPlus, X, Shield, Crown, Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/Toast';

function TeamManagementCardComponent() {
  const { dbUser } = useAuth();
  const { success, error: showError } = useToast();
  const { data: teams = [], isLoading } = useTeams();
  const { data: workspaces = [] } = useWorkspaces();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [newMemberUserId, setNewMemberUserId] = useState('');

  const createTeamMutation = useCreateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const addMemberMutation = useAddTeamMember();
  const removeMemberMutation = useRemoveTeamMember();
  const updateMemberMutation = useUpdateTeamMember();

  const handleCreateTeam = async () => {
    if (!newTeamName || !selectedWorkspaceId) {
      showError('Invalid input', 'Please fill in all fields');
      return;
    }

    try {
      await createTeamMutation.mutateAsync({
        workspaceId: selectedWorkspaceId,
        name: newTeamName,
      });
      success('Team created', `"${newTeamName}" has been created successfully.`);
      setNewTeamName('');
      setSelectedWorkspaceId('');
      setShowCreateTeam(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
      showError('Failed to create team', errorMessage);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) {
      return;
    }

    try {
      await deleteTeamMutation.mutateAsync(teamId);
      success('Team deleted', 'Team has been deleted successfully.');
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete team';
      showError('Failed to delete team', errorMessage);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !newMemberUserId) {
      showError('Invalid input', 'Please fill in all fields');
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        teamId: selectedTeam.id,
        userId: newMemberUserId,
      });
      success('Member added', 'Member has been added to the team.');
      setNewMemberUserId('');
      setShowAddMember(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add member';
      showError('Failed to add member', errorMessage);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam || !confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync({
        teamId: selectedTeam.id,
        memberId,
      });
      success('Member removed', 'Member has been removed from the team.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      showError('Failed to remove member', errorMessage);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') => {
    if (!selectedTeam) return;

    try {
      await updateMemberMutation.mutateAsync({
        teamId: selectedTeam.id,
        memberId,
        role: newRole,
      });
      success('Role updated', `Member role has been updated to ${newRole}.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      showError('Failed to update role', errorMessage);
    }
  };

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-3 w-3 text-yellow-400" />;
      case 'ADMIN':
        return <Shield className="h-3 w-3 text-blue-400" />;
      case 'MEMBER':
        return <Users className="h-3 w-3 text-green-400" />;
      case 'VIEWER':
        return <Eye className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold">Team Management</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateTeam(true)}
          className="text-xs h-6 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Team
        </Button>
      </div>

      {/* Teams List */}
      <div className="flex-1 overflow-auto space-y-2 mb-3">
        {teams.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <p>No teams found</p>
              <p className="text-xs mt-1">Create a team to collaborate</p>
            </div>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className={`p-2 rounded border border-border cursor-pointer transition-colors ${
                selectedTeam?.id === team.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{team.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTeam(team.id);
                  }}
                  disabled={deleteTeamMutation.isPending}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete team"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Team Details */}
      {selectedTeam && (
        <div className="border-t border-border pt-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold">{selectedTeam.name}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddMember(true)}
              className="text-xs h-6 px-2"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Add Member
            </Button>
          </div>
          
          <div className="space-y-1 max-h-32 overflow-auto">
            {selectedTeam.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getRoleIcon(member.role)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{member.user.email || member.user.walletAddress?.slice(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{member.role.toLowerCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(['MEMBER', 'VIEWER'] as const).includes(member.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateMemberRole(member.id, 'ADMIN')}
                      className="h-5 w-5 p-0"
                      title="Promote to Admin"
                    >
                      <Shield className="h-3 w-3 text-blue-400" />
                    </Button>
                  )}
                  {member.role !== 'OWNER' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removeMemberMutation.isPending}
                      className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove member"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team Dialog */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">Create Team</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1">Team Name</Label>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Team name"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Workspace</Label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
                >
                  <option value="">Select workspace</option>
                  {workspaces.map((ws: any) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateTeam(false);
                    setNewTeamName('');
                    setSelectedWorkspaceId('');
                  }}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName || !selectedWorkspaceId || createTeamMutation.isPending}
                  className="flex-1 text-xs"
                >
                  {createTeamMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      {showAddMember && selectedTeam && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">Add Member</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1">User ID</Label>
                <Input
                  value={newMemberUserId}
                  onChange={(e) => setNewMemberUserId(e.target.value)}
                  placeholder="User ID"
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMemberUserId('');
                  }}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={!newMemberUserId || addMemberMutation.isPending}
                  className="flex-1 text-xs"
                >
                  {addMemberMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add'
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

export default TeamManagementCardComponent;

