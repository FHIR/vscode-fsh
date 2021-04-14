import fs from 'fs';
import path from 'path';
import { TextDocument, Position } from 'vscode';

export function collectFshFilesForPath(filepath: string, fshFiles: string[]): void {
  const stats = fs.statSync(filepath);
  if (stats.isDirectory()) {
    fs.readdirSync(filepath).forEach(file => {
      collectFshFilesForPath(path.join(filepath, file), fshFiles);
    });
  } else if (filepath.endsWith('.fsh')) {
    fshFiles.push(filepath);
  }
}

export function getTargetName(document: TextDocument, position: Position): string {
  // What is the name of the thing we want to get a definition of?
  // An entity's name can have most any non-whitespace character in it,
  // so use our own word regex instead of the default one.
  return document.getText(document.getWordRangeAtPosition(position, /[^\s\(\)#]+/));
}
