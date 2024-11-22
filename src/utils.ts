import fs from 'fs';
import path from 'path';
import { TextDocument, Position } from 'vscode';

export type DependencyDetails = {
  id: string;
  uri: string;
  version: string | number;
};

export type SushiConfiguration = {
  canonical?: string;
  fhirVersion?: string | string[];
  dependencies?: {
    [key: string]: string | number | DependencyDetails;
  };
};

export function collectFshFilesForPath(
  filepath: string,
  fshFiles: string[],
  visitedPaths: Set<string> = new Set()
) {
  const realPath = fs.realpathSync(filepath);
  if (visitedPaths.has(realPath)) {
    return;
  }
  visitedPaths.add(realPath);
  const stats = fs.statSync(realPath);
  if (stats.isDirectory()) {
    fs.readdirSync(realPath).forEach(file => {
      collectFshFilesForPath(path.join(realPath, file), fshFiles, visitedPaths);
    });
  } else if (filepath.endsWith('.fsh')) {
    fshFiles.push(realPath);
  }
}

export function getTargetName(document: TextDocument, position: Position): string {
  // What is the name of the thing we want to get a definition of?
  // An entity's name can have most any non-whitespace character in it,
  // so use our own word regex instead of the default one.
  return document.getText(document.getWordRangeAtPosition(position, /[^\s\(\)#]+/));
}
