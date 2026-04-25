const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { renderChatListView } = require(path.join(__dirname, '..', 'app', 'views', 'chat-list.js'));
const {
  renderChatThreadMessagesHtml,
  renderChatThreadTitle,
  renderChatThreadView,
} = require(path.join(__dirname, '..', 'app', 'views', 'chat-thread.js'));
const { renderContactSettingsView } = require(path.join(__dirname, '..', 'app', 'views', 'contact-settings.js'));
const { renderContactsView } = require(path.join(__dirname, '..', 'app', 'views', 'contacts.js'));
const { renderDiscoverView } = require(path.join(__dirname, '..', 'app', 'views', 'discover.js'));
const { renderMeView } = require(path.join(__dirname, '..', 'app', 'views', 'me.js'));

test('renderChatListView shows contact name and preview in wechat list layout', () => {
  const html = renderChatListView({
    contacts: [
      {
        slug: 'sample-contact',
        displayName: 'Contact A',
        preview: 'Latest message',
        time: '22:11',
      },
    ],
  });
  assert.match(html, /Contact A/);
  assert.match(html, /Latest message/);
  assert.match(html, /screen-title/);
  assert.doesNotMatch(html, /statusbar/);
});

test('renderChatListView shows an import prompt when there are no contacts', () => {
  const html = renderChatListView({ contacts: [] });

  assert.match(html, /empty-state/);
  assert.match(html, /还没有联系人/);
  assert.match(html, /导入 Profile/);
});

test('renderChatListView exposes contact search controls', () => {
  const html = renderChatListView({
    contacts: [{ slug: 'a', displayName: 'Alpha', preview: 'hello' }],
    searchOpen: true,
    searchQuery: 'Al',
  });

  assert.match(html, /data-role="contact-search-toggle"/);
  assert.match(html, /data-role="contact-search-input"/);
  assert.match(html, /value="Al"/);
  assert.match(html, /Alpha/);
});

test('renderChatListView marks permanent contacts with a subtle permanence badge', () => {
  const html = renderChatListView({
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      preview: '永久保留聊天',
      source: 'permanent',
      proactiveStatus: { visible: true, tone: 'active', text: '90秒后主动联系' },
    }],
  });

  assert.match(html, /avatar-wrap/);
  assert.match(html, /permanence-badge/);
  assert.match(html, /∞/);
  assert.match(html, /aria-label="永久保留"/);
  assert.match(html, /data-role="proactive-countdown"/);
  assert.match(html, /90秒后主动联系/);
});

test('renderChatListView shows profile weather and relationship phase', () => {
  const html = renderChatListView({
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      preview: 'Latest message',
      source: 'permanent',
      humanInsight: {
        weather: { label: '小雨', line: '话少，但会回头看你一眼。' },
        relationPhase: '试探',
      },
    }],
  });

  assert.match(html, /小雨/);
  assert.match(html, /试探/);
  assert.match(html, /profile-weather/);
});

test('renderChatListView filters contacts by search query', () => {
  const html = renderChatListView({
    contacts: [
      { slug: 'a', displayName: 'Alpha', preview: 'hello' },
      { slug: 'b', displayName: 'Beta', preview: 'world' },
    ],
    searchOpen: true,
    searchQuery: 'bet',
  });

  assert.doesNotMatch(html, /Alpha/);
  assert.match(html, /Beta/);
});

test('renderChatListView shows an empty search result state', () => {
  const html = renderChatListView({
    contacts: [{ slug: 'a', displayName: 'Alpha', preview: 'hello' }],
    searchOpen: true,
    searchQuery: 'Nobody',
  });

  assert.match(html, /没有搜到联系人/);
});

test('renderChatThreadView renders sticker block when stickerUrl exists', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [{ role: 'assistant', stickerUrl: 'file:///abc.gif', stickerMd5: 'abc' }],
  });
  assert.match(html, /thread-header/);
  assert.match(html, /file:\/\/\/abc\.gif/);
  assert.doesNotMatch(html, /statusbar/);
});

test('renderChatThreadView renders WeChat bracket emoji as inline emoji', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [{ role: 'assistant', text: '我还没发呢[捂脸]' }],
  });

  assert.match(html, /我还没发呢/);
  assert.match(html, /wechat-inline-emoji/);
  assert.match(html, /🤦/);
  assert.doesNotMatch(html, /\[捂脸\]/);
});

test('renderChatThreadView includes back route trigger', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [],
  });
  assert.match(html, /data-route="#\/wechat"/);
});

test('renderChatThreadView exposes a dedicated thread shell for sticky header and composer', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [],
  });
  assert.match(html, /thread-screen/);
  assert.match(html, /class="thread-messages"/);
  assert.match(html, /data-role="thread-messages"/);
  assert.match(html, /class="wechat-composer"/);
  assert.match(html, /data-role="composer-send-button"/);
});

test('renderChatThreadView shows typing title while assistant work is pending', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [],
    isTyping: true,
  });

  assert.match(html, /Contact A 正在输入中/);
});

test('renderChatThreadView renders pending assistant typing indicator', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [{ kind: 'message', role: 'assistant', pending: true }],
  });
  assert.match(html, /typing-dots/);
  assert.match(html, /aria-label="正在输入"/);
});

test('renderChatThreadMessagesHtml can update messages without replacing composer', () => {
  const html = renderChatThreadMessagesHtml({
    messages: [{ kind: 'message', role: 'assistant', pending: true }],
  });

  assert.match(html, /typing-dots/);
  assert.doesNotMatch(html, /wechat-composer/);
  assert.doesNotMatch(html, /data-role="composer-input"/);
  assert.equal(renderChatThreadTitle({ contact: { displayName: 'Contact A' }, isTyping: true }), 'Contact A 正在输入中......');
});

test('stable thread updates suppress row re-entry animation', () => {
  const fs = require('node:fs');
  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'styles', 'app.css'), 'utf8');

  assert.match(css, /\.stable-thread-update \.thread-row/);
  assert.match(css, /animation:\s*none/);
});

test('renderChatThreadView renders failed user message with retry action', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [
      {
        id: 'user-1',
        kind: 'message',
        role: 'user',
        text: '再试一次',
        sendStatus: 'failed',
        errorText: '请求超时',
      },
    ],
  });

  assert.match(html, /message-send-failed/);
  assert.match(html, /data-action="retry-message"/);
  assert.match(html, /data-message-id="user-1"/);
  assert.match(html, /请求超时/);
  assert.match(html, /重试/);
});

test('renderChatThreadView renders image and file attachments from plus action flow', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [
      {
        kind: 'message',
        role: 'user',
        attachmentType: 'image',
        imageUrl: 'blob:test-image',
        fileName: 'photo.png',
      },
      {
        kind: 'message',
        role: 'user',
        attachmentType: 'file',
        fileName: 'chat-log.pdf',
        fileSizeLabel: '2.4 MB',
      },
    ],
  });
  assert.match(html, /blob:test-image/);
  assert.match(html, /chat-log\.pdf/);
  assert.match(html, /2\.4 MB/);
  assert.match(html, /data-action="attach"/);
});

test('renderMeView exposes only my avatar upload controls without faux phone status bar', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    userAvatarUrl: 'blob:user',
  });
  assert.match(html, /data-role="my-avatar-trigger"/);
  assert.match(html, /data-role="import-profile-button"/);
  assert.match(html, /data-role="browser-profile-input"/);
  assert.match(html, /for="my-avatar-input"/);
  assert.match(html, /id="my-avatar-input"/);
  assert.match(html, /blob:user/);
  assert.doesNotMatch(html, /data-role="contact-avatar-select"/);
  assert.doesNotMatch(html, /data-role="contact-avatar-trigger"/);
  assert.doesNotMatch(html, /statusbar/);
});

test('renderChatThreadView links more button to contact settings page', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A', avatarUrl: 'blob:contact' },
    messages: [],
    proactiveSettings: { enabled: true, frequency: 'frequent' },
  });

  assert.match(html, /data-route="#\/contact-settings\/Contact%20A"/);
  assert.doesNotMatch(html, /data-role="thread-contact-settings"/);
});

test('renderContactSettingsView exposes avatar remark proactive and delete controls', () => {
  const html = renderContactSettingsView({
    contact: { slug: 'permanent-a', displayName: 'Contact A', avatarUrl: 'blob:contact', source: 'permanent' },
    remark: '阿乙',
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    proactiveStatus: { visible: true, tone: 'active', text: '90秒后主动联系' },
    avatarStatus: '头像已保存',
  });

  assert.match(html, /data-role="contact-settings-avatar-input"/);
  assert.match(html, /data-role="contact-remark-input"/);
  assert.match(html, /value="阿乙"/);
  assert.match(html, /data-role="contact-settings-proactive-toggle"/);
  assert.match(html, /data-role="contact-settings-proactive-frequency"/);
  assert.match(html, /value="frequent" selected/);
  assert.match(html, /data-role="test-proactive-button"/);
  assert.match(html, /立即测试主动消息/);
  assert.match(html, /90秒后主动联系/);
  assert.match(html, /头像已保存/);
  assert.match(html, /data-role="clear-conversation-memory-button"/);
  assert.match(html, /删除本段聊天记忆/);
  assert.match(html, /data-role="delete-contact-button"/);
  assert.match(html, /blob:contact/);
});

test('renderContactSettingsView exposes proactive diagnostics panel', () => {
  const html = renderContactSettingsView({
    contact: { slug: 'permanent-a', displayName: 'Contact A', source: 'permanent' },
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    proactiveDiagnostics: {
      enabled: true,
      frequency: 'frequent',
      doNotDisturbEnabled: false,
      hasApiSettings: true,
      hasProfile: true,
      candidateCount: 1,
      nextRunText: '90秒后',
      nextRunAtText: '12:30:00',
      heartbeatText: '前台心跳运行中',
      lastAttemptText: '还没有自动尝试',
    },
  });

  assert.match(html, /data-role="proactive-diagnostics-panel"/);
  assert.match(html, /主动诊断/);
  assert.match(html, /候选联系人/);
  assert.match(html, /90秒后/);
  assert.match(html, /前台心跳运行中/);
  assert.match(html, /还没有自动尝试/);
  assert.match(html, /data-role="simulate-auto-proactive-button"/);
});

test('renderContactSettingsView shows permanent status with the premium badge', () => {
  const html = renderContactSettingsView({
    contact: { slug: 'permanent-a', displayName: 'Alpha', source: 'permanent' },
  });

  assert.match(html, /permanence-badge/);
  assert.match(html, /永久保留/);
  assert.match(html, /∞/);
});

test('renderContactsView groups contacts alphabetically', () => {
  const html = renderContactsView({
    contacts: [
      { slug: 'b', displayName: 'Beta', source: 'imported' },
      { slug: 'a', displayName: 'Alpha', source: 'builtin' },
      { slug: 'z', displayName: '张三', source: 'permanent' },
    ],
  });

  assert.match(html, /contacts-group-title">A/);
  assert.match(html, /contacts-group-title">B/);
  assert.match(html, /contacts-index/);
  assert.ok(html.indexOf('Alpha') < html.indexOf('Beta'));
});

test('renderContactsView marks permanent contacts with permanence badge', () => {
  const html = renderContactsView({
    contacts: [{ slug: 'permanent-a', displayName: 'Alpha', source: 'permanent' }],
  });

  assert.match(html, /permanence-badge/);
  assert.match(html, /∞/);
});

test('renderContactsView shows an import prompt when there are no contacts', () => {
  const html = renderContactsView({ contacts: [] });

  assert.match(html, /empty-state/);
  assert.match(html, /通讯录还是空的/);
});

test('renderDiscoverView renders a memory garden from profile insight', () => {
  const html = renderDiscoverView({
    activeTab: 'memory',
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      humanInsight: {
        weather: { label: '小雨', line: '话少，但会回头看你一眼。' },
        relationPhase: '试探',
        unsentLine: '有些话，她还没发出来。',
        memorySeeds: ['那年夏天一起等雨。', '她说过别总熬夜。'],
      },
    }],
  });

  assert.match(html, /记忆花园/);
  assert.match(html, /小雨/);
  assert.match(html, /那年夏天一起等雨/);
  assert.match(html, /有些话，她还没发出来/);
});

test('renderDiscoverView renders a moments feed with like and comment controls', () => {
  const html = renderDiscoverView({
    activeTab: 'moments',
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      avatarUrl: 'blob:alpha',
    }],
    momentsFeed: [{
      id: 'moment-1',
      contactSlug: 'permanent-a',
      displayName: 'Alpha',
      avatarUrl: 'blob:alpha',
      text: '今天风有点大',
      intent: 'share',
      createdAtLabel: '刚刚',
      likedByUser: true,
      comments: [
        { id: 'comment-1', authorRole: 'user', text: '那你多穿点' },
        { id: 'comment-2', authorRole: 'assistant', authorName: 'Alpha', text: '知道啦' },
      ],
    }],
    openCommentPostId: 'moment-1',
    commentDraftByPostId: {
      'moment-1': '你吃饭没',
    },
  });

  assert.match(html, /朋友圈/);
  assert.match(html, /今天风有点大/);
  assert.match(html, /data-action="toggle-moment-like"/);
  assert.match(html, /data-action="open-moment-comment"/);
  assert.match(html, /data-action="send-moment-comment"/);
  assert.match(html, /那你多穿点/);
  assert.match(html, /知道啦/);
  assert.match(html, /value="你吃饭没"/);
  assert.match(html, /data-role="discover-tab"/);
});

test('renderDiscoverView shows empty moments state when the feed is empty', () => {
  const html = renderDiscoverView({
    activeTab: 'moments',
    contacts: [],
    momentsFeed: [],
  });

  assert.match(html, /还没有新的动态/);
});

test('renderMeView can show settings save feedback', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    settings: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    },
    settingsStatus: '已保存配置',
  });

  assert.match(html, /已保存配置/);
  assert.match(html, /settings-status/);
});

test('renderMeView exposes permanent chat retention toggle', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    chatRetentionEnabled: true,
  });

  assert.match(html, /data-role="chat-retention-toggle"/);
  assert.match(html, /checked/);
});

test('renderMeView exposes do not disturb toggle for proactive chat', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    doNotDisturbEnabled: true,
  });

  assert.match(html, /data-role="do-not-disturb-toggle"/);
  assert.match(html, /勿扰模式/);
  assert.match(html, /checked/);
});

test('renderMeView does not expose proactive chat controls', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    proactiveSettings: { enabled: true, frequency: 'frequent' },
  });

  assert.doesNotMatch(html, /data-role="proactive-chat-toggle"/);
  assert.doesNotMatch(html, /data-role="proactive-frequency-select"/);
});
