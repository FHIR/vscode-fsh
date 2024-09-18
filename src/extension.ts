import { commands, extensions } from "vscode";

export async function activate(): Promise<void> {
  if (!extensions.getExtension("fhir-shorthand.vscode-language-fsh")) {
    await commands.executeCommand(
      "workbench.extensions.installExtension",
      "fhir-shorthand.vscode-language-fsh"
    );
  }
  commands.executeCommand(
    "workbench.extensions.uninstallExtension",
    "mitre-health.vscode-language-fsh"
  );
}
