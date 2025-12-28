import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Layout, Save, LayoutTemplate, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DashboardTemplate, DashboardTemplateConfig } from "@/types/dashboard";
import type { Json } from "@/types/database.types";

interface DashboardTemplateManagerProps {
  currentTemplate: DashboardTemplate;
  onTemplateChange: (template: DashboardTemplate) => void;
}

export function DashboardTemplateManager({
  currentTemplate,
  onTemplateChange,
}: DashboardTemplateManagerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate>(currentTemplate);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const validateConfig = (config: unknown): config is DashboardTemplateConfig => {
    if (typeof config !== 'object' || !config) return false;
    const requiredKeys = [
      'showNetPnL',
      'showTradeWinRate',
      'showProfitFactor',
      'showDayWinRate',
      'showAvgWinLoss',
      'showZellaScore',
      'showCumulativePnL',
      'showCalendar',
      'showDrawdown',
      'showTimePerformance',
      'showDurationPerformance'
    ];
    return requiredKeys.every(key => 
      typeof (config as any)[key] === 'boolean'
    );
  };

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to manage templates",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Transform and validate the data
      const transformedTemplates: DashboardTemplate[] = (data || [])
        .filter(template => validateConfig(template.config))
        .map(template => ({
          id: template.id,
          name: template.name,
          config: template.config as unknown as DashboardTemplateConfig
        }));

      setTemplates(transformedTemplates);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load templates: " + error.message,
        variant: "destructive",
      });
    }
  };

  const saveTemplate = async () => {
    try {
      if (!newTemplateName) {
        toast({
          title: "Error",
          description: "Please enter a template name",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save templates",
          variant: "destructive",
        });
        return;
      }

      const templateData = {
        name: newTemplateName,
        config: selectedTemplate.config as unknown as Json,
        user_id: user.id,
      };

      const { error } = await supabase
        .from('dashboard_templates')
        .insert(templateData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template saved successfully",
      });

      setNewTemplateName("");
      await loadTemplates();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save template: " + error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });

      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete template: " + error.message,
        variant: "destructive",
      });
    }
  };

  const applyTemplate = (template: DashboardTemplate) => {
    onTemplateChange(template);
    setOpen(false);
    toast({
      title: "Success",
      description: "Template applied successfully",
    });
  };

  const toggleComponent = (key: keyof DashboardTemplate['config']) => {
    setSelectedTemplate(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: !prev.config[key],
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutTemplate className="h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dashboard Templates</DialogTitle>
          <DialogDescription>
            Customize your dashboard layout and save it as a template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label>Components</Label>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(selectedTemplate.config).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={() => toggleComponent(key as keyof DashboardTemplate['config'])}
                  />
                  <Label htmlFor={key} className="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Save as New Template</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Button onClick={saveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          {templates.length > 0 && (
            <div className="space-y-4">
              <Label>Saved Templates</Label>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <span>{template.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyTemplate(template)}
                    >
                      <Layout className="h-4 w-4 mr-2" />
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 