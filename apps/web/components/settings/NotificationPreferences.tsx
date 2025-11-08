'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Globe, Mail, Webhook, Save, Loader2, Play, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/lib/hooks/useNotificationPreferences';
import { NotificationPreferences as NotificationPreferencesType } from '@/lib/types/notification-preferences';
import { useToast } from '@/components/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { testWebhook } from '@/lib/notifications/webhook-client';
import { testTelegramConnection } from '@/lib/notifications/telegram-client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function NotificationPreferences() {
  const { dbUser } = useAuth();
  const { data: preferences, isLoading = false } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<NotificationPreferencesType>>({
    browser: true,
    email: false,
    webhook: false,
    webhookUrl: '',
    telegram: false,
    telegramUsername: '',
  });
  const [emailAddress, setEmailAddress] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Update form data when preferences load
  useEffect(() => {
    if (preferences) {
      setFormData({
        browser: preferences.browser,
        email: preferences.email,
        webhook: preferences.webhook,
        webhookUrl: preferences.webhookUrl || '',
        telegram: preferences.telegram,
        telegramUsername: preferences.telegramUsername || '',
      });
    }
  }, [preferences]);

  // Update email address when user loads
  useEffect(() => {
    if (dbUser?.email) {
      setEmailAddress(dbUser.email);
    }
  }, [dbUser]);

  // Mutation to update user email
  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update email');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
      success('Email Updated', 'Your email address has been updated successfully.');
    },
    onError: (error: Error) => {
      showError('Update Failed', error.message);
    },
  });

  const handleSave = async () => {
    try {
      // Validate email if email notifications are enabled
      if (formData.email && !emailAddress) {
        showError('Validation Error', 'Email address is required when email notifications are enabled');
        return;
      }

      if (formData.email && !isValidEmail(emailAddress)) {
        showError('Validation Error', 'Invalid email address format');
        return;
      }

      // Validate webhook URL if webhook is enabled
      if (formData.webhook && !formData.webhookUrl) {
        showError('Validation Error', 'Webhook URL is required when webhook notifications are enabled');
        return;
      }

      if (formData.webhookUrl && !isValidUrl(formData.webhookUrl)) {
        showError('Validation Error', 'Invalid webhook URL format');
        return;
      }

      // Validate Telegram username if Telegram notifications are enabled
      if (formData.telegram && !formData.telegramUsername) {
        showError('Validation Error', 'Telegram username is required when Telegram notifications are enabled');
        return;
      }

      if (formData.telegramUsername && !isValidTelegramUsername(formData.telegramUsername)) {
        showError('Validation Error', 'Invalid Telegram username format. Must start with @ and be 5-32 characters (alphanumeric and underscores only)');
        return;
      }

      // Update email if it changed
      if (emailAddress !== dbUser?.email) {
        setUpdatingEmail(true);
        await updateEmailMutation.mutateAsync(emailAddress);
        setUpdatingEmail(false);
      }

      // Update notification preferences
      await updateMutation.mutateAsync({
        browser: formData.browser ?? true,
        email: formData.email ?? false,
        webhook: formData.webhook ?? false,
        webhookUrl: formData.webhook ? formData.webhookUrl : undefined,
        telegram: formData.telegram ?? false,
        telegramUsername: formData.telegram ? formData.telegramUsername : undefined,
      });

      success('Preferences Updated', 'Your notification preferences have been saved successfully.');
    } catch (error) {
      setUpdatingEmail(false);
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

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidTelegramUsername = (username: string): boolean => {
    // Telegram username format: @username, 5-32 chars, alphanumeric and underscores only
    const telegramUsernameRegex = /^@[a-zA-Z0-9_]{5,32}$/;
    return telegramUsernameRegex.test(username);
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

  const handleTestTelegram = async () => {
    if (!formData.telegramUsername || !isValidTelegramUsername(formData.telegramUsername)) {
      showError('Validation Error', 'Please enter a valid Telegram username first (e.g., @username)');
      return;
    }

    setTestingTelegram(true);
    try {
      const result = await testTelegramConnection(formData.telegramUsername);
      
      if (result.success) {
        success(
          'Telegram Test Successful',
          'Test message sent successfully! Check your Telegram.'
        );
      } else {
        showError(
          'Telegram Test Failed',
          result.error || 'Failed to send test message. Make sure the username is correct and the bot is not blocked.'
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test Telegram connection';
      showError('Test Failed', errorMessage);
    } finally {
      setTestingTelegram(false);
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

        {/* Email Address Input */}
        <div className="ml-7 space-y-2">
          <Label htmlFor="emailAddress" className="text-sm font-medium">
            Email Address
          </Label>
          <Input
            id="emailAddress"
            type="email"
            placeholder="your.email@example.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="text-sm"
          />
          <div className="text-xs text-muted-foreground">
            This email will be used for email notifications when alerts are triggered
          </div>
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
            <Label htmlFor="webhookUrl" className="text-sm font-medium">
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
                title="Test webhook"
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

      {/* Telegram Notifications */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Send className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="telegram" className="flex-1 cursor-pointer">
            <div className="font-medium">Telegram Notifications</div>
            <div className="text-xs text-muted-foreground">
              Send Telegram messages when alerts are triggered (requires Telegram username)
            </div>
          </Label>
          <input
            id="telegram"
            type="checkbox"
            checked={formData.telegram ?? false}
            onChange={(e) => setFormData({ ...formData, telegram: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </div>

        {/* Telegram Username Input */}
        {formData.telegram && (
          <div className="ml-7 space-y-2">
            <Label htmlFor="telegramUsername" className="text-sm font-medium">
              Telegram Username
            </Label>
            <div className="flex gap-2">
              <Input
                id="telegramUsername"
                type="text"
                placeholder="@username"
                value={formData.telegramUsername || ''}
                onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestTelegram}
                disabled={testingTelegram || !formData.telegramUsername || !isValidTelegramUsername(formData.telegramUsername || '')}
                className="shrink-0"
                title="Test Telegram connection"
              >
                {testingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Enter your Telegram username (e.g., @username). Make sure you have started a conversation with <span className="font-medium">@alithos_bot</span> first.
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={updateMutation?.isPending || updatingEmail || updateEmailMutation.isPending}
          className="min-w-[100px]"
        >
          {updateMutation?.isPending || updatingEmail || updateEmailMutation.isPending ? (
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

