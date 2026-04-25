(function (globalScope) {
  'use strict';

  function upsertContact(contacts, entry) {
    const list = Array.isArray(contacts) ? contacts.slice() : [];
    const index = list.findIndex((item) => item.slug === entry.slug);
    if (index >= 0) {
      list[index] = { ...list[index], ...entry };
      return list;
    }
    return [entry, ...list];
  }

  function normalizeProfileToContact(profile, index) {
    const safeId = String(profile.id || ('profile-' + index));
    return {
      slug: safeId.replace(/[^a-zA-Z0-9_-]/g, '-'),
      displayName: profile.displayName || '新联系人',
      source: profile.sourceType || 'imported',
      preview: profile.originalFileName ? ('已导入 ' + profile.originalFileName) : '已导入 Profile',
      time: profile.importedAt ? '已导入' : '',
      hostProfileId: profile.id || '',
      hostProfileLocation: profile.location || '',
      avatarUrl: '',
    };
  }

  function mergeHostProfiles(baseContacts, builtinProfiles, importedProfiles) {
    let contacts = (Array.isArray(baseContacts) ? baseContacts : []).map(function (contact) {
      return { ...contact };
    });

    (Array.isArray(builtinProfiles) ? builtinProfiles : []).forEach(function (profile, index) {
      const mapped = normalizeProfileToContact(profile, index);
      if (!contacts.some(function (contact) { return contact.slug === mapped.slug; })) {
        contacts.push(mapped);
      }
    });

    (Array.isArray(importedProfiles) ? importedProfiles : []).forEach(function (profile, index) {
      const mapped = normalizeProfileToContact(profile, index);
      if (!contacts.some(function (contact) { return contact.slug === mapped.slug; })) {
        contacts.push(mapped);
      }
    });

    return contacts;
  }

  const api = { mergeHostProfiles, normalizeProfileToContact, upsertContact };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileContactRegistry = api;
  } else if (globalScope) {
    globalScope.ExProfileContactRegistry = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
