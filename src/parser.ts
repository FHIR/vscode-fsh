import { CommonTokenStream, InputStream } from 'antlr4';
import FSHLexer from './lang/FSHLexer';
import FSHParser from './lang/FSHParser';

// implementation in this file heavily borrows from CIMPL extension:
// https://github.com/standardhealth/vscode-language-cimpl

export function getTreeForText(text: string): any {
  const chars = new InputStream(text);
  const lexer = new FSHLexer(chars);
  // @ts-ignore
  lexer.removeErrorListeners();
  // @ts-ignore
  const tokens = new CommonTokenStream(lexer);
  const parser = new FSHParser(tokens);
  // @ts-ignore
  parser.removeErrorListeners();
  // @ts-ignore
  parser.buildParseTrees = true;
  return parser.doc();
}
