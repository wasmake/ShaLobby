# Guía de administración

## Estado de distribución

El código de ShaLobby está implementado y supera sus comprobaciones y compilación. Sin embargo, el
bridge coordinado de ShamooRuntime y la API correspondiente de `@shamoo/paper` todavía no están
publicados en `0.1.0-rc.1`. El Runtime público `rc.1` no sirve para este despliegue. Use un JAR de
Runtime coordinado que incluya `managed-lobby` y conserve la identidad exacta de sus fuentes.
El Runtime coordinado ya incorpora exactamente los mismos ocho defaults y supera la paridad byte a byte.
La publicación sigue bloqueada por la falta de artefactos Runtime/API coordinados y su certificación
conjunta; no basta con compilar ShaLobby de forma aislada. Ese contrato incluye `messagesContent`
correlacionado en cada recarga correcta y campos opcionales que se omiten en vez de enviarse como
`null`.

## Requisitos

- Linux x86-64.
- Java 21.
- Paper 1.21.8.
- ShamooRuntime Paper coordinado con ShaLobby.
- Un proxy compatible con mensajes BungeeCord si se usarán transferencias.

## Inicio rápido

> **Advertencia de defaults destructivos:** use ShaLobby solo en un servidor Paper dedicado al lobby.
> Antes de activar el bridge, haga una copia de seguridad del servidor, los mundos y los datos de
> jugadores, y revise los ocho defaults de este checkout. La configuración generada administra de
> inmediato el mundo existente `world`, reinicia el estado de los jugadores al entrar, fuerza la barra
> rápida y las reglas del mundo, y activa una protección amplia. En un servidor survival o de juego
> normal puede eliminar inventario/estado e impedir la jugabilidad prevista.

1. Detenga Paper e instale el JAR coordinado de ShamooRuntime en `<paper>/plugins/`.
2. Inicie y detenga Paper una vez si todavía no existe
   `<paper>/plugins/ShamooRuntime/config.yml`.
3. Active la capacidad y su único propietario en ese archivo:

   ```yaml
   managed-lobby:
     enabled: true
     owner: shalobby
     data-directory: data
     maximum-pending-actions: 64
   ```

   `enabled: true` permite preparar la capacidad para el propietario. El `enable` de TypeScript acepta
   la configuración y queda en espera; la conducta nativa se activa después, cuando Runtime abre la
   admisión de invocaciones para esa generación.

4. Instale estos tres archivos, y solo estos tres, en
   `<paper>/plugins/ShamooRuntime/plugins/shalobby/`:

   ```text
   index.js
   index.js.map
   shamoo-plugin.json
   ```

5. Inicie Paper. En el primer arranque, Runtime genera automáticamente los ocho defaults pulidos en
   `<paper>/plugins/ShamooRuntime/data/shalobby/`. No copie manualmente el directorio `defaults/`.
6. Entre con un jugador que tenga `lobby.command.setspawn`, sitúese en el mundo administrado
   predeterminado `world` y ejecute:

   ```text
   /lobby setspawn
   ```

7. Revise los destinos de `servers.yml`, los mundos y los portales generados. Los tres portales de
   ejemplo empiezan deshabilitados.
8. Si ha editado YAML después del arranque, ejecute opcionalmente:

   ```text
   /lobby reload
   ```

9. Pruebe el lobby con permisos ordinarios y administrativos antes de admitir público.

Si cambia `managed-lobby.data-directory`, la ruta cambia. Un valor relativo parte de
`plugins/ShamooRuntime`, un valor absoluto usa esa raíz, y Runtime añade siempre `/shalobby`. La ruta
de datos debe quedar fuera del directorio vigilado `plugins.directory`.

## Aparición global

El primer arranque crea:

```yaml
spawn: { configured: false }
```

Solo existe una aparición global opcional. `/lobby setspawn` guarda de forma atómica el mundo, las
coordenadas, `yaw` y `pitch`, y activa `configured: true`. No existen listas, nombres, apariciones por
mundo ni selección aleatoria.

Mientras no se configure, los jugadores conservan la ubicación de entrada nativa de Paper y el resto
del lobby sigue funcionando. `/lobby`, `/spawn`, `/hub`, las acciones `spawn` y el rescate del vacío no
tienen un destino explícito. Runtime no inventa una aparición temporal.

## Permisos

Permisos de comandos:

| Permiso                      | Uso                                        |
| ---------------------------- | ------------------------------------------ |
| `lobby.command.spawn`        | `/lobby`, `/spawn` y `/hub` para uno mismo |
| `lobby.command.spawn.others` | `/lobby spawn <player>`                    |
| `lobby.command.setspawn`     | `/lobby setspawn`                          |
| `lobby.command.reload`       | `/lobby reload`                            |
| `lobby.command.items`        | `/lobby items give/reset`                  |
| `lobby.command.menu`         | `/lobby menu open`                         |
| `lobby.command.debug`        | `/lobby status` y `/lobby debug`           |
| `lobby.command.portal`       | Todos los subcomandos de portal            |

Permisos de comportamiento:

| Permiso                   | Uso                                                                              |
| ------------------------- | -------------------------------------------------------------------------------- |
| `lobby.protection.bypass` | Omite las restricciones causadas por jugadores y autoriza la edición de portales |
| `lobby.visibility.staff`  | Hace visible al objetivo en modo `staff` y permite visualizar portales marcados  |
| `lobby.portal.survival`   | Ejemplo de acceso al portal `portal-survival`                                    |
| `lobby.portal.skyblock`   | Ejemplo de acceso al portal `portal-skyblock`                                    |
| `lobby.portal.minigames`  | Ejemplo de acceso al portal `portal-minigames`                                   |

El editor necesita simultáneamente `lobby.command.portal` y el bypass configurado. El propietario
Runtime `shalobby` no es un permiso de jugador.

## Comandos operativos

| Comando                            | Emisor                                 |
| ---------------------------------- | -------------------------------------- |
| `/lobby`, `/spawn`, `/hub`         | Jugador                                |
| `/lobby spawn <player>`            | Jugador o consola                      |
| `/lobby setspawn`                  | Jugador                                |
| `/lobby reload`                    | Jugador o consola                      |
| `/lobby items give [player]`       | Jugador; consola con jugador explícito |
| `/lobby items reset [player]`      | Jugador; consola con jugador explícito |
| `/lobby menu open <menu> [player]` | Jugador; consola con jugador explícito |
| `/lobby status`, `/lobby debug`    | Jugador o consola                      |

Los argumentos opcionales de jugador usan al emisor cuando este es un jugador. La consola debe
indicar un jugador conectado.

`/spawn` y `/hub` son comandos de nivel superior registrados por separado que ejecutan la misma
operación que `/lobby`; no son aliases nativos de `/lobby`. Si otro plugin registra uno de esos nombres,
revise los avisos de registro al arrancar y `/help <comando>`, elimine o renombre la ruta conflictiva en
ese plugin, o use `/lobby`. ShaLobby no tiene una lista de aliases capaz de resolver la colisión.

`/lobby status` muestra estado, actividad nativa, admisión, trabajo pendiente/máximo y conteos; el de
servidores incluye todas las entradas configuradas, activas o no. `/lobby debug` añade la generación y
el directorio persistente resuelto. Ambos exigen
`lobby.command.debug`; no conceda ese permiso a usuarios ordinarios porque `debug` revela una ruta del
sistema.

## Flujo de portales

### Preparar un portal

1. Conceda al editor `lobby.command.portal` y `lobby.protection.bypass`.
2. Entre en un mundo incluido en `config.yml.worlds`.
3. Reciba la varita:

   ```text
   /lobby portal wand
   ```

4. Marque un bloque con clic izquierdo para la posición 1 y otro con clic derecho para la posición 2.
   También puede capturar la posición del bloque del jugador:

   ```text
   /lobby portal setpos1
   /lobby portal setpos2
   ```

5. Cree el portal. Este ejemplo lo deja deshabilitado hasta terminar la revisión:

   ```text
   /lobby portal create eventos survival --permission lobby.portal.eventos --priority 10 --cooldown 2500 --enabled false --visualize true
   ```

6. Compruebe la definición:

   ```text
   /lobby portal info eventos
   /lobby portal list
   ```

7. Ajuste el destino si es necesario:

   ```text
   /lobby portal setdestination server eventos survival
   /lobby portal setdestination spawn eventos
   /lobby portal setdestination menu eventos game-selector
   ```

   `server` envía una solicitud Bungee `Connect`; `spawn` usa la única aparición global; `menu` abre
   un menú configurado. Los destinos `server` y `menu` deben existir y estar habilitados cuando
   corresponda.

8. Active y visualice el resultado:

   ```text
   /lobby portal enable eventos
   /lobby portal visualize true
   ```

9. Salga y vuelva a entrar en la región para repetir una prueba. Permanecer dentro no vuelve a
   disparar la acción.

10. Desactive o elimine el portal cuando proceda:

```text
/lobby portal disable eventos
/lobby portal delete eventos
```

### Prioridad, permisos y enfriamiento

Los límites son inclusivos. Los portales pueden solaparse: gana el valor `priority` más alto y, en
empate, el ID alfabéticamente menor. El permiso opcional se comprueba al entrar. El enfriamiento es por
jugador y portal, y se inicia antes de encolar la acción nativa. Un portal deshabilitado no participa en
la búsqueda.

Los portales generados cubren solo ejemplos en `world`, están deshabilitados y deben adaptarse a la
construcción real. Cada portal habilitado puede abarcar como máximo 4096 chunks; el índice completo
admite 16384 entradas de chunk.

## Servidores y proxy

Cada entrada de `servers.yml` relaciona un ID interno con un `target` del proxy. El `target` debe
coincidir con el nombre configurado en Bungee. No es una dirección, un ping, un estado ni una ruta
creada por ShaLobby.

La subcanal `Connect` no devuelve confirmación. Los mensajes correctos dicen "solicitando conexión",
no "conectado". Si el jugador permanece en el lobby, revise el nombre canónico y los registros del
proxy; ShaLobby no puede deducir que el destino está caído.

## Recarga segura

`/lobby reload` serializa las recargas de TypeScript. Runtime toma una instantánea de los ocho archivos,
analiza y valida todas las referencias, comprueba mundos, reglas, materiales, sonidos y partículas, y
solo después sustituye la configuración nativa. El catálogo de mensajes de comandos se confirma en
TypeScript únicamente a partir de `messagesContent`, devuelto por Runtime desde esa misma instantánea
aceptada. No existe una lectura independiente de `messages.yml` antes de la recarga.

Si Runtime rechaza la candidata, la configuración activa y los mensajes anteriores permanecen. Corrija
el error y vuelva a ejecutar el comando. Runtime rechaza los cambios externos que observan sus
comprobaciones de instantánea/versión; las escrituras externas no cooperativas que compiten con una
recarga o mutación no están soportadas, así que no edite YAML al mismo tiempo. Si una respuesta de éxito
omite, excede límites o contiene un `messagesContent` que TypeScript no puede analizar, el catálogo de
comandos anterior se conserva y la operación falla cerrada sin mostrar el payload bruto.

Los comandos que escriben `spawn.yml` o `portals.yml` crean un `.bak`, sincronizan el archivo temporal,
lo sustituyen mediante un rename atómico y validan la configuración completa antes de aplicarla.

## Comprobación previa a producción

- `/lobby status` indica `ready`, `active=true` y admisión abierta; la aceptación previa de la
  configuración por TypeScript solo significa espera/preparación.
- `spawnConfigured` es `true` después de `/lobby setspawn`.
- El mundo administrado existe y está cargado.
- Los cinco objetos, cuatro menús y el marcador se muestran correctamente.
- Un jugador sin bypass no puede modificar el mundo ni mover artefactos administrados.
- Un jugador con bypass puede editar, pero los artefactos administrados siguen siendo inamovibles.
- Los modos `all`, `staff` y `none` muestran los objetivos previstos.
- Cada transferencia usa un objetivo existente del proxy y solo anuncia una solicitud.
- Los portales respetan permiso, prioridad, entrada y enfriamiento.
- Una recarga inválida conserva la presentación anterior.

## Diagnóstico

| Síntoma                          | Comprobación                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------- |
| No existe `paperManagedLobby`    | El JAR instalado no contiene el bridge; `rc.1` público no lo incluye              |
| El bridge deniega ShaLobby       | `enabled: true`, `owner: shalobby` y manifiesto `shalobby` deben coincidir        |
| No aparecen los ocho archivos    | Revise `data-directory`, permisos del sistema y enlaces simbólicos                |
| `/lobby` no teletransporta       | Ejecute `/lobby setspawn`; no hay fallback nativo                                 |
| `/spawn` o `/hub` no es ShaLobby | Revise `/help`, avisos de registro y plugins con comandos del mismo nombre        |
| El arranque o reload falla       | Revise la ruta exacta indicada, referencias y registros nativos de Paper          |
| El portal no actúa               | Revise mundo, límites, `enabled`, permiso, prioridad, salida/reentrada y cooldown |
| El proxy no mueve al jugador     | Revise BungeeCord y `servers.yml.target`; enviar no confirma conexión             |
| Un placeholder no cambia         | Solo existen los ocho placeholders nativos documentados                           |
