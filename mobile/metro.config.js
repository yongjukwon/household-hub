const { getDefaultConfig } = require('expo/metro-config')

// Expo SDK 57 detects npm workspaces automatically; retaining the default
// Expo configuration keeps the shared package resolution on that supported path.
module.exports = getDefaultConfig(__dirname)
