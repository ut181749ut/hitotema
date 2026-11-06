// `npx cap add android` が作った直後の android/ プロジェクトに、
// ヒトテマ用の設定を上書きするスクリプト。
//
// GitHub Actions から毎回まっさらな android/ を生成する前提にしているので、
// パソコンに Android Studio を入れなくてもビルドできる。そのかわり
// 「手で直した内容が消えない」よう、変更は必ずこのスクリプトに書くこと。
//
// 使い方: node scripts/android-setup.mjs <versionCode> <versionName>

import fs from "fs";
import path from "path";

const [, , versionCodeArg, versionNameArg] = process.argv;
const versionCode = Number(versionCodeArg || 1);
const versionName = versionNameArg || "1.0.0";

const ROOT = process.cwd();
const ANDROID = path.join(ROOT, "android");
const RES = path.join(ANDROID, "app", "src", "main", "res");

function must(p) {
  if (!fs.existsSync(p)) {
    console.error(`見つかりません: ${p}\nnpx cap add android を先に実行してください。`);
    process.exit(1);
  }
  return p;
}

function edit(file, pairs) {
  const p = must(path.join(ANDROID, file));
  let s = fs.readFileSync(p, "utf-8");
  for (const [re, to, label] of pairs) {
    if (!re.test(s)) {
      console.error(`置換できません (${label}) : ${file}`);
      process.exit(1);
    }
    s = s.replace(re, to);
  }
  fs.writeFileSync(p, s, "utf-8");
  console.log("ok", file);
}

// ---- 1. バージョン。Play は同じ versionCode を二度受け付けないので、
//         CI の実行番号をそのまま使って必ず増えるようにする。 ----
edit("app/build.gradle", [
  [/versionCode \d+/, `versionCode ${versionCode}`, "versionCode"],
  [/versionName "[^"]*"/, `versionName "${versionName}"`, "versionName"],
]);

// ---- 2. アプリ名 ----
const stringsPath = must(path.join(RES, "values", "strings.xml"));
let strings = fs.readFileSync(stringsPath, "utf-8");
strings = strings
  .replace(/(<string name="app_name">)[^<]*(<\/string>)/, "$1ヒトテマ$2")
  .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, "$1ヒトテマ$2");
fs.writeFileSync(stringsPath, strings, "utf-8");
console.log("ok strings.xml");

// ---- 3. アイコン。リポジトリの android-res/ を res/ に重ねる ----
const SRC_RES = must(path.join(ROOT, "android-res"));
let copied = 0;
for (const dir of fs.readdirSync(SRC_RES)) {
  const from = path.join(SRC_RES, dir);
  if (!fs.statSync(from).isDirectory()) continue;      // play-store-icon-512.png は除外
  const to = path.join(RES, dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    copied++;
  }
}
console.log(`ok アイコン ${copied} 件`);

// ---- 4. 背景色。アダプティブアイコンの下地 ----
//   cap のテンプレートは ic_launcher_background を values/ic_launcher_background.xml
//   で定義する。android-res/values/ で上書き済みなので、重複定義があれば消す。
const colorsPath = path.join(RES, "values", "colors.xml");
if (fs.existsSync(colorsPath)) {
  let colors = fs.readFileSync(colorsPath, "utf-8");
  if (/name="ic_launcher_background"/.test(colors)) {
    colors = colors.replace(/\s*<color name="ic_launcher_background">[^<]*<\/color>/g, "");
    fs.writeFileSync(colorsPath, colors, "utf-8");
    console.log("ok colors.xml の重複定義を削除");
  }
}

console.log(`\n完了: versionCode=${versionCode} versionName=${versionName}`);
