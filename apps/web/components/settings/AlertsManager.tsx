'use client';

import React, { useState, useEffect } from 'react';
import { alertSystem, Alert, AlertCondition, AlertAction } from '@/lib/alerts/alert-system';
import { useAlertSystem } from '@/lib/hooks/useAlertSystem';
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert } from '@/lib/hooks/useAlerts';
import { useAlertHistory } from '@/lib/hooks/useAlertHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Bell, Loader2, History, Play, CheckCircle2, XCircle, Sparkles, Search } from 'lucide-react';
import { MarketSelector } from '@/components/MarketSelector';
import { useMarketStore } from '@/stores/market-store';
import { useToast } from '@/components/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ALERT_TEMPLATES, AlertTemplate, templateToAlert } from '@/lib/alerts/alert-templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AlertsManager() {
  // Connect alert system to real market data
  useAlertSystem();
  
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: alerts = [], isLoading, refetch } = useAlerts();
  const createAlertMutation = useCreateAlert();
  const updateAlertMutation = useUpdateAlert();
  const deleteAlertMutation = useDeleteAlert();
  const { success, error: showError } = useToast();
  const { data: alertHistoryData, isLoading: isLoadingHistory } = useAlertHistory({ limit: 10 });
  
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    alertId: string;
    results: Awaited<ReturnType<typeof alertSystem.testAlert>>;
  } | null>(null);
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({
    name: '',
    marketId: selectedMarketId || undefined,
    conditions: [],
    actions: [],
    isActive: true,
  });

  // Sync alerts from database to in-memory alert system
  useEffect(() => {
    if (alerts.length > 0) {
      // Clear existing alerts
      const existingAlerts = alertSystem.getAllAlerts();
      existingAlerts.forEach((alert) => {
        alertSystem.removeAlert(alert.id);
      });

      // Add alerts from database
      alerts.forEach((alert) => {
        alertSystem.addAlert(alert);
      });
    }
  }, [alerts]);

  const addCondition = () => {
    setNewAlert({
      ...newAlert,
      conditions: [
        ...(newAlert.conditions || []),
        { type: 'price', operator: 'lt', value: 0 },
      ],
    });
  };

  const removeCondition = (index: number) => {
    setNewAlert({
      ...newAlert,
      conditions: newAlert.conditions?.filter((_, i) => i !== index) || [],
    });
  };

  const addAction = () => {
    setNewAlert({
      ...newAlert,
      actions: [
        ...(newAlert.actions || []),
        { type: 'notify', config: { message: 'Alert triggered' } },
      ],
    });
  };

  const removeAction = (index: number) => {
    setNewAlert({
      ...newAlert,
      actions: newAlert.actions?.filter((_, i) => i !== index) || [],
    });
  };

  const createAlert = async () => {
    if (!newAlert.name || !newAlert.conditions?.length || !newAlert.actions?.length) {
      return;
    }

    try {
      const createdAlert = await createAlertMutation.mutateAsync({
        name: newAlert.name,
        marketId: newAlert.marketId,
        conditions: newAlert.conditions as AlertCondition[],
        actions: newAlert.actions as AlertAction[],
        isActive: newAlert.isActive ?? true,
        cooldownPeriodMinutes: newAlert.cooldownPeriodMinutes,
      });

      // Add to in-memory alert system
      alertSystem.addAlert(createdAlert);

      setShowCreate(false);
      setNewAlert({ name: '', conditions: [], actions: [], isActive: true });
      
      success('Alert created', `"${createdAlert.name}" has been created successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create alert';
      showError('Failed to create alert', errorMessage);
    }
  };

  const toggleAlert = async (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      try {
        const updatedAlert = await updateAlertMutation.mutateAsync({
          id,
          isActive: !alert.isActive,
        });

        // Update in-memory alert system
        alertSystem.updateAlert(id, { isActive: updatedAlert.isActive });
        
        success(
          `Alert ${updatedAlert.isActive ? 'activated' : 'deactivated'}`,
          `"${updatedAlert.name}" has been ${updatedAlert.isActive ? 'activated' : 'deactivated'}.`
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update alert';
        showError('Failed to update alert', errorMessage);
      }
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await deleteAlertMutation.mutateAsync(id);

      // Remove from in-memory alert system
      alertSystem.removeAlert(id);
      
      const alertName = alerts.find((a) => a.id === id)?.name || 'Alert';
      success('Alert deleted', `"${alertName}" has been deleted.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete alert';
      showError('Failed to delete alert', errorMessage);
    }
  };

  const testAlert = async (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;

    setTestingAlert(id);
    try {
      const results = await alertSystem.testAlert(alert);
      setTestResults({ alertId: id, results });
      if (results.wouldTrigger) {
        success('Alert test', 'Alert would trigger with current market conditions.');
      } else {
        showError('Alert test', 'Alert would not trigger. Some conditions are not met.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test alert';
      showError('Failed to test alert', errorMessage);
    } finally {
      setTestingAlert(null);
    }
  };

  const applyTemplate = (template: AlertTemplate) => {
    const alertFromTemplate = templateToAlert(template, selectedMarketId || undefined);
    setNewAlert(alertFromTemplate);
    setShowTemplates(false);
    setShowCreate(true);
    success('Template applied', `"${template.name}" template loaded. Customize and create your alert.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Alerts & Automation</h2>
          <p className="text-sm text-muted-foreground">
            Create multi-signal alerts and automate trading actions
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-border">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTemplates(true)}
            className="text-xs"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
      </div>

      {/* Create Alert Form */}
      {showCreate && (
        <div className="p-4 border border-border rounded space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Create New Alert</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewAlert({ name: '', conditions: [], actions: [], isActive: true });
              }}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>

          <Input
            placeholder="Alert name"
            value={newAlert.name || ''}
            onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
            className="text-sm"
          />

          {/* Market Selection */}
          <div>
            <Label className="text-sm mb-2">Market (optional)</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Select market (optional for global alerts)"
                  value={newAlert.marketId ? getMarket(newAlert.marketId)?.question || newAlert.marketId : ''}
                  readOnly
                  onClick={() => setShowMarketSelector(true)}
                  className="flex-1 text-sm cursor-pointer pl-10"
                />
              </div>
              {newAlert.marketId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewAlert({ ...newAlert, marketId: undefined })}
                  className="text-destructive hover:text-destructive"
                  title="Clear market"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMarketSelector(true)}
                className="text-xs"
              >
                Select
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2">Conditions (AND)</Label>
            <div className="text-xs text-muted-foreground mb-3">
              All conditions must be met for the alert to trigger
            </div>
            {newAlert.conditions?.map((condition, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 p-3 bg-muted/30 border border-border rounded">
                <Select
                  value={condition.type}
                  onValueChange={(value) => {
                    const updated = [...(newAlert.conditions || [])];
                    updated[index] = { ...condition, type: value as any };
                    setNewAlert({ ...newAlert, conditions: updated });
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder="Select condition type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price (%)</SelectItem>
                    <SelectItem value="volume">Volume (24h USDC)</SelectItem>
                    <SelectItem value="depth">Order Book Depth</SelectItem>
                    <SelectItem value="spread">Spread (%)</SelectItem>
                    <SelectItem value="flow">Trade Flow</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(value) => {
                    const updated = [...(newAlert.conditions || [])];
                    updated[index] = { ...condition, operator: value as any };
                    setNewAlert({ ...newAlert, conditions: updated });
                  }}
                >
                  <SelectTrigger className="w-36 h-9 text-sm">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lt">&lt; (Less than)</SelectItem>
                    <SelectItem value="gt">&gt; (Greater than)</SelectItem>
                    <SelectItem value="lte">&le; (Less or equal)</SelectItem>
                    <SelectItem value="gte">&ge; (Greater or equal)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => {
                    const updated = [...(newAlert.conditions || [])];
                    updated[index] = { ...condition, value: parseFloat(e.target.value) || 0 };
                    setNewAlert({ ...newAlert, conditions: updated });
                  }}
                  className="w-32 text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remove condition"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={addCondition}
              className="text-xs mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>

          <div>
            <Label className="text-sm mb-2">Actions</Label>
            <div className="text-xs text-muted-foreground mb-3">
              Actions to execute when all conditions are met
            </div>
            {newAlert.actions?.map((action, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 p-3 bg-muted/30 border border-border rounded">
                <Select
                  value={action.type}
                  onValueChange={(value) => {
                    const updated = [...(newAlert.actions || [])];
                    updated[index] = { ...action, type: value as any };
                    setNewAlert({ ...newAlert, actions: updated });
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Notify (Browser/Email/Webhook)</SelectItem>
                    <SelectItem value="order">Place Order</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAction(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remove action"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={addAction}
              className="text-xs mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </div>

          {/* Cooldown Period */}
          <div className="p-3 bg-muted/30 border border-border rounded">
            <Label className="text-sm mb-2 block">Cooldown Period (minutes)</Label>
            <Input
              type="number"
              placeholder="0 (no cooldown)"
              value={newAlert.cooldownPeriodMinutes !== undefined ? newAlert.cooldownPeriodMinutes : ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                setNewAlert({ ...newAlert, cooldownPeriodMinutes: value });
              }}
              min="0"
              className="text-sm max-w-xs"
            />
            <div className="text-xs text-muted-foreground mt-2">
              Prevents alert from triggering again within this time period after the first trigger
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              onClick={createAlert}
              className="flex-1"
              disabled={!newAlert.name || !newAlert.conditions?.length || !newAlert.actions?.length}
            >
              Create Alert
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setNewAlert({ name: '', conditions: [], actions: [], isActive: true });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Market Selector Modal */}
      <MarketSelector
        open={showMarketSelector}
        onOpenChange={setShowMarketSelector}
        onSelect={(marketId) => {
          setNewAlert({ ...newAlert, marketId });
          setShowMarketSelector(false);
        }}
      />

      {/* Alerts List */}
      {!showHistory && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner size="sm" text="Loading alerts..." />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No alerts configured"
              description="Create alerts to get notified when market conditions change"
              action={{
                label: 'Create Alert',
                onClick: () => setShowCreate(true),
              }}
              className="p-8"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded ${
                    alert.isActive ? 'bg-card border-border' : 'bg-muted border-muted opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bell className={`h-4 w-4 ${alert.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-medium text-sm">{alert.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testAlert(alert.id)}
                        disabled={testingAlert === alert.id}
                        className="h-8 w-8 p-0"
                        title="Test alert conditions"
                      >
                        {testingAlert === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAlert(alert.id)}
                        className={`text-xs px-2 h-8 ${
                          alert.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {alert.isActive ? 'Active' : 'Inactive'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAlert(alert.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {alert.marketId && (
                      <div className="truncate">
                        Market: {getMarket(alert.marketId)?.question || alert.marketId.substring(0, 20) + '...'}
                      </div>
                    )}
                    <div>
                      {alert.conditions.length} condition{alert.conditions.length !== 1 ? 's' : ''} ·{' '}
                      {alert.actions.length} action{alert.actions.length !== 1 ? 's' : ''}
                    </div>
                    {alert.lastTriggered && (
                      <div>Last triggered: {new Date(alert.lastTriggered).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert History */}
      {showHistory && (
        <div className="space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner size="sm" text="Loading history..." />
            </div>
          ) : !alertHistoryData?.history || alertHistoryData.history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No alert history"
              description="Alert triggers will appear here once alerts are triggered"
              className="p-8"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alertHistoryData.history.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 border border-border rounded bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{entry.alertName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.triggeredAt).toLocaleString()}
                    </span>
                  </div>
                  {entry.marketId && (
                    <div className="text-xs text-muted-foreground truncate mb-1">
                      Market: {getMarket(entry.marketId)?.question || entry.marketId.substring(0, 20) + '...'}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Triggered by {Array.isArray(entry.conditionsSnapshot) ? entry.conditionsSnapshot.length : 0} conditions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alert Templates</DialogTitle>
            <DialogDescription>
              Select a pre-built template to quickly create common alerts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {Object.entries(
              ALERT_TEMPLATES.reduce((acc, template) => {
                if (!acc[template.category]) {
                  acc[template.category] = [];
                }
                acc[template.category].push(template);
                return acc;
              }, {} as Record<string, AlertTemplate[]>)
            ).map(([category, templates]) => (
              <div key={category} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="p-3 text-left border border-border rounded hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {template.description}
                          </div>
                        </div>
                        {template.defaultCooldownMinutes && (
                          <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {template.defaultCooldownMinutes}m cooldown
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-2">
                        {template.conditions.length} condition{template.conditions.length !== 1 ? 's' : ''} ·{' '}
                        {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTemplates(false)}
              size="sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={!!testResults} onOpenChange={(open) => !open && setTestResults(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alert Test Results</DialogTitle>
            <DialogDescription>
              {testResults && (
                <span>
                  Testing alert: {alerts.find((a) => a.id === testResults.alertId)?.name || 'Unknown'}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {testResults && (
            <div className="space-y-3 py-4">
              {/* Overall Result */}
              <div className={`p-3 rounded border ${
                testResults.results.wouldTrigger
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <div className="flex items-center gap-2">
                  {testResults.results.wouldTrigger ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-400" />
                  )}
                  <div>
                    <div className="font-semibold text-sm">
                      {testResults.results.wouldTrigger ? 'Alert Would Trigger' : 'Alert Would Not Trigger'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {testResults.results.wouldTrigger
                        ? 'All conditions are met with current market data.'
                        : 'Some conditions are not met. See details below.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Condition Results */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Condition Results:</div>
                {testResults.results.conditions.map((conditionResult, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border text-xs ${
                      conditionResult.passed
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {conditionResult.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        )}
                        <span className="font-medium">
                          Condition {index + 1}: {conditionResult.description}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 pl-6">
                      Current value: <span className="font-mono">{conditionResult.currentValue.toFixed(2)}</span>
                      {' '}· Threshold: <span className="font-mono">{conditionResult.condition.value.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestResults(null)}
              size="sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

