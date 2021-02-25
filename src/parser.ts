import { CommonTokenStream, InputStream } from 'antlr4';
import fs from 'fs';
const { FSHLexer } = require('./lang/FSHLexer');
const { FSHParser} = require('./lang/FSHParser');

// implementation in this file heavily borrows from CIMPL extension:
// https://github.com/standardhealth/vscode-language-cimpl

export function getTreeForFile(filepath: string) {
    const chars = new InputStream(fs.readFileSync(filepath).toString());
    const lexer = new FSHLexer(chars);
    lexer.removeErrorListeners();
    const tokens = new CommonTokenStream(lexer);
    const parser = new FSHParser(tokens);
    parser.removeErrorListeners();
    parser.buildParseTrees = true;
    return parser.doc();
}