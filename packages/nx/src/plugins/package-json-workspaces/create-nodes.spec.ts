import '../../internal-testing-utils/mock-fs';

import { vol } from 'memfs';
import { createNodeFromPackageJson, createNodes } from './create-nodes';

describe('nx package.json workspaces plugin', () => {
  const context = {
    workspaceRoot: '/root',
    configFiles: [],
    nxJsonConfiguration: {},
  };

  afterEach(() => {
    vol.reset();
  });

  it('should build projects from package.json files', () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: { test: 'jest' },
        }),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          scripts: {
            build: 'tsc',
            test: 'jest',
            nonNxOperation: 'rm -rf .',
          },
          nx: {
            implicitDependencies: ['lib-a'],
            includedScripts: ['build', 'test'],
            targets: {
              build: {
                outputs: ['{projectRoot}/dist'],
              },
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodeFromPackageJson('package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "echo",
                ],
              },
            },
            "name": "root",
            "projectType": "library",
            "root": ".",
            "sourceRoot": ".",
            "targets": {
              "echo": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run echo",
                  "scriptContent": "echo root project",
                },
                "options": {
                  "script": "echo",
                },
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-a/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "test",
                ],
              },
            },
            "name": "lib-a",
            "projectType": "library",
            "root": "packages/lib-a",
            "sourceRoot": "packages/lib-a",
            "targets": {
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-b/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-b": {
            "implicitDependencies": [
              "lib-a",
            ],
            "includedScripts": [
              "build",
              "test",
            ],
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "build",
                  "test",
                ],
              },
            },
            "name": "lib-b",
            "projectType": "library",
            "root": "packages/lib-b",
            "sourceRoot": "packages/lib-b",
            "targets": {
              "build": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run build",
                  "scriptContent": "tsc",
                },
                "options": {
                  "script": "build",
                },
                "outputs": [
                  "{projectRoot}/dist",
                ],
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });

  describe('negative patterns', () => {
    it('should work based on negative patterns defined in package.json workspaces', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: [
              'packages/*',
              // Multiple negative entries
              '!packages/fs',
              '!packages/orm-browser-example',
              '!packages/framework-examples',
            ],
          }),
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      const context = {
        workspaceRoot: '/root',
        configFiles: [],
        nxJsonConfiguration: {},
      };

      // No matching project based on the package.json "workspace" config
      expect(
        createNodes[1]('package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // Matching project based on the package.json "workspace" config
      expect(createNodes[1]('packages/vite/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/vite": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [],
                },
              },
              "name": "vite",
              "projectType": "library",
              "root": "packages/vite",
              "sourceRoot": "packages/vite",
              "targets": {
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);

      // No matching project based on the package.json "workspace" config
      expect(
        createNodes[1]('packages/fs/package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the package.json "workspace" config
      expect(
        createNodes[1](
          'packages/orm-browser-example/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the package.json "workspace" config
      expect(
        createNodes[1](
          'packages/framework-examples/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);
    });

    it('should work based on negative patterns defined in pnpm-workspace.yaml', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'root' }),
          // Multiple negative entries
          'pnpm-workspace.yaml': `packages:
- 'packages/*'
- '!packages/fs'
- '!packages/orm-browser-example'
- '!packages/framework-examples'
`,
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      const context = {
        workspaceRoot: '/root',
        configFiles: [],
        nxJsonConfiguration: {},
      };

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        createNodes[1]('package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // Matching project based on the pnpm-workspace.yaml "packages" config
      expect(createNodes[1]('packages/vite/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/vite": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [],
                },
              },
              "name": "vite",
              "projectType": "library",
              "root": "packages/vite",
              "sourceRoot": "packages/vite",
              "targets": {
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        createNodes[1]('packages/fs/package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        createNodes[1](
          'packages/orm-browser-example/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        createNodes[1](
          'packages/framework-examples/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);
    });

    it('should work based on negative patterns defined in lerna.json', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'root' }),
          'lerna.json': JSON.stringify({
            packages: [
              'packages/*',
              // Multiple negative entries
              '!packages/fs',
              '!packages/orm-browser-example',
              '!packages/framework-examples',
            ],
          }),
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      // No matching project based on the lerna.json "packages" config
      expect(
        createNodes[1]('package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // Matching project based on the lerna.json "packages" config
      expect(createNodes[1]('packages/vite/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/vite": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [],
                },
              },
              "name": "vite",
              "projectType": "library",
              "root": "packages/vite",
              "sourceRoot": "packages/vite",
              "targets": {
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);

      // No matching project based on the lerna.json "packages" config
      expect(
        createNodes[1]('packages/fs/package.json', undefined, context)
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the lerna.json "packages" config
      expect(
        createNodes[1](
          'packages/orm-browser-example/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);

      // No matching project based on the lerna.json "packages" config
      expect(
        createNodes[1](
          'packages/framework-examples/package.json',
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`{}`);
    });
  });

  describe('sibling project.json files', () => {
    it('should add a script target if the sibling project.json file does not exist', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo build',
            },
          }),
        },
        '/root'
      );

      expect(createNodes[1]('packages/a/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/a": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [
                    "build",
                  ],
                },
              },
              "name": "root",
              "projectType": "library",
              "root": "packages/a",
              "sourceRoot": "packages/a",
              "targets": {
                "build": {
                  "executor": "nx:run-script",
                  "metadata": {
                    "runCommand": "npm run build",
                    "scriptContent": "echo build",
                  },
                  "options": {
                    "script": "build",
                  },
                },
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);
    });

    it('should add a script target if the sibling project.json exists but does not have a conflicting target', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo build',
            },
          }),
          'packages/a/project.json': JSON.stringify({
            targets: {
              'something-other-than-build': {
                command: 'echo something-other-than-build',
              },
            },
          }),
        },
        '/root'
      );

      expect(createNodes[1]('packages/a/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/a": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [
                    "build",
                  ],
                },
              },
              "name": "root",
              "projectType": "library",
              "root": "packages/a",
              "sourceRoot": "packages/a",
              "targets": {
                "build": {
                  "executor": "nx:run-script",
                  "metadata": {
                    "runCommand": "npm run build",
                    "scriptContent": "echo build",
                  },
                  "options": {
                    "script": "build",
                  },
                },
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);
    });

    it('should not add a script target if the sibling project.json exists and has a conflicting target', () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo "build from package.json"',
            },
          }),
          'packages/a/project.json': JSON.stringify({
            targets: {
              build: {
                command: 'echo "build from project.json"',
              },
            },
          }),
        },
        '/root'
      );

      expect(createNodes[1]('packages/a/package.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "projects": {
            "packages/a": {
              "metadata": {
                "targetGroups": {
                  "NPM Scripts": [],
                },
              },
              "name": "root",
              "projectType": "library",
              "root": "packages/a",
              "sourceRoot": "packages/a",
              "targets": {
                "nx-release-publish": {
                  "dependsOn": [
                    "^nx-release-publish",
                  ],
                  "executor": "@nx/js:release-publish",
                  "options": {},
                },
              },
            },
          },
        }
      `);
    });
  });
});
