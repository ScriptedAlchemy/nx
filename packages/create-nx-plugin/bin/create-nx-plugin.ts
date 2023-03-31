#!/usr/bin/env node

// we can't import from '@nrwl/workspace' because it will require typescript
import {
  getPackageManagerCommand,
  NxJsonConfiguration,
  readJsonFile,
  writeJsonFile,
  output,
} from '@nrwl/devkit';
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import * as path from 'path';
import { dirSync } from 'tmp';
import { initializeGitRepo, showNxWarning } from './shared';
import {
  detectInvokedPackageManager,
  PackageManager,
} from './detect-invoked-package-manager';
import * as enquirer from 'enquirer';
import yargsParser = require('yargs-parser');

const nxVersion = require('../package.json').version;

const parsedArgs: yargsParser.Arguments = yargsParser(process.argv, {
  string: ['pluginName', 'packageManager', 'importPath', 'createPackageName'],
  alias: {
    importPath: 'import-path',
    pluginName: 'plugin-name',
    packageManager: 'pm',
    createPackageName: 'create-package-name',
  },
  boolean: ['help'],
});

function createSandbox(packageManager: string) {
  console.log(`Creating a sandbox with Nx...`);
  const tmpDir = dirSync().name;
  writeJsonFile(path.join(tmpDir, 'package.json'), {
    dependencies: {
      '@nrwl/workspace': nxVersion,
      nx: nxVersion,
    },
    license: 'MIT',
  });

  execSync(`${packageManager} install --silent --ignore-scripts`, {
    cwd: tmpDir,
    stdio: [0, 1, 2],
  });

  return tmpDir;
}

function createEmptyWorkspace(
  tmpDir: string,
  packageManager: PackageManager,
  parsedArgs: any,
  name: string
) {
  // Ensure to use packageManager for args
  // if it's not already passed in from previous process
  if (!parsedArgs.packageManager) {
    parsedArgs.packageManager = packageManager;
  }

  const args = [
    name,
    ...process.argv.slice(parsedArgs._[2] ? 3 : 2).map((a) => `"${a}"`),
  ].join(' ');

  const command = `new ${args} --preset=empty --collection=@nrwl/workspace`;
  console.log(command);

  const pmc = getPackageManagerCommand(packageManager);
  execSync(
    `${
      pmc.exec
    } nx ${command}/generators.json --nxWorkspaceRoot="${process.cwd()}"`,
    {
      stdio: [0, 1, 2],
      cwd: tmpDir,
    }
  );
  execSync(`${packageManager} add -D @nrwl/nx-plugin@${nxVersion}`, {
    cwd: name,
    stdio: [0, 1, 2],
  });
}

function createNxPlugin(
  workspaceName: string,
  pluginName: string,
  packageManager: PackageManager,
  createPackageName: string,
  parsedArgs: yargsParser.Arguments
) {
  const pmc = getPackageManagerCommand(packageManager);

  const importPath = parsedArgs.importPath ?? `@${workspaceName}/${pluginName}`;
  const generatePluginCommand = `nx generate @nrwl/nx-plugin:plugin ${pluginName} --importPath=${importPath}`;
  console.log(generatePluginCommand);
  execSync(`${pmc.exec} ${generatePluginCommand}`, {
    cwd: workspaceName,
    stdio: [0, 1, 2],
  });

  const createPackageCommand = `nx generate @nrwl/nx-plugin:create-package ${createPackageName} --project=${pluginName}`;
  console.log(createPackageCommand);
  execSync(`${pmc.exec} ${createPackageCommand}`, {
    cwd: workspaceName,
    stdio: [0, 1, 2],
  });
}

function updateWorkspace(workspaceName: string) {
  const nxJsonPath = path.join(workspaceName, 'nx.json');
  const nxJson = readJsonFile<NxJsonConfiguration>(nxJsonPath);

  nxJson.workspaceLayout = {
    appsDir: 'e2e',
    libsDir: 'packages',
  };

  writeJsonFile(nxJsonPath, nxJson);

  rmSync(path.join(workspaceName, 'apps'), { recursive: true, force: true });
  rmSync(path.join(workspaceName, 'libs'), { recursive: true, force: true });
}

async function determineWorkspaceName(
  parsedArgs: yargsParser.Arguments
): Promise<string> {
  const workspaceName = parsedArgs._[2] as string;

  if (workspaceName) {
    return Promise.resolve(workspaceName);
  }

  const results = await enquirer.prompt<{ workspaceName: string }>([
    {
      name: 'workspaceName',
      message: `Workspace name (e.g., org name)    `,
      type: 'input',
    },
  ]);
  if (!results.workspaceName) {
    output.error({
      title: 'Invalid workspace name',
      bodyLines: [`Workspace name cannot be empty`],
    });
    process.exit(1);
  }
  return results.workspaceName;
}

async function determinePluginName(parsedArgs) {
  if (parsedArgs.pluginName) {
    return Promise.resolve(parsedArgs.pluginName);
  }

  const results = await enquirer.prompt<{ pluginName: string }>([
    {
      name: 'pluginName',
      message: `Plugin name                        `,
      type: 'input',
    },
  ]);
  if (!results.pluginName) {
    output.error({
      title: 'Invalid name',
      bodyLines: [`Name cannot be empty`],
    });
    process.exit(1);
  }
  return results.pluginName;
}

function showHelp() {
  console.log(`
  Usage:  <name> [options]

  Create a new Nx workspace

  Args:

    name           workspace name (e.g., org name)

  Options:

    pluginName     the name of the plugin to be created
`);
}

export async function main() {
  if (parsedArgs.help) {
    showHelp();
    process.exit(0);
  }

  const packageManager: PackageManager =
    parsedArgs.packageManager || detectInvokedPackageManager();
  const workspaceName = await determineWorkspaceName(parsedArgs);
  const pluginName = await determinePluginName(parsedArgs);
  const createPackageName =
    parsedArgs.createPackageName || `create-${pluginName}-package`;
  const tmpDir = createSandbox(packageManager);
  createEmptyWorkspace(tmpDir, packageManager, parsedArgs, workspaceName);
  updateWorkspace(workspaceName);
  createNxPlugin(
    workspaceName,
    pluginName,
    packageManager,
    createPackageName,
    parsedArgs
  );
  await initializeGitRepo(workspaceName);
  showNxWarning(workspaceName);
}

main();
