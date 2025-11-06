'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Globe, Mail, Webhook, Save, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/lib/hooks/useNotificationPreferences';
import { NotificationPreferences as NotificationPreferencesType } from '@/lib/types/notification-preferences';
import { useToast } from '@/components/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { testWebhook } from '@/lib/notifications/webhook-client';

export function NotificationPreferences() {
  const { data: preferences, isLoading = false } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState<Partial<NotificationPreferencesType>>({
    browser: true,
    email: false,
    webhook: false,
    webhookUrl: '',
  });
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Update form data when preferences load
  useEffect(() => {
    if (preferences) {
      setFormData({
        browser: preferences.browser,
        email: preferences.email,
        webhook: preferences.webhook,
        webhookUrl: preferences.webhookUrl || '',
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      // Validate webhook URL if webhook is enabled
      if (formData.webhook && !formData.webhookUrl) {
        showError('Validation Error', 'Webhook URL is required when webhook notifications are enabled');
        return;
      }

      if (formData.webhookUrl && !isValidUrl(formData.webhookUrl)) {
        showError('Validation Error', 'Invalid webhook URL format');
        return;
      }

      await updateMutation.mutateAsync({
        browser: formData.browser ?? true,
        email: formData.email ?? false,
        webhook: formData.webhook ?? false,
        webhookUrl: formData.webhook ? formData.webhookUrl : undefined,
      });

      success('Preferences Updated', 'Your notification preferences have been saved successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      showError('Update Failed', errorMessage);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleTestWebhook = async () => {
    if (!formData.webhookUrl || !isValidUrl(formData.webhookUrl)) {
      showError('Validation Error', 'Please enter a valid webhook URL first');
      return;
    }

    setTestingWebhook(true);
    try {
      const result = await testWebhook(formData.webhookUrl);
      
      if (result.success) {
        success(
          'Webhook Test Successful',
          `Webhook responded successfully (${result.statusCode}) in ${result.responseTime}ms`
        );
      } else {
        showError(
          'Webhook Test Failed',
          result.error || `HTTP ${result.statusCode || 'Unknown error'}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test webhook';
      showError('Test Failed', errorMessage);
    } finally {
      setTestingWebhook(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="sm" text="Loading preferences..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground">
            Configure how you receive alerts and notifications
          </p>
        </div>
      </div>

      {/* Browser Notifications */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="browser" className="flex-1 cursor-pointer">
            <div className="font-medium">Browser Notifications</div>
            <div className="text-xs text-muted-foreground">
              Show browser notifications when alerts are triggered
            </div>
          </Label>
          <input
            id="browser"
            type="checkbox"
            checked={formData.browser ?? true}
            onChange={(e) => setFormData({ ...formData, browser: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </div>
      </div>

      {/* Email Notifications */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="email" className="flex-1 cursor-pointer">
            <div className="font-medium">Email Notifications</div>
            <div className="text-xs text-muted-foreground">
              Send email notifications when alerts are triggered (requires email address)
            </div>
          </Label>
          <input
            id="email"
            type="checkbox"
            checked={formData.email ?? false}
            onChange={(e) => setFormData({ ...formData, email: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </div>
      </div>

      {/* Webhook Notifications */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="webhook" className="flex-1 cursor-pointer">
            <div className="font-medium">Webhook Notifications</div>
            <div className="text-xs text-muted-foreground">
              Send HTTP POST requests to your webhook URL when alerts are triggered
            </div>
          </Label>
          <input
            id="webhook"
            type="checkbox"
            checked={formData.webhook ?? false}
            onChange={(e) => setFormData({ ...formData, webhook: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </div>

        {/* Webhook URL Input */}
        {formData.webhook && (
          <div className="ml-7 space-y-2">
            <Label htmlFor="webhookUrl" className="text-xs text-muted-foreground">
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://example.com/webhook"
                value={formData.webhookUrl || ''}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestWebhook}
                disabled={testingWebhook || !formData.webhookUrl || !isValidUrl(formData.webhookUrl)}
                className="shrink-0"
              >
                {testingWebhook ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Your webhook will receive POST requests with alert data in JSON format
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={updateMutation?.isPending || false}
          className="min-w-[100px]"
        >
          {updateMutation?.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

