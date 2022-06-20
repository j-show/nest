/* eslint-disable no-restricted-globals */
/**
 * 根据包之间依赖关系,按照拓扑排序 build
 */
import fs from 'fs';
import { Minimatch } from 'minimatch';
import path from 'path';

import { hashFile, hashFolder, mkdirp } from '../helper';

export const scope = '@jshow';

export const packagesFullPath = path.join(__dirname, '../../packages');

export const cacheFullPath = path.join(__dirname, '../../build-cache');

export const POSSIBLE_SOURCE_FOLDER_NAME = ['src', 'components'] as const;

// @see https://docs.npmjs.com/files/package.json
export const ALLWAYS_IGNORED_GLOBS = [
  '.git',
  'CVS',
  '.svn',
  '.hg',
  '.lock-wscript',
  '.wafpickle-N',
  '.*.swp',
  '.DS_Store',
  '._*',
  'npm-debug.log',
  '.npmrc',
  'node_modules',
  'config.gypi',
  '*.orig',
];

const matchIgnoredBlobs = ALLWAYS_IGNORED_GLOBS.map(
  (p) =>
    new Minimatch(p, {
      matchBase: true,
      // dotfiles inside ignored directories should also match
      dot: true,
    }),
);

export async function updatePackageCache(packageName: string) {
  const ret = await readPackageCache(packageName);
  if (ret) {
    await mkdirp(cacheFullPath);
    const cacheJsonPath = path.join(cacheFullPath, `${packageName}.json`);
    await writeCache(cacheJsonPath, {
      srcMd5: ret.srcHash,
      filesMd5: ret.buildHash,
      packageJsonMd5: ret.packageJsonHash,
    });
    return true;
  } else {
    return false;
  }
}

export function createNpmFilesMatcher(files: Iterable<string>) {
  const list = Array.from(new Set(files));
  if (!list.length) list.push('*');
  const matchers = list.map(
    (p) =>
      new Minimatch(p, {
        matchBase: true,
        // dotfiles inside ignored directories should also match
        dot: true,
      }),
  );
  return function match(filePath: string) {
    for (const ignorer of matchIgnoredBlobs) {
      if (ignorer.match(filePath)) return false;
    }
    for (const matcher of matchers) {
      if (matcher.match(filePath)) return true;
    }
    return null;
  };
}

export async function readPackageCache(packageName: string) {
  const packageDirName = path.join(packagesFullPath, packageName);
  const packageJsonPath = path.join(packageDirName, 'package.json');

  const { files } = readPackageJson(JSON.parse((await fs.promises.readFile(packageJsonPath)).toString('utf8')));

  if (!files.size) {
    console.info(`No files found in ${packageJsonPath}, using all files`);
    // @see https://docs.npmjs.com/files/package.json
    files.add('*');
  }

  let packageSourceName: string | undefined;
  for (const srcName of POSSIBLE_SOURCE_FOLDER_NAME) {
    const fullPath = path.join(packageDirName, srcName);
    if (fs.existsSync(fullPath)) {
      packageSourceName = fullPath;
      break;
    }
  }
  if (!packageSourceName) return;

  const matcher = createNpmFilesMatcher(files);

  await mkdirp(cacheFullPath);

  const cacheFileName = path.join(cacheFullPath, `${packageName}.json`);
  const cache = readCache(cacheFileName);

  const filter = (fullPath: string) => {
    if (fullPath.indexOf(packageDirName) !== 0) return false;
    const p = fullPath.slice(packageDirName.length);
    if (p === '/package.json') return false;
    return matcher(p);
  };

  const [srcHash, buildHash, packageJsonHash] = await Promise.all([
    (async () => {
      return (await hashFolder(packageSourceName)).hash;
    })(),
    (async () => {
      return (await hashFolder(packageDirName, void 0, filter)).hash;
    })(),
    hashFile(packageJsonPath),
  ]);

  return { cache, srcHash, buildHash, packageJsonHash };
}

export const dependencyKeys = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

export function readPackageJson(json: PackageJson) {
  const externalModules = new Set(json.externalModules);
  const deps = new Set(
    Object.keys({
      ...json.dependencies,
      ...json.devDependencies,
      ...json.peerDependencies,
    })
      .filter((x) => x.indexOf(scope) === 0 && !externalModules?.has(x))
      .map((x) => x.slice(scope.length + 1)),
  );
  const version = json.version;
  return { version, deps, files: new Set(json.files), scripts: json.scripts || {}, externalModules };
}

export function resolveTopologicalSorting(map: ReadonlyMap<string, ReadonlySet<string>>) {
  return resolveTopologicalSortingInternal(clonePackageDeps(map));
}

export function filterTopologicalSorting(map: Map<string, Set<string>>) {
  for (const [packageName, deps] of map) {
    if (!deps.size) continue;
    const _deps = new Set<string>();
    for (const name of deps) {
      if (!map.has(name)) continue;
      _deps.add(name);
    }
    map.set(packageName, _deps);
  }
}

function* resolveTopologicalSortingInternal(map: Map<string, Set<string>>) {
  // 简陋版循环引用报错用
  const MAX_LOOP_COUNT = 100;
  let loopCount = 0;
  while (map.size) {
    if (++loopCount > MAX_LOOP_COUNT) {
      console.error('无法处理依赖的包', map);
      throw Error('疑似出现包之间依赖有循环引用');
    }
    const yielded = new Set<string>();
    for (const [packageName, deps] of map) {
      if (deps.size) continue;
      yielded.add(packageName);
      yield packageName;
    }
    for (const [packageName, deps] of map) {
      if (yielded.has(packageName)) {
        map.delete(packageName);
      } else {
        for (const item of yielded) {
          deps.delete(item);
        }
      }
    }
  }
}

/**
 * 收集需要构建的包
 * @param packageNameToDepPackageNameMap
 * @param packagesToBuild
 */
export function collectPackagesToBuild(
  packageNameToDepPackageNameMap: ReadonlyMap<string, ReadonlySet<string>>,
  packagesToBuild: ReadonlySet<string>,
): Set<string> {
  const result = new Set<string>();
  collectPackagesToBuildInternal(result, packageNameToDepPackageNameMap, packagesToBuild);
  return result;
}

function collectPackagesToBuildInternal(
  result: Set<string>,
  depsMap: ReadonlyMap<string, ReadonlySet<string>>,
  packageNames: ReadonlySet<string>,
): void {
  for (const packageName of packageNames) {
    if (result.has(packageName)) continue;
    result.add(packageName);
    const deps = depsMap.get(packageName) as ReadonlySet<string>;
    collectPackagesToBuildInternal(result, depsMap, deps);
  }
}

export function resolveRelevantChanges(map: ReadonlyMap<string, ReadonlySet<string>>, picks: ReadonlySet<string>) {
  const revMap = new Map<string, Set<string>>();
  for (const [packageName, deps] of map) {
    for (const dep of deps) {
      let set = revMap.get(dep);
      if (!set) revMap.set(dep, (set = new Set()));
      set.add(packageName);
    }
  }
  const picked = new Map<string, Set<string>>();
  for (const packageName of picks) {
    pickPackageDeps(map, revMap, packageName, picked);
  }
  const pickedKeys = new Set(picked.keys());
  for (const deps of picked.values()) {
    for (const dep of deps) {
      if (pickedKeys.has(dep)) continue;
      deps.delete(dep);
    }
  }
  return picked;
}

function pickPackageDeps(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  revMap: ReadonlyMap<string, ReadonlySet<string>>,
  packageName: string,
  picked: Map<string, Set<string>>,
): void {
  if (picked.has(packageName)) return;
  const deps = map.get(packageName);
  if (!deps) return;
  picked.set(packageName, new Set(deps));
  const influencing = revMap.get(packageName);
  if (!influencing) return;
  for (const influenced of influencing) {
    pickPackageDeps(map, revMap, influenced, picked);
  }
}

export function clonePackageDeps(map: ReadonlyMap<string, ReadonlySet<string>>) {
  return new Map(Array.from(map.entries()).map((entry) => [entry[0], new Set(Array.from(entry[1]))] as const));
}

export function readCache(fullPath: string): Cache {
  try {
    const obj = require(fullPath);
    return obj && typeof obj === 'object' ? { ...obj } : {};
  } catch (e) {
    return {};
  }
}

export function writeCache(fullPath: string, cache: Required<Cache>) {
  return fs.promises.writeFile(fullPath, JSON.stringify(cache, null, 2));
}

/**
 * 读取目录的 package.json
 * @param filePath 文件路径
 */
export async function getPackageJson(filePath: string): Promise<PackageJson> {
  return JSON.parse((await fs.promises.readFile(filePath)).toString('utf8'));
}

/**
 * 写入目录的 package.json
 * @param filePath 文件路径
 * @param packageJson
 */
export async function setPackageJson(filePath: string, packageJson: PackageJson) {
  return fs.promises.writeFile(filePath, JSON.stringify(packageJson, null, 2));
}

export interface PackageJson {
  version: string;
  name: string;
  private?: boolean;
  files?: string[];
  scripts?: StringStringMap;
  dependencies?: StringStringMap;
  devDependencies?: StringStringMap;
  peerDependencies?: StringStringMap;
  externalModules?: string[];
}

export interface StringStringMap {
  [key: string]: string;
}

export interface Cache {
  srcMd5?: string;
  filesMd5?: string;
  packageJsonMd5?: string;
}
