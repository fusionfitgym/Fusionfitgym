'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Edit3,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Copy,
  Info,
  Layers,
  ArrowLeft,
  Smartphone,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import {
  getSMSTemplatesAction,
  saveSMSTemplateAction,
  resetSMSTemplateAction
} from '@/lib/actions/sms';
import { SMSTemplate, renderTemplate } from '@/lib/sms-templates';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

// Sample mock data for live dynamic preview rendering
const MOCK_PREVIEW_DATA: Record<string, string> = {
  member_name: 'Rahul Sharma',
  memberName: 'Rahul Sharma',
  gym_name: 'FusionFit Gym',
  gymName: 'FusionFit Gym',
  invoice_number: 'INV-1004',
  invoiceNumber: 'INV-1004',
  invoice_date: '27 Jul 2026',
  invoiceDate: '27 Jul 2026',
  plan_name: '1 Month - Weight Training + Cardio',
  planName: '1 Month - Weight Training + Cardio',
  amount: '1300',
  payment_method: 'UPI',
  paymentMethod: 'UPI',
  expiry_date: '27 Aug 2026',
  expiryDate: '27 Aug 2026',
  invoice_link: 'https://fusionfit.app/i/demo123',
  invoiceLink: 'https://fusionfit.app/i/demo123',
  phone: '+91 98765 43210',
  renewal_link: 'https://fusionfit.app/renew/demo123',
  renewalLink: 'https://fusionfit.app/renew/demo123'
};

export default function SMSTemplatesPage() {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Edit Modal state
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [formSubject, setFormSubject] = useState<string>('');
  const [formBody, setFormBody] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  // Load / Seed templates
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSMSTemplatesAction();
      setTemplates(data);
    } catch (err: any) {
      console.error('Failed to load SMS templates:', err);
      toast.error('Failed to load SMS templates. Check connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Open Edit Dialog
  const handleOpenEdit = (template: SMSTemplate) => {
    setEditingTemplate(template);
    setFormSubject(template.subject || '');
    setFormBody(template.body || '');
  };

  // Insert Variable into body at current cursor position or end
  const handleInsertVariable = (varName: string) => {
    const tag = `{{${varName}}}`;
    setFormBody(prev => {
      if (!prev) return tag;
      return prev + ' ' + tag;
    });
    setCopiedVariable(varName);
    setTimeout(() => setCopiedVariable(null), 1500);
    toast.info(`Inserted ${tag} into message body.`);
  };

  // Save template
  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!formBody.trim()) {
      toast.error('Template message body cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveSMSTemplateAction(
        editingTemplate.id,
        formSubject,
        formBody
      );
      if (res.success) {
        toast.success(res.message);
        setEditingTemplate(null);
        await loadTemplates();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Default
  const handleReset = async (templateId: string) => {
    setIsResetting(true);
    try {
      const res = await resetSMSTemplateAction(templateId);
      if (res.success) {
        toast.success(res.message);
        if (editingTemplate && editingTemplate.id === templateId) {
          setEditingTemplate(null);
        }
        await loadTemplates();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Reset failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/sms" className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SMS Templates Management
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Configure automated SMS notification content, subject lines, and dynamic placeholders.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTemplates()}
            disabled={isLoading}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh Templates
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(idx => (
            <div key={idx} className="h-80 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse p-6" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map(tmpl => {
            const previewText = renderTemplate(tmpl.body, MOCK_PREVIEW_DATA);
            return (
              <motion.div
                key={tmpl.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-6 shadow-xl hover:border-indigo-500/40 transition-all group relative overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Category & Title */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-indigo-500/40 bg-indigo-950/40 text-indigo-300 text-xs px-2.5 py-0.5">
                      {tmpl.category}
                    </Badge>
                    <span className="text-xs text-slate-500 font-mono">ID: {tmpl.id}</span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>{tmpl.name}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">{tmpl.description}</p>
                  </div>

                  {/* Subject Line */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider block text-[10px]">Subject</span>
                    <p className="font-bold text-slate-200">{tmpl.subject || tmpl.name}</p>
                  </div>

                  {/* Template Message Body Preview */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Message Template Body</span>
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {tmpl.body}
                    </div>
                  </div>

                  {/* Supported Variables List */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Supported Variables</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tmpl.variables.map(v => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="bg-slate-800/80 text-slate-300 border border-slate-700 text-[11px] font-mono px-2 py-0.5"
                        >
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReset(tmpl.id)}
                    disabled={isResetting}
                    className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Default
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleOpenEdit(tmpl)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 text-xs px-4"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit Template
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* EDIT TEMPLATE DIALOG */}
      <Dialog open={!!editingTemplate} onOpenChange={open => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              Edit SMS Template: {editingTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Customize the subject and message body. Click variable chips below to insert tags automatically.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-5 pt-2">
              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Template Subject</label>
                <Input
                  value={formSubject}
                  onChange={e => setFormSubject(e.target.value)}
                  placeholder="Subject Line..."
                  className="bg-slate-950 border-slate-800 text-slate-100 font-semibold text-xs"
                />
              </div>

              {/* Message Body Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">Message Body *</label>
                  <span className="text-slate-500 font-mono text-[11px]">{formBody.length} characters</span>
                </div>
                <Textarea
                  rows={8}
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Enter SMS message template body..."
                  className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Insertable Variables Chips */}
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Click variable to insert into template:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {editingTemplate.variables.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 rounded-lg text-xs font-mono transition-all flex items-center gap-1 active:scale-95"
                    >
                      <span>{`{{${v}}}`}</span>
                      <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Section */}
              <div className="space-y-2 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-400" /> Live Rendered Preview (Sample Data)
                </span>
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {renderTemplate(formBody, MOCK_PREVIEW_DATA) || <span className="text-slate-500 italic">Body is empty</span>}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReset(editingTemplate!.id)}
              disabled={isResetting || isSaving}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Default
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTemplate(null)}
                className="border-slate-800 text-slate-300"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 px-5"
              >
                {isSaving ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </span>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
