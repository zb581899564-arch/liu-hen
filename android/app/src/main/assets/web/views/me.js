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

  function renderAvatarBlock(label, avatarUrl, triggerRole, inputRole) {
    return [
      '<div class="avatar-setting-row">',
      '<span class="avatar-setting-copy">',
      '<strong class="avatar-setting-title">' + escapeText(label) + '</strong>',
      '<span class="avatar-setting-hint">上传后会立刻同步到聊天界面</span>',
      '</span>',
      '<span class="avatar-setting-preview' + (avatarUrl ? '' : ' avatar-fallback') + '"' + (avatarUrl ? ' style="background-image:url(\'' + escapeAttribute(avatarUrl) + '\')"' : '') + '></span>',
      '<label class="settings-button settings-button-secondary avatar-upload-button" for="' + inputRole + '" data-role="' + triggerRole + '">上传头像</label>',
      '<input class="file-input-proxy" id="' + inputRole + '" type="file" accept="image/*" data-role="' + inputRole + '">',
      '</div>',
    ].join('');
  }

  function renderMeView(args) {
    const settings = (args && args.settings) || { baseUrl: '', apiKey: '', model: '' };
    const userAvatarUrl = (args && args.userAvatarUrl) || '';
    const settingsStatus = (args && args.settingsStatus) || '';
    const chatRetentionEnabled = Boolean(args && args.chatRetentionEnabled);
    const doNotDisturbEnabled = Boolean(args && args.doNotDisturbEnabled);

    return [
      '<div class="wechat-top">',
      '<header class="screen-header"><span></span><div class="screen-title">我</div><span></span><span></span></header>',
      '</div>',
      '<section class="settings-view">',
      '<div class="settings-group">',
      '<div class="settings-group-title">头像设置</div>',
      renderAvatarBlock('我的头像', userAvatarUrl, 'my-avatar-trigger', 'my-avatar-input'),
      '<button type="button" class="settings-button settings-button-secondary" data-role="import-profile-button">导入新的 Profile</button>',
      '<input class="file-input-proxy" id="browser-profile-input" type="file" accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream" data-role="browser-profile-input">',
      '</div>',
      '<div class="settings-group">',
      '<div class="settings-group-title">聊天保留</div>',
      '<label class="settings-toggle-row">',
      '<span class="settings-toggle-copy"><strong>永久保留聊天</strong><span>打开后会新增“永久联系人”，只保存永久联系人里的对话。</span></span>',
      '<input type="checkbox" data-role="chat-retention-toggle"' + (chatRetentionEnabled ? ' checked' : '') + '>',
      '</label>',
      '<label class="settings-toggle-row">',
      '<span class="settings-toggle-copy"><strong>勿扰模式</strong><span>打开后暂停所有主动找你，对话和手动发送不受影响。</span></span>',
      '<input type="checkbox" data-role="do-not-disturb-toggle"' + (doNotDisturbEnabled ? ' checked' : '') + '>',
      '</label>',
      '</div>',
      '<div class="settings-group">',
      '<div class="settings-group-title">模型设置</div>',
      '<label class="settings-field">Base URL<input type="text" data-role="settings-base-url" value="' + escapeAttribute(settings.baseUrl || '') + '" placeholder="https://api.deepseek.com/v1"></label>',
      '<label class="settings-field">API Key<input type="password" data-role="settings-api-key" value="' + escapeAttribute(settings.apiKey || '') + '" placeholder="sk-..."></label>',
      '<label class="settings-field">Model<input type="text" data-role="settings-model" value="' + escapeAttribute(settings.model || '') + '" placeholder="deepseek-chat"></label>',
      '<button type="button" class="settings-button" data-role="save-settings-button">保存配置</button>',
      settingsStatus ? '<div class="settings-status" data-role="settings-status">' + escapeText(settingsStatus) + '</div>' : '',
      '</div>',
      '</section>',
    ].join('');
  }

  const api = { renderMeView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileMeView = api;
  } else if (globalScope) {
    globalScope.ExProfileMeView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
