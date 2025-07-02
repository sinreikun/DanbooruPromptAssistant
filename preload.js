const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openTranslate: (url) => ipcRenderer.send('open-translate-window', url),
  getTranslation: () => ipcRenderer.invoke('get-translation-text'),
  savePrompt: (name, prompt) => ipcRenderer.invoke('save-prompt', { name, prompt }),
  loadPrompts: () => ipcRenderer.invoke('load-prompts'),
  deletePrompt: (name) => ipcRenderer.invoke('delete-prompt', name),
  registerContextMenu: (id) => ipcRenderer.send('register-context-menu', id),
  addDictionaryEntry: (jp, en) => ipcRenderer.invoke('add-dict-entry', { jp, en })
});
