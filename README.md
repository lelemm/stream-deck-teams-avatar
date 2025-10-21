# Stream Deck Teams Avatar Plugin

A Stream Deck plugin that displays your Teams user avatar with unread message count and shows messages in a modal when clicked.

## Features

- **Avatar Display**: Shows your Teams user avatar on the Stream Deck button
- **Message Count**: Displays unread message count as an overlay number
- **Message Modal**: Click the button to view messages in a desktop modal
- **n8n Integration**: Uses webhooks to fetch avatar and message data
- **Configurable Polling**: Set custom polling intervals for data updates

## Prerequisites

- **Stream Deck Software**: Elgato Stream Deck software v4.1 or later
- **n8n**: Webhook endpoints for avatar and message data
- **Node.js**: For building the plugin

## Installation

### Building from Source

```bash
# Install dependencies
npm install

# Build the plugin
npm run production
```

The built plugin will be in the `release/` directory as `com.leandromenezes.teamsavatar.sdPlugin`.

### Manual Installation

1. Copy the `com.leandromenezes.teamsavatar.sdPlugin` folder to your Stream Deck plugins directory
2. Restart Stream Deck software
3. The plugin should appear in the Stream Deck store under "Teams Avatar"

## Configuration

### n8n Webhook Setup

You need to create two n8n webhooks:

#### Avatar Webhook
- **Method**: GET
- **URL**: Your webhook URL
- **Query Parameter**: `user` (user email)
- **Response**: User avatar image (JPEG/PNG)

#### Messages Webhook
- **Method**: GET
- **URL**: Your webhook URL
- **Query Parameter**: `user` (user email)
- **Response**: JSON array of messages
  ```json
  [
    {
      "title": "Message Subject",
      "body": "Message content here..."
    }
  ]
  ```

### Plugin Configuration

#### Global Settings (Optional)
1. Click the settings icon in the property inspector of any Teams Avatar button
2. Select "Settings" to access global settings
3. Configure the polling interval (shared across all buttons)

#### Per-Button Settings
1. Add one or more "Teams Avatar" actions to your Stream Deck
2. For each button, click the settings icon in the property inspector
3. Enter the user's email address
4. Enter the avatar and messages webhook URLs for that user
5. Test the connection
6. Save settings

## Usage

- Each button displays a user's avatar with their unread message count
- Click any button to view that user's messages in a modal window
- The modal shows all unread messages with titles and content
- Close the modal using the close button
- Configure different users on different buttons for team monitoring

## Development

### Scripts

- `npm run dev` - Development build
- `npm run watch` - Development build with file watching
- `npm run production` - Production build

### Project Structure

```
src/
├── js/
│   ├── main.js              # Plugin main entry point
│   ├── pi.js                # Property inspector
│   ├── setup.js             # Setup page entry
│   ├── lib/
│   │   └── streamDeck.js    # Stream Deck SDK wrapper
│   └── actions/
│       ├── action.js        # Base action class
│       └── teamsAvatar.js   # Teams Avatar action
├── components/
├── assets/                  # Icons and images
├── css/                     # Stylesheets
├── *.html                   # HTML entry points
└── manifest.json            # Plugin manifest
```

## Troubleshooting

### Common Issues

**"Config Required" on button**
- Ensure all settings are configured in the property inspector
- Check that webhook URLs are accessible

**No avatar displayed**
- Verify the avatar webhook returns a valid image
- Check network connectivity

**No message count**
- Ensure messages webhook returns valid JSON array
- Check webhook response format

**Modal not showing**
- Verify messages webhook returns data
- Check for JavaScript errors in console

### Testing Webhooks

Test your webhooks manually:

```bash
# Test avatar webhook
curl "https://your-n8n-webhook.com/avatar?user=your@email.com"

# Test messages webhook
curl "https://your-n8n-webhook.com/messages?user=your@email.com"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## About

Stream Deck plugin for displaying Teams avatar and messages using n8n webhooks.
