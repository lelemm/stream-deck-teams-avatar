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
      document.getElementById('avatarWebhookUrl').value = settings.avatarWebhookUrl || document.getElementById('avatarWebhookUrl').value
      document.getElementById('rotatingWebhookUrl').value = settings.rotatingWebhookUrl || document.getElementById('rotatingWebhookUrl').value
      document.getElementById('pollingRefreshRate').value = settings.pollingRefreshRate || document.getElementById('pollingRefreshRate').value
      document.getElementById('carouselDuration').value = settings.carouselDuration || document.getElementById('carouselDuration').value
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
})

// Make functions available globally for Stream Deck integration
window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket

function saveSettings() {
  const avatarWebhookUrl = document.getElementById('avatarWebhookUrl').value.trim()
  const rotatingWebhookUrl = document.getElementById('rotatingWebhookUrl').value.trim()
  const pollingRefreshRate = parseInt(document.getElementById('pollingRefreshRate').value) || 30
  const carouselDuration = parseInt(document.getElementById('carouselDuration').value) || 5

  // Basic validation
  if (!avatarWebhookUrl || !rotatingWebhookUrl) {
    showAlert('Both webhook URLs are required')
    return
  }

  if (pollingRefreshRate < 5 || pollingRefreshRate > 300) {
    showAlert('Polling refresh rate must be between 5 and 300 seconds')
    return
  }

  if (carouselDuration < 1 || carouselDuration > 60) {
    showAlert('Carousel duration must be between 1 and 60 seconds')
    return
  }

  // Save instance settings
  const instanceSettings = {
    avatarWebhookUrl,
    rotatingWebhookUrl,
    pollingRefreshRate,
    carouselDuration
  }
  setSettings(instanceSettings)

  showAlert('Settings saved successfully!', 'success')
}

function testConnection() {
  const avatarWebhookUrl = document.getElementById('avatarWebhookUrl').value.trim()
  const rotatingWebhookUrl = document.getElementById('rotatingWebhookUrl').value.trim()

  if (!avatarWebhookUrl || !rotatingWebhookUrl) {
    showAlert('Please fill in all required fields first')
    return
  }

  showAlert('Testing connection...', 'info')

  // Send test request to the plugin
  sendToPlugin({
    event: 'testConnection',
    settings: {
      avatarWebhookUrl,
      rotatingWebhookUrl
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
