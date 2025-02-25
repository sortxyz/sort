// @ts-check

/** @type {import("syncpack").RcFile} */
module.exports = {
  versionGroups: [
    {
      label: 'Use workspace protocol for local packages', // https://github.com/JamieMason/syncpack/issues/189#issuecomment-1880146015
      dependencies: [
        '$LOCAL'
      ],
      dependencyTypes: [
        '!local'
      ],
      pinVersion: 'workspace:*'
    }
  ],
  semverGroups: [
    {
      label: 'Use exact versions',
      packages: ['**'],
      dependencies: ['kysely-codegen'],
      isIgnored: true
    },
    {
      label: 'Use tilde ranges',
      packages: ['**'],
      dependencies: ['ts-jest', 'typescript'],
      range: '~'
    },
    {
      label: 'Use caret ranges',
      packages: ['**'],
      dependencies: ['**'],
      range: '^'
    }
  ]
}
