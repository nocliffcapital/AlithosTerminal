'use client';

import React, { useState } from 'react';
import { useThemes, useCreateTheme, useUpdateTheme, useDeleteTheme, Theme } from '@/lib/hooks/useThemes';
import { useThemeStore, ThemeConfig } from '@/stores/theme-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2, Plus, Trash2, Save, Download, Upload, Palette, Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/Toast';

export function ThemeEditor() {
  const { dbUser } = useAuth();
  const { success, error: showError } = useToast();
  const { data: themes = [], isLoading } = useThemes();
  const { currentTheme, setTheme, exportTheme, importTheme, resetToDefault, getDefaultTheme } = useThemeStore();
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [editingConfig, setEditingConfig] = useState<ThemeConfig>(currentTheme);
  const [themeName, setThemeName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const createThemeMutation = useCreateTheme();
  const updateThemeMutation = useUpdateTheme();
  const deleteThemeMutation = useDeleteTheme();

  const handleSaveTheme = async () => {
    if (!themeName.trim()) {
      showError('Invalid input', 'Please enter a theme name');
      return;
    }

    try {
      if (selectedTheme) {
        await updateThemeMutation.mutateAsync({
          themeId: selectedTheme.id,
          data: {
            name: themeName,
            config: editingConfig,
          },
        });
        success('Theme updated', `"${themeName}" has been updated successfully.`);
      } else {
        await createThemeMutation.mutateAsync({
          name: themeName,
          config: editingConfig,
          isPublic: false,
        });
        success('Theme created', `"${themeName}" has been created successfully.`);
        setThemeName('');
        setShowCreate(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save theme';
      showError('Failed to save theme', errorMessage);
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) {
      return;
    }

    try {
      await deleteThemeMutation.mutateAsync(themeId);
      success('Theme deleted', 'Theme has been deleted successfully.');
      if (selectedTheme?.id === themeId) {
        setSelectedTheme(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete theme';
      showError('Failed to delete theme', errorMessage);
    }
  };

  const handleLoadTheme = (theme: Theme) => {
    setSelectedTheme(theme);
    setEditingConfig(theme.config as ThemeConfig);
    setThemeName(theme.name);
    setTheme(theme.config as ThemeConfig);
  };

  const handleApplyTheme = () => {
    setTheme(editingConfig);
    success('Theme applied', 'Theme has been applied successfully.');
  };

  const handleExportTheme = () => {
    const exported = exportTheme();
    navigator.clipboard.writeText(exported);
    success('Theme exported', 'Theme has been copied to clipboard.');
  };

  const handleImportTheme = () => {
    const json = prompt('Paste theme JSON:');
    if (json) {
      try {
        importTheme(json);
        const imported = JSON.parse(json) as ThemeConfig;
        setEditingConfig(imported);
        success('Theme imported', 'Theme has been imported successfully.');
      } catch (err) {
        showError('Invalid JSON', 'Failed to parse theme JSON.');
      }
    }
  };

  const handleColorChange = (colorKey: keyof ThemeConfig['colors'], value: string) => {
    setEditingConfig({
      ...editingConfig,
      colors: {
        ...editingConfig.colors,
        [colorKey]: value,
      },
    });
  };

  const handleRevertToDefault = () => {
    if (!confirm('Are you sure you want to revert to the default theme? This will reset all your theme customizations.')) {
      return;
    }

    const defaultTheme = getDefaultTheme();
    setEditingConfig(defaultTheme);
    setTheme(defaultTheme);
    setSelectedTheme(null);
    setThemeName('');
    success('Theme reverted', 'Theme has been reverted to default settings.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Theme Editor</h2>
          <p className="text-sm text-muted-foreground">
            Customize your terminal appearance with custom themes
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTheme}
            className="text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTheme}
            className="text-xs"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevertToDefault}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Revert to Default
        </Button>
      </div>

      {/* Themes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Saved Themes</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="text-xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Theme
          </Button>
        </div>
        {themes.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground p-8 border border-border rounded">
            <p>No themes saved</p>
            <p className="text-xs mt-1">Create a theme to customize your terminal</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className={`p-3 rounded border border-border cursor-pointer transition-colors ${
                  selectedTheme?.id === theme.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => handleLoadTheme(theme)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{theme.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {theme.isPublic ? 'Public' : 'Private'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTheme(theme.id);
                    }}
                    disabled={deleteThemeMutation.isPending}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete theme"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Theme Editor */}
      <div className="border-t border-border pt-6 space-y-4">
        <div>
          <Label className="text-sm mb-2">Theme Name</Label>
          <Input
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            placeholder="Theme name"
            className="text-sm"
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Colors</Label>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(editingConfig.colors).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="text-sm w-32 capitalize">{key}</Label>
                <Input
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(key as keyof ThemeConfig['colors'], e.target.value)}
                  className="flex-1 h-10"
                />
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleColorChange(key as keyof ThemeConfig['colors'], e.target.value)}
                  className="w-40 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Spacing */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Spacing</Label>
          <div>
            <Label className="text-sm mb-2">Base: {editingConfig.spacing.base}px</Label>
            <Slider
              value={[editingConfig.spacing.base]}
              onValueChange={([value]) => setEditingConfig({
                ...editingConfig,
                spacing: { ...editingConfig.spacing, base: value },
              })}
              min={4}
              max={16}
              step={1}
            />
          </div>
          <div>
            <Label className="text-sm mb-2">Card: {editingConfig.spacing.card}px</Label>
            <Slider
              value={[editingConfig.spacing.card]}
              onValueChange={([value]) => setEditingConfig({
                ...editingConfig,
                spacing: { ...editingConfig.spacing, card: value },
              })}
              min={8}
              max={24}
              step={1}
            />
          </div>
        </div>

        {/* Border Radius */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Border Radius: {editingConfig.borderRadius}px</Label>
          <Slider
            value={[editingConfig.borderRadius]}
            onValueChange={([value]) => setEditingConfig({
              ...editingConfig,
              borderRadius: value,
            })}
            min={0}
            max={16}
            step={0.5}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleApplyTheme}
            className="flex-1"
          >
            <Palette className="h-4 w-4 mr-2" />
            Apply
          </Button>
          <Button
            onClick={handleSaveTheme}
            disabled={!themeName.trim() || createThemeMutation.isPending || updateThemeMutation.isPending}
            className="flex-1"
          >
            {createThemeMutation.isPending || updateThemeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Create Theme Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Theme</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2">Theme Name</Label>
                <Input
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="Theme name"
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setThemeName('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTheme}
                  disabled={!themeName.trim() || createThemeMutation.isPending}
                  className="flex-1"
                >
                  {createThemeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
    </div>
  );
}

