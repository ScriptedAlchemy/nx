import {
  checkFilesExist,
  getSelectedPackageManager,
  packageManagerLockFile,
  runCLI,
  uniq,
  runCreatePlugin,
  cleanupProject,
} from '@nrwl/e2e/utils';

describe('create-nx-plugin', () => {
  const packageManager = getSelectedPackageManager() || 'pnpm';

  afterEach(() => cleanupProject());

  it('should be able to create a plugin repo and run plugin e2e', () => {
    const wsName = uniq('ws-plugin');
    const pluginName = uniq('plugin');

    runCreatePlugin(wsName, {
      packageManager,
      pluginName,
    });

    checkFilesExist(
      'package.json',
      packageManagerLockFile[packageManager],
      `packages/${pluginName}/package.json`,
      `packages/${pluginName}/project.json`,
      `packages/create-${pluginName}-package/package.json`,
      `packages/create-${pluginName}-package/project.json`
    );

    expect(() => runCLI(`build ${pluginName}`)).not.toThrow();
    expect(() => runCLI(`build create-${pluginName}-package`)).not.toThrow();
    expect(() => runCLI(`e2e ${pluginName}`)).not.toThrow();
  });
});
