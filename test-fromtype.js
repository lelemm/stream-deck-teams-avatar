// Quick test for fromType logic
const testUsers = [
  { userId: "user1", displayName: "John Doe", count: 5, fromType: 'user' },
  { userId: "bot1", displayName: "ChatGPT", count: 3, fromType: 'bot' },
  { userId: "user2", displayName: "Jane Smith", count: 2, fromType: 'user' },
  { userId: "bot2", displayName: "Assistant", count: 1, fromType: 'bot' }
]

console.log('Testing fromType logic:')
testUsers.forEach(user => {
  const shouldFetchAvatar = user.fromType === 'user'
  const willGenerateInitials = user.fromType === 'bot' || !shouldFetchAvatar

  console.log(`${user.displayName} (${user.fromType}): fetch=${shouldFetchAvatar}, initials=${willGenerateInitials}`)
})

// Test initials generation
function generateInitials(displayName) {
  const names = displayName.split(' ').filter(name => name.length > 0)
  const initials = names.map(name => name.charAt(0).toUpperCase()).slice(0, 2).join('')
  return initials
}

console.log('\nTesting initials generation:')
testUsers.forEach(user => {
  const initials = generateInitials(user.displayName)
  console.log(`${user.displayName} -> ${initials}`)
})
