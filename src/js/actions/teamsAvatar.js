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
    this.avatarImage = null // Base avatar image without count overlay
    this.messages = []
    this.unreadCount = 0
    this._cacheVersion = 0
    this.avatarCache = new Map() // Cache for base avatar images by user email
    this.lastDisplayedImageState = null // Track last displayed image state

    // Note: Don't call saveSettings here - settings should only be saved
    // when explicitly changed by the user in the Property Inspector.
    // Calling it here would overwrite other buttons' settings with stale/empty data.
  }

  get cacheVersion () {
    return this._cacheVersion
  }

  set cacheVersion (value) {
    this._cacheVersion = value
  }

  /**
   * Set image only if the state has changed to avoid redundant updates
   */
  setImageIfChanged (context, image, stateKey) {
    if (this.lastDisplayedImageState === stateKey) {
      return false
    }
    this.lastDisplayedImageState = stateKey
    this.setImage(context, image)
    return true
  }

  onWillAppear (context, settings) {
    if (settings === undefined) settings = this._settings

    // Reset state tracking on appear
    this.lastDisplayedImageState = null

    // Show loading image
    const loadingImage = this.generateLoadingImage()
    this.setImage(context, loadingImage)
    this.lastDisplayedImageState = 'loading'

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
    // Clear cache when settings change
    this.avatarCache.clear()
    // Reset state tracking
    this.lastDisplayedImageState = null
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
        const configImage = this.generateConfigRequiredImage()
        this.setImageIfChanged(context, configImage, 'configRequired')
        return
      }

      // Check cache first for avatar
      if (this.avatarCache.has(email)) {
        this.avatarImage = this.avatarCache.get(email)
        this.streamDeck.log(`Using cached avatar for user ${email}`)
      } else {
        // Fetch avatar
        const avatarResponse = await fetch(`${avatarUrl}?user=${encodeURIComponent(email)}`)

        if (avatarResponse.ok) {
          const avatarBlob = await avatarResponse.blob()
          const avatarDataUrl = await this.blobToDataUrl(avatarBlob)
          this.avatarImage = avatarDataUrl
          // Cache the base avatar (without count overlay)
          this.avatarCache.set(email, avatarDataUrl)
          this.streamDeck.log(`Cached avatar for user ${email}`)
        }
      }

      // Always fetch messages (they change frequently)
      const messagesResponse = await fetch(`${messagesUrl}?user=${encodeURIComponent(email)}`)

      // Handle messages
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        this.messages = Array.isArray(messagesData) ? messagesData : []
        this.unreadCount = this.messages.length
      }

      // Update display
      await this.updateDisplay(context)
    } catch (error) {
      this.streamDeck.log(`Error fetching data: ${error.message}`)
      const errorImage = this.generateErrorImage()
      this.setImageIfChanged(context, errorImage, 'error')
    }
  }

  async updateDisplay (context) {
    const email = this.settings.userEmail
    // Include unread count in state key so image updates when count changes
    const stateKey = `avatar:${email}_${this.unreadCount}`

    // Set the avatar image with count overlay
    if (this.avatarImage) {
      const imageWithCount = await this.overlayCountOnImage(this.avatarImage, this.unreadCount)
      this.setImageIfChanged(context, imageWithCount, stateKey)
    }
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
        const testOkImage = this.generateTestOkImage()
        this.setImage(context, testOkImage)
        this.lastDisplayedImageState = 'testOk'
        setTimeout(() => {
          this.lastDisplayedImageState = null // Force update
          this.updateDisplay(context)
        }, 2000)
      } else {
        const testFailImage = this.generateTestFailImage()
        this.setImage(context, testFailImage)
        this.lastDisplayedImageState = 'testFail'
        setTimeout(() => {
          this.lastDisplayedImageState = null // Force update
          this.updateDisplay(context)
        }, 2000)
      }
    } catch (error) {
      const testErrorImage = this.generateTestErrorImage()
      this.setImage(context, testErrorImage)
      this.lastDisplayedImageState = 'testError'
      setTimeout(() => {
        this.lastDisplayedImageState = null // Force update
        this.updateDisplay(context)
      }, 2000)
    }
  }

  // Image generation methods

  generateLoadingImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw blue background
    ctx.fillStyle = '#0078d4'
    ctx.fillRect(0, 0, size, size)

    // Draw "Loading..." text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.15}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Loading...', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

  generateConfigRequiredImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw orange background
    ctx.fillStyle = '#ff8c00'
    ctx.fillRect(0, 0, size, size)

    // Draw "Config Required" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.12}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Config', size / 2, size / 2 - 10)
    ctx.fillText('Required', size / 2, size / 2 + 10)

    return canvas.toDataURL('image/png')
  }

  generateErrorImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw red background
    ctx.fillStyle = '#d13438'
    ctx.fillRect(0, 0, size, size)

    // Draw "Error" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.2}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Error', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

  generateTestOkImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw green background
    ctx.fillStyle = '#107c10'
    ctx.fillRect(0, 0, size, size)

    // Draw "Test OK" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.18}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Test OK', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

  generateTestFailImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw red background
    ctx.fillStyle = '#d13438'
    ctx.fillRect(0, 0, size, size)

    // Draw "Test Fail" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.15}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Test Fail', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

  generateTestErrorImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw dark red background
    ctx.fillStyle = '#a80000'
    ctx.fillRect(0, 0, size, size)

    // Draw "Test Error" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.13}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Test Error', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

  // Color utility methods for count overlay

  getDominantColor (imageData) {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const colorCount = {}
    let maxCount = 0
    let dominantColor = [128, 128, 128] // Default to gray

    // Sample pixels in a regular grid (every 8 pixels for performance)
    const step = 8
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const alpha = data[index + 3]

        // Skip transparent pixels
        if (alpha < 128) continue

        // Create a color key (quantize to reduce similar colors)
        const key = `${Math.floor(r/32)*32},${Math.floor(g/32)*32},${Math.floor(b/32)*32}`

        colorCount[key] = (colorCount[key] || 0) + 1

        if (colorCount[key] > maxCount) {
          maxCount = colorCount[key]
          dominantColor = [parseInt(key.split(',')[0]), parseInt(key.split(',')[1]), parseInt(key.split(',')[2])]
        }
      }
    }

    return dominantColor
  }

  rgbToHsl (r, g, b) {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if (max === min) {
      h = s = 0 // achromatic
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return [h, s, l]
  }

  hslToRgb (h, s, l) {
    let r, g, b

    if (s === 0) {
      r = g = b = l // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }

  getComplementaryColor (rgb) {
    // Convert RGB to HSL
    const [h, s, l] = this.rgbToHsl(rgb[0], rgb[1], rgb[2])

    // Rotate hue by 160 degrees and keep same lightness
    const newHue = (h + 160/360) % 1
    let complementaryRgb = this.hslToRgb(newHue, s, l)

    // Check if the complementary color is too dark (lightness < 0.4)
    const [compH, compS, compL] = this.rgbToHsl(complementaryRgb[0], complementaryRgb[1], complementaryRgb[2])

    // If complementary color is too dark, make it light instead
    if (compL < 0.4) {
      complementaryRgb = this.hslToRgb(newHue, Math.max(s, 0.7), Math.max(compL, 0.8))
    }

    return complementaryRgb
  }

  rgbToHex (rgb) {
    return '#' + rgb.map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }

  overlayCountOnImage (imageDataUrl, count) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const size = 144 // Stream Deck button size

      canvas.width = size
      canvas.height = size

      const img = new Image()
      img.onload = () => {
        // Draw the original image
        ctx.drawImage(img, 0, 0, size, size)

        if (count > 0) {
          // Get image data to analyze colors
          const imageData = ctx.getImageData(0, 0, size, size)
          const dominantColor = this.getDominantColor(imageData)
          const complementaryColor = this.getComplementaryColor(dominantColor)
          const strokeColor = this.rgbToHex(complementaryColor)

          // Draw the number centered in the image
          ctx.fillStyle = '#ffffff' // White text
          ctx.font = `bold 144px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          // Use complementary color for stroke
          ctx.globalAlpha = 0.5
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 5
          ctx.strokeText(count.toString(), size / 2, size / 1.6)

          // White fill
          ctx.fillText(count.toString(), size / 2, size / 1.6)
          ctx.globalAlpha = 1
        }

        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = imageDataUrl
    })
  }
}
