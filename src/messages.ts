import { parseDocument } from 'yaml';

export type MessageValues = Readonly<Record<string, boolean | number | string>>;

const MESSAGE_ID = /^[a-z][a-z0-9_-]{0,63}$/u;
const PLACEHOLDER = /%([a-z][a-z0-9_-]{0,63})%/gu;
const MAX_MESSAGES = 256;
const MAX_MESSAGE_LENGTH = 4_096;
const MAX_RENDERED_MESSAGE_LENGTH = 32_767;

export const COMMAND_MESSAGE_FALLBACKS = Object.freeze({
  prefix:
    '<#303746>[</#303746><gradient:#38D9FF:#4F7CFF:#A855F7>ShaLobby</gradient><#303746>]</#303746> ',
  'command-error':
    '%prefix%<#FF5C7A>No se pudo completar la operación. Revisa el registro del servidor.</#FF5C7A>',
  'player-required': '%prefix%<#FF5C7A>Este comando necesita un jugador válido.</#FF5C7A>',
  'invalid-arguments': '%prefix%<#FFB347>Los argumentos indicados no son válidos.</#FFB347>',
  'spawn-requested': '%prefix%<#55FF88>Teletransporte al lobby solicitado.</#55FF88>',
  'spawn-player-requested':
    '%prefix%<#55FF88>Teletransporte al lobby solicitado para <#F8FAFC>%player%</#F8FAFC>.</#55FF88>',
  'spawn-set': '%prefix%<#55FF88>Punto de aparición actualizado.</#55FF88>',
  'reload-complete': '%prefix%<#55FF88>Configuración recargada correctamente.</#55FF88>',
  'items-given':
    '%prefix%<#55FF88>Barra rápida administrada restaurada para <#F8FAFC>%player%</#F8FAFC>.</#55FF88>',
  'items-reset':
    '%prefix%<#55FF88>Barra rápida administrada restaurada para <#F8FAFC>%player%</#F8FAFC>.</#55FF88>',
  'menu-opened':
    '%prefix%<#55FF88>Menú <#F8FAFC>%menu%</#F8FAFC> abierto para <#F8FAFC>%player%</#F8FAFC>.</#55FF88>',
  'portal-wand':
    '%prefix%<#55FF88>Varita de portales entregada.</#55FF88> <#A8B3C7>La edición también requiere <#F8FAFC>lobby.protection.bypass</#F8FAFC>.</#A8B3C7>',
  'portal-created': '%prefix%<#55FF88>Portal <#F8FAFC>%portal%</#F8FAFC> creado.</#55FF88>',
  'portal-deleted': '%prefix%<#FFB347>Portal <#F8FAFC>%portal%</#F8FAFC> eliminado.</#FFB347>',
  'portal-list':
    '%prefix%<#A8B3C7>Portales configurados (<#F8FAFC>%count%</#F8FAFC>): <#F8FAFC>%ids%</#F8FAFC>.</#A8B3C7>',
  'portal-info':
    '%prefix%<#A8B3C7>Portal <#F8FAFC>%portal%</#F8FAFC>: mundo=<#F8FAFC>%world%</#F8FAFC>, min=<#F8FAFC>%minimum%</#F8FAFC>, max=<#F8FAFC>%maximum%</#F8FAFC>, permiso=<#F8FAFC>%permission%</#F8FAFC>, prioridad=<#F8FAFC>%priority%</#F8FAFC>, cooldown=<#F8FAFC>%cooldown% ms</#F8FAFC>, visualización=<#F8FAFC>%visualization%</#F8FAFC>, activo=<#F8FAFC>%enabled%</#F8FAFC>, destino=<#F8FAFC>%destination%</#F8FAFC>.</#A8B3C7>',
  'portal-enabled': '%prefix%<#55FF88>Portal <#F8FAFC>%portal%</#F8FAFC> activado.</#55FF88>',
  'portal-disabled': '%prefix%<#FFB347>Portal <#F8FAFC>%portal%</#F8FAFC> desactivado.</#FFB347>',
  'portal-pos1':
    '%prefix%<#55FF88>Primera posición guardada en <#F8FAFC>%world%</#F8FAFC> (<#F8FAFC>%x%, %y%, %z%</#F8FAFC>).</#55FF88>',
  'portal-pos2':
    '%prefix%<#55FF88>Segunda posición guardada en <#F8FAFC>%world%</#F8FAFC> (<#F8FAFC>%x%, %y%, %z%</#F8FAFC>).</#55FF88>',
  'portal-destination':
    '%prefix%<#55FF88>Destino de <#F8FAFC>%portal%</#F8FAFC> actualizado a <#F8FAFC>%destination%</#F8FAFC>.</#55FF88>',
  'portal-visualization-enabled': '%prefix%<#55FF88>Visualización de portales activada.</#55FF88>',
  'portal-visualization-disabled':
    '%prefix%<#FFB347>Visualización de portales desactivada.</#FFB347>',
  status:
    '%prefix%<#A8B3C7>Estado: <#F8FAFC>%state%</#F8FAFC>, activo=<#F8FAFC>%active%</#F8FAFC>, admisión=<#F8FAFC>%admission%</#F8FAFC>, pendientes=<#F8FAFC>%pending%/%maximum%</#F8FAFC>, aparición=<#F8FAFC>%spawn%</#F8FAFC>, objetos=<#F8FAFC>%items%</#F8FAFC>, menús=<#F8FAFC>%menus%</#F8FAFC>, servidores=<#F8FAFC>%servers%</#F8FAFC>, portales=<#F8FAFC>%portals%</#F8FAFC>.</#A8B3C7>',
  debug:
    '%prefix%<#A8B3C7>Diagnóstico: estado=<#F8FAFC>%state%</#F8FAFC>, activo=<#F8FAFC>%active%</#F8FAFC>, admisión=<#F8FAFC>%admission%</#F8FAFC>, pendientes=<#F8FAFC>%pending%/%maximum%</#F8FAFC>, generación=<#F8FAFC>%generation%</#F8FAFC>, directorio=<#F8FAFC>%directory%</#F8FAFC>, aparición=<#F8FAFC>%spawn%</#F8FAFC>, objetos=<#F8FAFC>%items%</#F8FAFC>, menús=<#F8FAFC>%menus%</#F8FAFC>, servidores=<#F8FAFC>%servers%</#F8FAFC>, portales=<#F8FAFC>%portals%</#F8FAFC>.</#A8B3C7>',
  unavailable:
    '%prefix%<#FFB347>La operación no está disponible en el contexto actual. Revisa la configuración, el mundo administrado, la selección y los permisos requeridos.</#FFB347>',
  unknown: '%prefix%<#FF5C7A>No se encontró el recurso solicitado.</#FF5C7A>',
  invalid:
    '%prefix%<#FF5C7A>El Runtime rechazó la operación porque sus datos o configuración no son válidos.</#FF5C7A>',
  overloaded:
    '%prefix%<#FFB347>El Runtime del lobby está ocupado. Inténtalo de nuevo en unos segundos.</#FFB347>',
});

export type CommandMessageKey = keyof typeof COMMAND_MESSAGE_FALLBACKS;

const FALLBACK_MESSAGES: Readonly<Record<string, string>> = COMMAND_MESSAGE_FALLBACKS;

export class MessageConfigurationError extends Error {
  public readonly code = 'MESSAGE_CONFIGURATION_INVALID';

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MessageConfigurationError';
  }
}

function mapping(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MessageConfigurationError(`${path} debe ser un mapa.`);
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MessageConfigurationError(`${path} debe ser un mapa simple.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

export function parseMessageConfiguration(source: string): Readonly<Record<string, string>> {
  if (source.length > 1_048_576) {
    throw new MessageConfigurationError('messages.yml supera el límite de 1 MiB.');
  }
  try {
    const document = parseDocument(source, {
      logLevel: 'silent',
      merge: false,
      prettyErrors: false,
      schema: 'core',
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
      version: '1.2',
    });
    const problems = [...document.errors, ...document.warnings];
    if (problems.length > 0) {
      throw new MessageConfigurationError(
        `messages.yml no es YAML válido: ${problems.map((problem) => problem.message).join('; ')}`,
      );
    }
    const root = mapping(document.toJS({ maxAliasCount: 16 }), 'messages.yml');
    if (root['messages'] === undefined || root['messages'] === null) return Object.freeze({});
    const messages = mapping(root['messages'], 'messages.yml.messages');
    const entries = Object.entries(messages);
    if (entries.length > MAX_MESSAGES) {
      throw new MessageConfigurationError(
        `messages.yml.messages no puede contener más de ${String(MAX_MESSAGES)} entradas.`,
      );
    }
    const result: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (!MESSAGE_ID.test(key)) {
        throw new MessageConfigurationError(`La clave de mensaje ${key} no es válida.`);
      }
      if (typeof value !== 'string' || value.length > MAX_MESSAGE_LENGTH) {
        throw new MessageConfigurationError(`El mensaje ${key} debe ser texto de longitud válida.`);
      }
      result[key] = value;
    }
    return Object.freeze(result);
  } catch (error: unknown) {
    if (error instanceof MessageConfigurationError) throw error;
    throw new MessageConfigurationError('No se pudo analizar messages.yml.', { cause: error });
  }
}

function escapeMiniMessage(value: boolean | number | string): string {
  return String(value).replaceAll('\\', '\\\\').replaceAll('<', '\\<');
}

function renderTemplate(template: string, prefix: string, values: MessageValues): string {
  return template.replace(PLACEHOLDER, (token: string, name: string) => {
    if (name === 'prefix') return prefix;
    const value = values[name];
    return value === undefined ? token : escapeMiniMessage(value);
  });
}

function renderedFallback(prefix: string): string {
  const fallback = renderTemplate(COMMAND_MESSAGE_FALLBACKS['command-error'], prefix, {});
  if (fallback.length <= MAX_RENDERED_MESSAGE_LENGTH) return fallback;
  return renderTemplate(
    COMMAND_MESSAGE_FALLBACKS['command-error'],
    COMMAND_MESSAGE_FALLBACKS.prefix,
    {},
  );
}

export class MessageCatalog {
  #configured: Readonly<Record<string, string>> = Object.freeze({});

  public replace(source: string): void {
    this.#configured = parseMessageConfiguration(source);
  }

  public commit(candidate: MessageCatalog): void {
    this.#configured = candidate.#configured;
  }

  public render(key: string, values: MessageValues = {}): string {
    const { prefix: configuredPrefix } = this.#configured;
    const template =
      this.#configured[key] ?? FALLBACK_MESSAGES[key] ?? COMMAND_MESSAGE_FALLBACKS['command-error'];
    const prefix = configuredPrefix ?? COMMAND_MESSAGE_FALLBACKS.prefix;
    const rendered = renderTemplate(template, prefix, values);
    return rendered.length <= MAX_RENDERED_MESSAGE_LENGTH ? rendered : renderedFallback(prefix);
  }
}
