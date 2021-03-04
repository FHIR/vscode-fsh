# FSH Language Support for VS Code

A language support extension for the FHIR Shorthand (FSH) language.

## How to Download

In Visual Studio Code, go to the VS Code Extension Marketplace and download the
`vscode-language-fsh` extension. Once activated, this extension's features should
be automatically implemented.

## Language Features

### Syntax Highlighting

![FSH Syntax](images/docs/fsh-syntax.jpg)

FSH files automatically have syntax highlighting applied. This allows for easier reading and writing of FHIR Shorthand.

## Snippets

![FSH Snippets](images/docs/fsh-snippets.gif)

FSH Snippets make creating new FSH items a breeze! Snippets automatically add relevant keywords and placeholders so you can easily
enter all of the recommended metadata for a FSH definition. Snippets will even auto-create your `Id` and `Title` for you based on the
name.

To use snippets, type one of the trigger phrases, hit the &lt;TAB&gt; or &lt;ENTER&gt; key, type in the first field value, and hit
the &lt;TAB&gt; key to move to the next placeholder. All FSH snippets always stop at the first rule in the definition.

| Trigger | FSH Item   | Keywords                                                        |
| ------- | ---------- | --------------------------------------------------------------- |
| `pro`   | Profile    | Profile, Parent, Id (auto), Title (auto), Description           |
| `ext`   | Extension  | Extension, Id (auto), Title (auto), Description                 |
| `vs`    | ValueSet   | ValueSet, Id (auto), Title (auto), Description                  |
| `cs`    | CodeSystem | CodeSystem, Id (auto), Title (auto), Description                |
| `inst`  | Instance   | Instance, InstanceOf, Usage (choice), Title (auto), Description |

## Compile and Run (for Developers)

- run `npm install` in this folder. This installs all necessary npm modules in both the
  client and server folder
- open VS Code on this folder.
- Switch to the Debug viewlet.
- Select `Extension` from the drop down.

# NPM Tasks

The following NPM tasks may be useful in development:
| Task | Description |
| ---- | ----------- |
| **build** | compiles `src/**/*.ts` files to `out/**/*.js` files using the TypeScript compiler (tsc) |
| **build:watch** | similar to _build_ but automatically builds when changes are detected in src files |
| **lint** | checks all src files to ensure they follow project code styles and rules |
| **lint:fix** | fixes lint errors when automatic fixes are available for them |
| **prettier** | checks all src files to ensure they follow project formatting conventions |
| **prettier:fix** | fixes prettier errors by rewriting files using project formatting conventions |
| **check** | runs all the checks performed as part of ci (lint, prettier) |

To run any of these tasks, use `npm run`. For example:

```sh
$ npm run build:watch
```
