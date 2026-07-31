// Voice listener — content script on console.cloud.google.com.
//
// The Baymax side panel cannot get the microphone (chrome-extension:// origin
// never shows the mic prompt). So the side panel opens a 'baymax-voice' Port to
// THIS script, which runs on a real https origin where the mic prompt works and
// Chrome's speech backend key is available.
//
// This file is intentionally plain JS (no imports) so it loads as a classic
// content script with no bundling or module resolution required.

;(function () {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onConnect) return

  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'baymax-voice') return

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      safePost(port, { type: 'error', error: 'not-supported' })
      return
    }

    var recognition = null
    var active = false
    var accumulated = ''

    function join(base, addition) {
      if (!addition) return base
      return base ? base + ' ' + addition : addition
    }

    function safePost(p, message) {
      try {
        p.postMessage(message)
      } catch (e) {
        /* port already disconnected */
      }
    }

    function stopAll() {
      active = false
      try {
        if (recognition) recognition.stop()
      } catch (e) {}
    }

    port.onMessage.addListener(function (msg) {
      if (msg && msg.action === 'STOP_VOICE') stopAll()
    })

    port.onDisconnect.addListener(function () {
      active = false
      try {
        if (recognition) recognition.abort()
      } catch (e) {}
    })

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        // We only needed getUserMedia to trigger the permission prompt;
        // Web Speech manages the mic itself.
        stream.getTracks().forEach(function (t) {
          t.stop()
        })

        recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = function (event) {
          var interim = ''
          for (var i = event.resultIndex; i < event.results.length; i++) {
            var t = event.results[i][0].transcript
            if (event.results[i].isFinal) accumulated = join(accumulated, t)
            else interim = t
          }
          safePost(port, { type: 'transcript', text: join(accumulated, interim) })
        }

        recognition.onerror = function (event) {
          if (event.error === 'aborted') return
          safePost(port, { type: 'error', error: event.error })
        }

        recognition.onend = function () {
          if (active) {
            try {
              recognition.start()
              return
            } catch (e) {}
          }
          safePost(port, { type: 'end' })
        }

        active = true
        recognition.start()
      })
      .catch(function (err) {
        safePost(port, {
          type: 'error',
          error: err && err.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture',
        })
      })
  })
})()
