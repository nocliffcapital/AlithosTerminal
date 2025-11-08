'use client';

import React, { useState } from 'react';
import { useThemes, useCreateTheme, useUpdateTheme, useDeleteTheme, Theme } from '@/lib/hooks/useThemes';
import { useThemeStore, ThemeConfig } from '@/stores/theme-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { Loader2, Plus, Trash2, Save, Download, Upload, Palette, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/Toast';

function ThemeEditorCardComponent() {
  const { dbUser } = useAuth();
  const { success, error: showError } = useToast();
  const { data: themes = [], isLoading } = useThemes();
  const { currentTheme, setTheme, exportTheme, importTheme } = useThemeStore();
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
    setEditingConfig(theme.config as unknown as ThemeConfig);
    setThemeName(theme.name);
    setTheme(theme.config as unknown as ThemeConfig);
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
        <h3 className="text-sm font-semibold">Theme Editor</h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs h-6 px-2"
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTheme}
            className="text-xs h-6 px-2"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTheme}
            className="text-xs h-6 px-2"
          >
            <Upload className="h-3 w-3 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Themes List */}
      <div className="flex-1 overflow-auto space-y-2 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Saved Themes</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="text-xs h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>
        {themes.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground p-4">
            <p>No themes saved</p>
            <p className="text-xs mt-1">Create a theme to customize your terminal</p>
          </div>
        ) : (
          themes.map((theme) => (
            <div
              key={theme.id}
              className={`p-2 rounded border border-border cursor-pointer transition-colors ${
                selectedTheme?.id === theme.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleLoadTheme(theme)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{theme.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
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
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete theme"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Theme Editor */}
      <div className="border-t border-border pt-3 space-y-3 flex-shrink-0">
        <div>
          <Label className="text-xs mb-1">Theme Name</Label>
          <Input
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            placeholder="Theme name"
            className="text-xs"
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Colors</Label>
          {Object.entries(editingConfig.colors).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="text-xs w-24 capitalize">{key}</Label>
              <Input
                type="color"
                value={value}
                onChange={(e) => handleColorChange(key as keyof ThemeConfig['colors'], e.target.value)}
                className="flex-1 h-8"
              />
              <Input
                type="text"
                value={value}
                onChange={(e) => handleColorChange(key as keyof ThemeConfig['colors'], e.target.value)}
                className="w-32 text-xs font-mono"
              />
            </div>
          ))}
        </div>

        {/* Spacing */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Spacing</Label>
          <div>
            <Label className="text-xs mb-1">Base: {editingConfig.spacing.base}px</Label>
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
            <Label className="text-xs mb-1">Card: {editingConfig.spacing.card}px</Label>
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
        <div className="space-y-2">
          <Label className="text-xs font-medium">Border Radius: {editingConfig.borderRadius}px</Label>
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleApplyTheme}
            className="flex-1 text-xs"
          >
            <Palette className="h-3 w-3 mr-1" />
            Apply
          </Button>
          <Button
            onClick={handleSaveTheme}
            disabled={!themeName.trim() || createThemeMutation.isPending || updateThemeMutation.isPending}
            className="flex-1 text-xs"
          >
            {createThemeMutation.isPending || updateThemeMutation.isPending ? (
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

      {/* Create Theme Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">Create Theme</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1">Theme Name</Label>
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
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTheme}
                  disabled={!themeName.trim() || createThemeMutation.isPending}
                  className="flex-1 text-xs"
                >
                  {createThemeMutation.isPending ? (
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
    </div>
  );
}

export default ThemeEditorCardComponent;

