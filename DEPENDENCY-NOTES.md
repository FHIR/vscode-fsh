The `npm outdated` command reports some dependencies as outdated. They have not been updated for the reasons given below:

- `@types/node`: Don't update until Node 22 is LTS version (currently Node 20).
- `antlr4` and `@types/antlr4`: Updating ANLTR requires additional updates. Revisit this upgrade when time permits.
- `chai`: Chai v5 is an esmodule.
