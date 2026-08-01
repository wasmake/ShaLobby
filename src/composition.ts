import { ManagedLobbyClient } from './api/managed-lobby.js';
import { ShaLobbyHandler } from './handlers/sha-lobby-handler.js';
import { PortalManager } from './managers/portal-manager.js';
import { PortalSessionManager } from './managers/portal-session-manager.js';
import { VisibilityManager } from './managers/visibility-manager.js';
import { MessageCatalog } from './messages/message-catalog.js';
import { PaperLobbyHandler } from './platform/paper/paper-lobby-handler.js';
import { ActiveLobbyConfigurationProvider } from './providers/active-lobby-configuration-provider.js';
import { ConfigurationPortalProvider } from './providers/configuration-portal-provider.js';
import { YamlLobbyConfigurationProvider } from './providers/lobby-configuration-provider.js';

const configurationSource = new YamlLobbyConfigurationProvider();
const activeConfiguration = new ActiveLobbyConfigurationProvider();
const portalProvider = new ConfigurationPortalProvider(activeConfiguration, configurationSource);
const portalSessionManager = new PortalSessionManager();
const portalManager = new PortalManager(
  portalProvider,
  portalProvider,
  portalSessionManager,
  () => activeConfiguration.require().settings['portal-cooldown-ms'],
);
const visibilityManager = new VisibilityManager(
  () => activeConfiguration.require().settings.visibility.default,
);

export const paperLobbyHandler = new PaperLobbyHandler(
  configurationSource,
  activeConfiguration,
  portalManager,
  portalSessionManager,
  visibilityManager,
);

export const shaLobbyHandler = new ShaLobbyHandler(
  new ManagedLobbyClient((request) => paperLobbyHandler.request(request)),
  new MessageCatalog(),
  () => paperLobbyHandler.close(),
);
