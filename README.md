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

## Go to Definition

![FSH Go to Definition](images/docs/fsh-go-to-definition.gif)

FSH entity definitions within your workspace can be found from anywhere their name is used. To go to the entity definition, right-click on the entity name and select "Go to Definition" from the context menu. Or, you can press &lt;F12&gt; when your text cursor is on the entity name.

## Open FHIR Documentation

![FSH Go to Definition](images/docs/fsh-open-fhir-documentation.gif)

Documentation pages can be opened directly from your FSH files. Right-click on the name of any FHIR resource or FSH keyword, and select "Open FHIR Documentation" from the context menu.

## Compile and Run (for Developers)

- run `npm install` in this folder. This installs all necessary npm modules in both the
  client and server folder
- open VS Code on this folder.
- Switch to the Debug viewlet.
- Select `Extension` from the drop down.

## NPM Tasks

The following NPM tasks may be useful in development:
| Task | Description |
| ---- | ----------- |
| **build** | compiles `src/**/*.ts` files to `out/**/*.js` files using the TypeScript compiler (tsc) |
| **build:watch** | similar to _build_ but automatically builds when changes are detected in src files |
| **lint** | checks all src files to ensure they follow project code styles and rules |
| **lint:fix** | fixes lint errors when automatic fixes are available for them |
| **prettier** | checks all src files to ensure they follow project formatting conventions |
| **prettier:fix** | fixes prettier errors by rewriting files using project formatting conventions |
| **test** | runs the test suite |
| **check** | runs all the checks performed as part of ci (lint, prettier, test) |

To run any of these tasks, use `npm run`. For example:

```sh
$ npm run build:watch
```

### Note about testing

The `test` task will often (but not always) produce an error if it is run while VSCode is open. If you receive this error, close VSCode and run the task from the command line.

## Updating the Grammar

The `src/lang/` directory contains the FSH lexer and parser. When the FSH grammar changes, the files in this directory will need to be updated. These files are generated in the [SUSHI](https://github.com/FHIR/sushi) project by running ANTLR on the grammar definition files. The files are then copied from the SUSHI project to this project.
The files to copy are:

- FSH.tokens
- FSHLexer.tokens
- FSHLexer.js
- FSHListener.js
- FSHParser.js
- FSHVisitor.js
