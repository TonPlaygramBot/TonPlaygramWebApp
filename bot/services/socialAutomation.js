import SocialAutomationRule from '../models/SocialAutomationRule.js';
import Task from '../models/Task.js';

export const DEFAULT_SOCIAL_RULES = [
  { name: 'Verify publication', trigger: 'PROVIDER_SUCCEEDED', titleTemplate: 'Verify {{platform}} publication', dueAmount: 30, dueUnit: 'minutes', isDefault: true },
  { name: 'Check engagement', trigger: 'PROVIDER_SUCCEEDED', titleTemplate: 'Check {{platform}} engagement', dueAmount: 2, dueUnit: 'hours', isDefault: true },
  { name: 'Review campaign', trigger: 'ALL_PUBLISHED', titleTemplate: 'Review social campaign performance', dueAmount: 24, dueUnit: 'hours', isDefault: true },
  { name: 'Fix failure', trigger: 'PROVIDER_FAILED', titleTemplate: 'Fix failed {{platform}} publication', dueAmount: 0, dueUnit: 'minutes', priority: 'HIGH', isDefault: true }
];

export async function ensureDefaultRules() {
  for (const rule of DEFAULT_SOCIAL_RULES) await SocialAutomationRule.updateOne({ name: rule.name, isDefault: true }, { $setOnInsert: rule }, { upsert: true });
}

function render(template, values) {
  return String(template || '').replace(/{{(platform|postTitle|accountName|publishedAt|publicationUrl|error)}}/g, (_, key) => values[key] || '');
}

export async function runSocialAutomations(trigger, post, publication) {
  await ensureDefaultRules();
  const rules = await SocialAutomationRule.find({ trigger, enabled: true, $or: [{ platform: 'any' }, { platform: publication?.platform }] });
  const values = { platform: publication?.platform ? publication.platform[0].toUpperCase() + publication.platform.slice(1) : '', postTitle: post.caption.slice(0, 80), accountName: '', publishedAt: publication?.publishedAt?.toISOString?.() || '', publicationUrl: publication?.publicationUrl || '', error: publication?.errorMessage || '' };
  const unitMs = { minutes: 60000, hours: 3600000, days: 86400000 };
  for (const rule of rules) {
    const subject = publication?._id || post._id;
    const idempotencyKey = `${rule._id}:${subject}:${trigger}`;
    await Task.updateOne({ idempotencyKey }, { $setOnInsert: { taskId: `social_${idempotencyKey}`, title: render(rule.titleTemplate, values), description: render(rule.descriptionTemplate, values) || [`Social post: ${post._id}`, `Platform: ${values.platform}`, publication?.publicationUrl && `URL: ${publication.publicationUrl}`, publication?.errorMessage && `Error: ${publication.errorMessage}`, publication?.attempts && `Retry attempts: ${publication.attempts}`].filter(Boolean).join('\n'), priority: rule.priority, dueAt: new Date(Date.now() + rule.dueAmount * unitMs[rule.dueUnit]), assignee: rule.assignee, sourceType: 'SOCIAL_AUTOMATION', socialPostId: post._id, socialPublicationId: publication?._id, automationRuleId: rule._id, idempotencyKey } }, { upsert: true });
  }
}
