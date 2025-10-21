/**
 * @author Leandro Menezes
 * @copyright 2025 Leandro Menezes
 * @license MIT
 */
import Action from './action'

export default class TeamsAvatar extends Action {
  constructor (uuid, streamDeck, context, settings) {
    super(uuid, streamDeck, context, settings)

    this.interval = null
    this.avatarImage = null
    this.messages = []
    this.unreadCount = 0
    this._cacheVersion = 0

    streamDeck.saveSettings(uuid, context, settings)
  }

  get cacheVersion () {
    return this._cacheVersion
  }

  set cacheVersion (value) {
    this._cacheVersion = value
  }

  onWillAppear (context, settings) {
    if (settings === undefined) settings = this._settings

    this.setTitle(context, 'Loading...')
    this.setImage(context, '') // Clear image initially

    // Start fetching data
    this.startPolling(context)
  }

  onWillDisappear (context, settings) {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  onDidReceiveSettings (context, payload) {
    const settings = payload.settings || {}
    this.setSettings(settings)
    // Restart polling with new settings
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.startPolling(context)
  }

  onKeyUp (context, settings, coordinates, desiredState, state) {
    if (settings === undefined) settings = this._settings

    // Show modal with messages
    this.showMessagesModal(context)
  }

  async startPolling (context) {
    // Clear any existing interval
    if (this.interval) {
      clearInterval(this.interval)
    }

    // Initial fetch
    await this.fetchData(context)

    // Set up polling based on configured interval (default 30 seconds)
    const pollingInterval = (this.settings.pollingInterval || 30) * 1000

    this.interval = setInterval(async () => {
      await this.fetchData(context)
    }, pollingInterval)
  }

  async fetchData (context) {
    try {
      const email = this.settings.userEmail
      const avatarUrl = this.settings.avatarWebhookUrl
      const messagesUrl = this.settings.messagesWebhookUrl

      if (!email || !avatarUrl || !messagesUrl) {
        this.setTitle(context, 'Config\nRequired')
        return
      }

      // Fetch avatar and messages in parallel
      const [avatarResponse, messagesResponse] = await Promise.all([
        fetch(`${avatarUrl}?user=${encodeURIComponent(email)}`),
        fetch(`${messagesUrl}?user=${encodeURIComponent(email)}`)
      ])

      // Handle avatar
      if (avatarResponse.ok) {
        const avatarBlob = await avatarResponse.blob()
        const avatarDataUrl = await this.blobToDataUrl(avatarBlob)
        this.avatarImage = avatarDataUrl
      }

      // Handle messages
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        this.messages = Array.isArray(messagesData) ? messagesData : []
        this.unreadCount = this.messages.length
      }

      // Update display
      this.updateDisplay(context)
    } catch (error) {
      this.streamDeck.log(`Error fetching data: ${error.message}`)
      this.setTitle(context, 'Error')
    }
  }

  updateDisplay (context) {
    // Set the avatar image
    if (this.avatarImage) {
      this.setImage(context, this.avatarImage)
    }

    // Set title with unread count
    const title = this.unreadCount > 0 ? `${this.unreadCount}` : ''
    this.setTitle(context, title)
  }

  showMessagesModal (context) {
    if (this.messages.length === 0) {
      // No messages to show
      return
    }

    // Create modal HTML
    const modalHtml = this.createMessagesModalHtml()

    // Send command to show modal
    if (this.websocket) {
      const json = {
        event: 'openUrl',
        payload: {
          url: `data:text/html;charset=utf-8,${encodeURIComponent(modalHtml)}`
        }
      }
      this.websocket.send(JSON.stringify(json))
    }
  }

  createMessagesModalHtml () {
    const messagesHtml = this.messages.map(msg => `
      <div class="message">
        <div class="message-title">${this.escapeHtml(msg.title || 'No Title')}</div>
        <div class="message-body">${this.escapeHtml(msg.body || 'No Content')}</div>
      </div>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Teams Messages</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            color: #333;
          }
          .messages-container {
            max-height: 400px;
            overflow-y: auto;
          }
          .message {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .message-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: #0078d4;
          }
          .message-body {
            color: #333;
            line-height: 1.4;
          }
          .close-btn {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #0078d4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <button class="close-btn" onclick="window.close()">Close</button>
        <div class="header">
          <h2>Teams Messages (${this.messages.length})</h2>
        </div>
        <div class="messages-container">
          ${messagesHtml}
        </div>
      </body>
      </html>
    `
  }

  escapeHtml (text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  blobToDataUrl (blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  onSendToPlugin (context, payload) {
    // Handle messages from property inspector
    if (payload.event === 'testConnection') {
      this.testConnection(context, payload.settings)
    }
  }

  async testConnection (context, settings) {
    try {
      const email = settings.userEmail
      const avatarUrl = settings.avatarWebhookUrl
      const messagesUrl = settings.messagesWebhookUrl

      // Test both webhooks
      const [avatarResponse, messagesResponse] = await Promise.all([
        fetch(`${avatarUrl}?user=${encodeURIComponent(email)}`),
        fetch(`${messagesUrl}?user=${encodeURIComponent(email)}`)
      ])

      const avatarOk = avatarResponse.ok
      const messagesOk = messagesResponse.ok

      if (avatarOk && messagesOk) {
        this.setTitle(context, 'Test OK')
        setTimeout(() => this.updateDisplay(context), 2000)
      } else {
        const errors = []
        if (!avatarOk) errors.push(`Avatar: ${avatarResponse.status}`)
        if (!messagesOk) errors.push(`Messages: ${messagesResponse.status}`)
        this.setTitle(context, 'Test Fail')
        setTimeout(() => this.updateDisplay(context), 2000)
      }
    } catch (error) {
      this.setTitle(context, 'Test Error')
      setTimeout(() => this.updateDisplay(context), 2000)
    }
  }
}
