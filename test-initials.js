// Quick test for initials generation
function generateInitialsImage(displayName) {
  // Extract initials from display name
  const names = displayName.split(' ').filter(name => name.length > 0)
  const initials = names.map(name => name.charAt(0).toUpperCase()).slice(0, 2).join('')

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
    '#0078d4', // Blue
    '#107c10', // Green
    '#d13438', // Red
    '#ff8c00', // Orange
    '#c239b3', // Purple
    '#00bcf2', // Light Blue
    '#7a7574', // Gray
    '#ffb900'  // Yellow
  ]

  const backgroundColor = colors[Math.abs(hash) % colors.length]

  // Draw background
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, size, size)

  // Draw initials
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.4}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, size / 2, size / 2)

  return canvas.toDataURL('image/png')
}

// Test cases
const testCases = [
  'John Doe',
  'Jane Smith',
  'Alice',
  'Bob Johnson Williams',
  'A',
  'user@company.com'
]

console.log('Testing initials generation:')
testCases.forEach(name => {
  const names = name.split(' ').filter(n => n.length > 0)
  const initials = names.map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('')
  console.log(`${name} -> ${initials}`)
})
