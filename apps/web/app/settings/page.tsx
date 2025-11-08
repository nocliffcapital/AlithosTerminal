'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Palette, Bell, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeEditor } from '@/components/settings/ThemeEditor';
import { AlertsManager } from '@/components/settings/AlertsManager';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'theme' | 'alerts' | 'notifications'>('theme');

  const tabs = [
    { id: 'theme' as const, label: 'Theme Editor', icon: Palette },
    { id: 'alerts' as const, label: 'Alerts & Automation', icon: Bell },
    { id: 'notifications' as const, label: 'Notifications', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-8 w-8 hover:bg-accent hover:border-border"
            title="Back to workspace"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage your theme, alerts, and notification preferences
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-card border border-border shadow-card p-4 sm:p-6">
          {activeTab === 'theme' && <ThemeEditor />}
          {activeTab === 'alerts' && <AlertsManager />}
          {activeTab === 'notifications' && <NotificationPreferences />}
        </div>
      </div>
    </div>
  );
}

