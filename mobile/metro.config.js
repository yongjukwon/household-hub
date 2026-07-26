// Metro configured for the npm workspace: this Expo app consumes the shared
// `@household-hub/domain` package, which lives at ../packages/domain (outside
// the project root). Metro must watch the workspace root and resolve modules
// from both the app's and the root's node_modules, or the shared package's
// source changes won't be bundled.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Force a single React copy into the bundle. The workspace root's web app pins
// react@19.2.7 while Expo SDK 57 pins react@19.2.3, so two copies exist on disk.
// A React Native bundle must contain exactly one React (two would break hooks
// and context), so every `react`/`react/*` import is pinned to the app's copy
// regardless of which node_modules the importing package lives in.
const reactRoot = path.dirname(
  require.resolve('react/package.json', {
    paths: [path.join(projectRoot, 'node_modules')],
  }),
)
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, nodeModulesPaths: [reactRoot, ...config.resolver.nodeModulesPaths] },
      moduleName,
      platform,
    )
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
