/**
 * @author Leandro Menezes
 * @copyright 2025 Leandro Menezes
 * @license MIT
 */

let websocket = null
let uuid = null
let actionInfo = null

// Connect to Stream Deck
function connectElgatoStreamDeckSocket(inPort, inUUID, inMessageType, inApplicationInfo, inActionInfo) {
  uuid = inUUID
  actionInfo = JSON.parse(inActionInfo)

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`)

  websocket.onopen = function () {
    const json = {
      event: inMessageType,
      uuid: inUUID
    }
    websocket.send(JSON.stringify(json))

    // Request current settings
    requestSettings()
  }

  websocket.onmessage = function (event) {
    console.log(event.data)

    const jsonObj = JSON.parse(event.data)


    if (jsonObj.event === 'didReceiveSettings') {
      const settings = jsonObj.payload.settings

      // Update UI with current settings
      document.getElementById('userEmail').value = settings.userEmail || document.getElementById('userEmail').value
      document.getElementById('avatarWebhookUrl').value = settings.avatarWebhookUrl || document.getElementById('avatarWebhookUrl').value
      document.getElementById('messagesWebhookUrl').value = settings.messagesWebhookUrl || document.getElementById('messagesWebhookUrl').value
      document.getElementById('pollingInterval').value = settings.pollingInterval || document.getElementById('pollingInterval').value
    }
  }
}

function requestSettings() {
  if (websocket && actionInfo) {
    const json = {
      event: 'getSettings',
      context: uuid
    }
    websocket.send(JSON.stringify(json))
  }
}

function setSettings(settings) {
  if (websocket && actionInfo) {
    const json = {
      event: 'setSettings',
      context: actionInfo.context,
      payload: settings
    }
    websocket.send(JSON.stringify(json))
  }
}

function sendToPlugin(payload) {
  if (websocket && actionInfo) {
    const json = {
      event: 'sendToPlugin',
      context: actionInfo.context,
      payload: payload
    }
    websocket.send(JSON.stringify(json))
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Set up event listeners
  document.getElementById('save').addEventListener('click', () => saveSettings())
  document.getElementById('test').addEventListener('click', () => testConnection())
  document.getElementById('settings').addEventListener('click', () => {
    window.open('setup.html', 'Teams Avatar Settings')
  })
})

// Make functions available globally for Stream Deck integration
window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket

function saveSettings() {
  const userEmail = document.getElementById('userEmail').value.trim()
  const avatarWebhookUrl = document.getElementById('avatarWebhookUrl').value.trim()
  const messagesWebhookUrl = document.getElementById('messagesWebhookUrl').value.trim()
  const pollingInterval = parseInt(document.getElementById('pollingInterval').value) || 30

  // Basic validation
  if (!userEmail) {
    showAlert('User email is required')
    return
  }

  if (!avatarWebhookUrl || !messagesWebhookUrl) {
    showAlert('Both webhook URLs are required')
    return
  }

  if (pollingInterval < 5 || pollingInterval > 300) {
    showAlert('Polling interval must be between 5 and 300 seconds')
    return
  }

  // Save instance settings
  const instanceSettings = {
    userEmail,
    avatarWebhookUrl,
    messagesWebhookUrl,
    pollingInterval
  }
  setSettings(instanceSettings)

  showAlert('Settings saved successfully!', 'success')
}

function testConnection() {
  const userEmail = document.getElementById('userEmail').value.trim()
  const avatarWebhookUrl = document.getElementById('avatarWebhookUrl').value.trim()
  const messagesWebhookUrl = document.getElementById('messagesWebhookUrl').value.trim()

  if (!userEmail || !avatarWebhookUrl || !messagesWebhookUrl) {
    showAlert('Please fill in all required fields first')
    return
  }

  showAlert('Testing connection...', 'info')

  // Send test request to the plugin
  sendToPlugin({
    event: 'testConnection',
    settings: {
      userEmail,
      avatarWebhookUrl,
      messagesWebhookUrl
    }
  })
}

function showAlert(text, type = 'error') {
  const alertDiv = document.querySelector('.sdpi-info-label') || document.createElement('div')
  alertDiv.className = `sdpi-info-label ${type}`
  alertDiv.textContent = text
  alertDiv.style.top = '10px'
  alertDiv.style.display = 'block'

  if (!alertDiv.parentNode) {
    document.body.appendChild(alertDiv)
  }

  setTimeout(() => {
    alertDiv.style.display = 'none'
  }, 5000)
}
