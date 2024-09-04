As of 2024 Sept 4:

The `npm outdated` command reports some dependencies as outdated. They are not being updated at this time for the reasons given below:

- `@types/node`: Don't update until Node 22 is LTS version (currently Node 20).
- `antlr4` and `@types/antlr4`: Updating ANLTR requires additional updates. Revisit this upgrade when time permits.
- `chai`: Chai v5 is an esmodule.
