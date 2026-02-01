import os
import sys


def main() -> int:
    """
    git filter-branch --msg-filter 用のスクリプト。

    文字化けしたコミット（バイト列が UTF-8 ではない）を、正しい日本語メッセージ（UTF-8）に差し替える。
    対象は GIT_COMMIT（元コミットID）で判定する。
    """

    commit = os.environ.get("GIT_COMMIT", "")
    # msg-filter は「バイト列」をそのまま受け取るので、必ずバイナリで扱う。
    # テキストとして decode してしまうと、非 UTF-8 のメッセージや既存 UTF-8 が壊れる可能性がある。
    original = sys.stdin.buffer.read()

    replacements: dict[str, bytes] = {
        # docs: 開発メモを更新（UTF-8で保存したい）
        "a933afd78868342c29edad1b8a185f75c7f16829": "docs: 開発メモを更新\n".encode("utf-8"),
        # master を main にマージ（UTF-8で保存したい）
        "e12a32d43410b7434e8545bae0a881ab99529904": "master を main にマージ\n".encode("utf-8"),
    }

    msg_bytes = replacements.get(commit)
    if msg_bytes is None:
        # 対象外はバイト列をそのまま返す
        sys.stdout.buffer.write(original)
        return 0

    sys.stdout.buffer.write(msg_bytes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

