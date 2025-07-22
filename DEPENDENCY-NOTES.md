As of 2024 October 28:

The `npm outdated` command reports some dependencies as outdated. They are not being updated at this time for the reasons given below:

- `@types/node`: Don't update until Node 22 is LTS version (currently Node 20).
- `chai`, `@types/chai`: Chai v5 is an esmodule.
- `nock`: Unit tests fail when using Nock v14 (interceptors aren't working; needs further investigation)