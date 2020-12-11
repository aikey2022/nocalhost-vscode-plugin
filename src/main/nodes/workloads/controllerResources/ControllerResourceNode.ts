import * as vscode from "vscode";

import state from "../../../state";
import { KubernetesResourceNode } from "../../abstract/KubernetesResourceNode";

export abstract class ControllerResourceNode extends KubernetesResourceNode {
  async getTreeItem(): Promise<vscode.TreeItem> {
    let treeItem = await super.getTreeItem();
    treeItem.contextValue = `workload-${this.resourceType}`;
    return treeItem;
  }

  public getStatus(): string | Promise<string> {
    const appNode = this.getAppNode();
    const status = state.getAppState(
      appNode.label,
      `${this.getNodeStateId()}_status`
    );
    return status;
  }

  /**
   *
   * @param status
   * @param fresh Refresh dependencies
   */
  public async setStatus(status: string) {
    const appNode = this.getAppNode();
    if (status) {
      state.setAppState(
        appNode.label,
        `${this.getNodeStateId()}_status`,
        status,
        {
          refresh: true,
          node: this,
        }
      );
    } else {
      state.deleteAppState(appNode.label, `${this.getNodeStateId()}_status`, {
        refresh: true,
        node: this,
      });
    }
  }

  public checkConfig() {
    return Promise.resolve(true);
  }
}
