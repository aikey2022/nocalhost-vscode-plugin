import * as vscode from "vscode";
import { login, getUserinfo } from "../api";
import state from "../state";

export default async function showLogin() {
  if (state.isLogin()) {
    vscode.window.showInformationMessage("Logined");
    return;
  }
  const email: string | undefined = await vscode.window.showInputBox({
    placeHolder: "please input your email",
  });
  if (!email) {
    return;
  }

  const password: string | undefined = await vscode.window.showInputBox({
    placeHolder: "please input password",
    password: true,
  });
  if (!password) {
    return;
  }

  try {
    await login({ email, password });
    await getUserinfo();
    await state.setLogin(true);
    vscode.window.showInformationMessage("login successful");
  } catch (e) {
    vscode.window.showWarningMessage(e.message);
  }
}
