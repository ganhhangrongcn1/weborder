const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const escapedRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const config = {
  maxWorkers: 4,
  resolver: {
    blockList: [new RegExp(`^${escapedRoot}[/\\\\](android|ios|releases)([/\\\\].*)?$`)],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
