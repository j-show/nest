import { Module } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';

import { ConsoleService } from './console.service';

@Module({
  providers: [MetadataScanner, ModulesContainer, ConsoleService],
  exports: [ConsoleService],
})
export class ConsoleModule {}
