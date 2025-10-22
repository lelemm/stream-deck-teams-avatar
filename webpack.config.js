const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')

let destFolder = 'dist'

if (process.env.NODE_ENV === 'production') destFolder = 'release/com.leandromenezes.teamsavatar.sdPlugin'

const mainConfig = {
  entry: './src/js/main.js',
  output: {
    filename: 'js/main.js',
    path: path.resolve(__dirname, destFolder)
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/manifest.json', to: '' },
        { from: './src/app.html', to: '' },
        { from: './src/assets', to: 'assets' }
      ]
    })
  ]
}

const piConfig = {
  entry: './src/js/pi.js',
  output: {
    filename: 'js/pi.js',
    path: path.resolve(__dirname, destFolder)
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/pi.html', to: '' },
        { from: './src/css', to: 'css' }
      ]
    })
  ]
}

const piRotatingConfig = {
  entry: './src/js/pi-rotating.js',
  output: {
    filename: 'js/pi-rotating.js',
    path: path.resolve(__dirname, destFolder)
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/pi-rotating.html', to: '' }
      ]
    })
  ]
}

const setupConfig = {
  entry: './src/js/setup.js',
  output: {
    filename: 'js/setup.js',
    path: path.resolve(__dirname, destFolder)
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/setup.html', to: '' }
      ]
    })
  ]
}

module.exports = [mainConfig, piConfig, piRotatingConfig, setupConfig]
