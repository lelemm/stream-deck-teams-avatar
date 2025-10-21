// /**
//  * @author Leandro Menezes
//  * @copyright 2025 Leandro Menezes
//  * @license MIT
//  */
// /* global alert */
// const opener = window.opener
// const streamDeck = opener.streamDeck

// window.onload = function () {
//   document.getElementById('alerts').style.display = 'none'
//   document.getElementById('pollingInterval').value = 30

//   // Hide user-specific fields since they're now per-instance
//   document.getElementById('userEmail').style.display = 'none'
//   document.getElementById('avatarWebhookUrl').style.display = 'none'
//   document.getElementById('messagesWebhookUrl').style.display = 'none'
//   document.querySelector('label[for="userEmail"]').style.display = 'none'
//   document.querySelector('label[for="avatarWebhookUrl"]').style.display = 'none'
//   document.querySelector('label[for="messagesWebhookUrl"]').style.display = 'none'

//   document.getElementById('save').addEventListener('click', () => saveSettings())
//   document.getElementById('test').addEventListener('click', () => showAlert('Testing is now done per button in the Property Inspector'))
//   document.getElementById('refresh').addEventListener('click', () => refreshData())
// }

// function saveSettings() {
//   const pollingInterval = parseInt(document.getElementById('pollingInterval').value) || 30

//   // Basic validation
//   if (pollingInterval < 5 || pollingInterval > 300) {
//     showAlert('Polling interval must be between 5 and 300 seconds')
//     return
//   }

//   // Save global polling interval
//   streamDeck.updateGlobalSettings('pollingInterval', pollingInterval)

//   // Update any open property inspectors
//   if (opener && opener.document.getElementById('pollingInterval')) {
//     opener.document.getElementById('pollingInterval').value = pollingInterval
//   }

//   showAlert('Global settings saved successfully!', 'success')
// }

// async function testConnection() {
//   const userEmail = document.getElementById('userEmail').value.trim()
//   const avatarWebhookUrl = document.getElementById('avatarWebhookUrl').value.trim()
//   const messagesWebhookUrl = document.getElementById('messagesWebhookUrl').value.trim()

//   if (!userEmail || !avatarWebhookUrl || !messagesWebhookUrl) {
//     showAlert('Please fill in all required fields first')
//     return
//   }

//   try {
//     showAlert('Testing connection...', 'info')

//     // Test both webhooks
//     const [avatarResponse, messagesResponse] = await Promise.all([
//       fetch(`${avatarWebhookUrl}?user=${encodeURIComponent(userEmail)}`),
//       fetch(`${messagesWebhookUrl}?user=${encodeURIComponent(userEmail)}`)
//     ])

//     const avatarOk = avatarResponse.ok
//     const messagesOk = messagesResponse.ok

//     if (avatarOk && messagesOk) {
//       showAlert('Connection test successful!', 'success')
//     } else {
//       const errors = []
//       if (!avatarOk) errors.push(`Avatar webhook: ${avatarResponse.status} ${avatarResponse.statusText}`)
//       if (!messagesOk) errors.push(`Messages webhook: ${messagesResponse.status} ${messagesResponse.statusText}`)
//       showAlert(`Connection test failed: ${errors.join(', ')}`)
//     }
//   } catch (error) {
//     showAlert(`Connection test failed: ${error.message}`)
//   }
// }

// function refreshData() {
//   // Force a refresh by updating the settings version
//   streamDeck.updateGlobalSettings('settingsVersion', Date.now())
//   showAlert('Data refresh triggered!', 'success')
// }

// function showAlert(text, type = 'error', seconds = 5) {
//   const alerts = document.getElementById('alerts')
//   if (alerts.style.display === 'block') alerts.style.display = 'none'
//   alerts.innerHTML = `<span class="${type}">${text}</span>`
//   alerts.style.display = 'block'
//   setTimeout(() => { alerts.style.display = 'none' }, seconds * 1000)
// }
