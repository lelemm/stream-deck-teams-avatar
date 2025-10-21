/**
 * @author Leandro Menezes
 * @copyright 2025 Leandro Menezes
 * @license MIT
 */
import StreamDeck from './lib/streamDeck'
import TeamsAvatar from './actions/teamsAvatar'

const streamDeck = new StreamDeck()

streamDeck.onInitialLoad(() => {

})

streamDeck.onGlobalSettingsReceived(() => {
  // Restart polling for all active actions when global settings change
  streamDeck.executeOnAvailableActions((context, instance) => {
    if (instance.startPolling) {
      instance.startPolling(context)
    }
  })
})

streamDeck.registerAction(TeamsAvatar, 'com.leandromenezes.teamsavatar.avatar')
