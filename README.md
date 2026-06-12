# へぇボタン

GitHub Pagesでそのまま公開できる静的サイトです。

## 機能

- 参加者ごとに1つの「へぇ」ボタンを表示
- 参加者名を自由に入力
- 各参加者のカウントは最大20
- 参加者数は1人から10人まで変更可能
- 画面上部に全参加者の合計へぇ数を表示
- ボタンを押すと同梱した「へぇ」の音声を再生
- Firebase Realtime Databaseでスマホ参加者画面とMC画面を同期

## 画面

- MC画面: `index.html`
- 共通参加画面: `index.html?join=1`
- 個別参加者画面: `index.html?participant=1` から `index.html?participant=10`

MC画面には全参加者の名前、ボタンイラスト、個別カウント、合計へぇ数、共通参加URL、個別参加者URL、リセット履歴が表示されます。参加者は共通参加URLで名前を入力すると、自分のボタン画面へ移動します。

GitHub Pagesで公開した場合も同じです。

- MC画面: `https://ユーザー名.github.io/リポジトリ名/`
- 共通参加画面: `https://ユーザー名.github.io/リポジトリ名/?join=1`
- 参加者1: `https://ユーザー名.github.io/リポジトリ名/?participant=1`

## 公開方法

1. このフォルダの内容をGitHubリポジトリにpushします。
2. GitHubのリポジトリ画面で `Settings` → `Pages` を開きます。
3. `Build and deployment` の `Source` を `Deploy from a branch` にします。
4. `Branch` で `main` / `/root` を選び、保存します。

数分後にGitHub PagesのURLで公開されます。
