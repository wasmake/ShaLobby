import {
  JAVA_TYPES,
  paperJava,
  type GeneratedJavaTypeMap,
  type PaperHandle,
} from '@shamoo/paper-raw';

export type Ref<Name extends keyof GeneratedJavaTypeMap = keyof GeneratedJavaTypeMap> = PaperHandle<
  GeneratedJavaTypeMap[Name]
>;

export interface PaperEnumConstant<Name extends string = string> {
  readonly $paperEnum: Name;
  readonly name: string;
}

export type Constant<Name extends keyof GeneratedJavaTypeMap> =
  (typeof JAVA_TYPES)[Name]['kind'] extends 'enum' ? PaperEnumConstant<Name> : Ref<Name>;

export const Bukkit = paperJava.resolve(JAVA_TYPES['org.bukkit.Bukkit']);
export const plugin = paperJava.plugin;

export function call<R = unknown>(
  target: PaperHandle,
  name: string,
  ...arguments_: readonly unknown[]
): Promise<R> {
  return target.$invoke<R>(name, undefined, ...arguments_);
}

export function callExact<R = unknown>(
  target: PaperHandle,
  name: string,
  descriptor: string,
  ...arguments_: readonly unknown[]
): Promise<R> {
  return target.$invoke<R>(name, descriptor, ...arguments_);
}

export function staticCall<R = unknown>(
  type: {
    $invoke<R>(
      name: string,
      descriptor: string | undefined,
      ...values: readonly unknown[]
    ): Promise<R>;
  },
  name: string,
  ...arguments_: readonly unknown[]
): Promise<R> {
  return type.$invoke<R>(name, undefined, ...arguments_);
}

export function staticExact<R = unknown>(
  type: {
    $invoke<R>(
      name: string,
      descriptor: string | undefined,
      ...values: readonly unknown[]
    ): Promise<R>;
  },
  name: string,
  descriptor: string,
  ...arguments_: readonly unknown[]
): Promise<R> {
  return type.$invoke<R>(name, descriptor, ...arguments_);
}

export function construct<Name extends keyof GeneratedJavaTypeMap>(
  type: Name,
  descriptor: string,
  ...arguments_: readonly unknown[]
): Promise<Ref<Name>> {
  return paperJava.construct(JAVA_TYPES[type], descriptor, ...arguments_);
}

export function constant<Name extends keyof GeneratedJavaTypeMap>(
  type: Name,
  name: string,
): Promise<Constant<Name>> {
  const javaType = JAVA_TYPES[type];
  const descriptor = `L${javaType.javaName.replaceAll('.', '/')};`;
  if (javaType.kind === 'enum') {
    return paperJava
      .resolve(javaType)
      .$invoke<Constant<Name>>('valueOf', `(Ljava/lang/String;)${descriptor}`, name);
  }
  return paperJava.resolve(javaType).$get<Constant<Name>>(name, descriptor);
}

export async function player(id: string): Promise<Ref<'org.bukkit.entity.Player'> | null> {
  return staticExact(Bukkit, 'getPlayer', '(Ljava/util/UUID;)Lorg/bukkit/entity/Player;', id);
}

export function onlinePlayers(): Promise<readonly Ref<'org.bukkit.entity.Player'>[]> {
  return staticExact(Bukkit, 'getOnlinePlayers', '()Ljava/util/Collection;');
}

let miniMessage: Promise<Ref<'net.kyori.adventure.text.minimessage.MiniMessage'>> | undefined;

export async function component(value: string): Promise<Ref<'net.kyori.adventure.text.Component'>> {
  const parser = await (miniMessage ??= staticExact(
    paperJava.resolve(JAVA_TYPES['net.kyori.adventure.text.minimessage.MiniMessage']),
    'miniMessage',
    '()Lnet/kyori/adventure/text/minimessage/MiniMessage;',
  ));
  return callExact(
    parser,
    'deserialize',
    '(Ljava/lang/String;[Lnet/kyori/adventure/text/minimessage/tag/resolver/TagResolver;)Lnet/kyori/adventure/text/Component;',
    value,
  );
}
