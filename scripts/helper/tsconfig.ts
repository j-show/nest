import path from 'path';
import { formatDiagnostic, parseJsonConfigFileContent, readConfigFile, sys } from 'typescript';

import { readFileSafeSync } from './common';

export function readTsConfigFile(fileName: string, basePath = path.dirname(fileName)) {
  const { config, error } = readConfigFile(fileName, (file) => {
    const buffer = readFileSafeSync(file);
    if (!buffer) return;

    return buffer.toString('utf8');
  });

  if (error) {
    const errorString = formatDiagnostic(error, {
      getCurrentDirectory: () => basePath,
      getCanonicalFileName: (x) => x,
      getNewLine: () => '\n',
    });
    throw new Error(errorString);
  }

  const parsedOptions = parseJsonConfigFileContent(config, sys, basePath);

  return parsedOptions.options;
}
