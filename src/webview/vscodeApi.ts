// Web build: the "host" runs in the same browser context, so the VS Code
// postMessage shim is replaced by the in-process bridge. Every webview module
// keeps importing `post` / `onHostMessage` from here unchanged.

export { post, onHostMessage } from '../host/bridge';
