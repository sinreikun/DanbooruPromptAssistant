# DanbooruPromptAssistant

## 概要
DanbooruPromptAssistant は、Danbooru でタグ検索を行いながら AI 画像生成用のプロンプトを作成するための Electron 製ツールです。ブラウザビューとタグ管理パネルを備え、日本語キーワードを英語タグへ変換して検索できます。

## 特徴
- 日本語キーワードを `dictionary.json` の内容で自動翻訳
- Google 翻訳を別ウィンドウで開き翻訳結果を適用
- Danbooru のページからタグを取得しチェックボックスで管理
- お気に入りタグの登録と一覧表示
- 生成したタグ列をコピーしたり `saved_prompts.json` に保存可能

## 使い方
1. Node.js をインストールします
2. `npm install` で依存関係をインストール
3. `npm start` を実行してアプリを起動します（Windows では `start.bat` も利用可能）

起動後は左側のブラウザで Danbooru を閲覧し、右側のパネルでタグ選択やプロンプトの保存・コピーを行います。

### 辞書の編集
`dictionary.json` を編集することで翻訳に使われる対応表を自由に追加できます。

### 保存プロンプト
保存したプロンプトは `saved_prompts.json` に記録され、一覧から呼び出し・削除できます。

## ライセンス
本プロジェクトは ISC ライセンスです。
