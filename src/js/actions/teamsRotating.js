/**
 * @author Leandro Menezes
 * @copyright 2025 Leandro Menezes
 * @license MIT
 */
import Action from './action'

export default class TeamsRotating extends Action {
  constructor (uuid, streamDeck, context, settings) {
    super(uuid, streamDeck, context, settings)

    this.pollingInterval = null
    this.carouselInterval = null
    this.transitionInterval = null
    this.users = []
    this.currentUserIndex = 0
    this.currentAvatarImage = null
    this.nextAvatarImage = null
    this.isFetchingNext = false
    this.isFetchingCurrent = false
    this.isTransitioning = false
    this.avatarCache = new Map() // Cache for avatar images by user ID
    this.transitionFrames = []
    this.currentFrameIndex = 0
    this.lastDisplayedState = null // Track what's currently displayed to avoid redundant setImage calls

    // Note: Don't call saveSettings here - settings should only be saved
    // when explicitly changed by the user in the Property Inspector.
    // Calling it here would overwrite other buttons' settings with stale/empty data.
  }

  onWillAppear (context, settings) {
    if (settings === undefined) settings = this._settings

    const loadingImage = this.generateLoadingImage()
    this.lastDisplayedState = 'loading' // Reset state on appear
    this.setImage(context, loadingImage)

    // Start polling and carousel
    this.startPolling(context)
    this.startCarousel(context)
  }

  onWillDisappear (context, settings) {
    this.stopPolling()
    this.stopCarousel()
  }

  onDidReceiveSettings (context, payload) {
    const settings = payload.settings || {}
    this.setSettings(settings)

    // Restart everything with new settings
    this.stopPolling()
    this.stopCarousel()
    this.users = []
    this.currentUserIndex = 0
    this.currentAvatarImage = null
    this.nextAvatarImage = null
    this.isFetchingNext = false
    this.isFetchingCurrent = false
    this.isTransitioning = false
    this.avatarCache.clear() // Clear cache when settings change
    this.transitionFrames = []
    this.lastDisplayedState = null // Reset displayed state

    this.startPolling(context)
    this.startCarousel(context)
  }

  onKeyUp (context, settings, coordinates, desiredState, state) {
    // Could show current user's details or something similar
    // For now, just cycle to next user immediately
    this.showNextUser(context)
  }

  /**
   * Set image only if the state has changed to avoid redundant updates
   * @param {string} context - Stream Deck context
   * @param {string} image - Image data URL
   * @param {string} stateKey - Unique key representing the current state
   */
  setImageIfChanged (context, image, stateKey) {
    if (this.lastDisplayedState === stateKey) {
      return false // No change, skip update
    }
    this.lastDisplayedState = stateKey
    this.setImage(context, image)
    return true
  }

  startPolling (context) {
    this.stopPolling()

    // Initial fetch
    this.fetchUsersData(context)

    // Set up polling
    const pollingRate = (this.settings.pollingRefreshRate || 30) * 1000
    this.pollingInterval = setInterval(() => {
      this.fetchUsersData(context)
    }, pollingRate)
  }

  stopPolling () {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  startCarousel (context) {
    this.stopCarousel()

    const carouselDuration = (this.settings.carouselDuration || 5) * 1000
    const disableAnimation = this.settings.disableAnimation || false

    if (disableAnimation) {
      // No animation - just switch after the carousel duration
      this.carouselInterval = setInterval(() => {
        this.showNextUser(context)
      }, carouselDuration)
    } else {
      // Duration includes display time + 1 second transition
      this.carouselInterval = setInterval(() => {
        // Only start transition if not already transitioning
        if (!this.isTransitioning) {
          this.showNextUserWithTransition(context)
        }
      }, carouselDuration + 1000) // Add 1 second for transition
    }
  }

  stopCarousel () {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval)
      this.carouselInterval = null
    }
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }
  }

  async fetchUsersData (context) {
    try {
      const rotatingUrl = this.settings.rotatingWebhookUrl

      if (!rotatingUrl) {
        const configImage = this.generateConfigRequiredImage()
        this.setImageIfChanged(context, configImage, 'configRequired')
        return
      }

      const response = await fetch(rotatingUrl)
      if (!response.ok) {
        const errorImage = this.generateErrorImage()
        this.setImageIfChanged(context, errorImage, 'error')
        return
      }

      const usersData = await response.json()
      if (!Array.isArray(usersData)) {
        const invalidDataImage = this.generateInvalidDataImage()
        this.setImageIfChanged(context, invalidDataImage, 'invalidData')
        return
      }

      // Sort by count DESC
      const sortedUsers = usersData.sort((a, b) => (b.count || 0) - (a.count || 0))

      // Find current user's position in new data
      const currentUser = this.users[this.currentUserIndex]
      let newIndex = 0

      if (currentUser) {
        const foundIndex = sortedUsers.findIndex(user =>
          user.userId === currentUser.userId
        )
        if (foundIndex !== -1) {
          newIndex = foundIndex
        }
        // If current user not found, start from beginning (newIndex = 0)
      }

      this.users = sortedUsers
      this.currentUserIndex = newIndex

      // Pre-fetch current avatar immediately for the first display
      if (this.users.length > 0) {
        await this.prefetchCurrentAvatar()
      }

      // Pre-fetch next avatar if not already fetching
      if (!this.isFetchingNext && this.users.length > 0) {
        this.prefetchNextAvatar()
      }

      // Update display
      this.updateDisplay(context)
    } catch (error) {
      this.streamDeck.log(`Error fetching users data: ${error.message}`)
      const errorImage = this.generateErrorImage()
      this.setImageIfChanged(context, errorImage, 'error')
    }
  }

  showNextUser (context) {
    if (this.users.length === 0) {
      const noUsersImage = this.generateNoUsersImage()
      this.setImageIfChanged(context, noUsersImage, 'noUsers')
      return
    }

    this.currentUserIndex = (this.currentUserIndex + 1) % this.users.length

    // Swap current and next avatar
    this.currentAvatarImage = this.nextAvatarImage
    this.nextAvatarImage = null

    // Start prefetching next avatar
    this.prefetchNextAvatar()

    this.updateDisplay(context)
  }

  async showNextUserWithTransition (context) {
    if (this.users.length === 0 || this.isTransitioning) {
      return
    }

    // Check if we have both current and next images
    if (!this.currentAvatarImage || !this.nextAvatarImage) {
      // Fallback to instant change if we don't have both images
      this.showNextUser(context)
      return
    }

    this.isTransitioning = true

    try {
      // Generate 24 frames for 1 second transition (24fps)
      await this.generateTransitionFrames()

      // Play the transition
      this.playTransition(context)
    } catch (error) {
      // If frame generation fails, fall back to instant change and reset transition state
      this.streamDeck.log(`Transition frame generation failed: ${error.message}`)
      this.isTransitioning = false
      this.showNextUser(context)
    }
  }

  async generateTransitionFrames () {
    this.transitionFrames = []

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    try {
      // Load both images
      const currentImg = await this.loadImage(this.currentAvatarImage)
      const nextImg = await this.loadImage(this.nextAvatarImage)

      // Generate 24 frames
      for (let frame = 0; frame <= 24; frame++) {
        // Clear canvas with black background
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, size, size)

        // Calculate alpha values (frame 0 = current full, frame 24 = next full)
        const currentAlpha = 1 - (frame / 24)
        const nextAlpha = frame / 24

        // Draw current image with fading alpha
        ctx.globalAlpha = currentAlpha
        ctx.drawImage(currentImg, 0, 0, size, size)

        // Draw next image with increasing alpha
        ctx.globalAlpha = nextAlpha
        ctx.drawImage(nextImg, 0, 0, size, size)

        // Reset alpha
        ctx.globalAlpha = 1

        // Store frame as data URL
        this.transitionFrames.push(canvas.toDataURL('image/png'))
      }
    } catch (error) {
      // If image loading fails, rethrow to be caught by caller
      throw new Error(`Failed to generate transition frames: ${error.message}`)
    }
  }

  loadImage (dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUrl
    })
  }

  playTransition (context) {
    this.currentFrameIndex = 0
    this.lastDisplayedState = 'transitioning' // Mark as transitioning to allow frame updates

    // Clear any existing transition interval
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
    }

    // Safety timeout - force complete transition after 2 seconds
    const safetyTimeout = setTimeout(() => {
      if (this.isTransitioning) {
        this.streamDeck.log('Transition safety timeout triggered')
        this.forceCompleteTransition(context)
      }
    }, 2000)

    // Play at ~24fps (1000ms / 24 frames = ~41.67ms per frame)
    this.transitionInterval = setInterval(() => {
      if (this.currentFrameIndex < this.transitionFrames.length) {
        // Update image with current frame (always update during transition)
        this.setImage(context, this.transitionFrames[this.currentFrameIndex])
        this.currentFrameIndex++
      } else {
        // Transition complete
        this.completeTransition(context, safetyTimeout)
      }
    }, 1000 / 24) // 24fps
  }

  completeTransition (context, safetyTimeout) {
    // Clear safety timeout
    if (safetyTimeout) {
      clearTimeout(safetyTimeout)
    }

    // Clear transition interval
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }

    this.isTransitioning = false

    // Move to next user
    this.currentUserIndex = (this.currentUserIndex + 1) % this.users.length
    this.currentAvatarImage = this.nextAvatarImage
    this.nextAvatarImage = null

    // Update title and prefetch next
    this.updateDisplay(context)
    if (this.users.length > 0) {
      this.prefetchNextAvatar()
    }

    // Clean up frames to free memory
    this.transitionFrames = []
  }

  forceCompleteTransition (context) {
    // Force completion with current state
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval)
      this.transitionInterval = null
    }
    this.isTransitioning = false
    this.transitionFrames = []

    // Just update display without changing user
    this.updateDisplay(context)
    if (this.users.length > 0) {
      this.prefetchNextAvatar()
    }
  }

  async prefetchNextAvatar () {
    if (this.isFetchingNext) {
      return
    }

    if (this.users.length === 0) {
      return
    }

    const nextIndex = (this.currentUserIndex + 1) % this.users.length
    const nextUser = this.users[nextIndex]

    if (!nextUser || !nextUser.userId) {
      return
    }

    this.isFetchingNext = true

    const count = nextUser.count || 0
    const cacheKey = `${nextUser.userId}_${count}`

    // Check cache first
    if (this.avatarCache.has(cacheKey)) {
      this.nextAvatarImage = this.avatarCache.get(cacheKey)
      this.streamDeck.log(`Using cached avatar for user ${nextUser.userId}`)
      this.isFetchingNext = false
      return
    }

    // For bots, always generate initials image (webhook won't return it)
    if (nextUser.fromType === 'bot') {
      const baseImage = this.generateInitialsImage(nextUser.displayName || nextUser.userId, nextUser.displayName === 'Workflows' ? 'WF' : null)
      this.nextAvatarImage = await this.overlayCountOnImage(baseImage, count)
      this.avatarCache.set(cacheKey, this.nextAvatarImage)
      this.streamDeck.log(`Cached new avatar for user ${nextUser.userId}`)
      this.isFetchingNext = false
      return
    }

    // For users, try to fetch avatar first, fallback to initials
    try {
      const avatarUrl = this.settings.avatarWebhookUrl
      if (!avatarUrl) {
        const baseImage = this.generateInitialsImage(nextUser.displayName || nextUser.userId)
        this.nextAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.nextAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${nextUser.userId}`)
        this.isFetchingNext = false
        return
      }

      const response = await fetch(`${avatarUrl}?userId=${encodeURIComponent(nextUser.userId)}`)
      if (response.ok) {
        const avatarBlob = await response.blob()
        const baseImage = await this.blobToDataUrl(avatarBlob)
        this.nextAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.nextAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${nextUser.userId}`)
      } else {
        // Avatar not found (404 or other error), generate initials image
        const baseImage = this.generateInitialsImage(nextUser.displayName || nextUser.userId)
        this.nextAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.nextAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${nextUser.userId}`)
      }
    } catch (error) {
      // Network error, generate initials image as fallback
      this.streamDeck.log(`Error prefetching avatar: ${error.message}`)
      const baseImage = this.generateInitialsImage(nextUser.displayName || nextUser.userId)
      this.nextAvatarImage = await this.overlayCountOnImage(baseImage, count)
      this.avatarCache.set(cacheKey, this.nextAvatarImage)
      this.streamDeck.log(`Cached new avatar for user ${nextUser.userId}`)
    } finally {
      this.isFetchingNext = false
    }
  }

  async prefetchCurrentAvatar () {
    if (this.isFetchingCurrent) {
      return
    }

    if (this.users.length === 0) {
      return
    }

    const currentUser = this.users[this.currentUserIndex]

    if (!currentUser || !currentUser.userId) {
      return
    }

    this.isFetchingCurrent = true

    const count = currentUser.count || 0
    const cacheKey = `${currentUser.userId}_${count}`

    // Check cache first
    if (this.avatarCache.has(cacheKey)) {
      this.currentAvatarImage = this.avatarCache.get(cacheKey)
      this.streamDeck.log(`Using cached avatar for user ${currentUser.userId}`)
      this.isFetchingCurrent = false
      return
    }

    // For bots, always generate initials image (webhook won't return it)
    if (currentUser.fromType === 'bot') {
      const baseImage = this.generateInitialsImage(currentUser.displayName || currentUser.userId, currentUser.displayName === 'Workflows' ? 'WF' : null)
      this.currentAvatarImage = await this.overlayCountOnImage(baseImage, count)
      this.avatarCache.set(cacheKey, this.currentAvatarImage)
      this.streamDeck.log(`Cached new avatar for user ${currentUser.userId}`)
      this.isFetchingCurrent = false
      return
    }

    // For users, try to fetch avatar first, fallback to initials
    try {
      const avatarUrl = this.settings.avatarWebhookUrl
      if (!avatarUrl) {
        const baseImage = this.generateInitialsImage(currentUser.displayName || currentUser.userId)
        this.currentAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.currentAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${currentUser.userId}`)
        this.isFetchingCurrent = false
        return
      }

      const response = await fetch(`${avatarUrl}?userId=${encodeURIComponent(currentUser.userId)}`)
      if (response.ok) {
        const avatarBlob = await response.blob()
        const baseImage = await this.blobToDataUrl(avatarBlob)
        this.currentAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.currentAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${currentUser.userId}`)
      } else {
        // Avatar not found (404 or other error), generate initials image
        const baseImage = this.generateInitialsImage(currentUser.displayName || currentUser.userId)
        this.currentAvatarImage = await this.overlayCountOnImage(baseImage, count)
        this.avatarCache.set(cacheKey, this.currentAvatarImage)
        this.streamDeck.log(`Cached new avatar for user ${currentUser.userId}`)
      }
    } catch (error) {
      // Network error, generate initials image as fallback
      this.streamDeck.log(`Error prefetching current avatar: ${error.message}`)
      const baseImage = this.generateInitialsImage(currentUser.displayName || currentUser.userId)
      this.currentAvatarImage = await this.overlayCountOnImage(baseImage, count)
      this.avatarCache.set(cacheKey, this.currentAvatarImage)
      this.streamDeck.log(`Cached new avatar for user ${currentUser.userId}`)
    } finally {
      this.isFetchingCurrent = false
    }
  }

  updateDisplay (context) {
    if (this.users.length === 0) {
      // For no users, show a blank image with "No Users" text
      const noUsersImage = this.generateNoUsersImage()
      this.setImageIfChanged(context, noUsersImage, 'noUsers')
      // Clear title when no users
      if (this.settings.useDisplayNameAsTitle) {
        this.setTitle(context, '')
      }
      return
    }

    const currentUser = this.users[this.currentUserIndex]
    const count = currentUser?.count || 0
    const stateKey = `avatar:${currentUser?.userId}_${count}_${this.currentUserIndex}`

    // Set avatar image (use current or fall back to next if available)
    if (this.currentAvatarImage) {
      this.setImageIfChanged(context, this.currentAvatarImage, stateKey)
    } else if (this.nextAvatarImage) {
      // Use next avatar as fallback
      this.setImageIfChanged(context, this.nextAvatarImage, stateKey)
      this.currentAvatarImage = this.nextAvatarImage
      this.nextAvatarImage = null
      this.prefetchNextAvatar()
    }

    // Set title with display name if enabled
    if (this.settings.useDisplayNameAsTitle) {
      const displayName = currentUser?.displayName || ''
      this.setTitle(context, displayName)
    } else {
      this.setTitle(context, '')
    }
  }

  blobToDataUrl (blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  generateInitialsImage (displayName, defaultInitials = null) {
    // Extract initials from display name
    const names = displayName.split(' ').filter(name => name.length > 0)
    const initials = defaultInitials || names.map(name => name.charAt(0).toUpperCase()).slice(0, 2).join('')

    // Create canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Generate background color based on name (simple hash)
    const hash = displayName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)

    const colors = [
      '#B0C4DE', // Pastel Blue
      '#98FB98', // Pastel Green
      '#FFB6C1', // Pastel Red
      '#FFDAB9', // Pastel Orange
      '#DDA0DD', // Pastel Purple
      '#AFEEEE', // Pastel Light Blue
      '#D3D3D3', // Pastel Gray
      '#FFFACD'  // Pastel Yellow
    ]

    const backgroundColor = colors[Math.abs(hash) % colors.length]

    // Draw background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, size, size)

    // Draw initials
    ctx.font = `bold ${size * 0.6}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeText(initials, size / 2, size / 2)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(initials, size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

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

  generateNoUsersImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw gray background
    ctx.fillStyle = '#666666'
    ctx.fillRect(0, 0, size, size)

    // Draw "No Users" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.15}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No Users', size / 2, size / 2)

    return canvas.toDataURL('image/png')
  }

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

  generateInvalidDataImage () {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 144 // Stream Deck button size

    canvas.width = size
    canvas.height = size

    // Draw purple background
    ctx.fillStyle = '#c239b3'
    ctx.fillRect(0, 0, size, size)

    // Draw "Invalid Data" text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.12}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Invalid', size / 2, size / 2 - 10)
    ctx.fillText('Data', size / 2, size / 2 + 10)

    return canvas.toDataURL('image/png')
  }

  onSendToPlugin (context, payload) {
    // Handle messages from property inspector
    if (payload.event === 'testConnection') {
      this.testConnection(context, payload.settings)
    }
  }

  async testConnection (context, settings) {
    try {
      const avatarUrl = settings.avatarWebhookUrl
      const rotatingUrl = settings.rotatingWebhookUrl

      if (!avatarUrl || !rotatingUrl) {
        this.setTitle(context, 'URLs\nRequired')
        setTimeout(() => this.updateDisplay(context), 2000)
        return
      }

      // Test rotating webhook
      const rotatingResponse = await fetch(rotatingUrl)
      const rotatingOk = rotatingResponse.ok

      if (rotatingOk) {
        this.setTitle(context, 'Test OK')
        setTimeout(() => this.updateDisplay(context), 2000)
      } else {
        this.setTitle(context, 'Test Fail')
        setTimeout(() => this.updateDisplay(context), 2000)
      }
    } catch (error) {
      this.setTitle(context, 'Test Error')
      setTimeout(() => this.updateDisplay(context), 2000)
    }
  }
}
