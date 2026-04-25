(function (globalScope) {
  'use strict';

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttribute(value) {
    return escapeText(value).replace(/"/g, '&quot;');
  }

  function isPermanentContact(contact) {
    return contact && contact.source === 'permanent';
  }

  function renderPermanenceBadge() {
    return '<span class="permanence-badge" aria-label="永久保留" title="永久保留">∞</span>';
  }

  function renderSettingsAvatar(contact) {
    return [
      '<span class="avatar-wrap contact-settings-avatar-wrap' + (isPermanentContact(contact) ? ' avatar-wrap-permanent' : '') + '">',
      '<span class="contact-settings-avatar' + (contact.avatarUrl ? '' : ' avatar-fallback') + '"' + (contact.avatarUrl ? ' style="background-image:url(\'' + escapeAttribute(contact.avatarUrl) + '\')"' : '') + '></span>',
      isPermanentContact(contact) ? renderPermanenceBadge() : '',
      '</span>',
    ].join('');
  }

  function renderAvatarStatus(statusText) {
    if (!statusText) {
      return '';
    }
    return '<div class="settings-status avatar-save-status">' + escapeText(statusText) + '</div>';
  }

  function renderProactiveStatus(contact, status) {
    if (!status || !status.visible) {
      return '';
    }
    return [
      '<div class="proactive-status-card proactive-status-card-' + escapeAttribute(status.tone || 'pending') + '">',
      '<span>主动状态</span>',
      '<strong data-role="proactive-countdown" data-slug="' + escapeAttribute(contact.slug || '') + '">' + escapeText(status.text || '') + '</strong>',
      '</div>',
    ].join('');
  }

  function renderDiagnosticRow(label, value, tone) {
    return [
      '<div class="proactive-diagnostics-row proactive-diagnostics-row-' + escapeAttribute(tone || 'neutral') + '">',
      '<span>' + escapeText(label) + '</span>',
      '<strong>' + escapeText(value) + '</strong>',
      '</div>',
    ].join('');
  }

  function renderProactiveDiagnostics(contact, diagnostics) {
    const data = diagnostics || {};
    const rows = [
      renderDiagnosticRow('主动开关', data.enabled ? '已开启' : '未开启', data.enabled ? 'ok' : 'warn'),
      renderDiagnosticRow('主动频率', data.frequency || 'normal', 'neutral'),
      renderDiagnosticRow('勿扰模式', data.doNotDisturbEnabled ? '已开启' : '关闭', data.doNotDisturbEnabled ? 'warn' : 'ok'),
      renderDiagnosticRow('API 配置', data.hasApiSettings ? '可用' : '缺失', data.hasApiSettings ? 'ok' : 'warn'),
      renderDiagnosticRow('Profile', data.hasProfile ? '已加载' : '缺失', data.hasProfile ? 'ok' : 'warn'),
      renderDiagnosticRow('候选联系人', String(data.candidateCount || 0), data.candidateCount > 0 ? 'ok' : 'warn'),
      renderDiagnosticRow('下一次触发', data.nextRunText || '未安排', data.nextRunText ? 'ok' : 'warn'),
      renderDiagnosticRow('触发时间', data.nextRunAtText || '无', data.nextRunAtText ? 'neutral' : 'warn'),
      renderDiagnosticRow('前台心跳', data.heartbeatText || '未启动', data.heartbeatText ? 'ok' : 'warn'),
      renderDiagnosticRow('最近尝试', data.lastAttemptText || '还没有自动尝试', 'neutral'),
    ];

    return [
      '<section class="proactive-diagnostics-panel" data-role="proactive-diagnostics-panel" data-slug="' + escapeAttribute(contact.slug || '') + '">',
      '<div class="proactive-diagnostics-title"><strong>主动诊断</strong><span>如果 90 秒不动，就看这里卡在哪。</span></div>',
      '<div class="proactive-diagnostics-grid">',
      rows.join(''),
      '</div>',
      '<button class="settings-button settings-button-secondary" type="button" data-role="simulate-auto-proactive-button">模拟自动触发一次</button>',
      '</section>',
    ].join('');
  }

  function renderContactSettingsView(args) {
    const contact = (args && args.contact) || { slug: '', displayName: '' };
    const remark = (args && args.remark) || '';
    const proactiveSettings = (args && args.proactiveSettings) || { enabled: false, frequency: 'normal' };
    const proactiveStatus = (args && args.proactiveStatus) || null;
    const proactiveDiagnostics = (args && args.proactiveDiagnostics) || null;
    const avatarStatus = (args && args.avatarStatus) || '';
    const proactiveFrequency = proactiveSettings.frequency || 'normal';
    const slug = encodeURIComponent(contact.slug || '');

    return [
      '<div class="settings-screen page-panel">',
      '<div class="wechat-top">',
      '<header class="screen-header thread-header">',
      '<button class="thread-back" type="button" aria-label="Back" data-route="#/chat/' + slug + '"><svg viewBox="0 0 24 24"><path d="M14.5 4.5 7 12l7.5 7.5"></path></svg></button>',
      '<div class="screen-title thread-title">聊天信息</div>',
      '<span class="thread-header-spacer"></span>',
      '</header>',
      '</div>',
      '<section class="contact-settings-page">',
      '<div class="contact-profile-head">',
      renderSettingsAvatar(contact),
      '<span class="contact-profile-copy"><strong>' + escapeText(contact.displayName) + '</strong><span>' + escapeText(isPermanentContact(contact) ? '永久保留' : '联系人') + '</span></span>',
      '<label class="settings-button settings-button-secondary avatar-upload-button" for="contact-settings-avatar-input">上传头像</label>',
      '<input class="file-input-proxy" id="contact-settings-avatar-input" type="file" accept="image/*" data-role="contact-settings-avatar-input">',
      '</div>',
      renderAvatarStatus(avatarStatus),
      '<label class="settings-field">备注<input type="text" data-role="contact-remark-input" value="' + escapeAttribute(remark) + '" placeholder="' + escapeAttribute(contact.displayName) + '"></label>',
      '<label class="settings-toggle-row">',
      '<span class="settings-toggle-copy"><strong>允许她主动找我</strong><span>只对这个联系人生效，打开后她才会主动发消息。</span></span>',
      '<input type="checkbox" data-role="contact-settings-proactive-toggle"' + (proactiveSettings.enabled ? ' checked' : '') + '>',
      '</label>',
      '<label class="settings-field">主动频率<select data-role="contact-settings-proactive-frequency">',
      '<option value="gentle"' + (proactiveFrequency === 'gentle' ? ' selected' : '') + '>温和</option>',
      '<option value="normal"' + (proactiveFrequency === 'normal' ? ' selected' : '') + '>正常</option>',
      '<option value="frequent"' + (proactiveFrequency === 'frequent' ? ' selected' : '') + '>频繁</option>',
      '</select></label>',
      renderProactiveStatus(contact, proactiveStatus),
      renderProactiveDiagnostics(contact, proactiveDiagnostics),
      '<button class="settings-button" type="button" data-role="test-proactive-button">立即测试主动消息</button>',
      '<button class="settings-button settings-button-secondary" type="button" data-role="clear-conversation-memory-button">删除本段聊天记忆</button>',
      '<button class="danger-button" type="button" data-role="delete-contact-button">删除联系人</button>',
      '</section>',
      '</div>',
    ].join('');
  }

  const api = { renderContactSettingsView, renderProactiveDiagnostics };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileContactSettingsView = api;
  } else if (globalScope) {
    globalScope.ExProfileContactSettingsView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
