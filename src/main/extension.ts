// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import NocalhostAppProvider from "./appProvider";
import showLogin from "./commands/login";
import * as fileStore from "./store/fileStore";
import application from "./commands/application";
import {
  BASE_URL,
  JWT,
  KUBE_CONFIG_DIR,
  NH_CONFIG_DIR,
  SELECTED_APP_NAME,
} from "./constants";
import host from "./host";
import { clearInterval } from "timers";
import { showDashboard } from "./webviews";
import { AppSubFolderNode, KubernetesResourceNode } from "./nodes/nodeType";
import nocalhostService from "./service/nocalhostService";
import NocalhostTextDocumentProvider from "./textDocumentProvider";
import * as shell from "shelljs";
import state from "./state";

let _refreshApp: NodeJS.Timeout;
export async function activate(context: vscode.ExtensionContext) {
  await init();

  let appTreeProvider = new NocalhostAppProvider();
  let nocalhostTextDocumentProvider = new NocalhostTextDocumentProvider();

  let subs = [
    vscode.window.registerTreeDataProvider("Nocalhost", appTreeProvider),
    vscode.workspace.registerTextDocumentContentProvider(
      "Nocalhost",
      nocalhostTextDocumentProvider
    ),
    registerCommand("showDashboard", false, () => {
      showDashboard(context);
    }),

    registerCommand(
      "Nocalhost.entryDevSpace",
      true,
      async (node: KubernetesResourceNode) => {
        if (!node) {
          return;
        }
        // get app name
        const appName = fileStore.get(SELECTED_APP_NAME);
        if (!appName) {
          throw new Error("you must select one app");
        }
        await nocalhostService.entryDevSpace(
          host,
          appName,
          node.resourceType,
          node.name
        );
      }
    ),
    registerCommand(
      "Nocalhost.exitDevSpace",
      true,
      async (node: KubernetesResourceNode) => {
        // get app name
        const appName = fileStore.get(SELECTED_APP_NAME);
        await nocalhostService.exitDevSpace(host, appName, node.name);
      }
    ),
    registerCommand("Nocalhost.switchEndPoint", false, async () => {
      // switch endpoint
      const url = await host.showInputBox({
        placeHolder: "input your api server url",
      });
      if (url) {
        fileStore.set(BASE_URL, url);
        host.showInformationMessage("configured api server");
        vscode.commands.executeCommand("refreshApplication");
      }
    }),

    registerCommand("Nocalhost.signout", false, () => {
      fileStore.remove(JWT);
      state.setLogin(false);
      appTreeProvider.refresh();
    }),
    registerCommand("Nocalhost.signin", false, showLogin),

    registerCommand("getApplicationList", false, () =>
      appTreeProvider.refresh()
    ),
    registerCommand("refreshApplication", false, () =>
      appTreeProvider.refresh()
    ),
    registerCommand(
      "Nocahost.installApp",
      true,
      async (appNode: AppSubFolderNode) => {
        await nocalhostService.install(
          host,
          appNode.info.name,
          appNode.id,
          appNode.devSpaceId,
          appNode.info.url
        );
      }
    ),
    registerCommand(
      "Nocahost.uninstallApp",
      true,
      async (appNode: AppSubFolderNode) => {
        await nocalhostService.uninstall(
          host,
          appNode.info.name,
          appNode.id,
          appNode.devSpaceId
        );
      }
    ),
    registerCommand(
      "useApplication",
      true,
      async (appNode: AppSubFolderNode) => {
        application.useApplication(appNode);
      }
    ),
    registerCommand(
      "Nocalhost.loadResource",
      false,
      async (node: KubernetesResourceNode | AppSubFolderNode) => {
        if (node instanceof KubernetesResourceNode) {
          const kind = node.resourceType;
          const name = node.name;
          const uri = vscode.Uri.parse(
            `Nocalhost://k8s/loadResource/${kind}/${name}.yaml`
          );
          let doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        } else if (node instanceof AppSubFolderNode) {
          const name = node.info.name;
          const uri = vscode.Uri.parse(`Nocalhost://nh/${name}.yaml`);
          let doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      }
    ),
    registerCommand(
      "Nocalhost.log",
      false,
      async (node: KubernetesResourceNode) => {
        const kind = node.resourceType;
        const name = node.name;
        const appName = fileStore.get(SELECTED_APP_NAME);
        await nocalhostService.log(host, appName, kind, name);
      }
    ),
    registerCommand(
      "Nocalhost.portForward",
      false,
      async (node: KubernetesResourceNode) => {
        const kind = node.resourceType;
        const name = node.name;
        await nocalhostService.portForward(host, kind, name);
      }
    ),
    registerCommand(
      "Nocalhost.exec",
      true,
      async (node: KubernetesResourceNode) => {
        const appName = fileStore.get(SELECTED_APP_NAME);
        await nocalhostService.exec(
          host,
          appName,
          node.resourceType,
          node.name
        );
      }
    ),
  ];

  context.subscriptions.push(...subs);
  _refreshApp = host.timer("refreshApplication", []);
  vscode.commands.executeCommand("showDashboard");
  host.getOutputChannel().show(true);
}

function registerCommand(command: string, isLock: boolean, callback: any) {
  checkCtl("nhctl");
  checkCtl("kubectl");
  checkCtl("git");
  checkCtl("mutagen");
  const dispose = vscode.commands.registerCommand(
    command,
    async (...args: any[]) => {
      if (isLock) {
        if (state.isRunning()) {
          host.showWarnMessage("A task is running, please try again later");
          return;
        }
        state.setRunning(true);
        Promise.resolve(callback(...args)).finally(() => {
          state.setRunning(false);
        });
      } else {
        callback(...args);
      }
    }
  );

  return dispose;
}

export function deactivate() {
  clearInterval(_refreshApp);
}

export function checkCtl(name: string) {
  const res = shell.which(name);
  if (res && res.code === 0) {
    return true;
  }
  throw new Error(`not found ${name}`);
}

async function init() {
  fileStore.mkdir(NH_CONFIG_DIR);
  fileStore.mkdir(KUBE_CONFIG_DIR);
  fileStore.initConfig();
}