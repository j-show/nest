import { INestApplication, Injectable } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { Injector } from '@nestjs/core/injector/injector';
import { Module } from '@nestjs/core/injector/module';
import commander from 'commander';
import { get, sortBy } from 'lodash';

import { Constructor, NestLogger } from '@jshow/nest-common';

import {
  ArgumentMetaInfo,
  CommandMetaInfo,
  META_COMMAND,
  META_COMMAND_ARGUMENTS,
  META_COMMAND_OPTIONS,
  META_CONSOLE,
  META_MODULE_COMMANDS,
  OptionMetaInfo,
} from './decorators';
import { ConsoleRunOptions } from './defines';

@Injectable()
export class ConsoleService {
  private readonly instanceLoader = new Injector();
  private callback?: Function;
  private logger?: NestLogger;

  constructor(
    protected readonly modulesContainer: ModulesContainer,
    protected readonly metadataScanner: MetadataScanner,
  ) {}

  public run({ app, name, version = 'v0.1.0', args = process.argv, logger = console, callback }: ConsoleRunOptions) {
    this.callback = callback;
    this.logger = logger;

    const { program } = commander;
    this.modulesContainer.forEach((module) => {
      const commands = Reflect.getMetadata(META_MODULE_COMMANDS, module.metatype);
      if (!commands) {
        return;
      }
      commands.map((component: Constructor<any>) => {
        Injectable()(component);
        module.addInjectable(component);
        this.addCommand(app, program, component, module);
      });
    });
    program.allowUnknownOption(false).enablePositionalOptions(false).name(name).version(version).parseAsync(args);
  }

  public runP(options: Omit<ConsoleRunOptions, 'callback'>) {
    return new Promise((resolve) => {
      this.run(Object.assign(options, { callback: resolve }));
    });
  }

  public addCommand(app: INestApplication, prog: commander.Command, commandClass: Constructor<any>, module: Module) {
    const consoleMeta = Reflect.getMetadata(META_CONSOLE, commandClass);

    if (!consoleMeta) {
      return prog;
    }

    const prefix = consoleMeta.prefix ? `${consoleMeta.prefix}:` : '';

    this.metadataScanner.scanFromPrototype(commandClass, commandClass.prototype, (method) => {
      const commandMeta: CommandMetaInfo = Reflect.getMetadata(META_COMMAND, commandClass, method);
      if (!commandMeta) {
        return;
      }
      const command = prog.command(`${prefix}${commandMeta.name}`).description(commandMeta.description ?? '');
      if (commandMeta.alias) {
        command.alias(commandMeta.alias);
      }
      const argumentsMeta: ArgumentMetaInfo[] = Reflect.getMetadata(META_COMMAND_ARGUMENTS, commandClass, method);
      const argsInfo: Array<{ path: string[]; parameterIndex: number }> = [];
      if (argumentsMeta) {
        for (const argumentMeta of sortBy(argumentsMeta, 'parameterIndex')) {
          argsInfo.push({
            path: ['args', argumentMeta.name],
            parameterIndex: argumentMeta.parameterIndex,
          });
          if (argumentMeta.required) {
            command.arguments(`<${argumentMeta.name}>`);
          } else {
            command.arguments(`[${argumentMeta.name}]`);
          }
        }
      }

      const optionsMeta: OptionMetaInfo[] = Reflect.getMetadata(META_COMMAND_OPTIONS, commandClass, method);
      if (optionsMeta) {
        for (const optionMeta of sortBy(optionsMeta, 'parameterIndex')) {
          argsInfo.push({
            path: ['options', optionMeta.name],
            parameterIndex: optionMeta.parameterIndex,
          });
          let optionSetter = 'option';
          if (optionMeta.required) {
            optionSetter = 'requiredOption';
          }
          command[optionSetter](
            `--${optionMeta.name} <${optionMeta.name}>`,
            optionMeta.description,
            optionMeta.defaultValue,
          );
        }
      }

      /**
       * parsedArgs: [...args, options, command]
       * 命令处理函数的参数，为该命令声明的所有参数，除此之外还会附加两个额外参
       * 数：一个是解析出的选项，另一个则是该命令对象自身。
       */
      command.action(async (...parsedArgs: any[]) => {
        const args: { [index: string]: string } = {};
        const options: { [index: string]: string } = parsedArgs[parsedArgs.length - 2];
        if (parsedArgs.length > 2) {
          for (const argumentMeta of sortBy(argumentsMeta, 'parameterIndex')) {
            args[argumentMeta.name] = parsedArgs.shift();
          }
        }
        try {
          const injectable = module.injectables.get(commandClass.name) || module.injectables.get(commandClass);
          if (!injectable) {
            throw new Error(`Can not get injectable: ${commandClass.name}`);
          }
          this.instanceLoader.loadPrototype(injectable, module.injectables);
          await this.instanceLoader.loadInjectable(injectable, module);
          const commandInstance = app.get(commandClass);
          const methodArgs = [];
          const params = { args, options };
          for (const argInfo of sortBy(argsInfo, 'parameterIndex')) {
            methodArgs.push(get(params, argInfo.path));
          }
          methodArgs.push(this.logger);
          // eslint-disable-next-line prefer-spread
          await commandInstance[method].apply(commandInstance, methodArgs);
          if (this.callback) {
            this.callback();
          }
        } catch (e) {
          if (this.callback) {
            this.callback(e);
          } else {
            throw e;
          }
        }
      });
    });
    return prog;
  }
}
