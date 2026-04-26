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
const {
  renderDiscoverPaneHtml,
  renderDiscoverView,
} = require(path.join(__dirname, '..', 'app', 'views', 'discover.js'));
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
      preview: '姘镐箙淇濈暀鑱婂ぉ',
      source: 'permanent',
      proactiveStatus: { visible: true, tone: 'active', text: '90绉掑悗涓诲姩鑱旂郴' },
    }],
  });

  assert.match(html, /avatar-wrap/);
  assert.match(html, /permanence-badge/);
  assert.match(html, /permanence-badge/);
  assert.match(html, /aria-label="永久保留"/);
  assert.match(html, /data-role="proactive-countdown"/);
  assert.match(html, /90绉掑悗涓诲姩鑱旂郴/);
});

test('renderChatListView shows profile weather and relationship phase', () => {
  const html = renderChatListView({
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      preview: 'Latest message',
      source: 'permanent',
      humanInsight: {
        weather: { label: 'rain', line: 'quiet line' },
        relationPhase: 'testing',
      },
    }],
  });

  assert.match(html, /rain/);
  assert.match(html, /testing/);
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

  assert.match(html, /empty-state/);
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
    messages: [{ role: 'assistant', text: 'hello[Emm]' }],
  });

  assert.match(html, /wechat-inline-emoji/);
  assert.match(html, /wechat-inline-emoji/);
  assert.match(html, /hello/);
  assert.doesNotMatch(html, /\[Emm\]/);
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

  assert.match(html, /Contact A/);
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
        text: 'retry once',
        sendStatus: 'failed',
        errorText: '璇锋眰瓒呮椂',
      },
    ],
  });

  assert.match(html, /message-send-failed/);
  assert.match(html, /data-action="retry-message"/);
  assert.match(html, /data-message-id="user-1"/);
  assert.match(html, /message-send-failed/);
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

test('renderChatThreadView escapes untrusted chat fields and blocks unsafe media URLs', () => {
  const html = renderChatThreadView({
    contact: { displayName: 'Contact A' },
    messages: [
      {
        kind: 'time',
        text: '<img src=x onerror=alert(1)>',
      },
      {
        kind: 'message',
        role: 'assistant',
        avatarUrl: "javascript:alert('avatar')",
        stickerUrl: 'javascript:alert(1)',
        stickerMd5: 'abc" onerror="alert(2)',
      },
      {
        kind: 'message',
        role: 'user',
        attachmentType: 'image',
        imageUrl: 'javascript:alert(3)',
        fileName: 'photo" onerror="alert(4).png',
      },
      {
        kind: 'message',
        role: 'user',
        attachmentType: 'file',
        fileName: '<script>alert(5)</script>',
        fileSizeLabel: '<b>big</b>',
      },
    ],
  });

  assert.doesNotMatch(html, /javascript:alert/);
  assert.doesNotMatch(html, /\sonerror="/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(5\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;big&lt;\/b&gt;/);
  assert.match(html, /photo&quot; onerror=&quot;alert\(4\)\.png/);
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
    remark: '闃夸箼',
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    proactiveStatus: { visible: true, tone: 'active', text: '90绉掑悗涓诲姩鑱旂郴' },
    avatarStatus: 'avatar saved',
  });

  assert.match(html, /data-role="contact-settings-avatar-input"/);
  assert.match(html, /data-role="contact-remark-input"/);
  assert.match(html, /value="闃夸箼"/);
  assert.match(html, /data-role="contact-settings-proactive-toggle"/);
  assert.match(html, /data-role="contact-settings-proactive-frequency"/);
  assert.match(html, /value="frequent" selected/);
  assert.match(html, /data-role="test-proactive-button"/);
  assert.match(html, /立即测试主动消息/);
  assert.match(html, /90绉掑悗涓诲姩鑱旂郴/);
  assert.match(html, /avatar saved/);
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
      nextRunText: '90绉掑悗',
      nextRunAtText: '12:30:00',
      heartbeatText: 'heartbeat running',
      lastAttemptText: 'no automatic attempt yet',
    },
  });

  assert.match(html, /data-role="proactive-diagnostics-panel"/);
  assert.match(html, /主动诊断/);
  assert.match(html, /候选联系人/);
  assert.match(html, /90绉掑悗/);
  assert.match(html, /heartbeat running/);
  assert.match(html, /no automatic attempt yet/);
  assert.match(html, /data-role="simulate-auto-proactive-button"/);
});

test('renderContactSettingsView shows permanent status with the premium badge', () => {
  const html = renderContactSettingsView({
    contact: { slug: 'permanent-a', displayName: 'Alpha', source: 'permanent' },
  });

  assert.match(html, /permanence-badge/);
  assert.match(html, /永久保留/);
  assert.match(html, /permanence-badge/);
});

test('renderContactsView groups contacts alphabetically', () => {
  const html = renderContactsView({
    contacts: [
      { slug: 'b', displayName: 'Beta', source: 'imported' },
      { slug: 'a', displayName: 'Alpha', source: 'builtin' },
      { slug: 'z', displayName: '寮犱笁', source: 'permanent' },
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
  assert.match(html, /permanence-badge/);
});

test('renderContactsView shows an import prompt when there are no contacts', () => {
  const html = renderContactsView({ contacts: [] });

  assert.match(html, /empty-state/);
  assert.match(html, /empty-state/);
});

test('renderDiscoverView renders a memory garden from profile insight', () => {
  const html = renderDiscoverView({
    activeTab: 'memory',
    contacts: [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      humanInsight: {
        weather: { label: 'rain', line: 'quiet line' },
        relationPhase: 'testing',
        unsentLine: 'unsent line',
        memorySeeds: ['summer rain', 'old night'],
      },
    }],
  });

  assert.match(html, /记忆花园/);
  assert.match(html, /rain/);
  assert.match(html, /summer rain/);
  assert.match(html, /unsent line/);
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
      text: '浠婂ぉ椋庢湁鐐瑰ぇ',
      intent: 'share',
      createdAtLabel: '鍒氬垰',
      likedByUser: true,
      comments: [
        { id: 'comment-1', authorRole: 'user', text: 'wear more' },
        { id: 'comment-2', authorRole: 'assistant', authorName: 'Alpha', text: 'ok' },
      ],
    }],
    openCommentPostId: 'moment-1',
    commentDraftByPostId: {
      'moment-1': '浣犲悆楗病',
    },
  });

  assert.match(html, /moment-card/);
  assert.match(html, /浠婂ぉ椋庢湁鐐瑰ぇ/);
  assert.match(html, /data-action="toggle-moment-like"/);
  assert.match(html, /data-action="open-moment-comment"/);
  assert.match(html, /data-action="send-moment-comment"/);
  assert.match(html, /wear more/);
  assert.match(html, /ok/);
  assert.match(html, /value="浣犲悆楗病"/);
  assert.match(html, /data-role="discover-tab"/);
});

test('renderDiscoverView shows empty moments state when the feed is empty', () => {
  const html = renderDiscoverView({
    activeTab: 'moments',
    contacts: [],
    momentsFeed: [],
  });

  assert.match(html, /empty-state/);
});

test('renderDiscoverPaneHtml renders only the active pane for stable moments updates', () => {
  const html = renderDiscoverPaneHtml({
    activeTab: 'moments',
    momentsFeed: [{
      id: 'moment-1',
      contactSlug: 'permanent-a',
      displayName: 'Alpha',
      text: 'New moment',
      createdAtLabel: 'now',
    }],
  });

  assert.match(html, /discover-pane-moments/);
  assert.match(html, /New moment/);
  assert.doesNotMatch(html, /discover-tabs/);
  assert.doesNotMatch(html, /screen-header/);
});

test('renderMeView can show settings save feedback', () => {
  const html = renderMeView({
    contacts: [{ slug: 'sample-contact', displayName: 'Contact A' }],
    settings: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    },
    settingsStatus: 'settings saved',
  });

  assert.match(html, /settings saved/);
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
