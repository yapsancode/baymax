chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.runtime.onMessage.addListener((msg, sender) => {
  // When the Dashboard tab requests a session resume, open the side panel
  // so the user can see the Guidance view. The side panel's own listener
  // in App.jsx picks up the same message and calls resumeSession().
  if (msg.type === 'RESUME_SESSION' && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
  }

  // When the Dashboard requests to edit a recording, open the side panel
  // so App.jsx can load the guide into the Recorder.
  if (msg.type === 'LOAD_RECORDING' && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
  }
})